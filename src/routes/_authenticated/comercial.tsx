import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatBRL, formatDate } from "@/lib/format";

type FunnelStage = Database["public"]["Enums"]["funnel_stage"];

const stages: Array<{ value: FunnelStage; label: string }> = [
  { value: "novo_lead", label: "Novo lead" },
  { value: "contato_iniciado", label: "Contato iniciado" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "reuniao_agendada", label: "Reunião agendada" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "follow_up", label: "Follow-up" },
  { value: "negociacao", label: "Negociação" },
  { value: "ganha", label: "Ganha" },
  { value: "perdida", label: "Perdida" },
  { value: "reativacao_futura", label: "Reativação futura" },
];

export const Route = createFileRoute("/_authenticated/comercial")({
  head: () => ({
    meta: [
      { title: "Comercial e vendas — Consultório de Nutrição" },
      { name: "description", content: "Funil comercial integrado a pacientes, planos e vendas." },
    ],
  }),
  component: CommercialPage,
});

function CommercialPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, patients(full_name), plans(name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: FunnelStage }) => {
      const { error } = await supabase
        .from("opportunities")
        .update({
          stage,
          closed_at: ["ganha", "perdida"].includes(stage) ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Etapa atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageBody>
      <PageHeader
        title="Comercial e vendas"
        description="Acompanhe cada oportunidade do primeiro contato até a venda ou reativação."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Nova oportunidade</Button>
            </DialogTrigger>
            <NewOpportunity onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="mt-6 overflow-x-auto pb-4">
        {isLoading ? (
          <div className="grid min-w-[900px] grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma oportunidade"
            description="Cadastre o primeiro lead para iniciar o funil comercial."
          />
        ) : (
          <div className="grid min-w-[2100px] grid-cols-10 gap-3">
            {stages.map((stage) => {
              const items = (data ?? []).filter((item) => item.stage === stage.value);
              return (
                <section
                  key={stage.value}
                  className="rounded-xl border border-border bg-muted/30 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{stage.label}</h2>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-lg border border-border bg-card p-3 shadow-sm"
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(item.patients as { full_name: string } | null)?.full_name ??
                            "Lead sem paciente"}
                        </p>
                        <p className="mt-3 text-sm font-semibold">{formatBRL(item.amount)}</p>
                        {(item.plans as { name: string } | null)?.name ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(item.plans as { name: string }).name}
                          </p>
                        ) : null}
                        {item.next_action_date ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Próxima ação: {formatDate(item.next_action_date)}
                          </p>
                        ) : null}
                        <Select
                          value={item.stage}
                          onValueChange={(value) =>
                            move.mutate({ id: item.id, stage: value as FunnelStage })
                          }
                        >
                          <SelectTrigger className="mt-3 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageBody>
  );
}

function NewOpportunity({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    patient_id: "none",
    plan_id: "none",
    amount: "",
    source: "",
    next_action: "",
    next_action_date: "",
    notes: "",
  });
  const { data: patients } = useQuery({
    queryKey: ["patients-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, org_id")
        .order("full_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const { data: plans } = useQuery({
    queryKey: ["plans-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, card_total")
        .eq("active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", userData.user!.id)
        .maybeSingle();
      if (!profile) throw new Error("Perfil não encontrado.");
      const { error } = await supabase.from("opportunities").insert({
        org_id: profile.org_id,
        title: form.title.trim(),
        patient_id: form.patient_id === "none" ? null : form.patient_id,
        plan_id: form.plan_id === "none" ? null : form.plan_id,
        amount: Number(form.amount || 0),
        source: form.source || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        notes: form.notes || null,
        owner_id: userData.user!.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Oportunidade criada.");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Nova oportunidade</DialogTitle>
      </DialogHeader>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) return toast.error("Informe o título.");
          mutation.mutate();
        }}
      >
        <Field label="Título" className="sm:col-span-2">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: Renovação Premium"
          />
        </Field>
        <Field label="Paciente">
          <Select
            value={form.patient_id}
            onValueChange={(v) => setForm({ ...form, patient_id: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem paciente vinculado</SelectItem>
              {(patients ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Plano">
          <Select
            value={form.plan_id}
            onValueChange={(v) => {
              const plan = (plans ?? []).find((p) => p.id === v);
              setForm({
                ...form,
                plan_id: v,
                amount: plan ? String(plan.card_total) : form.amount,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem plano definido</SelectItem>
              {(plans ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Valor estimado">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Origem">
          <Input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="Instagram, indicação..."
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
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            Criar oportunidade
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
