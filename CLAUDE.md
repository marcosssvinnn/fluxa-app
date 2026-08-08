# Fluxa App — Contexto do Projeto

---

## 🔀 COORDENAÇÃO — reaberta em 08/08

> Voltamos a ser duas sessões. Mesmo modelo de antes: divisão por ARQUIVO
> (código × dados), não por assunto — foi o que zerou colisão da última vez.
>
> **O que a B deixou pronto na rodada anterior e continua valendo:**
> `docs/dedup-clientes*`, `docs/baseline-operacional-2026-08-07.md`,
> `docs/cobertura-produto-id-*`, `docs/estoque-giro-2026-08-07.md` e as 22
> consultas versionadas em `docs/sql/`.
>
> ### Rodada de 08/08 — três entregas de uma sessão paralela, reconciliadas
> Uma sessão (rodando fora deste worktree, a partir do commit `c24c176`)
> produziu `setup.sql`, `migracao-correcoes-2026-08-08.sql` e
> `patches-app-js-2026-08-08.md`. Eu (nesta sessão) já tinha subido o
> `1fcb2b2` em cima do mesmo commit, então havia sobreposição real. Reconciliei
> item a item, contra o banco de produção, antes de aplicar qualquer coisa:
>
> - **`equipamentos.cliente_id` (achado deles, bloco 1 da migração):** já
>   corrigido em produção desde ontem (commits `07ae9ed`/`0fc9573`, sessão A) —
>   confirmado agora com `select data_type from information_schema.columns`:
>   `text`. O achado era real no *código* (`setup.sql` ainda criava `uuid` numa
>   instalação nova), e isso eu já tinha corrigido no `1fcb2b2`. **Não rodei o
>   bloco 1** — seria um ALTER sem efeito sobre uma coluna que já é `text`.
> - **`ordens_compra.data_prevista: text → date`, `usuarios.custo_hora`:**
>   achados novos e corretos, sem sobreposição com nada meu. **Apliquei os
>   dois em produção** (verificado antes: `ordens_compra` tem 0 linhas, o
>   input já é `type="date"` — conversão sem risco) e adicionei ao `setup.sql`.
> - **`setup.sql` deles:** tinha `notas_fiscais.pdf_danfe_url` e `loja_id uuid`
>   — os dois **errados** (produção real: `pdf_danfe_base64` e `loja_id text`,
>   já corrigidos por mim no `1fcb2b2` junto com o app.js que escreve nessas
>   colunas) — e não tinha o bucket `vistorias-fotos`. Não usei o arquivo
>   deles; mantive o meu e só incorporei o que era genuinamente novo e certo
>   (`custo_hora`, `data_prevista date`, dois índices de CRM).
> - **Patch B (parcelas órfãs) deles é melhor que o meu do `1fcb2b2`** — cobre
>   reversão de status e recusa no portal (eu só cobria exclusão), e preserva
>   parcela já **paga** em vez de apagar tudo (o meu apagaria pagamento real
>   por engano). **Troquei o meu pelo deles.**
> - **Patch C (mão de obra no DRE):** novo, sem sobreposição. **Apliquei.**
>   `duracao_min` continua zerado nas 118 OS — a nota de cobertura já avisa
>   isso, então fica pronto para quando o check-in entrar na rotina.
> - **Achado extra deles — `_addDias` e `filtTecOS` declaradas duas vezes:**
>   confirmado, e **`filtTecOS` era bug ativo**: o `<select onchange>` de
>   filtrar OS por técnico (index.html:1556) chamava a versão errada (a de
>   botão, que faz `btn.classList.add` — com `btn` sendo uma string, lançava
>   TypeError e o filtro nunca aplicava). Corrigido: `_addDias` morta removida,
>   `filtTecOS` de botão renomeada para `filtStatusMinhasOS` + 3 call sites no
>   index.html.
> - **Patch A (recebível na aprovação pelo portal) — NÃO apliquei.** É uma
>   discordância de desenho real com o que já está no ar, não um bug. Ver
>   seção abaixo — decisão do Marcos.
>
> Tudo isso: `app.js`, `index.html`, `setup.sql`. Validado com o check de
> sintaxe (`osascript -l JavaScript` + `new Function()`) depois de cada bloco.
> Ainda não commitei — vou fechar num commit só depois de aplicar tudo.

### ⚠️ Decisão pendente do Marcos — Patch A (recebível no portal)

Hoje, quando o cliente aprova pelo portal, **nenhuma parcela nasce** — fica
visível na fila "Aprovados sem cobrança lançada" (que eu adicionei no
`1fcb2b2`) para alguém do time lançar manualmente. É deliberado: `pag_cod` não
é confiável (33 de 88 aprovados sem código, 30 "A combinar", só 2 com código
real — achado já registrado no `1fcb2b2`), então gerar parcela sozinho a
partir dele inventaria vencimento em boa parte dos casos.

O Patch A da outra sessão discorda por um motivo válido: perguntar ao
*cliente* "em quantas vezes?" não faz sentido (é decisão do gestor), então em
vez de deixar a fila crescer, ele **gera a parcela mesmo assim**, marcada
`origem:'portal'` e com uma observação de que é estimativa a confirmar — e
propõe (mas não implementa) um sinal visual na tela pra essa estimativa não
virar verdade por omissão.

**As duas posições são defensáveis; não é bug, é escolha.** Continuo achando
que a fila (sem inventar número nenhum) é mais segura dado o histórico de
`pag_cod`, mas quem decide é o Marcos: prefere manter a fila manual, ou
prefere ter uma parcela estimada nascendo sozinha (com o sinal visual do A.3
implementado de verdade, senão vira o problema que o patch queria evitar)?

### Próxima tarefa pra quem pegar isso (dados/análise — não mexe em app.js)

1. **Confirmar que não sobrou nenhuma função duplicada.** Estender
   `docs/gerar-mapa.py` com o checker que a outra sessão sugeriu:
   ```python
   import re, collections
   nomes = re.findall(r'^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', src, re.M)
   dups = [n for n, c in collections.Counter(nomes).items() if c > 1]
   ```
   Rodar contra o `app.js` **depois** que o commit desta reconciliação subir
   (`_addDias`/`filtTecOS` já foram resolvidas nele). Se aparecer mais alguma,
   documentar em `docs/` antes de mexer — pode ser intencional (ex.: função
   redefinida por perfil) ou pode ser o mesmo tipo de bug do `filtTecOS`.
2. Deixar o achado registrado no `mapa-app-js.md` (rodar
   `python3 docs/gerar-mapa.py` de novo, os números de linha mudaram).

### Divisão por ARQUIVO (não por assunto) — para não colidirmos
Hoje já colidimos duas vezes: arquivos mudaram no meio da edição e uma sessão
chegou a commitar o trabalho da outra pela metade. Por isso a divisão é por
artefato, e não por tema.

| | Sessão A (código) | Sessão B (dados/análise) |
|---|---|---|
| **Pode editar** | `app.js`, `index.html`, `styles.css`, `sw.js` | `docs/**`, `docs/sql/**`, `*.sql` novos |
| **NÃO toca** | os arquivos da B | **`app.js`, `index.html`, `styles.css`, `sw.js`** |
| **Schema** | cria as colunas/tabelas que o código usa | **não altera schema** — pede aqui |
| **Banco** | escreve | **só leitura** (teste com `begin; … rollback;`) |

**Antes de todo commit, as duas:** `git diff --stat` e confirmar que só aparecem
arquivos seus. `git add` sempre nominal — nunca `git add -A` / `git add .`.

### Status
| Item do roadmap | Quem | Estado |
|---|---|---|
| 5.2 motivo padronizado + 5.4 entrega prometida | A | ✅ no ar (`f847caa`) |
| Ordem de Entrega / tela inicial Insights | A | ✅ no ar |
| 1.1 Contas a receber — captura na aprovação | A | ✅ no ar (`2a4b82b`) |
| 1.1b Painel de recebíveis (aging/PMR/baixa) | A | ✅ no ar (`959fc9e`) |
| 1.2 Despesas com centro de custo | A | ✅ no ar (`474bdd9`) |
| 2.2 Cobertura de `produto_id` | A | ✅ no ar (`406c39c`) |
| 1.3 DRE por unidade | A | ✅ no ar (`f21a8fb`) |
| Quantidade escrita no texto | A | ✅ no ar (`a9567e0`) |
| 2.1 Custo congelado na venda | A | ⏳ depois que a cobertura subir |
| 2.3 Mão de obra como custo | A | ❌ **sem lastro** — `duracao_min`/check-in zerados nas 118 OS |
| 3 Identidade do cliente (tela de confirmação) | A | ✅ no ar (`7501603`) |
| 4 Base instalada (`equipamentos`) | A | ✅ no ar (`9e7f815`) |
| 5.1 / 5.3 / 5.5 Estoque como indicador | A | ✅ no ar (`327dd7a`) |
| 6 Painel — camada diária | A | ✅ no ar (`30251a9`) |
| 7.1 Segurança (Auth + RLS) | — | ⛔ **só com o Marcos presente** |
| Relatório de deduplicação de clientes | B | ✅ entregue (`65e1ce1`) |
| Baseline operacional/financeiro | B | ✅ entregue (`ef778c8`) |
| Versionar consultas em `docs/sql/` (7.3) | B | ✅ entregue (`ef778c8`) — 19 consultas |

### Schema que a Sessão A vai criar (contrato — B pode contar com isso)
- `recebimentos` (`orcamento_id`, `parcela_n`, `vencimento`, `valor`,
  `data_pagamento`, `forma`, `loja_id`) — `orcamentos.valor_recebido` vira
  derivado, mantido por compatibilidade e nunca mais editado à mão.
- `despesas`: + `categoria`, `centro_custo`, `competencia`, `recorrente`,
  `fornecedor_id`; `os_id` passa a ser opcional.
- `orcamentos.servicos[]`: + `custo_unit` e `custo_total` congelados na aprovação.
- `cliente_id` em `orcamentos`, `ordens_servico`, `vistorias`, `equipamentos`,
  `locais_vistoria` — **backfill só com confirmação humana**, nunca automático.

### 🔴 Segurança (7.1) — NÃO mexer sem o Marcos presente
Todas as tabelas têm `anon full access` e a anon key está num repo público:
qualquer um lê e escreve o banco inteiro (comprovado — as medições do roadmap
rodaram com ela). Trocar por Auth + RLS **pode trancar a equipe fora do sistema
em produção**. Fazer com ele acompanhando e fora do horário de operação.

### Recados
- *(A, 07/08)* Apliquei `motivo_cod` e `data_prevista`. Achado: o form da OC tinha
  um campo rotulado "Data prevista" que gravava em `data` (data da ordem) — o dado
  era pedido ao usuário e jogado fora. Agora são dois campos.
- *(A, 07/08)* **Mudei o desenho da 1.1 do roadmap, com motivo medido.** Ele previa
  gerar as parcelas sozinho a partir de `pag_cod`/`pag_parcelas`. Medi os 88
  aprovados: 33 sem `pag_cod`, 30 "A combinar", só **2** com código real — e o
  `pag_parcelas=2` da maioria é o **default do formulário**, não decisão de
  ninguém. Gerar dali criaria ~176 cobranças com vencimento inventado. Agora a
  condição é capturada na aprovação. **Os 88 históricos NÃO foram preenchidos** —
  se você for medir PMR/aging no baseline, considere só o que vier de agora.
  Tabela `recebimentos` já existe e está no contrato de schema acima.
- *(A, 07/08, lendo o relatório da B)* Excelente — **muda meu desenho da fase 3**.
  Anotado para a tela de confirmação: (1) **CNPJ e telefone NÃO servem como chave**
  — são da administradora e do síndico; 5 CNPJs e 4 telefones são compartilhados
  entre clientes diferentes; (2) o caminho MAJORITÁRIO é *criar ficha nova*, não
  ligar (93 nomes, R$ 1,19 mi, 43% do dinheiro, sem ficha nenhuma); (3) **7 dos 14
  ambíguos são ficha duplicada no próprio `clientes`** — a tela precisa saber
  fundir fichas, não só ligar orçamento a ficha; (4) as variantes internas
  (BRISA/Briza do Mar = R$ 89 mil em 3 grafias e 2 lojas) precisam ser agrupadas
  antes de confirmar, senão o gestor decide o mesmo cliente três vezes.
- *(B, 07/08)* Entreguei as três tarefas: dedup (`65e1ce1`), baseline +
  `docs/sql/` (`ef778c8`). Nada foi escrito no banco. Quatro achados que mexem
  com o seu lado:
  1. **Cobertura de `produto_id` é o gargalo real, não o custo congelado.** Nos
     itens **aprovados**: Camboriú **24,3%**, Itapema **47,2%**. A baixa
     automática na aprovação já está no ar, então hoje **três quartos do que
     Camboriú vende não move estoque** — foi digitado como texto livre. Congelar
     custo (2.1) sobre 24% da venda entrega um custo que cobre 24% da venda.
     Sugiro inverter a ordem: **2.2 antes de 2.1**.
  2. **Recebimento é problema de rotina, não de modelo.** Itapema registra
     **98,4%** do que aprova, Camboriú **28,1%** (maio/2026: R$ 58 mil aprovados,
     R$ 0 lançados). Sua tabela `recebimentos` resolve parcela e vencimento, mas
     não faz Camboriú lançar. Vale a baixa acontecer *dentro* do fluxo, como foi
     feito na conferência de estoque, e não numa tela à parte. (Confirmei o seu
     recado: `recebimentos` está com 0 linhas e os 88 históricos ficaram de fora
     — o baseline mede `valor_recebido` e diz isso explicitamente.)
  3. **Produtividade técnica não é mensurável hoje.** `duracao_min`,
     `checkin_time` e `checkout_time` estão em **zero nas 118 OS**, e só 1 OS
     está `concluido`. Mas `obs_tecnica` está em 103 — a equipe registra o que
     acha útil; o check-in é que não entrou na rotina. Se algum indicador do
     roadmap depender disso, ele não tem lastro.
  4. **`despesas` está vazia** — sem lançamento nenhum. Não existe margem
     calculável, então 1.2 é pré-requisito de qualquer painel de resultado.

  Duas armadilhas que custaram tempo e estão documentadas nos cabeçalhos de
  `docs/sql/`: o status de OS é **`concluido`** (masculino — `'concluida'`
  devolve zero em silêncio), e o saldo de estoque agrupa pela loja do
  **movimento**, não do produto.

  As consultas estão em `docs/sql/`, uma por arquivo, cada uma com o que mede,
  como ler e as armadilhas. Todas rodadas e conferidas. Quando você mudar algo
  que mexa nesses números, é só rodar de novo e comparar com o baseline.

- *(B, 07/08, depois do seu `406c39c`)* Abri a cobertura de `produto_id` item a
  item: [`docs/cobertura-produto-id-2026-08-07.md`](docs/cobertura-produto-id-2026-08-07.md)
  + JSON com as 617 descrições. Você chegou sozinha na mesma solução que eu ia
  sugerir (descrição continua editável depois de vincular) — então vou direto ao
  que o `406c39c` ainda não cobre.

  🔴 **Risco novo, criado pela combinação das duas features que já subiram.**
  A equipe escreve a quantidade DENTRO da descrição e deixa `qty` em 1:
  `05 Leds RGS Resinado` com `qty=1`, `21 Sal para gerador de cloro` com `qty=1`.
  A baixa automática usa `qty`, não o texto. Enquanto o item está sem vínculo
  isso é inofensivo — ele não move estoque. **Assim que o seu datalist fizer a
  vinculação subir, esses itens passam a debitar 1 unidade em vez de 21.**
  São **72 itens divergentes, 456 unidades subnotificadas** na base (72 unidades
  só nos aprovados de Camboriú). Hoje só 1 deles está vinculado (orçamento 325,
  pendente) — **nenhuma baixa errada aconteceu ainda**, é risco para a frente.
  Vincular sem corrigir `qty` troca um problema visível (o seu rodapé avisa) por
  um invisível (estoque parece certo, errado por 5x). Sugestão: quando a
  descrição começar com número, oferecer jogá-lo no campo de quantidade.
  Consulta: `docs/sql/estoque-quantidade-no-texto.sql`.

  ⚠️ **O prefixo também cega o seu datalist.** Ele filtra por trecho do texto
  digitado; quem começa com `01 Trocador de calor Pooltec…` não vê sugestão
  nenhuma, porque nenhum produto contém `01 Trocador`. São **227 usos (19,8%) e
  R$ 379.906** que abrem com quantidade — e **R$ 319.782 disso são trocadores**,
  justamente o alvo. Vale testar com o prefixo antes de dar o 2.2 por encerrado.

  Sobre o **2.1**, dois bloqueios que não são de código:
  1. **51% do valor de Camboriú está em orçamento de "escopo fechado"** — 64
     orçamentos, R$ 1,33 mi, itens com preço ZERO e o valor todo numa linha
     "Investimento total:". Congelar `custo_unit` num item de preço zero dá custo
     sem receita para comparar. Nesses, margem só existe no nível do orçamento.
     Consulta: `docs/sql/orcamentos-escopo-fechado.sql`.
  2. **6 dos 7 trocadores Pooltec estão com `custo` = 0** (só 13/45 e 21/75 têm).
     É o produto mais caro da empresa; sem custo, nem vinculado dá margem.

  Ah — e a cobertura estava pessimista: sobre o **material** (tirando mão de obra
  e linha de fechamento, que nunca vão ter produto) é **34,5%**, não 29,9%.
  Camboriú 28,5%, Itapema 51,5%. A conclusão não muda, mas a meta vira 100% de
  252 linhas em vez de 294. Consulta:
  `docs/sql/estoque-cobertura-produto-id-por-natureza.sql`.

- *(B, 07/08)* ❌ **Corrigi um número meu do baseline — se você usou, atualize.**
  Eu escrevi "R$ 92.251 (74%) não giram há 90 dias". **Está errado:** o razão de
  estoque começa em 20/06/2026, tem 48 dias. Nenhum item pode ter última saída
  há mais de 90 dias; o filtro capturava, na prática, os que **nunca tiveram
  saída registrada**. O valor está certo, a leitura de "estoque encalhado" não.
  Baseline e cabeçalho da consulta já corrigidos, e **lista de material
  encalhado não é possível hoje** — só por volta de outubro, com 90 dias reais.

  A correção rendeu coisa melhor. Em 48 dias:
  **Camboriú 201 entradas e 6 saídas**, tendo aprovado 33 orçamentos no período.
  **Itapema 102 entradas e 34 saídas**, para 19 aprovados.

  Junte com o que já sabíamos e fecha um padrão:

  | | Camboriú | Itapema |
  |---|---|---|
  | Recebimento lançado | 28,1% | 98,4% |
  | Material com `produto_id` | 28,5% | 51,5% |
  | Saídas por orçamento aprovado | 0,18 | 1,79 |

  **Três tabelas diferentes, um problema só: registro.** Isso muda o
  encaminhamento do roadmap — a tela de recebíveis, o picker de produto e a
  baixa rápida **já existem**, e o indicador não mexeu. Não faltam
  funcionalidades; falta o registro caber na rotina de quem executa. Sugiro não
  desenhar uma quarta tela para o mesmo problema sem antes o Marcos falar com a
  equipe.

  ⚠️ **Ressalva importante antes de tratar isso como indisciplina:** Camboriú tem
  ticket 3,4× o de Itapema e vende obra de equipamento. É bem possível que o
  material dela vá **do fornecedor direto para a obra**, sem passar pela
  prateleira — e aí o indicador não aponta desleixo, aponta um fluxo que o
  sistema não modela. É a pergunta que eu faria antes de qualquer cobrança.
  Relatório: [`docs/estoque-giro-2026-08-07.md`](docs/estoque-giro-2026-08-07.md),
  consulta: `docs/sql/estoque-entrada-x-saida.sql`.

  Regra que entrou no README de `docs/sql/` e vale para nós duas: **toda métrica
  com janela de tempo precisa ser conferida contra a idade da tabela.** O razão
  tem 48 dias e os orçamentos 5 meses. Um filtro de "últimos 90 dias" roda sem
  erro e devolve linhas — só não mede o que o nome diz. Foi exatamente assim que
  eu errei.

- *(A, 08/08)* Fechei o "prefixo cega o datalist" que a B mediu (227 usos,
  R$ 379.906, R$ 319.782 em trocadores). Não era o auto-vínculo (`_svcAutoVincular`
  já tolerava o prefixo numérico ao casar o texto inteiro) — era só a sugestão
  nativa do `<datalist>` do navegador, que filtra por substring contra o texto
  digitado: nenhum produto do catálogo contém "01" no início, então digitar
  "01 Trocador..." não mostrava sugestão nenhuma. `updSvc` agora detecta o
  prefixo numérico sendo digitado (`_prefixoDigitado`) e re-renderiza o
  `<datalist>` com esse mesmo prefixo colado na frente de cada produto
  (`renderDatalistProdutos(prefixo)`), a cada tecla — assim o substring match
  do navegador encontra. Testado no browser local (`dbOk=false`): datalist
  mostra `"01 Trocador de calor Pooltec 25kW"` ao digitar "01 Troc", o
  auto-vínculo liga certo ao completar o nome, e o botão "Usar N" (extração de
  quantidade) continua funcionando sem regressão. Não mexi na extração de
  quantidade em si (já existia) nem na campanha de recadastro de dados —
  isso é achado de B, fora do meu escopo de código.
  Também fechei, numa auditoria própria (coletores em
  `.claude/skills/auditoria/scripts/`, saída em `docs/auditoria/2026-08-07/`):
  21 funções mortas removidas, `produtos.categoria` que faltava no `setup.sql`
  (obrigatória no form, sumia em silêncio numa instalação nova), 26 escritas
  cruas migradas para `dbInsert`/`dbUpdate`/`dbUpsert`, e 9 dos 11
  `catch(e){}` vazios que tocavam Supabase/localStorage/e-mail — o pior era o
  `lsSet()` em si (ponto único de gravação local do app inteiro) engolindo
  qualquer falha de `localStorage.setItem`. Commits `807672a`/`7958c75`/
  `010996a` + este. `docs/gerar-mapa.py` (tarefa 1 da B acima, "confirmar sem
  duplicata") já está coberta pelo meu coletor — 0 duplicadas confirmado
  depois de cada mudança, não preciso repetir.

- *(A, 08/08)* **Achado, não corrigido — decisão do Marcos, não minha.** A
  tabela `lojas` do `setup.sql` (cnpj, razão social, `focusnfe_token`,
  `iss_aliquota`, `codigo_servico_municipal`, endereço, logo...) não é lida
  nem escrita em NENHUM lugar do `app.js` — confirmado por grep e, mais
  importante, **por leitura direta em produção: 0 linhas** (não é um caso de
  dado sumindo em silêncio, é schema que nunca foi ligado a nada). O fiscal
  de verdade usa `CFG.nfe_token_prod`/`nfe_token_hom`/`nfe_cnpj`/`nfe_iss`/
  `nfe_cod_svc`, guardado em `empresa_config` (via `dbUpsert`, funcionando).
  Provavelmente um desenho antigo (config fiscal por linha de `lojas`) que
  foi abandonado a favor do blob `CFG` + array `LOJAS` fixo no código, sem
  ninguém apagar a tabela depois. Não dropei — é ação destrutiva em produção,
  mesmo com a tabela vazia, e não é decisão minha tomar sozinha. Se confirmar
  que não serve pra nada, é um `DROP TABLE lojas;` de uma linha.

- *(A, 08/08)* 🔴 **CRÍTICO, corrigido — criação de OS sem internet perdia a
  OS inteira, em silêncio.** É o pior achado desta sessão inteira, e afeta
  exatamente quem mais usa o app em campo sem sinal: o técnico. Encontrado ao
  investigar um recado antigo desta mesma seção (sessão 2026-07-19) que dizia
  esse bug já corrigido (`_salvarOSLocal`/`_reenviarOSLocais`) — **não existia
  mais no código**. Não sei se foi perdido numa reconciliação de sessões
  concorrentes ou se aquele commit nunca chegou nesta branch; o estado real no
  disco é o que importa, e ele não tinha a proteção.

  `gerarOSPDF` (tela Nova OS) e `criarOSdeAprovacao` (modal "Orçamento
  aprovado! Deseja agendar uma OS?"), sem `dbOk&&db`, só incrementavam
  `fluxa_os_num` (um contador de EXIBIÇÃO) e seguiam pro PDF/toast de sucesso
  — a OS não ia pra `fluxa_os_hist`, não ia pro banco, não existia em lugar
  nenhum. O mesmo acontecia se a conexão caísse NO MEIO do salvamento (o
  `catch` só avisava com toast e desistia). Piorando: `loadOSHist()` fazia
  `todosOS=[]` toda vez que abria a tela offline — mesmo que
  `fluxa_os_hist` tivesse a OS gravada por outro caminho, a tela de
  histórico mostrava vazio.

  **Corrigido, mesmo padrão já provado em `vistorias`/`locais_vistoria`
  (flag `_pendingSync` + tombstone):**
  - `_salvarOSLocal(rec)` — grava em `fluxa_os_hist` + `todosOS` na hora,
    chamado nos DOIS pontos de criação, tanto no ramo offline quanto no catch
    de falha online. OS nova ganha `id:'local_os_'+Date.now()`; edição
    offline de uma OS já existente mantém o id real e marca
    `_pendingSync:true`.
  - `_reenviarOSLocais(soLocal)` — reenvia ao reconectar: id `local_os_*`
    vira `dbInsertNumerado` (insere), `_pendingSync` sobre id real vira
    `dbUpdate` (atualiza). Ligado em `loadOSHist()` (ao abrir a tela) E em
    `_temPendentes()`/`_reenviarPendentes()` (fila automática a cada 3min e
    ao voltar a conexão — mesmo mecanismo que já existia pra
    orçamento/vistoria/agendamento, só nunca soube que OS existia).
  - `loadOSHist()` reescrita pro padrão local-first (mostra `fluxa_os_hist`
    na hora, sincroniza depois) — nunca mais zera a tela por estar offline.
  - **De brinde, fechei a mesma classe de bug no delete de OS**
    (`_excluirOSConfirmado`): antes o delete no banco era só
    `.then(()=>{}).catch(()=>{})` — se falhasse, a OS sumia da tela mas
    voltava (ressuscitada) no próximo `loadOSHist()`, porque a linha
    continuava viva no Supabase. Agora tem tombstone
    (`fluxa_os_tombstones`, helper genérico `_tombLer`/`_tombAdd` — mesmo
    padrão de `_locTombLer`/`_visTombLer`, só parametrizado): a OS some da
    view mesmo que o delete remoto falhe, e `loadOSHist` tenta apagar de
    novo a cada carregamento até confirmar.

  **Testado no browser local (`dbOk=false`, `db` mockado), ciclo completo:**
  criar offline → `fluxa_os_hist` grava com `_pendingSync:true` e toast avisa
  "sem conexão" → simulei reload (`todosOS=[]` + `loadOSHist()`) → OS
  continua visível → simulei reconexão com `dbInsertNumerado` mockado →
  `id local_os_*` trocado pelo uuid real, `_pendingSync` removido → excluí
  offline → tombstone gravado, suma da view → simulei que o delete remoto
  tinha falhado (mock ainda retorna a linha) → `loadOSHist` filtra e
  reenvia o delete, a OS não ressuscita. Zero erro no console nos 5 passos.

  ~~🟡 Mesma classe de bug em orçamentos/despesas/equipamentos~~ →
  **resolvido nesta mesma sessão, ver recado abaixo** (tombstone nos 3).

- *(A, 08/08)* 🔴 **CRÍTICO, achado no meio do trabalho de tombstone e
  corrigido — `despesas`/`equipamentos` nunca sincronizavam, NENHUM
  registro, desde sempre.** Mesmo bug de classe já visto em `clientes`/
  `usuarios` (id texto local numa coluna `uuid`): `despesas.id` e
  `equipamentos.id` são `uuid DEFAULT gen_random_uuid()` no schema, mas
  `salvarDespesa()`, `repetirRecorrentes()` e `importarEqDaVistoria()`
  mandavam `id:'desp_'+Date.now()`/`id:'eq_'+Date.now()...` **dentro do
  payload do insert**. Não é "coluna faltando" (que o `dbInsert` resiliente
  resolve removendo e reenviando) — é tipo errado (`22P02`), o insert falha
  por inteiro, sem coluna pra reportar, e o `dbInsert` devolve o erro puro
  pro chamador sem log nenhum tratar isso como especial.

  **Confirmado em produção antes de mexer** (leitura direta, PAT):
  `select count(*) from despesas` = **0**, `equipamentos` = **0** — as duas
  tabelas, sempre. A "Base instalada" (`importarEqDaVistoria`, roadmap item
  4, marcado ✅ há tempo) e o lançamento de despesa de campo nunca
  persistiram nada, mesmo com uso real — o achado da B ("despesas está
  vazia... não existe margem calculável") não é só rotina/adoção, é bug
  de schema que faz QUALQUER tentativa falhar 100% das vezes, silenciosamente.

  `salvarEquipamento()` (cadastro manual, avulso) e a criação de `usuarios`
  já faziam certo — separam `dados` (sem id, vai pro insert) de `rec` (com
  id local, só pro cache) — usei o mesmo padrão nos 3 pontos quebrados.
  **Só corrige daqui pra frente**: não retroage sobre despesa/equipamento já
  criado ANTES deste commit — esses já foram perdidos na próxima vez que
  `loadDespesas`/`loadEquipamentos` rodou com sucesso (o "banco é fonte de
  verdade, substitui a lista inteira" apagou o que nunca sincronizou). Não
  tem o que recuperar — o dado não existe em lugar nenhum pra recuperar de.

  Testado no browser local (payload capturado por mock de `db`, por tabela
  — a primeira tentativa deu falso positivo porque `logAcao` também insere,
  em `auditoria`, e sobrescrevia a captura genérica): `dados` mandado pro
  insert não tem `id` nos 3 casos, e o id local (`desp_*`/`eq_*`) é trocado
  pelo uuid real assim que o insert resolve.

- *(A, 08/08)* **Tombstone contra delete que falha em silêncio — 3 tabelas
  que faltavam** (mesmo padrão aplicado em OS acima, e já provado em
  `vistorias`/`locais_vistoria`): `orcamentos`, `despesas`, `equipamentos`.
  Helper genérico `_tombLer(chave)`/`_tombAdd(chave,id)` (parametrizado por
  chave de localStorage, evita copiar o par de funções a cada tabela nova —
  usado por OS e por essas 3). Cada delete grava o tombstone antes de tentar
  apagar remoto; cada `load*` filtra remoto contra o tombstone e reenvia o
  delete pra quem sobreviveu (delete anterior que falhou).

  Testado no browser local, ciclo completo pras 3 tabelas: excluir → some da
  view + tombstone gravado → simulei que o delete remoto tinha falhado (mock
  ainda retorna a linha) → próximo `load*` filtra e reenvia o delete, não
  ressuscita. Zero erro de console.

  🟡 **Gap conhecido, não crítico:** ao contrário de orçamento/OS
  ~~(que preservam registro local-only ainda não sincronizado ao fazer merge
  com o remoto — `soLocal`), despesas/equipamentos só ganharam a proteção de
  DELETE~~ → **fechado na sequência, ver recado abaixo.**

- *(A, 08/08)* Fechei o gap que anotei acima: `loadDespesas()`/
  `loadEquipamentos()` agora preservam registro local-only (`desp_*`/`eq_*`
  ainda sem sincronizar) ao fazer merge com o remoto — igual `loadAgendamentos`
  já fazia, que acabou sendo o molde certo (achado ao varrer TODAS as 7
  tabelas com `id uuid` atrás de mais instância do bug de tipo — `agendamentos`
  e `notas_fiscais` já estavam corretas, nada mais quebrado). Reenvia o
  pendente na hora (dentro do próprio `load*`) e a cada 3min/reconexão
  (`_temPendentes`/`_reenviarPendentes`, mesmo padrão de OS/orçamento/
  vistoria/agendamento). Testado no browser: registro preso sobrevive ao
  `load*` com remoto vazio, `dbInsert` é chamado, id local trocado pelo real.
  Zero erro de console. Fila de tombstone/local-first agora é simétrica nas
  7 tabelas que criam registro (orçamento, OS, despesa, equipamento,
  agendamento, vistoria, cliente).

  Achado incidental na varredura, não é bug: `setup.sql` declara
  `usuarios.id uuid`, mas a produção real já é `text` (confirmado via PAT) —
  alguém migrou isso antes sem atualizar o arquivo. Não afeta nada hoje (o
  código já trata usuário local corretamente), só deixa `setup.sql`
  desatualizado pra uma instalação nova. Não corrigi agora — é troca de tipo
  de coluna, não é aditivo, e a "REGRA DE OURO" deste arquivo pede pra não
  misturar isso com uma feature. Registrado pra próxima vez que alguém mexer
  no `setup.sql` de propósito.

---

## 🛡️ PROTOCOLO DE VERIFICAÇÃO — OBRIGATÓRIO ANTES DE ENTREGAR QUALQUER MUDANÇA

> **Regra do Marcos:** *"sempre verificar todos os ângulos e brechas do código para não aparecer bug no futuro."*
> Não basta a funcionalidade "funcionar no caminho feliz". Antes de commitar/deployar QUALQUER feature ou correção, percorra mentalmente TODOS os ângulos abaixo. Esta seção tem precedência — se faltar tempo, corte escopo, não corte verificação.

### Checklist obrigatório (rode item a item, não pule)

1. **Schema do banco** — todo campo novo que o código grava (`insert`/`update`) EXISTE no Supabase? Confirme com `curl ".../rest/v1/TABELA?select=COLUNA&limit=1"`. Coluna ausente = Supabase rejeita a operação INTEIRA e o registro para de sincronizar **em silêncio**. Use SEMPRE `dbInsert`/`dbUpdate` (wrappers resilientes), nunca `db.from().insert()` cru. Ver "REGRA DE OURO" abaixo.
2. **Ciclo de vida completo** — testou os 4 caminhos? **Criar / Editar / Visualizar / Resetar (novo)**. A maioria dos bugs desta base foi estado residual vazando entre eles (ex.: desconto, rascunho, campos de OS). Ao abrir um registro, mostra só os dados dele? Ao criar novo, limpa tudo?
3. **Persistência dupla** — o dado salva no **localStorage E no Supabase**, e os dois batem? Registros presos só no local (`local_*`, `vis_*`) são reenviados no `load*`? App offline → online não perde nada?
4. **Falha silenciosa proibida** — nenhum `catch(e){}` vazio. Todo erro de banco/rede loga (`console.warn`) e, quando afeta o usuário, mostra `toast`. Se algo "não salvou", o usuário PRECISA saber.
5. **Multi-loja** — a feature respeita `filtrarPorLoja()`? Loja específica mostra SÓ os dados daquela loja; "Todas" mostra o grupo. Não vaza dado de uma loja na outra.
6. **Perfis** — gestor / vendas / técnico veem o que devem? Lembre que `go()`/`eGestor()` são guardrails de UI, não de servidor.
7. **Mobile E desktop** — testou nos dois? Nav inferior (mobile) vs sidebar (desktop); PDF não pode sair com a barra de atalhos; foto grande de celular é aceita.
8. **PDF / impressão** — CSS novo de tela NÃO pode estar dentro do `@media print` (e vice-versa). É o bug mais comum aqui.
9. **Auto-update** — mudou algo que o usuário precisa ver na hora? O app se atualiza sozinho via ETag, mas confirme que não quebrou o `index.html` (network-first).
10. **Sintaxe** — validou o JS inteiro antes do commit? (`new Function(script)` via JXA, ou equivalente.)

### Quando criar uma feature NOVA, pergunte explicitamente:
- "Que coluna/tabela isso grava? Ela existe?"
- "O que acontece se o banco estiver offline? E se a coluna faltar?"
- "Isso aparece corretamente em TODOS os lugares que leem esse dado (histórico, dashboard, PDF, e-mail, WhatsApp)?"
- "Algum estado fica sujo entre uma operação e outra?"

Se a resposta de qualquer uma for "não sei", **verifique antes de entregar** — não deixe brecha silenciosa.

---

## 🏢 MULTI-EMPRESA — código compartilhado, config por empresa

Cada empresa usa os **mesmos `index.html` + `app.js` + `styles.css`**; só o **`config.js`** muda. NÃO chumbe nada específico de empresa nos arquivos compartilhados.

- `config.js` define `window.FLUXA_CONFIG = { appName, supabaseUrl, supabaseKey, lojaPadrao, todasLabel, grupoPrincipal, lojas[] }`.
- No `index.html`, `FLUXA_CONFIG = Object.assign({defaults Fortemp}, window.FLUXA_CONFIG||{})`. Os defaults reproduzem a Fortemp, então o deploy atual roda igual mesmo sem config.js.
- Daqui saem: `LOJAS`, `GRUPO_FORTHEMP` (= grupoPrincipal), `LOJA_PADRAO_ID`, as credenciais Supabase do boot, o `document.title`, o seletor do cabeçalho (`populaLojaSelect`) e os selects de empresa dos forms (`popularSelectsLojaForm` preenche `#orc-loja`, `#os-loja`, `#usr-loja-id`).
- **Nunca** adicione `<option value="fortemp-...">` chumbada no HTML nem `const LOJAS = [...]` fixo — use a config.
- **Empresa nova:** Supabase próprio → roda `setup.sql` (tabelas+RLS+realtime+storage) → edita `config.js` → deploy próprio. Passo a passo em `NOVA-EMPRESA.md`.
- **Manutenção:** corrige em `app.js`/`styles.css`/`index.html` e copia os MESMOS arquivos para o repo de cada empresa (o `config.js` de cada uma não muda).

---

## 📦 ESTOQUE (controle inteligente)

Tabelas: `produtos` e `estoque_movimentos` (id texto `prod_*`/`mov_*`). **Saldo = soma dos movimentos** (ledger), nunca um contador editável. Só gestor edita; carregado no login (`loadEstoque`). `registrarMovimento(...)` é local-first + sync resiliente — **NUNCA** decremente um número, sempre crie um movimento.

**3 números por produto, no contexto da loja ativa:**
- `fisicaProduto(id)` — no depósito (tipos: entrada/saida/ajuste/transf_entrada/transf_saida)
- `reservadoProduto(id)` — comprometido (tipos: reserva/liberacao_reserva)
- `disponivelProduto(id)` = física − reservada. **Negativo = encomenda** (`listaEncomendas()`).
- `saldoProduto(id)` = física (compat).

**Ciclo orçamento → estoque:**
- Aprovar → **reserva** via `sincronizarReservaOrcamento(orc)` (reconciliação idempotente, prefixo `ref='res:orc:<id>'`; cobre reverter/editar/excluir). Chamado em `mudarSt`, `aprovarOrcPortal`, `_recusarOrcPortalConfirmado`, `_excluirOrcConfirmado`, e ao salvar orçamento aprovado. (`sincronizarBaixaOrcamento` é alias.)
- Entregar → **baixa física** via `entregarOrcamento(orc, origem)`: saída + libera reserva (refs `baixa:orc:id:pid` / `libres:...`). Dispara em **OS concluída** (`_entregarPelaOS` no check-out e na vistoria rápida) E no botão manual **"📦 Entregar"** do histórico.
- Item do orçamento vincula produto via `produto_id` (picker `abrirPickerProduto`). Só item com `produto_id` mexe no estoque.

**Multi-loja:** `produtosVisiveis()` = produtos da loja ativa + os com movimento nela (recebidos por transferência). `transferirProduto()` gera 2 movimentos ligados carregando o custo. **CMP:** `recomputarCMP()` recalcula o custo a cada entrada. Ajuste exige motivo.

Campos fiscais no produto (`ncm,cest,cfop_padrao,origem,gtin_ean`) prontos para a futura NF-e.

---

## ⚠️ PROTOCOLO OBRIGATÓRIO — LEIA ANTES DE QUALQUER COISA

Este arquivo é o **canal de comunicação entre todos os devs e instâncias do Claude** que trabalham neste projeto. **O Marcos usa DUAS IAs diferentes que commitam direto na `main`** — então o repositório muda "por baixo" da sua sessão. Para que todos falem a mesma língua, siga estas regras:

### 🔄 SINCRONIZE COM O `origin/main` ANTES DE TUDO (crítico)
Outra IA pode ter commitado desde a última vez. **Nunca trabalhe sobre um estado velho.**
1. **No início da sessão:** `git fetch origin && git log --oneline -5 origin/main`. Se seu working tree divergiu, sincronize: `git reset --hard origin/main` (o trabalho antigo já está no remoto). Confirme os arquivos reais: `index.html` (casca), `app.js` (todo o JS), `styles.css` (todo o CSS).
2. **Antes de cada `push`:** `git push` ou, se rejeitado, `git pull --rebase origin main` e empurre de novo. Nunca force-push.
3. **Se algo parecer "desatualizado" (função/tela que você não reconhece):** provavelmente a outra IA mudou — confie no `origin/main`, não no seu cache. Este mês (jul/2026) o app foi refatorado de single-file para **multi-arquivo**; código single-file antigo NÃO deve voltar.

### Toda sessão de trabalho deve:
1. **Começar sincronizando com o `origin/main`** (acima) e **lendo este arquivo**
2. **Terminar atualizando este arquivo** com tudo que foi feito ou decidido na sessão

### O que sempre atualizar ao final de cada sessão:
- Módulos ou funcionalidades implementadas → mover para a lista de "já implementados"
- Decisões tomadas com o Marcos → registrar em "Decisões" e remover das "Perguntas em aberto"
- SQL novo rodado no Supabase → atualizar a lista de tabelas/colunas
- Bugs corrigidos ou comportamentos alterados → atualizar "Observações importantes"
- Perguntas que surgiram → adicionar em "Perguntas em aberto"

### Como rodar SQL no Supabase direto (sem abrir o painel)

O Claude consegue executar SQL diretamente via Management API **ou via browser com Chrome Extension**:

**Via curl (com Personal Access Token):**
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/lbxwclwzeqqtnwvlxsxs/database/query" \
  -H "Authorization: Bearer [SEU_PAT_AQUI]" \
  -H "Content-Type: application/json" \
  -d '{"query": "SEU SQL AQUI"}'
```
# ⛔ Verificar: o token acima deve ser [SEU_PAT_AQUI], nunca um valor real (sbp_...).
# Se por engano aparecer um token real, não commitar — revogue em:
# https://app.supabase.com/account/tokens
> ⚠️ **NUNCA commitar o PAT aqui.** Gere um novo token em https://app.supabase.com/account/tokens, use na sessão e **não salve no arquivo**.

**Via Chrome Extension (quando o token não funcionar via curl):**
```js
// No javascript_tool com tabId do supabase.com logado:
(async () => {
  const token = JSON.parse(localStorage.getItem('supabase.dashboard.auth.token')).access_token;
  const res = await fetch('https://api.supabase.com/v1/projects/lbxwclwzeqqtnwvlxsxs/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SEU SQL AQUI' })
  });
  window._r = JSON.stringify(await res.json());
})();
// Depois: window._r
```
> Resposta `[]` = sucesso para DDL. Erros aparecem como objeto JSON com `message`.

> ⚠️ **NUNCA commitar o PAT no CLAUDE.md** — o repositório é público. Use sempre `[SEU_PAT_AQUI]` como placeholder e substitua só localmente na sessão.

#### 🔒 Segredos que NUNCA devem aparecer neste arquivo

| Segredo | Padrão a bloquear |
|---|---|
| Supabase PAT | qualquer token começando com `sbp_` |
| Supabase anon key | JWT começando com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` |
| EmailJS keys | valores reais de `emailjs_pubkey`, `emailjs_service`, `emailjs_template` |

Use sempre `[PLACEHOLDER]` no arquivo. Substitua localmente na sessão e **não commite**.
Um hook pré-commit bloqueia estes padrões automaticamente (ver `docs/segurança.md`).

### Como deployar
```bash
git fetch origin && git reset --hard origin/main   # sincroniza ANTES (outra IA pode ter commitado)
# ...faça as mudanças em app.js / styles.css / index.html...
git add app.js styles.css index.html sw.js CLAUDE.md
git commit -m "descrição da mudança"
git push                                            # se rejeitado: git pull --rebase origin main && git push
```
> GitHub Pages serve a branch `main` diretamente. Não há build step. Deploy em ~1 min.
> Ao mudar `app.js`/`styles.css` que o usuário precisa ver na hora, **suba `CACHE` em `sw.js`** (`fluxa-vN`).

---

## O que é
Sistema de gestão para empresas de manutenção de piscinas. **Multi-arquivo** (refatorado de single-file em jul/2026), sem framework nem build step:
- **`index.html`** — só a casca HTML (~2.4k linhas): estrutura das páginas + templates de PDF (`pdoc-*`). Carrega `styles.css` e `app.js`.
- **`app.js`** — TODO o JavaScript (~10k linhas). É aqui que se edita comportamento/lógica.
- **`styles.css`** — TODO o CSS (~1.1k linhas), incluindo `@media print` e os estilos `.pd-*` do relatório.
- **`config.js`** — config por empresa (`window.FLUXA_CONFIG`).
Deployed no GitHub Pages (serve a `main` direto, ~1 min).

## URLs
- **Produção:** https://marcosssvinnn.github.io/fluxa-app/
- **Repositório:** https://github.com/marcosssvinnn/fluxa-app (**público** — necessário para GitHub Pages gratuito)
- **Banco de dados:** Supabase — project ref `lbxwclwzeqqtnwvlxsxs` — URL e anon key hardcoded no index.html

> ⚠️ O repositório é **público**. Não commitar dados sensíveis além da anon key do Supabase (que é necessária para o app funcionar).

## Stack
- HTML/CSS/JS puro — sem framework, sem build step. **Multi-arquivo:** `index.html` (casca) + `app.js` (JS) + `styles.css` (CSS)
- Supabase como banco de dados + Realtime sync entre dispositivos
- localStorage como cache offline / fallback (app funciona sem internet)
- EmailJS (`@emailjs/browser@4`) — envio de e-mails automáticos de relatório de vistoria
- Chart.js (`chart.js@4.4.0`) — gráfico de faturamento no dashboard
- PWA com Service Worker (`sw.js`) — instalável no celular. `index.html`/`app.js`/`styles.css` são **network-first**; **suba o número de `CACHE` (`fluxa-vN`) a cada deploy** para forçar todos os aparelhos a atualizarem
- Deploy: `git push` → GitHub Pages auto-deploya em ~1 min

---

## Arquitetura (multi-arquivo)

```
index.html  (~2.4k linhas) — só HTML: <link styles.css> + páginas + templates PDF
  - pdoc-orc, pdoc-os, pdoc-visita (templates de PDF — .pdoc{display:none})
  - page-form (orçamentos), page-os, page-os-history, page-minhas-os,
    page-clientes, page-visitas, page-agendamentos, page-estoque, …
  - <script src="app.js"> no fim
styles.css  (~1.1k linhas) — TODO o CSS
  - @media print: mostra .pdoc.print-active e esconde a UI do app
  - ⚠️ os estilos do relatório (.pd-*) ficam FORA do @media print (globais),
    senão o PDF/nova-aba sai sem formatação. Escondidos por .pdoc{display:none}.
app.js      (~10k linhas) — TODO o JS: boot IIFE, connect Supabase + sync,
             e todas as funções. **É AQUI que se edita comportamento.**
```

> ⚠️ A numeração de linhas muda a cada commit da outra IA — sempre localize por
> `grep -n "function X" app.js`, nunca por número de linha fixo.

**Regra crítica de CSS:** O bloco `@media print` começa em ~linha 275. CSS colocado **dentro** dele só funciona na impressão/PDF. CSS de tela DEVE ficar **antes** dessa linha. Erros de "estilo sumiu" quase sempre são CSS no lugar errado.

---

## As 3 empresas (DECISÃO FINAL — não mudar sem consultar Marcos)

| ID (loja_id) | Nome | Grupo | Técnicos |
|---|---|---|---|
| `fortemp-camboriu` | Fortemp Camboriú | `forthemp` | Marcos, Josimar, Eldecir, Bruno |
| `fortemp-itapema` | Fortemp Itapema | `forthemp` | Marcos, Josimar, Eldecir, Bruno |
| `aquamotor` | Aquamotor | `aquamotor` | Marcos, Bruno |

**Regras:**
- Fortemp Camboriú e Itapema compartilham o mesmo CNPJ (gestão separada, CNPJ único)
- Josimar e Eldecir **não aparecem** em OS/agendamentos da Aquamotor
- Técnico vê **todas as suas OS** consolidadas (sem filtro de empresa)
- **Vistorias são separadas por empresa** (desde 2026-06-23): técnico escolhe a
  empresa no login; gestor/master pela tela de empresa no login + seletor do header.
  Filtro central: `escopoEmpresaMatch()`. Aquamotor não mistura com Forthemp.

```js
const LOJAS = [
  { id:'fortemp-camboriu', nome:'Fortemp Camboriú',  cor:'loja-0', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'fortemp-itapema',  nome:'Fortemp Itapema',   cor:'loja-1', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'aquamotor',        nome:'Aquamotor',          cor:'loja-2', grupo:'aquamotor', tecs:['Marcos','Bruno'] }
];
const GRUPO_FORTHEMP = ['fortemp-camboriu','fortemp-itapema'];
```

---

## Perfis de usuário (4 tipos — atualizado 2026-06-21)

| Perfil | Acesso | Páginas permitidas |
|--------|--------|--------------------|
| `master` | Total + Auditoria + Usuários — acima de gestor | Todas (inclui `auditoria`) |
| `gestor` | Completo — vê tudo da sua empresa/grupo | Todas |
| `vendas` | Vendedor — cria ORC/OS, sem dados financeiros | `form`, `history`, `clientes`, `agendamentos`, `os` |
| `tecnico` | Técnico de campo — executa OS e vistorias | `minhas-os`, `visitas`, `os` |

**Contas individuais criadas no banco (PINs hasheados, não no código):**
- Marcos → `master` (sem loja — acesso total a todas)
- Tamara, Elis → `gestor` (sem loja — todas as lojas do grupo)
- Josimar, Eldecir, Bruno → `tecnico` (loja: `fortemp-camboriu`)
- Seeds antigos `tec_*` desativados no banco.

### Funções de verificação de perfil:
```js
eMaster()   // true se perfil === 'master'
eGestor()   // true se perfil === 'gestor' OU 'master' (master herda acesso de gestor)
eVendas()   // true se perfil === 'vendas'
eTecnico()  // true se perfil === 'tecnico'
isMainGestor() // true se (gestor|master) e sem loja_id na sessão
```

### Controle de acesso em `go(p)`:
```js
const pagesVendas  = ['form','history','clientes','agendamentos','os'];
const pagesTecnico = ['minhas-os','visitas','os'];
if(_vendas  && !pagesVendas.includes(p))  { toast('Acesso não permitido.'); return; }
if(_tecnico && !pagesTecnico.includes(p)) { toast('Acesso não permitido.'); return; }
// master/gestor passam direto
```

### Login — formulário único (atualizado 2026-06-21):
1. **`login-step-users`** — campo "Seu nome" + autocomplete de sugestões + campo "Senha (4 dígitos)"
   - Digitar nome mostra sugestões dos usuários ativos; clicar foca no campo de senha
   - Ao completar 4 dígitos o login é tentado automaticamente
   - Nenhum nome é exibido na tela antes do usuário digitar (privacidade)
2. **`login-step-loja`** — escolha de empresa no login (atualizado 2026-06-23):
   - **master/gestor sem loja_id** (Marcos, Tamara, Elis) → `mostrarSelecaoLojaGestor()`:
     "Todas as unidades" (Forthemp) / cada unidade / **Outras empresas → Aquamotor**.
     `confirmarLojaGestor()` preserva perfil/nome reais (não rebaixa master).
   - **técnico sem loja_id** → `mostrarSelecaoEmpresaTecnico()`: escolhe **Fortemp** ou
     **Aquamotor** (uma empresa por sessão, p/ não misturar vistorias). Guardado em
     `sessao.empresa_tec` + `sessionStorage('fluxa_vis_empresa_tec')`, restaurado em F5.
   - gestor/técnico com loja_id fixa entram direto na sua empresa.

```js
// Cache interno de usuários para autocomplete
let _loginUsersCache = []; // preenchido por renderLoginUsers()
function loginNomeInput(val)       // mostra sugestões ao digitar
function loginEscolherSugestao(id) // seleciona usuário e foca no PIN
```

### Sessão (sessionStorage):
```js
{ perfil: 'master'|'gestor'|'vendas'|'tecnico', loja_id: null|'string-id', nome: 'Marcos',
  empresa_tec?: 'forthemp'|'aquamotor' /* só técnico — empresa da sessão */ }
```

**Persistência de usuários locais:** Usuários criados localmente recebem `id` com prefixo `usr_`. Na próxima conexão com Supabase, `carregarUsuarios()` tenta sincronizá-los. Se falhar, mantém o registro local em `todosUsuarios` — nunca descarta.

**Edição de usuários:** botão ✏️ na lista de Usuários permite editar nome, perfil (promoção/rebaixamento), PIN e empresa. PIN vazio = mantém o atual. Mudança de perfil atualiza acesso imediatamente.

---

## Filtro multi-empresa — `filtrarPorLoja()`

```js
let lojaAtiva = ''; // '' = todas as empresas do grupo ativo

function filtrarPorLoja(lista, campo='loja_id'){
  if(lojaAtiva){
    const loja = getLoja(lojaAtiva);
    if(loja?.grupo === 'forthemp'){
      return lista.filter(o => (o[campo]||'') === lojaAtiva || !o[campo]);
    }
    return lista.filter(o => (o[campo]||'') === lojaAtiva);
  }
  if(isMainGestor())
    return lista.filter(o => GRUPO_FORTHEMP.includes(o[campo]) || !o[campo]);
  return lista;
}
```

**Módulos que já usam `filtrarPorLoja`:**
`renderTabela`, `renderOSTabela`, `renderClientes`, `renderDespesas`, `renderAgLista`, `renderEqGrid`, `osNoPeriodo`, `despNoPeriodo`, `atualizarDash`, `renderProdutividade`

---

## Banco de dados — tabelas no Supabase

| Tabela | O que armazena |
|--------|----------------|
| `orcamentos` | Orçamentos com status, serviços, pagamento, cnpj, nota_interna, loja_id, assinatura_base64 |
| `ordens_servico` | OS com check-in/check-out, fotos, técnico, cnpj, agendamento_id, loja_id, checklist |
| `empresa_config` | Config da empresa: cores, nome, PIN, templates WhatsApp, credenciais EmailJS |
| `clientes` | Clientes com portal_token, cnpj, portal_ativo, loja_id, **email_responsavel** |
| `agendamentos` | Agendamentos recorrentes com periodicidade, loja_id |
| `equipamentos` | Equipamentos com QR Code, garantia, foto, loja_id |
| `despesas` | Despesas de campo dos técnicos com comprovante, loja_id |
| `lojas` | Config por empresa: focusnfe_token, focusnfe_ambiente, iss_aliquota, etc. |
| `usuarios` | Técnicos, vendas, gestores e masters com PIN (SHA-256), perfil, loja_id, **acessos** (jsonb — empresas separadas, ex.: `["aquamotor"]`; gerenciado na tela Usuários; migração `migracao-acessos-usuarios.sql`) |
| `notas_fiscais` | NF-e/NFS-e emitidas via Focus NFe |
| `vistorias` | Relatórios de vistoria de manutenção preventiva de piscinas |
| `locais_vistoria` | Planos recorrentes de vistoria (1 linha por local) — **dedicada** desde 2026-06-23; antes ficava em `empresa_config.dados` |
| `vistoria_rascunhos` | Backup na nuvem da vistoria EM ANDAMENTO (1 por usuário, id `draft_<nome>`); sobe com debounce enquanto o técnico preenche; restaura até em outro aparelho; limpo ao finalizar. Migração `migracao-vistoria-rascunhos.sql` |
| `auditoria` | Log de ações: login, status ORC, movimentos estoque, OS concluídas, usuários |
| `produtos` | Cadastro de produtos com código, unidade, preço, custo, estoque mínimo, CMP |
| `estoque_movimentos` | Ledger de movimentos: entrada/saida/ajuste/transf/reserva/liberacao_reserva |

### SQL já executado no Supabase (✅ confirmado via API):

```sql
-- ─── Colunas adicionadas ───────────────────────────────────────────────────
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS assinatura_base64 text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checklist text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS video_link text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS agendamento_id uuid;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkin_at timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checkout_at timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS duracao_min integer;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS email_responsavel text;  -- ✅ NOVO
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE equipamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS loja_id text;

-- ─── Tabelas novas criadas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lojas (
  id text PRIMARY KEY,
  nome text, cnpj text, razao_social text,
  focusnfe_token text, focusnfe_ambiente text,
  iss_aliquota numeric(5,2), codigo_servico_municipal text,
  cor_primaria text, logo_base64 text,
  ativo boolean DEFAULT true, data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY,
  nome text, pin text, perfil text DEFAULT 'tecnico',
  loja_id text, loja_nome text,
  ativo boolean DEFAULT true, data_criacao timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id text, orcamento_id uuid,
  tipo text, referencia text,
  numero integer, serie text, chave_acesso text,
  status text DEFAULT 'pendente',
  xml_autorizado text, pdf_danfe_base64 text,
  protocolo text, motivo_rejeicao text,
  data_emissao timestamptz DEFAULT now(),
  data_criacao timestamptz DEFAULT now()
);

-- ─── NOVA: tabela de vistorias ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistorias (
  id text PRIMARY KEY,
  loja_id text,
  cliente text,
  local text,
  data text,
  hora text,
  tecnico text,
  mes_ref text,
  hora_checkin text,
  hora_checkout text,
  obs_geral text,
  email_responsavel text,
  equipamentos jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  local_id text,                        -- ✅ rodada (ver auditoria 2026-06-13)
  recomendacoes text,                   -- ✅ rodada 2026-08-06 (seção "Recomendações")
  obs_ambientes jsonb DEFAULT '{}'      -- ✅ rodada 2026-08-06 (observação por ambiente)
);

-- ─── NOVA: tabela dedicada de locais de vistoria (✅ executada 2026-06-23) ────
-- Antes os planos ficavam num array em empresa_config.dados → salvar reescrevia
-- o blob inteiro e dois gestores simultâneos sobrescreviam um ao outro. Agora
-- cada local é sua própria linha. Script: migracao-locais-vistoria.sql.
-- O app detecta a tabela e migra sozinho (loadLocaisRemoto). Fallback legado
-- (empresa_config com read-merge-write) enquanto a tabela não existir.
CREATE TABLE IF NOT EXISTS locais_vistoria (
  id text PRIMARY KEY,
  loja_id text, cliente text, local text,
  email_responsavel text, tecnico text,
  dia_pref text, hora_pref text,
  equipamentos jsonb DEFAULT '[]',
  agendamento_id text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── RLS (já aplicado) ──────────────────────────────────────────────────────
-- Todas as tabelas têm RLS ativo com policy "anon full access" (FOR ALL TO anon)
-- ⚠️ ATENÇÃO: esta policy concede leitura e escrita a QUALQUER pessoa com a anon
-- key (que está no código-fonte público). O controle de acesso acontece APENAS no
-- JS do cliente. Antes de adicionar tabela com dados sensíveis, registrar em
-- "Perguntas em aberto" a necessidade de policy RLS mais restritiva.
-- Tabelas com Realtime: orcamentos, equipamentos, despesas, agendamentos, vistorias, locais_vistoria
```

---

## Módulos já implementados e funcionando

1. **Orçamentos** — criação, edição, duplicar, histórico, filtros, PDF, status, campo Empresa
2. **Ordens de Serviço** — criação, histórico, PDF, fotos (3), vídeo, campo Empresa
3. **Agendamento Recorrente** — visitas recorrentes, check-in/check-out, calendário
4. **Equipamentos + QR Code** — ficha do equipamento, QR abre via hash `#eq/ID`
5. **Despesas de Campo** — técnico registra no celular com foto, gestor aprova
6. **Produtividade** — dashboard por técnico, faturamento, taxa de conclusão, filtro por loja
7. **Portal do Cliente** — link único `#portal/TOKEN`, sem login, cliente aprova orçamentos
8. **Notificações WhatsApp** — templates editáveis com variáveis, botão copiar mensagem
9. **Cadastro de Clientes** — busca por nome/CNPJ, auto-save, edição inline, **campo email_responsavel** e **tipo de local**
10. **Gestão de Usuários** — gestor cria/desativa técnicos, vendas e gestores por empresa
11. **Multi-empresa (3 lojas)** — separação total Forthemp vs Acquamotor; filtro no header; badges coloridos
12. **Login por usuário (3 perfis)** — seleção de avatar + PIN (SHA-256 + salt `fluxa2025`), fluxo 3 passos, lockout 3 tentativas/30s
13. **Perfil Vendas** — acesso restrito a ORC/OS/Clientes/Agenda; sem dados financeiros; criação de OS permitida
14. **Vista do Técnico (Minhas OS)** — OS consolidadas de todas as lojas; botão "Nova Vistoria" integrado
15. **Focus NFe** — modal de emissão NF-e/NFS-e via Focus NFe API (estrutura pronta, aguardando CNPJs)
16. **Busca de clientes** — modal 🔍 no form de ORC, OS e Vistorias; importação batch de clientes de orçamentos
17. **Opções de pagamento avançadas** — boleto parcelado, entrada + boleto, entrada + Pix, cartão parcelado
18. **Quantidade de produto** — campo `qty`; exibe subtotal; **PDF mostra coluna "Qtd × Unit." quando qty > 1**
19. **Fotos no orçamento (até 6)** — grid de 6 slots; cada foto base64; aparece apenas quando há fotos; serve para laudos de equipamentos
20. **Dashboard filtrado por empresa** — `atualizarDash()` usa `filtrarPorLoja()`
21. **Gráfico de faturamento** — Chart.js (últimos 6 meses, responsivo)
22. **Histórico completo do cliente** — modal com orçamentos, OS e total faturado
23. **Checklist de vistoria na OS** — 8 itens padrão, editável, salvo como JSON no Supabase
24. **Assinatura do cliente no portal** — canvas de assinatura, salvo como base64
25. **Relatório Financeiro** — tabela Receita vs Despesas vs Resultado por mês (Produtividade)
26. **Vistorias de Manutenção** — sistema completo (ver seção detalhada abaixo)
27. **E-mail automático de relatório** — EmailJS integrado (ver seção detalhada abaixo)
28. **🆕 Controle de Estoque** — ledger de movimentos, curva ABC, ruptura, CMP, transferência, lista de compras, integração com orçamentos (reserva → baixa → entrega)
29. **🆕 Perfil master + edição de usuários** — 4 perfis (master/gestor/vendas/técnico), edição inline, promoção/rebaixamento, PINs individuais
30. **🆕 Auditoria de acessos** — tabela `auditoria`, `logAcao()` nos pontos-chave, tela de visualização com filtros (⚙️ → 🔐 Auditoria)
31. **🆕 Login por nome + PIN** — formulário com autocomplete substitui grade de avatares; nenhum nome exposto antes do login

---

## 🔍 Módulo de Vistorias de Manutenção (NOVO)

### Acesso
- Visível para **gestor** e **técnico** (não para vendas)
- Nav desktop: botão "🔍 Vistorias"
- Nav mobile: botão "🔍 Vistorias"
- Gear menu: "🔍 Vistorias"
- Tela "Minhas OS" do técnico: botão "Nova Vistoria"
- Página de Agendamentos → botão "🔍 Vistoria" em cada contrato (pré-preenche cliente/local/técnico)

### Página `page-visitas` — abas:
1. **Nova Vistoria** — formulário completo
2. **Histórico** — lista + dashboard + ranking

### Formulário de Nova Vistoria:
- Cliente (autocomplete + modal de busca), local, data, técnico (select), mês de referência
- **E-mail do responsável/síndico** — auto-preenchido do cadastro do cliente, editável por vistoria
- **Check-in com timer** — registra hora de entrada, calcula duração ao fazer check-out
- **Chips de seleção de equipamentos** — escolhe quais existem no local
- **Vistoria por equipamento** — painel colapsável por equipamento com:
  - Botões de status: ✅ Bom / ⚠️ Atenção / 🔴 Crítico / — N/A
  - Campo de observações
  - 3 slots de foto — o celular oferece **Câmera OU Galeria** (sem `capture=`, desde 2026-06-23)
- Campo de observações gerais
- **Salvar** (persiste local + Supabase) + **Gerar PDF** (download via html2pdf)

### Equipamentos disponíveis (configurados em `VIS_EQUIPAMENTOS_DEFAULT`):
```js
{ id:'motobomba',  nome:'Motobomba Principal',    emoji:'⚙️' }
{ id:'mot-aux',    nome:'Motobomba Auxiliar',      emoji:'⚙️' }
{ id:'trocador',   nome:'Trocador de Calor',       emoji:'🌡️' }
{ id:'filtro',     nome:'Filtro',                  emoji:'🔵' }
{ id:'skimmer',    nome:'Skimmer',                 emoji:'💧' }
{ id:'iluminacao', nome:'Iluminação Subaquática',  emoji:'💡' }
{ id:'automacao',  nome:'Automação / Dosador',     emoji:'🤖' }
{ id:'spa',        nome:'Spa',                     emoji:'🛁' }
{ id:'sauna',      nome:'Sauna',                   emoji:'🧖' }
```

### Histórico:
- Cards de resumo: total, qtd c/ Atenção, qtd c/ Crítico
- 🏆 Ranking de técnicos por vistorias no mês filtrado
- Filtro: busca por texto + mês + técnico
- Linha de histórico mostra: data, cliente, local, técnico, nº equipamentos, e-mail, badges de status
- Botões por item: 📧 Reenviar e-mail | 💬 WhatsApp | **✏️ Editar/refazer** | 📥 PDF | ✕ Excluir
- **Filtrado por empresa** (escopoEmpresaMatch) — lista, stats, ranking e alertas só da empresa em foco

### PDF "Relatório de Vistoria":
- Header com branding da empresa (logo, cores)
- Cartão do cliente + endereço
- Grid: técnico, data completa, entrada → saída
- Tabela resumo de todos os equipamentos (status + obs resumida)
- Seções detalhadas por equipamento (só os que não são N/A): status colorido + observações + até 3 fotos
- Observações gerais + espaços de assinatura (responsável / síndico + técnico)

### Persistência:
```js
// localStorage
const LS_VIS = 'fluxa_visitas';          // vistorias feitas
const LS_LOCAIS_VIS = 'fluxa_locais_vistoria'; // planos/locais recorrentes
lsVisLer() / lsVisSalvar(lista)          // vistorias no localStorage

// Vistorias: tabela 'vistorias' (id = 'vis_' + Date.now())
//   loadVistoriasRemoto() faz merge Supabase + local ao conectar
// Locais: tabela dedicada 'locais_vistoria' (1 linha por local) desde 2026-06-23
//   loadLocaisRemoto() = fonte de verdade + auto-migração; saveLocais() upsert
//   por linha; fallback legado (_saveLocaisLegado) = read-merge-write no
//   empresa_config enquanto a tabela não existir. _locaisTabelaOk detecta.
```

### Separação por empresa + idempotência (refatorado 2026-06-23):
- **`escopoEmpresaMatch(loja_id)`** — fonte única de verdade do filtro de empresa,
  usado por `renderLocaisTab` E `renderVisHistorico` (não divergem). Técnico → grupo
  do login; gestor "Todas" → grupo forthemp (Aquamotor não mistura); gestor em loja
  específica → aquela loja. Helpers: `_normLojaId`, `_grupoDaLoja`, `_empresaEmFoco`.
- **`_lojaDaVistoria(loc)`** — etiquetagem única: a vistoria herda a empresa do
  LOCAL/plano (não da sessão do técnico). Era a causa do vazamento Aquamotor→Fortemp.
- **`_vistoriaExistente(local, mês)`** — idempotência: reusa o mesmo registro do
  local no mês em vez de duplicar (nos 3 fluxos: form, modal rápido, detalhada).
- **PDF unificado** — `_gerarPDFVistoria(vis)` (download html2pdf) usado por
  `baixarPDFVistoria`, `abrirVisRelatorio` e `gerarRelatorioVistoria`; `window.print`
  só como fallback de desktop (evita PDF em branco no mobile).
- **`editarVistoria(id)`** — reabre a vistoria no form preservando status/obs/fotos,
  grava no mesmo `visEditId` (preserva a empresa original). Botão ✏️ no histórico.

---

## 📧 E-mail Automático de Relatório (NOVO)

### Tecnologia: EmailJS (`@emailjs/browser@4`)
- CDN carregado no `<head>`: `https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js`
- 200 e-mails/mês grátis
- Configuração em **Empresa → E-mail Automático de Vistoria**

### Campos de configuração (salvos em `CFG`):
```js
CFG.emailjs_pubkey   // Public Key (User ID) do EmailJS
CFG.emailjs_service  // Service ID (ex: 'service_xxxxxxx')
CFG.emailjs_template // Template ID (ex: 'template_xxxxxxx')
```

### Variáveis disponíveis no template EmailJS:
```
{{to_email}}     — e-mail do responsável
{{to_name}}      — nome do cliente
{{empresa}}      — nome da empresa
{{tecnico}}      — técnico responsável
{{mes_ref}}      — mês de referência (ex: "maio de 2026")
{{data_visita}}  — data da vistoria (ex: "06/05/2026")
{{hora_checkin}} — horário de entrada
{{hora_checkout}} — horário de saída
{{resumo}}       — lista de equipamentos com status e observação
{{obs_geral}}    — observações gerais
{{status_geral}} — "✅ Tudo em ordem" | "⚠️ Verificar pontos" | "🔴 Ação necessária"
{{tel_empresa}}  — telefone da empresa
```

### Fluxo automático:
1. Técnico salva a vistoria com e-mail preenchido
2. Se EmailJS configurado → envia automaticamente
3. Feedback: "📨 Enviando…" → "✅ E-mail enviado para sindico@..." ou erro
4. Botão **📧** no histórico → reenvio manual de qualquer vistoria

### Funções:
```js
emailJSConfigurado()         // true se os 3 campos estão preenchidos no CFG
initEmailJS()                // inicializa com CFG.emailjs_pubkey (chamado no boot e ao salvar CFG)
enviarEmailVistoria(vis)     // envia e-mail com dados da vistoria; retorna Promise<boolean>
reenviarEmailVistoria(id)    // busca vistoria no localStorage e reenvia
testarEmailJS()              // envio de teste com prompt para e-mail destino
```

### E-mail do responsável no cadastro de clientes:
- Campo `email_responsavel` no formulário de cliente
- Campo `tipo` (Residência / Condomínio / Hotel / Clube / Comercial)
- Ao selecionar cliente na vistoria → e-mail auto-preenchido do cadastro
- Editável por vistoria individualmente

---

## Orçamentos — recursos especiais

### Fotos (até 6) para laudos:
```js
let fotosB64 = []; // array de até 6 base64 strings

renderFotosOrcSlots()     // renderiza grid 3x2 de slots na tela
carregarFotoOrc(inp, idx) // carrega foto no índice
removerFotoOrc(idx)       // remove foto do índice
```
- Grid aparece na seção "Fotos" do formulário de orçamento
- No PDF: aparece APENAS quando há fotos (seção condicional)
- Colunas no grid PDF ajustadas automaticamente: 1 foto → 1 col, 2-4 → 2 col, 5-6 → 3 col
- Backward compat: registros antigos com `foto_base64` (string) são convertidos para array

### Preço unitário no PDF:
```js
// Quando algum serviço tem qty > 1, o cabeçalho muda:
// Coluna normal: "#  |  Descrição  |  Valor"
// Com qty:       "#  |  Descrição  |  Qtd × Unit.  |  Total"
const temMulti = d.svcs.some(s=>(parseInt(s.qty)||1)>1);
```

---

## Padrões de código

### Variáveis globais principais
```js
let db, dbOk=false;          // conexão Supabase
let CFG = {...CFG_DEF};      // configurações da empresa
let todosOrc = [];           // orçamentos em memória
let todosOS = [];            // OS em memória
let todosEq = [];            // equipamentos em memória
let todasDesp = [];          // despesas em memória
let lojaAtiva = '';          // empresa ativa no filtro ('' = todas do grupo)
let visEquipSelecionados = [];// ids de equipamentos ativos na vistoria em edição
let visEquipDados = {};      // { id: { status, obs, fotos[] } } da vistoria em edição
```

### Funções utilitárias
```js
gV('id')          // pega valor de input por id
setV('id', val)   // define valor de input
ls('key')         // localStorage.getItem
lsSet('key', val) // localStorage.setItem
toast('msg')      // notificação temporária
go('pagina')      // navegação entre páginas (com controle de acesso por perfil)
brl(valor)        // formata em R$ (ex: brl(150) → "R$ 150,00")
esc(str)          // escapa HTML (SEMPRE usar ao renderizar dados do usuário)
getLoja(id)       // retorna objeto da LOJAS por id
getLojaNome(id)   // retorna nome legível da loja
filtrarPorLoja(lista) // filtra por empresa ativa — USAR SEMPRE
isMainGestor()    // true se gestor principal (sem loja_id na sessão)
getSessao()       // { perfil, loja_id, nome } ou null
eMaster()         // true se perfil === 'master'
eGestor()         // true se perfil === 'gestor' OU 'master'
eVendas()         // true se perfil === 'vendas'
eTecnico()        // true se perfil === 'tecnico'
logAcao(acao, detalhe) // registra no log de auditoria (local + Supabase async)
```

### Navegação entre páginas
```js
go('form')          // novo orçamento
go('history')       // histórico orçamentos
go('os')            // nova OS
go('os-history')    // histórico OS
go('minhas-os')     // OS consolidada do técnico (só técnico)
go('clientes')      // cadastro clientes
go('equipamentos')  // equipamentos + QR
go('agendamentos')  // agendamentos recorrentes
go('visitas')       // vistorias de manutenção (gestor + técnico)
go('despesas')      // despesas de campo
go('produtividade') // relatório de produtividade
go('empresa')       // configurações da empresa
go('usuarios')      // gestão de usuários (só gestor/master)
go('auditoria')     // log de auditoria (só gestor/master)
go('estoque')       // controle de estoque (só gestor)
```

### localStorage keys
- `fluxa_orcamentos` / `fluxa_orc_data` — cache de orçamentos
- `fluxa_clientes_full` — cache de clientes
- `fluxa_eq` — cache de equipamentos
- `fluxa_desp` — cache de despesas
- `fluxa_usuarios` — cache de usuários/técnicos
- `fluxa_visitas` — cache de vistorias de manutenção
- `fluxa_produtos` — cache de produtos do estoque
- `fluxa_mov_estoque` — cache de movimentos de estoque (ledger)
- `fluxa_auditoria` — cache local do log de auditoria (últimos 500 registros)
- `empresa_cfg` — configurações da empresa (inclui emailjs_pubkey/service/template)
- `sb_url`, `sb_key` — credenciais Supabase

### Autenticação — PIN
```js
// Hash: SHA-256 com salt 'fluxa2025'
// Armazenado: hash hex em usuario.pin
// Retrocompatível: PINs antigos sem hash funcionam (comparação direta)
// Lockout: 3 tentativas erradas → 30s bloqueado
```

> **⚠️ Candidata a remoção:** a linha de retrocompatibilidade com PIN em texto plano em `pinValido()` deve ser removida assim que confirmado que nenhum usuário ainda usa PIN legado. Verificar com Marcos antes de remover. Registrado como pendência em "Perguntas em aberto".

### Salvamento de dados — padrão local-first
```js
lsOrcUpsert(rec);        // 1. salva local imediatamente
todosOrc.unshift(rec);   // 2. atualiza memória
db.from('tabela')...     // 3. sincroniza com BD em background sem bloquear UI
```

### Loja_id em novos registros — OBRIGATÓRIO
```js
loja_id: gV('orc-loja') || lojaAtiva || 'fortemp-camboriu'
// Nunca gravar loja_id: null em registros novos
```

### Fotos — limite e formato
```js
const FOTO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB por foto (compressImage reduz antes de salvar)
// Armazenadas como base64 diretamente no banco (sem Supabase Storage)
// OS: array osFotos[3] (slots 0,1,2)
// Orçamento: array fotosB64[] (até 6 slots)
// Vistoria: por equipamento, até 3 fotos each (visEquipDados[id].fotos[])
```

---

## CSS — variáveis e classes principais
```css
--c1: #F07820    /* laranja — cor primária */
--c2: #2B3244    /* azul escuro — cor secundária */
--r: 12px        /* border-radius padrão */

/* Layout */
.wrap            /* container: max-width 1200px, padding 22px 14px 80px */
.card            /* card branco com sombra */
.ct              /* título de seção (laranja, uppercase) */
.row / .row.f1/f3/f4  /* grids de 2/1/3/4 colunas */
.fl              /* field wrapper com label */
.btn-primary     /* botão laranja */
.tb              /* botão de ação na tabela */
.mob-nav         /* bottom nav mobile (<680px) */

/* Vistorias (NOVO) */
.vis-equip-block      /* bloco colapsável por equipamento */
.vis-equip-block.status-bom/atencao/critico  /* borda colorida por status */
.vis-equip-hdr        /* cabeçalho clicável do bloco */
.vis-equip-body       /* corpo colapsável (.open = visível) */
.vis-status-btn       /* botões Bom/Atenção/Crítico/N/A */
.vis-status-btn.sel-bom/atencao/critico/na  /* estado selecionado */
.vis-foto-slot        /* slot de foto 3x por equipamento */
.vis-chip             /* chip de seleção de equipamento (.on = selecionado) */
.vis-history-item     /* linha no histórico de vistorias */

/* Multi-loja */
.loja-badge      /* badge colorido de empresa */
.loja-0/1/2      /* laranja/azul/verde */
.loja-select     /* dropdown de empresa no header */

/* Checklist OS */
.chk-list / .chk-item / .chk-item.ok
.chk-obs-inp     /* visível só quando checked */

/* Fotos orçamento */
.fotos-orc-grid  /* grid 3 colunas de slots */
.fotos-orc-slot / .fotos-orc-slot.filled
.fotos-orc-rm    /* botão ✕ remover (display:none → flex quando filled) */
```

---

## Realtime Sync
```js
// Tabelas com sync automático:
orcamentos, equipamentos, despesas, agendamentos

// Carregadas ao conectar:
clientes           → carregarClientesRemoto()
empresa_config     → carregarCFGremoto()
usuarios           → carregarUsuarios()
vistorias          → loadVistoriasRemoto()   ← NOVA
```

---

## Padrões obrigatórios de código

### ⚠️ Controle de acesso — o que `go()` e `eGestor()` NÃO fazem

As funções `go()`, `eGestor()`, `eVendas()`, `eTecnico()` e `aplicarPermissoesPerfil()` são **guardrails de UI** — escondem botões e bloqueiam navegação, mas **não protegem dados no servidor**.

Toda query ao Supabase usa a anon key pública com policy `FOR ALL TO anon`. Qualquer pessoa com a anon key pode ler/escrever qualquer tabela via REST, independentemente do JS.

**Consequências práticas:**
- Não confie em `eGestor()` para proteger dados financeiros — use-a só para UI
- Não exponha dados sensíveis em variáveis JS globais acessíveis pelo console
- Nova feature que exige isolamento real de dados precisa de RLS server-side → registrar em "Perguntas em aberto"
- **Bug conhecido corrigido em 2026-05-06:** `eGestor()` retornava `true` quando sessão era nula

### Tratamento de erros — proibido silenciar

`catch(e){}` vazio é **proibido** em qualquer função que acesse Supabase, localStorage ou envie e-mail. Use no mínimo:

```js
catch(e){ console.warn('[nomeDAFunção]', e?.message||e); }
```

Para operações com feedback ao usuário (salvar OS, enviar e-mail):
```js
catch(e){
  console.warn('[salvarOS]', e?.message||e);
  toast('Erro ao salvar. Tente novamente.');
}
```

Nunca exibir `e.message` diretamente ao usuário — pode vazar stack trace ou schema interno.

### Diálogos nativos — proibidos

`window.confirm()`, `window.alert()` e `window.prompt()` são **proibidos** em produção:
- Bloqueados silenciosamente em PWA/WebView Android
- Não podem ser estilizados
- Bloqueiam a thread JS

**Substitutos:**
- Confirmações destrutivas → função `confirmar(titulo, desc, callback)` já existente no app
- Inputs simples → campo no modal da feature
- Notificações → `toast('msg')`

### Auto-save de rascunho em formulários longos

Formulários com mais de 3 campos editáveis devem salvar estado em `localStorage` durante o preenchimento, **antes do submit**:

```js
// Escuta mudanças com debounce
formEl.addEventListener('input', () => { salvarRascunho('os'); });
// Ao abrir o formulário
restaurarRascunho('os');
// Ao salvar com sucesso
limparRascunho('os');
```

Funções `salvarRascunho(tipo)`, `restaurarRascunho(tipo)` e `limparRascunho(tipo)` já existem no app.
Chaves usadas: `fluxa_draft_orc`, `fluxa_draft_os`, `fluxa_draft_vis`.

Adicionar `beforeunload` como fallback:
```js
window.addEventListener('beforeunload', e => { if(formDirty){ e.preventDefault(); } });
```

### Consistência entre formulários

Todo formulário novo deve:

1. **Pré-preencher data com hoje** em `go('[modulo]')` ou `initForm()`:
   ```js
   setV('modulo-data', new Date().toISOString().slice(0,10));
   ```
2. **Campo técnico como `<select>`** — nunca `<input type="text">` livre. Usar `populaTecSelects()` ou equivalente. Inconsistências de nome fragmentam relatórios.
3. **Campos obrigatórios marcados** com `required` no HTML e classe `req` no label (`.req::after { content: ' *'; color: var(--red); }`).

### Versão das dependências CDN — sempre exata

CDN URLs devem usar versão exata, nunca range de versão maior:
```html
<!-- ✅ -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.3/dist/umd/supabase.min.js">

<!-- ❌ proibido — pode receber atualização automática -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
```

Versões atuais (última verificação 2026-05-06):
- `@supabase/supabase-js`: `2.105.3` (com SRI sha384)
- `@emailjs/browser`: `4.x` — fixar sub-versão na próxima atualização
- `chart.js`: `4.4.0` ✓

---

## Observações importantes de UX/comportamento
- Header `position:fixed` height 56px → `body { padding-top: 56px }`
- **CSS no lugar errado** é o bug mais comum — nunca colocar CSS de tela dentro do `@media print`
- iOS: inputs precisam de `font-size:16px` para não dar zoom automático
- Fotos armazenadas como base64 diretamente no banco (sem Supabase Storage)
- QR Code gerado via `api.qrserver.com` — sem biblioteca local
- Hash routing: `#portal/TOKEN` abre portal do cliente, `#eq/ID` abre ficha do equipamento
- Service Worker cacheia o app shell (cache `fluxa-v2`) para funcionar offline
- Técnico ao fazer login → vai direto para `minhas-os`
- Gestor ao fazer login → vai para `history`
- Vendas ao fazer login → vai para `form`
- `lojaAtiva` é volátil (não persiste entre sessões) — gestor sempre começa com "Todas"
- Inputs de valor monetário: `type="text"` com `inputmode="decimal"`
- **Usuários locais** (prefixo `usr_`) são sincronizados no próximo boot com BD; se sync falhar, são preservados

#### Requisitos mínimos de acessibilidade (não regredir)

A cada nova tela ou componente, verificar:

- **Foco visível:** nunca usar `outline: none` sem substituto. Padrão aprovado: `:focus-visible { outline: 2px solid var(--c1); outline-offset: 2px; }`
- **Toast:** manter `role="alert" aria-live="assertive"` no elemento `#toast`
- **Botões de fechar modal:** sempre com `aria-label="Fechar"`
- **Alvos de toque:** min. 44×44px em qualquer botão visível em mobile (`min-width:44px; min-height:44px`)
- **Página ativa na nav:** atualizar `aria-current="page"` em `go(p)`
- **Navegação bloqueada:** se `go()` retornar por falta de permissão, chamar `toast('Acesso não permitido.')` antes do `return`

Checklist completo WCAG: `docs/acessibilidade.md`

---

## Próxima fase — ainda pendente

### Focus NFe — Módulo 7 (estrutura pronta, aguardando dados)
- Modal de emissão já existe no HTML/JS
- Municípios: Camboriú-SC (IBGE 4203204) e Itapema-SC (IBGE 4208450)
- **Pendente:** CNPJs reais das 3 empresas + tokens Focus NFe

### Melhorias futuras mapeadas (não implementadas)
- Configuração de equipamentos por cliente (quais equipamentos tem no local, salvo no cadastro do cliente)
- Notificação automática de vistoria por WhatsApp (além do e-mail)
- Relatório mensal consolidado de vistorias por cliente (PDF multi-visita)

---

## ⚠️ REGRA DE OURO — gravar coluna nova no Supabase

**Antes de adicionar QUALQUER campo novo a um `INSERT`/`UPDATE`, confirme que a coluna existe no banco.** O Supabase rejeita a operação INTEIRA se uma coluna não existir (erro `42703` ou `PGRST204`) — e, se o erro for ignorado, o registro **para de sincronizar sem avisar** (fica só no localStorage). Isso já derrubou orçamentos (`origem_cliente`), OS (`checkin_at`) e vistorias/agendamentos (`local_id`).

**Sempre use os wrappers resilientes (nunca `db.from().insert()` cru para gravar):**
```js
await dbInsert('tabela', payload);              // insert resiliente
await dbUpdate('tabela', payload, 'id', idVal); // update resiliente
```
Eles detectam a coluna ausente, removem do payload e reenviam, logando aviso. `orcSyncInsert/orcSyncUpdate` delegam a eles.

**Conferir schema real (anon key, leitura):**
```bash
curl "https://lbxwclwzeqqtnwvlxsxs.supabase.co/rest/v1/TABELA?select=COLUNA&limit=1" \
  -H "apikey: <anon>" -H "Authorization: Bearer <anon>"
# "...does not exist" = coluna falta → rodar ALTER TABLE e atualizar o SQL de setup
```

### Colunas REAIS confirmadas (auditoria 2026-06-13, revisada 2026-08-06)
- `ordens_servico`: check-in/out são **`checkin_time` / `checkout_time`** (timestamptz), NÃO checkin_at/checkout_at.
- `vistorias.local_id`: ✅ existe (confirmado 2026-08-06).
- `agendamentos.local_id`: **ainda NÃO existe** no banco de produção (código grava via wrapper resiliente; rodar ALTER para persistir).
- `vistorias.recomendacoes` (text) e `vistorias.obs_ambientes` (jsonb): ✅ criadas 2026-08-06 — antes eram descartadas silenciosamente pelo `dbUpsert` (achado ao auditar a vistoria real do Infinity Coast Tower, 51 equip./12 ambientes).
- `orcamentos.proximo_contato` (date), `orcamentos.decisao_prevista` (date), `orcamentos.motivo_perda` (text), `orcamentos.crm_notas` (jsonb): ✅ criadas 2026-08-06 para a Fase 3 do CRM. Todas nullable; gravadas via `dbUpdate`.
- `clientes.tipo` (text) e `agendamentos.local_id` (text): ✅ criadas 2026-08-06. A primeira o app gravava desde sempre (select `cli-new-tipo`) e era descartada em silêncio — útil agora para o CRM distinguir condomínio de residência.
- `fornecedores` e `ordens_compra`: ✅ criadas 2026-08-06 (`migracao-compras.sql`). ⚠️ O app grava `ordens_compra.itens` com `JSON.stringify` num campo `jsonb`, então o valor fica como string JSON; a leitura já faz o parse defensivo (`typeof o.itens==='string'?JSON.parse(...)`). Funciona, mas impede consultar o conteúdo por SQL.
- `orcamentos.origem_cliente`: criada em 2026-06-13. ✅

### SQL pendente de rodar no Supabase (produção)

✅ `agendamentos.local_id` e `clientes.tipo` foram criadas em 2026-08-06.

✅ `migracao-compras.sql` — `fornecedores` e `ordens_compra` criadas em
2026-08-06 (RLS ativo, policy `anon full access`). Testado ponta a ponta: leitura
e escrita pela UI gravam no banco e no localStorage. Com isso acabaram os ~48
erros HTTP 400 por carregamento que o app disparava tentando lê-las.

⚠️ O que já estava no localStorage **não sobe sozinho** — fornecedores/OCs
cadastrados antes só sincronizam quando forem salvos de novo.

---

## Sessão 2026-06-13 — auditoria de schema + correções de sync

- **Auditoria completa** das colunas gravadas vs reais (todas as tabelas). 4 brechas da mesma classe encontradas e corrigidas:
  - `orcamentos.origem_cliente` (coluna criada + wrapper)
  - `ordens_servico` check-in/out: código corrigido para `checkin_time/checkout_time`
  - `vistorias.local_id` e `agendamentos.local_id`: wrapper resiliente + SQL pendente
- **Wrappers `dbInsert`/`dbUpdate`** com detector `_colunaFaltante` (testado contra 42703 e PGRST204).
- **Recuperação automática**: `loadHist` reenvia orçamentos `local_*` presos; `loadVistoriasRemoto` reenvia vistorias presas.
- **Auto-update por ETag** (não depende mais de bumpar sw.js); separação estrita por loja em `filtrarPorLoja`; origem no histórico (badge) e placar de leads por categoria no dashboard.

## Sessão 2026-06-11 — mudanças desta sessão

1. **Vistorias** — fluxo plano→vistoria: botão "🔍 Fazer Vistoria" abre form completo pré-preenchido (`iniciarVistoriaPlena`); check-out automático ao salvar/gerar PDF (`autoCheckoutSeNecessario`); relatório PDF redesenhado (stats row, duração, fotos 2 colunas com legenda); botão 📥 baixa PDF via html2pdf.js (`baixarPDFVistoria`); e-mail enviado direto sem geração de PDF inline (era a causa de falha de envio).
2. **Origem do cliente (NOVO, obrigatório)** — select `origem-cli` no form de orçamento com 7 opções + "Outro" texto livre; validação bloqueia salvar/gerar PDF; coluna `origem_cliente` em `orcamentos`; card "📣 Origem dos Clientes" no dashboard (`renderOrigemDash`); autocomplete de cliente da base pré-sugere "Já é cliente".
3. **Mobile** — botão "🔓 Trocar usuário" no fim da sidebar (acessível pelo ☰ Mais).
4. **Bugs corrigidos na revisão geral:**
   - `novoOrc()` usava ids errados `desc`/`disc-tp` → desconto nunca era limpo ao criar novo orçamento (ids corretos: `disc-v`/`disc-t`)
   - `abrirOrc()` não carregava o desconto salvo → editar e salvar apagava o desconto
   - `novaOS()` não limpava campos de texto nem `osSvcs` → dados da OS anterior vazavam
   - Rascunho de OS nunca era limpo após salvar (agora `limparRascunho('os')` no `gerarOSPDF`)
   - `gerarPDF()` de orçamento não limpava rascunho
   - Rascunho do form: `gV('tel')` → `tel-cli`; chave `nota_interna` → `nota-interna` (campos nunca restaurados)
   - Botão "＋ Cadastrar Cliente" do estado vazio chamava `abrirFormCliente()` (inexistente) → `mostrarFormCliente()`
   - Falha ao salvar OS no banco agora mostra toast (antes só "#???" silencioso)

### ⚠️ SQL PENDENTE de rodar no Supabase:
```sql
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS origem_cliente text;
```
Sem essa coluna, o INSERT em background falha e o orçamento fica salvo apenas localmente.

### Storage pendente (para link de PDF no e-mail, opcional):
Bucket `vistorias-pdf` público + policies (instruções na tela Empresa → E-mail Automático).

---

---

## 📦 Controle de Estoque (implementado 2026-06-14 / 2026-06-21)

### Modelo de saldo (ledger):
- **Física** = `fisicaProduto(id)` — tipos físicos: `entrada/saida/ajuste/transf_entrada/transf_saida`
- **Reservada** = `reservadoProduto(id)` — tipos: `reserva/liberacao_reserva`
- **Disponível** = física − reservada. Negativo = encomenda/backorder (nunca bloqueia venda)
- `saldoProduto(id)` = física (compat). `disponivelProduto(id)` = disponível.

### Ciclo orçamento → estoque:
1. **Aprovar orçamento** → `sincronizarReservaOrcamento(orc)` reserva produtos (idempotente, ref `res:orc:<id>`)
2. **Concluir OS / botão Entregar** → `entregarOrcamento(orc, origem)` baixa física + libera reserva (refs `baixa:orc:id:pid` / `libres:orc:id:pid`)
3. **Reverter/excluir** → cancela reserva automaticamente

### Funções-chave:
```js
registrarMovimento({produto_id, tipo, quantidade, custo_unit, motivo, ref, lojaId})
sincronizarReservaOrcamento(orc)  // reconciliação idempotente de reserva
entregarOrcamento(orc, origem, qtyMap) // baixa física na entrega
transferirProduto(pid, deLoja, paraLoja, qty, custo, motivo) // transf entre unidades
recomputarCMP()           // recalcula custo médio ponderado a cada entrada
curvaABC()                // classifica produtos A/B/C por saída
listaEncomendas()         // produtos com disponível < 0
diasParaRuptura(pid)      // previsão de ruptura baseada em giro
```

### Regras importantes:
- **NUNCA** decremente um número de saldo — sempre crie um movimento
- `registrarMovimento` é local-first + sync assíncrono em background
- Auditoria: só movimentos físicos são logados (reserva/liberação são internos)
- Produtos filtrados por `produtosVisiveis()` — loja ativa ou que tem movimentos dela

---

## 🔐 Auditoria de Acessos (implementado 2026-06-21)

### Pontos monitorados:
| Ação | Onde é disparado |
|------|-----------------|
| `login` | `fazerLogin()` ao autenticar com sucesso |
| `orcamento_criado` | `gerarPDF()` ao criar novo orçamento |
| `orcamento_status` | `mudarSt()` ao alterar status |
| `orcamento_excluido` | `_excluirOrcConfirmado()` |
| `estoque_mov` | `registrarMovimento()` (só físicos) |
| `os_concluida` | `_fazerCheckoutConfirmado()` |
| `usuario_criado` | `salvarUsuario()` — novo usuário |
| `usuario_editado` | `salvarUsuario()` — edição |
| `usuario_removido` | `_excluirUsuarioConfirmado()` |

### Funções:
```js
logAcao(acao, detalhe)  // registra local + async no Supabase
lsAuditLer()            // lê localStorage ('fluxa_auditoria')
lsAuditSalvar(lista)    // salva (máx 500 registros)
loadAuditoria()         // carrega + merge Supabase; preenche filtro de usuários
renderAuditoria()       // renderiza a tabela com filtros
```

### Schema da tabela `auditoria`:
```sql
CREATE TABLE IF NOT EXISTS auditoria (
  id text PRIMARY KEY,
  usuario text, perfil text,
  acao text,    -- 'login' | 'orcamento_status' | 'estoque_mov' | 'os_concluida' | etc.
  detalhe text,
  loja_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(data DESC);
```
RLS: `anon full access` (igual às demais tabelas).

---

## Sessão 2026-06-21 — Gestão de usuários, auditoria, novo login

### O que foi implementado:
1. **Perfil `master`** — novo nível acima de gestor. `eGestor()` agora retorna `true` para master também. `isMainGestor()` aceita master sem loja. Botão de auditoria visível só para gestor/master.
2. **Edição de usuários** — botão ✏️ na lista; campo PIN vazio = mantém PIN atual; mudança de perfil atualiza acesso imediatamente. `_usrEditId` controla se é create ou update.
3. **Auditoria** — tabela `auditoria` + `logAcao()` + página `/auditoria` com filtros por ação e usuário. Local-first (localStorage, max 500) + sync async.
4. **Contas individuais criadas via API** (PINs hasheados SHA-256+`fluxa2025`, não no código):
   - Marcos (master), Tamara/Elis (gestor), Josimar/Eldecir/Bruno (técnico, loja: fortemp-camboriu)
   - Seeds antigos (`tec_marcos` etc.) desativados no banco.
5. **Login por nome + PIN** — substituiu grade de avatares. Campo de nome com autocomplete; 4 dígitos → login automático. Nenhum nome exposto antes do usuário digitar.
6. **setup.sql atualizado** com tabela `auditoria`, índice e RLS.

### SQL rodado no Supabase nesta sessão:
```sql
-- Tabela de auditoria (adicionada ao setup.sql e rodada via API Python)
-- (inserida via INSERT da API — tabela criada na próxima empresa nova via setup.sql)
-- Para banco existente (Forthemp), rodar manualmente:
CREATE TABLE IF NOT EXISTS auditoria (
  id text PRIMARY KEY,
  usuario text, perfil text,
  acao text, detalhe text, loja_id text,
  data timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_data ON auditoria(data DESC);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access" ON auditoria;
CREATE POLICY "anon full access" ON auditoria FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Sessão 2026-06-21 — Usabilidade, estabilidade e estorno de estoque

### Ajustes de usabilidade (verificados visualmente no preview):
1. **Toast mobile** — toast sobrepunha a barra de navegação inferior. Corrigido com `@media(max-width:680px){ .toast{ bottom:72px } }`.
2. **Campo de busca** — largura aumentada de `180px` → `240px`.
3. **Menu engrenagem** — 8 itens duplicados removidos; mantidos apenas: Dados da Empresa, Usuários, Auditoria, Sair.
4. **Card Técnicos (setup)** — substituído por card informativo com botão "Gerenciar Usuários →"; `<textarea id="cfg-tecnicos">` mantido oculto para compatibilidade JS.
5. **Rascunho (form)** — indicador visual "💾 Rascunho salvo às HH:MM" aparece quando há cliente preenchido.
6. **Autocomplete de nome no login** — mínimo 2 caracteres antes de mostrar sugestões (era 1).
7. **Ícone "Minhas OS"** na nav mobile: `📋` → `🗂️` (diferencia de OS avulsa).

### Estabilidade (ponto 5 e 6 da análise de sustentabilidade):
8. **Libs vendorizadas (`libs/`)** — 4 bibliotecas externas agora hospedadas localmente no repositório, eliminando dependência de CDN:
   - `libs/supabase.min.js` (193 KB, v2.105.3)
   - `libs/emailjs.min.js` (3.8 KB, v4)
   - `libs/html2pdf.bundle.min.js` (885 KB, v0.10.1)
   - `libs/chart.umd.min.js` (200 KB, v4.4.0)
   - SW atualizado de `fluxa-v4` → `fluxa-v5`; URLS pré-cache atualizadas para `libs/`.
9. **Error boundary global** — `window.onerror` captura erros de JS em `index.html` e exibe tela amigável "Algo deu errado" com detalhe do erro + botão "🔄 Recarregar o app" + "Seus dados estão salvos — nada foi perdido." em vez de página em branco. Não captura erros de rede/Supabase (filtro por `src`).

### Estoque — estorno ao excluir orçamento:
10. **`excluirOrc` agora pergunta sobre estorno** quando o orçamento teve saída física de estoque registrada:
    - **Sem saída** → exclui diretamente (sem pergunta adicional).
    - **Com saída** → abre 2º modal "Estornar estoque?" listando os produtos:
      - "Confirmar" → `_estornarSaidasOrc()` registra `entrada` para cada produto com motivo "Estorno — cancelamento orçamento #XXX" (rastreável no histórico de estoque).
      - "Não estornar" → exclui sem alterar o estoque.
    - Comportamento correto: apenas **reservas** são sempre liberadas na exclusão; saídas físicas exigem decisão explícita do usuário.

### Ciclo completo testado e validado:
Criar orçamento → Aprovar → Reservar estoque → Gerar OS → Entregar (baixa física) → Excluir com estorno → estoque volta ao valor correto.

---

## Sessão 2026-06-22 — Performance e robustez do módulo de estoque

### O que foi feito:

#### Limpeza de dados fictícios
- Produtos de simulação (`gerado de cloro 500`, `Motobomba Syllent 1 cv`) e as 18 movimentações de teste foram removidos do localStorage via `preview_eval`. Estoque limpo para uso real.

#### Análise de confiabilidade (resultado: processo está correto)
- Modelo ledger imutável ✅ — nenhum movimento é editado, só acrescentado
- `sincronizarReservaOrcamento` é idempotente ✅ — pode chamar várias vezes sem duplicar reservas
- Refs rastreáveis por orçamento (`baixa:orc:ID:prodID`) ✅ — auditoria e estorno funcionam
- Ciclo completo aprovado → reserva → baixa → estorno testado e validado

#### Performance — cache de saldo (`_getSaldoCache`)
- **Problema:** `fisicaProduto()` e `reservadoProduto()` varriam TODO `todosMovEstoque` a cada produto durante `renderEstoque()`. Com 50 produtos e 500 movimentos = 100 varreduras do array.
- **Solução:** cache `_getSaldoCache()` — uma única varredura que computa físico e reservado de TODOS os produtos de uma vez. Invalidado automaticamente por `_invalidarSaldoCache()` em:
  - `registrarMovimento()` — a cada novo movimento
  - Merge pós-sync com Supabase em `loadEstoque()`

#### Histórico de movimentos global — paginação e filtros
- De 15 linhas fixas para **30 por página** com navegação ←→
- Filtros por tipo: Todos / ＋ Entradas / − Saídas / ⚖ Ajustes
- Exibe contagem: "1–30 de 847"
- Estados: `_movFiltroTipo`, `_movPagina`, constante `_MOV_POR_PAG=30`

#### Histórico individual de produto — paginação e filtros
- **Novo:** paginação de 25 por página com navegação ←→
- Filtros por tipo: Todos / Ent. / Saída / Ajuste / 🔒 Reserva
- Exibe contagem total de movimentos do produto
- Estados: `_histProdId`, `_histProdPag`, `_histProdFiltro`, constante `_HIST_POR_PAG=25`
- `abrirHistProduto()` agora delega para `_renderHistProduto()` (função interna paginável)

#### Limite de segurança no localStorage
- `lsMovSalvar()` agora salva apenas os **2000 movimentos mais recentes** localmente
- Histórico completo continua disponível no Supabase (query `limit(5000)` no `loadEstoque`)
- Evita estouro da cota de 5MB do localStorage com alto volume diário

### Commits desta sessão:
- `33ae75f` — `perf(estoque): cache de saldo, paginação e filtros no histórico de movimentos`

---

## Sessão 2026-06-22 (continuação) — Fluxo de OS e Vistorias do Técnico

### Clarificação do modelo de negócio (decisão final):

**OS (Ordens de Serviço):**
- Criadas pelo **gestor** no calendário/agenda
- Técnico vê em **"Minhas OS"** (filtro padrão: ⏳ Agendadas)
- Técnico abre, preenche check-in, executa, preenche obs/materiais/fotos/checklist, faz checkout
- Campos do gestor são **somente-leitura** para o técnico

**Vistorias mensais:**
- Gestor cadastra **planos recorrentes** (Locais) em "Vistorias → Meus Locais"
- Cada mês, o técnico vê quais locais precisam de vistoria (status ✅ Realizada / ⏳ Pendente)
- Técnico clica "🔍 Fazer Vistoria" → preenche relatório completo de equipamentos
- Fluxo **completamente separado** das OS — não se misturam

### O que foi implementado / corrigido:

#### 1. Formulário de OS — modo técnico (read-only)
- `_abrirOSForm(o)` corrigido com 4 bugs em cadeia:
  - Checklist nunca renderizava ao editar OS existente (faltava `renderOsChecklist()`)
  - Campo "Responsável Técnico" ficava vazio → auto-preenche com nome da sessão
  - Select de check-in ficava em "Selecione…" → pré-seleciona o técnico logado
  - Campos do gestor agora ficam **read-only** quando técnico abre a OS:
    - `os-cli`, `os-loc`, `os-data`, `os-hora`, `os-cnpj` → `readonly` + fundo cinza
    - `os-loja` → `disabled`
    - Botão "+ Adicionar serviço" → oculto para técnico
- `restaurarRascunho('os')` ignorado quando `osEditId` está preenchido (evitava draft sobrescrever valores da OS carregada)
- `confirmar()` estendida para aceitar `cbNao`, `labelNao`, `labelSim` (modal com dois caminhos)
- `editarOS()` simplificada — apenas chama `_abrirOSForm(o)` sem modal de redirecionamento

#### 2. Minhas OS — separação e deduplicação
- OS com `agendamento_id` excluídas de "Minhas OS" (pertencem exclusivamente à aba Vistorias)
- Deduplicação por `id` (evita merge local+remoto)
- Deduplicação por `orcamento_id + data_servico` (OS gerada duas vezes do mesmo orçamento na mesma data)
- Botão "🔍 Nova Vistoria" removido do header (técnico não cria vistoria por lá)

#### 3. Vistorias — filtros e visibilidade corrigidos
- Campo `tecnico` no local é preferência de agenda, **não restrição de acesso** → técnico vê todos os locais ativos da loja
- `loja_id: "default"` agora tratado como equivalente à loja padrão (`LOJA_PADRAO_ID`) — locais antigos apareciam em branco por esse motivo
- Deduplicação por `cliente+local` adicionada em `loadLocais()` (executa a cada carregamento)
- Campo de busca "🔍 Filtrar por nome do local ou cliente…" adicionado na aba Meus Locais (filtra em tempo real)
- `go('visitas')` abre sempre na aba "Meus Locais" (aba "Nova Vistoria" oculta para técnicos)

#### 4. Calendário — distinção visual de tipos de OS
```js
// Cores dos eventos no calendário
tipo === 'vistoria'  → fundo roxo   🟣 (agendamento_id)
tipo === 'orcamento' → fundo laranja 🟠 (orcamento_id)
status === 'concluido' → fundo verde 🟢
status === 'cancelado' → fundo cinza
// padrão (serviço avulso) → azul padrão 🔵
```
Legenda de cores adicionada abaixo do calendário.

#### 5. `_gerarProximaOSdoAg(agId, dataConcluidaStr)` — nova função
Chamada automaticamente ao concluir uma OS com `agendamento_id` (check-out ou "Concluir" do gestor).
Gera a próxima ocorrência do agendamento quando a última OS do lote é concluída.

### Limpeza de dados (Supabase):
- **24 OS duplicadas deletadas**: 3 por `orcamento_id+data_servico` + 21 por `cliente+data_servico` do mesmo agendamento
- **Locais de vistoria deduplicados**: de 5 → 3 registros únicos salvos no `empresa_config` do Supabase
- Banco ficou com 60 OS únicas (53 de agendamentos, 7 normais) e 3 locais ativos

### Commits desta sessão:
- `bdc0474` — docs(claude): atualiza CLAUDE.md com sessão 2026-06-22
- `3cd989c` — fix(os): corrige 4 bugs no fluxo de execução do técnico
- `0054ff2` — fix(os,vistoria): separar fluxos técnico e vistoria corretamente
- `27dc827` — fix(minhas-os): remover botão "Nova Vistoria" da tela do técnico
- `a7ba7e6` — fix(minhas-os): separar vistorias e remover OS duplicadas
- `5308f7f` — fix(vistorias): corrigir filtro de loja em renderLocaisTab
- `3871a01` — fix(vistorias): técnico vê todos os locais ativos + dedup no load

---

## Sessão 2026-08-06 — auditoria da vistoria real do Infinity Coast Tower

Marcos refez em campo a vistoria do Infinity Coast Tower (`vis_1785959861209`, 2026-08-05) para validar o fix de fotos sumindo (commits `f44cdfe`/`da21e70`). Auditei o registro direto no Supabase via Management API.

**Resultado: fix de fotos confirmado funcionando.** 51 equipamentos em 12 ambientes, todas as fotos subiram como URL do Storage (`.../storage/v1/object/...`), nenhuma ficou presa em base64 local.

**Bug real encontrado e corrigido:** as colunas `recomendacoes` (text) e `obs_ambientes` (jsonb) — usadas pelas features dos commits `c3aced7` e `028d6f1` — não existiam no banco. `dbUpsert` é resiliente (não quebra o insert), mas descartava esses dois campos silenciosamente antes de sincronizar; ficavam só no localStorage do aparelho que salvou. Rodado (Marcos executou o ALTER manualmente no SQL Editor):
```sql
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS recomendacoes text;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS obs_ambientes jsonb DEFAULT '{}';
```
Nesse registro específico ficaram `null`/`{}` (Marcos escreveu tudo em "Observações Gerais" em vez do campo novo "Recomendações") — nenhum dado foi perdido, mas o buraco existia para qualquer vistoria futura que usasse os campos novos.

**Melhoria sugerida (não implementada, aguardando decisão do Marcos):** o item crítico "Aquecedor" (Spa junto com Piscina Interna — painel não funciona) ficou sem nenhuma foto anexada, diferente dos outros itens críticos da mesma vistoria. Possível ideia: alertar visualmente quando um equipamento marcado 🔴 crítico é salvo sem foto.

### Reforço de confiabilidade — vistorias longas com rede instável (commit `d59c44c`)

Marcos levantou a preocupação: vistorias grandes como a do Infinity levam a manhã/tarde inteira em campo, muitas vezes com wifi ruim em casa de máquinas/subsolo — risco de perder tudo ou travar ao salvar no fim. Auditei o mecanismo de rascunho/foto (`_salvarRascunhoVis`, `visAddFotoEquip`, `_uploadFotoStorage`, `loadVistoriasRemoto`, `_reenviarPendentes`) e achei 3 brechas reais, corrigidas:

1. **Foto que falhava 2x no upload nunca mais tentava de novo até o "Finalizar"** — mesmo com a rede voltando minutos depois. Nova função `_retryFotosVisEmAndamento()` entra na varredura periódica já existente (a cada 3min / ao reconectar via `_reenviarPendentes`), cobrindo a vistoria mesmo enquanto ainda está sendo preenchida.
2. **`_pendingSync` era limpo assim que o registro sincronizava**, mesmo com fotos ainda em base64 dentro do jsonb `equipamentos` — essas fotos nunca mais eram tentadas de novo (saíam da fila de reenvio para sempre). Agora só limpa quando todas as fotos da vistoria viraram URL do Storage; `loadVistoriasRemoto` também para de excluir da varredura os registros que já existem remoto (antes só reenviava vistoria 100% nova).
3. **Rascunho local sem espaço (muitas fotos, cota do navegador estourada)** descartava silenciosamente do rascunho salvo qualquer foto ainda não enviada — sem avisar o técnico. Se o app fechasse nesse momento, a foto se perdia de verdade. Agora mostra toast (limitado a 1x/min) avisando para manter a internet ligada até finalizar.

O que já funcionava bem e não precisou de mudança: rascunho automático a cada toque (local + nuvem, tabela `vistoria_rascunhos`), restauração completa ao reabrir (inclui cronômetro do check-in), upload de foto imediato na captura (não só ao salvar), e o registro da vistoria em si nunca fica só na memória — grava no `localStorage` (`fluxa_visitas`) de forma síncrona antes de qualquer coisa assíncrona rodar.

### Botão "Descartar vistoria" (commit `be6b988`)

Marcos reclamou: a restauração automática do rascunho é ótima quando está de fato no meio de uma vistoria, mas era chata quando ele queria desistir — só dava pra "sair" clicando Finalizar. Adicionado botão "🗑️ Descartar" ao lado de "Finalizar Vistoria" (`descartarVistoriaEmAndamento()`), com confirmação via `confirmar()`. Vistoria nova → apaga rascunho local+nuvem e limpa o form. Edição de vistoria já salva (`visEditId` setado) → descarta só as alterações não salvas, mantém o registro original intacto. De quebra corrigiu lacuna: `_limparFormVistoria` não zerava `visEquipSelecionados`, então os chips de equipamento padrão da vistoria anterior ficavam marcados na próxima (mesmo depois de Finalizar) — corrigido para os dois fluxos.

---

## 🔁 Vistoria → Orçamento → Dossiê (2026-08-06, commit `c9d7044`)

Fecha o ciclo do negócio (vistoria → orçamento → OS → vistoria). Dois botões no
histórico de vistorias, só para gestor:

- **💰 Orçar N** (`orcarDaVistoria`) — cria orçamento com os itens
  crítico/atenção, críticos primeiro (`[URGENTE]` antes de `[Preventivo]`),
  levando ambiente, marca/modelo e o **laudo do técnico** na descrição (o laudo
  é o argumento de venda). Preço fica em branco para revisão. Conserto de
  vistoria é **serviço** — trilho que converte 43,5%, não 8%.
- **🗳️ Dossiê** (`gerarDossieAssembleia`) — laudo de 1 página para o síndico
  **apresentar** na assembleia. Só aparece quando há item crítico. A peça-chave
  é o bloco **"Se não for feito"** (`_DOSSIE_CONSEQ`, regra por tipo de
  equipamento × status): o relatório técnico descreve o problema, mas a
  assembleia decide pela consequência. **Determinístico, sem IA** — offline,
  custo zero. Ver `docs/crm-camada-ia.md`.

`_normCliente` agora ignora acento, caixa e prefixo de tipo (reusa `_normNome`):
"Edifício Green Valey" = "Residencial Green Valey". ⚠️ **Sem fuzzy de
propósito** — "Infinity Coast", "Infinity Paradise" e "Infinity Flat" são
condomínios DIFERENTES; um CRM que mistura cliente é pior que um que duplica.

---

## ⚠️ AO TESTAR CONTRA O BANCO REAL: `dbOk` NÃO é `window.dbOk`

Incidente em 2026-08-06 (revertido, sem perda): tentei neutralizar a gravação
com `window.dbOk=false` antes de testar o modal de CRM. **Não funcionou** —
`dbOk`, `db` e `todosOrc` são `let` no escopo do script, e `window.dbOk=false`
só cria uma propriedade nova em `window`, sem afetar a variável que o código
lê. Resultado: 3 orçamentos reais foram gravados, um deles (#313, R$ 59.826)
teve o `status` mudado para `recusado`.

**Como testar com segurança** (em ordem de preferência):
1. Usar registro com `id` começando em `local_` — o código tem guarda explícita
   `!String(id).startsWith('local_')` antes de todo `dbUpdate`.
2. Testar as funções puras isoladamente, sem chamar a que grava.
3. Se precisar mesmo desligar: `dbOk=false` **sem** `window.` (funciona porque
   `let` no topo do script é alcançável pelo identificador no console).

E **sempre conferir o banco depois** — foi a checagem pós-teste que pegou isto.

---

## 📦 Estoque — o que foi destravado (2026-08-07, commit `5355d6e`)

**A lógica de compras já existia inteira e estava capada por 4 colunas ausentes**
(`fornecedor_id`, `lead_time_dias`, `estoque_seguranca`, `lote_minimo`). O form
tem os campos, `salvarProduto` grava, e o `dbUpsert` removia em silêncio.
Consequência: tudo caía em "Sem fornecedor definido", o botão 📲 WhatsApp nunca
aparecia e `pontoDePedido()` dava sempre 0. ✅ Criadas — `migracao-produtos-compras.sql`.

- **`_estoqueNegativos()`** — alerta no topo da tela de Estoque. Saldo negativo é
  inconsistência, não operação. Inclui **inativos** de propósito: desativar o
  produto não zera o saldo, então o furo pode ter sido "resolvido" só sumindo da
  lista (2 dos 3 casos de ago/2026 estavam assim).
- **Aba `💲 Sem custo`** + aviso no KPI "Valor em estoque": produto sem custo
  entra como R$ 0 e derruba o valor total sem avisar (226 sem custo, 29 com saldo).

### 💸 APROVAR = SAIR DO ESTOQUE (2026-08-07, commit `b66eb92`)

**O modelo mudou.** Não existe mais reserva: aprovar o orçamento **dá baixa
direta**. O antigo reserva→entrega exigia uma segunda confirmação que não
acontecia — 95% reservavam, 7% baixavam (a baixa dependia de concluir OS, e só
1 de 12 era concluída).

`sincronizarSaidaOrcamento()` reconcilia de forma idempotente (desejado − já
saiu = delta). Logo: **reverter devolve o material sozinho** e rodar duas vezes
não duplica. `sincronizarBaixaOrcamento` é o ponto de entrada e chama esta.

- **Sem saldo → negativo de propósito.** É o que joga o item na lista de compras
  como "encomenda". O modelo da casa é vender primeiro e comprar depois.
- **Não duplica** com `entregarOrcamento` nem com OS concluída: todos usam o ref
  `baixa:orc:<id>:<pid>`, que `_entregueProdutoOrc` já checa.
- **Estorno volta para a MESMA loja de onde saiu** (`lojaDaSaida`), nunca para a
  loja da sessão — foi esse detalhe que espalhou saldo errado no caso #284.
- **Legado convertido item a item, nunca em massa**: ao tocar num orçamento
  aprovado que ainda tem reserva antiga, solta a reserva e deixa só a saída
  (senão o disponível é penalizado duas vezes). Os 179 legados aguardam
  conferência da equipe.

⚠️ Reservas antigas presas vinham de um bug já corrigido: a reconciliação rodava
sobre cache defasado, lia orçamento ausente como "órfão" e liberava — repetindo
a cada sessão e empurrando o reservado a −186. Sintoma clássico no ledger:
motivo `Libera reserva #00?` e liberação numa loja diferente da reserva.

### ⚡ Baixa rápida de material (2026-08-07, commit `30a1970`)

`abrirBaixaRapida()` — busca produto → quantidade → motivo → confirma, **sem
depender de orçamento nem de OS concluída**. Botão na tela de Estoque **e em
"Minhas OS"**: o técnico consome material em campo e não tem acesso ao Estoque,
então antes não existia caminho nenhum para ele dar baixa.

`BAIXA_MOTIVOS` grava o porquê em `ref` (`baixa:venda`, `baixa:uso_servico`,
`baixa:perda`, `baixa:uso_interno`) — sem isso "saiu 3 cloros" não diz se a
empresa ganhou ou perdeu. **Venda** pede o valor e mostra a margem na hora.

- Saldo negativo **não bloqueia** (no modelo sob encomenda é o que joga o item na
  lista de compras), mas avisa antes de confirmar.
- Com **"Todas" selecionado a baixa não grava** — evita lançar na loja errada,
  mesma classe do bug de ajuste corrigido em 2026-08-06.

⚠️ **Ao limpar dado de teste: apague o localStorage ANTES do banco.** Deletar só
no banco não resolve — o reenvio de pendentes ressuscita o registro a partir do
cache local (aconteceu nesta sessão).

### Modelo de operação da Forthemp (importante para não “consertar” o que não é problema)
É **misto**: químicos e itens de consumo têm estoque real; equipamento caro
(trocador, motobomba) é **vendido primeiro e comprado depois**. Além disso, o
cadastro de produtos serve como **catálogo para orçar sem redigitar** — por isso
produto "sem movimento" **não é lixo** e NÃO deve ser arquivado em massa.

⚠️ **Saída sub-registrada:** 303 entradas contra 40 saídas; 118 OS com apenas 1
concluída (a baixa dispara no check-out) e o campo "Materiais utilizados" da OS é
texto livre, vazio nas 118. Só ~30% das linhas de orçamento aprovado têm
`produto_id`, e só essas movem estoque. Falta um caminho de **baixa rápida de
material** — pendente, ver conversa de 2026-08-07.

---

## 📊 Insights = PIPELINE, não contabilidade (2026-08-07, commit `0ebbfbb`)

Os 4 KPIs da `page-insights` eram cópia de `atualizarDash()` e recortados por
mês. Trocados por **Pipeline aberto · Parado +30d · Vence em 7 dias · Fechado no
mês** (só o último é mensal — carteira não zera na virada do mês).
⚠️ **`atualizarDash()` e o dashboard do Histórico NÃO foram tocados** — lá os
KPIs contábeis fazem sentido; o erro foi terem sido copiados para a tela de venda.

- `orcAbertoNoPipeline(o)` = pendente **ou** vencido. É MAIS amplo que
  `orcVivoNoFunil` de propósito: aquele responde "vale ligar?" (fila de ação),
  este "o que está na carteira?" (visão).
- **Barra de estágio** (`CRM_FAIXAS_IDADE`): Quente 0-7d · Sem resposta 8-30d ·
  Esfriando 31-90d · Frio 90d+, derivada da idade, sem schema. Clicar filtra a
  fila. Rótulos são de INTENÇÃO — quando houver rastreio de abertura do portal,
  "Sem resposta" vira "Cliente visualizou" sem reescrever a tela.
- **Score da fila** usa VALOR ESPERADO (`valor × CRM_CONV_EQUIP|SERV`), não valor
  bruto: equipamento tem ticket ~12x maior mas fecha ~7% contra ~40% do serviço.
  Equipamento também entra em dose menor na tela (`CRM_TETO_EQUIP=3` contra
  `CRM_TETO_FILA=8`) — é venda consultiva, 3 com profundidade rendem mais que 8
  por cima. Resultado: 6 serviço x 3 equipamento na fila do dia.
- **Histórico**: filtro `📂 Só abertos`, idade em dias por linha e cabeçalho
  `Data / idade` clicável (`histToggleOrdem`) para ordenar pelo mais parado.

⚠️ **`.est-*` é do módulo de ESTOQUE.** As classes da barra de estágio usam
`.fase-*` porque `.est-item`/`.est-nome` já existiam e sobrescreviam o layout dos
produtos (pego na verificação). Não reutilizar o prefixo `est-` fora do estoque.

⚠️ **Idade sempre por `_idadeEmDias()`** (dias de calendário). Comparar horas
corridas fazia o mesmo orçamento cair em faixas diferentes conforme a hora.

---

## 📊 Painel de Insights — landing do gestor (2026-08-06, commit `3c796d7`)

Nova `page-insights`: "Dinheiro do mês" (4 KPIs, independente do filtro de mês
do Histórico — sempre mês corrente) + **fila de follow-up em dois trilhos**
(equipamento × serviço, nunca uma lista única — ver `orcEhEquipamento`).
Vira a landing de gestor/master no login (era `go('history')`, agora
`go('insights')`); técnico e vendas não mudam.

Motor 100% JS puro, sem schema, sem backend, sem IA — `crmCandidatos()` em
`app.js`, sobre `todosOrc` já em memória:

- **Filtro negativo**: quem já comprou equipamento não recebe nova oferta do
  mesmo trilho (`_crmConjuntosCliente`). Cliente casado por **nome
  normalizado** — este banco não tem `cliente_id` (§ identidade do cliente,
  `docs/crm-insights-plano.md`); funciona só dentro de `orcamentos`.
- **Teto de 8 cards por trilho** na tela; resto some no rodapé "+N outros".
- **Feedback local** (`fluxa_crm_feedback`, sem schema): dispensou 3× → some
  pra sempre; "Liguei" → some por 3 dias.
- `crmMotivos()`/`crmSugestaoFala()`: mostra o porquê + frase pronta — público
  são técnicos que também orçam, não vendedores profissionais.

⚠️ Nav mobile (`.mob-nb`) já estava no teto de 5 slots — Insights **não** entrou
na bottom bar, fica em ☰ Mais (sidebar) como Estoque/Despesas/Produtividade.
`.hdr-nav` (desktop) é `display:none!important` por design — sidebar é o nav
real; não é bug se `nb-insights` aparecer oculto em devtools.

Prévia da fila com dados reais (ponto de parada validado antes de construir):
`docs/crm-fila-followup-previa.md`.

---

## 💰 Validade de preço ≠ vida no funil (2026-08-06, commit `b2df8c0`)

Dois conceitos que dividiam o mesmo campo e agora são distintos:

- **`validade_data`** = compromisso de **preço**. Continua curta e **inalterada**
  — o PDF do cliente não mudou, e não se trava custo por 90 dias.
- **Vida no funil** = até quando vale perseguir o negócio. Interna e longa.

`orcCicloLongo(o)` = **equipamento OU ≥ R$ 15k** → não é mais marcado `vencido`
automaticamente; ganha o selo "⏳ preço a revalidar" e **segue no funil**.
O corte usa trilho E valor porque equipamento converte ~8% em todas as faixas,
inclusive abaixo de R$ 15k (serviço abaixo de 15k converte 43,5%).

Helpers em `app.js`: `orcEhEquipamento`, `orcCicloLongo`, `orcPrecoARevalidar`,
`orcVivoNoFunil` (esta ainda **não usada** — é a base da fila de follow-up),
`_orcValidadeData` (parsing unificado, antes duplicado em `verificarVencidos` e
`autoVencerOrc` com regras diferentes).

⚠️ **Recusa do cliente é respeitada:** só volta ao funil o que o relógio matou
(`status='vencido'`), nunca o que foi `recusado`.

Antes: 8 orçamentos vivos de 272 (3%). Linha de base em
`docs/crm-baseline-2026-08-06.md` — **reexecutar as consultas de lá para medir
o efeito**, não confiar em impressão.

---

## ⚠️ ESTE REPO É O v1 — não aplicar migração do v2 aqui (2026-08-06)

Existem **dois sistemas e dois bancos**. Confundir quebra produção:

| | **v1 — este repo** (`fluxa-app`) | **v2** (`~/Documents/fluxa`, branch `dev`) |
|---|---|---|
| Supabase | `lbxwclwzeqqtnwvlxsxs` (produção) | `auoklaiffalbdgazrbdu` "Fluxa Saas" — **INACTIVE/pausado** |
| Escopo | `loja_id` (text) | `empresa_id` (uuid) + `minhas_empresas()` |
| RLS | `anon full access` | multi-tenant real |
| CRM | ❌ não existe | `page-crm`, `crm_*`, `insights`, `flagAtiva`, `supabase/functions/` |

🚫 **`setup-v2-delta27.sql` (e qualquer delta do v2) NÃO pode rodar neste banco** —
referencia `empresa_id`, `cliente_id`, `etapa_desde` e a tabela `insights`, que
aqui não existem.

Plano de CRM com insights **adaptado a este repo**: `docs/crm-insights-plano.md`.
Contém os achados medidos na base real (trocador é venda única; validade padrão
de 5 dias deixa só 8 pendentes de 272; serviço converte 43% × equipamento 7,1%).

---

## Sessão 2026-08-06 (continuação) — reservado negativo no estoque + OC via jsonb

> Relatado pelo Marcos: *"anomalia na contabilidade do estoque, por vezes os itens
> aparecem com quantidade errada e elas não estão conseguindo corrigir manualmente"*.
> Investigado contra o banco real (leitura via REST/anon). **Confirmado, com causa
> raiz provada nos dados.**

### 🔴 O bug: reservado NEGATIVO inflava o disponível

`disponível = física − reservada`. Com a reservada negativa, o app **mostrava mais
estoque do que existe**. Pior caso: SAL P/ GERADOR em Camboriú com física 86 e
reservada −60 aparecia como **146 disponíveis**. **17 pares loja/produto afetados**
(não 5 — a primeira contagem parou nos mais visíveis).

**Por que não conseguiam corrigir na mão:** o ajuste de inventário só escreve
movimento **físico**. O erro estava no **reservado**, que não tem nenhuma tela de
correção. Contavam certo, ajustavam o físico, e o número continuava errado.

### Causa raiz (provada, não suposta)

`_reconciliarReservasOrfas` **escrevia no ledger rodando sobre cache local**. A
guarda só exigia listas não-vazias — não exigia que a carga do banco tivesse dado
certo. Com `localStorage` defasado, um orçamento **APROVADO** ausente do cache era
lido como "órfão" e tinha a reserva liberada; a sessão seguinte repetia, empurrando
o reservado para negativo.

**Prova:** o orçamento **#260 está aprovado** e mesmo assim foi liberado 6 vezes com
motivo `#00?` — esse `?` só sai do fallback de órfã (`numero:'?'`), ou seja, o
orçamento **não foi encontrado** em `todosOrc`. Um dos casos acumulou 1 reserva
contra 8 liberações.

**Segundo defeito, junto:** a liberação usava `orc.loja_id`, que é `null` no caminho
de órfã → `registrarMovimento` caía no fallback `lojaAtiva` (a loja que o usuário
estava **vendo** na hora). Resultado real: reserva lançada em Camboriú e liberada em
**Aquamotor**, contaminando uma loja com saldo de produto que ela nunca reservou.

### Correções (commit `6ecee03`, sw v49→v50)
1. **Reconciliação só roda com dados confirmados do banco** — flags `_orcRemotoOk`/
   `_estoqueRemotoOk`, marcadas só após o merge remoto bem-sucedido em `loadHist`/
   `loadEstoque`. Offline não reconcilia mais. (Declaradas no topo do arquivo de
   propósito — declarar junto da função daria TDZ, que este projeto já sofreu.)
2. **Liberação herda a loja da reserva original**, nunca a da sessão.
3. **Trava nova:** liberação nunca derruba o reservado do produto abaixo de zero,
   mesmo com visão defasada do ledger.

### Reparo dos dados (aplicado, 17 movimentos)
Ledger é append-only por design, então a correção **não apaga** os lançamentos
errados: adiciona um `reserva` compensatório por (loja, produto), ref
`fix:reserva-negativa:<loja>:<produto>`, motivo explícito. 186 unidades no total,
**nenhum saldo físico tocado**. Reservado negativo: 17 → **0**.

### OC: `itens` gravado como string dentro de coluna `jsonb` (commit `9460670`)
`salvarOC` fazia `JSON.stringify(rec.itens)` numa coluna que já é `jsonb` — na volta
`Array.isArray()` dava `false` e virava `[]`. Três consequências: OC listada com 0
itens, abrir para editar vinha vazia (**e salvar por cima apagava**), e receber a OC
**não dava entrada no estoque**. Grava array nativo + `_ocNormalizar` na leitura dos
dois loaders (cobre registro antigo). A tabela estava vazia, então **nenhum dado foi
corrompido** — o fix é preventivo.

### Auditoria — 18/18 testes passaram
Harness que **extrai as funções reais do `app.js`** por casamento de chaves (não
redigita) e roda no JavaScriptCore via `osascript`. Cobre: gate offline (3 cenários),
órfã legítima ainda liberada, orçamento aprovado preservado, idempotência entre
sessões, trava do reservado negativo, loja correta na liberação, ciclo normal
aprovar/reverter/reverter-2x, e 6 casos de normalização de OC.

**Estado final do banco:** reservado negativo 0 · reservas em aberto 20, todas
legítimas, 0 órfãs · OC corrompida 0.

### Pendências que sobraram (precisam de decisão humana)
- **3 saldos físicos negativos** (−1 cada): CLORO GENCO L.E e CABO DE ALUMÍNIO 6M em
  Camboriú, gerado de cloro 500 em Itapema. **Não corrigi de propósito** — exige
  contagem real, inventar quantidade seria fabricar dado.
- **2 orçamentos aprovados com produto sem reserva nem baixa**: #193 (essência de
  eucalipto) e #188 (termômetro flutuante).
- **31 movimentos de teste** ainda no ledger (`test_toast*`, `test_concluir_orc*`).

### Lição para o protocolo
Função que **escreve** no ledger nunca pode rodar sobre cache local não confirmado.
Local-first é ótimo para *criar* registro (não perde trabalho em campo), e péssimo
para *reconciliar* (decide apagar coisa certa com base em visão incompleta). Toda
rotina de reconciliação precisa de duas guardas: (1) os dados vieram do banco nesta
sessão? (2) o resultado é impossível de ficar absurdo (saldo negativo)?

### 🔴 Corrigir manualmente em "Todas" lançava diferença errada na loja errada (`485250c`)
Perguntado pelo Marcos ("se precisarmos ajustar manualmente agora dá para corrigir?").
Dava — **errado**. O ajuste lança a DIFERENÇA entre o contado e o saldo atual, mas
`fisicaProduto()` passa por `filtrarPorLoja`: em "Todas" devolve a soma do GRUPO
enquanto o movimento cai numa loja só. Com dado real: SAL tem 86 em Camboriú e 102 em
Itapema; contar a prateleira de Camboriú (86) em "Todas" lançava `86 − 188 = −102` em
Camboriú, levando o saldo a **−16**. A gestora corrigiria de boa-fé e criaria um rombo
maior. Mesmo defeito no **balanço de inventário em lote**, multiplicado por produto.

Corrigido: movimentação manual (entrada/saída/ajuste) exige unidade definida
(`_lojaParaMovimento()`; tenant de loja única resolve sozinho); ajuste e balanço
comparam com `_fisicaProdutoNaLoja()`, nunca com o total do grupo; `lojaId` explícito;
modal e resumo do balanço mostram a unidade e o saldo daquela unidade.

**Como corrigir saldo hoje:** selecionar a unidade no topo (nunca "Todas") → Estoque →
⚖️ Corrigir → digitar a **quantidade real contada** (não a diferença). Resolve saldo
negativo: conta 4 com saldo −1 → lança +5.

### Tela de correção de RESERVA (`2ee1bca`)
A reserva é derivada dos orçamentos aprovados, então de propósito nunca teve campo
editável — e o inventário não resolve, porque só mexe no físico. Era o buraco que
deixou as gestoras sem conseguir corrigir. Botão **🔒 Reserva** no card (gestor,
vermelho quando negativa) abre modal que mostra a origem da reserva quebrada por
orçamento, o esperado recalculado pelos aprovados, e permite acertar.
`ref` = `fix:reserva-manual:*` **sem `orc:` de propósito** — a reconciliação de órfãs
varre por `orc:` e não pode confundir correção manual com reserva de orçamento
inexistente. Recusa valor negativo e exige motivo (vai para `logAcao`).

### Card de estoque no celular (`3cda715`)
Com a 5ª ação a fileira foi para 372px dentro de um card de 317px e o botão Reserva
ficou **fora da área tocável**. Ao medir apareceu um bug ANTERIOR: `.est-main`
(`flex:1;min-width:0`) era espremido até 0px e, como `.est-nome` tem `overflow:hidden`,
o **nome do produto ficava invisível** na lista em telas pequenas. `.est-acts-row`
passou a quebrar linha, `.est-acts` a encolher, e em ≤680px as ações vão para linha
própria. Desktop sem regressão.

### ⚠️ Duas sessões de IA escrevendo no MESMO worktree (2026-08-06)
Aconteceu de verdade nesta sessão: enquanto eu validava, a outra sessão commitou o
working tree inteiro — que naquele momento misturava minhas correções de CSS com a
feature de pipeline dela ainda em andamento. Ninguém perdeu trabalho, mas foi sorte.
**Antes de commitar, rode `git diff --stat` e confirme que tudo ali é seu**; se houver
mistura, avise em vez de commitar por cima. `git log --oneline -1 origin/main` pode
mudar entre o seu `git add` e o seu `push`.

---

## Tela inicial e Ordem de Entrega (2026-08-07)

### `telaInicial()` — ponto ÚNICO da tela de entrada (`ac33a98` + `c50a9e2`)
O Marcos pediu que o app **sempre** abrisse no Insights. O login já fazia isso,
mas o boot chamava `go('form')` fixo — então F5, reabrir pelo atalho ou voltar de
um PDF largavam a gestora no Novo Orçamento. Reproduzido recarregando de verdade:
gestor Camboriú/Itapema e master caíam em `form`.

Havia **6 lugares** decidindo a tela inicial com regra própria (login por PIN de
gestor, de técnico/vendas, seleção de loja, seleção de empresa do técnico, boot e
fim do setup de conexão). Todos passam por `telaInicial(sessao)` agora.
**Quem for mudar o destino, mude lá — não espalhe `go('...')` pelos pontos de
entrada de novo.** Foi a divergência entre eles que criou o bug.

Regra: gestor/master → `insights` · técnico → `minhas-os` · vendas → `form` ·
sem sessão → `form`. **Insights é gestor/master de propósito**: não está em
`pagesVendasOk` nem em `pagesTecnicoOk`, então mandar vendas/técnico para lá só
dispara "Acesso não permitido".

### 🧾 Ordem de Entrega (`978dddb`)
Venda de produto avulso (químico, peça) **não vira OS**: o material só sai e
alguém no local recebe. Faltava o papel que o comprador confere e assina.

`pdoc-entrega` (index.html) + `preencherDocEntrega(orc)` / `gerarOrdemEntrega(id)`
(app.js), no mesmo padrão dos outros documentos. Dois acessos: botão no modal de
aprovação (`#aprov-entrega-row`, aparece só quando há itens) e botão "🧾 Entrega"
no histórico, para reimprimir quando quiser.

- **Não cria registro no banco** — é derivado do orçamento. Reimprimir não duplica
  nada e não precisou de schema novo.
- **Lista TODOS os itens**, não só os com `produto_id`: químico digitado à mão não
  tem vínculo de produto e mesmo assim precisa ser conferido.
- **Sem preços**, de propósito: o objetivo é conferir O QUE chegou. Quem recebe
  costuma ser zelador/porteiro. Se um dia quiserem valor, é só adicionar a coluna.
- **Data da entrega em branco**: a entrega acontece dias depois da aprovação e quem
  preenche é quem recebe.
- `imprimirDoc('entrega')` — ao adicionar documento novo, lembre dos **3** pontos:
  `imprimirDoc`, o listener `beforeprint` e o `afterprint` (o do Android depende do
  primeiro; os outros dois do desktop).

---

## 📊 Roadmap de indicadores — números conferidos e primeiras entregas (2026-08-07)

Um roadmap de 7 fases foi proposto por outra análise. **Conferi os números contra
o banco real antes de agir** — eles batem:

| Afirmação do roadmap | Medido no banco |
|---|---|
| Cobertura de `produto_id` 14,5% | **14,5%** (194 de 1.341 linhas) — bate exato |
| `despesas` = 0 | 0 |
| `equipamentos` = 0 | 0 |
| Itapema 92% × Camboriú 37% de recebimento | **92,3% × 35,5%** |
| 214 nomes × 141 fichas de cliente | 216 × 141 |
| `cliente_id` em 0% dos orçamentos | 0 de 303 |
| `motivo` de ajuste é texto livre | 21 ajustes → **15 grafias distintas** |

### Aplicado: itens 5.2 e 5.4 (`f847caa`, `migracao-roadmap-fase5.sql`)
Os dois de esforço quase nulo que destravam indicador inteiro. **Aditivos**, já
no banco e verificados com insert de prova + rollback.
- `estoque_movimentos.motivo_cod` — seletor padronizado no ajuste (quebra, perda,
  contagem, devolução, furto, inventário, outro). **A coluna `motivo` NÃO virou
  enum de propósito** — seria destrutivo e perderia os 21 registros; o código
  entra ao lado e `motivo` segue com o detalhe escrito. Só aparece no ajuste
  (entrada/saída já têm tipo próprio); o balanço marca `inventario` sozinho.
- `ordens_compra.data_prevista` — **achado no caminho:** o formulário já tinha um
  campo rotulado "Data prevista" que na verdade gravava em `data` (data da
  ordem). Agora são dois campos de verdade; com `data_recebimento` sai o prazo
  real por fornecedor.

### 🔴 Confirmado, NÃO corrigido: qualquer um lê o banco inteiro
A fase 7.1 do roadmap está certa e eu **comprovei sem querer**: as consultas de
verificação acima rodaram com a anon key, que está num repositório **público** —
li os 303 orçamentos, faturamento e a base de clientes sem nenhuma credencial
privada. Todas as tabelas têm `anon full access` e o controle de acesso vive só
no JS.
**Não mexi de propósito:** trocar isso por Auth + RLS sem o Marcos presente
arrisca trancar a equipe inteira fora do sistema em produção. Precisa ser feito
com ele acompanhando, e de preferência fora do horário de operação.

### Não fiz por serem decisão de produto, não de engenharia
Contas a receber por parcela (1.1), despesas com centro de custo (1.2), DRE
(1.3), `cliente_id` + deduplicação (fase 3) e base instalada (fase 4). São
grandes, mexem em dinheiro e identidade, e o próprio roadmap diz que o backfill
de cliente tem de ser **assistido, não automático** — 73 nomes sem ficha e 13 de
14 locais de vistoria sem match; casamento por string erraria em silêncio.

---

## Perguntas em aberto (aguardando Marcos responder)

1. **CNPJs reais** das 3 empresas — para preencher tabela `lojas` e emissão de NF
2. **Tokens Focus NFe** — um por CNPJ (homologação e produção)
3. **Template EmailJS** — adicionar novas variáveis `{{duracao}}`, `{{status_geral}}`, `{{link_pdf}}` ao template
4. **Tabela `auditoria` no banco de produção** — rodar o SQL acima se ainda não foi rodado (o app funciona sem ela, só não sincroniza o log).
- [ ] **PIN legado:** com contas individuais criadas, o fallback de PIN legado em `pinValido()` pode ser removido. Confirmar com Marcos se há algum usuário legado antes de remover.
