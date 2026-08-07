# Cobertura de `produto_id` — o que precisa ser feito para o estoque bater

> **Por que este arquivo existe.** O baseline mostrou que só 24,3% dos itens
> aprovados em Camboriú carregam `produto_id`, e que por isso a baixa automática
> na aprovação não enxerga a maior parte do que se vende. Este relatório abre
> esse número: **o que exatamente está sendo digitado à mão, e o que dá para
> fazer a respeito.**
>
> Medido em **2026-08-07**, leitura pura contra `lbxwclwzeqqtnwvlxsxs`.
> Insumo direto para o item **2.2** do roadmap. Dados:
> [`cobertura-produto-id.json`](cobertura-produto-id.json) — 617 descrições
> agrupadas, cada uma com o produto sugerido e o motivo.

---

## Primeiro: o número de cobertura estava pessimista

Nem toda linha de orçamento pode ter `produto_id`. Separando as 294 linhas dos
orçamentos aprovados por natureza:

| Natureza da linha | Itens | Com `produto_id` |
|---|---|---|
| **Material** (deveria ter) | 252 | 87 |
| Mão de obra / serviço | 32 | 1 |
| Linha de fechamento ("Investimento total:") | 10 | 0 |

**Sobre o alvo real — só o material — a cobertura é 34,5%, não 29,9%.**
Por unidade: **Camboriú 28,5%** (53 de 186), **Itapema 51,5%** (34 de 66).

A conclusão do baseline não muda: Camboriú deixa **71% do seu material** fora da
contabilidade de estoque. Mas o alvo a perseguir é 100% de 252 linhas, não de
294 — mão de obra nunca vai ter produto, e a linha de total muito menos.

## Segundo: metade do dinheiro está num formato que esconde o preço

Existe um padrão de proposta em que o vendedor lista os itens **com preço zero**
e coloca o valor inteiro numa linha final chamada "Investimento total:".

| | Orçamentos | Valor | Itens com preço zero |
|---|---|---|---|
| Camboriú, escopo fechado | **64** | **R$ 1.330.870** | 78,6% |
| Camboriú, itemizado | 150 | R$ 1.298.404 | 5,3% |
| Itapema, escopo fechado | 1 | R$ 25.172 | 80,0% |
| Itapema, itemizado | 60 | R$ 196.999 | 1,3% |

**51% do valor de Camboriú está em orçamentos onde os itens não têm preço.**
Comercialmente isso faz todo sentido — numa proposta de equipamento você não
abre a composição para o cliente. Mas tem duas consequências dentro do sistema:

1. As 4 descrições de fechamento ("INVESTIMENTO TOTAL", "Investimento", "Total do
   investimento", "VALOR INSTALAÇÃO") somam **R$ 1.612.602 em 77 usos**. São
   **58% de todo o valor sem `produto_id`** — e nenhuma delas é produto. Qualquer
   métrica de cobertura por *valor* fica sem sentido; a métrica honesta é por
   *linha*.
2. **O item 2.1 do roadmap (custo congelado) não funciona nesses orçamentos.**
   Congelar `custo_unit` numa linha cujo `preco` é zero dá custo sem receita
   correspondente — margem por item impossível de calcular. Nesses casos a
   margem só existe no nível do orçamento inteiro.

---

## O que dá para fazer, em ordem de retorno

### 1. Trocador de calor: R$ 632 mil escritos de 58 maneiras

É o achado mais caro do relatório.

| | |
|---|---|
| Descrições distintas de trocador | **58** |
| Usos | 76 |
| Valor | **R$ 632.421** |

Amostra do mesmo equipamento, escrito diferente a cada proposta:

- `Trocador de calor Pooltec modelo 35/120 380v trifásico Inverter com…` — R$ 90.750
- `Trocadores de calor Pooltec 35/120 Inverter com acionamento e control…` — R$ 90.750
- `Trocador de calor Pooltec BCPI 35/120 380v trifásico` — R$ 60.500
- `TROCADOR DE CALOR POOLTEC 35/120 INVERTER` — R$ 27.625

**E a linha Pooltec inteira já está cadastrada** — 7 modelos em `produtos`:
BCPI 4/14, 7/25, 13/45, 17/60, 21/75, 28/100 e 35/120.

Ou seja: **não é problema de catálogo, é problema de escolher em vez de
digitar.** O produto está lá; o vendedor escreve à mão porque a descrição
comercial que ele quer mandar para o cliente é mais longa que o nome do produto.

> **Sugestão para a Sessão A:** o caminho não é cobrar disciplina, é deixar o
> item ter `produto_id` **e** um texto livre próprio. Hoje parece que escolher o
> produto obriga a usar o nome dele, e por isso ninguém escolhe. Se a descrição
> continuar editável depois de escolher, o vendedor ganha as duas coisas.

⚠️ **6 dos 7 trocadores estão com `custo` zero.** Só o 13/45 e o 21/75 têm custo
cadastrado. Mesmo ligando tudo, a margem do produto mais caro da empresa
continua desconhecida. Isso é pré-requisito do 2.1, e não depende de código.

### 2. Já existe produto, só falta ligar: 58 descrições

Casaram com um produto cadastrado por nome idêntico (31) ou quase idêntico (27).
São ligações diretas, sem decisão de negócio:

| Usos | Descrição digitada | Produto cadastrado |
|---|---|---|
| 8 | Motobomba Lepono 1/3cv 220v | Motobomba Lepono 1/3cv 220v piscina. |
| 7 | Motobomba Lepono 1/2cv 220v | Motobomba Lepono 1/2cv 220v. |
| 4 | Algicida choque Genco 1l | GENCO ALGICIDA DE CHOQUE - 1L |
| 3 | Oxidante Astralpool de 1kg | OXIDANTE ASTRALPOOL 1KG |
| 3 | Motobomba Lepono 1cv 220v | Motobomba Lepono 1cv 220v hidromassagem. |
| 3 | BALDE DE MADEIRA | BALDE DE MADEIRA SODRAMAR |
| 3 | Concha de madeira | CONCHA DE MADEIRA SODRAMAR |

A lista completa está no JSON, em `confianca: "exato"` e `"provavel"`.

### 3. Material genérico: 22 descrições, 115 usos — e não são produtos

| Usos | Descrição | Valor |
|---|---|---|
| 26 | MATERIAL ELÉTRICO | R$ 4.671 |
| 21 | Material hidráulico | R$ 2.983 |
| 17 | Material Hidráulico e calços de borracha | R$ 2.866 |
| 14 | Material elétrico e hidráulico | R$ 3.110 |
| 9 | Material elétrico, hidráulico e calços de borracha | R$ 1.263 |

São **as linhas mais frequentes de todo o levantamento** (115 usos), mas somam
só R$ 24.317. Cada uma é um pacote de dezenas de itens pequenos — tubo, conexão,
cabo, disjuntor.

**Cadastrar "MATERIAL ELÉTRICO" como um produto seria inventar um SKU que não
existe no estoque.** Duas saídas honestas, e a escolha é de negócio:

- **Aceitar que não movem estoque** e tratar esse material como consumo direto,
  lançado por baixa rápida quando sai da prateleira. É o que já acontece na
  prática.
- **Criar um kit** com composição fixa, que dá baixa nos componentes. Só vale se
  a composição for de fato estável — e "material elétrico e hidráulico" sugere
  que não é.

Sugiro a primeira. Forçar um SKU aqui deixa o estoque com aparência de correto
sem estar.

### 4. Cauda longa: 470 descrições, 675 usos, R$ 346 mil

O resto. A maioria aparece **uma única vez** — item comprado para um serviço
específico. Não compensa cadastrar um a um.

**Curva de esforço** (material dos orçamentos aprovados, do mais usado para o
menos):

| Ligar as… | Ganho | Cobertura do alvo |
|---|---|---|
| — (hoje) | — | **34,8%** |
| 10 descrições mais usadas | +30 itens | 46,6% |
| 20 mais usadas | +48 itens | 53,8% |
| 30 mais usadas | +58 itens | 57,7% |
| 50 mais usadas | +78 itens | 65,6% |
| 100 mais usadas | +128 itens | 85,4% |
| todas as 137 | +165 itens | 100% |

**As 20 descrições mais usadas levam a cobertura de 35% para 54%.** Daí para
frente cada ligação vale menos. Não existe motivo para perseguir 100%.

---

## Como o casamento foi feito

Mesmo critério conservador do relatório de clientes: **na dúvida, "revisar".**

1. Tira o `01 ` do começo e o `;` do fim — o vendedor escreve
   `01 Trocador de calor Pooltec 17/60 220v Inverter;`.
2. **Exato** — nome idêntico ao produto depois de normalizar.
3. **Provável** — sobreposição de palavras ≥ 75%, **e** os números batem.
4. **Revisar** — sobreposição entre 50% e 75%, ou os números não batem.
5. **Nenhum** — não existe produto parecido.

> ⚠️ **A guarda de especificação é o ponto mais importante do método.**
> `MOTOBOMBA SYLLENT 1/2 CV AUTOESCORVANTE` casa 85% com `Motobomba Syllent 1 cv`
> — mas é outro motor. `SYLLENT 2CV C/PRE FILTRO` casa 78% com o modelo `1/2cv`.
> Nome parecido não é produto igual quando o que distingue é a potência, a
> bitola ou a litragem. Esses casos foram rebaixados para "revisar" de
> propósito: errar aqui troca um equipamento por outro no estoque e no custo, e
> ninguém percebe.
>
> É o mesmo princípio dos condomínios Infinity no relatório de clientes.

## Números de referência

Todas as descrições sem `produto_id`, em qualquer status:

| Natureza | Descrições | Usos | Valor |
|---|---|---|---|
| Material | 549 | 865 | R$ 1.001.850 |
| ├ trocador de calor | 58 | 76 | R$ 632.421 |
| ├ material genérico | 22 | 115 | R$ 24.317 |
| └ demais materiais | 470 | 675 | R$ 346.431 |
| Serviço / mão de obra | 64 | 205 | R$ 150.937 |
| Linha de fechamento | 4 | 77 | R$ 1.612.602 |

Situação do material perante o catálogo:

| | Descrições | Usos | Valor |
|---|---|---|---|
| Exato — produto existe | 31 | 43 | R$ 12.199 |
| Provável — produto existe | 27 | 47 | R$ 30.537 |
| Revisar — decisão humana | 165 | 236 | R$ 667.776 |
| Nenhum — precisa cadastrar | 326 | 539 | R$ 291.338 |

A faixa "revisar" concentra R$ 667 mil porque **é onde estão os trocadores** —
o modelo varia na escrita e a guarda de especificação segura a ligação
automática. São poucos casos e valem muito: resolver o trocador resolve a maior
parte desse valor.

---

## Resumo para decisão

1. **Inverter 2.2 antes de 2.1.** Congelar custo sobre 34,5% do material entrega
   um custo que cobre um terço da venda.
2. **Deixar a descrição editável depois de escolher o produto.** É a mudança de
   uma linha que provavelmente destrava os R$ 632 mil de trocador — o produto já
   está cadastrado, o vendedor é que não pode usar o texto que ele precisa.
3. **Cadastrar custo nos 6 trocadores Pooltec que estão com zero.** Não depende
   de código e é pré-requisito de qualquer conta de margem.
4. **Ligar as 58 descrições que já têm produto** e as 20 mais usadas da cauda —
   leva a cobertura de 35% para ~54%.
5. **Não cadastrar "material elétrico/hidráulico" como produto.** São pacotes.
   Tratá-los como consumo direto é mais honesto que fabricar um SKU.
