import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, GripVertical, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { paymentMethodLabel } from "@/lib/labels";
import { previewWonSale, registerWonSale } from "@/lib/sales.functions";
import { seedCatalog } from "@/lib/setup.functions";

type FunnelStage = Database["public"]["Enums"]["funnel_stage"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];
type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type AgendaEntry = {
  id: string;
  date: string;
  kind: "defined" | "playbook";
  title: string;
  details: string | null;
  leadName: string;
  opportunityId: string;
  lead: LeadRow | null;
  taskId: string | null;
};
const alphabetical = (items: string[]) => [...items].sort((a, b) => a.localeCompare(b, "pt-BR"));
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
const formatMonth = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${value}-01T12:00:00`),
  );
const formatDurationDays = (value: number | null) => {
  if (value === null) return "Sem dados ainda";
  if (value < 1) return "Menos de 1 dia";
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${rounded === 1 ? "dia" : "dias"}`;
};
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

type DashboardPeriodMode = "month" | "year" | "all";

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dashboardPeriodRange = (mode: DashboardPeriodMode, month: string, year: string) => {
  const today = new Date(`${todayISO()}T12:00:00`);

  if (mode === "all") {
    return {
      from: "1900-01-01",
      to: todayISO(),
      label: "Todo o período",
      previousFrom: null,
      previousTo: null,
      comparisonLabel: null,
    };
  }

  if (mode === "year") {
    const selectedYear = Number(year);
    const isCurrentYear = selectedYear === today.getFullYear();
    const end = isCurrentYear ? today : new Date(selectedYear, 11, 31, 12);
    const previousYearDay = Math.min(
      today.getDate(),
      new Date(selectedYear - 1, today.getMonth() + 1, 0, 12).getDate(),
    );
    const previousEnd = isCurrentYear
      ? new Date(selectedYear - 1, today.getMonth(), previousYearDay, 12)
      : new Date(selectedYear - 1, 11, 31, 12);
    return {
      from: `${selectedYear}-01-01`,
      to: isoDate(end),
      label: isCurrentYear ? `${selectedYear} até hoje` : String(selectedYear),
      previousFrom: `${selectedYear - 1}-01-01`,
      previousTo: isoDate(previousEnd),
      comparisonLabel: String(selectedYear - 1),
    };
  }

  const [selectedYear, selectedMonth] = month.split("-").map(Number);
  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
  const end = isCurrentMonth ? today : new Date(selectedYear, selectedMonth, 0, 12);
  const previousStart = new Date(selectedYear, selectedMonth - 2, 1, 12);
  const previousMonthLastDay = new Date(selectedYear, selectedMonth - 1, 0, 12).getDate();
  const previousEnd = isCurrentMonth
    ? new Date(
        previousStart.getFullYear(),
        previousStart.getMonth(),
        Math.min(today.getDate(), previousMonthLastDay),
        12,
      )
    : new Date(selectedYear, selectedMonth - 1, 0, 12);

  return {
    from: `${month}-01`,
    to: isoDate(end),
    label: formatMonth(month),
    previousFrom: isoDate(previousStart),
    previousTo: isoDate(previousEnd),
    comparisonLabel: formatMonth(isoDate(previousStart).slice(0, 7)),
  };
};

export const Route = createFileRoute("/_authenticated/comercial")({
  head: () => ({ meta: [{ title: "CRM comercial — Nutri Hub" }] }),
  component: CommercialPage,
});

function CommercialPage() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [closingOpportunityId, setClosingOpportunityId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<FunnelStage | null>(null);
  const didDrag = useRef(false);
  const [dashboardPeriodMode, setDashboardPeriodMode] = useState<DashboardPeriodMode>("month");
  const [dashboardMonth, setDashboardMonth] = useState(todayISO().slice(0, 7));
  const [dashboardYear, setDashboardYear] = useState(todayISO().slice(0, 4));
  const [sourceFilter, setSourceFilter] = useState("todos");
  const [ownerFilter, setOwnerFilter] = useState("todos");
  const [goalMonth, setGoalMonth] = useState(todayISO().slice(0, 7));
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [goalForm, setGoalForm] = useState({ revenue: "", sales: "" });
  const [leadSearch, setLeadSearch] = useState("");
  const [leadTypeFilter, setLeadTypeFilter] = useState("todos");
  const [leadSourceFilter, setLeadSourceFilter] = useState("todos");
  const [leadTemperatureFilter, setLeadTemperatureFilter] = useState("todos");
  const [leadStageFilter, setLeadStageFilter] = useState("todos");
  const [leadSort, setLeadSort] = useState("recentes");
  const queryClient = useQueryClient();
  const dashboardPeriod = useMemo(
    () => dashboardPeriodRange(dashboardPeriodMode, dashboardMonth, dashboardYear),
    [dashboardMonth, dashboardPeriodMode, dashboardYear],
  );
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
  const plans = useQuery({
    queryKey: ["active-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const commercialSales = useQuery({
    queryKey: ["commercial-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, opportunity_id, sale_date, net_amount, cancelled")
        .eq("cancelled", false);
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
        .limit(1000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const stageHistory = useQuery({
    queryKey: ["opportunity-stage-history", selectedOpportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_stage_history")
        .select("id, from_stage, to_stage, changed_at")
        .eq("opportunity_id", selectedOpportunityId!)
        .order("changed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: selectedOpportunityId !== null,
  });
  const dashboardStageHistory = useQuery({
    queryKey: ["opportunity-stage-history", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_stage_history")
        .select("opportunity_id, changed_at")
        .order("changed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const commercialGoals = useQuery({
    queryKey: ["commercial-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_goals")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const selectedGoal = (commercialGoals.data ?? []).find(
    (goal) => goal.month.slice(0, 7) === goalMonth,
  );
  useEffect(() => {
    if (!goalOpen) return;
    setGoalError("");
    setGoalForm({
      revenue: selectedGoal ? String(selectedGoal.revenue_target) : "",
      sales: selectedGoal ? String(selectedGoal.sales_target) : "",
    });
  }, [goalMonth, goalOpen, selectedGoal]);
  const saveGoal = useMutation({
    mutationFn: async () => {
      const revenueTarget = Number(goalForm.revenue);
      const salesTarget = Number(goalForm.sales);
      if (!Number.isFinite(revenueTarget) || revenueTarget <= 0) {
        throw new Error("Informe uma meta de faturamento maior que zero.");
      }
      if (!Number.isInteger(salesTarget) || salesTarget <= 0) {
        throw new Error("Informe uma quantidade inteira de vendas maior que zero.");
      }
      const [{ data: orgId, error: orgError }, { data: userData }] = await Promise.all([
        supabase.rpc("current_org_id"),
        supabase.auth.getUser(),
      ]);
      if (orgError || !orgId) throw new Error(orgError?.message ?? "Organização não encontrada.");
      if (!userData.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const { error } = await supabase.from("commercial_goals").upsert(
        {
          org_id: orgId,
          month: `${goalMonth}-01`,
          revenue_target: revenueTarget,
          sales_target: salesTarget,
          created_by: selectedGoal?.created_by ?? userData.user.id,
        },
        { onConflict: "org_id,month" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["commercial-goals"] });
      toast.success("Meta comercial salva.");
      setGoalOpen(false);
    },
    onError: (error: Error) => setGoalError(error.message),
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
        queryClient.invalidateQueries({ queryKey: ["opportunity-stage-history"] }),
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
        queryClient.invalidateQueries({ queryKey: ["opportunity-stage-history"] }),
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
  const dashboard = useMemo(() => {
    const matchesDimensions = (lead: LeadRow) =>
      (sourceFilter === "todos" || (lead.source ?? "Não identificado") === sourceFilter) &&
      (ownerFilter === "todos" || lead.owner_id === ownerFilter);
    const dimensionLeads = (leads.data ?? []).filter(matchesDimensions);
    const dimensionLeadIds = new Set(dimensionLeads.map((lead) => lead.id));
    const dimensionOpportunities = (opportunities.data ?? []).filter(
      (opportunity) => opportunity.lead_id && dimensionLeadIds.has(opportunity.lead_id),
    );
    const filteredLeads = dimensionLeads.filter((lead) => {
      const day = lead.created_at.slice(0, 10);
      return day >= dashboardPeriod.from && day <= dashboardPeriod.to;
    });
    const leadIds = new Set(filteredLeads.map((lead) => lead.id));
    const filteredOpportunities = (opportunities.data ?? []).filter(
      (opportunity) => opportunity.lead_id && leadIds.has(opportunity.lead_id),
    );
    const cohortWon = filteredOpportunities.filter((opportunity) => opportunity.stage === "ganha");
    const convertedLeadIds = new Set(
      cohortWon.map((opportunity) => opportunity.lead_id).filter(Boolean),
    );
    const opportunityById = new Map(
      (opportunities.data ?? []).map((opportunity) => [opportunity.id, opportunity]),
    );
    const salesInPeriod = (commercialSales.data ?? []).filter((sale) => {
      if (sale.sale_date < dashboardPeriod.from || sale.sale_date > dashboardPeriod.to)
        return false;
      if (sourceFilter === "todos" && ownerFilter === "todos") return true;
      const opportunity = sale.opportunity_id ? opportunityById.get(sale.opportunity_id) : null;
      return Boolean(opportunity?.lead_id && dimensionLeadIds.has(opportunity.lead_id));
    });
    const revenue = salesInPeriod.reduce((sum, sale) => sum + Number(sale.net_amount), 0);
    const origins = Array.from(
      filteredLeads
        .reduce((map, lead) => {
          const source = lead.source || "Não identificado";
          const current = map.get(source) ?? {
            origem: source,
            leads: 0,
            convertidos: 0,
          };
          current.leads += 1;
          if (convertedLeadIds.has(lead.id)) current.convertidos += 1;
          map.set(source, current);
          return map;
        }, new Map<string, { origem: string; leads: number; convertidos: number }>())
        .values(),
    ).sort((a, b) => b.leads - a.leads);
    const stageData = stages
      .map((stage) => ({
        label: stage.label,
        value: filteredOpportunities.filter((item) => item.stage === stage.value).length,
      }))
      .filter((item) => item.value > 0);
    const overdueTasks = (tasks.data ?? []).filter((task) => {
      const opportunity = task.opportunities as { lead_id?: string | null } | null;
      return (
        task.due_date < todayISO() &&
        opportunity?.lead_id &&
        dimensionLeadIds.has(opportunity.lead_id)
      );
    });
    const overdueDefinedActions = dimensionOpportunities.filter(
      (opportunity) =>
        activeStages.includes(opportunity.stage) &&
        opportunity.next_action_date &&
        opportunity.next_action_date < todayISO(),
    );
    const latestStageChange = new Map<string, string>();
    for (const history of dashboardStageHistory.data ?? []) {
      if (!latestStageChange.has(history.opportunity_id)) {
        latestStageChange.set(history.opportunity_id, history.changed_at);
      }
    }
    const staleLimit = new Date();
    staleLimit.setDate(staleLimit.getDate() - 7);
    const stale = dimensionOpportunities.filter((opportunity) => {
      if (!activeStages.includes(opportunity.stage) || opportunity.stage === "reativacao_futura") {
        return false;
      }
      const lastChange = latestStageChange.get(opportunity.id) ?? opportunity.created_at;
      return new Date(lastChange) < staleLimit;
    });
    const agingByStage = new Map<FunnelStage, { totalDays: number; count: number }>();
    const now = Date.now();
    for (const opportunity of dimensionOpportunities) {
      if (!activeStages.includes(opportunity.stage)) continue;
      const lastChange = latestStageChange.get(opportunity.id) ?? opportunity.created_at;
      const days = Math.max(0, (now - new Date(lastChange).getTime()) / 86_400_000);
      const current = agingByStage.get(opportunity.stage) ?? { totalDays: 0, count: 0 };
      current.totalDays += days;
      current.count += 1;
      agingByStage.set(opportunity.stage, current);
    }
    const bottleneck = Array.from(agingByStage, ([stage, value]) => ({
      stage,
      label: stages.find((item) => item.value === stage)?.label ?? stage,
      averageDays: value.totalDays / value.count,
      count: value.count,
    })).sort((a, b) => b.averageDays - a.averageDays)[0];
    const salesCycles = cohortWon
      .filter((opportunity) => opportunity.closed_at)
      .map(
        (opportunity) =>
          Math.max(
            0,
            new Date(opportunity.closed_at!).getTime() - new Date(opportunity.created_at).getTime(),
          ) / 86_400_000,
      );
    const losses = Array.from(
      (opportunities.data ?? [])
        .filter((opportunity) => {
          const closedDay = opportunity.closed_at?.slice(0, 10);
          if (!closedDay) return false;
          return (
            opportunity.stage === "perdida" &&
            closedDay >= dashboardPeriod.from &&
            closedDay <= dashboardPeriod.to &&
            Boolean(opportunity.lead_id && dimensionLeadIds.has(opportunity.lead_id))
          );
        })
        .reduce((map, opportunity) => {
          const reason = opportunity.loss_reason?.trim() || "Não informado";
          map.set(reason, (map.get(reason) ?? 0) + 1);
          return map;
        }, new Map<string, number>()),
      ([label, value]) => ({ label, value }),
    ).sort((a, b) => b.value - a.value);
    return {
      leads: filteredLeads.length,
      sales: salesInPeriod.length,
      conversion: filteredLeads.length ? convertedLeadIds.size / filteredLeads.length : 0,
      revenue,
      overdue: overdueTasks.length + overdueDefinedActions.length,
      stale: stale.length,
      averageSalesCycle:
        salesCycles.length > 0
          ? salesCycles.reduce((sum, days) => sum + days, 0) / salesCycles.length
          : null,
      salesCycleCount: salesCycles.length,
      bottleneck: bottleneck ?? null,
      origins,
      stageData,
      losses,
    };
  }, [
    dashboardStageHistory.data,
    dashboardPeriod.from,
    dashboardPeriod.to,
    commercialSales.data,
    leads.data,
    opportunities.data,
    ownerFilter,
    sourceFilter,
    tasks.data,
  ]);
  const previousDashboard = useMemo(() => {
    if (!dashboardPeriod.previousFrom || !dashboardPeriod.previousTo) return null;

    const matchesDimensions = (lead: LeadRow) =>
      (sourceFilter === "todos" || (lead.source ?? "Não identificado") === sourceFilter) &&
      (ownerFilter === "todos" || lead.owner_id === ownerFilter);
    const dimensionLeads = (leads.data ?? []).filter(matchesDimensions);
    const dimensionLeadIds = new Set(dimensionLeads.map((lead) => lead.id));
    const filteredLeads = dimensionLeads.filter((lead) => {
      const day = lead.created_at.slice(0, 10);
      return day >= dashboardPeriod.previousFrom! && day <= dashboardPeriod.previousTo!;
    });
    const leadIds = new Set(filteredLeads.map((lead) => lead.id));
    const filteredOpportunities = (opportunities.data ?? []).filter(
      (opportunity) => opportunity.lead_id && leadIds.has(opportunity.lead_id),
    );
    const convertedLeadIds = new Set(
      filteredOpportunities
        .filter((opportunity) => opportunity.stage === "ganha")
        .map((opportunity) => opportunity.lead_id)
        .filter(Boolean),
    );
    const opportunityById = new Map(
      (opportunities.data ?? []).map((opportunity) => [opportunity.id, opportunity]),
    );
    const sales = (commercialSales.data ?? []).filter((sale) => {
      if (
        sale.sale_date < dashboardPeriod.previousFrom! ||
        sale.sale_date > dashboardPeriod.previousTo!
      ) {
        return false;
      }
      if (sourceFilter === "todos" && ownerFilter === "todos") return true;
      const opportunity = sale.opportunity_id ? opportunityById.get(sale.opportunity_id) : null;
      return Boolean(opportunity?.lead_id && dimensionLeadIds.has(opportunity.lead_id));
    });

    return {
      leads: filteredLeads.length,
      sales: sales.length,
      conversion: filteredLeads.length ? convertedLeadIds.size / filteredLeads.length : 0,
      revenue: sales.reduce((sum, sale) => sum + Number(sale.net_amount), 0),
    };
  }, [
    commercialSales.data,
    dashboardPeriod.previousFrom,
    dashboardPeriod.previousTo,
    leads.data,
    opportunities.data,
    ownerFilter,
    sourceFilter,
  ]);
  const goalProgress = useMemo(() => {
    const sales = (commercialSales.data ?? []).filter((sale) =>
      sale.sale_date.startsWith(goalMonth),
    );
    const revenue = sales.reduce((sum, sale) => sum + Number(sale.net_amount), 0);
    const revenueTarget = Number(selectedGoal?.revenue_target ?? 0);
    const salesTarget = Number(selectedGoal?.sales_target ?? 0);
    return {
      revenue,
      sales: sales.length,
      revenueTarget,
      salesTarget,
      revenuePercent: revenueTarget ? (revenue / revenueTarget) * 100 : 0,
      salesPercent: salesTarget ? (sales.length / salesTarget) * 100 : 0,
      remainingRevenue: Math.max(revenueTarget - revenue, 0),
      remainingSales: Math.max(salesTarget - sales.length, 0),
    };
  }, [commercialSales.data, goalMonth, selectedGoal]);
  const sourceOptions = useMemo(
    () =>
      Array.from(
        new Set((leads.data ?? []).map((lead) => lead.source || "Não identificado")),
      ).sort(),
    [leads.data],
  );
  const dashboardYearOptions = useMemo(() => {
    const years = new Set<string>([todayISO().slice(0, 4)]);
    for (const lead of leads.data ?? []) years.add(lead.created_at.slice(0, 4));
    for (const sale of commercialSales.data ?? []) years.add(sale.sale_date.slice(0, 4));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [commercialSales.data, leads.data]);
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
  const agenda = useMemo(() => {
    const entries: AgendaEntry[] = nextActions.map((opportunity) => {
      const lead = (leads.data ?? []).find((item) => item.id === opportunity.lead_id) ?? null;
      return {
        id: `defined-${opportunity.id}`,
        date: opportunity.next_action_date ?? todayISO(),
        kind: "defined",
        title: opportunity.next_action ?? "Próxima ação",
        details: opportunity.next_action_details,
        leadName: lead?.full_name ?? opportunity.title,
        opportunityId: opportunity.id,
        lead,
        taskId: null,
      };
    });

    for (const task of tasks.data ?? []) {
      const related = task.opportunities as {
        title: string;
        lead_id: string | null;
        leads: { full_name: string } | null;
      } | null;
      const lead = (leads.data ?? []).find((item) => item.id === related?.lead_id) ?? null;
      entries.push({
        id: `playbook-${task.id}`,
        date: task.due_date,
        kind: "playbook",
        title: task.title,
        details: null,
        leadName: lead?.full_name ?? related?.leads?.full_name ?? related?.title ?? "Lead",
        opportunityId: task.opportunity_id,
        lead,
        taskId: task.id,
      });
    }

    entries.sort((a, b) => a.date.localeCompare(b.date) || a.leadName.localeCompare(b.leadName));
    const grouped = new Map<string, AgendaEntry[]>();
    for (const entry of entries) {
      grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]);
    }
    const weekEnd = new Date(`${todayISO()}T12:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndISO = weekEnd.toISOString().slice(0, 10);

    return {
      days: Array.from(grouped, ([date, items]) => ({ date, items })),
      overdue: entries.filter((entry) => entry.date < todayISO()).length,
      today: entries.filter((entry) => entry.date === todayISO()).length,
      nextSevenDays: entries.filter((entry) => entry.date > todayISO() && entry.date <= weekEndISO)
        .length,
    };
  }, [leads.data, nextActions, tasks.data]);
  const selectedOpportunity = (opportunities.data ?? []).find(
    (opportunity) => opportunity.id === selectedOpportunityId,
  );
  const selectedLead = (leads.data ?? []).find((lead) => lead.id === selectedOpportunity?.lead_id);
  const closingOpportunity = (opportunities.data ?? []).find(
    (opportunity) => opportunity.id === closingOpportunityId,
  );
  const closingLead = (leads.data ?? []).find((lead) => lead.id === closingOpportunity?.lead_id);
  const filteredBaseLeads = useMemo(() => {
    const normalizedSearch = leadSearch.trim().toLocaleLowerCase("pt-BR");
    const opportunityByLead = new Map(
      (opportunities.data ?? [])
        .filter((opportunity) => opportunity.lead_id)
        .map((opportunity) => [opportunity.lead_id, opportunity]),
    );
    const result = (leads.data ?? []).filter((lead) => {
      const opportunity = opportunityByLead.get(lead.id);
      const latestStageChange = (dashboardStageHistory.data ?? []).find(
        (history) => history.opportunity_id === opportunity?.id,
      )?.changed_at;
      const staleLimit = new Date();
      staleLimit.setDate(staleLimit.getDate() - 7);
      const isStale = Boolean(
        opportunity &&
        activeStages.includes(opportunity.stage) &&
        opportunity.stage !== "reativacao_futura" &&
        new Date(latestStageChange ?? opportunity.created_at) < staleLimit,
      );
      const matchesSearch =
        !normalizedSearch ||
        [lead.full_name, lead.phone, lead.email, lead.main_goal]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
      return (
        matchesSearch &&
        (leadTypeFilter === "todos" || lead.lead_type === leadTypeFilter) &&
        (leadSourceFilter === "todos" ||
          (lead.source || "Não identificado") === leadSourceFilter) &&
        (leadTemperatureFilter === "todos" || lead.temperature === leadTemperatureFilter) &&
        (leadStageFilter === "todos" ||
          (leadStageFilter === "stale" ? isStale : opportunity?.stage === leadStageFilter))
      );
    });

    return result.sort((a, b) => {
      if (leadSort === "antigos") return a.created_at.localeCompare(b.created_at);
      if (leadSort === "nome-az") return a.full_name.localeCompare(b.full_name, "pt-BR");
      if (leadSort === "nome-za") return b.full_name.localeCompare(a.full_name, "pt-BR");
      return b.created_at.localeCompare(a.created_at);
    });
  }, [
    leadSearch,
    leadSort,
    leadSourceFilter,
    leadStageFilter,
    leadTemperatureFilter,
    leadTypeFilter,
    dashboardStageHistory.data,
    leads.data,
    opportunities.data,
  ]);
  const hasLeadFilters =
    Boolean(leadSearch) ||
    [leadTypeFilter, leadSourceFilter, leadTemperatureFilter, leadStageFilter].some(
      (value) => value !== "todos",
    ) ||
    leadSort !== "recentes";

  const clearLeadFilters = () => {
    setLeadSearch("");
    setLeadTypeFilter("todos");
    setLeadSourceFilter("todos");
    setLeadTemperatureFilter("todos");
    setLeadStageFilter("todos");
    setLeadSort("recentes");
  };

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="tarefas">Próximas ações</TabsTrigger>
          <TabsTrigger value="leads">Base de leads</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4 space-y-5">
          <section className="panel p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Visualizar por</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["month", "Mês"],
                      ["year", "Ano"],
                      ["all", "Todo o período"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={dashboardPeriodMode === value ? "default" : "outline"}
                      onClick={() => setDashboardPeriodMode(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-3">
                {dashboardPeriodMode === "month" ? (
                  <Field label="Mês selecionado">
                    <Input
                      type="month"
                      value={dashboardMonth}
                      max={todayISO().slice(0, 7)}
                      onChange={(event) => {
                        if (!event.target.value) return;
                        setDashboardMonth(event.target.value);
                        setGoalMonth(event.target.value);
                      }}
                    />
                  </Field>
                ) : dashboardPeriodMode === "year" ? (
                  <Field label="Ano selecionado">
                    <Select value={dashboardYear} onValueChange={setDashboardYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboardYearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">Período selecionado</p>
                    <p className="mt-1 font-medium">Desde o primeiro registro</p>
                  </div>
                )}
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
            </div>
            <div className="mt-4 border-t border-border pt-3 text-sm">
              <span className="font-semibold capitalize">{dashboardPeriod.label}</span>
              {dashboardPeriod.comparisonLabel ? (
                <span className="text-muted-foreground">
                  {" "}
                  · comparação automática com {dashboardPeriod.comparisonLabel}
                </span>
              ) : (
                <span className="text-muted-foreground"> · visão acumulada</span>
              )}
            </div>
          </section>

          {dashboardPeriodMode === "month" ? (
            <section className="panel p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="font-semibold capitalize">
                    Meta comercial · {formatMonth(goalMonth)}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acompanhe somente faturamento vendido e quantidade de vendas
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <Button variant="outline" onClick={() => setGoalOpen(true)}>
                    {selectedGoal ? "Ajustar meta" : "Definir meta"}
                  </Button>
                </div>
              </div>
              {commercialGoals.isLoading ? (
                <Skeleton className="mt-5 h-24 w-full" />
              ) : commercialGoals.isError ? (
                <p className="mt-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Não foi possível carregar as metas comerciais.
                </p>
              ) : selectedGoal ? (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <GoalProgress
                    label="Faturamento vendido"
                    current={formatBRL(goalProgress.revenue)}
                    target={formatBRL(goalProgress.revenueTarget)}
                    percent={goalProgress.revenuePercent}
                    remaining={`Faltam ${formatBRL(goalProgress.remainingRevenue)}`}
                  />
                  <GoalProgress
                    label="Vendas concluídas"
                    current={String(goalProgress.sales)}
                    target={String(goalProgress.salesTarget)}
                    percent={goalProgress.salesPercent}
                    remaining={`Faltam ${goalProgress.remainingSales} ${goalProgress.remainingSales === 1 ? "venda" : "vendas"}`}
                  />
                </div>
              ) : (
                <p className="mt-5 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                  Nenhuma meta definida para {formatMonth(goalMonth)}.
                </p>
              )}
              <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Meta de {formatMonth(goalMonth)}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <Field label="Meta de faturamento vendido (R$)">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={goalForm.revenue}
                        onChange={(event) =>
                          setGoalForm((current) => ({ ...current, revenue: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Meta de vendas concluídas">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={goalForm.sales}
                        onChange={(event) =>
                          setGoalForm((current) => ({ ...current, sales: event.target.value }))
                        }
                      />
                    </Field>
                    {goalError ? (
                      <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {goalError}
                      </p>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setGoalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button disabled={saveGoal.isPending} onClick={() => saveGoal.mutate()}>
                      {saveGoal.isPending ? "Salvando..." : "Salvar meta"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Leads recebidos"
              value={String(dashboard.leads)}
              comparison={
                previousDashboard && dashboardPeriod.comparisonLabel
                  ? {
                      current: dashboard.leads,
                      previous: previousDashboard.leads,
                      mode: "percent",
                      label: dashboardPeriod.comparisonLabel,
                    }
                  : undefined
              }
              onClick={() => {
                clearLeadFilters();
                setActiveTab("leads");
              }}
            />
            <Metric
              label="Vendas concluídas"
              value={String(dashboard.sales)}
              comparison={
                previousDashboard && dashboardPeriod.comparisonLabel
                  ? {
                      current: dashboard.sales,
                      previous: previousDashboard.sales,
                      mode: "percent",
                      label: dashboardPeriod.comparisonLabel,
                    }
                  : undefined
              }
              onClick={() => {
                clearLeadFilters();
                setLeadStageFilter("ganha");
                setActiveTab("leads");
              }}
            />
            <Metric
              label="Conversão dos leads do período"
              value={`${(dashboard.conversion * 100).toFixed(1).replace(".", ",")}%`}
              comparison={
                previousDashboard && dashboardPeriod.comparisonLabel
                  ? {
                      current: dashboard.conversion,
                      previous: previousDashboard.conversion,
                      mode: "points",
                      label: dashboardPeriod.comparisonLabel,
                    }
                  : undefined
              }
              onClick={() => {
                clearLeadFilters();
                setLeadStageFilter("ganha");
                setActiveTab("leads");
              }}
            />
            <Metric
              label={`Faturamento vendido · ${dashboard.sales} ${dashboard.sales === 1 ? "venda" : "vendas"}`}
              value={formatBRL(dashboard.revenue)}
              comparison={
                previousDashboard && dashboardPeriod.comparisonLabel
                  ? {
                      current: dashboard.revenue,
                      previous: previousDashboard.revenue,
                      mode: "percent",
                      label: dashboardPeriod.comparisonLabel,
                    }
                  : undefined
              }
              onClick={() => {
                clearLeadFilters();
                setLeadStageFilter("ganha");
                setActiveTab("leads");
              }}
            />
          </div>

          <section className="panel p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Atenção agora</h3>
              <p className="text-xs text-muted-foreground">
                Pendências operacionais que precisam de ação, independentemente da comparação
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Metric
                label="Ações atrasadas"
                value={String(dashboard.overdue)}
                alert={dashboard.overdue > 0}
                onClick={() => setActiveTab("tarefas")}
              />
              <Metric
                label="Leads parados há 7+ dias"
                value={String(dashboard.stale)}
                alert={dashboard.stale > 0}
                onClick={() => {
                  clearLeadFilters();
                  setLeadStageFilter("stale");
                  setActiveTab("leads");
                }}
              />
            </div>
          </section>

          <section className="panel p-5">
            <div>
              <h3 className="font-semibold">Velocidade do funil</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Mostra se a venda está demorando e onde as negociações estão paradas
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Tempo médio até a venda</p>
                <p className="mt-2 text-xl font-semibold">
                  {formatDurationDays(dashboard.averageSalesCycle)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboard.salesCycleCount
                    ? `Calculado com ${dashboard.salesCycleCount} ${dashboard.salesCycleCount === 1 ? "venda" : "vendas"}`
                    : "Será calculado após a primeira venda do período"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Gargalo atual</p>
                <p className="mt-2 text-xl font-semibold">
                  {dashboard.bottleneck?.label ?? "Sem negociações ativas"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboard.bottleneck
                    ? `${dashboard.bottleneck.count} ${dashboard.bottleneck.count === 1 ? "lead" : "leads"} · média de ${formatDurationDays(dashboard.bottleneck.averageDays).toLocaleLowerCase("pt-BR")}`
                    : "Nenhuma etapa precisa de atenção agora"}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Breakdown title="Etapas atuais dos leads do período" items={dashboard.stageData} />
            <section className="panel p-5">
              <div className="mb-4">
                <h3 className="font-semibold">Desempenho por origem</h3>
                <p className="text-xs text-muted-foreground">
                  Volume e conversão dos leads recebidos no período
                </p>
              </div>
              {dashboard.origins.length ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Origem</th>
                        <th className="px-3 py-2 text-right font-medium">Leads</th>
                        <th className="px-3 py-2 text-right font-medium">Convertidos</th>
                        <th className="px-3 py-2 text-right font-medium">Conversão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dashboard.origins.slice(0, 8).map((origin) => (
                        <tr key={origin.origem}>
                          <td className="px-3 py-2 font-medium">{origin.origem}</td>
                          <td className="px-3 py-2 text-right">{origin.leads}</td>
                          <td className="px-3 py-2 text-right">{origin.convertidos}</td>
                          <td className="px-3 py-2 text-right">
                            {origin.leads
                              ? `${((origin.convertidos / origin.leads) * 100).toFixed(1).replace(".", ",")}%`
                              : "0,0%"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum lead no período selecionado.</p>
              )}
            </section>
          </div>

          <section className="panel p-5">
            <div className="mb-4">
              <h3 className="font-semibold">Motivos de perda</h3>
              <p className="text-xs text-muted-foreground">
                Use este bloco para ajustar abordagem, oferta e qualificação
              </p>
            </div>
            {dashboard.losses.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {dashboard.losses.slice(0, 6).map((loss) => (
                  <div
                    key={loss.label}
                    className="flex items-center justify-between rounded-md bg-muted/50 p-3 text-sm"
                  >
                    <span>{loss.label}</span>
                    <strong>{loss.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma perda registrada no período selecionado.
              </p>
            )}
          </section>
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
                        if (stage.value === "ganha") setClosingOpportunityId(id);
                        else move.mutate({ id, from, to: stage.value });
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
            <section className="panel p-5">
              <div>
                <h2 className="font-semibold">Agenda comercial por dia</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reúne a ação definida no cadastro e todos os lembretes automáticos da etapa atual.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <AgendaMetric
                  label="Atrasadas"
                  value={agenda.overdue}
                  tone={agenda.overdue > 0 ? "danger" : "neutral"}
                />
                <AgendaMetric
                  label="Para hoje"
                  value={agenda.today}
                  tone={agenda.today > 0 ? "warning" : "neutral"}
                />
                <AgendaMetric label="Próximos 7 dias" value={agenda.nextSevenDays} tone="info" />
              </div>
            </section>

            {agenda.days.length === 0 ? (
              <EmptyState
                title="Agenda comercial vazia"
                description="Cadastre uma próxima ação ou mova um lead de etapa para gerar a régua do playbook."
              />
            ) : (
              <div className="space-y-4">
                {agenda.days.map((day) => {
                  const overdue = day.date < todayISO();
                  const isToday = day.date === todayISO();
                  return (
                    <section key={day.date} className="panel overflow-hidden">
                      <div
                        className={`flex items-center justify-between border-b border-border px-4 py-3 ${
                          overdue ? "bg-red-50" : isToday ? "bg-amber-50" : "bg-muted/40"
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{formatAgendaDay(day.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {overdue
                              ? "Pendências vencidas"
                              : isToday
                                ? "Prioridades de hoje"
                                : "Programado"}
                          </p>
                        </div>
                        <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium shadow-sm">
                          {day.items.length} {day.items.length === 1 ? "ação" : "ações"}
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {day.items.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-3 p-4"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {fixPortugueseText(entry.title)}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    entry.kind === "defined"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-violet-100 text-violet-700"
                                  }`}
                                >
                                  {entry.kind === "defined" ? "Ação definida" : "Playbook"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {entry.leadName}
                                {entry.details ? ` · ${entry.details}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedOpportunityId(entry.opportunityId)}
                              >
                                Ver lead
                              </Button>
                              {entry.kind === "defined" && entry.lead ? (
                                <Button size="sm" onClick={() => setEditingLead(entry.lead)}>
                                  <Pencil className="size-4" /> Atualizar ação
                                </Button>
                              ) : null}
                              {entry.kind === "playbook" && entry.taskId ? (
                                <Button
                                  size="sm"
                                  disabled={completeTask.isPending}
                                  onClick={() => completeTask.mutate(entry.taskId!)}
                                >
                                  <CheckCircle2 className="size-4" /> Concluir
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          {(leads.data ?? []).length === 0 ? (
            <EmptyState
              title="Base de leads vazia"
              description="Leads permanecem separados dos pacientes até o pagamento ser confirmado."
            />
          ) : (
            <div className="space-y-4">
              <section className="panel p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <Field label="Pesquisar" className="md:col-span-2 xl:col-span-2">
                    <Input
                      value={leadSearch}
                      onChange={(event) => setLeadSearch(event.target.value)}
                      placeholder="Nome, telefone, e-mail ou objetivo"
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select value={leadTypeFilter} onValueChange={setLeadTypeFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ex_paciente">Ex-paciente</SelectItem>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="lead_novo">Lead novo</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Origem">
                    <Select value={leadSourceFilter} onValueChange={setLeadSourceFilter}>
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
                    <Select value={leadTemperatureFilter} onValueChange={setLeadTemperatureFilter}>
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
                  <Field label="Etapa">
                    <Select value={leadStageFilter} onValueChange={setLeadStageFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        <SelectItem value="stale">Parados há 7+ dias</SelectItem>
                        {stages.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Ordenar por">
                    <Select value={leadSort} onValueChange={setLeadSort}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recentes">Mais recentes</SelectItem>
                        <SelectItem value="antigos">Mais antigos</SelectItem>
                        <SelectItem value="nome-az">Nome: A–Z</SelectItem>
                        <SelectItem value="nome-za">Nome: Z–A</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground">
                    {filteredBaseLeads.length} de {(leads.data ?? []).length} leads encontrados
                  </p>
                  {hasLeadFilters ? (
                    <Button size="sm" variant="outline" onClick={clearLeadFilters}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
              </section>

              {filteredBaseLeads.length === 0 ? (
                <section className="panel p-8 text-center">
                  <p className="font-medium">Nenhum lead corresponde aos filtros.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Altere a pesquisa ou limpe os filtros.
                  </p>
                  <Button className="mt-4" variant="outline" onClick={clearLeadFilters}>
                    Limpar filtros
                  </Button>
                </section>
              ) : (
                <div className="panel overflow-x-auto">
                  <table className="w-full min-w-[780px] text-sm">
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
                      {filteredBaseLeads.map((lead) => (
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingLead(lead)}
                              >
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
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Histórico do funil</h3>
              </div>
              {stageHistory.isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : stageHistory.isError ? (
                <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>
              ) : stageHistory.data?.length ? (
                <ol className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {stageHistory.data.map((entry) => {
                    const fromLabel = stages.find(
                      (stage) => stage.value === entry.from_stage,
                    )?.label;
                    const toLabel =
                      stages.find((stage) => stage.value === entry.to_stage)?.label ??
                      entry.to_stage;
                    return (
                      <li key={entry.id} className="flex items-start justify-between gap-4 text-sm">
                        <span>
                          {fromLabel ? `${fromLabel} → ${toLabel}` : `Entrou em ${toLabel}`}
                        </span>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(entry.changed_at)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  O histórico começará a ser registrado a partir desta versão.
                </p>
              )}
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
      <Dialog
        open={closingOpportunityId !== null}
        onOpenChange={(value) => !value && setClosingOpportunityId(null)}
      >
        {closingOpportunity && closingLead ? (
          <CloseSaleDialog
            opportunity={closingOpportunity}
            lead={closingLead}
            plans={plans.data ?? []}
            plansLoading={plans.isLoading}
            onDone={() => setClosingOpportunityId(null)}
          />
        ) : null}
      </Dialog>
    </PageBody>
  );
}

function CloseSaleDialog({
  opportunity,
  lead,
  plans,
  plansLoading,
  onDone,
}: {
  opportunity: OpportunityRow;
  lead: LeadRow;
  plans: PlanRow[];
  plansLoading: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    plan_id: opportunity.plan_id ?? "",
    payment_method: (opportunity.payment_method ?? "pix") as PaymentMethod,
    sale_date: todayISO(),
    discount: "0",
    installments: "1",
    down_payment: "0",
    settlement_mode: "integral" as "integral" | "parcelado",
    settlement_date: todayISO(),
    card_fee_percent: "0",
    anticipation_fee_percent: "0",
    is_renewal: false,
    notes: "",
  });

  useEffect(() => {
    if (!form.plan_id && plans[0]) setForm((current) => ({ ...current, plan_id: plans[0]!.id }));
  }, [form.plan_id, plans]);

  const selectedPlan = plans.find((plan) => plan.id === form.plan_id);
  const grossAmount = selectedPlan ? Number(selectedPlan.card_total) : 0;
  const paymentConditionAmount = selectedPlan
    ? form.payment_method === "cartao_credito"
      ? Number(selectedPlan.card_total)
      : form.payment_method === "cortesia"
        ? 0
        : Number(selectedPlan.pix_price)
    : 0;
  const additionalDiscount = Number(form.discount || 0);
  const estimatedNet = Math.max(0, paymentConditionAmount - additionalDiscount);
  const totalDiscount = Math.max(0, grossAmount - estimatedNet);
  const estimatedProcessingFee =
    estimatedNet *
    ((Number(form.card_fee_percent || 0) + Number(form.anticipation_fee_percent || 0)) / 100);
  const estimatedCash = Math.max(0, estimatedNet - estimatedProcessingFee);

  const financialPreview = useQuery({
    queryKey: [
      "sale-financial-preview",
      form.plan_id,
      form.payment_method,
      form.sale_date,
      form.discount,
      form.installments,
      form.down_payment,
      form.settlement_mode,
      form.settlement_date,
      form.card_fee_percent,
      form.anticipation_fee_percent,
    ],
    enabled: Boolean(form.plan_id && form.sale_date),
    queryFn: () =>
      previewWonSale({
        data: {
          planId: form.plan_id,
          paymentMethod: form.payment_method,
          saleDate: form.sale_date,
          discount: Number(form.discount || 0),
          installments: Number(form.installments || 1),
          downPayment: Number(form.down_payment || 0),
          settlementMode: form.settlement_mode,
          settlementDate: form.settlement_date,
          cardFeePercent: Number(form.card_fee_percent || 0),
          anticipationFeePercent: Number(form.anticipation_fee_percent || 0),
        },
      }),
    staleTime: 30_000,
  });

  const setupCatalog = useMutation({
    mutationFn: () => seedCatalog(),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["active-plans"] });
      if (created.plans > 0) toast.success(`${created.plans} planos foram disponibilizados.`);
      else toast.info("O catálogo já existe. Atualizando a lista de planos...");
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const mutation = useMutation({
    mutationFn: () =>
      registerWonSale({
        data: {
          leadId: lead.id,
          opportunityId: opportunity.id,
          planId: form.plan_id,
          paymentMethod: form.payment_method,
          saleDate: form.sale_date,
          discount: Number(form.discount || 0),
          installments: Number(form.installments || 1),
          downPayment: Number(form.down_payment || 0),
          settlementMode: form.settlement_mode,
          settlementDate: form.settlement_date,
          cardFeePercent: Number(form.card_fee_percent || 0),
          anticipationFeePercent: Number(form.anticipation_fee_percent || 0),
          isRenewal: form.is_renewal,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: async (result) => {
      toast.success(
        `Venda registrada. ${lead.full_name} agora é paciente ativo. Valor líquido: ${formatBRL(result.netAmount)}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["commercial-sales"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["receivables"] }),
      ]);
      onDone();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const submit = () => {
    setFormError("");
    if (!form.plan_id) return setFormError("Cadastre ou selecione um plano para concluir a venda.");
    if (!form.sale_date) return setFormError("Informe a data da venda.");
    if (Number(form.discount) < 0) return setFormError("O desconto não pode ser negativo.");
    if (Number(form.installments) < 1) return setFormError("Informe ao menos uma parcela.");
    if (!form.settlement_date) return setFormError("Informe a data prevista do repasse.");
    if (Number(form.card_fee_percent) < 0 || Number(form.anticipation_fee_percent) < 0)
      return setFormError("As taxas não podem ser negativas.");
    if (Number(form.down_payment) < 0)
      return setFormError("O valor da entrada não pode ser negativo.");
    if (Number(form.down_payment) > estimatedNet)
      return setFormError("A entrada não pode ser maior que o valor líquido da venda.");
    if (!confirmed)
      return setFormError("Confirme o pagamento ou a condição comercial antes de concluir.");
    mutation.mutate();
  };

  const paymentMethods: PaymentMethod[] = [
    "pix",
    "cartao_credito",
    "cartao_debito",
    "dinheiro",
    "boleto",
    "transferencia",
    "permuta",
    "cortesia",
  ];

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Confirmar venda — {lead.full_name}</DialogTitle>
      </DialogHeader>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
        O card só será movido para Venda concluída depois do registro da venda. O sistema também
        criará o paciente, o contrato, as parcelas e o reconhecimento da receita.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plano" className="sm:col-span-2">
          <Select
            value={form.plan_id}
            onValueChange={(value) => setForm({ ...form, plan_id: value })}
            disabled={plansLoading || plans.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={plansLoading ? "Carregando planos..." : "Selecione o plano"}
              />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name} — Pix {formatBRL(Number(plan.pix_price))} | Cartão{" "}
                  {formatBRL(Number(plan.card_total))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!plansLoading && plans.length === 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-950">
                Nenhum plano está disponível ainda. Carregue o catálogo inicial do consultório para
                selecionar o plano vendido.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={setupCatalog.isPending}
                onClick={() => setupCatalog.mutate()}
              >
                <Plus className="size-4" />
                {setupCatalog.isPending ? "Carregando planos..." : "Carregar catálogo de planos"}
              </Button>
            </div>
          ) : null}
        </Field>
        <Field label="Forma de pagamento">
          <Select
            value={form.payment_method}
            onValueChange={(value) =>
              setForm({
                ...form,
                payment_method: value as PaymentMethod,
                installments: value === "cartao_credito" ? form.installments : "1",
                settlement_mode: "integral",
                card_fee_percent: value === "cartao_credito" ? form.card_fee_percent : "0",
                anticipation_fee_percent:
                  value === "cartao_credito" ? form.anticipation_fee_percent : "0",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentMethodLabel[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data da venda">
          <Input
            type="date"
            value={form.sale_date}
            onChange={(event) =>
              setForm({
                ...form,
                sale_date: event.target.value,
                settlement_date:
                  form.settlement_date === form.sale_date
                    ? event.target.value
                    : form.settlement_date,
              })
            }
          />
        </Field>
        <Field label="Outro desconto concedido (opcional)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.discount}
            onChange={(event) => setForm({ ...form, discount: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use somente se você concedeu um desconto além do preço já definido para Pix ou cartão.
          </p>
        </Field>
        <Field label="Parcelas cobradas do cliente">
          <Input
            type="number"
            min="1"
            max="48"
            value={form.installments}
            disabled={form.payment_method !== "cartao_credito"}
            onChange={(event) => setForm({ ...form, installments: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Esta quantidade descreve a cobrança do cliente e não o número de entradas no seu caixa.
          </p>
        </Field>
        {form.payment_method === "cartao_credito" ? (
          <>
            <Field label="Forma de repasse ao consultório">
              <Select
                value={form.settlement_mode}
                onValueChange={(value) =>
                  setForm({ ...form, settlement_mode: value as "integral" | "parcelado" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="integral">Repasse integral em uma data</SelectItem>
                  <SelectItem value="parcelado">Repasses mensais</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data prevista do primeiro repasse">
              <Input
                type="date"
                value={form.settlement_date}
                onChange={(event) => setForm({ ...form, settlement_date: event.target.value })}
              />
            </Field>
            <Field label="Taxa do cartão (%)">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.card_fee_percent}
                onChange={(event) => setForm({ ...form, card_fee_percent: event.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Custo cobrado pela operadora. Não é desconto concedido ao cliente.
              </p>
            </Field>
            <Field label="Taxa de antecipação (%)">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.anticipation_fee_percent}
                onChange={(event) =>
                  setForm({ ...form, anticipation_fee_percent: event.target.value })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Preencha somente quando houver cobrança adicional para antecipar o repasse.
              </p>
            </Field>
          </>
        ) : (
          <Field label="Data prevista do recebimento">
            <Input
              type="date"
              value={form.settlement_date}
              onChange={(event) => setForm({ ...form, settlement_date: event.target.value })}
            />
          </Field>
        )}
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Valor bruto do plano</p>
            <p className="mt-1 text-lg font-semibold">{formatBRL(grossAmount)}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Descontos totais</p>
            <p className="mt-1 text-lg font-semibold">{formatBRL(totalDiscount)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-800">Receita líquida da venda</p>
            <p className="mt-1 text-lg font-semibold text-emerald-950">{formatBRL(estimatedNet)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800">Valor previsto no caixa</p>
            <p className="mt-1 text-lg font-semibold text-blue-950">{formatBRL(estimatedCash)}</p>
            <p className="mt-1 text-xs text-blue-800">
              Após {formatBRL(estimatedProcessingFee)} de taxas
            </p>
          </div>
        </div>
        {financialPreview.data ? (
          <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:col-span-2">
            <div>
              <h3 className="font-semibold text-blue-950">Impacto financeiro desta venda</h3>
              <p className="mt-1 text-sm text-blue-900/80">
                Prévia do que será criado no Financeiro e na DRE após a confirmação.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  DRE — regime de competência
                </p>
                <p className="mt-2 text-sm">
                  Receita líquida distribuída de {formatDate(form.sale_date)} até{" "}
                  {formatDate(financialPreview.data.endDate)}.
                </p>
                <p className="mt-2 font-semibold">
                  Aproximadamente {formatBRL(financialPreview.data.recognition[0]?.net_amount ?? 0)}
                  /mês por {financialPreview.data.recognition.length} meses
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  As taxas de {formatBRL(financialPreview.data.processingFee)} serão registradas
                  separadamente como despesa comercial, sem reduzir o desconto do cliente.
                </p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fluxo de caixa
                </p>
                <p className="mt-2 text-sm">
                  {financialPreview.data.settlements.length} entrada(s) prevista(s), totalizando{" "}
                  {formatBRL(financialPreview.data.expectedCashAmount)} no caixa.
                </p>
                <p className="mt-2 text-sm">
                  O cliente pagará em {financialPreview.data.customerInstallments}x, mas o número de
                  repasses segue a forma escolhida acima.
                </p>
                <p className="mt-2 text-sm font-medium">
                  Taxas da operadora: {formatBRL(financialPreview.data.processingFee)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O dinheiro só entra no caixa após a baixa do recebimento no módulo Financeiro.
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Previsão dos repasses ao consultório</p>
                <p className="text-xs text-muted-foreground">
                  Conta financeira será definida na baixa
                </p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {financialPreview.data.settlements.map((settlement) => (
                  <div
                    key={`${settlement.installment_number}-${settlement.due_date}`}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span>
                      Repasse {settlement.installment_number}/{settlement.installment_total} ·{" "}
                      {formatDate(settlement.due_date)}
                    </span>
                    <strong>{formatBRL(settlement.expected_amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <DetailItem
                label="Receita líquida da venda"
                value={formatBRL(financialPreview.data.netAmount)}
              />
              <DetailItem
                label="Taxas de cartão/antecipação"
                value={formatBRL(financialPreview.data.processingFee)}
              />
              <DetailItem
                label="Contato para renovação"
                value={formatDate(financialPreview.data.expectedRenewalDate)}
              />
            </div>
          </section>
        ) : financialPreview.isFetching ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground sm:col-span-2">
            Calculando o impacto financeiro...
          </div>
        ) : null}
        <label className="flex items-center gap-3 rounded-lg border p-3 sm:col-span-2">
          <Checkbox
            checked={form.is_renewal}
            onCheckedChange={(value) => setForm({ ...form, is_renewal: value === true })}
          />
          <span className="text-sm">Esta venda é uma renovação de acompanhamento</span>
        </label>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Condição negociada, comprovante ou informação relevante"
          />
        </Field>
        <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:col-span-2">
          <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
          <span className="text-sm">
            Confirmo que o pagamento ou a condição comercial foi validada e que esta negociação pode
            ser registrada como venda concluída.
          </span>
        </label>
        {formError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">
            {formError}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={submit}
          disabled={mutation.isPending || plansLoading || plans.length === 0}
        >
          <CheckCircle2 className="size-4" />
          {mutation.isPending ? "Registrando venda..." : "Confirmar e concluir venda"}
        </Button>
      </DialogFooter>
    </DialogContent>
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
  comparison,
  onClick,
}: {
  label: string;
  value: string;
  alert?: boolean;
  comparison?: {
    current: number;
    previous: number;
    mode: "percent" | "points";
    label: string;
  };
  onClick: () => void;
}) {
  const difference = comparison ? comparison.current - comparison.previous : 0;
  const comparisonText = comparison
    ? comparison.mode === "points"
      ? `${difference > 0 ? "↑" : difference < 0 ? "↓" : "→"} ${Math.abs(difference * 100)
          .toFixed(1)
          .replace(".", ",")} p.p. vs. ${comparison.label}`
      : comparison.previous === 0
        ? comparison.current === 0
          ? `→ Sem mudança vs. ${comparison.label}`
          : `↑ Novo resultado vs. ${comparison.label}`
        : `${difference > 0 ? "↑" : difference < 0 ? "↓" : "→"} ${Math.abs(
            (difference / comparison.previous) * 100,
          )
            .toFixed(1)
            .replace(".", ",")}% vs. ${comparison.label}`
    : null;
  const comparisonTone =
    difference > 0 ? "text-emerald-700" : difference < 0 ? "text-red-700" : "text-muted-foreground";

  return (
    <button
      type="button"
      className={`panel p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${alert ? "border-warning/50" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {alert ? <Clock3 className="size-4 text-warning" /> : null}
        {label}
      </div>
      <p className="mt-2 text-metric text-2xl font-semibold">{value}</p>
      {comparisonText ? (
        <p className={`mt-2 text-[11px] font-medium ${comparisonTone}`}>{comparisonText}</p>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Acumulado no período</p>
      )}
      <p className="mt-1 text-[11px] font-medium text-primary">Ver registros</p>
    </button>
  );
}

function GoalProgress({
  label,
  current,
  target,
  percent,
  remaining,
}: {
  label: string;
  current: string;
  target: string;
  percent: number;
  remaining: string;
}) {
  const completed = percent >= 100;
  return (
    <div>
      <div className="flex items-start justify-between gap-4 text-sm">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {current} de {target}
          </p>
        </div>
        <strong className={completed ? "text-emerald-700" : ""}>{percent.toFixed(0)}%</strong>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] ${completed ? "bg-emerald-600" : "bg-primary"}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {completed ? "Meta atingida" : remaining}
      </p>
    </div>
  );
}

function AgendaMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "danger" | "warning" | "info";
}) {
  const tones = {
    neutral: "border-border bg-muted/30 text-foreground",
    danger: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function formatAgendaDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const tomorrow = new Date(`${todayISO()}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  const rawFormatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
  const formatted = `${rawFormatted.charAt(0).toLocaleUpperCase("pt-BR")}${rawFormatted.slice(1)}`;
  if (value === todayISO()) return `Hoje, ${formatted}`;
  if (value === tomorrowISO) return `Amanhã, ${formatted}`;
  return formatted;
}

function fixPortugueseText(value: string) {
  const replacements: Array<[string, string]> = [
    ["Ã§", "ç"],
    ["Ã£", "ã"],
    ["Ãµ", "õ"],
    ["Ã¡", "á"],
    ["Ã©", "é"],
    ["Ã­", "í"],
    ["Ã³", "ó"],
    ["Ãº", "ú"],
    ["Ã¢", "â"],
    ["Ãª", "ê"],
    ["Ã´", "ô"],
    ["Ã€", "À"],
    ["Ã�", "Á"],
    ["Ã‰", "É"],
    ["Ã“", "Ó"],
    ["Ãš", "Ú"],
  ];
  return replacements.reduce(
    (corrected, [incorrect, correct]) => corrected.replaceAll(incorrect, correct),
    value,
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
