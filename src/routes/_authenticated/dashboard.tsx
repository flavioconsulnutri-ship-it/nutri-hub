import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PageBody, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/reports.functions";
import { refreshOverdue } from "@/lib/finance.functions";
import {
  formatBRL,
  formatNumber,
  formatPercent,
  monthEndISO,
  monthStartISO,
  todayISO,
} from "@/lib/format";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard executivo — Consultório de Nutrição" },
      {
        name: "description",
        content:
          "Indicadores de faturamento, recebimentos, inadimplência, pacientes ativos e ocupação da agenda.",
      },
      { property: "og:title", content: "Dashboard executivo — Consultório de Nutrição" },
      {
        property: "og:description",
        content: "Faturamento, recebimentos, inadimplência e agenda em um só painel.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(monthEndISO());
  const { canViewFinancial } = useSession();

  const fetchDashboard = useServerFn(getDashboard);
  const runRefresh = useServerFn(refreshOverdue);

  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => fetchDashboard({ data: { from, to } }),
  });

  async function handleRefresh() {
    await runRefresh({ data: undefined });
    await refetch();
  }

  return (
    <PageBody>
      <PageHeader
        title="Dashboard executivo"
        description="Quatro medidas distintas: valor vendido, receita reconhecida por competência, previsto a receber e dinheiro efetivamente recebido."
        actions={
          <>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="de" className="text-xs">
                  De
                </Label>
                <Input
                  id="de"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ate" className="text-xs">
                  Até
                </Label>
                <Input
                  id="ate"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
              Atualizar vencidos
            </Button>
          </>
        }
      />

      {error ? (
        <p className="mt-8 text-sm text-destructive">
          Não foi possível carregar os indicadores. Tente atualizar a página.
        </p>
      ) : null}

      {isLoading || !data ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {canViewFinancial ? (
            <section>
              <h2 className="section-title">Resultado do período</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Faturamento vendido" value={formatBRL(data.soldAmount)} to="/comercial" hint={`${data.salesCount} venda(s)`} />
                <Metric
                  label="Receita reconhecida"
                  value={formatBRL(data.recognizedRevenue)}
                  to="/relatorios"
                  hint="Rateada pelos meses do plano"
                />
                <Metric label="Recebido no caixa" value={formatBRL(data.receivedAmount)} to="/financeiro" />
                <Metric label="Despesas pagas" value={formatBRL(data.paidExpenses)} to="/financeiro" />
                <Metric
                  label="Resultado operacional"
                  value={formatBRL(data.operationalResult)}
                  to="/relatorios"
                  tone={data.operationalResult >= 0 ? "positive" : "negative"}
                />
                <Metric label="Saldo de caixa" value={formatBRL(data.cashBalance)} to="/financeiro" />
                <Metric label="Contas a receber" value={formatBRL(data.openReceivables)} to="/financeiro" />
                <Metric
                  label="Inadimplência"
                  value={formatBRL(data.overdueAmount)}
                  hint={`${data.overdueCount} parcela(s) vencida(s)`}
                  to="/financeiro"
                  tone={data.overdueAmount > 0 ? "negative" : undefined}
                />
              </div>
            </section>
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Seu perfil não tem acesso aos indicadores financeiros.
            </p>
          )}

          <section>
            <h2 className="section-title">Pacientes e comercial</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Pacientes ativos" value={formatNumber(data.activePatients)} to="/pacientes" />
              <Metric label="Novos pacientes" value={formatNumber(data.newPatients)} to="/pacientes" />
              <Metric label="Ticket médio" value={formatBRL(data.averageTicket)} to="/comercial" />
              <Metric
                label="Taxa de conversão"
                value={formatPercent(data.conversionRate)}
                to="/comercial"
                hint="Oportunidades ganhas no período"
              />
              <Metric label="Renovações realizadas" value={formatNumber(data.renewals)} to="/comercial" />
              <Metric label="Renovações previstas" value={formatNumber(data.expectedRenewals)} to="/comercial" />
              <Metric label="Taxa de renovação" value={formatPercent(data.renewalRate)} to="/comercial" />
              <Metric
                label="Sem consulta futura"
                value={formatNumber(data.patientsWithoutNextAppointment)}
                to="/agenda"
                tone={data.patientsWithoutNextAppointment > 0 ? "negative" : undefined}
              />
            </div>
          </section>

          <section>
            <h2 className="section-title">Agenda</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Consultas no período" value={formatNumber(data.appointmentsTotal)} to="/agenda" />
              <Metric label="Consultas realizadas" value={formatNumber(data.appointmentsDone)} to="/agenda" />
              <Metric label="Ocupação estimada" value={formatPercent(data.occupancyRate)} to="/agenda" />
              <Metric label="Hoje" value={todayISO().split("-").reverse().join("/")} />
            </div>
          </section>
        </div>
      )}
    </PageBody>
  );
}

function Metric({
  label,
  value,
  hint,
  to,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  to?: "/comercial" | "/financeiro" | "/pacientes" | "/agenda" | "/relatorios";
  tone?: "positive" | "negative";
}) {
  const body = (
    <div className="panel h-full px-5 py-4 transition-colors hover:border-ring/40">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={
          tone === "negative"
            ? "mt-2 font-display text-xl font-semibold text-destructive"
            : tone === "positive"
              ? "mt-2 font-display text-xl font-semibold text-primary"
              : "mt-2 font-display text-xl font-semibold"
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
