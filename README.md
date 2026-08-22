# Nutri Hub

Quero criar um sistema integrado de gestão de consultório de nutrição para meu uso profissional.

O sistema deve reunir, em uma única plataforma, funções inspiradas em:

softwares de nutrição, como WebDiet e Dietitian;

CRM para gestão de pacientes e vendas;

planilhas financeiras de DRE e fluxo de caixa;

Asana, para tarefas, projetos, metas e indicadores;

Trello, para visualização em Kanban;

Notion, para organização de informações, documentos e processos.

Não quero apenas várias ferramentas colocadas lado a lado. Quero que os módulos compartilhem o mesmo banco de dados e estejam realmente interligados.

Objetivo principal

Centralizar a gestão clínica, comercial, financeira e estratégica do meu consultório, eliminando a necessidade de manter informações duplicadas em diferentes ferramentas.

O sistema será inicialmente usado por mim e pela minha equipe, não será um SaaS aberto ao público nesta primeira versão.

Estrutura principal do sistema

Crie uma navegação lateral com os seguintes módulos:

Dashboard

Pacientes

Agenda e consultas

Comercial e vendas

Financeiro

Tarefas e projetos

Metas, OKRs e KPIs

Documentos e processos

Relatórios

Configurações

1. Dashboard geral

Criar um painel executivo com filtros por período e os principais indicadores:

faturamento vendido;

valor efetivamente recebido;

contas a receber;

inadimplência;

despesas pagas;

resultado operacional;

saldo de caixa;

ticket médio;

número de pacientes ativos;

novos pacientes;

renovações realizadas;

renovações previstas;

taxa de renovação;

taxa de conversão de leads;

ocupação da agenda;

percentual das metas atingidas;

tarefas atrasadas;

alertas importantes.

Os indicadores devem ser clicáveis e direcionar para os registros que formam aquele resultado.

2. Cadastro e gestão de pacientes

Cada paciente deve possuir uma página individual com:

Dados pessoais

nome completo;

telefone;

e-mail;

data de nascimento;

profissão;

cidade;

origem do paciente;

indicação;

status;

data de entrada;

observações gerais;

contatos de emergência;

aceite de termos e consentimentos.

Status possíveis

lead;

avaliação comercial;

paciente ativo;

acompanhamento pausado;

acompanhamento encerrado;

ex-paciente;

inadimplente.

Informações clínicas

anamnese;

objetivo;

histórico clínico;

medicamentos;

suplementos;

exames;

restrições e preferências alimentares;

rotina;

sono;

treino;

sinais e sintomas;

evolução antropométrica;

peso;

circunferências;

composição corporal;

registros fotográficos;

metas clínicas;

estratégias definidas;

evolução em consultas;

anexos e documentos.

As informações clínicas sensíveis devem possuir permissões específicas e não podem ficar visíveis para usuários sem autorização clínica.

Histórico integrado do paciente

Na página do paciente, criar uma linha do tempo mostrando:

entrada como lead;

contatos comerciais;

consultas;

check-ins;

vendas;

contratos;

parcelas;

pagamentos;

atrasos;

renovações;

tarefas;

documentos;

alterações de status.

3. Agenda e consultas

Criar:

calendário diário, semanal e mensal;

agendamento de consultas;

diferenciação entre presencial e online;

status: agendada, confirmada, realizada, remarcada, cancelada e falta;

vínculo obrigatório com o cadastro do paciente;

campo para tipo de consulta;

duração;

profissional responsável;

observações;

lembretes;

consultas futuras;

histórico de consultas;

alerta de pacientes sem consulta futura agendada.

Quando uma consulta for realizada, permitir registrar evolução clínica e definir tarefas ou metas para o paciente.

4. Comercial e vendas

Criar um CRM com visualização em lista e Kanban.

Etapas do funil

novo lead;

contato iniciado;

qualificação;

reunião ou call agendada;

proposta enviada;

follow-up;

negociação;

venda ganha;

venda perdida;

reativação futura.

Cada oportunidade deve conter:

paciente ou lead;

origem;

responsável;

serviço ou plano oferecido;

valor;

forma de pagamento;

probabilidade de fechamento;

próxima ação;

data da próxima ação;

histórico de contatos;

motivo da perda;

observações.

Planos e vendas

Permitir cadastrar diferentes serviços e planos, com:

nome do plano;

duração;

número de consultas;

preço à vista;

preço parcelado;

número de parcelas;

descontos;

benefícios;

status ativo ou inativo.

Ao marcar uma oportunidade como “venda ganha”, o sistema deve:

criar a venda;

associar a venda ao paciente;

criar o contrato ou período de acompanhamento;

gerar as parcelas a receber;

atualizar o status do paciente;

registrar a receita na competência correta da DRE;

alimentar a previsão do fluxo de caixa;

criar tarefas de onboarding;

calcular a próxima data provável de renovação.

Não considerar uma venda parcelada como dinheiro recebido integralmente. Diferenciar claramente:

valor vendido;

receita reconhecida;

valor previsto;

valor efetivamente recebido.

5. Financeiro

O módulo financeiro deve conter:

Contas

conta bancária;

cartão;

dinheiro;

outras contas;

saldo inicial;

saldo atual.

Receitas e despesas

Cada lançamento deve possuir:

descrição;

categoria;

subcategoria;

centro de custo;

paciente relacionado, quando aplicável;

venda relacionada;

fornecedor;

competência;

data de vencimento;

data de pagamento ou recebimento;

valor previsto;

valor realizado;

conta financeira;

forma de pagamento;

status;

recorrência;

anexos;

observações.

Status financeiros

previsto;

pendente;

recebido;

pago;

parcialmente recebido;

parcialmente pago;

vencido;

cancelado;

estornado.

Fluxo de caixa

Criar visão diária, semanal, mensal e anual, mostrando:

saldo inicial;

entradas previstas;

entradas realizadas;

saídas previstas;

saídas realizadas;

saldo projetado;

saldo realizado;

contas vencidas;

comparação entre previsto e realizado.

O fluxo de caixa deve utilizar a data em que o dinheiro efetivamente entra ou sai.

DRE gerencial

Criar DRE mensal e anual usando regime de competência, com estrutura configurável:

receita bruta;

deduções e estornos;

receita líquida;

custos diretamente ligados ao serviço;

margem de contribuição;

despesas operacionais;

despesas administrativas;

despesas comerciais e marketing;

despesas com equipe;

impostos;

resultado operacional;

outras receitas e despesas;

resultado líquido.

Permitir:

comparação entre meses;

comparação realizado versus meta;

análise vertical;

análise horizontal;

filtros por categoria e centro de custo;

detalhamento dos lançamentos ao clicar em qualquer valor;

exportação em CSV e PDF.

Nunca misturar automaticamente regime de caixa com regime de competência.

6. Integração entre pacientes, vendas e financeiro

Esta é uma regra central do projeto.

O sistema deve utilizar registros únicos e relacionados. Não duplicar manualmente a mesma informação em diferentes módulos.

Exemplos:

uma venda pertence a um paciente;

uma venda pode gerar várias parcelas;

cada parcela tem vencimento e status próprios;

o pagamento de uma parcela gera uma entrada no fluxo de caixa;

a receita entra na DRE conforme a competência definida;

cancelamentos, descontos, estornos e inadimplência devem refletir corretamente nos relatórios;

a página do paciente deve mostrar sua situação financeira;

o financeiro deve permitir abrir o cadastro do paciente relacionado;

a renovação deve gerar uma nova venda, sem apagar o histórico anterior.

Criar regras claras para:

pagamento à vista;

parcelamento;

entrada mais parcelas;

desconto;

pagamento parcial;

atraso;

renegociação;

cancelamento;

estorno;

cortesia;

permuta;

renovação antecipada.

7. Tarefas e projetos

Criar gestão de tarefas com visualizações em:

lista;

Kanban;

calendário;

tarefas por projeto;

tarefas por responsável;

tarefas relacionadas a pacientes.

Cada tarefa deve conter:

título;

descrição;

responsável;

projeto;

paciente relacionado, quando aplicável;

prioridade;

status;

prazo;

recorrência;

checklist;

anexos;

comentários;

etiquetas;

dependências.

Status sugeridos:

caixa de entrada;

a fazer;

em andamento;

aguardando;

concluída;

cancelada.

Criar projetos para áreas como:

atendimento;

marketing;

comercial;

financeiro;

experiência do paciente;

processos internos;

desenvolvimento de produtos.

8. OKRs, metas e KPIs

Permitir cadastrar:

objetivos;

resultados-chave;

metas numéricas;

indicadores;

período;

responsável;

valor inicial;

valor atual;

valor-alvo;

unidade de medida;

frequência de atualização;

projetos e tarefas relacionados.

Sempre que possível, os indicadores devem ser atualizados automaticamente pelos dados do sistema.

Exemplos:

faturamento mensal;

receita recebida;

ticket médio;

número de pacientes ativos;

taxa de renovação;

taxa de conversão;

inadimplência;

número de indicações;

ocupação da agenda;

cumprimento das metas financeiras.

Não calcular indicadores usando dados inconsistentes ou períodos diferentes.

9. Documentos, processos e conhecimento

Criar uma área semelhante a uma base de conhecimento, com:

páginas;

pastas;

documentos;

protocolos;

checklists;

procedimentos operacionais;

modelos de mensagens;

materiais para pacientes;

links;

anexos;

etiquetas;

busca.

Permitir relacionar documentos a:

pacientes;

projetos;

tarefas;

consultas;

processos internos.

10. Relatórios

Criar relatórios com filtros por período, paciente, profissional, plano, origem, categoria e status.

Relatórios prioritários:

pacientes ativos e inativos;

pacientes por plano;

acompanhamento próximo do vencimento;

renovações previstas;

vendas por período;

vendas por origem;

taxa de conversão;

contas a receber;

inadimplência;

receita por paciente;

receita por plano;

DRE;

fluxo de caixa;

evolução de metas;

produtividade e tarefas.

Usuários e permissões

Criar autenticação e controle por perfil:

administrador;

nutricionista;

atendimento/secretaria;

financeiro;

estagiário.

Cada perfil deve visualizar apenas as informações necessárias.

Informações clínicas, documentos pessoais e dados financeiros devem possuir permissões independentes.

Implementar Row Level Security em todas as tabelas. Nenhum usuário pode acessar registros fora da organização ou informações para as quais não tenha permissão.

Registrar um log de auditoria para alterações importantes, especialmente em:

informações clínicas;

pagamentos;

vendas;

exclusões;

cancelamentos;

permissões.

Proteção de dados

O sistema lidará com dados pessoais e dados sensíveis de saúde.

Considere desde o início:

LGPD;

princípio do menor acesso;

consentimento;

trilha de auditoria;

proteção de documentos;

políticas de retenção;

possibilidade de exportação dos dados do paciente;

anonimização ou exclusão quando aplicável;

backups;

segurança de autenticação.

Não use dados reais de pacientes durante o desenvolvimento. Utilize apenas dados fictícios.

Requisitos de interface

Idioma: português do Brasil.

Padrões:

moeda em real brasileiro;

datas no formato DD/MM/AAAA;

horário de Fortaleza;

interface responsiva;

prioridade para uso em desktop, mas com boa experiência no celular;

navegação simples;

filtros persistentes;

busca global;

tabelas com ordenação, filtros e exportação;

estados vazios bem explicados;

confirmação antes de ações destrutivas;

mensagens claras de erro e sucesso.

Identidade visual:

aparência premium, profissional e minimalista;

verde-escuro, verde-sálvia, creme e tons neutros;

bastante espaço em branco;

tipografia limpa;

sem excesso de cores;

sem aparência infantil;

gráficos profissionais;

cards apenas quando agregarem clareza;

evitar dashboards poluídos.

Arquitetura esperada

Utilize o backend nativo do Lovable ou Supabase, com:

banco PostgreSQL;

autenticação;

storage seguro;

Row Level Security;

relacionamentos consistentes;

chaves estrangeiras;

índices;

validações;

logs de auditoria;

funções de backend para regras financeiras críticas.

Cálculos financeiros importantes não devem depender apenas do frontend.

Forma de trabalho

Não comece a construir o aplicativo agora.

Primeiro, trabalhe em modo de planejamento e entregue:

análise crítica do escopo;

definição do MVP;

funcionalidades que devem ficar para versões futuras;

mapa dos módulos;

fluxos principais do usuário;

modelo inicial do banco de dados;

relacionamentos entre as tabelas;

regras financeiras detalhadas;

regras de permissão;

riscos técnicos e de segurança;

plano de implementação dividido em fases pequenas e testáveis;

critérios de aceite de cada fase.

A primeira versão deve priorizar:

autenticação e permissões;

cadastro de pacientes;

planos e contratos;

CRM de vendas;

geração de parcelas;

recebimentos;

fluxo de caixa;

DRE;

dashboard essencial.

Tarefas, OKRs, base de conhecimento, prescrição nutricional completa e automações avançadas devem ser avaliadas para fases posteriores.

Antes de propor o plano final, faça todas as perguntas necessárias para eliminar ambiguidades sobre meu funcionamento clínico, comercial e financeiro.

Não implemente funcionalidades apenas para parecerem prontas. Cada função incluída no MVP deve possuir banco de dados, regras de negócio, estados, permissões, validação e critérios de teste.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3da0321a-6d64-4a8e-adbb-1477700ca079).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
