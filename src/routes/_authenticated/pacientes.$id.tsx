import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useSession } from "@/hooks/useSession";
import { formatBRL, formatDate, formatDateTime, formatNumber, todayISO } from "@/lib/format";
import { cancelSale } from "@/lib/sales.functions";
import {
  appointmentStatusLabel,
  patientStatusLabel,
  patientStatusTone,
  receivableStatusLabel,
  receivableStatusTone,
  type AppointmentStatus,
  type PatientStatus,
  type ReceivableStatus,
} from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/pacientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do paciente — Consultório de Nutrição" },
      {
        name: "description",
        content:
          "Ficha individual com dados pessoais, registros clínicos, antropometria, contratos, parcelas e consultas.",
      },
      { property: "og:title", content: "Ficha do paciente — Consultório de Nutrição" },
      {
        property: "og:description",
        content: "Histórico clínico, comercial e financeiro do paciente.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientDetail,
});

function PatientDetail() {
  const { id } = Route.useParams();
  const { canViewClinical, canViewFinancial } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const [patient, records, anthro, receivables, contracts, sales, appointments, history] =
        await Promise.all([
          supabase.from("patients").select("*").eq("id", id).maybeSingle(),
          supabase
            .from("clinical_records")
            .select("*")
            .eq("patient_id", id)
            .order("record_date", { ascending: false }),
          supabase
            .from("anthropometry")
            .select("*")
            .eq("patient_id", id)
            .order("measured_at", { ascending: false }),
          supabase.from("receivables").select("*").eq("patient_id", id).order("due_date"),
          supabase
            .from("contracts")
            .select("*, plans(name)")
            .eq("patient_id", id)
            .order("start_date", { ascending: false }),
          supabase
            .from("sales")
            .select("*, plans(name)")
            .eq("patient_id", id)
            .order("sale_date", { ascending: false }),
          supabase
            .from("appointments")
            .select("*")
            .eq("patient_id", id)
            .order("starts_at", { ascending: false }),
          supabase
            .from("patient_status_history")
            .select("*")
            .eq("patient_id", id)
            .order("created_at", { ascending: false }),
        ]);
      if (!patient.data) throw new Error("Paciente não encontrado.");
      return {
        patient: patient.data,
        records: records.data ?? [],
        anthro: anthro.data ?? [],
        receivables: receivables.data ?? [],
        contracts: contracts.data ?? [],
        sales: sales.data ?? [],
        appointments: appointments.data ?? [],
        history: history.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <PageBody>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </PageBody>
    );
  }

  const p = data.patient;

  return (
    <PageBody>
      <PageHeader
        title={p.full_name}
        description={`${patientStatusLabel[p.status as PatientStatus]} · entrada em ${formatDate(p.entry_date)}`}
        actions={
          <>
            <Link to="/pacientes">
              <Button variant="outline">Voltar</Button>
            </Link>
            <StatusChanger patientId={p.id} current={p.status as PatientStatus} />
          </>
        }
      />

      <Tabs defaultValue="dados" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          {canViewClinical ? <TabsTrigger value="clinico">Clínico</TabsTrigger> : null}
          {canViewClinical ? <TabsTrigger value="antro">Antropometria</TabsTrigger> : null}
          {canViewFinancial ? <TabsTrigger value="financeiro">Financeiro</TabsTrigger> : null}
          <TabsTrigger value="linha">Linha do tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="pt-6">
          <div className="panel grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
            <Info label="Telefone" value={p.phone} />
            <Info label="E-mail" value={p.email} />
            <Info label="Nascimento" value={p.birth_date ? formatDate(p.birth_date) : null} />
            <Info label="Profissão" value={p.profession} />
            <Info label="Cidade" value={p.city} />
            <Info label="Origem" value={p.source} />
            <Info label="Indicado por" value={p.referred_by} />
            <Info label="Contato de emergência" value={p.emergency_contact} />
            <Info label="Telefone de emergência" value={p.emergency_phone} />
            <Info
              label="Consentimento (LGPD)"
              value={
                p.consent_accepted
                  ? `Aceito em ${formatDateTime(p.consent_accepted_at)}`
                  : "Não registrado"
              }
            />
            <div className="sm:col-span-2">
              <Info label="Observações" value={p.notes} />
            </div>
          </div>
        </TabsContent>

        {canViewClinical ? (
          <TabsContent value="clinico" className="space-y-6 pt-6">
            <NewClinicalRecord patientId={p.id} orgId={p.org_id} />
            {data.records.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum registro clínico. O primeiro registro deve conter a anamnese e o objetivo.
              </p>
            ) : (
              data.records.map((r) => (
                <div key={r.id} className="panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold">
                      {r.record_type} · {formatDate(r.record_date)}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      atualizado {formatDateTime(r.updated_at)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Objetivo" value={r.objective} />
                    <Info label="Anamnese" value={r.anamnesis} />
                    <Info label="Histórico clínico" value={r.clinical_history} />
                    <Info label="Medicamentos" value={r.medications} />
                    <Info label="Suplementos" value={r.supplements} />
                    <Info label="Exames" value={r.exams} />
                    <Info label="Restrições e preferências" value={r.restrictions} />
                    <Info label="Rotina" value={r.routine} />
                    <Info label="Sono" value={r.sleep} />
                    <Info label="Treino" value={r.training} />
                    <Info label="Sinais e sintomas" value={r.symptoms} />
                    <Info label="Evolução" value={r.evolution} />
                    <Info label="Estratégias" value={r.strategies} />
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        ) : null}

        {canViewClinical ? (
          <TabsContent value="antro" className="space-y-6 pt-6">
            <NewAnthropometry patientId={p.id} orgId={p.org_id} />
            {data.anthro.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma medição registrada.</p>
            ) : (
              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Peso</th>
                      <th className="px-4 py-3 font-medium">Gordura</th>
                      <th className="px-4 py-3 font-medium">Massa magra</th>
                      <th className="px-4 py-3 font-medium">Cintura</th>
                      <th className="px-4 py-3 font-medium">Quadril</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.anthro.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-4 py-3">{formatDate(a.measured_at)}</td>
                        <td className="px-4 py-3">
                          {a.weight_kg ? `${formatNumber(Number(a.weight_kg), 1)} kg` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {a.body_fat_pct ? `${formatNumber(Number(a.body_fat_pct), 1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {a.lean_mass_kg ? `${formatNumber(Number(a.lean_mass_kg), 1)} kg` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {a.waist_cm ? `${formatNumber(Number(a.waist_cm), 1)} cm` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {a.hip_cm ? `${formatNumber(Number(a.hip_cm), 1)} cm` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ) : null}

        {canViewFinancial ? (
          <TabsContent value="financeiro" className="space-y-6 pt-6">
            <div>
              <h3 className="section-title">Vendas</h3>
              {data.sales.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma venda registrada.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {(sale.plans as { name: string } | null)?.name ?? "Plano avulso"}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Venda em {formatDate(sale.sale_date)} · receita líquida{" "}
                          {formatBRL(Number(sale.net_amount))} · caixa previsto{" "}
                          {formatBRL(Number(sale.expected_cash_amount))}
                        </p>
                        {sale.cancelled ? (
                          <p className="mt-1 text-xs text-destructive">
                            Cancelada
                            {sale.cancellation_reason ? ` · ${sale.cancellation_reason}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {!sale.cancelled ? <CancelSaleButton sale={sale} patientId={p.id} /> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="section-title">Contratos</h3>
              {data.contracts.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhum contrato ativo.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.contracts.map((c) => (
                    <div
                      key={c.id}
                      className="panel flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">
                        {(c.plans as { name: string } | null)?.name ?? "Plano avulso"}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDate(c.start_date)} a {formatDate(c.end_date)} · {c.months} meses ·{" "}
                        {c.consultations_included} consultas · {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="section-title">Parcelas</h3>
              {data.receivables.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma parcela lançada.</p>
              ) : (
                <div className="panel mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Parcela</th>
                        <th className="px-4 py-3 font-medium">Vencimento</th>
                        <th className="px-4 py-3 font-medium">Previsto</th>
                        <th className="px-4 py-3 font-medium">Recebido</th>
                        <th className="px-4 py-3 font-medium">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.receivables.map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-4 py-3">
                            {r.installment_number}/{r.installment_total}
                          </td>
                          <td className="px-4 py-3">{formatDate(r.due_date)}</td>
                          <td className="px-4 py-3">{formatBRL(Number(r.expected_amount))}</td>
                          <td className="px-4 py-3">{formatBRL(Number(r.received_amount))}</td>
                          <td className="px-4 py-3">
                            <span className={receivableStatusTone[r.status as ReceivableStatus]}>
                              {receivableStatusLabel[r.status as ReceivableStatus]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        ) : null}

        <TabsContent value="linha" className="pt-6">
          <ol className="space-y-3">
            <TimelineItem
              date={p.entry_date}
              title="Entrada no consultório"
              detail={p.source ?? ""}
            />
            {data.history.map((h) => (
              <TimelineItem
                key={h.id}
                date={h.created_at}
                title={`Status alterado para ${patientStatusLabel[h.to_status as PatientStatus]}`}
                detail={h.note ?? ""}
              />
            ))}
            {data.appointments.map((a) => (
              <TimelineItem
                key={a.id}
                date={a.starts_at}
                title={`Consulta ${a.appointment_type} (${appointmentStatusLabel[a.status as AppointmentStatus]})`}
                detail={a.mode}
              />
            ))}
            {data.records.map((r) => (
              <TimelineItem
                key={r.id}
                date={r.record_date}
                title={`Registro clínico: ${r.record_type}`}
                detail={r.objective ?? ""}
              />
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-line">{value || "—"}</p>
    </div>
  );
}

type CancellableSale = {
  id: string;
  sale_date: string;
  net_amount: number;
  expected_cash_amount: number;
  processing_fee_amount: number;
  plans: { name: string } | null;
};

function CancelSaleButton({ sale, patientId }: { sale: CancellableSale; patientId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const mutation = useMutation({
    mutationFn: () => cancelSale({ data: { saleId: sale.id, reason } }),
    onSuccess: async () => {
      toast.success("Venda cancelada. A oportunidade voltou para Aguardando pagamento.");
      setOpen(false);
      setReason("");
      setAcknowledged(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patient", patientId] }),
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["receivables"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          Cancelar venda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar esta venda?</DialogTitle>
          <DialogDescription>
            Esta ação preserva o histórico, cancela contrato, repasse e DRE e reabre a oportunidade
            para um novo fechamento.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{sale.plans?.name ?? "Plano avulso"}</p>
          <p className="mt-1 text-muted-foreground">
            Receita {formatBRL(Number(sale.net_amount))} · caixa previsto{" "}
            {formatBRL(Number(sale.expected_cash_amount))} · taxas{" "}
            {formatBRL(Number(sale.processing_fee_amount))}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`cancel-reason-${sale.id}`}>Motivo obrigatório</Label>
          <Textarea
            id={`cancel-reason-${sale.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: plano selecionado incorretamente"
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-destructive/30 p-3">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(value) => setAcknowledged(value === true)}
          />
          <span className="text-sm">
            Confirmo que contrato, recebimentos pendentes e competências da DRE serão cancelados.
          </span>
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Manter venda
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!acknowledged || reason.trim().length < 5 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimelineItem({ date, title, detail }: { date: string; title: string; detail?: string }) {
  return (
    <li className="panel px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {date.length > 10 ? formatDateTime(date) : formatDate(date)}
      </p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
    </li>
  );
}

function StatusChanger({ patientId, current }: { patientId: string; current: PatientStatus }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: PatientStatus) => {
      const { error } = await supabase
        .from("patients")
        .update({ status: next })
        .eq("id", patientId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Status atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Select value={current} onValueChange={(v) => mutation.mutate(v as PatientStatus)}>
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(patientStatusLabel) as PatientStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            {patientStatusLabel[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NewClinicalRecord({ patientId, orgId }: { patientId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    record_type: "consulta",
    record_date: todayISO(),
    objective: "",
    anamnesis: "",
    evolution: "",
    strategies: "",
    medications: "",
    supplements: "",
    restrictions: "",
    symptoms: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("clinical_records").insert({
        org_id: orgId,
        patient_id: patientId,
        record_type: form.record_type,
        record_date: form.record_date,
        objective: form.objective || null,
        anamnesis: form.anamnesis || null,
        evolution: form.evolution || null,
        strategies: form.strategies || null,
        medications: form.medications || null,
        supplements: form.supplements || null,
        restrictions: form.restrictions || null,
        symptoms: form.symptoms || null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Registro clínico salvo.");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Novo registro clínico</Button>;
  }

  return (
    <form
      className="panel grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label className="text-xs">Tipo</Label>
        <Select
          value={form.record_type}
          onValueChange={(v) => setForm({ ...form, record_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anamnese">Anamnese inicial</SelectItem>
            <SelectItem value="consulta">Consulta</SelectItem>
            <SelectItem value="check-in">Check-in</SelectItem>
            <SelectItem value="retorno">Retorno</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Data</Label>
        <Input
          type="date"
          value={form.record_date}
          onChange={(e) => setForm({ ...form, record_date: e.target.value })}
        />
      </div>
      {(
        [
          ["objective", "Objetivo"],
          ["anamnesis", "Anamnese"],
          ["evolution", "Evolução"],
          ["strategies", "Estratégias"],
          ["medications", "Medicamentos"],
          ["supplements", "Suplementos"],
          ["restrictions", "Restrições e preferências"],
          ["symptoms", "Sinais e sintomas"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{label}</Label>
          <Textarea
            rows={2}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          Salvar registro
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function NewAnthropometry({ patientId, orgId }: { patientId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    measured_at: todayISO(),
    weight_kg: "",
    height_cm: "",
    body_fat_pct: "",
    lean_mass_kg: "",
    waist_cm: "",
    hip_cm: "",
    abdomen_cm: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const numeric = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
      const { error } = await supabase.from("anthropometry").insert({
        org_id: orgId,
        patient_id: patientId,
        measured_at: form.measured_at,
        weight_kg: numeric(form.weight_kg),
        height_cm: numeric(form.height_cm),
        body_fat_pct: numeric(form.body_fat_pct),
        lean_mass_kg: numeric(form.lean_mass_kg),
        waist_cm: numeric(form.waist_cm),
        hip_cm: numeric(form.hip_cm),
        abdomen_cm: numeric(form.abdomen_cm),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Medição registrada.");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return <Button onClick={() => setOpen(true)}>Nova medição</Button>;

  return (
    <form
      className="panel grid gap-4 p-5 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label className="text-xs">Data</Label>
        <Input
          type="date"
          value={form.measured_at}
          onChange={(e) => setForm({ ...form, measured_at: e.target.value })}
        />
      </div>
      {(
        [
          ["weight_kg", "Peso (kg)"],
          ["height_cm", "Altura (cm)"],
          ["body_fat_pct", "Gordura (%)"],
          ["lean_mass_kg", "Massa magra (kg)"],
          ["waist_cm", "Cintura (cm)"],
          ["hip_cm", "Quadril (cm)"],
          ["abdomen_cm", "Abdômen (cm)"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{label}</Label>
          <Input
            inputMode="decimal"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="flex gap-2 sm:col-span-4">
        <Button type="submit" disabled={mutation.isPending}>
          Salvar medição
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
