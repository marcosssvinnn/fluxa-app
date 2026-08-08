# Quanto do funil "em aberto" é dinheiro distinto

> **Por que este arquivo existe.** O baseline mostrou R$ 2,2 milhões em aberto
> em Camboriú e já apontava que era "quase todo do trilho de equipamento". Este
> relatório abre essa pergunta que ficou faltando: **cada orçamento aberto é uma
> venda diferente, ou o mesmo cliente às vezes aparece mais de uma vez pela
> mesma necessidade?**
>
> Medido em **2026-08-08**, leitura pura contra `lbxwclwzeqqtnwvlxsxs`. Método
> e dados em [`funil_real.py`](funil_real.py) — script de apoio, não faz parte
> do app.

---

## O achado: 13,8% do valor em aberto é a mesma venda contada mais de uma vez

Quando o vendedor apresenta duas ou três opções de equipamento para o mesmo
cliente — por exemplo, dois modelos de trocador de calor — cada opção nasce
como um **orçamento separado**. Isso é correto do ponto de vista comercial
(o cliente escolhe um). Mas o painel de funil soma os dois como se fossem
duas vendas possíveis, quando na realidade **só uma pode fechar**.

| | |
|---|---|
| Total em aberto em Camboriú (nominal) | R$ 2.201.380 |
| Valor dentro de orçamentos "alternativos" (21 grupos, 43 orçamentos) | R$ 695.936 |
| Desse valor, se contar só a opção mais cara de cada grupo | R$ 418.282 |
| **Funil corrigido** | **R$ 1.897.959** |
| **Redução** | **R$ 303.422 (13,8%)** |

Os 21 grupos, do maior para o menor:

| Cliente | Categoria | Opções | Nominal | Maior opção | Orçamentos |
|---|---|---|---|---|---|
| Condomínio Metrópolis | trocador | 2 | R$ 150.686 | R$ 80.903 | #276, #278 |
| Platinum Residence | trocador | 2 | R$ 148.532 | R$ 83.497 | #306, #307 |
| Condomínio Maria Valentina | trocador | 2 | R$ 62.452 | R$ 37.075 | #49, #50 |
| Axplenium Residence | trocador | 2 | R$ 52.018 | R$ 29.269 | #27, #28 |
| Edifício Torre de Esmeralda | gerador de cloro | 3 | R$ 43.777 | R$ 22.551 | #44, #46, #48 |
| Valdemir de Souza Miranda | trocador | 2 | R$ 38.967 | R$ 24.132 | #12, #15 |
| Felipe | trocador | 2 | R$ 37.096 | R$ 18.815 | #22, #23 |
| Kleber | trocador | 2 | R$ 36.428 | R$ 19.170 | #199, #200 |
| Eduardo Ribeiro | trocador | 2 | R$ 35.150 | R$ 18.135 | #258, #259 |
| Oswaldo Scheer | trocador (novo × reparo) | 2 | R$ 29.005 | R$ 23.200 | #183, #184 |
| Villa dos Corais | gerador de cloro | 2 | R$ 23.210 | R$ 12.053 | #314, #324 |
| Residencial Phoenix | trocador | 2 | R$ 19.815 | R$ 13.815 | #246, #250 |
| Mariana e Vinicius | gerador de vapor/calor | 2 | R$ 11.931 | R$ 6.091 | #111, #113 |
| Eduardo | led | 2 | R$ 3.785 | R$ 2.206 | #116, #117 |
| Marcos Vinícius | filtro de areia | 2 | R$ 2.214 | R$ 1.120 | #299, #300 |
| Sérgio | dispositivos inox × ABS | 2 | R$ 462 | R$ 279 | #38, #39 |
| MK Piscinas | consumíveis | 2 | R$ 409 | R$ 204 | #67, #68 |

(Mais 3 grupos pequenos em Itapema/Aquamotor, R$ 33 mil de nominal — mesma
lógica, valor pouco relevante fora de Camboriú.)

## Como foi decidido o que é "a mesma venda"

Um orçamento entrou num grupo quando, para o **mesmo cliente**: (1) o item
de equipamento predominante é da **mesma categoria** (trocador com trocador,
gerador de cloro com gerador de cloro — nunca trocador com gerador) e (2) as
propostas foram criadas **até 10 dias uma da outra**.

A janela de 10 dias não é um número mágico — testei de 0 a 30 dias e a curva
achata rápido: 0 dias (só mesmo dia) já captura 8,7%; 10 dias chega a 13,8%;
30 dias chega a só 15,0%. Quase todo o sinal está dentro de 10 dias; ampliar
a janela some com "opções concorrentes de uma mesma visita" e passa a
misturar "reproposta depois que a primeira venceu" — que é um problema
diferente (validade de preço, não duplicidade de contagem).

⚠️ **Categoria por regra de texto, não por produto vinculado** — os itens
quase sempre têm `preco: 0` (formato "escopo fechado", já documentado em
`cobertura-produto-id-2026-08-07.md`), então a categoria não pôde vir do
maior preço; veio de reconhecer "trocador", "gerador de cloro" etc. na
descrição. Onde o texto não bate com nenhuma categoria conhecida (2 casos
pequenos, Sérgio e MK Piscinas), o agrupamento caiu num balde genérico
"outros" — conferi os dois à mão e são, de fato, a mesma proposta com uma
variação (acabamento inox × ABS; falta de sufixo de marca). Não achei nenhum
caso de "outros" que juntasse coisas realmente diferentes.

**Achei só 1 duplicata literal** (mesma descrição, mesmo valor): Denilson
Sertão, Aquamotor, #224/#226, R$ 530 cada — provavelmente o mesmo orçamento
salvo duas vezes.

## A segunda pergunta: quanto é upsell, quanto é lead frio

| | Orçamentos | Valor |
|---|---|---|
| Cliente que **já aprovou** algo antes | 19 | R$ 248.609 (11%) |
| Cliente que **nunca comprou** | 128 | R$ 1.952.772 (89%) |

O funil aberto de Camboriú é quase todo **cliente novo, nunca convertido**.
Isso não é bom nem ruim por si — é a mesma leitura do baseline (equipamento
converte ~8% em qualquer faixa de valor): é natural que a maior parte do
volume aberto seja de quem ainda não decidiu. Mas muda a leitura do "R$ 2,2
mi parados": não é dinheiro de cliente fiel esperando burocracia, é
prospecção que ainda não fechou.

## O que fazer com isso

1. **O painel de funil deveria separar "opções concorrentes" de "vendas
   distintas".** Hoje um cliente com duas propostas de trocador conta duas
   vezes no "em aberto" e, se a idade de uma delas passar de 30 dias, conta
   duas vezes também no alerta de orçamento vencido. Não é urgente mudar a
   UI por isto — mas ao ler o R$ 2,2 mi em qualquer relatório, o número
   real de oportunidades distintas é ~R$ 1,9 mi, não R$ 2,2 mi.
2. **Corrigir/excluir a duplicata literal do Denilson Sertão** (#224 ou
   #226) — é limpeza de dado, não decisão de negócio.
3. **Nenhuma ação sobre os 89% de lead frio** — é o funil funcionando como
   se espera. Onde vale atenção é nos 11% de cliente recorrente: R$ 248 mil
   de upsell em aberto é pequeno frente ao total, mas é o dinheiro mais
   fácil de fechar (relação já existe) e é onde a fila de follow-up já
   construída deveria estar mirando primeiro.
