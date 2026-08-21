/**
 * Regras financeiras puras (servidor).
 * Todos os valores em centavos internamente para evitar erro de arredondamento.
 */

export function toCents(value: number): number {
  return Math.round(Number(value || 0) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Divide um total em N partes iguais; a diferença de arredondamento vai para a última parcela. */
export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const out = Array.from({ length: parts }, () => base);
  const rest = totalCents - base * parts;
  out[parts - 1] = (out[parts - 1] ?? 0) + rest;
  return out;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const base = new Date(Date.UTC(y!, m! - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d!, lastDay);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(
    day,
  ).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d! + days));
  return base.toISOString().slice(0, 10);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export type InstallmentPlan = {
  installment_number: number;
  installment_total: number;
  due_date: string;
  expected_amount: number;
};

/**
 * Monta as parcelas a receber.
 * - À vista (installments <= 1): uma parcela na data da venda.
 * - Entrada + parcelas: a entrada vira a parcela 1 na data da venda e o saldo é
 *   dividido nas parcelas seguintes, com vencimento mensal.
 */
export function buildInstallments(params: {
  netAmountCents: number;
  installments: number;
  downPaymentCents: number;
  saleDate: string;
}): InstallmentPlan[] {
  const { netAmountCents, saleDate } = params;
  const down = Math.max(0, Math.min(params.downPaymentCents, netAmountCents));
  const remaining = netAmountCents - down;

  if (down > 0) {
    const rest = Math.max(0, params.installments - 1);
    if (rest === 0 || remaining === 0) {
      return [
        {
          installment_number: 1,
          installment_total: 1,
          due_date: saleDate,
          expected_amount: fromCents(netAmountCents),
        },
      ];
    }
    const parts = splitCents(remaining, rest);
    return [
      {
        installment_number: 1,
        installment_total: rest + 1,
        due_date: saleDate,
        expected_amount: fromCents(down),
      },
      ...parts.map((cents, i) => ({
        installment_number: i + 2,
        installment_total: rest + 1,
        due_date: addMonths(saleDate, i + 1),
        expected_amount: fromCents(cents),
      })),
    ];
  }

  const count = Math.max(1, params.installments);
  if (count === 1) {
    return [
      {
        installment_number: 1,
        installment_total: 1,
        due_date: saleDate,
        expected_amount: fromCents(netAmountCents),
      },
    ];
  }
  return splitCents(netAmountCents, count).map((cents, i) => ({
    installment_number: i + 1,
    installment_total: count,
    due_date: addMonths(saleDate, i),
    expected_amount: fromCents(cents),
  }));
}

export type RecognitionRow = {
  competence_date: string;
  gross_amount: number;
  deduction_amount: number;
};

/**
 * Reconhecimento de receita por competência (regime de competência):
 * o preço de tabela é rateado igualmente pelos meses do plano e o desconto
 * concedido é rateado como dedução da receita bruta.
 * Independe totalmente da forma de pagamento e das datas de recebimento.
 */
export function buildRecognition(params: {
  listAmountCents: number;
  discountCents: number;
  months: number;
  startDate: string;
}): RecognitionRow[] {
  const months = Math.max(1, params.months);
  const gross = splitCents(params.listAmountCents, months);
  const deductions = splitCents(Math.max(0, params.discountCents), months);
  return gross.map((cents, i) => ({
    competence_date: monthStart(addMonths(params.startDate, i)),
    gross_amount: fromCents(cents),
    deduction_amount: fromCents(deductions[i] ?? 0),
  }));
}

/** Preço de tabela do plano conforme a forma de pagamento escolhida. */
export function listPriceForMethod(
  plan: { card_total: number; pix_price: number },
  method: string,
): { listCents: number; chargedCents: number } {
  const card = toCents(Number(plan.card_total));
  const pix = toCents(Number(plan.pix_price));
  const isCash = method !== "cartao_credito";
  return { listCents: card, chargedCents: isCash ? pix : card };
}
