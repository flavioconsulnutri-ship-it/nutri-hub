/** Auxiliares de relatório (servidor). */
export function countBusinessDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  let count = 0;
  for (let t = start; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count || 1;
}

export function dreLabel(group: string): string {
  const map: Record<string, string> = {
    despesas_operacionais: "Despesas operacionais",
    despesas_administrativas: "Despesas administrativas",
    despesas_comerciais: "Despesas comerciais e marketing",
    despesas_equipe: "Despesas com equipe",
    impostos: "Impostos",
  };
  return map[group] ?? group;
}
