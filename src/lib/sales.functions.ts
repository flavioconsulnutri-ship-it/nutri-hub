import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addDays,
  addMonths,
  buildInstallments,
  buildRecognition,
  fromCents,
  listPriceForMethod,
  toCents,
} from "./finance.server";

export type WonSaleInput = {
  patientId: string;
  planId: string;
  paymentMethod: string;
  saleDate: string;
  discount: number;
  installments: number;
  downPayment: number;
  opportunityId?: string | null;
  accountId?: string | null;
  isRenewal?: boolean;
  notes?: string | null;
};

/**
 * Regra central do sistema: transforma uma venda ganha em contrato, parcelas a
 * receber e reconhecimento de receita por competência (rateado pelos meses do
 * plano). Nada aqui é calculado no frontend.
 */
export const registerWonSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WonSaleInput) => {
    if (!input.patientId) throw new Error("Selecione o paciente.");
    if (!input.planId) throw new Error("Selecione o plano.");
    if (!input.saleDate) throw new Error("Informe a data da venda.");
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

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", data.planId)
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

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        org_id: orgId,
        patient_id: data.patientId,
        plan_id: data.planId,
        opportunity_id: data.opportunityId ?? null,
        sale_date: data.saleDate,
        gross_amount: fromCents(listCents),
        discount_amount: fromCents(totalDiscount),
        net_amount: fromCents(netCents),
        payment_method: data.paymentMethod as never,
        installments,
        down_payment: Math.max(0, Number(data.downPayment || 0)),
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
        patient_id: data.patientId,
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
    if (contractError) throw new Error(`Venda criada, mas o contrato falhou: ${contractError.message}`);

    const installmentRows = buildInstallments({
      netAmountCents: netCents,
      installments,
      downPaymentCents: toCents(data.downPayment || 0),
      saleDate: data.saleDate,
    });

    const { error: recvError } = await supabase.from("receivables").insert(
      installmentRows.map((row) => ({
        org_id: orgId,
        patient_id: data.patientId,
        sale_id: sale.id,
        contract_id: contract.id,
        account_id: data.accountId ?? null,
        description: `${plan.name} — parcela ${row.installment_number}/${row.installment_total}`,
        installment_number: row.installment_number,
        installment_total: row.installment_total,
        due_date: row.due_date,
        expected_amount: row.expected_amount,
        status: "pendente" as never,
        payment_method: data.paymentMethod as never,
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
        patient_id: data.patientId,
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
      .eq("id", data.patientId)
      .maybeSingle();
    if (patient && patient.status !== "ativo") {
      await supabase.from("patients").update({ status: "ativo" as never }).eq("id", data.patientId);
      await supabase.from("patient_status_history").insert({
        org_id: orgId,
        patient_id: data.patientId,
        from_status: patient.status,
        to_status: "ativo" as never,
        changed_by: userId,
        note: data.isRenewal ? "Renovação registrada" : "Venda ganha",
      });
    }

    if (data.opportunityId) {
      await supabase
        .from("opportunities")
        .update({ stage: "ganha" as never, closed_at: new Date().toISOString() })
        .eq("id", data.opportunityId);
    }

    return {
      saleId: sale.id,
      contractId: contract.id,
      installments: installmentRows.length,
      netAmount: fromCents(netCents),
      listAmount: fromCents(listCents),
      discount: fromCents(totalDiscount),
      monthlyRecognition: recognition[0]?.gross_amount ?? 0,
      endDate,
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

    await supabase.from("sales").update({ cancelled: true, notes: data.reason ?? null }).eq("id", data.saleId);
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
    await supabase.from("contracts").update({ status: "cancelado" as never }).eq("sale_id", data.saleId);
    return { ok: true };
  });
