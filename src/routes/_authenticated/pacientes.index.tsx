import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import {
  patientSources,
  patientStatusLabel,
  patientStatusTone,
  type PatientStatus,
} from "@/lib/labels";
import { todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pacientes/")({
  head: () => ({
    meta: [
      { title: "Pacientes — Consultório de Nutrição" },
      {
        name: "description",
        content:
          "Cadastro completo de pacientes com status, origem, histórico clínico e vínculo com contratos e parcelas.",
      },
      { property: "og:title", content: "Pacientes — Consultório de Nutrição" },
      {
        property: "og:description",
        content: "Cadastro de pacientes, status e histórico integrado.",
      },
    ],
  }),
  component: PatientsPage,
});

const statusOptions = Object.keys(patientStatusLabel) as PatientStatus[];

function PatientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PatientStatus | "todos">("todos");
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, phone, email, status, entry_date, source, city")
        .order("full_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (status !== "todos" && p.status !== status) return false;
      if (!term) return true;
      return [p.full_name, p.phone, p.email, p.city]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [data, search, status]);

  return (
    <PageBody>
      <PageHeader
        title="Pacientes"
        description="Cada paciente reúne dados pessoais, registros clínicos, contratos, parcelas e consultas na mesma base."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo paciente</Button>
            </DialogTrigger>
            <NewPatientDialog onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Buscar por nome, telefone, e-mail ou cidade"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as PatientStatus | "todos")}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {patientStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum paciente encontrado"
            description={
              (data ?? []).length === 0
                ? "Cadastre o primeiro paciente para começar a registrar consultas, contratos e parcelas."
                : "Nenhum registro corresponde aos filtros aplicados. Ajuste a busca ou o status."
            }
          />
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Contato</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Origem</th>
                  <th className="px-4 py-3 font-medium">Entrada</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/pacientes/$id"
                        params={{ id: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.full_name}
                      </Link>
                      {p.city ? (
                        <span className="block text-xs text-muted-foreground">{p.city}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={patientStatusTone[p.status as PatientStatus]}>
                        {patientStatusLabel[p.status as PatientStatus]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {p.phone || p.email || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {p.source || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.entry_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageBody>
  );
}

function NewPatientDialog({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    birth_date: "",
    profession: "",
    city: "",
    source: "",
    referred_by: "",
    status: "lead" as PatientStatus,
    entry_date: todayISO(),
    notes: "",
    emergency_contact: "",
    emergency_phone: "",
    consent_accepted: false,
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

      const { error } = await supabase.from("patients").insert({
        org_id: profile.org_id,
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        birth_date: form.birth_date || null,
        profession: form.profession || null,
        city: form.city || null,
        source: form.source || null,
        referred_by: form.referred_by || null,
        status: form.status,
        entry_date: form.entry_date,
        notes: form.notes || null,
        emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null,
        consent_accepted: form.consent_accepted,
        consent_accepted_at: form.consent_accepted ? new Date().toISOString() : null,
        created_by: userData.user!.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Paciente cadastrado.");
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Novo paciente</DialogTitle>
      </DialogHeader>

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.full_name.trim()) {
            toast.error("Informe o nome completo.");
            return;
          }
          mutation.mutate();
        }}
      >
        <Field label="Nome completo" className="sm:col-span-2">
          <Input
            required
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
        <Field label="Data de nascimento">
          <Input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
          />
        </Field>
        <Field label="Profissão">
          <Input
            value={form.profession}
            onChange={(e) => setForm({ ...form, profession: e.target.value })}
          />
        </Field>
        <Field label="Cidade">
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Origem">
          <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {patientSources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
        <Field label="Status">
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as PatientStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {patientStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data de entrada">
          <Input
            type="date"
            value={form.entry_date}
            onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
          />
        </Field>
        <Field label="Contato de emergência">
          <Input
            value={form.emergency_contact}
            onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
          />
        </Field>
        <Field label="Telefone de emergência">
          <Input
            value={form.emergency_phone}
            onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
          />
        </Field>
        <Field label="Observações gerais" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.consent_accepted}
            onChange={(e) => setForm({ ...form, consent_accepted: e.target.checked })}
            className="size-4 rounded border-input"
          />
          Paciente aceitou o termo de consentimento e o uso dos dados de saúde (LGPD).
        </label>

        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            Cadastrar paciente
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
