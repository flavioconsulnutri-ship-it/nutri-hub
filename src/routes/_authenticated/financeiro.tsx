import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Landmark, WalletCards } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { PageBody, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatBRL, formatDate, monthEndISO, monthStartISO, todayISO } from "@/lib/format";
import { receivableStatusLabel, receivableStatusTone } from "@/lib/labels";

type ReceivableStatus = Database["public"]["Enums"]["receivable_status"];

const openReceivableStatuses: ReceivableStatus[] = [
  "previsto",
  "pendente",
  "parcialmente_recebido",
  "vencido",
];
const openPayableStatuses: Database["public"]["Enums"]["payable_status"][] = [
  "previsto",
  "pendente",
  "parcialmente_pago",
  "vencido",
];

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Meu Consultório" },
      {
        name: "description",
        content: "Caixa realizado, valores previstos e resultado por competência.",
      },
    ],
  }),
  component: FinancialPage,
});

function FinancialPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { canViewFinancial } = useSession();
  const from = monthStartISO(`${month}-01`);
  const to = monthEndISO(`${month}-01`);

  const financial = useQuery({
    queryKey: ["financial-overview", from, to],
    enabled: canViewFinancial,
    queryFn: async () => {
      const [cash, receivables, payables, recognition] = await Promise.all([
        supabase
          .from("cash_transactions")
          .select("id, direction, settled_at, amount, description, is_reversal")
          .gte("settled_at", from)
          .lte("settled_at", to)
          .order("settled_at", { ascending: false }),
        supabase
          .from("receivables")
          .select(
            "id, description, due_date, expected_amount, received_amount, status, patients(full_name)",
          )
          .in("status", openReceivableStatuses)
          .order("due_date")
          .limit(1000),
        supabase
          .from("payables")
          .select("id, description, due_date, expected_amount, paid_amount, status")
          .in("status", openPayableStatuses)
          .order("due_date")
          .limit(1000),
        supabase
          .from("revenue_recognition")
          .select("gross_amount, deduction_amount")
          .eq("cancelled", false)
          .gte("competence_date", from)
          .lte("competence_date", to),
      ]);

      const error = cash.error ?? receivables.error ?? payables.error ?? recognition.error;
      if (error) throw new Error(error.message);

      return {
        cash: cash.data ?? [],
        receivables: receivables.data ?? [],
        payables: payables.data ?? [],
        recognition: recognition.data ?? [],
      };
    },
  });

  const overview = useMemo(() => {
    const data = financial.data;
    if (!data) return null;

    const cashIn = data.cash
      .filter((item) => item.direction === "entrada")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const cashOut = data.cash
      .filter((item) => item.direction === "saida")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const receivablesInPeriod = data.receivables.filter(
      (item) => item.due_date >= from && item.due_date <= to,
    );
    const payablesInPeriod = data.payables.filter(
      (item) => item.due_date >= from && item.due_date <= to,
    );
    const openReceivables = receivablesInPeriod.reduce(
      (sum, item) => sum + Math.max(0, Number(item.expected_amount) - Number(item.received_amount)),
      0,
    );
    const openPayables = payablesInPeriod.reduce(
      (sum, item) => sum + Math.max(0, Number(item.expected_amount) - Number(item.paid_amount)),
      0,
    );
    const overdueReceivables = data.receivables.filter((item) => item.due_date < todayISO());
    const overdueAmount = overdueReceivables.reduce(
      (sum, item) => sum + Math.max(0, Number(item.expected_amount) - Number(item.received_amount)),
      0,
    );
    const grossRecognition = data.recognition.reduce(
      (sum, item) => sum + Number(item.gross_amount),
      0,
    );
    const deductions = data.recognition.reduce(
      (sum, item) => sum + Number(item.deduction_amount),
      0,
    );

    return {
      cashIn,
      cashOut,
      cashNet: cashIn - cashOut,
      openReceivables,
      openPayables,
      overdueAmount,
      overdueCount: overdueReceivables.length,
      grossRecognition,
      deductions,
      netRecognition: grossRecognition - deductions,
      upcomingReceivables: data.receivables.slice(0, 6),
    };
  }, [financial.data, from, to]);

  if (!canViewFinancial) {
    return (
      <PageBody>
        <PageHeader
          title="Financeiro"
          description="Caixa realizado, valores previstos e resultado por competência."
        />
        <div className="panel mt-8 p-6 text-sm text-muted-foreground">
          Seu perfil não possui acesso às informações financeiras.
        </div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Financeiro"
        description="Veja separadamente o dinheiro movimentado, os compromissos previstos e a receita reconhecida."
        actions={
          <div className="space-y-1">
            <Label htmlFor="financial-month" className="text-xs">
              Mês de referência
            </Label>
            <Input
              id="financial-month"
              type="month"
              className="w-44"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
          </div>
        }
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="cash" disabled>
            Fluxo de caixa
          </TabsTrigger>
          <TabsTrigger value="commitments" disabled>
            Contas a pagar e receber
          </TabsTrigger>
          <TabsTrigger value="dre" disabled>
            DRE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-6">
          {financial.isError ? (
            <div className="panel border-destructive/30 p-5 text-sm text-destructive">
              Não foi possível carregar a visão financeira. Atualize a página e tente novamente.
            </div>
          ) : financial.isLoading || !overview ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <section>
                <div className="mb-3">
                  <h2 className="section-title">Caixa realizado</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Somente valores que efetivamente entraram ou saíram da conta no mês.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <FinancialMetric
                    label="Entradas realizadas"
                    value={formatBRL(overview.cashIn)}
                    icon={<ArrowDownLeft className="size-4 text-emerald-700" />}
                  />
                  <FinancialMetric
                    label="Saídas realizadas"
                    value={formatBRL(overview.cashOut)}
                    icon={<ArrowUpRight className="size-4 text-red-700" />}
                  />
                  <FinancialMetric
                    label="Movimento líquido"
                    value={formatBRL(overview.cashNet)}
                    tone={overview.cashNet < 0 ? "negative" : "positive"}
                    icon={<Landmark className="size-4" />}
                  />
                </div>
              </section>

              <section>
                <div className="mb-3">
                  <h2 className="section-title">Previsões e competência</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Compromissos do mês e receita do serviço reconhecida independentemente do
                    recebimento.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <FinancialMetric
                    label="A receber no mês"
                    value={formatBRL(overview.openReceivables)}
                    hint={
                      overview.overdueCount
                        ? `${overview.overdueCount} vencido(s) · ${formatBRL(overview.overdueAmount)}`
                        : "Nenhum recebimento vencido"
                    }
                    tone={overview.overdueCount ? "warning" : undefined}
                    icon={<WalletCards className="size-4" />}
                  />
                  <FinancialMetric
                    label="A pagar no mês"
                    value={formatBRL(overview.openPayables)}
                    hint="Despesas ainda não liquidadas"
                    icon={<ArrowUpRight className="size-4" />}
                  />
                  <FinancialMetric
                    label="Receita após descontos por competência"
                    value={formatBRL(overview.netRecognition)}
                    hint={`${formatBRL(overview.grossRecognition)} brutos · ${formatBRL(overview.deductions)} em descontos`}
                    icon={<Landmark className="size-4" />}
                  />
                </div>
              </section>

              <section className="panel overflow-hidden">
                <div className="flex items-start gap-3 border-b border-border p-4">
                  <WalletCards className="mt-0.5 size-5 text-primary" />
                  <div>
                    <h2 className="font-semibold">Próximos recebimentos</h2>
                    <p className="text-xs text-muted-foreground">
                      A venda aparece aqui como previsão; ela só entra no caixa depois da baixa.
                    </p>
                  </div>
                </div>
                {overview.upcomingReceivables.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Recebimento</th>
                          <th className="px-4 py-3 font-medium">Paciente</th>
                          <th className="px-4 py-3 font-medium">Vencimento</th>
                          <th className="px-4 py-3 text-right font-medium">Saldo</th>
                          <th className="px-4 py-3 font-medium">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {overview.upcomingReceivables.map((item) => {
                          const patient = item.patients as { full_name: string } | null;
                          const isOverdue = item.due_date < todayISO();
                          const status = isOverdue ? "vencido" : item.status;
                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium">{item.description}</td>
                              <td className="px-4 py-3">{patient?.full_name ?? "—"}</td>
                              <td className="px-4 py-3">{formatDate(item.due_date)}</td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatBRL(
                                  Math.max(
                                    0,
                                    Number(item.expected_amount) - Number(item.received_amount),
                                  ),
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${receivableStatusTone[status]}`}
                                >
                                  {receivableStatusLabel[status]}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-6 text-sm text-muted-foreground">
                    Nenhum recebimento pendente foi encontrado.
                  </p>
                )}
              </section>

              <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  As taxas do cartão já reduzem o valor previsto para entrar no caixa. A
                  classificação dessas taxas como despesa na DRE será validada quando construirmos a
                  aba DRE.
                </p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}

function FinancialMetric({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "warning";
  icon: ReactNode;
}) {
  const valueTone =
    tone === "negative"
      ? "text-destructive"
      : tone === "positive"
        ? "text-emerald-700"
        : tone === "warning"
          ? "text-amber-800"
          : "text-foreground";

  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-2xl font-semibold ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
