import type { Database } from "@/integrations/supabase/types";

export type PatientStatus = Database["public"]["Enums"]["patient_status"];
export type FunnelStage = Database["public"]["Enums"]["funnel_stage"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ReceivableStatus = Database["public"]["Enums"]["receivable_status"];
export type PayableStatus = Database["public"]["Enums"]["payable_status"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type DreGroup = Database["public"]["Enums"]["dre_group"];

export const patientStatusLabel: Record<PatientStatus, string> = {
  lead: "Lead",
  avaliacao_comercial: "Avaliação comercial",
  ativo: "Paciente ativo",
  pausado: "Acompanhamento pausado",
  encerrado: "Acompanhamento encerrado",
  ex_paciente: "Ex-paciente",
  inadimplente: "Inadimplente",
};

export const patientStatusTone: Record<PatientStatus, string> = {
  lead: "bg-muted text-muted-foreground",
  avaliacao_comercial: "bg-info/15 text-info",
  ativo: "bg-success/15 text-success",
  pausado: "bg-warning/20 text-warning-foreground",
  encerrado: "bg-muted text-muted-foreground",
  ex_paciente: "bg-muted text-muted-foreground",
  inadimplente: "bg-destructive/15 text-destructive",
};

export const funnelStages: FunnelStage[] = [
  "novo_lead",
  "contato_iniciado",
  "qualificacao",
  "reuniao_agendada",
  "proposta_enviada",
  "follow_up",
  "negociacao",
  "ganha",
  "perdida",
  "reativacao_futura",
];

export const funnelStageLabel: Record<FunnelStage, string> = {
  novo_lead: "Novo lead",
  contato_iniciado: "Contato iniciado",
  qualificacao: "Qualificação",
  reuniao_agendada: "Reunião agendada",
  proposta_enviada: "Proposta enviada",
  follow_up: "Follow-up",
  negociacao: "Negociação",
  ganha: "Venda ganha",
  perdida: "Venda perdida",
  reativacao_futura: "Reativação futura",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  transferencia: "Transferência",
  cortesia: "Cortesia",
  permuta: "Permuta",
};

export const receivableStatusLabel: Record<ReceivableStatus, string> = {
  previsto: "Previsto",
  pendente: "Pendente",
  parcialmente_recebido: "Parcialmente recebido",
  recebido: "Recebido",
  vencido: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export const receivableStatusTone: Record<ReceivableStatus, string> = {
  previsto: "bg-muted text-muted-foreground",
  pendente: "bg-info/15 text-info",
  parcialmente_recebido: "bg-warning/20 text-warning-foreground",
  recebido: "bg-success/15 text-success",
  vencido: "bg-destructive/15 text-destructive",
  cancelado: "bg-muted text-muted-foreground",
  estornado: "bg-muted text-muted-foreground",
};

export const payableStatusLabel: Record<PayableStatus, string> = {
  previsto: "Previsto",
  pendente: "Pendente",
  parcialmente_pago: "Parcialmente pago",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  remarcada: "Remarcada",
  cancelada: "Cancelada",
  falta: "Falta",
};

export const appointmentStatusTone: Record<AppointmentStatus, string> = {
  agendada: "bg-info/15 text-info",
  confirmada: "bg-accent text-accent-foreground",
  realizada: "bg-success/15 text-success",
  remarcada: "bg-warning/20 text-warning-foreground",
  cancelada: "bg-muted text-muted-foreground",
  falta: "bg-destructive/15 text-destructive",
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  nutricionista: "Nutricionista",
  atendimento: "Atendimento",
  financeiro: "Financeiro",
  estagiario: "Estagiário",
};

export const dreGroupLabel: Record<DreGroup, string> = {
  receita_bruta: "Receita bruta",
  deducoes: "Deduções e estornos",
  custos_diretos: "Custos diretos do serviço",
  despesas_operacionais: "Despesas operacionais",
  despesas_administrativas: "Despesas administrativas",
  despesas_comerciais: "Despesas comerciais e marketing",
  despesas_equipe: "Despesas com equipe",
  impostos: "Impostos",
  outras: "Outras receitas e despesas",
};

export const patientSources = [
  "Instagram",
  "Indicação",
  "Google",
  "WhatsApp",
  "Parceria",
  "Retorno",
  "Outro",
];
