# Linha de base — antes das mudanças de CRM

> **Por que este arquivo existe.** As mudanças de funil (validade, trilhos, fila
> de follow-up) alteram vários números ao mesmo tempo. Sem um retrato do "antes",
> em três meses ninguém sabe o que funcionou. Este é o retrato.
>
> Medido em **2026-08-06**, contra o banco de produção `lbxwclwzeqqtnwvlxsxs`,
> **antes** de qualquer alteração de comportamento.
>
> ⚠️ **Escopo:** salvo indicação em contrário, os números abaixo são
> `loja_id LIKE 'fortemp%'` (Camboriú + Itapema) — o mesmo escopo que o gestor
> da Fortemp vê na tela via `escopoEmpresaMatch()`. Relatórios que somem a
> Aquamotor darão números maiores; não é divergência, é escopo.

---

## 1. Conversão por trilho × faixa de valor

Trilho definido por `servicos ~* /trocador|aquecedor|bomba de calor|fromtherm|jelly/i`.

| Trilho | Faixa | Qtd | Aprovados | Conversão | Em aberto | Qtd em aberto |
|---|---|---|---|---|---|---|
| Equipamento | < R$ 15k | 25 | 2 | **8,0%** | R$ 212.476 | 21 |
| Equipamento | R$ 15–50k | 48 | 4 | **8,3%** | R$ 1.007.810 | 41 |
| Equipamento | ≥ R$ 50k | 13 | 0 | **0,0%** | R$ 753.173 | 10 |
| Serviço | < R$ 15k | 184 | 80 | **43,5%** | R$ 279.143 | 97 |
| Serviço | R$ 15–50k | 2 | 0 | **0,0%** | R$ 40.821 | 2 |

**Achado que orienta o desenho:** equipamento converte ~8% **em todas as
faixas, inclusive abaixo de R$ 15k**. Um trocador de R$ 10k converte 8%; um
serviço de R$ 10k converte 43,5%. A quebra é o **trilho**; o valor agrava.
Por isso a regra de "vida longa no funil" considera trilho **e** valor, não só
valor.

Totais: **272 orçamentos**, 86 aprovados, R$ 2.293.423 em aberto (170 registros).

## 2. Velocidade de fechamento

Dos 86 aprovados, **39 têm `data_aprovacao` idêntica a `data_criacao`** —
artefato do backfill em `_migrarDataAprovacao` (`app.js`), descartados. Nos **47
com registro real**:

| Fecharam em | Qtd | % |
|---|---|---|
| ≤ 1 dia | **37** | **78,7%** |
| > 5 dias (após a validade padrão) | 8 | 17,0% |

**79% do que fecha, fecha em 24 horas.** O que precisa de reflexão morre — e a
validade padrão de 5 dias garante isso. Os 8 tardios provam que existe dinheiro
depois do dia 5 (o maior: R$ 30.618, fechado em 65 dias).

## 3. Status da base

| Status | Qtd |
|---|---|
| vencido | **163** |
| aprovado | 86 |
| recusado | 15 |
| pendente | **8** |

Só 8 orçamentos "vivos" pela definição atual do sistema — 3% da base.

## 4. Registro de recebimento — a diferença entre as lojas

| Loja | Aprovados | Com `valor_recebido` > 0 | % |
|---|---|---|---|
| **Itapema** | 26 | 24 | **92%** |
| **Camboriú** | 60 | 22 | **37%** |

Total: R$ 91.246 registrados como recebidos, de R$ 195.136 aprovados;
41 quitados; R$ 103.890 em aberto.

Cruzando com a conversão (**Itapema 42,6% × Camboriú 28,6%**): a unidade que
registra recebimento é a mesma que converte melhor. Itapema é o processo a
replicar, não uma teoria.

## 5. Lacunas de dados (contadores em zero)

| Tabela / campo | Estado |
|---|---|
| `despesas` | **0 registros** — sem margem, só faturamento bruto |
| `equipamentos` | **0 registros** — base instalada não existe |
| `vistorias` | 7 registros — módulo subutilizado |
| `servicos[].produto_id` | **14,5%** (192 de 1.324 linhas) |
| abertura do portal do cliente | **não é registrada** |
| `clientes.tipo` | coluna **não existe** no banco (o insert manda, o wrapper descarta) |
| identidade do cliente | 214 nomes distintos em orçamentos × 141 clientes cadastrados |

## 6. Concentração

- **86% do valor em aberto é um produto só** (trocador/aquecimento).
- 14 clientes que já compraram têm R$ 239.427 em aberto; 114 que nunca
  compraram têm R$ 2.040.871.
- Ibiza Towers comprou trocador em 02/05 (R$ 29.885) e **recebeu 5 ofertas de
  trocador depois disso**. 16 clientes receberam 2+ orçamentos de trocador.

## 7. Sazonalidade

| Mês (2026) | Emitidos | Conversão |
|---|---|---|
| abr | 48 | 16,7% |
| mai | 58 | 25,9% |
| jun | 62 | 33,9% |
| jul | 91 | **40,7%** |

Curva de alta rumo à temporada (verão dez–mar). Obra grande precisa aprovar até
~outubro para entregar antes de dezembro.

---

## Como comparar depois

Reexecutar as mesmas consultas e observar:

1. **Qtd em aberto viva** — deve subir (orçamentos param de morrer em 5 dias).
2. **Conversão do trilho equipamento** — a hipótese é que suba dos 8% atuais;
   é o teste central da mudança.
3. **Conversão do trilho serviço** — deve permanecer ~43%. Se cair, a mudança
   atrapalhou o que já funcionava.
4. **Tempo médio até fechar nos casos reais** — deve subir (mais negócios
   fechando depois do dia 1, em vez de só "tirar pedido").
5. **% com `valor_recebido` em Camboriú** — 37% é a métrica de adoção de
   processo daquela unidade.

Consultas usadas estão no histórico da sessão de 2026-08-06 e podem ser
reproduzidas pela Management API.
