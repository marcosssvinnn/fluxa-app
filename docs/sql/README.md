# Consultas versionadas

As medições que aparecem nos relatórios de `docs/` saem daqui. O objetivo é
simples: **quando alguém discordar de um número, dá para rodar a consulta e
conferir** — em vez de refazer a análise do zero e chegar a um número diferente
por um detalhe de filtro.

Cada arquivo tem um cabeçalho dizendo **o que mede** e **como ler o resultado**,
incluindo as armadilhas conhecidas. Leia o cabeçalho antes de usar o número.

## Como rodar

Pelo SQL Editor do Supabase (projeto `lbxwclwzeqqtnwvlxsxs`), ou pela Management
API. Todas são **somente leitura** — nenhuma altera dado.

```bash
python3 sql_v1.py "$(cat docs/sql/orcamentos-por-status-e-loja.sql)"
```

## Armadilhas que valem para quase todas

- **`loja_id` é a unidade, e há quatro valores.** `fortemp-camboriu`,
  `fortemp-itapema`, `aquamotor` e `NULL`. A Aquamotor é **outra empresa** — não
  entra em número da Fortemp. Os `NULL` são registros antigos, anteriores ao
  campo. Somar tudo dá um número que não corresponde a nenhuma operação real.
- **`data_aprovacao` tem backfill.** 53 dos 88 aprovados têm `data_aprovacao`
  igual a `data_criacao` no mesmo segundo — artefato de `_migrarDataAprovacao()`
  em `app.js`, não é aprovação instantânea. Qualquer medida de prazo precisa
  descartar esses (o filtro está em `tempo-criacao-ate-aprovacao.sql`).
- **`servicos` é JSON em coluna de texto.** Precisa de `::jsonb` e do teste
  `jsonb_typeof(...)='array'` — há registros com formato inesperado que quebram
  `jsonb_array_elements` sem o teste.
- **Saldo de estoque é somatório do razão, nunca um contador.** É a soma de
  `quantidade` por tipo de movimento, agrupada pela **loja do movimento**, não
  pela loja do produto. Agrupar pela loja do produto dá número errado — o mesmo
  produto recebe movimento nas duas unidades.
- **CNPJ e telefone não identificam cliente.** Veja
  `identidade-cnpj-compartilhado.sql` e `identidade-telefone-compartilhado.sql`.

## Índice

### Funil e dinheiro
| Arquivo | Mede |
|---|---|
| `orcamentos-por-status-e-loja.sql` | Distribuição de status e ticket médio por unidade |
| `orcamentos-taxa-aprovacao-por-loja.sql` | Taxa de aprovação, valor aprovado e valor em aberto |
| `orcamentos-em-aberto-por-idade.sql` | Quanto está parado e há quanto tempo |
| `faturamento-mensal-por-loja.sql` | Aprovado e recebido mês a mês, Camboriú × Itapema |
| `recebimento-registrado.sql` | Quanto do aprovado tem baixa de pagamento registrada |

### Prazos
| Arquivo | Mede |
|---|---|
| `tempo-criacao-ate-aprovacao.sql` | Quanto tempo o cliente leva para fechar |
| `tempo-aprovacao-ate-os.sql` | Quanto tempo do "sim" até a ordem de serviço |

### Execução
| Arquivo | Mede |
|---|---|
| `os-por-loja-e-status.sql` | Volume de OS, quantas concluídas, quantas ligadas a orçamento |
| `os-cobertura-campos-execucao.sql` | Se os campos de execução estão sendo preenchidos |
| `os-por-tecnico.sql` | Volume e duração média por técnico |
| `vistorias-viraram-orcamento.sql` | Vazamento entre vistoria e proposta |

### Estoque
| Arquivo | Mede |
|---|---|
| `estoque-tipos-de-movimento.sql` | Composição do razão por tipo |
| `estoque-saldo-e-giro-por-loja.sql` | Valor parado, sem giro em 90 dias, saldo negativo |
| `estoque-cobertura-produto-id.sql` | Quanto do que se vende consegue dar baixa |
| `estoque-cobertura-produto-id-por-natureza.sql` | A mesma conta com o denominador certo (só material) |
| `orcamentos-escopo-fechado.sql` | Orçamentos com itens a preço zero e valor numa linha final |
| `estoque-motivos-de-ajuste.sql` | Se o motivo do ajuste está padronizado |

### Identidade do cliente
| Arquivo | Mede |
|---|---|
| `identidade-nomes-vs-fichas.sql` | Nomes livres em orçamentos contra fichas cadastradas |
| `identidade-cnpj-compartilhado.sql` | CNPJs que cobrem mais de um cliente (administradoras) |
| `identidade-telefone-compartilhado.sql` | Telefones que cobrem mais de um cliente (síndicos) |
| `identidade-fichas-duplicadas.sql` | Duplicidade dentro da própria tabela `clientes` |
