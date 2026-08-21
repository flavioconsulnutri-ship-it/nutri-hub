# Sistema de Gestão do Consultório — Plano

## 1. Análise crítica do escopo

O escopo completo equivale a 4 produtos (clínico, CRM, ERP financeiro, produtividade). Construir tudo de uma vez produziria telas bonitas sem regra de negócio — exatamente o que você pediu para evitar. Pontos de atenção:

- **O coração do sistema é a cadeia venda → contrato → parcelas → recebimento → caixa/DRE.** Se essa cadeia estiver correta, o resto é interface.
- **Caixa e competência precisam ser dois campos independentes** em cada lançamento (`data_competencia` e `data_liquidacao`). Nunca derivar um do outro.
- **Receita rateada** (sua escolha): um Premium Anual de R$ 2.976 (12x248) reconhece R$ 248/mês na DRE por 12 meses, independentemente de o paciente pagar tudo no Pix hoje. O Pix de R$ 2.820 entra 100% no caixa em D0 e gera **receita diferida** que vai sendo apropriada mês a mês. O desconto Pix (R$ 156) é dedução da receita bruta, rateada igualmente.
- **Prescrição nutricional completa (tabelas TACO/USDA, cálculo de macros, montagem de plano alimentar) fica fora.** É um produto inteiro e não afeta gestão. No MVP, o plano alimentar é um anexo/documento.
- **Notion/Asana/Trello completos ficam fora do MVP** — só Kanban de vendas (que é regra de negócio, não produtividade).
- Equipe = você + estagiária → 2 perfis reais no MVP (`admin`, `estagiario`), com a estrutura de roles já preparada para os outros 3.

## 2. MVP (o que será construído)

1. Autenticação + papéis + RLS + auditoria
2. Pacientes (dados pessoais, status, timeline integrada) e ficha clínica básica (anamnese, objetivo, antropometria evolutiva)
3. Catálogo de planos (os 12 planos: Premium/Essencial/Start/Autonomia × 3/6/12 meses, com preço cartão e preço Pix)
4. CRM: funil Kanban + lista, oportunidades
5. Venda ganha → contrato + parcelas + receita diferida + status do paciente + data prevista de renovação (em função de backend, não do frontend)
6. Financeiro: contas, lançamentos, baixa de parcelas, pagamento parcial, atraso, desconto, estorno, cancelamento
7. Fluxo de caixa (regime de caixa) diário/mensal
8. DRE gerencial mensal e anual (regime de competência, rateado)
9. Agenda e consultas (dia/semana/mês, status, alerta de paciente sem consulta futura)
10. Dashboard executivo com indicadores clicáveis

## 3. Fases futuras

Fase 5: Tarefas/projetos (Kanban+lista+calendário) · Fase 6: OKRs/KPIs automáticos · Fase 7: Base de conhecimento e documentos · Fase 8: Relatórios avançados, exportação PDF, permuta/cortesia/renegociação, lembretes automáticos de WhatsApp, prescrição nutricional.

## 4. Mapa dos módulos

```text
Dashboard ─┬─ Pacientes ──── Agenda/Consultas
           ├─ Comercial (funil, planos, vendas)
           ├─ Financeiro (contas, lançamentos, caixa, DRE)
           └─ Configurações (usuários, categorias, DRE)
    tudo ligado por paciente_id / venda_id / contrato_id
```

## 5. Fluxos principais

- **Lead → paciente**: lead entra no funil → oportunidade → venda ganha → contrato + parcelas → status "paciente ativo" → primeira consulta agendada.
- **Recebimento**: parcela vence → baixa (total/parcial) → lançamento no caixa → DRE inalterada (a competência já estava rateada).
- **Renovação**: contrato próximo do fim aparece em "renovações previstas" → nova venda → novo contrato, histórico preservado.
- **Consulta realizada**: registra evolução + antropometria + próximos passos na timeline do paciente.

## 6. Modelo inicial do banco

`organizations`, `profiles`, `user_roles` (tabela separada + `has_role()` security definer), `audit_log`

Clínico: `patients`, `patient_status_history`, `clinical_records` (anamnese/evolução), `anthropometry`, `attachments`

Comercial: `plans`, `opportunities`, `opportunity_activities`, `sales`, `contracts`

Financeiro: `financial_accounts`, `categories` (com `dre_group`), `cost_centers`, `receivables` (parcelas), `payables`, `transactions` (movimento de caixa), `revenue_recognition` (rateio por competência)

Agenda: `appointments`

Relações-chave: `sales.patient_id`, `contracts.sale_id`, `receivables.contract_id`, `transactions.receivable_id`, `revenue_recognition.contract_id` + `competencia (date)`. FKs, índices em `(org_id, data)`, e RLS por organização em todas as tabelas.

## 7. Regras financeiras detalhadas

| Situação | Caixa | Competência (DRE) |
|---|---|---|
| Pix à vista | entrada total em D0 | receita rateada nos N meses; desconto Pix como dedução rateada |
| 12x cartão | entrada por parcela na data de liquidação | receita rateada nos N meses |
| Entrada + parcelas | conforme cada liquidação | rateio inalterado |
| Pagamento parcial | entra o valor pago; saldo continua em aberto | inalterada |
| Atraso | nada no caixa; parcela vira `vencido`, paciente pode virar `inadimplente` | inalterada |
| Cancelamento | parcelas futuras canceladas | receita futura não reconhecida |
| Estorno | saída no caixa | dedução no mês do estorno |

Todo cálculo (geração de parcelas, rateio, baixa, saldo) roda em **server functions/SQL**, nunca no frontend. `valor_vendido ≠ receita_reconhecida ≠ previsto ≠ recebido` — quatro medidas distintas no dashboard.

## 8. Permissões

- `admin`: tudo.
- `estagiario`: pacientes e agenda (leitura + evolução clínica), **sem** acesso a financeiro, valores de venda e documentos pessoais.
- Estrutura pronta para `nutricionista`, `atendimento`, `financeiro`.
- Dados clínicos e financeiros com políticas independentes; auditoria em alterações clínicas, pagamentos, vendas, exclusões e permissões.

## 9. Riscos

- **Rateio de receita** é a regra mais delicada — será validada com testes numéricos antes de seguir.
- **Vazamento de dado sensível de saúde** → RLS + coluna clínica separada da tabela de pacientes.
- **Divergência caixa vs. competência** → dois campos, nunca inferidos.
- Volume de telas → priorização rígida por fase.

## 10. Fases de implementação e critérios de aceite

**Fase 0 — Design system + shell** (verde-escuro, sálvia, creme, pt-BR, R$, DD/MM/AAAA, fuso Fortaleza). *Aceite*: navegação lateral com os 10 módulos, layout responsivo, tipografia limpa.

**Fase 1 — Backend base + auth + RLS**. *Aceite*: login funcional, papéis, `has_role()`, auditoria gravando, nenhuma tabela acessível sem política.

**Fase 2 — Pacientes**. *Aceite*: CRUD, status, ficha clínica, antropometria com gráfico, timeline, estagiária não vê financeiro.

**Fase 3 — Planos + CRM**. *Aceite*: 12 planos cadastrados com preço cartão/Pix, funil Kanban com drag, oportunidade completa.

**Fase 4 — Venda ganha → contrato → parcelas → rateio**. *Aceite*: Premium Anual gera 12 parcelas de R$ 248 e 12 competências de receita; Pix gera 1 entrada + 12 competências; testes numéricos batendo ao centavo.

**Fase 5 — Financeiro + caixa + DRE**. *Aceite*: baixa total/parcial, atraso, estorno; caixa fecha com saldo das contas; DRE mensal/anual com drill-down e CSV.

**Fase 6 — Agenda**. *Aceite*: 3 visões, status, vínculo obrigatório com paciente, alerta de paciente sem consulta futura.

**Fase 7 — Dashboard**. *Aceite*: todos os indicadores conferindo com os relatórios de origem e clicáveis.

Dados fictícios apenas durante todo o desenvolvimento.
