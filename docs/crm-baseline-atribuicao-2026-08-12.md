# Linha de base — atribuição, antes da Etapa 1 (venda de balcão)

> **Por que este arquivo existe.** A Etapa 1 do roadmap de CRM (venda de
> balcão como transação própria, `vendas_balcao`) muda como parte da receita
> é registrada e pode puxar atenção/tempo de quem hoje só lança orçamento.
> Antes de ir pro ar, este é o retrato de conversão/velocidade/expiração dos
> orçamentos — pra depois dar pra medir se a Etapa 1 mexeu em algum desses
> números (pra melhor ou pra pior), e não só assumir que sim.
>
> Medido em **2026-08-12**, contra o banco de produção `lbxwclwzeqqtnwvlxsxs`,
> **antes** de `migracao-vendas-balcao.sql` rodar (confirmado via
> `to_regclass('public.vendas_balcao')` → `null`, tabela ainda não existe) e
> antes de qualquer mudança de comportamento da Etapa 1 ir pro ar.
>
> ⚠️ **Escopo:** mesmo escopo do baseline anterior (`crm-baseline-2026-08-06.md`)
> pra ficar comparável — `loja_id LIKE 'fortemp%'` (Camboriú + Itapema).
> Aquamotor fica de fora dos dois.

---

## 1. Conversão por trilho × faixa de valor

Trilho definido pela mesma regra do baseline de 08/06:
`servicos ~* /trocador|aquecedor|bomba de calor|fromtherm|jelly/i`.

| Trilho | Faixa | Qtd | Aprovados | Conversão | Em aberto (qtd) | Em aberto (R$) |
|---|---|---|---|---|---|---|
| Equipamento | < R$ 15k | 26 | 3 | **11,5%** | 21 | R$ 205.829,74 |
| Equipamento | R$ 15–50k | 51 | 4 | **7,8%** | 44 | R$ 1.086.839,74 |
| Equipamento | ≥ R$ 50k | 13 | 0 | **0,0%** | 10 | R$ 753.173,27 |
| Serviço | < R$ 15k | 195 | 83 | **42,6%** | 104 | R$ 324.482,68 |
| Serviço | R$ 15–50k | 2 | 0 | **0,0%** | 2 | R$ 40.820,59 |

Totais do escopo: **287 orçamentos**, 90 aprovados (**31,4%** de conversão
geral). Mesmo padrão do baseline de 08/06 — equipamento converte bem menos
que serviço em toda faixa de valor; a quebra continua sendo o trilho, não só
o valor.

## 2. Velocidade de fechamento

Dos 90 aprovados, **51 têm `data_aprovacao` real** (diferente de
`data_criacao` — o resto é artefato de backfill antigo, descartado, mesmo
critério do baseline anterior):

| Fecharam em | Qtd | % |
|---|---|---|
| ≤ 1 dia | **38** | **74,5%** |
| > 5 dias (após a validade padrão) | 9 | — |

Maior tardio: **R$ 30.618,44**, mesmo caso já registrado no baseline de 08/06
(ainda não fechou nada maior depois do dia 5 desde então).

## 3. Status da base

| Status | Qtd | Valor |
|---|---|---|
| vencido | **166** | R$ 2.161.216,79 |
| aprovado | 90 | R$ 208.247,86 |
| recusado | 16 | R$ 339.067,53 |
| pendente | 15 | R$ 249.929,23 |

## 4. Valor expirado

- **166 orçamentos vencidos, R$ 2.161.216,79** — é o maior bloco da base
  (58% da contagem, e mais que o dobro do valor aprovado histórico).
- Só **1 dos 15 "pendentes"** já passou da própria data de validade na
  prática (`validade_data < hoje`) — a rotina de marcar `vencido` está em dia,
  não é lag de status desatualizado.
- **Equipamento concentra o valor expirado**: 68 vencidos somam
  **R$ 1.842.861,63** (85% do valor vencido total), contra 98 vencidos de
  serviço somando R$ 318.355,16. Combina com a seção 1 — é o mesmo trilho que
  já converte pior.

## 5. Recebimento por loja (contexto, não muda com a Etapa 1)

| Loja | Aprovados | Com `valor_recebido` > 0 | % |
|---|---|---|---|
| Itapema | 27 | 24 | **88,9%** |
| Camboriú | 63 | 23 | **36,5%** |

Segue o mesmo padrão do baseline de 08/06 (Itapema à frente) — incluído aqui
só como referência de contexto, a Etapa 1 não mexe nesse fluxo.

## 6. Sazonalidade (contexto)

| Mês (2026) | Emitidos | Conversão |
|---|---|---|
| abr | 48 | 16,7% |
| mai | 58 | 25,9% |
| jun | 62 | 33,9% |
| jul | 91 | **41,8%** |
| ago (parcial, até dia 12) | 28 | 28,6% |

Curva de alta mantida desde o baseline anterior; agosto ainda incompleto,
não comparar com os meses fechados.

---

## Como comparar depois (a pedido do briefing — medir efeito da Etapa 1)

Reexecutar as mesmas consultas (script `sql.py` + Management API, mesmo
padrão da sessão) e observar:

1. **Conversão por trilho não deve cair** — a Etapa 1 não deveria competir
   por atenção com orçamento de equipamento/serviço; se cair, algo no fluxo
   de venda balcão está desviando foco de quem vende serviço maior.
2. **Valor expirado (seção 4) — hipótese é que continue crescendo em ritmo
   parecido**, já que venda de balcão é uma transação separada e não deveria
   nem ajudar nem atrapalhar isso diretamente. Se cair de forma abrupta,
   verificar se não é efeito colateral de atenção realocada.
3. **% com `valor_recebido` por loja (seção 5)** — não deveria mudar; serve
   de controle (se mudar, é outra coisa acontecendo, não a Etapa 1).
4. **Volume de `vendas_balcao` registrado** × baseline dos totais de estoque
   já disponíveis — a métrica nova em si (quantas vendas de balcão passam a
   ficar com histórico de verdade, que hoje é zero por definição — a tabela
   não existe ainda).

Este arquivo cobre só a parte de atribuição pedida para a Etapa 8. Vistorias/
despesas/equipamentos/identidade de cliente (lacunas de dados) já estão
documentados no baseline de 08/06 e não foram remedidos aqui por não fazerem
parte do escopo desta rodada.
