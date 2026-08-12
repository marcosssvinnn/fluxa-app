# Etapa 5 — Ficha técnica da piscina e base instalada: auditoria + proposta

> **Escopo deste documento: só levantamento e proposta, zero código.** Leitura
> via REST com a anon key (`GET` apenas — nenhuma escrita feita nesta sessão).
> Auditoria feita em 2026-08-12, contra o banco de produção
> (`lbxwclwzeqqtnwvlxsxs`). A decisão de modelagem e a construção ficam para
> quem pegar esta etapa — este documento **recomenda**, não decide.

---

## 0. Resposta direta às duas perguntas do briefing

1. **`equipamentos` ainda está zerado?** Sim — **0 registros hoje**, mesmo
   número medido em 06/08 e em 08/08. Não é leitura desatualizada; é estado
   estável. Isso muda a estratégia a favor de quem for construir: **o modelo
   novo pode nascer já correto, sem migração de dado real para preservar.**
2. **`equipamentos.cliente_id` já resolve "condomínio com vários
   equipamentos"?** Só em teoria de schema. Na prática, **nenhum código grava
   esse campo hoje** — nem o cadastro manual, nem a importação de vistoria (ver
   §2). O agrupamento real que existe é por `cliente_nome` (texto), que já
   funciona para "vários equipamentos por cliente", mas não distingue **qual
   piscina** dentro do condomínio.

---

## 1. Estado real auditado

### 1.1 Tabela `equipamentos` — schema confirmado, vazia

Todas as colunas abaixo existem no banco (confirmado coluna a coluna via REST,
`select=<coluna>&limit=1` — nenhuma devolveu erro `42703`/`PGRST204`):

```
id (uuid), cliente_id (text), cliente_nome (text), tipo (text), marca (text),
modelo (text), potencia (text), numero_serie (text), data_instalacao (text),
garantia_meses (integer), garantia_vencimento (text), obs (text),
foto_base64 (text), ativo (boolean), loja_id (text), data_criacao (timestamptz)
```

Duas colunas foram acrescentadas depois do `setup.sql` original (achado ao
ler `importarEqDaVistoria` em `app.js:8319-8328`, que já as grava):
`ambiente` (text) e `origem` (text, valor `'vistoria'` quando veio de lá) —
confirmadas existentes no banco também.

**Contagem real, hoje: `content-range: */0` — zero linhas**, tanto no total
quanto em qualquer filtro. A observação do briefing ("zerado", medida em
06/08) segue verdadeira 6 dias depois. Não é bug novo: já era um achado
registrado na sessão de 2026-08-08 do próprio `CLAUDE.md` (busca por
"Base instalada"), que corrigiu um bug de schema (`id` texto local `eq_<ts>`
sendo mandado dentro do payload de uma coluna `uuid`, o que derrubava o
insert inteiro em silêncio, erro `22P02`). **A correção só vale daí para
frente** — não havia dado anterior a recuperar porque nada nunca sincronizou.
Ou seja: o bug está corrigido desde 08/08, mas ninguém cadastrou nem
importou um equipamento de verdade nos 4 dias seguintes.

### 1.2 `salvarEquipamento()` (`app.js:8188`) — cadastro manual avulso

- Campo "Cliente" (`#eq-cli-nome`) é texto livre com `<datalist>` de
  sugestão (`filtrarClientesEq`, `app.js:8180`) — **não é um picker real**,
  não seleciona um `id` de cliente. O usuário pode digitar qualquer coisa,
  inclusive um nome que não bate com nenhuma ficha em `clientes`.
- O payload gravado (`dados`, linhas 8194-8200) tem `cliente_nome` mas
  **nunca inclui `cliente_id`** — nem ao criar, nem ao editar. A coluna
  existe no banco e nunca é escrita por este caminho.
- Não existe conceito de "piscina" nem de "local" no formulário — só
  cliente + tipo + marca/modelo/potência/série/garantia/foto. Um condomínio
  com 3 piscinas cadastraria 3+ equipamentos soltos, todos com o mesmo
  `cliente_nome`, sem nenhum campo que diga a qual piscina cada um pertence.

### 1.3 `importarEqDaVistoria()` (`app.js:8310-8342`) — importação em lote

- Lê os equipamentos já digitados dentro do jsonb `vistorias.equipamentos`
  (via `_eqCandidatos()`, `app.js:8250-8280`) e oferece "＋ Cadastrar" por
  cliente ou todos de uma vez.
- Este caminho **grava** `cliente_id:c.cliente_id||null` — só que
  `c.cliente_id` vem de `v.cliente_id`, e a vistoria de origem **quase nunca
  tem esse campo preenchido** (ver §1.5). Na prática o import também produz
  `cliente_id: null` quase sempre.
- Também grava `ambiente` (ex.: "Cobertura", "Térreo") e `origem:'vistoria'`
  — isso é o mais próximo que o sistema tem hoje de "onde dentro do
  condomínio" um equipamento fica, mas é um campo de texto livre por
  equipamento, não uma entidade compartilhada entre equipamentos da mesma
  piscina (dois equipamentos da mesma piscina podem ter `ambiente` escrito
  de formas diferentes por técnicos diferentes).

### 1.4 Tela em `index.html` (`page-equipamentos`, linha 1107)

- Formulário (`#eq-form-card`) e grid (`#eq-grid`) confirmam o que o código
  já indicava: cliente (texto+datalist), tipo (select fixo: Motobomba,
  Filtro, Trocador de Calor, Gerador de Cloro, LED Subaquático, Spa/Hidro,
  Sauna, Automação, Outro), marca, modelo, potência, série, instalação,
  garantia, observações, foto.
- **Achado incidental (não pedido, mas relevante para quem for construir a
  Etapa 5):** esse vocabulário de tipos é **diferente** do vocabulário usado
  na vistoria (`VIS_EQUIPAMENTOS_DEFAULT`, `app.js:8903` —
  `motobomba/mot-aux/trocador/filtro/skimmer/iluminacao/automacao/spa/sauna`).
  Não há de-para entre os dois. Se a Etapa 5 vier a ligar `equipamentos` à
  vistoria de verdade (ver §3, opção recomendada), os dois vocabulários vão
  precisar convergir ou ganhar um mapeamento — senão o mesmo trocador de
  calor aparece com nome diferente na ficha e no relatório de vistoria.

### 1.5 `vistorias` — como referencia equipamento hoje

Confirma o que o briefing descreve: **é redigitado**, mas com um detalhe
importante — nem sempre do zero.

- `_montarEquipamentosVistoria()` (`app.js:10442`) monta o array
  `vistorias.equipamentos` a partir de `visEquipSelecionados` +
  `_visEquipsCustom`, que são **estado de formulário em memória**, sem
  nenhum `equipamento_id` apontando para a tabela `equipamentos`.
- Quando a vistoria nasce de um plano (`iniciarVistoriaPlena`,
  `app.js:9465-9534`), os equipamentos são pré-carregados de
  `locais_vistoria.equipamentos` (o jsonb do **plano**, não da tabela
  `equipamentos`) — então dentro de um mesmo local recorrente o técnico não
  redigita a cada mês, mas a lista vive **duplicada e desconectada** da
  ficha técnica: são dois jsonb diferentes (`locais_vistoria.equipamentos` e
  `vistorias.equipamentos`) que nunca apontam para uma linha central em
  `equipamentos`.
- `vistorias.cliente_id`: existe a coluna, é referenciada em código
  (`app.js:2185-2188`, checagem de uso antes de excluir cliente), mas
  **nenhum caminho de escrita a preenche** — confirmado por grep em
  `_montarRecVistoria()` (`app.js:10471-10511`, que monta o registro
  completo da vistoria) e em `selecionarCliModal()` (`app.js:6087-6112`,
  que atende o contexto `'vis'` da busca de cliente e só grava
  `vis-cli`/`vis-loc`, nunca um id). Medido no banco: **1 vistoria em 7**
  tem `cliente_id` preenchido — provavelmente escrito à mão numa sessão de
  teste, não pelo fluxo normal.

### 1.6 `locais_vistoria` — já modela algo de "local", mas não "piscina"

- Schema real (`setup.sql:244-255`): `id, loja_id, cliente, local,
  email_responsavel, tecnico, dia_pref, hora_pref, equipamentos (jsonb),
  agendamento_id, ativo, created_at, updated_at` + `cliente_id` (text,
  acrescentada depois, `setup.sql:169`).
- **Dado real, hoje: 14 linhas.** Nenhum cliente tem mais de um `local` na
  amostra completa (14/14 únicos por `cliente`). O campo `local` guarda o
  **endereço** do condomínio/casa (ex.: `"[endereço de cliente removido]
  —"`), não um nome de piscina (não há nenhum valor como "Piscina
  Adulto" ou "Piscina Infantil" na base atual).
- **Ou seja: `locais_vistoria` hoje modela "endereço/site do cliente onde se
  faz vistoria", não "piscina específica dentro do site".** É o candidato
  mais próximo de virar a entidade "piscina" (é literalmente "1 linha por
  local", já tem `cliente_id`, já tem `equipamentos` jsonb, já tem RLS e
  Realtime configurados), mas reaproveitá-lo exigiria (a) mudar o
  significado de `local` de "endereço" para "identificação da piscina
  dentro do endereço" **ou** (b) adicionar uma coluna de "piscina" dentro
  dele e manter `local` como o endereço do site. Nenhuma das duas é trivial
  sem risco de confundir os 14 registros existentes (que descrevem sites,
  não piscinas) — ver a opção (c) no §2.
- `locais_vistoria.cliente_id`: **0 de 14 preenchido.** Mesma lacuna de
  `vistorias.cliente_id` — a busca de cliente na tela de "Locais" também
  não grava id, só nome/endereço.

### 1.7 Contexto adicional medido (não pedido, mas relevante para dimensionar o esforço)

| Métrica | Valor medido (2026-08-12) |
|---|---|
| `equipamentos` — total | 0 |
| `locais_vistoria` — total | 14 |
| `vistorias` — total | 7 |
| `vistorias.cliente_id` preenchido | 1 de 7 |
| `locais_vistoria.cliente_id` preenchido | 0 de 14 |
| `clientes` — total | 391 |
| `clientes.tipo = 'condominio'` | 13 |
| Campo de volume/m³/litros em qualquer tabela ou tela | **nenhum** — confirmado por grep em `app.js`/`index.html`/`setup.sql` |
| Cálculo de dosagem que consumiria volume | **nenhum existe ainda** — só uma frase de texto fixo no "Dossiê para assembleia" (`app.js:10916`) menciona dosagem, sem número |

**Leitura prática:** o volume da base instalada real é pequeno (7 vistorias,
14 locais, 0 equipamentos cadastrados). Isso reforça a leitura do item 0 —
não há dado de produção para migrar, e o "condomínio com várias piscinas" é
hoje um caso **antecipado pelo briefing, mas ainda não observado** nos 14
locais atuais (nenhum cliente tem 2+ locais na base real). Vale desenhar
para o caso geral, mas não é urgência puxada por incidente concreto — é
puxada por visão de produto, o que é uma boa notícia: dá para desenhar com
calma, sem pressão de dado real desalinhado.

### 1.8 Achado adicional relevante para a decisão: `cliente_id` é geral, não só de `equipamentos`

Vale registrar porque muda o cálculo de risco de qualquer opção que dependa
de FK: **nenhuma tabela do sistema liga de forma confiável a `clientes` por
id hoje.** `orcamentos.cliente_id` = 0% (medido em sessão anterior, CLAUDE.md
linha "cliente_id em 0% dos orçamentos"), `vistorias.cliente_id` = 1/7,
`locais_vistoria.cliente_id` = 0/14, `equipamentos.cliente_id` = N/A (tabela
vazia, mas o único caminho de escrita que preenche o campo depende de
`vistorias.cliente_id`, que está vazio). O sistema inteiro identifica
cliente por **nome normalizado** (`_normCliente`/`_normNome`, mencionado no
`CLAUDE.md` na seção "Vistoria → Orçamento → Dossiê"), não por id. Qualquer
modelo novo de piscina que dependa de `cliente_id` confiável herda essa
mesma fragilidade — não é um problema que a Etapa 5 cria, mas é um problema
que ela vai *tropeçar* se assumir que `cliente_id` já é fonte de verdade.

---

## 2. Opções de modelagem

### (a) Campo `volume_m3` direto em `clientes`

- **Prós:** menor esforço possível — 1 coluna, 1 campo no form de cliente,
  nenhuma tela nova. Resolve o caso mais comum hoje (residência ou
  condomínio com 1 piscina — que é 100% dos 14 locais reais atuais).
- **Contras:** quebra exatamente no caso que o próprio briefing chama de "a
  maior vantagem de longo prazo" — condomínio com várias piscinas de
  volumes diferentes (adulto/infantil, ou torres com piscinas próprias).
  Também não dá para anexar `equipamentos` a uma piscina específica — eles
  já se ligam a `cliente_id`, então ficariam no mesmo nível "achatado" que
  `volume_m3`. Resolve dosagem só no caso trivial e adia o problema real
  para quando o primeiro condomínio com 2 piscinas aparecer — nesse
  momento, qualquer orçamento/dossiê que já tenha usado `clientes.volume_m3`
  fica ambíguo (qual das piscinas é essa?).

### (b) Nova entidade `piscinas` (`cliente_id`, nome/identificação, `volume_m3`, `tipo_tratamento`) + `equipamentos.piscina_id` opcional

- **Prós:** modelagem correta — 1 condomínio → N piscinas → N equipamentos
  por piscina, sem achatar nada. `piscina_id` opcional em `equipamentos`
  significa que equipamento sem piscina definida (ex.: bomba de área comum
  não ligada a uma piscina específica) continua válido. Suporta o cálculo de
  dosagem/consumo por piscina de verdade (cada piscina tem seu volume, seu
  tratamento).
- **Contras:** mais tabelas, mais telas, mais pontos de integração — precisa
  decidir onde a piscina é selecionada (form de equipamento, form de
  vistoria, form de orçamento?) e isso tem custo de UX (mais um picker,
  mais um select) numa base de usuário pequena (técnicos de campo, PWA no
  celular) onde cada campo extra é atrito real. Corre o risco clássico
  deste projeto: **schema criado e nunca consumido** (o mesmo padrão já visto
  em `equipamentos.cliente_id` e em `vistorias.cliente_id` — coluna existe,
  ninguém escreve). Se `piscinas` nascer sem um fluxo de UI que force o
  técnico a escolher a piscina (ex.: obrigatório ao vincular equipamento),
  vira mais uma tabela zerada.

### (c) Reaproveitar `locais_vistoria` como a entidade "piscina" (variação da b, mas evolutiva em vez de nova do zero)

Não estava nas duas alternativas sugeridas na tarefa, mas emergiu direto da
auditoria do §1.6: `locais_vistoria` já é, estruturalmente, "1 linha por
lugar que se visita, ligada a um cliente, com uma lista de equipamentos
jsonb". A diferença para "piscina" é semântica, não estrutural.

- **Variação c1 — renomear o conceito:** interpretar cada linha de
  `locais_vistoria` como "1 piscina" (não "1 endereço"), acrescentar
  `volume_m3` e `tipo_tratamento` nela, e o condomínio com 3 piscinas passa
  a ter 3 linhas de `locais_vistoria` (hoje teria só 1, com endereço
  repetido nas 3). **Risco:** os 14 registros existentes representam
  endereços, não piscinas — recadastrar retroativamente exige decisão
  humana por cliente (mesma cautela que o próprio `CLAUDE.md` já aplica a
  todo backfill de identidade: "nunca automático").
- **Variação c2 — duas camadas:** manter `locais_vistoria` como "site/
  endereço" (significado atual, sem mudar os 14 registros) e criar
  `piscinas` como filha de `locais_vistoria` (`local_id`, não
  `cliente_id` direto) — resolve o condomínio com N piscinas no MESMO
  endereço sem redefinir o que já existe. É estruturalmente igual à opção
  (b), só que ligada a `locais_vistoria` em vez de `clientes` diretamente,
  o que aproveita o vínculo que a vistoria já usa
  (`window._visLocalId`/`iniciarVistoriaPlena`) para achar a piscina certa
  quando o técnico abre uma vistoria a partir do plano.

---

## 3. Recomendação

**Opção (b)/(c2): entidade `piscinas` nova, ligada preferencialmente a
`locais_vistoria` (quando o plano de vistoria já existir) com `cliente_id`
como alternativa direta para quem cadastra equipamento sem passar por um
plano de vistoria.** Não a (a).

Motivo central: o próprio propósito da Etapa 5, nas palavras do briefing, é
"conhecer os ativos do cliente melhor que ele" e "destravar dosagem,
dimensionamento, preço e consumo teórico" — todos esses cálculos são **por
piscina**, não por cliente. Um condomínio com piscina adulto de 120m³ e
piscina infantil de 15m³ tem dosagem de cloro 8x diferente entre as duas; um
`clientes.volume_m3` único produziria um número errado por definição, não
por falta de cuidado na implementação. A opção (a) resolveria o problema
errado rápido.

Entre (b) puro e (c2), prefiro (c2) — ligar a `locais_vistoria` quando
existir plano — por três razões medidas nesta auditoria, não por preferência
abstrata:
1. `locais_vistoria` já é o único lugar do sistema onde "site do cliente"
   tem uma linha própria persistente com Realtime e RLS prontos — reaproveitar
   a ligação evita recriar esse cabo de novo.
2. A vistoria (o fluxo que mais frequentemente *observa* o estado real dos
   equipamentos, com foto e status) já navega por `window._visLocalId`. Se
   `piscinas` pendura de `locais_vistoria`, a tela de vistoria já sabe
   automaticamente "quais piscinas existem neste local" sem precisar de um
   picker novo — só filtra por `local_id`.
3. Nem todo cliente tem um plano de vistoria (só 14 hoje, mas `clientes` tem
   391) — então `piscinas.cliente_id` continua obrigatório como alternativa
   para quem cadastra equipamento avulso (fluxo de `salvarEquipamento`) sem
   nunca ter um `locais_vistoria` associado. `piscinas.local_id` fica
   **opcional**, preenchido quando existir.

**Ressalva que não é minha para decidir:** dado o achado do §1.8 (nenhuma
tabela do sistema realmente usa `cliente_id`/FK hoje — tudo roda por nome
normalizado), quem construir deve decidir explicitamente **se vai forçar
`piscinas.cliente_id` a ser preenchido de verdade desta vez** (com um picker
real de cliente, não um datalist de texto livre como o de `eq-cli-nome`
hoje) — senão `piscinas` nasce com o mesmo problema que `equipamentos`,
`vistorias` e `locais_vistoria` já têm: coluna de id que existe e nunca é
escrita.

---

## 4. O que muda em cada tela/função, se (c2) for a escolha

Lista para quem for construir não precisar reauditar do zero. **Nada disto
foi implementado nesta sessão.**

### Schema (nova migração, aditiva)
- Nova tabela `piscinas`: `id uuid`, `cliente_id text` (mesmo padrão de
  `equipamentos.cliente_id` — text, porque cliente local pode ter id
  `cli_<timestamp>` antes de sincronizar), `local_id text` (nullable, FK
  lógica para `locais_vistoria.id`), `nome text` (ex.: "Piscina Adulto"),
  `volume_m3 numeric`, `tipo_tratamento text`, `loja_id text`, `ativo
  boolean default true`, `data_criacao timestamptz default now()`.
- `equipamentos` ganha `piscina_id uuid` nullable — **aditivo**, não quebra
  os 0 registros existentes nem o import de vistoria.
- RLS: mesma policy `anon full access` das demais tabelas (consistente com
  o resto do banco — trocar isso é decisão à parte, "7.1 Segurança", já
  registrada como pendente em outro lugar do `CLAUDE.md`).

### `app.js`
- `salvarEquipamento()` (linha ~8188): form ganha select de piscina
  (populado a partir de `piscinas` filtradas por cliente escolhido);
  `dados` passa a incluir `piscina_id`. Precisa decidir UX: obrigatório ou
  opcional (equipamento de área comum sem piscina específica deve
  continuar cadastrável).
- `abrirFormEq()` (linha ~8122): ao editar, pré-selecionar a piscina salva.
- `importarEqDaVistoria()` (linha ~8310): hoje grava `ambiente` como texto
  livre por equipamento vindo da vistoria — precisaria decidir se
  `ambiente` continua existindo em paralelo (é mais granular, "qual parte
  da piscina") ou se vira redundante com `piscina_id` uma vez que a
  vistoria também souber apontar para uma piscina.
- `_montarRecVistoria()` / `iniciarVistoriaPlena()` (linhas ~10442-10511 e
  ~9465-9534): se a vistoria também passar a referenciar `piscina_id` (não
  só `local_id`), a pré-carga de equipamentos poderia vir de
  `equipamentos` filtrados por piscina em vez do jsonb duplicado de
  `locais_vistoria.equipamentos` — isso fecharia de vez a duplicação
  descrita no §1.5, mas é uma mudança de fluxo maior, não só de schema, e
  pode ficar para uma etapa seguinte se o escopo desta for só a ficha
  técnica.
- Novo CRUD de piscina (`salvarPiscina()`, `excluirPiscina()`, seguindo o
  mesmo padrão local-first + `dbInsert`/`dbUpdate` resiliente que todo o
  resto do app usa — nunca `db.from().insert()` cru, por causa da REGRA DE
  OURO já documentada no `CLAUDE.md`).
- `filtrarClientesEq()` (linha ~8180): se o picker de cliente virar real
  (ver ressalva do §3), essa função e o `<datalist>` de `eq-cli-nome`
  precisam virar uma seleção que também grave `cliente_id`, não só nome.

### `index.html`
- `page-equipamentos` (linha ~1107): novo campo/select de piscina no
  `#eq-form-card`.
- Nova seção/aba de gestão de piscinas — dentro de `page-equipamentos` (aba
  extra) ou dentro da tela de cliente/local de vistoria (decisão de UX, não
  técnica — onde faz mais sentido o gestor cadastrar "esta piscina tem
  120m³").
- Se ligar a `locais_vistoria`: tela de "Meus Locais" (vistorias) ganha
  onde listar/cadastrar as piscinas daquele local.

### Não muda (confirmado nesta auditoria, para não gerar trabalho desnecessário)
- `styles.css`: nenhuma classe nova estritamente necessária — reaproveita
  `.card`, `.row`, `.fl` já existentes (padrão de qualquer form novo neste
  código).
- `sw.js`: só precisa bump de `CACHE` no deploy, como qualquer mudança em
  `app.js`/`index.html` — não é específico desta feature.
- Orçamento/dosagem/precificação: **nenhum consumidor existe ainda** (§1.7)
  — então não há função de cálculo para adaptar nesta etapa. A Etapa 5
  entrega só a captura do dado (ficha técnica); o consumo (dosagem,
  dimensionamento, preço automático) é trabalho de uma etapa seguinte, uma
  vez que o volume exista de verdade em produção.

---

## 5. Resumo para quem só quer a conclusão

- `equipamentos` continua zerado hoje (0 registros) — o achado do briefing
  segue válido, e isso é bom: dá para desenhar o modelo novo sem migração de
  dado real.
- `equipamentos.cliente_id` existe no schema mas não é escrito por nenhum
  caminho de código hoje — o "vários equipamentos por condomínio" funciona
  na prática por `cliente_nome` (texto), não por id.
- Não existe hoje nenhuma noção de "piscina" como entidade — `locais_vistoria`
  é o mais próximo (1 linha por endereço do cliente, já com `cliente_id` e
  `equipamentos` jsonb), mas modela "site visitado", não "piscina dentro do
  site". Nenhum cliente da base real (14 locais) tem mais de 1 hoje.
- Recomendo criar `piscinas` como entidade própria
  (`cliente_id`, `local_id` opcional, `nome`, `volume_m3`,
  `tipo_tratamento`), com `equipamentos.piscina_id` opcional apontando para
  ela — não um campo achatado em `clientes`. Decisão final e construção
  ficam para quem pegar a etapa.
