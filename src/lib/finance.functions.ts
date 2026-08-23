import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromCents, toCents } from "./finance.server";

/** Baixa de parcela: registra o valor recebido e o movimento de caixa na data de liquidação. */
export const settleReceivable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      receivableId: string;
      amount: number;
      settledAt: string;
      accountId: string;
      paymentMethod: string;
    }) => {
      if (!input.receivableId) throw new Error("Parcela não informada.");
      if (!input.accountId) throw new Error("Selecione a conta financeira.");
      if (!(input.amount > 0)) throw new Error("Informe um valor maior que zero.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: recv, error } = await supabase
      .from("receivables")
      .select("*")
      .eq("id", data.receivableId)
      .maybeSingle();
    if (error || !recv) throw new Error("Parcela não encontrada.");
    if (recv.status === "cancelado" || recv.status === "estornado")
      throw new Error("Parcela cancelada ou estornada não pode receber baixa.");

    const expected = toCents(Number(recv.expected_amount));
    const already = toCents(Number(recv.received_amount));
    const incoming = toCents(data.amount);
    const total = already + incoming;
    if (total > expected) throw new Error("O valor informado excede o saldo da parcela.");

    const status = total >= expected ? "recebido" : "parcialmente_recebido";

    const { error: updError } = await supabase
      .from("receivables")
      .update({
        received_amount: fromCents(total),
        status: status as never,
        account_id: data.accountId,
        payment_method: data.paymentMethod as never,
      })
      .eq("id", recv.id);
    if (updError) throw new Error(`Não foi possível dar baixa: ${updError.message}`);

    const { error: cashError } = await supabase.from("cash_transactions").insert({
      org_id: recv.org_id,
      account_id: data.accountId,
      receivable_id: recv.id,
      patient_id: recv.patient_id,
      direction: "entrada",
      settled_at: data.settledAt,
      amount: fromCents(incoming),
      description: recv.description,
      payment_method: data.paymentMethod as never,
      created_by: userId,
    });
    if (cashError) throw new Error(`Baixa registrada, mas o caixa falhou: ${cashError.message}`);

    // paciente deixa de ser inadimplente se não há mais parcelas vencidas
    if (recv.patient_id) {
      const { data: overdue } = await supabase
        .from("receivables")
        .select("id")
        .eq("patient_id", recv.patient_id)
        .eq("status", "vencido")
        .limit(1);
      if ((overdue ?? []).length === 0) {
        await supabase
          .from("patients")
          .update({ status: "ativo" as never })
          .eq("id", recv.patient_id)
          .eq("status", "inadimplente");
      }
    }

    return { status, received: fromCents(total), expected: fromCents(expected) };
  });

/** Estorno: devolve o valor recebido e lança a saída no caixa. */
export const reverseReceivable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receivableId: string; settledAt: string; accountId: string }) => {
    if (!input.receivableId) throw new Error("Parcela não informada.");
    if (!input.accountId) throw new Error("Selecione a conta financeira.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: recv } = await supabase
      .from("receivables")
      .select("*")
      .eq("id", data.receivableId)
      .maybeSingle();
    if (!recv) throw new Error("Parcela não encontrada.");
    const received = Number(recv.received_amount);
    if (!(received > 0)) throw new Error("Não há valor recebido para estornar.");

    await supabase
      .from("receivables")
      .update({ received_amount: 0, status: "estornado" as never })
      .eq("id", recv.id);

    await supabase.from("cash_transactions").insert({
      org_id: recv.org_id,
      account_id: data.accountId,
      receivable_id: recv.id,
      patient_id: recv.patient_id,
      direction: "saida",
      settled_at: data.settledAt,
      amount: received,
      description: `Estorno — ${recv.description}`,
      is_reversal: true,
      created_by: userId,
    });

    return { ok: true };
  });

/** Baixa de despesa. */
export const settlePayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { payableId: string; amount: number; settledAt: string; accountId: string }) => {
      if (!input.payableId) throw new Error("Despesa não informada.");
      if (!input.accountId) throw new Error("Selecione a conta financeira.");
      if (!(input.amount > 0)) throw new Error("Informe um valor maior que zero.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pay } = await supabase
      .from("payables")
      .select("*")
      .eq("id", data.payableId)
      .maybeSingle();
    if (!pay) throw new Error("Despesa não encontrada.");

    const expected = toCents(Number(pay.expected_amount));
    const total = toCents(Number(pay.paid_amount)) + toCents(data.amount);
    if (total > expected) throw new Error("O valor informado excede o saldo da despesa.");

    await supabase
      .from("payables")
      .update({
        paid_amount: fromCents(total),
        status: (total >= expected ? "pago" : "parcialmente_pago") as never,
        account_id: data.accountId,
      })
      .eq("id", pay.id);

    await supabase.from("cash_transactions").insert({
      org_id: pay.org_id,
      account_id: data.accountId,
      payable_id: pay.id,
      direction: "saida",
      settled_at: data.settledAt,
      amount: data.amount,
      description: pay.description,
      created_by: userId,
    });

    return { ok: true };
  });

/** Ajusta a data prevista de um recebimento ainda em aberto. */
export const updateReceivableDueDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receivableId: string; dueDate: string }) => {
    if (!input.receivableId) throw new Error("Recebimento não informado.");
    if (!input.dueDate) throw new Error("Informe a nova data prevista.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("receivables")
      .update({ due_date: data.dueDate, status: "pendente" as never })
      .eq("id", data.receivableId)
      .in("status", ["previsto", "pendente", "parcialmente_recebido", "vencido"]);
    if (error) throw new Error(`Não foi possível alterar a data: ${error.message}`);
    return { ok: true };
  });

/** Ajusta o vencimento de uma despesa ainda em aberto. */
export const updatePayableDueDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payableId: string; dueDate: string }) => {
    if (!input.payableId) throw new Error("Despesa não informada.");
    if (!input.dueDate) throw new Error("Informe o novo vencimento.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("payables")
      .update({ due_date: data.dueDate, status: "pendente" as never })
      .eq("id", data.payableId)
      .in("status", ["previsto", "pendente", "parcialmente_pago", "vencido"]);
    if (error) throw new Error(`Não foi possível alterar o vencimento: ${error.message}`);
    return { ok: true };
  });

/** Marca como vencidas as parcelas e despesas em atraso e sinaliza pacientes inadimplentes. */
export const refreshOverdue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);

    const { data: overdue } = await supabase
      .from("receivables")
      .update({ status: "vencido" as never })
      .lt("due_date", today)
      .in("status", ["previsto", "pendente"])
      .select("patient_id");

    await supabase
      .from("payables")
      .update({ status: "vencido" as never })
      .lt("due_date", today)
      .in("status", ["previsto", "pendente"]);

    const patientIds = [...new Set((overdue ?? []).map((r) => r.patient_id).filter(Boolean))];
    if (patientIds.length > 0) {
      await supabase
        .from("patients")
        .update({ status: "inadimplente" as never })
        .in("id", patientIds as string[])
        .eq("status", "ativo");
    }

    return { updated: (overdue ?? []).length };
  });
