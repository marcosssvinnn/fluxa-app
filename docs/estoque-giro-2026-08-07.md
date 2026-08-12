# Estoque: 74% nunca teve saída — e o motivo não é o que parece

> **Por que este arquivo existe.** O baseline apontou "R$ 92.251 sem giro há 90
> dias" e eu ia abrir esse valor item a item, para a equipe decidir o que fazer
> com cada peça encalhada. Ao abrir, o rótulo não se sustentou: **o razão de
> estoque tem 48 dias de vida**, então nada ali pode estar sem giro há 90.
>
> A correção levou a um achado melhor — e mais acionável — do que o original.
>
> Medido em **2026-08-07**, leitura pura contra `lbxwclwzeqqtnwvlxsxs`.
> A linha do baseline já foi corrigida.

---

## O erro e a correção

A consulta filtrava `ultima_saida is null OR ultima_saida < now() - 90 dias`.
Como o razão começa em **20/06/2026**, a segunda condição nunca acontece: o que
o filtro capturou foram, integralmente, os itens que **nunca tiveram saída
registrada**.

O valor está certo — **R$ 92.251**. A conclusão que se tirava dele, não.
Um item que entrou há 9 dias e ainda não saiu caía no mesmo balde de um item
encalhado há meses. Não dá para separar os dois com 48 dias de histórico.

## O que os dados dizem de fato

| Em 48 dias (20/06 → 07/08) | Camboriú | Itapema |
|---|---|---|
| Lançamentos de **entrada** | 201 | 102 |
| Lançamentos de **saída** | **6** | **34** |
| Produtos distintos que tiveram saída | 5 | 26 |
| Orçamentos aprovados no período | 33 | 19 |
| Valor em estoque | R$ 84.014 | R$ 40.225 |
| Valor que nunca teve saída | R$ 62.858 (74,8%) | R$ 29.393 (73,1%) |

**Camboriú aprovou 33 orçamentos e registrou 6 saídas de estoque.**

O material saiu da prateleira — os serviços foram executados. O que não
aconteceu foi o lançamento. Itapema, com metade dos orçamentos aprovados,
registrou quase seis vezes mais saídas.

O estoque entrou no sistema numa carga inicial entre **22 e 24 de junho** (188
lançamentos de entrada em três dias). As entradas de julho são compras de
verdade. Ou seja: o cadastro do estoque foi feito com capricho, e a baixa nunca
entrou na rotina.

## A mesma assinatura em três indicadores

Este não é um problema de estoque. É o mesmo problema, visto de três ângulos:

| Indicador | Camboriú | Itapema |
|---|---|---|
| Recebimento lançado sobre o aprovado | **28,1%** | **98,4%** |
| Itens de material com `produto_id` | **28,5%** | **51,5%** |
| Saídas de estoque por orçamento aprovado | **0,18** | **1,79** |

Três medições independentes, feitas a partir de tabelas diferentes, apontando
para a mesma coisa: **em Itapema o registro faz parte do trabalho; em Camboriú,
não.**

Isso muda o encaminhamento. Não adianta atacar cada indicador com uma
funcionalidade diferente — tela de recebíveis, picker de produto, baixa rápida.
As três já existem. O que falta é o registro caber na rotina de quem executa, e
esse é um problema de desenho de fluxo e de combinado com a equipe, não de
funcionalidade faltando.

> **Vale perguntar antes de concluir:** a operação de Camboriú é maior, com
> ticket 3,4× o de Itapema e obra de equipamento. É possível que o material de
> Camboriú saia por um caminho que o sistema não cobre — direto do fornecedor
> para a obra, sem passar pela prateleira. Se for isso, o indicador não está
> apontando indisciplina, está apontando um fluxo que o sistema não modela.
> **É a pergunta que eu faria à equipe antes de qualquer cobrança.**

## O que sobra de acionável no estoque

Com 48 dias de razão, **não dá para produzir uma lista de material encalhado** —
o dado não existe ainda. Essa análise passa a fazer sentido por volta de
outubro/2026, quando houver 90 dias reais de histórico após a carga inicial.

O que dá para fazer agora:

1. **Refazer esta medição em outubro**, com `estoque-entrada-x-saida.sql` e
   `estoque-saldo-e-giro-por-loja.sql`. Aí sim "sem giro há 90 dias" quer dizer
   alguma coisa.
2. **Cadastrar custo nos 36 itens com saldo e custo zero** (12 em Camboriú, 24
   em Itapema). Enquanto isso não for feito, todo valor de estoque é piso, e
   qualquer conta de margem nasce errada.
3. **Não tratar os R$ 92 mil como capital encalhado** em nenhum painel ou
   conversa. Hoje ele mede registro, não estoque.

## Nota de método

O erro passou porque a consulta parecia certa: o filtro está tecnicamente
correto e devolve linhas. O que faltou foi checar se a **janela de 90 dias cabia
no histórico disponível** antes de dar nome ao número.

Vale como regra para as próximas medições deste roadmap: **toda métrica com
janela de tempo precisa ser conferida contra a idade da tabela.** Vários
números daqui vão nascer em bases de 48 dias a 5 meses.

Foi por isso que os cabeçalhos de `docs/sql/` passaram a dizer também o que o
número **não** significa — e não só o que ele mede.
