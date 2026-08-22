import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageBody, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { formatDate, formatTime, todayISO } from "@/lib/format";
import {
  appointmentStatusLabel,
  appointmentStatusTone,
  type AppointmentStatus,
} from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda e consultas — Consultório de Nutrição" },
      {
        name: "description",
        content:
          "Agenda de consultas presenciais e online, com status, faltas, remarcações e alerta de pacientes sem próxima consulta.",
      },
      { property: "og:title", content: "Agenda e consultas — Consultório de Nutrição" },
      { property: "og:description", content: "Consultas, status e ocupação da agenda." },
    ],
  }),
  component: AgendaPage,
});

const statuses = Object.keys(appointmentStatusLabel) as AppointmentStatus[];

function AgendaPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO().slice(0, 8) + "28");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(full_name)")
        .gte("starts_at", `${from}T00:00:00`)
        .lte("starts_at", `${to}T23:59:59`)
        .order("starts_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Consulta atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = (data ?? []).reduce<Record<string, typeof data>>((acc, appt) => {
    const day = String(appt.starts_at).slice(0, 10);
    acc[day] = [...(acc[day] ?? []), appt];
    return acc;
  }, {});

  return (
    <PageBody>
      <PageHeader
        title="Agenda e consultas"
        description="Consultas vinculadas ao paciente e ao contrato. Faltas e remarcações ficam registradas para medir ocupação."
        actions={
          <>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>
            </div>
            <NewAppointment />
          </>
        }
      />

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : Object.keys(grouped).length === 0 ? (
          <EmptyState
            title="Nenhuma consulta no período"
            description="Agende uma consulta para começar a acompanhar a ocupação da agenda e os retornos previstos."
          />
        ) : (
          Object.entries(grouped).map(([day, list]) => (
            <section key={day}>
              <h2 className="section-title">{formatDate(day)}</h2>
              <div className="mt-3 space-y-2">
                {(list ?? []).map((appt) => (
                  <div
                    key={appt.id}
                    className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatTime(appt.starts_at)} ·{" "}
                        <Link
                          to="/pacientes/$id"
                          params={{ id: appt.patient_id }}
                          className="hover:underline"
                        >
                          {(appt.patients as { full_name: string } | null)?.full_name ?? "Paciente"}
                        </Link>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appt.appointment_type} · {appt.mode} · {appt.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={appointmentStatusTone[appt.status as AppointmentStatus]}>
                        {appointmentStatusLabel[appt.status as AppointmentStatus]}
                      </span>
                      <Select
                        value={appt.status}
                        onValueChange={(v) =>
                          updateStatus.mutate({ id: appt.id, status: v as AppointmentStatus })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {appointmentStatusLabel[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </PageBody>
  );
}

function NewAppointment() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    date: todayISO(),
    time: "08:00",
    duration_minutes: "60",
    mode: "presencial",
    appointment_type: "consulta",
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

  const mutation = useMutation({
    mutationFn: async () => {
      const patient = (patients ?? []).find((p) => p.id === form.patient_id);
      if (!patient) throw new Error("Selecione o paciente.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointments").insert({
        org_id: patient.org_id,
        patient_id: patient.id,
        professional_id: userData.user?.id ?? null,
        starts_at: new Date(`${form.date}T${form.time}:00-03:00`).toISOString(),
        duration_minutes: Number(form.duration_minutes),
        mode: form.mode as "presencial" | "online",
        appointment_type: form.appointment_type,
        status: "agendada",
        notes: form.notes || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Consulta agendada.");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return <Button onClick={() => setOpen(true)}>Nova consulta</Button>;

  return (
    <form
      className="panel grid w-full gap-3 p-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2 sm:col-span-3">
        <Label className="text-xs">Paciente</Label>
        <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o paciente" />
          </SelectTrigger>
          <SelectContent>
            {(patients ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Data</Label>
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Hora (Fortaleza)</Label>
        <Input
          type="time"
          value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Duração (min)</Label>
        <Input
          inputMode="numeric"
          value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Modalidade</Label>
        <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="presencial">Presencial</SelectItem>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Tipo</Label>
        <Select
          value={form.appointment_type}
          onValueChange={(v) => setForm({ ...form, appointment_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primeira consulta">Primeira consulta</SelectItem>
            <SelectItem value="consulta">Consulta</SelectItem>
            <SelectItem value="retorno">Retorno</SelectItem>
            <SelectItem value="check-in">Check-in</SelectItem>
            <SelectItem value="avaliação comercial">Avaliação comercial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Label className="text-xs">Observações</Label>
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" disabled={mutation.isPending}>
          Agendar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
