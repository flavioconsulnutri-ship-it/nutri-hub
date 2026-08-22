import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageBody, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { formatBRL, formatDate, todayISO } from "@/lib/format";

type FunnelStage = Database["public"]["Enums"]["funnel_stage"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
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
  const tasks = useQuery({
    queryKey: ["crm-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*, opportunities(title, leads(full_name))")
        .eq("status", "pendente")
        .order("due_date")
        .limit(40);
      if (error) throw new Error(error.message);
      return data;
    },
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
      <Tabs defaultValue="funil" className="mt-6">
        <TabsList>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="tarefas">Próximas ações</TabsTrigger>
          <TabsTrigger value="leads">Base de leads</TabsTrigger>
        </TabsList>
        <TabsContent value="funil" className="mt-4 overflow-x-auto pb-4">
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
                  <section key={stage.value} className={`rounded-xl border p-3 ${stage.tone}`}>
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
                            className="rounded-lg border border-border bg-card p-3 shadow-sm"
                          >
                            <p className="text-sm font-semibold">{lead?.full_name ?? item.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="size-3" /> {lead?.phone ?? "Sem telefone"}
                            </p>
                            {lead?.main_goal ? (
                              <p className="mt-2 line-clamp-2 text-xs">{lead.main_goal}</p>
                            ) : null}
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="font-medium">{formatBRL(item.amount)}</span>
                              <span
                                className={
                                  item.next_action_date
                                    ? "text-muted-foreground"
                                    : "font-medium text-destructive"
                                }
                              >
                                {item.next_action_date
                                  ? formatDate(item.next_action_date)
                                  : "Sem ação"}
                              </span>
                            </div>
                            <Select
                              value={item.stage}
                              onValueChange={(to) =>
                                move.mutate({
                                  id: item.id,
                                  from: item.stage,
                                  to: to as FunnelStage,
                                })
                              }
                            >
                              <SelectTrigger className="mt-3 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
          {(tasks.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma tarefa pendente"
              description="As réguas automáticas aparecerão aqui ao cadastrar ou mover negociações."
            />
          ) : (
            <div className="panel divide-y divide-border">
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
                      onClick={() => completeTask.mutate(task.id)}
                    >
                      <CheckCircle2 className="size-4" /> Concluir
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
                        <Button size="sm" variant="outline" onClick={() => setEditingLead(lead)}>
                          <Pencil className="size-4" /> Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
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
              <SelectItem value="lead_novo">Lead novo</SelectItem>
              <SelectItem value="ex_paciente">Ex-paciente</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
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
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    lead_type: "lead_novo",
    source: "",
    referred_by: "",
    main_goal: "",
    notes: "",
    next_action: "Responder e entender objetivo",
    next_action_date: todayISO(),
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
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          org_id: profile.org_id,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email || null,
          lead_type: form.lead_type,
          source: form.source || null,
          referred_by: form.referred_by || null,
          main_goal: form.main_goal || null,
          notes: form.notes || null,
          owner_id: userData.user!.id,
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
        owner_id: userData.user!.id,
        next_action: form.next_action,
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
          <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead_novo">Lead novo</SelectItem>
              <SelectItem value="ex_paciente">Ex-paciente</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Origem">
          <Input
            placeholder="Instagram, parceiro, Google..."
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
        <Field label="Próxima ação">
          <Input
            value={form.next_action}
            onChange={(e) => setForm({ ...form, next_action: e.target.value })}
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
