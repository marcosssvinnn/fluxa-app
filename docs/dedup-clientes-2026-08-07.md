# Deduplicação de clientes — quem é quem em `orcamentos.cliente`

> **Por que este arquivo existe.** Hoje `orcamentos.cliente` é **texto livre**.
> Cada orçamento carrega o nome digitado na hora, sem ligação com a ficha em
> `clientes`. Consequência prática: o CRM não consegue somar a história de um
> cliente — o mesmo condomínio aparece três vezes com três grafias, e o vendedor
> não vê que já vendeu para ele.
>
> Este relatório é o **insumo** para a tela de confirmação de identidade
> (item 3 do roadmap, Sessão A). Ele **não altera nada**: foi produzido em
> leitura pura contra o banco de produção `lbxwclwzeqqtnwvlxsxs` em
> **2026-08-07**. O backfill de `cliente_id` só acontece com confirmação humana,
> caso a caso.
>
> Dados brutos: [`dedup-clientes.json`](dedup-clientes.json).

---

## O quadro

| | Qtd |
|---|---|
| Nomes distintos em `orcamentos.cliente` | **216** |
| Fichas em `clientes` | **141** |
| Orçamentos | 303 |
| Valor total | **R$ 2.987.347,04** |

Há **mais nomes de cliente do que fichas de cliente**. Só isso já diz que o
cadastro não é a fonte da verdade — ele é opcional, e a maioria dos orçamentos
foi feita sem passar por ele.

## Resultado da classificação

| Faixa | Nomes | Orçamentos | Valor | O que fazer |
|---|---|---|---|---|
| **Exato** | 107 | 161 | **R$ 1.746.154,49** | Ligar direto — o nome é idêntico depois de normalizar caixa e acento |
| **Provável** | 2 | 2 | R$ 2.402,75 | Ligar, mas mostrando a sugestão na tela |
| **Revisar** | 14 | 21 | R$ 52.898,05 | **Decisão humana** — listados um a um abaixo |
| **Nenhum** | 93 | 119 | **R$ 1.185.891,75** | Não existe ficha. Criar no momento da confirmação |
| **Total** | 216 | 303 | R$ 2.987.347,04 | |

**O número que importa: 43% dos nomes e 40% do dinheiro (R$ 1,19 mi) não têm
ficha nenhuma.** Não é problema de grafia — é cliente que nunca foi cadastrado.
Desses 93, **33 já tiveram orçamento aprovado** e 19 voltaram para um segundo
orçamento. São clientes reais, com histórico, invisíveis para o CRM.

Os 30 maiores sem ficha somam R$ 1.086.272,77 — ou seja, o problema está
concentrado: cadastrar 30 clientes recupera 92% do valor dessa faixa.

---

## ⚠️ Dois sinais que parecem chave de identidade e não são

Isto vale mais do que a tabela acima, porque um backfill automático usando
qualquer um dos dois **fundiria clientes diferentes**.

### CNPJ é o da administradora, não o do condomínio

| CNPJ | Nomes que compartilham |
|---|---|
| 41.427.511/0001-71 | Edifício Torre de Esmeralda · Villa Di Mare · Villa dos Corais |
| 11.414.715/0001-07 | Diamond Hill · Majestic Residencial |
| 13.615.874/0001-03 | Infinity Flat · Platinum Residence |
| 20.726.268/0001-12 | Ibiza Towers · Pousada Casa do Mar |
| 39.832.385/0001-99 | Isis Dellagnelo Kwiatkowski · Muniz |

São condomínios distintos sob a mesma administradora. **CNPJ igual não é cliente
igual** — por isso ele ficou fora do critério de match. O mesmo vale para as
fichas: `clientes` já tem 4 pares com CNPJ repetido pelo mesmo motivo.

### Telefone é o do síndico, não o do cliente

| Telefone | Nomes que compartilham |
|---|---|
| (47) 98804-7997 | LUAN · RESIDENCIAL DI MARIA |
| (47) 99923-5475 | Marli · RESIDENCIAL DI MARIA |
| (48) 99943-3387 | Isis Dellagnelo Kwiatkowski · MUNIZ |
| (47) 98845-7077 | RENATA · Renatta Terra Treptow |

Pessoa física e condomínio dividindo telefone é a relação **contato ↔ cliente**,
não duplicidade. Só o último par é a mesma pessoa de fato. Telefone entrou como
evidência de apoio, nunca como decisão.

---

## Os 14 casos que precisam de decisão humana

| Valor | Orçs | Nome no orçamento | Por que parou aqui |
|---|---|---|---|
| R$ 16.231,00 | 1 | GABRIEL | 2 fichas com esse mesmo nome — a duplicidade está no cadastro |
| R$ 11.886,00 | 1 | Villa Di Mare | Parecido com "VILLA DO MAR" (85%), mas *villa* nomeia vários imóveis |
| R$ 8.058,10 | 2 | MUNIZ | 2 fichas com esse mesmo nome |
| R$ 7.958,00 | 1 | `--` | Orçamento sem nome de cliente preenchido |
| R$ 2.975,00 | 1 | Renato | Parecido com "RENATA" (83%) — nomes de pessoa colidem fácil |
| R$ 2.709,17 | 3 | Gabriel | 2 fichas com esse mesmo nome |
| R$ 1.199,00 | 2 | Bella Vista Residencial | Parecido com "RESIDENCIAL BELLA CITTA" (82%) — são imóveis diferentes |
| R$ 404,15 | 1 | Condominio Atlântico | 2 fichas com esse mesmo nome |
| R$ 393,00 | 4 | RESIDENCIAL DI MARIA | 2 fichas com esse mesmo nome |
| R$ 275,00 | 1 | CONDOMINIO DI MARIA | 3 fichas equivalentes depois de tirar a palavra de tipo |
| R$ 275,00 | 1 | CONDOMINIO ATLANTICO | 2 fichas com esse mesmo nome |
| R$ 255,00 | 1 | TORRI DI MARE RESIDENZIALE | 2 fichas com esse mesmo nome |
| R$ 176,00 | 1 | Renatta Terra Treptow | Mesmo telefone de "RENATA", nomes diferentes |
| R$ 105,00 | 1 | Condominio Arruba | Parecido com "Condominio Edificio Aruba Residence" (83%) |

Note que **7 dos 14 travaram porque a ficha está duplicada em `clientes`**, não
porque o nome do orçamento seja ambíguo. Limpar o cadastro resolve metade.

---

## Variantes dentro do próprio `orcamentos`

Mesmo cliente escrito de dois jeitos. Nenhum algoritmo liga um ao outro hoje, e
o histórico do cliente fica partido — **inclusive quando as duas grafias já têm
ficha**, porque são fichas diferentes.

| Valor somado | Grafias | Lojas |
|---|---|---|
| **R$ 89.686,80** | CONDOMINIO BRISA DO MAR · Condomínio Briza do Mar · BRISA DO MAR | aquamotor + Camboriú |
| **R$ 60.487,35** | Infinity Flat · CONDOMINIO INFINITY TOWER FLAT | Camboriú + Itapema |
| R$ 18.940,17 | GABRIEL · Gabriel | Itapema + Camboriú |
| R$ 16.015,74 | Villa Di Mare · VILLA DO MAR | Camboriú + Itapema |
| R$ 15.877,27 | Edifício Green Valey · Residencial Green Valey | Camboriú |
| R$ 13.290,00 | Four Seasons Residence · Condominio Four Seasons Residence | Camboriú |
| R$ 8.418,10 | RESIDENCIAL MAJESTIC · Majestic Residencial | aquamotor + Camboriú |
| R$ 2.004,60 | MK PIscinas · MK PISCINAS | Camboriú |
| R$ 1.135,45 | Notre Dame · Notre Dame Residencial | Camboriú |
| R$ 741,45 | FABIANO RAFAEL · Fabiano Rafael | Camboriú |
| R$ 679,15 | Condominio Atlântico · CONDOMINIO ATLANTICO | Camboriú + Itapema |
| R$ 667,70 | RESIDENCIAL DI MARIA · CONDOMINIO DI MARIA | aquamotor/Camboriú + Itapema |
| R$ 194,70 | CONDOMINIO FRATERNITÁ · CONDOMINIO EDIFICIO RESIDENCIAL FRATERNITA | Itapema |

**13 grupos, R$ 228 mil de histórico partido.** Os dois maiores merecem atenção
especial e **não devem ser unidos sem alguém da equipe confirmar**:

- **Brisa / Briza do Mar** — as três grafias estão em **empresas diferentes**
  (Aquamotor e Fortemp Camboriú). Pode ser o mesmo condomínio atendido pelas
  duas, ou dois condomínios homônimos em cidades diferentes. Só quem conhece o
  cliente sabe.
- **Infinity Flat / Infinity Tower Flat** — mesma família de nome, lojas
  diferentes. Lembrando que **Infinity Coast, Infinity Paradise e Infinity Flat
  são condomínios distintos**; a semelhança do nome não decide nada aqui.

---

## Estado do cadastro em si

- **11 grupos de fichas duplicadas** (24 fichas) dentro de `clientes`. Dois
  casos são duplicata literal, mesmo nome e mesmo CNPJ: *TORRI DI MARE
  RESIDENZIALE* e *MUNIZ*.
- **35 das 141 fichas nunca apareceram em um orçamento.** Cadastro feito e
  nunca usado — o vendedor digitou o nome de novo em vez de escolher a ficha.

Grupos duplicados: CONDOMINIO ATLANTICO · BRISA DO MAR · Carrara · DI MARIA
(3 fichas) · Four Seasons (3 fichas) · FRATERNITA · Gabriel · LUAN · Majestic ·
MUNIZ · TORRI DI MARE.

---

## Como o match foi feito

Critério deliberadamente conservador: **na dúvida, "revisar" em vez de chutar.**

1. **Exato** — nomes iguais depois de baixar caixa, tirar acento e pontuação.
2. **Provável** — iguais depois de remover as palavras que indicam *tipo* e não
   identidade (`condomínio`, `edifício`, `residencial`, `torre`, `residence`,
   `ltda`…); ou até 2 caracteres de diferença; ou ≥ 90% de semelhança.
3. **Revisar** — empate entre fichas, ficha duplicada no cadastro, semelhança na
   faixa de 80–90%, ou nome de uma **família** (primeiro token que nomeia mais de
   um imóvel: *infinity*, *villa*, *green*, *bella*, *ocean*, *porto*…). Nesses,
   semelhança alta **não** é suficiente.
4. **Nenhum** — nada acima de 80% de semelhança.

CNPJ ficou fora por ser da administradora; telefone só gera "revisar".

O campo `tambem_em` no JSON diz se o nome aparece em `ordens_servico`,
`vistorias` ou `locais_vistoria` — contexto, não sugestão: essas três tabelas
gravam texto livre do mesmo jeito e repetem o mesmo problema (25, 6 e 14 nomes
distintos, respectivamente).

## Recomendação para a tela de confirmação (Sessão A)

1. Os **107 exatos** podem vir pré-marcados, com o vendedor só confirmando.
2. Os **14 de revisar** precisam aparecer com as duas opções lado a lado e a
   possibilidade de dizer "são clientes diferentes" — essa resposta tem que ser
   gravada, senão a tela pergunta de novo toda semana.
3. Os **93 sem ficha** deveriam virar ficha no ato da confirmação, e não numa
   tela de cadastro separada — foi justamente a tela separada que produziu as 35
   fichas órfãs.
4. Antes de qualquer backfill, **limpar as 11 duplicidades de `clientes`** —
   metade dos casos ambíguos desaparece sozinha.
