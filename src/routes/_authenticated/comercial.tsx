import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, GripVertical, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { EmptyState, PageBody, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  countryFlag,
  formatNationalPhone,
  phoneCountries,
  splitInternationalPhone,
} from "@/lib/countries";
import { formatBRL, formatDate, todayISO } from "@/lib/format";

type FunnelStage = Database["public"]["Enums"]["funnel_stage"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
const alphabetical = (items: string[]) => [...items].sort((a, b) => a.localeCompare(b, "pt-BR"));
const leadSources = alphabetical([
  "Instagram",
  "WhatsApp",
  "Google",
  "Site",
  "Indicação de paciente",
  "Indicação de parceiro",
  "Evento/Palestra",
  "Tráfego pago",
  "Orgânico",
  "Não identificado",
]);
const leadGoals = alphabetical([
  "Emagrecimento",
  "Hipertrofia",
  "Reeducação alimentar",
  "Comportamento alimentar",
  "Relação com a comida",
  "Dificuldades com compulsão alimentar",
  "Saúde e qualidade de vida",
  "Tratamento nutricional",
  "Performance esportiva",
  "Gestação e fertilidade",
  "Nutrição vegetariana/vegana",
]);
const actionOptions = alphabetical([
  "Responder primeiro contato",
  "Enviar mensagem",
  "Fazer ligação",
  "Enviar áudio",
  "Entender objetivo e necessidade",
  "Fazer qualificação",
  "Solicitar informações",
  "Solicitar documentos",
  "Agendar pré-consulta",
  "Reagendar pré-consulta",
  "Confirmar presença",
  "Realizar pré-consulta",
  "Retomar após ausência",
  "Apresentar plano",
  "Enviar proposta",
  "Reenviar proposta",
  "Tirar dúvidas",
  "Fazer follow-up",
  "Negociar condições",
  "Oferecer alternativa de plano",
  "Enviar link de pagamento",
  "Reenviar link de pagamento",
  "Cobrar pagamento",
  "Confirmar pagamento",
  "Solicitar comprovante",
  "Reativar contato",
  "Registrar desistência",
  "Encaminhar para onboarding",
  "Encaminhar para atendimento",
  "Atualizar cadastro",
  "Aguardar retorno do lead",
]);
const stages: Array<{ value: FunnelStage; label: string; helper: string; tone: string }> = [
  {
    value: "novo_lead",
    label: "Lead novo",
    helper: "Mandou mensagem",
    tone: "border-blue-300 bg-blue-50/50",
  },
  {
    value: "qualificacao",
    label: "Qualificação",
    helper: "Objetivo, dor e momento",
    tone: "border-blue-300 bg-blue-50/50",
  },
  {
    value: "pre_consulta",
    label: "Pré-consulta",
    helper: "Conversa comercial marcada",
    tone: "border-blue-300 bg-blue-50/50",
  },
  {
    value: "proposta",
    label: "Proposta",
    helper: "Plano, valor e condições",
    tone: "border-blue-300 bg-blue-50/50",
  },
  {
    value: "follow_up",
    label: "Follow-up",
    helper: "Negociação recente",
    tone: "border-amber-300 bg-amber-50/60",
  },
  {
    value: "reativacao_futura",
    label: "Reativação",
    helper: "30, 60 e 90 dias",
    tone: "border-violet-300 bg-violet-50/60",
  },
  {
    value: "follow_up_infinito",
    label: "Follow-up infinito",
    helper: "Base fria",
    tone: "border-slate-300 bg-slate-50/70",
  },
  {
    value: "aguardando_pagamento",
    label: "Aguardando pagamento",
    helper: "Aceitou, falta pagar",
    tone: "border-orange-300 bg-orange-50/60",
  },
  {
    value: "ganha",
    label: "Venda concluída",
    helper: "Pagamento confirmado",
    tone: "border-emerald-300 bg-emerald-50/60",
  },
  {
    value: "perdida",
    label: "Perdido",
    helper: "Recusa ou sem perfil",
    tone: "border-red-300 bg-red-50/60",
  },
];
const activeStages = stages
  .filter((s) => !["ganha", "perdida", "follow_up_infinito"].includes(s.value))
  .map((s) => s.value);

export const Route = createFileRoute("/_authenticated/comercial")({
  head: () => ({ meta: [{ title: "CRM comercial — Nutri Hub" }] }),
  component: CommercialPage,
});

function CommercialPage() {
  const [open, setOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<FunnelStage | null>(null);
  const didDrag = useRef(false);
  const [dashboardFrom, setDashboardFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 5, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dashboardTo, setDashboardTo] = useState(todayISO());
  const [sourceFilter, setSourceFilter] = useState("todos");
  const [temperatureFilter, setTemperatureFilter] = useState("todos");
  const [ownerFilter, setOwnerFilter] = useState("todos");
  const queryClient = useQueryClient();
  const opportunities = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, leads(full_name, phone, lead_type, main_goal), plans(name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const leads = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const responsibles = useQuery({
    queryKey: ["crm-responsibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const tasks = useQuery({
    queryKey: ["crm-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*, opportunities(title, lead_id, leads(full_name))")
        .eq("status", "pendente")
        .order("due_date")
        .limit(200);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const deleteLead = useMutation({
    mutationFn: async (lead: LeadRow) => {
      const confirmed = window.confirm(
        `Excluir definitivamente o lead "${lead.full_name}"? A negociação, as tarefas e o histórico comercial vinculados também serão excluídos.`,
      );
      if (!confirmed) return false;
      const { error: opportunityError } = await supabase
        .from("opportunities")
        .delete()
        .eq("lead_id", lead.id);
      if (opportunityError) throw new Error(opportunityError.message);
      const { error: leadError } = await supabase.from("leads").delete().eq("id", lead.id);
      if (leadError) throw new Error(leadError.message);
      return true;
    },
    onSuccess: async (deleted) => {
      if (!deleted) return;
      toast.success("Lead excluído com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-tasks"] }),
      ]);
    },
    onError: (error: Error) => toast.error(`Não foi possível excluir: ${error.message}`),
  });

  const move = useMutation({
    mutationFn: async ({ id, from, to }: { id: string; from: FunnelStage; to: FunnelStage }) => {
      let lossReason: string | null = null;
      if (to === "perdida") {
        lossReason =
          window.prompt("Motivo da perda (recusa, sem perfil, contato inválido...):")?.trim() ||
          null;
        if (!lossReason)
          throw new Error("Perdido exige um motivo claro. Silêncio deve ir para Reativação.");
      }
      const recovering = ["follow_up", "reativacao_futura", "follow_up_infinito"].includes(to);
      const { error } = await supabase
        .from("opportunities")
        .update({
          stage: to,
          stalled_from_stage: recovering ? from : null,
          loss_reason: lossReason,
          closed_at: ["ganha", "perdida"].includes(to) ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Etapa atualizada e régua de tarefas recalculada.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-tasks"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_tasks")
        .update({ status: "concluida", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["crm-tasks"] }),
  });
  const metrics = useMemo(() => {
    const all = opportunities.data ?? [];
    return {
      active: all.filter((i) => activeStages.includes(i.stage)).length,
      withoutAction: all.filter((i) => activeStages.includes(i.stage) && !i.next_action_date)
        .length,
      awaiting: all
        .filter((i) => i.stage === "aguardando_pagamento")
        .reduce((sum, i) => sum + Number(i.amount), 0),
      dueToday: (tasks.data ?? []).filter((t) => t.due_date <= todayISO()).length,
    };
  }, [opportunities.data, tasks.data]);
  const dashboard = useMemo(() => {
    const filteredLeads = (leads.data ?? []).filter((lead) => {
      const day = lead.created_at.slice(0, 10);
      return (
        day >= dashboardFrom &&
        day <= dashboardTo &&
        (sourceFilter === "todos" || (lead.source ?? "Não identificado") === sourceFilter) &&
        (temperatureFilter === "todos" || lead.temperature === temperatureFilter) &&
        (ownerFilter === "todos" || lead.owner_id === ownerFilter)
      );
    });
    const leadIds = new Set(filteredLeads.map((lead) => lead.id));
    const filteredOpportunities = (opportunities.data ?? []).filter(
      (opportunity) => opportunity.lead_id && leadIds.has(opportunity.lead_id),
    );
    const won = filteredOpportunities.filter((opportunity) => opportunity.stage === "ganha");
    const revenue = won.reduce((sum, opportunity) => sum + Number(opportunity.amount), 0);
    const months: Array<{
      key: string;
      label: string;
      leads: number;
      vendas: number;
      faturamento: number;
    }> = [];
    const cursor = new Date(`${dashboardFrom}T12:00:00`);
    const end = new Date(`${dashboardTo}T12:00:00`);
    cursor.setDate(1);
    for (let index = 0; cursor <= end && index < 24; index += 1) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        leads: filteredLeads.filter((lead) => lead.created_at.startsWith(key)).length,
        vendas: won.filter((item) => (item.closed_at ?? item.created_at).startsWith(key)).length,
        faturamento: won
          .filter((item) => (item.closed_at ?? item.created_at).startsWith(key))
          .reduce((sum, item) => sum + Number(item.amount), 0),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const origins = Array.from(
      filteredLeads
        .reduce((map, lead) => {
          const source = lead.source || "Não identificado";
          const current = map.get(source) ?? {
            origem: source,
            leads: 0,
            vendas: 0,
            faturamento: 0,
          };
          current.leads += 1;
          const sales = won.filter((item) => item.lead_id === lead.id);
          current.vendas += sales.length;
          current.faturamento += sales.reduce((sum, item) => sum + Number(item.amount), 0);
          map.set(source, current);
          return map;
        }, new Map<string, { origem: string; leads: number; vendas: number; faturamento: number }>())
        .values(),
    ).sort((a, b) => b.leads - a.leads);
    const stageData = stages
      .map((stage) => ({
        label: stage.label,
        value: filteredOpportunities.filter((item) => item.stage === stage.value).length,
      }))
      .filter((item) => item.value > 0);
    const temperatureData = [
      {
        label: "❄️ Frios",
        value: filteredLeads.filter((lead) => lead.temperature === "frio").length,
      },
      {
        label: "🌤️ Mornos",
        value: filteredLeads.filter((lead) => lead.temperature === "morno").length,
      },
      {
        label: "🔥 Quentes",
        value: filteredLeads.filter((lead) => lead.temperature === "quente").length,
      },
    ];
    const urgentTasks = (tasks.data ?? []).filter((task) => {
      const opportunity = task.opportunities as { lead_id?: string | null } | null;
      return (
        task.due_date <= todayISO() && opportunity?.lead_id && leadIds.has(opportunity.lead_id)
      );
    });
    return {
      leads: filteredLeads.length,
      active: filteredOpportunities.filter((item) => activeStages.includes(item.stage)).length,
      followUps: filteredOpportunities.filter((item) =>
        ["follow_up", "reativacao_futura", "follow_up_infinito"].includes(item.stage),
      ).length,
      won: won.length,
      conversion: filteredLeads.length ? won.length / filteredLeads.length : 0,
      revenue,
      ticket: won.length ? revenue / won.length : 0,
      overdue: urgentTasks.length,
      withoutAction: filteredOpportunities.filter(
        (item) => activeStages.includes(item.stage) && !item.next_action_date,
      ).length,
      months,
      origins,
      stageData,
      temperatureData,
      urgentTasks: urgentTasks.slice(0, 8),
    };
  }, [
    dashboardFrom,
    dashboardTo,
    leads.data,
    opportunities.data,
    ownerFilter,
    sourceFilter,
    tasks.data,
    temperatureFilter,
  ]);
  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set((leads.data ?? []).map((lead) => lead.source || "Não identificado")),
      ).sort(),
    [leads.data],
  );
  const nextActions = useMemo(
    () =>
      (opportunities.data ?? [])
        .filter(
          (opportunity) =>
            opportunity.next_action &&
            opportunity.next_action_date &&
            !["ganha", "perdida"].includes(opportunity.stage),
        )
        .sort((a, b) => (a.next_action_date ?? "").localeCompare(b.next_action_date ?? "")),
    [opportunities.data],
  );
  const selectedOpportunity = (opportunities.data ?? []).find(
    (opportunity) => opportunity.id === selectedOpportunityId,
  );
  const selectedLead = (leads.data ?? []).find((lead) => lead.id === selectedOpportunity?.lead_id);

  return (
    <PageBody>
      <PageHeader
        title="CRM comercial"
        description="Um lead por pessoa, uma etapa atual e toda negociação ativa com próxima ação e data."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo lead
              </Button>
            </DialogTrigger>
            <NewLeadDialog onDone={() => setOpen(false)} />
          </Dialog>
        }
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Negociações ativas" value={String(metrics.active)} />
        <Metric
          label="Sem próxima ação"
          value={String(metrics.withoutAction)}
          alert={metrics.withoutAction > 0}
        />
        <Metric label="Aguardando pagamento" value={formatBRL(metrics.awaiting)} />
        <Metric
          label="Tarefas vencendo hoje"
          value={String(metrics.dueToday)}
          alert={metrics.dueToday > 0}
        />
      </div>
      <Tabs defaultValue="dashboard" className="mt-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="tarefas">Próximas ações</TabsTrigger>
          <TabsTrigger value="leads">Base de leads</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4 space-y-5">
          <div className="panel grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="De">
              <Input
                type="date"
                value={dashboardFrom}
                max={dashboardTo}
                onChange={(event) => setDashboardFrom(event.target.value)}
              />
            </Field>
            <Field label="Até">
              <Input
                type="date"
                value={dashboardTo}
                min={dashboardFrom}
                onChange={(event) => setDashboardTo(event.target.value)}
              />
            </Field>
            <Field label="Origem">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Temperatura">
              <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="frio">❄️ Frio</SelectItem>
                  <SelectItem value="morno">🌤️ Morno</SelectItem>
                  <SelectItem value="quente">🔥 Quente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(responsibles.data ?? []).map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Leads recebidos" value={String(dashboard.leads)} />
            <Metric label="Negociações ativas" value={String(dashboard.active)} />
            <Metric label="Em follow-up" value={String(dashboard.followUps)} />
            <Metric label="Vendas concluídas" value={String(dashboard.won)} />
            <Metric
              label="Taxa de conversão"
              value={`${(dashboard.conversion * 100).toFixed(1).replace(".", ",")}%`}
            />
            <Metric label="Faturamento vendido" value={formatBRL(dashboard.revenue)} />
            <Metric label="Ticket médio" value={formatBRL(dashboard.ticket)} />
            <Metric
              label="Ações vencidas"
              value={String(dashboard.overdue)}
              alert={dashboard.overdue > 0}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="panel p-5">
              <div className="mb-4">
                <h3 className="font-semibold">Evolução comercial</h3>
                <p className="text-xs text-muted-foreground">
                  Leads e vendas por mês no período selecionado
                </p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dashboard.months}
                    margin={{ left: 0, right: 12, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="#2563eb"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="vendas"
                      name="Vendas"
                      stroke="#16a34a"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel p-5">
              <div className="mb-4">
                <h3 className="font-semibold">Desempenho por origem</h3>
                <p className="text-xs text-muted-foreground">
                  Quantidade de leads por canal de aquisição
                </p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboard.origins.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="origem"
                      width={115}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Bar dataKey="leads" name="Leads" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Breakdown title="Etapas do funil" items={dashboard.stageData} />
            <Breakdown title="Temperatura dos leads" items={dashboard.temperatureData} />
            <section className="panel p-5">
              <h3 className="font-semibold">Atenção comercial</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between rounded-md bg-muted/50 p-3">
                  <span>Leads sem próxima ação</span>
                  <strong>{dashboard.withoutAction}</strong>
                </div>
                <div className="flex justify-between rounded-md bg-muted/50 p-3">
                  <span>Ações vencidas ou para hoje</span>
                  <strong className={dashboard.overdue ? "text-destructive" : ""}>
                    {dashboard.overdue}
                  </strong>
                </div>
                {dashboard.urgentTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="border-l-2 border-warning pl-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Prazo: {formatDate(task.due_date)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent
          value="funil"
          className="mt-4 overflow-x-auto pb-4"
          onDragOver={(event) => {
            if (!didDrag.current) return;
            event.preventDefault();
            const container = event.currentTarget;
            const bounds = container.getBoundingClientRect();
            const edgeSize = Math.min(160, bounds.width * 0.2);
            const distanceFromLeft = event.clientX - bounds.left;
            const distanceFromRight = bounds.right - event.clientX;

            if (distanceFromLeft < edgeSize) {
              const intensity = 1 - Math.max(distanceFromLeft, 0) / edgeSize;
              container.scrollLeft -= Math.ceil(12 + intensity * 40);
            } else if (distanceFromRight < edgeSize) {
              const intensity = 1 - Math.max(distanceFromRight, 0) / edgeSize;
              container.scrollLeft += Math.ceil(12 + intensity * 40);
            }
          }}
        >
          {opportunities.isLoading ? (
            <Skeleton className="h-96 min-w-[1000px]" />
          ) : (opportunities.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma negociação"
              description="Cadastre o primeiro lead para iniciar o fluxo comercial."
            />
          ) : (
            <div className="grid min-w-[2300px] grid-cols-10 gap-3">
              {stages.map((stage) => {
                const items = (opportunities.data ?? []).filter((i) => i.stage === stage.value);
                return (
                  <section
                    key={stage.value}
                    className={`rounded-xl border p-3 transition-all ${stage.tone} ${
                      dragOverStage === stage.value ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragOverStage(stage.value);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                        setDragOverStage(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOverStage(null);
                      const id = event.dataTransfer.getData("application/x-opportunity-id");
                      const from = event.dataTransfer.getData(
                        "application/x-opportunity-stage",
                      ) as FunnelStage;
                      if (id && from && from !== stage.value) {
                        move.mutate({ id, from, to: stage.value });
                      }
                    }}
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold">{stage.label}</h2>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">
                          {items.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{stage.helper}</p>
                    </div>
                    <div className="space-y-3">
                      {items.map((item) => {
                        const lead = item.leads as {
                          full_name: string;
                          phone: string;
                          lead_type: string;
                          main_goal: string | null;
                        } | null;
                        return (
                          <article
                            key={item.id}
                            draggable={!move.isPending}
                            role="button"
                            tabIndex={0}
                            aria-label={`Abrir informações de ${lead?.full_name ?? item.title}`}
                            className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
                            onDragStart={(event) => {
                              didDrag.current = true;
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("application/x-opportunity-id", item.id);
                              event.dataTransfer.setData(
                                "application/x-opportunity-stage",
                                item.stage,
                              );
                            }}
                            onDragEnd={() => {
                              setDragOverStage(null);
                              window.setTimeout(() => {
                                didDrag.current = false;
                              }, 0);
                            }}
                            onClick={() => {
                              if (!didDrag.current) setSelectedOpportunityId(item.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedOpportunityId(item.id);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold">
                                {lead?.full_name ?? item.title}
                              </p>
                              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(lead?.main_goal ?? "")
                                .split(",")
                                .map((goal) => goal.trim())
                                .filter(Boolean)
                                .map((goal) => (
                                  <span
                                    key={goal}
                                    className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                                  >
                                    🎯 {goal}
                                  </span>
                                ))}
                              {item.next_action ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
                                  📌 {item.next_action}
                                </span>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="tarefas" className="mt-4">
          <div className="space-y-5">
            <section className="panel overflow-hidden">
              <div className="border-b border-border p-4">
                <h2 className="font-semibold">Ações combinadas com os leads</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta é a próxima ação e a data informadas no cadastro ou na edição de cada lead.
                  Ao editar o lead, este quadro é atualizado automaticamente.
                </p>
              </div>
              {nextActions.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhum lead ativo possui uma próxima ação com data.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {nextActions.map((opportunity) => {
                    const lead = (leads.data ?? []).find((item) => item.id === opportunity.lead_id);
                    const dueDate = opportunity.next_action_date ?? "";
                    const timing =
                      dueDate < todayISO()
                        ? { label: "Vencida", className: "bg-red-100 text-red-700" }
                        : dueDate === todayISO()
                          ? { label: "Hoje", className: "bg-amber-100 text-amber-800" }
                          : { label: "Agendada", className: "bg-blue-100 text-blue-700" };
                    return (
                      <div
                        key={opportunity.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{opportunity.next_action}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${timing.className}`}
                            >
                              {timing.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {lead?.full_name ?? opportunity.title} · {formatDate(dueDate)}
                            {opportunity.next_action_details
                              ? ` · ${opportunity.next_action_details}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOpportunityId(opportunity.id)}
                          >
                            Ver lead
                          </Button>
                          {lead ? (
                            <Button size="sm" onClick={() => setEditingLead(lead)}>
                              <Pencil className="size-4" /> Atualizar ação
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-border p-4">
                <h2 className="font-semibold">Lembretes automáticos do playbook</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  São tentativas sugeridas pela régua comercial. Elas são recalculadas quando o lead
                  muda de etapa no Kanban.
                </p>
              </div>
              {(tasks.data ?? []).length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhum lembrete automático pendente.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(tasks.data ?? []).map((task) => {
                    const opp = task.opportunities as {
                      title: string;
                      leads: { full_name: string } | null;
                    } | null;
                    return (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div>
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {opp?.leads?.full_name ?? opp?.title} · {formatDate(task.due_date)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={completeTask.isPending}
                          onClick={() => completeTask.mutate(task.id)}
                        >
                          <CheckCircle2 className="size-4" /> Concluir lembrete
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          {(leads.data ?? []).length === 0 ? (
            <EmptyState
              title="Base de leads vazia"
              description="Leads permanecem separados dos pacientes até o pagamento ser confirmado."
            />
          ) : (
            <div className="panel overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="hidden px-4 py-3 md:table-cell">Origem</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Objetivo</th>
                    <th className="px-4 py-3">Entrada</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(leads.data ?? []).map((lead) => (
                    <tr key={lead.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium">{lead.full_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        {lead.lead_type === "ex_paciente"
                          ? "Ex-paciente"
                          : lead.lead_type === "indicacao"
                            ? "Indicação"
                            : "Lead novo"}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">{lead.source || "—"}</td>
                      <td className="hidden max-w-sm truncate px-4 py-3 lg:table-cell">
                        {lead.main_goal || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingLead(lead)}>
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteLead.isPending}
                            onClick={() => deleteLead.mutate(lead)}
                          >
                            <Trash2 className="size-4" />
                            {deleteLead.isPending && deleteLead.variables?.id === lead.id
                              ? "Excluindo..."
                              : "Excluir"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={selectedOpportunityId !== null}
        onOpenChange={(value) => !value && setSelectedOpportunityId(null)}
      >
        {selectedOpportunity ? (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedLead?.full_name ?? selectedOpportunity.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Telefone" value={selectedLead?.phone || "Não informado"} />
              <DetailItem label="E-mail" value={selectedLead?.email || "Não informado"} />
              <DetailItem
                label="Etapa do funil"
                value={
                  stages.find((stage) => stage.value === selectedOpportunity.stage)?.label ??
                  selectedOpportunity.stage
                }
              />
              <DetailItem label="Origem" value={selectedLead?.source || "Não informada"} />
              <DetailItem
                label="Temperatura"
                value={
                  selectedLead?.temperature === "quente"
                    ? "🔥 Quente"
                    : selectedLead?.temperature === "frio"
                      ? "❄️ Frio"
                      : "🌤️ Morno"
                }
              />
              <DetailItem label="Tipo" value={selectedLead?.lead_type || "Não informado"} />
              <DetailItem
                label="Objetivo"
                value={selectedLead?.main_goal || "Não informado"}
                className="sm:col-span-2"
              />
              <DetailItem
                label="Próxima ação"
                value={selectedOpportunity.next_action || "Não informada"}
              />
              <DetailItem
                label="Data da próxima ação"
                value={
                  selectedOpportunity.next_action_date
                    ? formatDate(selectedOpportunity.next_action_date)
                    : "Não informada"
                }
              />
              {selectedOpportunity.next_action_details ? (
                <DetailItem
                  label="Detalhes da próxima ação"
                  value={selectedOpportunity.next_action_details}
                  className="sm:col-span-2"
                />
              ) : null}
              {selectedLead?.notes ? (
                <DetailItem
                  label="Observações"
                  value={selectedLead.notes}
                  className="sm:col-span-2"
                />
              ) : null}
            </div>
            <DialogFooter>
              {selectedLead ? (
                <Button
                  onClick={() => {
                    setSelectedOpportunityId(null);
                    setEditingLead(selectedLead);
                  }}
                >
                  <Pencil className="size-4" /> Editar lead
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog open={editingLead !== null} onOpenChange={(value) => !value && setEditingLead(null)}>
        {editingLead ? (
          <EditLeadDialog lead={editingLead} onDone={() => setEditingLead(null)} />
        ) : null}
      </Dialog>
    </PageBody>
  );
}

function EditLeadDialog({ lead, onDone }: { lead: LeadRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const parsedPhone = splitInternationalPhone(lead.phone);
  const originalGoals = (lead.main_goal ?? "")
    .split(",")
    .map((goal) => goal.trim())
    .filter(Boolean);
  const unknownGoals = originalGoals.filter((goal) => !leadGoals.includes(goal));
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    ...originalGoals.filter((goal) => leadGoals.includes(goal)),
    ...(unknownGoals.length ? ["Outro"] : []),
  ]);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    full_name: lead.full_name,
    phone: parsedPhone.national,
    phone_country: parsedPhone.iso,
    email: lead.email ?? "",
    lead_type: lead.lead_type,
    source: lead.source ?? "",
    referred_by: lead.referred_by ?? "",
    other_goal: unknownGoals.join(", "),
    temperature: lead.temperature ?? "morno",
    owner_id: lead.owner_id ?? "",
    notes: lead.notes ?? "",
    next_action: "Responder primeiro contato",
    custom_action: "",
    action_details: "",
    next_action_date: todayISO(),
  });
  const opportunity = useQuery({
    queryKey: ["lead-opportunity", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, next_action, next_action_details, next_action_date, owner_id")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const profiles = useQuery({
    queryKey: ["crm-responsibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const customActions = useQuery({
    queryKey: ["crm-action-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_action_catalog")
        .select("name")
        .eq("active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  useEffect(() => {
    if (!opportunity.data) return;
    const action = opportunity.data.next_action ?? "Responder primeiro contato";
    const standard =
      actionOptions.includes(action) ||
      (customActions.data ?? []).some((item) => item.name === action);
    setForm((current) => ({
      ...current,
      next_action: standard ? action : "Criar ação personalizada",
      custom_action: standard ? "" : action,
      action_details: opportunity.data?.next_action_details ?? "",
      next_action_date: opportunity.data?.next_action_date ?? todayISO(),
      owner_id: opportunity.data?.owner_id ?? current.owner_id,
    }));
  }, [opportunity.data, customActions.data]);
  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const actionName =
        form.next_action === "Criar ação personalizada"
          ? form.custom_action.trim()
          : form.next_action;
      if (form.next_action === "Criar ação personalizada") {
        const { error } = await supabase
          .from("crm_action_catalog")
          .upsert(
            { org_id: lead.org_id, name: actionName, created_by: userData.user.id },
            { onConflict: "org_id,name" },
          );
        if (error) throw new Error(error.message);
      }
      const mainGoal = [...selectedGoals.filter((goal) => goal !== "Outro"), form.other_goal.trim()]
        .filter(Boolean)
        .join(", ");
      const country = phoneCountries.find((item) => item.iso === form.phone_country);
      const { error: leadError } = await supabase
        .from("leads")
        .update({
          full_name: form.full_name.trim(),
          phone: `${country?.dial ?? "+55"}${form.phone.replace(/\D/g, "")}`,
          email: form.email.trim() || null,
          lead_type: form.lead_type,
          source: form.source || null,
          referred_by: form.referred_by.trim() || null,
          main_goal: mainGoal || null,
          temperature: form.temperature,
          owner_id: form.owner_id || userData.user.id,
          notes: form.notes.trim() || null,
        })
        .eq("id", lead.id);
      if (leadError) throw new Error(leadError.message);
      if (opportunity.data) {
        const { error } = await supabase
          .from("opportunities")
          .update({
            source: form.source || null,
            owner_id: form.owner_id || userData.user.id,
            next_action: actionName,
            next_action_details: form.action_details.trim() || null,
            next_action_date: form.next_action_date,
          })
          .eq("id", opportunity.data.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      toast.success("Lead atualizado com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-action-catalog"] }),
      ]);
      onDone();
    },
    onError: (error: Error) => setFormError(error.message),
  });
  const save = () => {
    setFormError("");
    if (!form.full_name.trim() || !form.phone.replace(/\D/g, ""))
      return setFormError("Preencha o nome e o WhatsApp.");
    if (!selectedGoals.length) return setFormError("Selecione pelo menos um objetivo.");
    if (selectedGoals.includes("Outro") && !form.other_goal.trim())
      return setFormError("Especifique o outro objetivo.");
    if (form.next_action === "Criar ação personalizada" && !form.custom_action.trim())
      return setFormError("Descreva a ação personalizada.");
    if (!form.next_action_date) return setFormError("Selecione a data da próxima ação.");
    mutation.mutate();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Editar lead</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </Field>
        <Field label="WhatsApp">
          <div className="flex gap-2">
            <Select
              value={form.phone_country}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  phone_country: value,
                  phone: formatNationalPhone(form.phone, value),
                })
              }
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phoneCountries.map((country) => (
                  <SelectItem key={country.iso} value={country.iso}>
                    {countryFlag(country.iso)} {country.name} ({country.dial})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              inputMode="tel"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: formatNationalPhone(e.target.value, form.phone_country) })
              }
            />
          </div>
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <Select
            value={form.lead_type}
            onValueChange={(value) => setForm({ ...form, lead_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ex_paciente">Ex-paciente</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
              <SelectItem value="lead_novo">Lead novo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Origem">
          <Select
            value={form.source}
            onValueChange={(value) => setForm({ ...form, source: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent>
              {[...leadSources, "Outro"].map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Indicado por">
          <Input
            value={form.referred_by}
            onChange={(e) => setForm({ ...form, referred_by: e.target.value })}
          />
        </Field>
        <Field label="Temperatura">
          <Select
            value={form.temperature}
            onValueChange={(value) => setForm({ ...form, temperature: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frio">❄️ Frio</SelectItem>
              <SelectItem value="morno">🌤️ Morno</SelectItem>
              <SelectItem value="quente">🔥 Quente</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Responsável">
          <Select
            value={form.owner_id}
            onValueChange={(value) => setForm({ ...form, owner_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Eu (padrão)" />
            </SelectTrigger>
            <SelectContent>
              {(profiles.data ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Objetivos" className="sm:col-span-2">
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            {[...leadGoals, "Outro"].map((goal) => (
              <label key={goal} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedGoals.includes(goal)}
                  onCheckedChange={(checked) =>
                    setSelectedGoals(
                      checked
                        ? [...selectedGoals, goal]
                        : selectedGoals.filter((item) => item !== goal),
                    )
                  }
                />
                {goal}
              </label>
            ))}
          </div>
        </Field>
        {selectedGoals.includes("Outro") ? (
          <Field label="Especifique o objetivo" className="sm:col-span-2">
            <Input
              value={form.other_goal}
              onChange={(e) => setForm({ ...form, other_goal: e.target.value })}
            />
          </Field>
        ) : null}
        <Field label="Próxima ação">
          <Select
            value={form.next_action}
            onValueChange={(value) => setForm({ ...form, next_action: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...actionOptions, ...(customActions.data ?? []).map((item) => item.name)]
                .filter((action, index, list) => list.indexOf(action) === index)
                .sort((a, b) => a.localeCompare(b, "pt-BR"))
                .concat("Criar ação personalizada")
                .map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data da próxima ação">
          <Input
            type="date"
            value={form.next_action_date}
            onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
          />
        </Field>
        {form.next_action === "Criar ação personalizada" ? (
          <Field label="Nome da ação personalizada" className="sm:col-span-2">
            <Input
              value={form.custom_action}
              onChange={(e) => setForm({ ...form, custom_action: e.target.value })}
            />
          </Field>
        ) : null}
        <Field label="Complemento da próxima ação" className="sm:col-span-2">
          <Input
            value={form.action_details}
            onChange={(e) => setForm({ ...form, action_details: e.target.value })}
          />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
            Não foi possível salvar: {formError}
          </div>
        ) : null}
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="button" disabled={mutation.isPending} onClick={save}>
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  );
}

function LegacyEditLeadDialog({ lead, onDone }: { lead: LeadRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    full_name: lead.full_name,
    phone: lead.phone,
    email: lead.email ?? "",
    lead_type: lead.lead_type,
    source: lead.source ?? "",
    referred_by: lead.referred_by ?? "",
    main_goal: lead.main_goal ?? "",
    notes: lead.notes ?? "",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          lead_type: form.lead_type,
          source: form.source.trim() || null,
          referred_by: form.referred_by.trim() || null,
          main_goal: form.main_goal.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", lead.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Lead atualizado com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      onDone();
    },
    onError: (error: Error) => setFormError(error.message),
  });
  const save = () => {
    setFormError("");
    if (!form.full_name.trim() || !form.phone.trim()) {
      setFormError("Preencha o nome e o telefone.");
      return;
    }
    mutation.mutate();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Editar lead</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <Select
            value={form.lead_type}
            onValueChange={(value) => setForm({ ...form, lead_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ex_paciente">Ex-paciente</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
              <SelectItem value="lead_novo">Lead novo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Origem">
          <Input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
        </Field>
        <Field label="Indicado por">
          <Input
            value={form.referred_by}
            onChange={(e) => setForm({ ...form, referred_by: e.target.value })}
          />
        </Field>
        <Field label="Objetivo principal">
          <Input
            value={form.main_goal}
            onChange={(e) => setForm({ ...form, main_goal: e.target.value })}
          />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
            Não foi possível salvar: {formError}
          </div>
        ) : null}
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="button" disabled={mutation.isPending} onClick={save}>
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  );
}

function NewLeadDialog({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    phone_country: "BR",
    email: "",
    lead_type: "lead_novo",
    source: "",
    referred_by: "",
    other_goal: "",
    temperature: "morno",
    owner_id: "",
    notes: "",
    next_action: "Responder primeiro contato",
    custom_action: "",
    action_details: "",
    next_action_date: todayISO(),
  });
  const profiles = useQuery({
    queryKey: ["crm-responsibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const customActions = useQuery({
    queryKey: ["crm-action-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_action_catalog")
        .select("name")
        .eq("active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user)
        throw new Error("Sua sessão expirou. Entre novamente para cadastrar o lead.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", userData.user!.id)
        .maybeSingle();
      if (!profile) throw new Error("Perfil não encontrado.");
      const actionName =
        form.next_action === "Criar ação personalizada"
          ? form.custom_action.trim()
          : form.next_action;
      if (form.next_action === "Criar ação personalizada") {
        const { error: catalogError } = await supabase.from("crm_action_catalog").upsert(
          {
            org_id: profile.org_id,
            name: actionName,
            created_by: userData.user!.id,
          },
          { onConflict: "org_id,name" },
        );
        if (catalogError) throw new Error(catalogError.message);
      }
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          org_id: profile.org_id,
          full_name: form.full_name.trim(),
          phone: `${phoneCountries.find((country) => country.iso === form.phone_country)?.dial ?? "+55"}${form.phone.replace(/\D/g, "")}`,
          email: form.email || null,
          lead_type: form.lead_type,
          source: form.source || null,
          referred_by: form.referred_by || null,
          main_goal:
            [...selectedGoals.filter((goal) => goal !== "Outro"), form.other_goal.trim()]
              .filter(Boolean)
              .join(", ") || null,
          temperature: form.temperature,
          notes: form.notes || null,
          owner_id: form.owner_id || userData.user!.id,
        })
        .select("id")
        .single();
      if (leadError) throw new Error(leadError.message);
      const stage: FunnelStage =
        form.lead_type === "ex_paciente" ? "reativacao_futura" : "novo_lead";
      const { error } = await supabase.from("opportunities").insert({
        org_id: profile.org_id,
        lead_id: lead.id,
        title: `Negociação — ${form.full_name.trim()}`,
        stage,
        source: form.source || null,
        owner_id: form.owner_id || userData.user!.id,
        next_action: actionName,
        next_action_details: form.action_details.trim() || null,
        next_action_date: form.next_action_date,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Lead cadastrado e negociação iniciada.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-action-catalog"] }),
      ]);
      onDone();
    },
    onError: (e: Error) => {
      setFormError(e.message);
      toast.error(e.message);
    },
  });
  const submitLead = () => {
    setFormError("");
    mutation.reset();
    if (!form.full_name.trim() || !form.phone.trim()) {
      setFormError("Preencha o nome e o telefone.");
      return;
    }
    if (!form.next_action.trim()) {
      setFormError("Informe qual será a próxima ação.");
      return;
    }
    if (form.next_action === "Criar ação personalizada" && !form.custom_action.trim()) {
      setFormError("Descreva o nome da ação personalizada.");
      return;
    }
    if (selectedGoals.length === 0) {
      setFormError("Selecione pelo menos um objetivo.");
      return;
    }
    if (selectedGoals.includes("Outro") && !form.other_goal.trim()) {
      setFormError("Especifique o outro objetivo.");
      return;
    }
    if (!form.next_action_date) {
      setFormError("Selecione a data da próxima ação.");
      return;
    }
    mutation.mutate();
  };
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Novo lead</DialogTitle>
      </DialogHeader>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitLead();
        }}
        noValidate
      >
        <Field label="Nome" className="sm:col-span-2">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </Field>
        <Field label="WhatsApp">
          <div className="flex gap-2">
            <Select
              value={form.phone_country}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  phone_country: value,
                  phone: formatNationalPhone(form.phone, value),
                })
              }
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phoneCountries.map((country) => (
                  <SelectItem key={country.iso} value={country.iso}>
                    {countryFlag(country.iso)} {country.name} ({country.dial})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              inputMode="tel"
              placeholder="DDD + número"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: formatNationalPhone(e.target.value, form.phone_country),
                })
              }
            />
          </div>
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ex_paciente">Ex-paciente</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
              <SelectItem value="lead_novo">Lead novo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Origem">
          <Select
            value={form.source}
            onValueChange={(value) => setForm({ ...form, source: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent>
              {[...leadSources, "Outro"].map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Indicado por">
          <Input
            value={form.referred_by}
            onChange={(e) => setForm({ ...form, referred_by: e.target.value })}
          />
        </Field>
        <Field label="Temperatura">
          <Select
            value={form.temperature}
            onValueChange={(value) => setForm({ ...form, temperature: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frio">❄️ Frio</SelectItem>
              <SelectItem value="morno">🌤️ Morno</SelectItem>
              <SelectItem value="quente">🔥 Quente</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Responsável">
          <Select
            value={form.owner_id}
            onValueChange={(value) => setForm({ ...form, owner_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Eu (padrão)" />
            </SelectTrigger>
            <SelectContent>
              {(profiles.data ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Objetivos" className="sm:col-span-2">
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            {[...leadGoals, "Outro"].map((goal) => (
              <label key={goal} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedGoals.includes(goal)}
                  onCheckedChange={(checked) =>
                    setSelectedGoals(
                      checked
                        ? [...selectedGoals, goal]
                        : selectedGoals.filter((item) => item !== goal),
                    )
                  }
                />
                {goal}
              </label>
            ))}
          </div>
        </Field>
        {selectedGoals.includes("Outro") ? (
          <Field label="Especifique o objetivo" className="sm:col-span-2">
            <Input
              value={form.other_goal}
              onChange={(e) => setForm({ ...form, other_goal: e.target.value })}
            />
          </Field>
        ) : null}
        <Field label="Próxima ação">
          <Select
            value={form.next_action}
            onValueChange={(value) => setForm({ ...form, next_action: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...actionOptions, ...(customActions.data ?? []).map((action) => action.name)]
                .filter((action, index, list) => list.indexOf(action) === index)
                .sort((a, b) => a.localeCompare(b, "pt-BR"))
                .concat("Criar ação personalizada")
                .map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        {form.next_action === "Criar ação personalizada" ? (
          <Field label="Nome da ação personalizada" className="sm:col-span-2">
            <Input
              value={form.custom_action}
              onChange={(e) => setForm({ ...form, custom_action: e.target.value })}
            />
          </Field>
        ) : null}
        <Field label="Complemento da próxima ação" className="sm:col-span-2">
          <Input
            placeholder="Detalhe opcional do que deverá ser feito"
            value={form.action_details}
            onChange={(e) => setForm({ ...form, action_details: e.target.value })}
          />
        </Field>
        <Field label="Data da próxima ação">
          <Input
            type="date"
            value={form.next_action_date}
            onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
          />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {formError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
            Não foi possível cadastrar: {formError}
          </div>
        ) : null}
        <DialogFooter className="sm:col-span-2">
          <Button type="button" disabled={mutation.isPending} onClick={submitLead}>
            <UserRound className="size-4" />
            {mutation.isPending ? "Cadastrando..." : "Cadastrar lead"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Metric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`panel p-4 ${alert ? "border-warning/50" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {alert ? <Clock3 className="size-4 text-warning" /> : null}
        {label}
      </div>
      <p className="mt-2 text-metric text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-muted/30 p-3 ${className ?? ""}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const largest = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">Total: {total}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            Nenhum dado no período selecionado.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.max((item.value / largest) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
