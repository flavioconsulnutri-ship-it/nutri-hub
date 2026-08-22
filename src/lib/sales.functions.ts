import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addDays,
  addMonths,
  buildSettlement,
  buildRecognition,
  fromCents,
  listPriceForMethod,
  toCents,
} from "./finance.server";

export type WonSaleInput = {
  patientId?: string | null;
  leadId?: string | null;
  planId: string;
  paymentMethod: string;
  saleDate: string;
  discount: number;
  installments: number;
  downPayment: number;
  settlementMode: "integral" | "parcelado";
  settlementDate: string;
  cardFeePercent: number;
  anticipationFeePercent: number;
  opportunityId?: string | null;
  accountId?: string | null;
  isRenewal?: boolean;
  notes?: string | null;
};

export type SalePreviewInput = Pick<
  WonSaleInput,
  | "planId"
  | "paymentMethod"
  | "saleDate"
  | "discount"
  | "installments"
  | "downPayment"
  | "settlementMode"
  | "settlementDate"
  | "cardFeePercent"
  | "anticipationFeePercent"
>;

/** Usa as mesmas regras financeiras do fechamento para explicar o impacto antes da confirmação. */
export const previewWonSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SalePreviewInput) => {
    if (!input.planId) throw new Error("Selecione o plano.");
    if (!input.saleDate) throw new Error("Informe a data da venda.");
    if (!input.settlementDate) throw new Error("Informe a data prevista do repasse.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Perfil não encontrado.");

    const { data: plan, error } = await supabase
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .eq("org_id", profile.org_id)
      .maybeSingle();
    if (error || !plan) throw new Error("Plano não encontrado.");

    const { listCents, chargedCents } = listPriceForMethod(plan, data.paymentMethod);
    const explicitDiscount = Math.max(0, toCents(data.discount));
    const totalDiscount = Math.max(0, listCents - chargedCents) + explicitDiscount;
    const netCents = Math.max(0, listCents - totalDiscount);
    const installments =
      data.paymentMethod === "cartao_credito"
        ? Math.max(1, data.installments || plan.installment_count || 1)
        : Math.max(1, data.installments || 1);
    const cardFeeCents = Math.round(
      (netCents * Math.max(0, Number(data.cardFeePercent || 0))) / 100,
    );
    const anticipationFeeCents = Math.round(
      (netCents * Math.max(0, Number(data.anticipationFeePercent || 0))) / 100,
    );
    const processingFeeCents = Math.min(netCents, cardFeeCents + anticipationFeeCents);
    const expectedCashCents = Math.max(0, netCents - processingFeeCents);
    const settlementRows = buildSettlement({
      amountCents: expectedCashCents,
      customerInstallments: installments,
      mode: data.settlementMode,
      settlementDate: data.settlementDate,
    });
    const recognition = buildRecognition({
      listAmountCents: listCents,
      discountCents: totalDiscount,
      months: plan.duration_months,
      startDate: data.saleDate,
    });
    const endDate = addDays(addMonths(data.saleDate, plan.duration_months), -1);

    return {
      planName: plan.name,
      grossAmount: fromCents(listCents),
      totalDiscount: fromCents(totalDiscount),
      netAmount: fromCents(netCents),
      downPayment: Math.min(fromCents(netCents), Math.max(0, Number(data.downPayment || 0))),
      settlements: settlementRows,
      customerInstallments: installments,
      processingFee: fromCents(processingFeeCents),
      expectedCashAmount: fromCents(expectedCashCents),
      recognition: recognition.map((row) => ({
        ...row,
        net_amount: Math.max(0, row.gross_amount - row.deduction_amount),
      })),
      endDate,
      expectedRenewalDate: addDays(endDate, -30),
    };
  });

/**
 * Regra central do sistema: transforma uma venda ganha em contrato, parcelas a
 * receber e reconhecimento de receita por competência (rateado pelos meses do
 * plano). Nada aqui é calculado no frontend.
 */
export const registerWonSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WonSaleInput) => {
    if (!input.patientId && !input.leadId)
      throw new Error("Informe o paciente ou o lead da venda.");
    if (!input.planId) throw new Error("Selecione o plano.");
    if (!input.saleDate) throw new Error("Informe a data da venda.");
    if (!input.paymentMethod) throw new Error("Selecione a forma de pagamento.");
    if (Number(input.discount) < 0) throw new Error("O desconto não pode ser negativo.");
    if (Number(input.downPayment) < 0) throw new Error("A entrada não pode ser negativa.");
    if (Number(input.installments) < 1) throw new Error("Informe ao menos uma parcela.");
    if (!input.settlementDate) throw new Error("Informe a data prevista do repasse.");
    if (Number(input.cardFeePercent) < 0 || Number(input.anticipationFeePercent) < 0)
      throw new Error("As taxas não podem ser negativas.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error("Perfil não encontrado.");
    const orgId = profile.org_id;

    if (data.opportunityId) {
      const { data: existingSale } = await supabase
        .from("sales")
        .select("id")
        .eq("opportunity_id", data.opportunityId)
        .eq("cancelled", false)
        .maybeSingle();
      if (existingSale) throw new Error("Esta oportunidade já possui uma venda registrada.");
    }

    let patientId = data.patientId ?? null;
    let lead: {
      id: string;
      converted_patient_id: string | null;
      email: string | null;
      full_name: string;
      notes: string | null;
      org_id: string;
      phone: string;
      referred_by: string | null;
      source: string | null;
    } | null = null;

    if (data.leadId) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select(
          "id, converted_patient_id, email, full_name, notes, org_id, phone, referred_by, source",
        )
        .eq("id", data.leadId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (leadError || !leadData) throw new Error("Lead não encontrado.");
      lead = leadData;
      patientId = patientId ?? lead.converted_patient_id;
    }

    if (!patientId && lead) {
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .insert({
          org_id: orgId,
          full_name: lead.full_name,
          phone: lead.phone || null,
          email: lead.email || null,
          source: lead.source,
          referred_by: lead.referred_by,
          notes: lead.notes,
          status: "lead" as never,
          entry_date: data.saleDate,
          created_by: userId,
        })
        .select("id")
        .single();
      if (patientError || !patient)
        throw new Error(`Não foi possível converter o lead em paciente: ${patientError?.message}`);
      patientId = patient.id;
      await supabase.from("leads").update({ converted_patient_id: patientId }).eq("id", lead.id);
    }

    if (!patientId) throw new Error("Não foi possível identificar o paciente da venda.");

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (planError || !plan) throw new Error("Plano não encontrado.");

    const { listCents, chargedCents } = listPriceForMethod(plan, data.paymentMethod);
    const explicitDiscount = toCents(data.discount);
    // desconto total = diferença entre tabela (cartão) e valor cobrado + desconto manual
    const totalDiscount = Math.max(0, listCents - chargedCents) + Math.max(0, explicitDiscount);
    const netCents = Math.max(0, listCents - totalDiscount);

    const installments =
      data.paymentMethod === "cartao_credito"
        ? Math.max(1, data.installments || plan.installment_count || 1)
        : Math.max(1, data.installments || 1);
    const cardFeeCents = Math.round(
      (netCents * Math.max(0, Number(data.cardFeePercent || 0))) / 100,
    );
    const anticipationFeeCents = Math.round(
      (netCents * Math.max(0, Number(data.anticipationFeePercent || 0))) / 100,
    );
    const processingFeeCents = Math.min(netCents, cardFeeCents + anticipationFeeCents);
    const expectedCashCents = Math.max(0, netCents - processingFeeCents);

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        org_id: orgId,
        patient_id: patientId,
        plan_id: data.planId,
        opportunity_id: data.opportunityId ?? null,
        sale_date: data.saleDate,
        gross_amount: fromCents(listCents),
        discount_amount: fromCents(totalDiscount),
        net_amount: fromCents(netCents),
        payment_method: data.paymentMethod as never,
        installments,
        down_payment: Math.max(0, Number(data.downPayment || 0)),
        settlement_mode: data.settlementMode,
        settlement_date: data.settlementDate,
        card_fee_percent: Math.max(0, Number(data.cardFeePercent || 0)),
        anticipation_fee_percent: Math.max(0, Number(data.anticipationFeePercent || 0)),
        processing_fee_amount: fromCents(processingFeeCents),
        expected_cash_amount: fromCents(expectedCashCents),
        is_renewal: Boolean(data.isRenewal),
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (saleError) throw new Error(`Não foi possível registrar a venda: ${saleError.message}`);

    const endDate = addDays(addMonths(data.saleDate, plan.duration_months), -1);
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .insert({
        org_id: orgId,
        sale_id: sale.id,
        patient_id: patientId,
        plan_id: data.planId,
        start_date: data.saleDate,
        end_date: endDate,
        months: plan.duration_months,
        consultations_included: plan.consultations,
        status: "ativo" as never,
        expected_renewal_date: addDays(endDate, -30),
      })
      .select("*")
      .single();
    if (contractError)
      throw new Error(`Venda criada, mas o contrato falhou: ${contractError.message}`);

    const settlementRows = buildSettlement({
      amountCents: expectedCashCents,
      customerInstallments: installments,
      mode: data.settlementMode,
      settlementDate: data.settlementDate,
    });

    const { error: recvError } = await supabase.from("receivables").insert(
      settlementRows.map((row) => ({
        org_id: orgId,
        patient_id: patientId,
        sale_id: sale.id,
        contract_id: contract.id,
        account_id: data.accountId ?? null,
        description:
          data.settlementMode === "integral"
            ? `${plan.name} — repasse integral líquido`
            : `${plan.name} — repasse ${row.installment_number}/${row.installment_total}`,
        installment_number: row.installment_number,
        installment_total: row.installment_total,
        due_date: row.due_date,
        expected_amount: row.expected_amount,
        status: "pendente" as never,
        payment_method: data.paymentMethod as never,
        notes: `Venda em ${installments}x para o cliente. Taxas descontadas do repasse: ${fromCents(processingFeeCents).toFixed(2)}.`,
      })),
    );
    if (recvError) throw new Error(`Parcelas não geradas: ${recvError.message}`);

    const recognition = buildRecognition({
      listAmountCents: listCents,
      discountCents: totalDiscount,
      months: plan.duration_months,
      startDate: data.saleDate,
    });
    const { error: revError } = await supabase.from("revenue_recognition").insert(
      recognition.map((row) => ({
        org_id: orgId,
        contract_id: contract.id,
        sale_id: sale.id,
        patient_id: patientId,
        competence_date: row.competence_date,
        gross_amount: row.gross_amount,
        deduction_amount: row.deduction_amount,
      })),
    );
    if (revError) throw new Error(`Receita por competência não gerada: ${revError.message}`);

    // status do paciente e histórico
    const { data: patient } = await supabase
      .from("patients")
      .select("status")
      .eq("id", patientId)
      .maybeSingle();
    if (patient && patient.status !== "ativo") {
      await supabase
        .from("patients")
        .update({ status: "ativo" as never })
        .eq("id", patientId);
      await supabase.from("patient_status_history").insert({
        org_id: orgId,
        patient_id: patientId,
        from_status: patient.status,
        to_status: "ativo" as never,
        changed_by: userId,
        note: data.isRenewal ? "Renovação registrada" : "Venda ganha",
      });
    }

    if (lead) {
      await supabase
        .from("leads")
        .update({ converted_patient_id: patientId, converted_at: new Date().toISOString() })
        .eq("id", lead.id);
    }

    if (data.opportunityId) {
      const { data: updatedOpportunity } = await supabase
        .from("opportunities")
        .update({
          stage: "ganha" as never,
          closed_at: new Date().toISOString(),
          patient_id: patientId,
          plan_id: data.planId,
          payment_method: data.paymentMethod as never,
          amount: fromCents(netCents),
          next_action: null,
          next_action_details: null,
          next_action_date: null,
          stalled_from_stage: null,
        })
        .eq("id", data.opportunityId)
        .select("owner_id")
        .maybeSingle();
      await supabase.from("opportunity_activities").insert({
        org_id: orgId,
        opportunity_id: data.opportunityId,
        kind: "venda_concluida",
        description: `Pagamento confirmado. Venda registrada no valor líquido de ${fromCents(netCents).toFixed(2)}.`,
        created_by: userId,
      });
      await supabase.from("crm_tasks").insert({
        org_id: orgId,
        opportunity_id: data.opportunityId,
        title: "Iniciar onboarding do novo paciente",
        due_date: data.saleDate,
        sequence_key: `onboarding:${sale.id}`,
        assigned_to: updatedOpportunity?.owner_id ?? userId,
      });
    }

    return {
      saleId: sale.id,
      contractId: contract.id,
      installments,
      settlements: settlementRows.length,
      netAmount: fromCents(netCents),
      expectedCashAmount: fromCents(expectedCashCents),
      processingFee: fromCents(processingFeeCents),
      listAmount: fromCents(listCents),
      discount: fromCents(totalDiscount),
      monthlyRecognition: recognition[0]?.gross_amount ?? 0,
      endDate,
      patientId,
    };
  });

/** Cancela a venda: parcelas em aberto e competências futuras deixam de valer. */
export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { saleId: string; reason?: string }) => {
    if (!input.saleId) throw new Error("Venda não informada.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);

    await supabase
      .from("sales")
      .update({ cancelled: true, notes: data.reason ?? null })
      .eq("id", data.saleId);
    await supabase
      .from("receivables")
      .update({ status: "cancelado" as never })
      .eq("sale_id", data.saleId)
      .in("status", ["previsto", "pendente", "vencido"]);
    await supabase
      .from("revenue_recognition")
      .update({ cancelled: true })
      .eq("sale_id", data.saleId)
      .gte("competence_date", today.slice(0, 7) + "-01");
    await supabase
      .from("contracts")
      .update({ status: "cancelado" as never })
      .eq("sale_id", data.saleId);
    return { ok: true };
  });
