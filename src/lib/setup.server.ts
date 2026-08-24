/**
 * Catálogo inicial do consultório (dados de configuração, não de pacientes).
 * Preços conforme a tabela informada pela nutricionista.
 */

export type PlanSeed = {
  name: string;
  line: string;
  duration_months: number;
  consultations: number;
  installment_count: number;
  installment_price: number;
  card_total: number;
  pix_price: number;
  benefits: string;
};

const premium = (extra: string) =>
  [
    "Plano alimentar personalizado e flexível",
    "Check-ins semanais",
    "Chamada de alinhamento após 15 dias",
    "Suporte direto pelo WhatsApp",
    "Ajustes ilimitados",
    extra,
    "Acesso ao aplicativo de treinos Move Health",
    "Acesso à comunidade",
    "Clube de benefícios",
  ]
    .filter(Boolean)
    .join("\n");

const essencial = [
  "Plano alimentar personalizado",
  "Check-ins semanais",
  "Suporte direto pelo WhatsApp",
  "Ajustes pontuais",
  "Acesso à comunidade",
  "Clube de benefícios",
].join("\n");

const start = (dias: number) =>
  [
    `${dias} dias de acompanhamento`,
    "Plano alimentar personalizado",
    "Check-ins quinzenais",
    "Suporte pelo WhatsApp",
    "Ajustes do plano",
    "Acesso à comunidade",
    "Clube de benefícios",
  ].join("\n");

const autonomia = [
  "Plano alimentar personalizado",
  "Revisão da evolução a cada 60 dias",
  "Suporte pelo WhatsApp",
  "Ajustes do plano quando clinicamente necessários",
  "Acesso à comunidade",
  "Clube de benefícios",
].join("\n");

export const defaultPlans: PlanSeed[] = [
  {
    name: "Premium Anual",
    line: "Premium",
    duration_months: 12,
    consultations: 12,
    installment_count: 12,
    installment_price: 248,
    card_total: 2976,
    pix_price: 2820,
    benefits: premium("1 mês de treino personalizado com a equipe da Health Group"),
  },
  {
    name: "Premium Semestral",
    line: "Premium",
    duration_months: 6,
    consultations: 6,
    installment_count: 6,
    installment_price: 275,
    card_total: 1650,
    pix_price: 1567,
    benefits: premium("1 mês de treino personalizado com a equipe da Health Group"),
  },
  {
    name: "Premium Trimestral",
    line: "Premium",
    duration_months: 3,
    consultations: 3,
    installment_count: 3,
    installment_price: 315,
    card_total: 945,
    pix_price: 897,
    benefits: premium(""),
  },
  {
    name: "Essencial Anual",
    line: "Essencial",
    duration_months: 12,
    consultations: 8,
    installment_count: 12,
    installment_price: 197,
    card_total: 2364,
    pix_price: 2197,
    benefits: essencial,
  },
  {
    name: "Essencial Semestral",
    line: "Essencial",
    duration_months: 6,
    consultations: 4,
    installment_count: 6,
    installment_price: 215,
    card_total: 1290,
    pix_price: 1197,
    benefits: essencial,
  },
  {
    name: "Essencial Trimestral",
    line: "Essencial",
    duration_months: 3,
    consultations: 2,
    installment_count: 3,
    installment_price: 247,
    card_total: 741,
    pix_price: 697,
    benefits: essencial,
  },
  {
    name: "Start Anual",
    line: "Start",
    duration_months: 12,
    consultations: 3,
    installment_count: 12,
    installment_price: 139,
    card_total: 1668,
    pix_price: 1571,
    benefits: start(365),
  },
  {
    name: "Start Semestral",
    line: "Start",
    duration_months: 6,
    consultations: 2,
    installment_count: 6,
    installment_price: 155,
    card_total: 930,
    pix_price: 873,
    benefits: start(180),
  },
  {
    name: "Start Trimestral",
    line: "Start",
    duration_months: 3,
    consultations: 1,
    installment_count: 3,
    installment_price: 183,
    card_total: 549,
    pix_price: 500,
    benefits: start(90),
  },
  {
    name: "Autonomia Anual",
    line: "Autonomia",
    duration_months: 12,
    consultations: 6,
    installment_count: 12,
    installment_price: 171,
    card_total: 2052,
    pix_price: 1944,
    benefits: autonomia,
  },
  {
    name: "Autonomia Semestral",
    line: "Autonomia",
    duration_months: 6,
    consultations: 3,
    installment_count: 6,
    installment_price: 190,
    card_total: 1140,
    pix_price: 1080,
    benefits: autonomia,
  },
];

export type AccountSeed = {
  name: string;
  account_type: "banco" | "cartao" | "dinheiro" | "outra";
  initial_balance: number;
};

export const defaultAccounts: AccountSeed[] = [
  { name: "Banco do Brasil", account_type: "banco", initial_balance: 0 },
  { name: "Nubank", account_type: "banco", initial_balance: 0 },
  { name: "Conta bancária principal", account_type: "banco", initial_balance: 0 },
  { name: "Recebimentos por cartão", account_type: "cartao", initial_balance: 0 },
  { name: "Dinheiro em espécie", account_type: "dinheiro", initial_balance: 0 },
];

export type CategorySeed = {
  name: string;
  kind: "receita" | "despesa";
  dre_group:
    | "receita_bruta"
    | "deducoes"
    | "custos_diretos"
    | "despesas_operacionais"
    | "despesas_administrativas"
    | "despesas_comerciais"
    | "despesas_equipe"
    | "impostos"
    | "outras";
};

export const defaultCategories: CategorySeed[] = [
  { name: "Consultas e planos", kind: "receita", dre_group: "receita_bruta" },
  { name: "Outras receitas", kind: "receita", dre_group: "outras" },
  { name: "Taxas de cartão e gateway", kind: "despesa", dre_group: "deducoes" },
  { name: "Materiais de atendimento", kind: "despesa", dre_group: "custos_diretos" },
  { name: "Softwares e assinaturas", kind: "despesa", dre_group: "despesas_operacionais" },
  { name: "Aluguel e condomínio", kind: "despesa", dre_group: "despesas_operacionais" },
  { name: "Contabilidade", kind: "despesa", dre_group: "despesas_administrativas" },
  { name: "Marketing e tráfego", kind: "despesa", dre_group: "despesas_comerciais" },
  { name: "Equipe e estágio", kind: "despesa", dre_group: "despesas_equipe" },
  { name: "Impostos e tributos", kind: "despesa", dre_group: "impostos" },
];
