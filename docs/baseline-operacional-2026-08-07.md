# Linha de base operacional e financeira — 2026-08-07

> **Por que este arquivo existe.** O roadmap de indicadores vai mexer em
> contas a receber, custo congelado, identidade do cliente e baixa de estoque.
> Cada uma dessas mudanças altera números que hoje ninguém anotou. Este é o
> retrato do "antes".
>
> Medido em **2026-08-07** contra o banco de produção `lbxwclwzeqqtnwvlxsxs`,
> em **leitura pura** — nada foi alterado. Cada número tem, ao lado, o arquivo
> em [`docs/sql/`](sql/) que o produziu; rode e confira.
>
> **Camboriú e Itapema aparecem sempre separadas.** São operações com mix,
> ticket e disciplina de registro diferentes — a média das duas não descreve
> nenhuma delas. A **Aquamotor é outra empresa** e só entra onde está dito.

---

## Resumo em uma tela

| | Camboriú | Itapema |
|---|---|---|
| Orçamentos | 214 | 61 |
| Taxa de aprovação | **29,0%** | **42,6%** |
| Ticket médio (todos) | R$ 12.286 | R$ 3.642 |
| Ticket médio (aprovados) | R$ 2.567 | R$ 1.822 |
| Valor aprovado | R$ 159.141 | R$ 47.367 |
| Valor em aberto | **R$ 2.201.380** | R$ 104.869 |
| Recebimento registrado | **28,1%** | **98,4%** |
| Valor parado em estoque | R$ 84.014 | R$ 40.225 |
| Ordens de serviço | 20 | 6 |

São dois negócios diferentes rodando no mesmo sistema. Itapema vende barato,
fecha bastante e registra quase tudo. Camboriú vende caro, fecha pouco e
registra menos de um terço. Nenhum indicador único serve para as duas.

---

## 1. Funil

`docs/sql/orcamentos-por-status-e-loja.sql` · `orcamentos-taxa-aprovacao-por-loja.sql`

| Status | Camboriú (qtd / valor) | Itapema (qtd / valor) |
|---|---|---|
| Vencido | 139 · R$ 2.044.582 | 24 · R$ 102.689 |
| Aprovado | 62 · R$ 159.141 | 26 · R$ 47.367 |
| Recusado | 5 · R$ 268.752 | 10 · R$ 69.936 |
| Pendente | 8 · R$ 156.799 | 1 · R$ 2.180 |

**O ticket do que vence é 5,7× o ticket do que aprova, em Camboriú**
(R$ 14.709 contra R$ 2.567). Não é que a unidade venda mal — é que ela vende
duas coisas distintas: serviço pequeno, que fecha, e equipamento caro, que
trava. O valor em aberto de R$ 2,2 milhões é quase todo do segundo grupo.

Itapema tem o mesmo padrão em escala menor e menos desequilibrado: vencido a
R$ 4.279 de ticket contra R$ 1.822 do aprovado.

**Recusado é raro nas duas (15 no total).** O cliente não diz não — ele para de
responder e o orçamento vence sozinho. É por isso que "vencido" não pode ser
lido como perdido, e é a premissa da fila de follow-up.

### Idade do que está aberto

`docs/sql/orcamentos-em-aberto-por-idade.sql`

| | Camboriú | Itapema |
|---|---|---|
| Orçamentos abertos | 147 | 25 |
| Idade média | 64 dias | 34 dias |
| Com mais de 30 dias | 111 | 11 |
| Valor com mais de 30 dias | **R$ 1.393.281** | R$ 73.010 |

R$ 1,39 milhão parado há mais de um mês em Camboriú. Nessa idade o preço
provavelmente já não vale — cobrar sem refazer é oferecer um número que a
empresa não pratica mais.

## 2. Prazos

`docs/sql/tempo-criacao-ate-aprovacao.sql`

| | Camboriú | Itapema |
|---|---|---|
| Casos mensuráveis | 20 | 15 |
| Mediana | **0,1 dia** | **0,2 dia** |
| Média | 5,2 dias | 3,3 dias |
| Fecharam em até 1 dia | 14 de 20 | 9 de 15 |
| Fecharam depois da validade (5 dias) | 3 | 5 |
| Maior prazo | 65 dias | 13,7 dias |

**Quem vai comprar, compra no mesmo dia.** A média só é maior que a mediana por
causa de poucos casos longos — e são justamente esses que a validade de 5 dias
matava antes da mudança. Dos 35 casos mensuráveis, **8 fecharam depois do prazo
de validade**: existe dinheiro depois do dia 5.

⚠️ **Só 35 dos 88 aprovados entram nesta conta.** Nos outros 53,
`data_aprovacao` foi preenchida igual a `data_criacao` pelo backfill de
`_migrarDataAprovacao()` em `app.js`. Incluí-los faria parecer que tudo fecha
instantaneamente — seria medir a migração, não o cliente.

### Aprovação → ordem de serviço

`docs/sql/tempo-aprovacao-ate-os.sql` — Camboriú: 5 casos, mediana 0,3 dia.
Itapema: 3 casos, mediana 0,0. **Só 12 das 118 OS guardam `orcamento_id`**, e
por isso este número descreve 8 casos, não a operação. É estimativa fraca, e
está aqui para não sumir quando o vínculo melhorar.

## 3. Dinheiro que entrou

`docs/sql/faturamento-mensal-por-loja.sql` · `recebimento-registrado.sql`

| Mês | Camboriú aprovado | Camboriú recebido | Itapema aprovado | Itapema recebido |
|---|---|---|---|---|
| 2026-08 | R$ 16.371 | R$ 342 | R$ 734 | R$ 0 |
| 2026-07 | R$ 45.981 | R$ 17.638 | R$ 43.775 | R$ 43.775 |
| 2026-06 | R$ 32.354 | R$ 25.672 | R$ 2.820 | R$ 2.820 |
| 2026-05 | R$ 58.198 | **R$ 0** | — | — |
| 2026-04 | R$ 6.237 | R$ 1.000 | R$ 38 | R$ 0 |

A série tem **5 meses porque o sistema entrou em uso em abril/2026** — não é o
começo da operação, é o começo do registro.

| | Camboriú | Itapema |
|---|---|---|
| Aprovados | 62 | 26 |
| Valor aprovado | R$ 159.141 | R$ 47.367 |
| Valor com recebimento registrado | R$ 44.651 | R$ 46.595 |
| **% registrado** | **28,1%** | **98,4%** |
| Orçamentos com algum registro | 22 de 62 | 24 de 26 |
| Quitados | 17 | 24 |

**Essa diferença é de processo, não de caixa.** Itapema lança o recebimento;
Camboriú não. Maio de 2026 é o caso extremo: R$ 58.198 aprovados e R$ 0
registrados — o dinheiro entrou, o lançamento não. Enquanto for assim, nenhum
relatório financeiro de Camboriú é confiável, e o problema não se resolve com
fórmula: só com a rotina de dar baixa.

A tabela `recebimentos` (criada pela Sessão A) **está com 0 linhas**. Até ela
ser povoada, o controle continua sendo o campo único `valor_recebido` no
orçamento, que não guarda parcela, data nem forma de pagamento.

`despesas` **está vazia** — não há nenhum lançamento. Não existe base para
margem, custo por serviço ou resultado por unidade hoje.

## 4. Execução

`docs/sql/os-por-loja-e-status.sql` · `os-cobertura-campos-execucao.sql` · `os-por-tecnico.sql`

| | Camboriú | Itapema | Aquamotor |
|---|---|---|---|
| OS | 20 | 6 | 92 |
| Ligadas a orçamento | 8 | 4 | 0 |
| Valor | R$ 66.956 | R$ 11.204 | R$ 0 |

As 92 OS da Aquamotor são **manutenção recorrente agendada** — total zero, data
de serviço no futuro (há registros até dezembro/2026). São compromissos de
agenda, não trabalho realizado. Somá-las multiplica o volume por quatro sem
corresponder a nada executado.

**Os campos de execução estão vazios nas 118 OS:**

| Campo | Preenchido |
|---|---|
| `duracao_min` | **0** |
| `checkin_time` | **0** |
| `checkout_time` | **0** |
| `tecnico` | 4 |
| `obs_tecnica` | 103 |
| `fotos` | 1 |

**Duração média por técnico não pode ser calculada** — não é que os serviços
sejam rápidos, é que ninguém marca. O mesmo vale para produtividade, tempo por
tipo de serviço e comparação entre técnicos: são indicadores sem lastro hoje.

O contraste com `obs_tecnica` (103 de 118) diz o essencial: **a equipe registra
o que considera útil.** O check-in não entrou na rotina, ou não faz sentido para
ela. Antes de cobrar preenchimento, vale perguntar por quê.

Há **1 OS com status `concluido`** em toda a base (nº 72, Condominio Carrara).
Todas as outras 117 estão em `agendado`. Ou o fechamento não é usado, ou é feito
fora do sistema — de todo modo, "OS concluídas" não é um indicador disponível.

> ⚠️ O status é `concluido`, masculino. Consultar por `'concluida'` devolve zero
> e passa despercebido.

## 5. Estoque

`docs/sql/estoque-saldo-e-giro-por-loja.sql`

| | Camboriú | Itapema |
|---|---|---|
| Produtos com movimento | 180 | 128 |
| Com saldo positivo | 149 | 114 |
| **Valor parado** | **R$ 84.014** | **R$ 40.225** |
| Sem giro há 90 dias | 121 itens | 98 itens |
| **Valor sem giro** | **R$ 62.858 (74,8%)** | **R$ 29.393 (73,1%)** |
| Itens com custo zero | 12 | 24 |
| Saldo negativo | 2 itens (−2 un) | 1 item (−1 un) |
| Reserva legada em aberto | 21 un | 158 un |

**R$ 124.239 parados, dos quais R$ 92.251 (74%) não giram há 90 dias.** Nas duas
unidades a proporção é praticamente a mesma — é padrão de compra, não
particularidade de uma loja.

O valor parado é **piso, não estimativa**: 36 itens com saldo estão com custo
zero cadastrado e entram na conta valendo nada.

**Os saldos negativos praticamente zeraram** (3 unidades no total). O bug de
reconciliação sobre cache velho, que levava a reserva a −186, está corrigido.
As 179 unidades de reserva legada (21 + 158) são material já entregue esperando
a conferência da equipe.

### Quanto da venda consegue dar baixa

`docs/sql/estoque-cobertura-produto-id.sql`

| | Camboriú | Itapema |
|---|---|---|
| Itens vendidos (todos) | 13,1% com `produto_id` | 24,5% |
| **Itens vendidos (aprovados)** | **24,3%** | **47,2%** |

Desde agosto/2026 aprovar um orçamento dá baixa direta no estoque. Mas a baixa
só enxerga item com `produto_id` — **três quartos do que Camboriú aprova não
move estoque nenhum**, porque foi digitado como texto livre.

**Consequência prática:** o estoque vai continuar não batendo, e agora por um
motivo diferente do bug anterior. Não é erro de cálculo, é item que nunca entrou
na conta. Melhorar essa cobertura vale mais do que qualquer ajuste na fórmula de
saldo.

## 6. Vistoria que não vira proposta

`docs/sql/vistorias-viraram-orcamento.sql`

Existem **7 vistorias** na base (4 Aquamotor, 3 Camboriú). **Nenhuma foi seguida
de um orçamento para o mesmo cliente.**

O número é pequeno demais para virar taxa, e três das vistorias são de
2026-08-05 — cedo para cobrar conversão. Mas o zero absoluto merece
acompanhamento: a visita técnica é o custo já pago, e o laudo é o melhor
argumento de venda que a empresa produz.

⚠️ A ligação é feita **por nome**, porque não há chave entre as tabelas. Se o
nome foi escrito diferente no orçamento, a consulta conta zero mesmo tendo
havido proposta. O número é um **piso do vazamento**, e só vira medida exata
quando `cliente_id` existir nas duas pontas — o que depende do relatório de
deduplicação (`docs/dedup-clientes-2026-08-07.md`).

---

## O que este retrato diz sobre o roadmap

1. **Contas a receber (1.1) é a prioridade certa, mas o gargalo é rotina.**
   A tabela nova resolve parcela e data; não resolve Camboriú registrar 28% do
   que recebe. Vale desenhar a baixa para acontecer no fluxo, não numa tela
   separada — do mesmo jeito que a conferência de estoque foi.
2. **Cobertura de `produto_id` (2.2) vale mais que custo congelado (2.1).**
   Congelar custo de 24% dos itens dá um custo congelado de 24% da venda.
3. **Indicador de produtividade técnica não é viável agora.** Três campos em
   zero. Ou o check-in entra na rotina, ou o indicador sai do roadmap — medir
   pela metade é pior que não medir.
4. **Despesas vazia significa que não há margem calculável.** Qualquer painel
   de resultado por unidade hoje mostraria receita, não lucro.
5. **A Aquamotor distorce todo agregado.** 92 das 118 OS e 22 orçamentos sem
   nenhuma aprovação. Todo número apresentado à Fortemp precisa de
   `loja_id LIKE 'fortemp%'`, e todo número apresentado à Aquamotor precisa ser
   lido sabendo que ela usa o sistema só para agendar.
