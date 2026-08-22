import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { countBusinessDays, dreLabel } from "./reports.server";

export type PeriodInput = { from: string; to: string };

export type DashboardData = {
  soldAmount: number;
  recognizedRevenue: number;
  receivedAmount: number;
  openReceivables: number;
  overdueAmount: number;
  overdueCount: number;
  paidExpenses: number;
  operationalResult: number;
  cashBalance: number;
  averageTicket: number;
  activePatients: number;
  newPatients: number;
  renewals: number;
  expectedRenewals: number;
  renewalRate: number;
  conversionRate: number;
  appointmentsTotal: number;
  appointmentsDone: number;
  occupancyRate: number;
  patientsWithoutNextAppointment: number;
  salesCount: number;
};

/** Painel executivo — todos os números vêm do banco, com caixa e competência separados. */
export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PeriodInput) => input)
  .handler(async ({ data, context }): Promise<DashboardData> => {
    const { supabase } = context;
    const { from, to } = data;

    const [
      sales,
      recognition,
      cashIn,
      receivables,
      payablesPaid,
      allCash,
      accounts,
      patients,
      newPatientsRes,
      contracts,
      opportunities,
      appointments,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("net_amount, cancelled, is_renewal, processing_fee_amount")
        .gte("sale_date", from)
        .lte("sale_date", to),
      supabase
        .from("revenue_recognition")
        .select("gross_amount, deduction_amount, cancelled")
        .gte("competence_date", from.slice(0, 7) + "-01")
        .lte("competence_date", to),
      supabase
        .from("cash_transactions")
        .select("amount, direction")
        .gte("settled_at", from)
        .lte("settled_at", to),
      supabase.from("receivables").select("expected_amount, received_amount, status, due_date"),
      supabase
        .from("payables")
        .select("paid_amount")
        .gte("due_date", from)
        .lte("due_date", to)
        .in("status", ["pago", "parcialmente_pago"]),
      supabase.from("cash_transactions").select("amount, direction"),
      supabase.from("financial_accounts").select("initial_balance"),
      supabase.from("patients").select("id, status"),
      supabase.from("patients").select("id").gte("entry_date", from).lte("entry_date", to),
      supabase.from("contracts").select("id, status, expected_renewal_date, end_date"),
      supabase.from("opportunities").select("id, stage, created_at"),
      supabase
        .from("appointments")
        .select("id, status, patient_id, starts_at")
        .gte("starts_at", from)
        .lte("starts_at", `${to}T23:59:59`),
    ]);

    const num = (v: unknown) => Number(v ?? 0);
    const activeSales = (sales.data ?? []).filter((s) => !s.cancelled);
    const soldAmount = activeSales.reduce((a, s) => a + num(s.net_amount), 0);
    const salesCount = activeSales.length;
    const renewals = activeSales.filter((s) => s.is_renewal).length;
    const processingFees = activeSales.reduce((a, s) => a + num(s.processing_fee_amount), 0);

    const recognizedRevenue = (recognition.data ?? [])
      .filter((r) => !r.cancelled)
      .reduce((a, r) => a + num(r.gross_amount) - num(r.deduction_amount), 0);

    const receivedAmount = (cashIn.data ?? [])
      .filter((t) => t.direction === "entrada")
      .reduce((a, t) => a + num(t.amount), 0);
    const paidInPeriod = (cashIn.data ?? [])
      .filter((t) => t.direction === "saida")
      .reduce((a, t) => a + num(t.amount), 0);

    const openStatuses = ["previsto", "pendente", "vencido", "parcialmente_recebido"];
    const open = (receivables.data ?? []).filter((r) => openStatuses.includes(String(r.status)));
    const openReceivables = open.reduce(
      (a, r) => a + (num(r.expected_amount) - num(r.received_amount)),
      0,
    );
    const overdueList = (receivables.data ?? []).filter((r) => String(r.status) === "vencido");
    const overdueAmount = overdueList.reduce(
      (a, r) => a + (num(r.expected_amount) - num(r.received_amount)),
      0,
    );

    const paidExpenses =
      (payablesPaid.data ?? []).reduce((a, p) => a + num(p.paid_amount), 0) || paidInPeriod;

    const cashBalance =
      (accounts.data ?? []).reduce((a, c) => a + num(c.initial_balance), 0) +
      (allCash.data ?? []).reduce(
        (a, t) => a + (t.direction === "entrada" ? num(t.amount) : -num(t.amount)),
        0,
      );

    const activePatients = (patients.data ?? []).filter((p) => String(p.status) === "ativo").length;
    const newPatients = (newPatientsRes.data ?? []).length;

    const expectedRenewals = (contracts.data ?? []).filter(
      (c) =>
        c.expected_renewal_date && c.expected_renewal_date >= from && c.expected_renewal_date <= to,
    ).length;
    const dueContracts = (contracts.data ?? []).filter(
      (c) => c.end_date >= from && c.end_date <= to,
    ).length;
    const renewalRate = dueContracts > 0 ? (renewals / dueContracts) * 100 : 0;

    const oppsInPeriod = (opportunities.data ?? []).filter(
      (o) => String(o.created_at).slice(0, 10) >= from && String(o.created_at).slice(0, 10) <= to,
    );
    const won = oppsInPeriod.filter((o) => String(o.stage) === "ganha").length;
    const conversionRate = oppsInPeriod.length > 0 ? (won / oppsInPeriod.length) * 100 : 0;

    const appts = appointments.data ?? [];
    const appointmentsTotal = appts.filter((a) => String(a.status) !== "cancelada").length;
    const appointmentsDone = appts.filter((a) => String(a.status) === "realizada").length;
    const businessDays = Math.max(1, Math.round(countBusinessDays(from, to)));
    const occupancyRate = Math.min(100, (appointmentsTotal / (businessDays * 6)) * 100);

    const { data: futureAppts } = await supabase
      .from("appointments")
      .select("patient_id")
      .gte("starts_at", new Date().toISOString())
      .in("status", ["agendada", "confirmada"]);
    const scheduled = new Set((futureAppts ?? []).map((a) => a.patient_id));
    const patientsWithoutNextAppointment = (patients.data ?? []).filter(
      (p) => String(p.status) === "ativo" && !scheduled.has(p.id),
    ).length;

    return {
      soldAmount,
      recognizedRevenue,
      receivedAmount,
      openReceivables,
      overdueAmount,
      overdueCount: overdueList.length,
      paidExpenses,
      operationalResult: recognizedRevenue - paidExpenses - processingFees,
      cashBalance,
      averageTicket: salesCount > 0 ? soldAmount / salesCount : 0,
      activePatients,
      newPatients,
      renewals,
      expectedRenewals,
      renewalRate,
      conversionRate,
      appointmentsTotal,
      appointmentsDone,
      occupancyRate,
      patientsWithoutNextAppointment,
      salesCount,
    };
  });

export type DreRow = {
  group: string;
  label: string;
  values: Record<string, number>;
  total: number;
};

/** DRE gerencial por competência. Nunca usa datas de caixa. */
export const getDre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = `${data.year}-01-01`;
    const to = `${data.year}-12-31`;
    const months = Array.from(
      { length: 12 },
      (_, i) => `${data.year}-${String(i + 1).padStart(2, "0")}`,
    );

    const [recognition, payables, saleFees] = await Promise.all([
      supabase
        .from("revenue_recognition")
        .select("competence_date, gross_amount, deduction_amount, cancelled")
        .gte("competence_date", from)
        .lte("competence_date", to),
      supabase
        .from("payables")
        .select(
          "competence_date, expected_amount, paid_amount, status, categories(dre_group, name)",
        )
        .gte("competence_date", from)
        .lte("competence_date", to),
      supabase
        .from("sales")
        .select("sale_date, processing_fee_amount, cancelled")
        .gte("sale_date", from)
        .lte("sale_date", to),
    ]);

    const empty = () => Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;
    const gross = empty();
    const deductions = empty();
    const byGroup: Record<string, Record<string, number>> = {};

    for (const r of recognition.data ?? []) {
      if (r.cancelled) continue;
      const key = String(r.competence_date).slice(0, 7);
      if (!(key in gross)) continue;
      gross[key] = (gross[key] ?? 0) + Number(r.gross_amount ?? 0);
      deductions[key] = (deductions[key] ?? 0) + Number(r.deduction_amount ?? 0);
    }

    for (const p of payables.data ?? []) {
      if (String(p.status) === "cancelado") continue;
      const key = String(p.competence_date).slice(0, 7);
      if (!(key in gross)) continue;
      const cat = p.categories as { dre_group: string } | null;
      const group = cat?.dre_group ?? "despesas_operacionais";
      byGroup[group] ??= empty();
      const value = Number(p.expected_amount ?? 0);
      byGroup[group]![key] = (byGroup[group]![key] ?? 0) + value;
    }

    byGroup["despesas_comerciais"] ??= empty();
    for (const sale of saleFees.data ?? []) {
      if (sale.cancelled) continue;
      const key = String(sale.sale_date).slice(0, 7);
      if (!(key in gross)) continue;
      byGroup["despesas_comerciais"]![key] =
        (byGroup["despesas_comerciais"]![key] ?? 0) + Number(sale.processing_fee_amount ?? 0);
    }

    const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
    const combine = (a: Record<string, number>, b: Record<string, number>, sign = 1) =>
      Object.fromEntries(months.map((m) => [m, (a[m] ?? 0) + sign * (b[m] ?? 0)])) as Record<
        string,
        number
      >;

    const netRevenue = combine(gross, deductions, -1);
    const directCosts = byGroup["custos_diretos"] ?? empty();
    const contribution = combine(netRevenue, directCosts, -1);

    const expenseGroups = [
      "despesas_operacionais",
      "despesas_administrativas",
      "despesas_comerciais",
      "despesas_equipe",
      "impostos",
    ];
    let operational = contribution;
    for (const g of expenseGroups) operational = combine(operational, byGroup[g] ?? empty(), -1);
    const others = byGroup["outras"] ?? empty();
    const netResult = combine(operational, others, -1);

    const row = (group: string, label: string, values: Record<string, number>): DreRow => ({
      group,
      label,
      values,
      total: sum(values),
    });

    return {
      months,
      rows: [
        row("receita_bruta", "Receita bruta", gross),
        row("deducoes", "(-) Deduções e estornos", deductions),
        row("receita_liquida", "Receita líquida", netRevenue),
        row("custos_diretos", "(-) Custos diretos do serviço", directCosts),
        row("margem", "Margem de contribuição", contribution),
        ...expenseGroups.map((g) => row(g, `(-) ${dreLabel(g)}`, byGroup[g] ?? empty())),
        row("resultado_operacional", "Resultado operacional", operational),
        row("outras", "(-) Outras receitas e despesas", others),
        row("resultado_liquido", "Resultado líquido", netResult),
      ],
    };
  });

export type CashflowDay = {
  date: string;
  expectedIn: number;
  actualIn: number;
  expectedOut: number;
  actualOut: number;
  projectedBalance: number;
  actualBalance: number;
};

/** Fluxo de caixa — sempre pela data em que o dinheiro entra ou sai. */
export const getCashflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PeriodInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [accounts, priorCash, cash, recv, pay] = await Promise.all([
      supabase.from("financial_accounts").select("initial_balance"),
      supabase.from("cash_transactions").select("amount, direction").lt("settled_at", data.from),
      supabase
        .from("cash_transactions")
        .select("settled_at, amount, direction")
        .gte("settled_at", data.from)
        .lte("settled_at", data.to),
      supabase
        .from("receivables")
        .select("due_date, expected_amount, received_amount, status")
        .gte("due_date", data.from)
        .lte("due_date", data.to),
      supabase
        .from("payables")
        .select("due_date, expected_amount, paid_amount, status")
        .gte("due_date", data.from)
        .lte("due_date", data.to),
    ]);

    const num = (v: unknown) => Number(v ?? 0);
    const openingBalance =
      (accounts.data ?? []).reduce((a, c) => a + num(c.initial_balance), 0) +
      (priorCash.data ?? []).reduce(
        (a, t) => a + (t.direction === "entrada" ? num(t.amount) : -num(t.amount)),
        0,
      );

    const byDay = new Map<string, CashflowDay>();
    const ensure = (date: string) => {
      let d = byDay.get(date);
      if (!d) {
        d = {
          date,
          expectedIn: 0,
          actualIn: 0,
          expectedOut: 0,
          actualOut: 0,
          projectedBalance: 0,
          actualBalance: 0,
        };
        byDay.set(date, d);
      }
      return d;
    };

    for (const t of cash.data ?? []) {
      const d = ensure(String(t.settled_at));
      if (t.direction === "entrada") d.actualIn += num(t.amount);
      else d.actualOut += num(t.amount);
    }
    for (const r of recv.data ?? []) {
      if (["cancelado", "estornado", "recebido"].includes(String(r.status))) continue;
      const d = ensure(String(r.due_date));
      d.expectedIn += num(r.expected_amount) - num(r.received_amount);
    }
    for (const p of pay.data ?? []) {
      if (["cancelado", "estornado", "pago"].includes(String(p.status))) continue;
      const d = ensure(String(p.due_date));
      d.expectedOut += num(p.expected_amount) - num(p.paid_amount);
    }

    const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    let projected = openingBalance;
    let actual = openingBalance;
    for (const d of days) {
      actual += d.actualIn - d.actualOut;
      projected += d.actualIn - d.actualOut + d.expectedIn - d.expectedOut;
      d.actualBalance = actual;
      d.projectedBalance = projected;
    }

    return {
      openingBalance,
      days,
      totals: {
        expectedIn: days.reduce((a, d) => a + d.expectedIn, 0),
        actualIn: days.reduce((a, d) => a + d.actualIn, 0),
        expectedOut: days.reduce((a, d) => a + d.expectedOut, 0),
        actualOut: days.reduce((a, d) => a + d.actualOut, 0),
        closingActual: actual,
        closingProjected: projected,
      },
    };
  });
