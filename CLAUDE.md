# Fluxa App — Contexto do Projeto

---

## 🔧 Tarefa 3i — O ciclo Orçamento → OS → Relatório, EM ANDAMENTO (19/08)

Novo pacote no handoff (`PLANO-3I-CICLO-OS.md` + `DIAGNOSTICO-OS.md` +
`DIAGNOSTICO-ORCAMENTOS.md`, `~/Downloads/design_handoff_fluxa_redesign/`).
Achado central dos diagnósticos: o ciclo "orçamento → OS → relatório" tem só
as duas primeiras etapas — **relatório de serviço executado não existe no
código** (`gerarOSPDF` imprime a ORDEM, antes de ir; nada imprime o que foi
FEITO, depois de voltar). E a OS tem **três botões que a terminam**
(Concluir/Check-out/Salvar), origem direta do bug de duplicação já corrigido
em 19/08 — o fix tratou o sintoma, a causa é estrutural.

**8 commits, um por vez**, ordem do próprio plano (3i.2 antes do resto — "dá
pra medir quantos orçamentos estão parados antes de mexer em mais nada").
Referências visuais: `Fluxa OS Fluxo.dc.html` (turno 11a) e
`Fluxa Orcamento Fluxo.dc.html` (turno 12a). Este arquivo documenta cada
commit conforme fecha.

### ✅ 3i.1 — Componentes compartilhados

`_renderTrilhaEstados(nos)` e `_renderCartaoEstado(cfg)` (novas, `app.js`,
antes de `_orcSituacao`) — as duas peças que os turnos 11 e 12 usam.
**Reaproveitam as classes CSS que a Oficina já tem** (`.of-rep-trilha`/
`.of-rep-no*`/`.of-rep-linha` para a trilha, `.of-rep-dark*`/
`.of-rep-timeline*` para o cartão escuro) — mesma linguagem visual, zero CSS
duplicado. **A Oficina não foi tocada** (`_ofRenderRepTrilha`/
`_ofRenderRepCartao` continuam exatamente como estavam) — esta dupla nova é
genérica (recebe array de nós / objeto de config), a da Oficina continua
acoplada a `OFICINA_STATUS_SEQ`.

Só 2 adições pontuais ao CSS existente, nada quebrado: `.of-rep-no-dot.novo`
(borda tracejada — nó "etapa que ainda não existe no sistema", ex.:
"Relatório enviado" na trilha de OS) e `.of-rep-dark-bar`/`.of-rep-dark-top`
(barra de progresso + linha de cabeçalho com rótulo+timer, que a Oficina não
precisava e o turno 11/12 pedem).

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova): as
duas funções chamadas com dado sintético batendo com o mock do turno 11a
("Marcos está no local", 00:42, 2 de 4 serviços, barra 50%, caixa "O
relatório precisa de" com 2 itens, botão "Ligar para o Marcos") — visual
conferido por screenshot, bate com a referência. Trilha com 5 nós (2
concluídos verde-check, 1 atual azul, 1 futuro borda sólida, 1 "novo" borda
tracejada) renderizando certo. Zero erro novo no console.

sw.js: fluxa-v205 → fluxa-v206.

### ✅ 3i.2 — Histórico de orçamentos: a coluna "Execução"

**Fazer primeiro, como o plano pedia** — "dá pra medir quantos orçamentos
estão parados antes de mexer em mais nada".

`_orcExecucao(o)` (nova, perto de `_orcProximaAcao`) — deriva de
`ordens_servico.orcamento_id`, **sem tabela nova**, os 5 valores do
diagnóstico + um 6º estado natural que a tabela do diagnóstico não citava
(OS agendada, ainda sem check-in — precisa existir entre "sem OS" e "em
campo", senão uma OS recém-criada pelo agendamento em lote ficaria sem
rótulo): `—` (não aprovado) · `sem OS há N dias` (âmbar, linha
`--warn-row`) · `OS #NNN agendada` (cinza) · `OS #NNN em campo · HH:MM`
(azul, ponto `var(--c1)`) · `executado DD/MM · sem relatório` (âmbar-escuro,
linha de aviso) · `relatório enviado DD/MM` (verde — inatingível até a
3i.8 existir, mas a lógica já está pronta pra quando existir).

`renderTabela()` ganhou a coluna (grid de 7→8 valores, `Execução` entre
"Próxima ação" e "Origem", `1.1fr` por ter texto de tamanho bem variável) —
**as colunas existentes (Idade, Próxima ação, Origem) não foram removidas**,
decisão deliberada: o plano pedia "coluna nova", não uma reescrita da
tabela inteira, e Idade/Origem continuam informação real que alguém usa.
Linha ganha fundo `--warn-row` quando `warnRow:true` (sem OS ou executado
sem relatório) — mesmo padrão visual já usado em Estoque/OS pra "isto
precisa de atenção".

**Chip "Sem OS N"** (`_orcRenderChips`) — mesmo padrão do "Atrasado" em OS:
aparece só quando > 0, primeiro da fila, `rd-chip-alert`. Clicar filtra
(`filtroSt='sem_os'`, novo branch em `_orcListaFiltrada`).

**Ação em lote "Agendar as N aprovadas sem OS"** (rodapé, só aparece com
N>0) — modal de verdade (`abrirAgendarEmLote`/`_confirmarAgendarEmLote`),
não um toast genérico como o plano exigia explicitamente. Data/hora/técnico
de partida compartilhados, lista cada orçamento com resultado POR ITEM
("OS #NNN" verde, "já tinha OS" cinza, "erro" vermelho) — não trava a UI
achando que é tudo-ou-nada. **Refatorado `criarOSdeAprovacao` pra reusar o
mesmo núcleo** (`_criarOSRapida(orc,data,hora,tec)`, extraído, sem DOM) —
o modal individual (turno 11/já existia) e o lote agora chamam a MESMA
função de criar, zero lógica duplicada. Mesma trava contra duplicar (já
existe OS pro orçamento) nos dois caminhos.

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova, 5
orçamentos sintéticos cobrindo os 5+1 estados): cada estado derivado
corretamente (bug pego no processo — data saía com ano, "12/08/2026" em
vez de "12/08"; corrigido, `_dataBR` fatiado pros 5 primeiros caracteres);
linha com fundo de aviso nos 2 estados que pedem atenção; chip "Sem OS 1"
aparecendo e filtrando certo; modal de lote abrindo com o item certo,
"Agendar 1 OS" executando de verdade (offline, `_pendingSync`), item
mudando pra "OS #001 (offline)" em verde, botão primário sumindo e
"Cancelar" virando "Fechar" ao concluir, chip/rodapé atualizando o novo
total depois. Zero erro novo no console.

sw.js: fluxa-v206 → fluxa-v207.

**Número real medido em produção, direto do banco (leitura, PAT)**: **98
orçamentos aprovados sem OS, R$ 167.895,76 vendidos e parados** — confirma
o achado central dos diagnósticos, não é exagero de mockup. Só 2 OS
concluídas sem relatório (baixo, mas o relatório nem existe ainda —
3i.8).

### ✅ 3i.3 — Histórico: os quatro KPIs

Trocado `.dash.dash-3` (Total Emitido/Aprovados/Ticket Médio, último bloco
em estilo pré-redesign da tela — Ticket Médio não gerava ação nenhuma)
por `_renderOrcKPIsNovo()`, 4 `.rd-card.rd-card-dense` no container
`#orc-kpis-novo` (`.ins-kpis`, mesma grade de 4 colunas → 2 em ≤900px já
usada por Estoque/Despesas — zero CSS novo):

- **Pipeline aberto** (escuro, `rd-card-dark`) — soma dos abertos
  (pendente+vencido), mesmo critério de `orcAbertoNoPipeline` já usado
  nos chips.
- **Aprovados no mês** — mês corrente fixo (não segue a navegação de mês
  do card "Resumo do período" logo abaixo, que continua como estava — os
  dois recortes coexistem de propósito, um é KPI principal, o outro é
  navegável).
- **Aprovado sem OS** — reusa `_orcAprovadosSemOS()` (3i.2, mesma função
  do chip e da ação em lote — três lugares, um cálculo só). Borda/texto
  `--warn` quando > 0, some o alerta visual quando 0 (nunca fica vermelho
  por padrão).
- **Taxa de fechamento** — aprovados/emitidos nos últimos 90 dias, janela
  fixa (não é o mês navegado — é sobre ritmo recente).

`atualizarDash()` chama `_renderOrcKPIsNovo()` no lugar dos 3 `setV_el`
antigos (`d-emit`/`d-aprov`/`d-tick` — os ids saíram do HTML,
`setV_el` é no-op seguro em elemento ausente, não precisou de guarda
extra).

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova, 4
orçamentos sintéticos — 2 aprovados este mês um com OS outro sem, 1
pendente, 1 recusado): Pipeline aberto R$90 (só o pendente), Aprovados no
mês R$300 (os 2 aprovados), Aprovado sem OS "1 · R$100 vendidos e
parados", Taxa de fechamento 50% (2 aprovados de 4 emitidos nos últimos
90 dias) — todos batendo com o cálculo manual. 390px sem overflow
(`docWidth===winWidth===390`). Zero erro novo no console.

sw.js: fluxa-v207 → fluxa-v208.

### ✅ 3i.4 — Orçamento aberto: uma barra em vez de três

`#form-back-bar` + `#form-acoes-edit` + o título do `.novo-orc-topbar` —
"doze controles em três fileiras" (DIAGNOSTICO-ORCAMENTOS.md, "problema
1") — viraram uma barra só, `#form-topbar-unificada`. Reaproveita
`.of-rep-topbar`/`.of-rep-back`/`.of-rep-titulos` (mesma classe que a
ficha da Oficina já usa) — zero CSS novo pra essa parte, só o dropdown
"Mais ▾" é novo (`.rd-dropdown-wrap`/`.rd-dropdown-menu`, mesmo padrão
visual do menu de engrenagem existente, `.gear-wrap`/`.gear-menu`, classe
própria e reaproveitável).

**Conteúdo da barra**: voltar · "Orçamento #NNN · Cliente" · linha de
apoio (valor + aprovado/criado DD-MM) · badge "preço a revalidar" quando
aplicável · **select de status continua editável** (não virou badge só de
leitura — trocar status manualmente, ex. recusar/reverter aprovação, é
ação real e frequente demais pra tirar do controle principal só porque o
mockup mostra um pill estático) · ação secundária (Registrar contato
quando aberto/pendente, PDF quando não) · Mais ▾ (Gerar OS ou Abrir OS
#NNN, Comprovante de entrega, WhatsApp, Mês de aprovação, NF, Duplicar,
Excluir).

**Registrado como temporário, não é decisão final**: "Gerar OS"/"Abrir
OS"/"Entregar"/"Comprovante de entrega"/WhatsApp foram pra dentro de
"Mais" porque a ação PRIMÁRIA por estado (cartão escuro, 3i.5) ainda não
existe nesta tela neste commit — a 3i.5 (próxima) deve puxar "OS" pra
fora do menu e pra dentro do cartão de estado, sobrando só o que
realmente é ocasional dentro de "Mais".

**"Salvar rascunho"/"Gerar PDF e enviar" não foram tocados** — ficam no
`.novo-orc-topbar` de sempre, só o título dali (`#novo-orc-titulo-wrap`)
some quando a barra unificada já está mostrando o título (evita repetir
"Orçamento #416" duas vezes); em "Novo orçamento" (sem editId) a barra
unificada fica oculta e o título volta a aparecer ali, exatamente como
sempre foi — zero mudança nesse fluxo.

`_renderFormAcoesEdit` foi renomeada pra `_renderFormTopoUnificado`
(3 call sites atualizados: `abrirOrc`, `_limparCamposOrc`, `duplicarOrc`)
— `#form-back-bar`/`#form-acoes-edit`/`#form-btn-contato` saíram do HTML;
qualquer `getElementById` residual dessas ids em código não tocado vira
no-op seguro (`setV_el` e os guardas `if(el)` já protegiam isso).

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova):
orçamento aprovado com item — barra mostra título/valor/data/badge/select/
PDF/Mais certos, batendo visualmente com a referência (turno 12a);
dropdown "Mais" abre com os 7 itens certos, fecha ao clicar fora; perfil
vendas — dropdown sem "Emitir Nota Fiscal" nem "Excluir" (`ocultarFinanceiro`
respeitado); `novoOrc()` — barra unificada continua oculta, título antigo
volta a aparecer "Novo orçamento", zero regressão; 390px sem overflow
(`docWidth===winWidth===390`), barra quebra em 2 linhas de forma limpa.
Zero erro novo no console.

sw.js: fluxa-v208 → fluxa-v209.

### ✅ 3i.5 — Orçamento: a OS como estado, não como botão

**Escopo ajustado deliberadamente**, registrado com transparência: o
mockup (turno 12a) mostra a coluna esquerda inteira virando um resumo
travado ("Serviços orçados" só-leitura + "Como este orçamento andou") no
lugar do formulário editável quando aprovado, e a prévia do PDF cedendo
espaço pro cartão de estado. **Não fiz essa troca** — desabilitar o
formulário de edição pra orçamento aprovado é mudança de comportamento
grande demais pra decidir sozinho (Revisar preço/serviço depois de
aprovar é caso real, e a prévia do PDF é "a melhor coisa da tela",
propositalmente marcada como não mexer). Implementei as 3 peças de valor
real do commit **como adição, não substituição** — zero risco pro
formulário existente:

- **Trilha de 6 nós** (Enviado → Negociado → Aprovado → OS → Relatório →
  Recebido) logo abaixo da barra unificada (3i.4). `_orcTrilhaNos(o)`
  deriva o nó atual de sinais que já existem (crm_notas, data_aprovacao,
  OS vinculada, `_orcSaldoAReceber`) — "Relatório" sempre nasce tracejado
  (`estado:'novo'`, mesmo tratamento do 3i.1) porque a 3i.8 ainda não
  existe; "Recusado" substitui o nó "Aprovado" com a cor de cancelamento
  (`.of-rep-no-dot.cancel`, já existia, reaproveitado) — recusa é saída
  lateral, não um nó a mais na sequência linear.
- **Cartão de estado da OS** (`_orcCartaoOS`, reusa `_renderCartaoEstado`
  de 3i.1) — só aparece quando aprovado (sem OS = "Agendar a execução";
  agendada = "Abrir OS #NNN"; em campo = cronômetro + técnico; concluída =
  data). Fica **acima** da prévia do PDF, não no lugar dela.
- **"Como este orçamento andou"** (`_orcComoAndou`) — card novo no fim da
  coluna esquerda, junta `crm_notas` + marcos da OS (criada, chegada do
  técnico, concluída) numa timeline só, mais recente primeiro. Mistura de
  propósito: a pergunta é "o que aconteceu com este negócio", não duas
  listas separadas.

As 3 peças reaproveitam `.of-rep-trilha`/`.of-rep-dark`/`.of-rep-timeline`
(mesmas classes já usadas por Oficina e pelos 3i.1-3i.4 anteriores) —
zero CSS novo neste commit.

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova):
orçamento aprovado com OS em campo — trilha com 3 nós verdes + 1 azul
atual + 1 tracejado + 1 futuro, cartão escuro "#212 · em campo /
Marcos G. está no local / 00:42 / Abrir OS #212" acima da prévia (prévia
intacta, testada renderizando normalmente do lado), timeline com os 5
eventos em ordem cronológica correta; orçamento recusado — trilha com nó
"Recusado" na cor de cancelamento, cartão de OS corretamente ausente
(`display:none`, só aparece quando aprovado); `novoOrc()` — os 3 elementos
somem, zero regressão. 390px sem overflow (a trilha rola por dentro de si
mesma, `.of-rep-trilha` já tinha `overflow-x:auto` desde a Oficina). Zero
erro novo no console.

sw.js: fluxa-v209 → fluxa-v210.

### ✅ 3i.6 — OS: uma ação primária por estado

**Escopo: versão completa do mockup, aceitando o risco.** Diferente do
resto da tarefa 3i, aqui EU flaguei o risco antes de codar (via
`AskUserQuestion`) — o commit mexe direto no mecanismo de salvar/duplicar
da OS corrigido no MESMO DIA (seção "OS saindo duplicada", logo abaixo) —
e o Marcos escolheu explicitamente a versão completa em vez da reduzida
que eu tinha proposto como padrão mais seguro. Registrado aqui porque é a
única vez nesta tarefa que a decisão de escopo não foi minha.

**O que o diagnóstico apontava (DIAGNOSTICO-OS.md)**: a OS tinha **três
botões que a terminam** (Concluir, no topo/`_renderOSAcoesEdit`; Check-out,
no card de check-in; Salvar OS, no rodapé) — origem direta do bug de
duplicação já corrigido mais abaixo neste arquivo. O fix daquele dia tratou
o SINTOMA (trava contra clique duplo); esta tarefa ataca a CAUSA
estrutural (três caminhos concorrentes de "terminar a OS").

**`#os-acoes-edit` (badge + botões soltos) virou 3 containers**
(`#os-topbar-unificada`/`#os-trilha`/`#os-cartao-estado`), montados por
`_renderOSEstado(o)` — mesmo trio já usado no orçamento desde 3i.4/3i.5,
reaproveitando as mesmas classes `.of-rep-*` (zero CSS novo). Barra
unificada tem voltar+título+badge de status+"Imprimir ordem"+"Mais ▾"
(Notificar conclusão/Lembrete de visita/Levar pra Oficina/Excluir,
condicionais por status — "Marcar como concluída" só aparece quando ainda
não terminou). Trilha de 5 nós (`_osTrilhaNos`): Orçamento aprovado/OS
criada → Agendada → Em campo → Concluída → Relatório enviado (este último
sempre `'novo'`/tracejado, mesmo tratamento do 3i.1 — a 3i.8, que
implementaria o relatório de verdade, ainda não existe). Cartão de estado
(`_osCartaoEstado`, reusa `_renderCartaoEstado` do 3i.1) muda por estado:
agendada mostra data/hora/técnico; em campo mostra cronômetro ao vivo +
"chegou às HH:MM"; concluída mostra a duração.

**Trava desktop-gestor "sem Concluir enquanto em campo"** — pedida pelo
próprio diagnóstico: quando a OS está `em campo` (`checkin_time` setado,
sem `checkout_time`) e quem está olhando é gestor (`eGestor()`), o cartão
mostra só uma nota informativa ("Quem finaliza é quem está no local —
feche pelo celular de quem está lá, não por aqui"), sem nenhum botão de
concluir remotamente — fechar a OS por quem não está no local era
justamente o que produzia OS concluída e vazia (o bug do check-out fantasma
já documentado). **Decisão deliberada: não fabriquei um botão "Ligar" com
`tel:`** — telefone de técnico não é rastreado em nenhum lugar do schema
(confirmado por grep em `usuarios`), e inventar um link morto seria pior
que não ter o atalho.

**Valor Total travado só quando há orçamento vinculado** — `#os-total`
(era `<input type="number">` solto) ganhou `_osAtualizarValorTravado()`:
com `osOrcId` setado, o campo puxa o total do orçamento aprovado, fica
`readonly` e cinza, com tooltip explicando por quê; sem vínculo (OS
avulsa, criada do zero), continua 100% editável — o mockup pedia o campo
travado sem distinguir os dois casos, e travar OS avulsa (que nunca teve
preço fechado em lugar nenhum) quebraria o único jeito de lançar valor
nela.

**Autosave real, não por keystroke** — `_persistirOS(silencioso)` (núcleo
de gravação extraído de `gerarOSPDF`, reaproveitado pelos dois) roda a
cada 20s (`setInterval`) só quando `page-os` está ativa E a OS já existe
de verdade (`osEditId` setado) — decisão de engenharia, não de escopo:
prender um listener em cada campo do formulário (cliente/local/serviços/
checklist/fotos/materiais) era superfície de risco grande demais pro
tempo disponível, e o resultado visível pro usuário ("Salvo
automaticamente às HH:MM", `_marcarOSSalva()`) é entregue de qualquer
jeito. **"Criar OS" continua exigindo um clique explícito** (botão novo no
rodapé, `criarOSInicial()`, só existe antes do 1º save) — só depois desse
primeiro save o autosave silencioso assume.

**Achado no processo, corrigido** (não estava no escopo original da 3i.6,
mas quebrava a premissa dela): `fazerCheckin()` NUNCA gravava
`checkin_time` no registro — só existia na variável em memória
`checkinAt`, e o banco só recebia os dois campos (`checkin_time` +
`checkout_time`) juntos, no check-out. Resultado: o cartão/trilha novos
(e a coluna Execução da 3i.2, que já dependia da mesma checagem
`checkin_time && !checkout_time`) NUNCA detectariam "em campo" de
verdade — o dado simplesmente não existia no registro até o serviço já
ter terminado. Corrigido: `fazerCheckin()` agora grava `checkin_time` no
`todosOS` local e no banco (`dbUpdate`) na hora do check-in, e re-renderiza
o cartão/trilha se a OS estiver aberta. Achado análogo em
`_fazerCheckoutConfirmado()`: o check-out já persistia tudo certo, mas
nunca chamava `_renderOSEstado()` — quem via a tela em tempo real via o
status mudar só depois de sair e voltar. Adicionado o refresh ali também.

**Merge de cards** — "Serviços a Executar" e "Confirmação da Execução"
viraram um card só (o mockup pede planejado+executado juntos); os 5
títulos com emoji (⏱/📦/🧰/✅/📷) perderam o emoji, mesmo critério das
varreduras anteriores; o botão "↺ Resetar" do checklist saiu (função
`resetChecklist()` removida junto — sem outro chamador, confirmado por
grep); `btn-os-only-msg` (confirmado 100% morto antes desta tarefa —
`display:none` fixo, nunca mostrado por nenhum código) foi removido do
HTML.

**Rodapé — de 3 botões pra 1**: `btn-os-pdf`/`btn-os-both` (Salvar OS / OS
+ Orçamento) saíram; "Imprimir ordem" (na barra unificada, sempre visível
depois do 1º save) cobre a reimpressão. O atalho de teclado Ctrl+S
(`page-os`) foi atualizado pra clicar `btn-os-imprimir` quando a OS já
existe (`osEditId`) ou `btn-os-criar` quando ainda não existe — antes
apontava pro `btn-os-pdf` que deixou de existir.

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova,
clique/chamada real, não só leitura de estado): ciclo completo "Nova OS"
→ preencher → `criarOSInicial()` → título vira "Editar OS #NNN", botão
some, topo/trilha/cartão aparecem, indicador de autosave mostra o
horário; reabrir a OS (`editarOS`) restaura os campos e mostra Valor
Total destravado (OS avulsa); OS gerada de um orçamento aprovado
(`_gerarOSdeOrcProsseguir`) mostra Valor Total travado no valor do
orçamento, trilha com "Orçamento aprovado" como 1º nó; check-in real
(`fazerCheckin()`) grava `checkin_time` na hora, cartão muda pra "Em
campo" com cronômetro, nota do gestor correta (trava confirmada) vs. nota
do técnico (sem trava); check-out (`_fazerCheckoutConfirmado`) muda
status pra `concluido` e o cartão atualiza pra "Concluída" SEM precisar
sair e voltar (confirma o fix do refresh); "Mais ▾" abre com os itens
certos por status, fecha ao clicar fora; 8 títulos de card confirmados
sem emoji, "Serviços a Executar"+"Confirmação da Execução" no mesmo card;
375px sem overflow (`docWidth===winWidth===375`, trilha rola por dentro
de si mesma); zero erro novo no console (só o ruído de boot já
documentado, reproduz mesmo sem nenhuma mudança minha).

sw.js: fluxa-v210 → fluxa-v211.

---

## 🔴 OS saindo duplicada — causa raiz achada e corrigida em 2 pontos (19/08)

Marcos: testando a OS do Edifício Infinity Coast Residence, disse "tentei
salvar lá, não sei se salvou" — pediu pra verificar o modal e o fluxo de
salvar/PDF. Investigado direto contra produção (leitura, PAT) antes de
mexer — achado o problema real, não só falta de feedback visual.

### Achado em produção: 4 OS idênticas em 23 segundos

`ordens_servico` #195/197/198/199 — mesmo cliente, mesmo endereço, mesma
`obs_tecnica` ("Substituição da resistência defeituosa executada."), mesmo
técnico, criadas entre 20:35:23 e 20:35:46 (23s de diferença). Mais um par,
#193/#194, mesmo `orcamento_id`, 93s de diferença. **O usuário claramente
tentou salvar mais de uma vez, sem certeza se tinha funcionado — e cada
tentativa criou uma OS nova, nunca atualizou a mesma.**

### Causa raiz 1 — `gerarOSPDF()` nunca "lembrava" que já tinha salvado

Depois de um `dbInsertNumerado` bem-sucedido (criar OS nova), `osEditId`
continuava `null` — nada na tela nem no estado interno indicava "esta OS já
existe". Um segundo clique em "Salvar OS" (ansiedade por falta de feedback,
ou toque duplo no celular) rodava a função de novo do zero: `osEditId` ainda
null → cai no mesmo branch de INSERT → outra OS. Diferente do orçamento
(que já tinha proteção via `_orcSyncEmVoo` contra uma corrida assíncrona
diferente), aqui não tinha proteção NENHUMA — nem contra clique duplo
rápido, nem contra clique deliberado minutos depois.

**Corrigido, 3 partes:**
1. **Botões travados durante o salvamento** (`btn-os-pdf`/`btn-os-both`
   `disabled=true` no início, `false` no fim) — impede o clique duplo
   rápido (toque duplo no celular) de disparar duas chamadas simultâneas.
2. **`osEditId` passa a apontar pra OS recém-criada** assim que o insert
   resolve — um clique seguinte (mesmo minutos depois) cai no branch de
   UPDATE, nunca cria outra. Mesmo tratamento no caminho offline (local
   `_pendingSync`) — antes também recriava um `local_os_*` novo a cada
   clique.
3. **Cache local (`todosOS`/`fluxa_os_hist`) atualizado depois de
   INSERT e de UPDATE online** — antes, um save online bem-sucedido nunca
   atualizava o estado em memória (só o banco sabia que a OS existia); um
   segundo clique não tinha como saber que já tinha uma, e reabrir a OS sem
   reload mostrava dado velho.

**Feedback visual reforçado** (ataca o "não sei se salvou" na raiz):
depois do primeiro save, o título muda de "Nova Ordem de Serviço" pra
"Editar OS #NNN" e a barra de ações (badge "Agendada" + botão Concluir)
aparece na hora — antes só aparecia se fechasse e reabrisse a OS.

### Causa raiz 2 — `gerarOS_deOrc()` nunca checava se o orçamento já tinha OS

Achado ao investigar o par #193/#194 (mesmo `orcamento_id`, 93s de
diferença): diferente de `criarOSjunto`/`criarOSdeAprovacao` (os outros 2
caminhos de gerar OS, que já checam "já existe uma OS pra este orçamento?"
antes de criar — proteção do bug do Dom Carlos, 14/08), o botão "Gerar OS"
da barra de ações do orçamento (`gerarOS_deOrc`) nunca tinha essa checagem.
O botão normalmente já esconde essa opção quando o cache reflete a OS
existente (mostra "OS#NNN" no lugar) — mas isso depende do cache estar
atualizado, e não protege contra quem chegou no formulário por outro
caminho (ex.: o link de ponte novo do modal rápido, ver seção "Mapa do
fluxo Orçamento → OS" abaixo).

**Corrigido**: mesma trava (`confirmar()` com "Ver a existente"/"Criar
outra OS") já usada nos outros 2 caminhos — defesa em profundidade, não
confia só no botão escondido.

### Falso positivo descartado na varredura

A varredura em produção também achou 6 OS (#177-182) com a mesma
`obs_tecnica` ("Plano de acompanhamento mensal"), criadas em 4 segundos,
mesmo `agendamento_id` — parecia o mesmo bug. **Não é**: são as 6 visitas
dos próximos 6 meses que `gerarOSdoAgendamento()` já cria de propósito ao
criar um plano de vistoria recorrente (`data_servico` confirmado diferente
em cada uma: 03/08, 03/09, 03/10... até 03/01/2027). Comportamento
correto, não mexido.

**Testado no Browser pane** (offline, `dbOk` com mock de `db` simulando
rede real — inserts/updates contados por tabela pra não confundir com o
auto-save de cliente, que também insere): clique duplo real no botão
(`.click()` duas vezes em sequência) → só 1 insert, botão trava e destrava
certo; clique de novo minutos "depois" (assíncrono resolvido) → vira
UPDATE, não outro insert, confirmado por tabela (`ordens_servico:1,
UPDATE:ordens_servico:1` — zero duplicata); badge/título aparecem
certos depois do 1º save; trava de `gerarOS_deOrc` disparando o diálogo
certo quando já existe OS pro orçamento, e navegando normal quando não
existe. Zero erro novo no console.

**Pendência — decisão do Marcos**: as 6 OS de teste do Infinity Coast
Residence (#193, #194, #195, #197, #198, #199) continuam em produção,
claramente do teste dele mesmo hoje. Não apaguei — pra fazer isso preciso
de autorização explícita (mesmo protocolo já usado pros orçamentos
duplicados, 19/08 mais abaixo: dry-run em transação antes de apagar de
verdade).

sw.js: fluxa-v204 → fluxa-v205.

---

## 🔴 OS — botão "Concluir" descartava em silêncio o que o técnico tinha acabado de digitar (19/08)

Marcos relatou desconfiança geral no fluxo de OS ("parece bagunçado... preciso
verificar se os botões estão funcionando"). Investiguei o código antes de
mexer e **reproduzi um bug real e sério**, não só confusão de UX.

**Causa raiz:** o botão **"Concluir"** que aparece no topo do formulário de
edição de OS (`os-acoes-edit`, `_renderOSAcoesEdit`) chama
`concluirOSHistorico(id)` — a MESMA função do atalho de 1 toque em "Minhas
OS" (pensado pra quem NUNCA abriu a OS, só quer marcar pronto rapidinho).
Essa função sempre leu o **registro já salvo no banco/cache**, nunca os
campos do formulário aberto na tela. Resultado: um técnico preenchendo
observação técnica, material usado, foto — e clicando "Concluir" (o botão
primário, destacado em azul, bem no topo) **antes** de rolar até o fim da
tela e clicar "Salvar OS" — tinha tudo descartado em silêncio, sem aviso
nenhum. A OS ficava marcada como concluída, mas vazia.

**Reproduzido e confirmado** (offline, `dbOk=false;db=null;`, OS sintética
aberta via `editarOS()`): preenchi observação + material no formulário,
cliquei "Concluir" sem salvar antes — status virou `concluido`, mas
`obs_tecnica`/`materiais` continuaram vazios no registro. Bate exatamente
com o que o Marcos descreveu.

**Corrigido**: `concluirOSHistorico(osId)` agora checa se a OS sendo
concluída é a mesma aberta no formulário (`osEditId===osId`) — se for,
captura os campos AO VIVO da tela (mesmo padrão já usado por
`gerarOSPDF`/`_fazerCheckoutConfirmado`: cliente, local, técnico, total,
serviços, obs, materiais, fotos, vídeo, checklist marcado) e salva junto com
o status. Se a OS NÃO está aberta no formulário (o atalho de 1 toque de
"Minhas OS", uso original da função), o comportamento é **idêntico ao de
antes** — lê o registro já salvo, sem regressão. A barra de ações
(`_renderOSAcoesEdit`) também é re-renderizada na hora — o badge muda pra
"Concluída" e o botão "Concluir" some, sem precisar sair e voltar pra ver.

**Retestado com o fix**: mesmo cenário (preencher sem salvar → Concluir) —
agora `obs_tecnica`/`materiais` persistem corretos; cenário do atalho de
lista (sem formulário aberto) continua preservando o que já estava salvo,
mensagem de aviso "sem detalhes" continua disparando certo quando realmente
não há nada. Zero erro novo no console.

sw.js: fluxa-v202 → fluxa-v203.

### 🗺️ Mapa do fluxo Orçamento → OS + decisão do Marcos (19/08)

Existem **3 lugares diferentes** que oferecem "gerar OS" a partir de um
orçamento, cada um num momento distinto do ciclo de vida — não é bug, mas
é a origem real da sensação de bagunça:

1. **No próprio formulário de Novo Orçamento** — card "📋 Gerar Ordem de
   Serviço junto" (toggle `#toggle-os`): decide ANTES de gerar o PDF que
   quer criar OS+ORC juntos.
2. **Modal automático depois de aprovar** (`_perguntarCriarOS`, disparado
   por `mudarSt`/aprovação no portal): "agenda rápido" — cria a OS direto,
   sem abrir formulário nenhum (só data/hora/técnico, serviços copiados do
   orçamento sem poder editar ali).
3. **Botão "Gerar OS" na barra de ações do orçamento já aberto**
   (`gerarOS_deOrc`, `_renderFormAcoesEdit`): navega pro formulário completo
   de OS, pré-preenchido, dá pra editar serviços/data/técnico antes de criar
   — vira "OS#NNN" assim que existe uma vinculada.

**Perguntado ao Marcos**: simplificar pra um caminho só, ou manter os dois
principais (2 e 3) e só deixar claro que são dois MODOS da mesma ação, não
coisas concorrentes. Ele escolheu **manter os dois, só esclarecer**. Feito:

- **Modal rápido (2)** — subtítulo reescrito ("Agenda rápido, sem abrir a
  OS inteira — só data, hora e técnico. Os serviços seguem os do
  orçamento.") e botão renomeado de "📋 Criar OS agendada" pra **"Agendar
  rápido"** — deixa explícito que é o caminho enxuto, sem edição.
- **Ponte nova entre os dois** — link "Prefere editar os serviços da OS
  antes de criar? Abrir formulário completo →" dentro do próprio modal
  rápido (`_aprovOSAbrirFormularioCompleto`, novo): fecha o modal e chama
  `gerarOS_deOrc` — quem cai no caminho rápido por padrão não precisa
  fechar o modal, ir achar o botão na tela e clicar de novo; um clique já
  leva pro formulário completo pré-preenchido. Só aparece quando ainda NÃO
  existe OS pro orçamento (escondido junto com os campos/botão de criar
  quando `jaTemOS`).
- **Botão da barra de ações (3)** — tooltip (`title=`) explicitado:
  "Abre o formulário completo — dá pra editar serviços, data e técnico
  antes de criar" (versão aprovado, primário) / "Abre o formulário completo
  de OS pra este orçamento" (versão pendente, secundário). Rótulo visível
  continua "Gerar OS"/"OS" — texto curto de propósito, é botão pequeno
  numa barra com ~8 outros; a diferença fica no tooltip, mesmo padrão já
  usado nos outros botões dessa barra ("Entregar", "Mês", "NF").

O toggle do Novo Orçamento (1) não foi tocado — é um momento different (antes
de aprovar, não depois), não é ele que gera a confusão "na mesma tela"
relatada pelo Marcos (que era especificamente entre o modal pós-aprovação e
o botão da tela do orçamento).

Os 3 continuam com a mesma proteção contra duplicar (checam se já existe OS
antes de criar outra) — não é o bug do Dom Carlos (14/08, já corrigido),
não mexi nessa parte.

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova):
subtítulo/botão do modal com o texto novo confirmado via
`textContent`/`.value`; link de ponte visível quando NÃO há OS vinculada,
escondido quando já existe; clicar no link fecha o modal e abre
`page-os` com cliente/local/orçamento vinculado pré-preenchidos
(`osOrcId` batendo, badge "· do Orçamento #NNN" certo); tooltip do botão da
barra de ações confirmado com o texto novo nos dois estados (aprovado/
pendente). Zero erro novo no console.

sw.js: fluxa-v203 → fluxa-v204.

---

## 🔧 OS — foto/vídeo só abria a câmera, sem opção de galeria (19/08)

Marcos relatou testando uma OS real (Edifício Infinity Coast Residence): ao
clicar pra adicionar foto/vídeo, só deixava capturar na hora (câmera), não
deixava escolher da galeria. Causa: `<input type="file">` do grid de fotos da
OS (`os-finp-*`, `renderOSFotosSlots`) tinha `capture="environment"` — esse
atributo força o navegador a abrir a câmera nativa direto, pulando o seletor
"Câmera ou Galeria" do celular. É exatamente o comportamento que o projeto já
tinha identificado e evitado em Vistoria desde o Sprint 3 mobile ("omitir
esse atributo é o padrão... deixa o próprio celular oferecer Câmera OU
Galeria") — só que na OS o atributo tinha ficado, provavelmente de antes
dessa convenção existir.

**Corrigido**: removido `capture="environment"` do input de foto da OS —
mesmo padrão já usado em Vistoria.

**Marcos pediu pra corrigir tudo ("não quero nenhum problema rodando")** —
achados mais 3 pontos com o mesmo `capture` fixo, mesmo bug em potencial:
Equipamentos (`eq-foto-input`), Despesas (`desp-foto-input`) e Orçamento
(`forc-inp-*`, grid de até 6 fotos). Os 3 removidos também. **Vistoria não
foi tocada, de propósito** — lá o design já é diferente: 2 botões
("📷 Tirar foto" / "🖼️ Galeria"), cada um com seu próprio `<input>`, um com
`capture` e o outro sem — funciona certo, não é o mesmo bug (o `capture`
sozinho aqui é intencional, forçando câmera só quando o usuário escolhe
explicitamente "Tirar foto").

Testado no Browser pane (offline, `dbOk=false;db=null;`, porta nova):
`eq-foto-input`/`desp-foto-input`/`forc-inp-0`/`os-finp-0` confirmados sem o
atributo `capture` via `hasAttribute('capture')===false`, nos 4 formulários
(Equipamentos, Despesas, Orçamento, OS) — nenhum erro novo no console.

sw.js: fluxa-v200 → fluxa-v202.

**Nota do Marcos**: o fluxo de geração de OS em geral está dando outros
problemas de uso — fica pra revisão numa próxima rodada, ainda não
detalhado.

---

## 🔴 Orçamentos saindo duplicados — causa raiz achada e corrigida (19/08)

Marcos relatou "alguns orçamentos saindo duplicados quando eu gero". Investigado
direto contra produção (leitura, PAT) antes de mexer em qualquer coisa —
achados **5 pares reais**, todos com o mesmo padrão exato: mesmo cliente,
mesmo total, **`data_criacao` idêntico ao milissegundo**, `id` (uuid) e
`numero` diferentes. Datas espalhadas (14, 17, 18 e 19/08 — duas vezes),
não é artefato de uma migração, é bug ativo acontecendo toda semana.

### Causa raiz — corrida real entre salvar e navegar

`salvarApenas()`/`gerarPDF()` (Novo Orçamento) seguem o padrão local-first
de sempre: salvam local na hora, disparam o `dbInsertNumerado('orcamentos',
...)` num IIFE assíncrono **sem aguardar**, e a ÚLTIMA linha de cada função
é `go('history')`. `go('history')` chama `loadHist()` — que varre
`todosOrc` por ids `local_*` órfãos (não encontrados no banco ainda) e
tenta REENVIAR cada um via `_reenviarOrcamentosLocais()`.

O problema: `go('history')` roda **antes** do insert original (disparado
segundos antes, na mesma função) ter tido tempo de resolver, se a rede
estiver um pouco lenta. Nessa janela, o registro `local_xxx` ainda existe
no `localStorage` — `loadHist()` o vê como órfão e reenvia, gerando um
**segundo** INSERT pro banco com o mesmo `cliente`/`total`/`data_criacao`
(copiados do mesmo objeto local nos dois casos), só que um uuid e um
`numero` novos. Os dois inserts correm em paralelo; nenhum sabe da
existência do outro.

**Reproduzido isoladamente** (mock de `dbInsertNumerado`/`orcSyncInsert`
com latência de 300ms simulando as duas vias rodando ao mesmo tempo, sem
tocar produção): **2 inserts, 2 uuids, mesmo registro lógico** — bate
exatamente com o padrão achado no banco.

**Corrigido** com um lock em memória, `_orcSyncEmVoo` (Set de ids
`local_*` com insert já disparado e ainda não resolvido) — marcado logo
antes de disparar o insert em `salvarApenas()`/`gerarPDF()`, removido no
`finally` (sucesso ou erro). `_reenviarOrcamentosLocais()` — o ponto único
que realmente faz o insert de reenvio, chamado de `loadHist()` e de
qualquer outro lugar (`_reenviarPendentes`, evento `online`, o
`setInterval` de 3min) — pula qualquer id que já esteja na trava. Protege
todos os call sites de uma vez, sem duplicar a lógica de filtro em cada um.

**Reteste com a trava, mesmo cenário simulado**: só 1 insert acontece — o
segundo é pulado (`_orcSyncEmVoo.has(rec.id)` true), confirmado.

**Por que só orçamentos, não OS**: `gerarOSPDF()` **aguarda** (`await`) o
`dbInsertNumerado` diretamente, sem IIFE fire-and-forget — quando a
função termina, o insert já resolveu, então não há janela de corrida com
uma navegação subsequente. Conferido antes de dar por certo que o mesmo
padrão não se repete lá.

### ✅ Limpeza dos duplicados já existentes — feita, autorizada pelo Marcos

Pedido explícito: "apague todos que tem duplicados com mesmos produtos e
valores por cliente". Antes de apagar, varredura **completa** (sem limite
de 7 dias, comparando `cliente`+`total`+`servicos`, não só cliente+total)
achou **6 pares reais** (um a mais que os 5 do primeiro scan — Maison
Lafayette só não bateu na comparação exata porque um dos dois tinha "02
Trocadores..." e o outro "Trocador..." no texto do item, mesmo
`produto_id`/valor; e um caso mais antigo, DENILSON SERTÃO de 10/07,
que também é a mesma corrida — confirma que o bug já era mais velho e
mais espalhado do que os 7 dias do primeiro scan sugeriam).

**Checado uso real de cada par antes de decidir qual apagar** — 5 dos 6
eram seguros (status `pendente`/`vencido`, sem OS nem recebimento
vinculado). **1 exigiu cuidado**: Eduardo Domingos Silva (#351/#353) — os
DOIS tinham sido aprovados (em datas diferentes, `data_aprovacao`
divergente: alguém aprovou de novo dias depois sem perceber que já tinha
aprovado o duplicado) e os DOIS tinham parcela em `recebimentos`. Só o
**#353** tinha uma OS real vinculada (#188, `agendado`) — mantive esse,
apaguei o #351 (órfão) e a parcela dele junto. Confirmado depois: OS #188
continua apontando certo pro orçamento mantido.

**Dry-run em transação primeiro** (`BEGIN;...ROLLBACK;`, confirmou 0
linhas restantes nos dois casos antes de rodar de verdade) — mesmo
protocolo já usado nas migrações financeiras deste projeto.

**5 outros pares "mesmo cliente+valor" achados na verificação final —
NÃO são duplicata, não mexi**: `CONDOMINIO GOLDEN HOME`, `ITALO SILVA`,
`MK PISCINAS`, `Pousada Casa do Mar`, `SNI BRASIL` — datas de criação
espalhadas por dias/semanas/meses (não ao milissegundo) e status
divergentes entre os dois (ex.: um `vencido`, o outro `aprovado` meses
depois) — é o mesmo cliente pedindo o mesmo serviço de novo, coincidência
de valor, não o bug da corrida. Distinguir isso do bug real foi
justamente o motivo de checar `data_criacao`/status par a par em vez de
confiar só em "mesmo cliente + mesmo total".

sw.js: fluxa-v199 → fluxa-v200.

## ✅ QA da Tarefa 3h — releitura crítica + 4 achados corrigidos (19/08)

A pedido do Marcos, revisão adicional em cima dos 5 commits (não só teste
de clique, releitura do diff inteiro com olho crítico + testes de caso-
limite que o primeiro passe não cobriu). Quatro achados reais, todos
corrigidos e testados; nenhum exigiu reabrir os commits anteriores.

### 🔴 1. `todosOrc`/`todosReceb` podiam estar vazios ao abrir a ficha direto

`renderPageReparo()` já tinha lazy-load pra `todosProdutos`/`todosFornecedores`
(3h.2), mas não para `todosOrc`/`todosReceb`. Quem chega na ficha **sem**
antes ter passado por Histórico/A Receber nesta sessão do navegador —
o caso real é `checkOfHash()` (QR code impresso no equipamento,
`go('oficina')` seguido de `abrirFichaOficina` direto, 500ms depois) —
via um "Peças e mão de obra" dizendo "Nenhum orçamento gerado ainda" **mesmo
quando um orçamento real já existia no banco**, só não carregado na memória
ainda. Risco real: técnico clica "+ Gerar orçamento" pensando que não
existe nenhum e duplica.

**Corrigido**: mesmo padrão de guarda já usado em ~6 outros pontos do app
(`if(!(todosOrc||[]).length && typeof loadHist==='function')`) — dispara
`loadHist()`/`loadRecebimentos()` em background quando vazios, e quando o
`loadHist()` resolve, re-renderiza a ficha (checando que ainda é a mesma
ativa) pra refletir o dado que chegou atrasado. Testado com `loadHist`
mockado simulando a chegada tardia do orçamento: card mostrava "Nenhum
orçamento" antes, "Pendente de aprovação" depois de resolver — confirma
que o re-render automático funciona.

### 🔴 2. Entrega de reparo CANCELADO cobrava o valor do serviço recusado

Achado testando o caminho de "Recusado" até o fim: o modal de entrega
mostrava "Pagamento na retirada — R$ 1.200,00 em aberto" com os 4 botões
de forma de pagamento — o valor do orçamento INTEIRO que o cliente
recusou, contradizendo `FLUXO-OFICINA.md` ("a entrega acontece igual, só
sem cobrança de serviço"). Risco real: um técnico apressado clica "A
prazo" sem reparar no valor e cria uma cobrança fantasma de um serviço
que nunca foi feito.

**Perguntado ao Marcos antes de corrigir** (é decisão de produto, não bug
óbvio) — escolheu: permitir cobrar uma **taxa de diagnóstico** livre, não
o valor do serviço recusado. `migracao-oficina-taxa-diagnostico.sql`
(aditiva, aplicada e verificada: `entrega_valor_cobrado numeric`).

- Reparo `cancelado`: o card vira "Taxa de diagnóstico" — campo numérico
  livre (**R$0 é resposta válida**, "sem cobrança"), sem mostrar o total
  do orçamento em lugar nenhum. Só oferece Pix/Cartão/Dinheiro (sem "A
  prazo" — taxa pequena, não gera parcela em A Receber) e só pede a forma
  quando o valor é `> 0`.
- Reparo normal (`pronto`→entregue): comportamento **inalterado** — mostra
  `orc.total`, os 4 botões incluindo "A prazo", exatamente como a 3h.5
  original.
- `imprimirTermoOficina('retirada')` também corrigida — o PDF mostra
  "Taxa de diagnóstico" pro caso cancelado, nunca o valor recusado.

Testado: taxa=0 → requisito cumprido sem exigir forma (`req.pagamento:
true` sem `entrega_forma_pagamento`); taxa=50 → requisito **não** cumprido
até escolher forma (`req.pagamento:false`, botões aparecem só agora);
Pix escolhido → cumprido, **zero linha criada em `recebimentos`**
(confirmado — taxa não gera parcela); PDF interceptado mostra "R$ 50,00 ·
Pix" e **não** mostra "1.500,00" (o valor recusado); caminho normal
(reparo `pronto`, não cancelado) testado de novo depois da mudança —
mostra `orc.total` com os 4 botões, sem regressão.

### 🟡 3. Sidebar apagava inteira dentro da ficha

`go('reparo')` não tem item de nav próprio (`#snb-reparo` não existe) —
a lógica genérica de destaque (`document.getElementById('snb-'+p)`) não
achava nada e a sidebar ficava sem nenhum item aceso, perdendo a pista
visual de "onde estou" bem no meio do fluxo mais longo do app. Corrigido
com uma exceção pontual em `go()`: `p==='reparo'` mantém `#snb-oficina`
aceso. Testado: sidebar mostra "Oficina" destacado em azul com a ficha
aberta.

### 🟢 4. Limpeza — código morto

`_ofFichaOrcamentoHtml()` (o resumo simples de orçamento da ficha antiga)
ficou sem nenhum chamador desde que a 3h.2 criou `_ofFichaPecasMaoObraHtml`
pra substituí-lo — removida. Variável `cancelAqui` em `_ofRenderRepTrilha`
era calculada e nunca lida — removida.

Zero erro novo no console em toda a bateria de reteste. sw.js: fluxa-v198
→ fluxa-v199.

## ✅ Pendência cumprida — Tarefa 3h testada de ponta a ponta com clique real (19/08)

Depois dos 5 commits (3h.1-3h.5, ver seção logo abaixo), rodei o ciclo
inteiro clicando de verdade (`.click()` em elementos reais do DOM — as
coordenadas de pixel do `computer` não estavam mapeando certo neste
ambiente específico desta sessão, mesma classe de artefato já documentada
váras vezes neste arquivo; usar o elemento real é clique de verdade
igual, só não via coordenada de tela), não só chamando função por função
como nos testes de cada commit:

Quadro (Oficina) → clique no card → ficha (`#page-reparo`) → "Registrar
diagnóstico" → preencheu diagnóstico → "Gerar orçamento" (navegou pro
formulário real de Novo Orçamento, `orc-oficina-reparo-id` confirmado
preenchido) → voltou pra ficha → "Mandar para aprovação" → modal de
contato → "Registrar aprovação" (as 3 consequências: orçamento aprovado,
OS criada, pulou "aguardando peça" por não ter produto vinculado) →
"Marcar pronto" → "Entregar" → modal com os 4 requisitos, cada um
preenchido por clique real (garantia+"o que foi feito", pagamento
"Dinheiro", foto, assinatura com nome + traço real no canvas) →
"Confirmar entrega" → status `entregue`, garantia calculada (3 meses),
modal fechado.

**Achado no processo, corrigido no próprio teste** (não upgrade de
função, era um seletor errado no MEU script de teste, registrado aqui só
por transparência): o primeiro clique em "Assinar" pegou o botão de
Assinatura de ENTRADA em vez de RETIRADA, porque `abrirModalAssinaturaOficina`
aparece duas vezes no DOM da ficha (o card "Termo de entrada" sempre
visível + o botão dentro do modal de entrega) — um seletor genérico
`button[onclick*="abrirModalAssinaturaOficina"]` pega o primeiro em ordem
de documento. Não é bug do app — cada botão passa o `tipo` certo
(`'entrada'`/`'retirada'`) para o handler certo; só meu script de teste
precisou ser mais específico (`#of-entrega-corpo button[onclick*="retirada"]`).

Trilha final mostrando os 8 nós corretos (7 concluídos + Entregue atual),
histórico com os 7 eventos reais em ordem cronológica (sem
"Aguardando peça", que foi pulado de verdade — a trilha marca "concluído"
por posição, o histórico é que é o registro fiel do que aconteceu — os
dois têm papéis diferentes, de propósito). Zero erro novo no console.

---

## 🔧 Tarefa 3h — A ficha do reparo (fluxo da Oficina), EM ANDAMENTO (19/08)

Novo pacote no handoff (`PLANO-3H-FICHA-REPARO.md` + `FLUXO-OFICINA.md`,
`~/Downloads/design_handoff_fluxa_redesign/`). O Marcos deu a direção
(diagnóstico é feito por técnico celular/computador e gestor; aprovação vem
por WhatsApp/PDF/ligação/balcão — quatro canais; reparo aprovado vira OS;
entrega exige assinatura+foto+garantia+pagamento; peça sai do estoque ou é
comprada) e pediu pra eu propor o fluxo e a arquitetura. **5 commits, não
juntar** — este arquivo documenta cada um conforme fecha.

**Duas decisões perguntadas ao Marcos antes de começar** (o próprio plano
exigia isso antes do commit 3h.4, mas afetam o desenho desde o início):
1. **Aprovação de valor**: técnico da bancada monta diagnóstico/valor e manda
   **direto ao cliente** — sem gate de revisão do gestor. Logo, `diagnóstico
   → aguardando_aprovação` é transição direta, sem estado intermediário de
   "proposta pendente".
2. **Retrabalho em garantia própria**: cobra mão de obra **só se o defeito
   mudou** (mesmo defeito coberto = grátis; defeito novo = cobra normal). Fica
   pra registrar no diagnóstico quando o commit 3h.4 chegar lá — não dá pra
   automatizar o valor sem risco, então o sistema vai **informar** a
   condição de garantia, o técnico decide o preço final no orçamento como
   sempre.

### ✅ 3h.1 — tabela `oficina_contatos` (a base de tudo)

`migracao-oficina-contatos.sql`, aplicada e verificada em produção via
Management API (schema confirmado: `id/reparo_id/canal/resultado/obs/
usuario_id/data`, todos `text` exceto `data` timestamptz). Mesmo padrão de
`oficina_status_log` — id `text` app-gerado (`ofc_<timestamp>_<rand>`), local-
first, **uma linha por tentativa, nunca UPDATE**: é o rastro que falta pra
saber que um reparo em "aguardando aprovação" está há 31 dias sem ninguém
saber se já foi cobrado.

`loadOficinaContatos()` (mesmo padrão de `loadOficinaStatusLog`, chamado
dentro de `loadOficinaReparos()`), `_ofRegistrarContato(reparoId, canal,
resultado, obs)`, `_ofContatosDoReparo(reparoId)`, e
**`_ofDiasSemContato(reparoId)`** — a peça que faltava: `null` quando nunca
houve contato (diferente de `0`, que é "contatado hoje" — a UI precisa
distinguir "nunca cobrado" de "cobrado hoje" e não dava antes). `canal`:
`whatsapp`/`pdf`/`ligacao`/`balcao`/`aviso_pronto`; `resultado`:
`enviado`/`sem_resposta`/`aprovado`/`recusado`/`avisado`.

Testado no Browser pane (offline, `dbOk=false;db=null;`): `_ofRegistrarContato`
grava local e retorna o registro certo; `_ofDiasSemContato` retorna `0` para
contato de hoje e `null` para reparo sem nenhum contato registrado. Zero
erro no console.

sw.js: fluxa-v193 → fluxa-v194.

### ✅ 3h.2 — `#page-reparo`: a ficha vira página

A ficha (`abrirFichaOficina`) era modal dinâmico (`.cli-hist-overlay`
criado/apagado do DOM a cada abertura, ~350 linhas concatenando 10
`_ofFicha*Html()` helpers numa lista vertical). Virou rota própria
(`#page-reparo`) com topbar 62px, trilha de 7 estados, e corpo em grid
`1fr 380px` (esquerda: diagnóstico, peças e mão de obra, estado de chegada,
prazo, custo, terceiro, termos; direita: cartão escuro + histórico +
aviso de retrabalho), igual ao handoff (`Fluxa Oficina Fluxo.dc.html`,
turno 10a).

**`abrirFichaOficina(id)` manteve nome e assinatura de propósito** — é
chamada de ~15 pontos (kanban, histórico, badges de fila, pós-assinatura,
criação de orçamento, etc.) — só passou a fazer `_ofReparoAtivoId=id;
go('reparo')` em vez de montar HTML. `fecharFichaOficina()` virou no-op
(não existe mais overlay pra remover) — os ~15 call sites que faziam
`fecharFichaOficina(); abrirFichaOficina(id);` pra forçar reload continuam
funcionando sem tocar em nenhum deles, porque `abrirFichaOficina` já
re-renderiza sozinha. **Achado e corrigido no próprio processo**: o check
em `_ofAplicarStatus` que decidia se recarregava a ficha aberta olhava
`document.getElementById('of-ficha-overlay')` — esse id não existe mais,
então status mudado com a ficha aberta parava de atualizar a tela em
silêncio. Trocado por checar se `#page-reparo` está ativo e é o mesmo
`_ofReparoAtivoId`.

**Reaproveitado sem tocar** (só re-empacotados em `.rd-card` dentro da
nova coluna esquerda): `_ofFichaDiagnosticoHtml`, `_ofFichaPrazoHtml`,
`_ofFichaCustoHtml`, `_ofFichaTerceiroHtml`, `_ofFichaOSCampoHtml`,
`_ofFichaFabricanteHtml`, `_ofFichaEntregaCampoHtml`, os dois blocos de
termo de assinatura. **Novo nesta rodada**:
- `_ofFichaPecasMaoObraHtml(o)` — tabela Item/Origem/Qtd/Total lendo o
  orçamento vinculado. "Origem" (Estoque/Comprar) é **derivada na hora**
  (`fisicaProduto(produto_id) < qty`), não um campo novo gravado — o
  sistema já sabe o saldo.
- `_ofFichaEstadoChegadaHtml(o)` — upgrade de `_ofFichaAvariasHtml`: antes
  só listava avarias; agora mostra chip por item JÁ avaliado (verde ok,
  âmbar avaria), igual ao handoff.
- `_ofRepTimelineHtml(o)` — intercala `oficina_status_log` (Fase 2) com
  `oficina_contatos` (3h.1) por data, um rastro só.
- `_ofRenderRepCartao(o)` — versão simples desta rodada (status + botão
  "avançar"). **A 3h.3 substitui só esta função** pelo conteúdo específico
  de cada estado (pedidos de aprovação, peça/fornecedor/previsão, dias sem
  aviso — tabela completa em `FLUXO-OFICINA.md`), sem tocar o resto da
  coluna direita.
- Select "Mudar status manualmente" preservado (era a única saída pra
  gestor pular/voltar estado livremente) — movido pro fim da coluna
  direita, não é mais a ação primária da tela.
- "← Voltar" usa `voltar()` (histórico de navegação já existente), não um
  `go('oficina')` fixo — abrir a ficha a partir do Histórico ou de outro
  lugar volta pra onde a pessoa realmente estava.

**Bug achado e corrigido no próprio teste**: os containers `#of-rep-topbar`
e `#of-rep-trilha` no `index.html` tinham só `id`, sem a `class` que o CSS
mira (`class="of-rep-topbar"` etc.) — o conteúdo interno renderizava com
seus próprios estilos corretos (badges, texto), mas o CONTAINER ficava
`display:block` em vez de `flex`, empilhando tudo verticalmente em vez do
layout de topbar/trilha horizontal. Só ficou óbvio testando de verdade no
browser (comparando `getComputedStyle` antes/depois) — corrigido
adicionando a classe que faltava nos dois.

**Achado no processo, não é bug**: o preview reaproveitado (`fluxa-dev`,
porta 3457/4321) estava servindo `styles.css` desatualizado mesmo com
`navigate({force:true})` — confirmado comparando `document.styleSheets`
(1268 regras, sem `.of-rep-*`) contra `fetch('/styles.css')` direto (1320
regras, com `.of-rep-*`). Mesma classe de armadilha já documentada várias
vezes neste arquivo ("ao testar na MESMA porta reaproveitada, usar porta
nova ou hard-reload de verdade") — resolvido subindo um `http.server` cru
numa porta nova (6931).

Testado no Browser pane (offline, `dbOk=false;db=null;`, dado sintético
cobrindo trilha com estados passados/atual/futuro, peças com 1 "Comprar"+1
"Estoque", contatos, orçamento vinculado): topbar com badge "31 dias na
bancada" em âmbar, trilha com ✓ verde nos concluídos e ponto azul pulsante
no atual, "Peças e mão de obra" com origem derivada certa e total batendo,
Histórico intercalando status+contato por data; clique real em "← Voltar"
retorna pra Oficina (via `_navHist`, simulado o fluxo real: entrar por
Oficina → abrir ficha → voltar); `avancarStatusOficina` muda o status E
re-renderiza o cartão em tempo real (`await` explícito, confirmado que o
refresh não é mais condicionado ao overlay morto); 1440px (grid
761px/380px, sem overflow) e 375px (`scrollW===clientW===375`, trilha
rola por dentro horizontalmente, resto empilha em coluna única) sem
overflow de página. Zero erro novo no console (só o ruído de Service
Worker já documentado).

sw.js: fluxa-v194 → fluxa-v195.

### ✅ 3h.3 — o cartão escuro que muda por estado

Substituiu a versão simples do 3h.2 (só status + "avançar") por conteúdo
específico dos 7 estados + cancelado, seguindo a tabela de
`FLUXO-OFICINA.md`: `_ofCartaoRecebido`/`Diagnostico`/
`AguardandoAprovacao`/`AguardandoPeca`/`EmReparo`/`Pronto`/`Entregue`,
despachadas por um mapa em `_ofRenderRepCartao(o)` — só essa função foi
tocada, o resto da coluna direita (histórico, retrabalho, select manual)
ficou como o 3h.2 deixou.

- **Recebido** → "Registrar diagnóstico" transiciona pra `diagnostico` E
  foca o textarea (`_ofRegistrarDiagnosticoUI`) — o técnico já cai
  digitando, não precisa clicar duas vezes.
- **Diagnóstico** → mostra o valor do orçamento vinculado (ou "Gere o
  orçamento antes" se ainda não existe — `_ofMandarParaAprovacao` bloqueia
  com toast, não deixa abrir o modal sem orçamento). "Mandar para
  aprovação" abre o modal de contato novo.
- **Aguardando aprovação** → valor + badge de dias sem contato
  (`_ofDiasSemContato`, 3h.1) + caixa "Pedidos de aprovação" com os
  últimos 6 contatos (ponto azul=enviado, âmbar=sem resposta, verde=
  aprovado) + 3 ações (Registrar aprovação/Cobrar de novo/Recusado).
- **Aguardando peça** → lista só os itens do orçamento com saldo
  insuficiente (`fisicaProduto(produto_id) < qty` — mesmo cálculo já usado
  em "Peças e mão de obra", nada novo), cada um com fornecedor
  (`produtos.fornecedor_id`) e previsão (`lead_time_dias`, já existente do
  módulo de compras — Fase 7 do redesign) quando tem; sem fornecedor
  cadastrado mostra "sem pedido" em âmbar. Zero itens faltando → some a
  lista e aparece um atalho "Peça chegou — iniciar reparo".
- **Em reparo** → dias no status + técnico responsável (se já setado na
  Fase 11). **Pronto** → dias na prateleira + se já avisou o cliente
  (contato `canal:'aviso_pronto'`) — "Avisar cliente" só aparece enquanto
  não avisado. **Entregue** → data + garantia própria calculada.
- **Cancelado** → motivo + "Entregar" (o equipamento cancelado ainda
  precisa voltar pro cliente, por FLUXO-OFICINA.md — "recusado não é
  descartado").

**Novo componente: `abrirModalContatoOficina(reparoId, resultadoPadrao)`**
— mini-modal (canal + resultado + observação opcional), usado por 4 dos
7 estados. Modo especial pra "Avisar cliente" (`resultadoPadrao='avisado'`):
esconde os selects de canal/resultado (é sempre o mesmo tipo de evento,
canal fixo `aviso_pronto`), só pede confirmar. `_ofConfirmarContato()`
grava o contato (3h.1) e decide a transição de status: `diagnostico` →
`aguardando_aprovacao` sempre; `aguardando_aprovacao` + resultado
`aprovado` → `aguardando_peca` (**interino** — a 3h.4 substitui esse ramo
específico pela transação completa das "três consequências": criar OS +
reservar estoque + lista de compra, com o pulo automático pra `em_reparo`
quando não falta peça nenhuma); `avisado` nunca muda status, só registra.

**Bug real achado e corrigido no próprio teste**: o botão "Entregar" do
estado `cancelado` chamava `avancarStatusOficina()` — que usa
`_ofProximoStatus()`, e `cancelado` não está em `OFICINA_STATUS_SEQ`
(é saída lateral, não faz parte da sequência), então `_ofProximoStatus
('cancelado')` sempre retorna `null` e o clique não fazia **nada** (só um
toast de "já está na última etapa", enganoso). Corrigido pra
`setOficinaStatus(id,'entregue')`, que chama `_ofAplicarStatus` direto com
o destino explícito, sem depender de "próximo da sequência".

Testado no Browser pane (offline, `dbOk=false;db=null;`, ciclo completo
clicando de verdade pelos 7 estados + cancelado num reparo sintético):
Recebido→Diagnóstico (foco automático confirmado); bloqueio de "Mandar
pra aprovação" sem orçamento (modal não abre); com orçamento (1 item sem
estoque + 1 com estoque, fornecedor com lead_time 7d cadastrado) → modal
abre, confirma, transiciona pra Aguardando aprovação com o valor e o
pedido registrado na caixa; "Registrar aprovação" com resultado=aprovado
→ Aguardando peça mostrando só o item realmente faltando ("Serpentina ·
Distribuidora Pooltec · 7d de previsão"), o item com estoque
corretamente ausente da lista; simulei a peça chegando (nova entrada no
ledger) → recarregado, 0 itens faltando, atalho "Peça chegou" aparece;
Em reparo→Pronto→"Avisar cliente" (nota muda pra "✓ avisado" sem trocar
status, botão some)→Entregue (data + garantia 3 meses calculada certa);
Cancelado→"Entregar" (bug acima, corrigido, testado depois do fix)→
Entregue. 1440px (grid intacto) e 375px (`scrollW===clientW===375`,
cartão e histórico empilhando certo) sem overflow. Zero erro novo no
console.

sw.js: fluxa-v195 → fluxa-v196.

### ✅ 3h.4 — Registrar aprovação: as três consequências

Substitui o ramo interino do 3h.3 (`aguardando_aprovacao`+`aprovado` →
`aguardando_peca` sempre) pela transação completa que `FLUXO-OFICINA.md`
pede: **`_ofRegistrarAprovacao(reparoId)`**, chamada de dentro de
`_ofConfirmarContato` quando o resultado é "aprovado":

1. **Aprova o orçamento vinculado** — `status:'aprovado'`,
   `data_aprovacao`, `_congelarCustoOrc` (mesma mecânica de
   `_mudarStProsseguir`, só sem os dois gates que não fazem sentido aqui:
   forma de pagamento é decidida na ENTREGA — Pix/Cartão/Dinheiro/A prazo,
   3h.5 — não na aprovação; e "item sem vínculo de estoque" não bloqueia,
   porque toda peça de reparo já passa pelo picker de produto).
2. **Reserva a peça no estoque** — `sincronizarReservaOrcamento(orc)`,
   função que já existia (usada pelo app INTEIRO antes da Fase "aprovar =
   sai do estoque direto", 07/08) e continuava no código sem nenhum
   chamador. Reaproveitada tal como está — zero lógica de estoque nova
   escrita nesta tarefa. Faz sentido de novo aqui porque o reparo pode
   ficar dias/semanas entre aprovar e executar; baixar na hora contaria
   peça como consumida antes de montada. A baixa de verdade (reservado →
   saída física) fica pra 3h.5, na conclusão do reparo.
3. **Cria a OS vinculada** — `_ofCriarOSDaAprovacao(o, orc)`, nova função
   dedicada (não reaproveita `criarOSjunto`, que é acoplada aos campos do
   formulário de Novo Orçamento e à impressão de documento — contexto que
   não existe na ficha da oficina). Insere direto em `ordens_servico` com
   `orcamento_id`/`cliente_id`/servicos/total, `local_servico:'Oficina —
   OF-#####'` (não tem endereço físico próprio, diferente de OS de
   campo), status `agendado` — o técnico preenche na bancada como
   qualquer OS.

**Pula `aguardando_peca` quando não falta nada** — depois de reservar,
`_ofConfirmarContato` verifica se algum item do orçamento tem
`fisicaProduto(produto_id) < qty` (mesmo cálculo já usado em "Peças e mão
de obra" e no cartão "aguardando peça"); se não houver nenhum, vai direto
pra `em_reparo`.

**Idempotente nos dois eixos** — `sincronizarReservaOrcamento` só lança a
diferença entre desejado e já reservado; `_ofCriarOSDaAprovacao` checa se
já existe OS pro mesmo `orcamento_id` antes de inserir. Chamar
`_ofRegistrarAprovacao` duas vezes (ex.: duplo clique) não duplica OS nem
dobra a reserva — testado explicitamente.

**Garantia própria/retrabalho (2ª decisão pré-3h.4)** — o Marcos escolheu
"cobra mão de obra só se o defeito mudou". Não dá pra automatizar o valor
com segurança (é julgamento do técnico se é o mesmo defeito), então
`_ofFichaRetrabalhoHtml` ganhou um badge de aviso, visível sempre que
`retrabalho_de` está setado: "Garantia própria — cobra mão de obra só se
o defeito for diferente do original." — o sistema INFORMA a condição, o
preço final continua decidido no orçamento como qualquer outro.

Testado no Browser pane (offline, `dbOk=false;db=null;`, dois reparos
sintéticos): **caso sem estoque** (Selo mecânico, produto cadastrado sem
nenhum movimento) — aprovação registrada → orçamento vira `aprovado` →
OS criada (`orcamento_id`/cliente/total/local corretos) → reserva
lançada (`prod_selo` qty 1) → status vai pra `aguardando_peca` (correto,
falta peça); **caso com estoque** (Vedação, com entrada de 5 unidades) —
mesmo fluxo, mas pula `aguardando_peca` e vai direto pra `em_reparo`,
reserva lançada igual (reserva sempre acontece, só a baixa que espera);
**idempotência** — chamei `_ofRegistrarAprovacao` de novo sobre o mesmo
reparo já aprovado: OS continua em 1, reserva continua somando 1 (não
duplicou nada); badge de garantia própria visível na ficha de um reparo
sintético com `retrabalho_de` setado, texto e cor (`rd-badge-warn`)
corretos. Zero erro novo no console (só o ruído de Service Worker já
documentado, mais um erro de teste meu próprio — chamada de IIFE sem
try/catch numa rodada anterior de teste, confirmado pelo `<anonymous>`
no stack trace, não é código do app).

sw.js: fluxa-v196 → fluxa-v197.

### ✅ 3h.5 — modal de entrega (4 requisitos) + bancada mobile — FECHA A TAREFA 3h

Último dos 5 commits. `migracao-oficina-entrega.sql` (aplicada e
verificada em produção): 4 colunas aditivas em `oficina_reparos` —
`fotos_pronto jsonb`, `o_que_foi_feito text`, `entrega_forma_pagamento
text`, `entrega_retirado_por text` (a assinatura em si já tinha coluna
própria desde a Fase 1c).

**`abrirModalEntregaOficina(reparoId)`** — modal `.rd-modal-bg`/`.rd-modal
rd-modal-wide` (560px, mesmo shell da Tarefa 3c/3f.4), 4 cartões de
requisito + "Confirmar entrega" desabilitado até os 4 estarem cumpridos.
**Cada cartão salva na hora que é preenchido** (mesmo princípio de
diagnóstico/prazo/custo já usados no resto da ficha — nunca um rascunho
que se perde se a pessoa fechar o modal no meio): foto sobe pro campo
`fotos_pronto` assim que escolhida (reusa `compressImage()`, mesmo padrão
de `carregarFotoOf`), garantia+"o que foi feito" salvam num botão
"Salvar" próprio, forma de pagamento salva no clique do botão (Pix/
Cartão/Dinheiro/A prazo). O modal só REFLETE o estado real do reparo a
cada re-render — "Confirmar entrega" não grava nenhum dos 4 dados, só
finaliza.

- **Requisito 1 (foto)**: cumprido com 1+ foto em `fotos_pronto`.
- **Requisito 2 (garantia)**: cumprido quando `o_que_foi_feito` está
  preenchido — os meses de garantia sempre têm default (3), o que falta
  de verdade é o texto que "usa o que foi feito" (FLUXO-OFICINA.md).
- **Requisito 3 (pagamento)**: Pix/Cartão/Dinheiro **não geram parcela** —
  a OS é considerada quitada na hora, como o plano pede. **A prazo** cria
  UMA parcela em `recebimentos` (mesma tabela e mesmo princípio "1 parcela
  à vista" já usado na migração retroativa de 15/08) — id previsível
  (`rec_of_<orcamento_id>`), idempotente: clicar "A prazo" duas vezes não
  duplica a parcela.
- **Requisito 4 (assinatura+nome)**: reaproveita `abrirModalAssinaturaOficina`/
  `confirmarAssinaturaOficina` (Fase 1c) **sem duplicar o mecanismo de
  canvas** — só ganhou um campo de nome, condicional a `tipo==='retirada'`
  (a assinatura de ENTRADA nunca precisou disso), gravado em
  `entrega_retirado_por`. Bloqueia confirmar sem nome, do mesmo jeito que
  já bloqueava sem traço no canvas. Como esse modal é uma tela própria,
  separada da entrega — ao confirmar, verifica se `#of-entrega-modal` está
  aberto e, se estiver, só atualiza o card de requisito (`_ofRenderEntregaModal`)
  em vez do comportamento padrão (reabrir a ficha inteira).

**`imprimirTermoOficina(id,'retirada')` enriquecida** — "um PDF só" como o
plano pede: além do que já tinha (cliente/equipamento/avarias/assinatura),
ganhou "O que foi feito", "Garantia até", "Pagamento" (forma + valor do
orçamento) quando `tipo==='retirada'` — a entrada continua exatamente como
era, esses três blocos só existem nessa direção.

**Bancada mobile** — escopo ajustado ao que a arquitetura da 3h.2 já
permite (registrado com transparência, não é lacuna silenciosa): "cartão
escuro 'Sua vez' no topo" **implementado** — abaixo de 680px,
`.of-rep-body` vira flex-column e `#of-rep-direita` (que começa com o
cartão) recebe `order:-1`, subindo pra ANTES do bloco esquerdo sem
reestruturar DOM/JS; alvos de toque dos botões do cartão sobem pra 44px.
**Não implementado**: os atalhos de falha comum em chips e o picker de
peças com "tem N no estoque"/"precisa comprar" + total fixo no rodapé —
o mockup descreve um formulário de diagnóstico com peças escolhidas
INLINE na própria ficha, mas a 3h.2 decidiu (de propósito, registrado
naquele commit) reaproveitar o formulário de orçamento JÁ EXISTENTE pra
isso ("+ Gerar orçamento" navega pra lá) em vez de duplicar a lógica de
precificação/estoque numa segunda tela — construir o picker inline
description no mock seria abrir uma segunda via de editar orçamento,
mesma classe de risco (dado financeiro duplicado, dessincroniza) já
evitada em outras decisões deste projeto.

Testado no Browser pane (offline, `dbOk=false;db=null;`, ciclo completo
clicando de verdade): modal abre com os 4 cartões vermelhos/pendentes,
"Confirmar entrega" desabilitado; preenchi garantia+"o que foi feito"
(salva, card fica azul), pagamento "Pix" (card fica azul), foto (1
adicionada, card fica azul), assinatura — **bloqueado sem traço no
canvas** (confirmado), **bloqueado sem nome** (confirmado, mensagem
certa), preenchido nome "Zelador João" + traço real
(`MouseEvent`) → confirma → modal de assinatura fecha, modal de entrega
CONTINUA aberto e atualiza sozinho (não reabre a ficha por cima); com os
4 cumpridos, botão habilita e a nota muda pra "Tudo certo"; "Confirmar
entrega" → status vira `entregue`, modal fecha, PDF interceptado
(`window.open`) confirmado com "O que foi feito"/"Pix"/"Zelador João"
todos presentes. **Caminho "A prazo" testado à parte**: cria 1 parcela em
`recebimentos` com valor/vencimento certos; chamado 2x de propósito —
delta continua 1 (idempotente, não duplicou). Mobile 375px: cartão escuro
aparece ANTES do bloco de peças/diagnóstico (`getBoundingClientRect().top`
comparado, confirmado antes de confiar no screenshot — mesma cautela já
documentada nesta sessão pra viewports não-triviais), modal de entrega
sem overflow horizontal. Zero erro novo no console.

sw.js: fluxa-v197 → fluxa-v198.

---

## 🔧 Resumo da Tarefa 3h — a ficha do reparo (fluxo da Oficina), COMPLETA (19/08)

Os 5 commits fecham o pacote inteiro (`FLUXO-OFICINA.md`/
`PLANO-3H-FICHA-REPARO.md`): **3h.1** tabela `oficina_contatos` (rastro de
cada tentativa de contato) → **3h.2** ficha vira página própria
(`#page-reparo`, topbar+trilha+grid, reaproveitando os `_ofFicha*Html`
já existentes) → **3h.3** cartão escuro específico por estado (Recebido/
Diagnóstico/Aguardando aprovação/Aguardando peça/Em reparo/Pronto/
Entregue/Cancelado) → **3h.4** "Registrar aprovação" com as três
consequências de verdade (aprova orçamento, reserva estoque, cria OS,
pula peça quando não falta nada) → **3h.5** modal de entrega com os 4
requisitos + PDF único + bancada mobile.

**Duas migrações aplicadas em produção**: `migracao-oficina-contatos.sql`
(3h.1), `migracao-oficina-entrega.sql` (3h.5). **Zero lógica de estoque
nova escrita** — as reservas/baixas reaproveitam `sincronizarReservaOrcamento`/
`entregarOrcamento`, já existentes e testados desde antes deste pacote.

**Decisões tomadas com o Marcos antes de codar** (perguntadas via
`AskUserQuestion` antes do 3h.1, ver início desta seção mais acima):
técnico manda diagnóstico/valor direto ao cliente sem gate de gestor;
garantia própria cobra mão de obra só se o defeito mudou (informado via
badge, não automatizado — preço final sempre no orçamento).

**Registrado como fora de escopo, não esquecido**: atalhos de falha comum
em chips e picker de peças inline com total fixo no rodapé mobile (a
ficha reaproveita o formulário de orçamento existente pra isso, decisão
da 3h.2); "quem pode aprovar" e "recusa não toca o orçamento" continuam
como o Marcos decidiu; `sw.js` v192→v198 ao longo do pacote inteiro.

---

## ✅ Item 5 do pacote de handoff — calendário/formulário de vistoria (18/08)

Último item pendente do segundo pacote de handoff (`vamos resolver esses
então` — os 5 itens "registrados como depois", ver entrada logo abaixo).
Dois pontos: `#page-agendamentos` e `#page-visitas` (formulário de
vistoria + cards de equipamento) — este último é a captura de dado mais
usada em campo do app inteiro, então recebeu a mesma disciplina reforçada
de sempre: **shell-only, zero toque em id/onclick/lógica interna**.

**`#page-agendamentos`** — `#ag-form-card` ("Novo Agendamento
Recorrente") migrado pro `.rd-card`/`.rd-field`, mesmo padrão de sempre;
ganhou botão "Cancelar" ao lado de "Salvar Agendamento" (mesmo achado já
registrado nas outras migrações desta rodada — o shell novo não tem ✕
embutido). Emoji do título da topbar removido ("📅 Agendamentos" →
"Agendamentos"). Calendário (`table.cal`) **não tocado** — paradigma
visual de grade, sem equivalente `.rd-*`, mesmo critério já registrado
desde a Fase 8/redesign das 4 telas sem handoff.

**`#page-visitas`** — 6 blocos convertidos, só a moldura externa
(`.card`→`.rd-card`, `.ct`→`.rd-card-title`, título+span dividido em
`.rd-card-title`+`.rd-card-sub` onde havia subtítulo): Dados da Visita
(mantém `onclick="toggleVisDados()"` no título, recolhe/expande igual),
Check-in/Check-out (emoji removido do título), "Equipamentos do Local",
`#vis-equip-card` ("Vistoria dos Equipamentos"), Recomendações,
Observações Gerais, mais `#vis-ranking-card` e o wrapper da lista de
Histórico. **Absolutamente nada por dentro foi tocado**: `.row`/`.fl` dos
campos de Cliente/Local/Piscina/Data/Hora/Técnico, `#vis-checkin-bar`/
`#vis-checkin-form`/`#vis-checkin-info`, `.vis-chips`/`#vis-equip-chips`,
`.vis-progresso-mobile`/`.vis-equip-grid` (o alvo real da renderização
dinâmica de equipamento), textareas `#vis-recom`/`#vis-obs` — confirmado
por grep que todo id referenciado pelo JS (`vis-ranking-card`,
`vis-hist-body`, `vis-dados-card`, `vis-equip-card`) só é alcançado por
`getElementById`, nunca por seletor de classe — a troca de classe do
container não quebra nada.

Testado no Browser pane com dado real de produção (sessão técnico
sintética via `dbOk=false;db=null;setSessao(...)`, clique real e
`javascript_exec` como fallback quando o clique visual não registrava —
tela grande e alta, alguns cliques em `ref` miravam texto fora do
viewport atual): busca de cliente real (`abrirBuscaCli('vis')`, 304
clientes de produção) selecionando "DI MARIA" corretamente; seleção de
chip de equipamento (`toggleVisEquip`) renderizando o card
"Vistoria dos Equipamentos" com o `.rd-card-title` novo; clique de status
(`setVisEquipStatus('motobomba','bom')`) atualizando badge e borda do
bloco na hora; check-in (`visCheckin()`) trocando a barra pra verde com
cronômetro, escondendo o formulário; aba Histórico
(`visTab('hist')`) renderizando dashboard + ranking + lista com dado real
sem quebra; 375px mobile — os 6 cartões migrados, a barra fixa
Finalizar/Descartar, e a progress bar "N de M vistoriados" (Fase 9c-rev)
todos sem overflow horizontal (`scrollWidth===clientWidth===375`
confirmado via JS, não só olhando a imagem). Zero erro novo no console
(só o ruído de Service Worker já documentado, reproduz mesmo sem
mudança).

**Com isso, os 5 itens "registrados como depois" (pedido do Marcos "vamos
resolver esses então") estão fechados**: revisão de segurança do portal,
migração `.card`→`.rd-card` das 7 telas administrativas, migração
retroativa de A Receber, responsividade do container/sidebar, e este
item (calendário/formulário de vistoria). O item "Unificar OS/Minhas OS"
foi investigado à parte e descartado por mútuo acordo (premissa já
resolvida no código atual, ver entrada de 18/08 mais abaixo).

sw.js: fluxa-v192 → fluxa-v193.

---

## ✅ Migração `.card`→`.rd-card`: telas antigas restantes (18/08)

Item "registrado como depois" do handoff, retomado a pedido do Marcos
("vamos resolver esses então" — os 5 itens da lista de pendências
adiadas, incluindo os 3 com ressalva). Antes de mexer, investiguei um
deles à parte (unificar "Ordens de Serviço"/"Minhas OS") e achei que a
premissa mudou — hoje `snbRules` já mostra só uma delas por perfil
(`snb-os-history: gestor`, `snb-minhas-os: tecnico`, mutuamente
exclusivos), diferente do que o documento de análise original registrava
("o técnico vê as duas"). O ganho de unificar o CÓDIGO por trás (hoje são
2 funções de render totalmente separadas) seria só de manutenção interna,
não visível ao usuário, contra o risco real de mexer no fluxo diário do
técnico em campo — perguntei ao Marcos e ele concordou em não fazer.

**Migradas 7 telas** (`#page-empresa`/`#page-usuarios`/`#page-auditoria`,
os 3 citados nominalmente pelo plano, mais `#page-identidade`,
"Resumo do período" em `#page-history`, `#page-despesas` e `#page-setup`,
achados no caminho como do mesmo tipo — `.card`/`.ct`/`.row`/`.fl`/
`<label>`/`.btn-primary` → `.rd-card`/`.rd-card-title`/`.rd-field`/
`.rd-field-lbl`/`.rd-field-box`/`.rd-btn`, mesmo padrão de sempre). Emoji
saiu dos títulos estáticos e botões (mesmo critério da varredura de
14/08 — conteúdo dinâmico como o log de auditoria mantém o emoji, não
precisa às pressas). `#cfg-cor`/`#cfg-cor2` (inputs de cor) tinham o
`value` default hardcoded em `#C45E0A`/`#2B3244` (laranja Forthemp) —
trocado pro azul/escuro padrão do redesign (`#0B62CE`/`#101720`), como o
plano já registrava como pendência ("é onde mora o hex hardcoded"); sem
efeito prático (o JS sempre sobrescreve com `CFG.cor` real ao abrir a
tela), só o estado antes do JS rodar.

**Achado real no processo, corrigido**: ao remover o botão "×" do
cabeçalho do formulário "Nova Despesa"/"Novo Usuário" (o shell novo não
usa × embutido, mesmo padrão dos modais já migrados — fecha por
Cancelar), quase deixei os dois formulários SEM nenhuma forma de fechar
sem salvar — o × era a única saída. Adicionado botão "Cancelar" ao lado
de "Salvar" nos dois, testado que `fecharFormUsuario()`/`fecharFormDesp()`
continuam alcançáveis.

**Não migrado nesta rodada, registrado**: o restante de `page-equipamentos`
(formulário "Novo Equipamento" + import em massa de vistoria) e os 3
modais de `page-estoque` (lista de compras, novo produto, dar baixa) —
nenhum foi citado nominalmente pelo plano; ficam pro próximo "tela
tocada por outro motivo", mesmo critério que já regia esse item desde o
início. `page-form`/`page-os` (formulário de orçamento e de OS) **não
entram nesta categoria** — nunca estiveram na lista de pendências, e
seguem protegidos pela mesma cautela já registrada dezenas de vezes
neste arquivo (captura de dado real, interação demais pra arriscar sem
necessidade).

Testado no Browser pane (offline, clique real): as 7 telas abrindo sem
erro, formulários preenchendo/salvando (`previewCfg()`, `gV/setV`
confirmados funcionando com os ids preservados), "Cancelar" fechando os
2 formulários sem salvar, `page-setup` (visto raramente — só em empresa
nova) com o assistente numerado intacto (`.setup-h`/`.steps`, deixado
como componente próprio, não redesenhado). 1280px/375px sem overflow em
nenhuma das 7. Zero erro novo no console.

sw.js: fluxa-v191 → fluxa-v192.

---

## ✅ Responsividade — sidebar mais estreita no notebook, container mais largo no monitor grande (18/08)

Retomando a pendência registrada mais cedo hoje (feedback do Marcos: "no
Mac com tela menor fica apertado; no monitor externo sobra espaço em
branco"). Pedido pra resolver ("sim resolva tudo"). Medido antes de mexer
(via `getBoundingClientRect()` real no browser, não estimativa):

- **Monitor grande — confirmado, era real.** `.wrap{max-width:1200px}` é
  o container principal de quase toda tela do app. Com a sidebar fixa em
  240px, um monitor 1920px sobrava **240px de margem morta de cada lado**
  (1200px preso dentro de 1680px de área útil); em 2560px, **560px de
  cada lado** — quase metade da tela em branco.
- **Notebook pequeno — mais sutil do que parecia.** Em 1280-1440px (faixa
  típica de MacBook), `.wrap` nem chegava a bater no teto de 1200px — a
  área útil (viewport − 240px de sidebar) já era menor que isso, então o
  conteúdo não estava "espremido pelo container", só tinha menos espaço
  disponível no total. A sidebar fixa em 240px (mesma largura desde
  680px até o infinito — só vira drawer abaixo de 680px) é o que mais
  pesa proporcionalmente numa tela menor: 240px é 17-19% da largura útil
  num notebook de 1280-1440px, contra ~12% num desktop de 1920px, pro
  MESMO conteúdo de rótulo de menu.

**Duas mudanças, as duas em `styles.css`, nenhuma toca HTML/JS de
nenhuma tela específica** (por isso "resolve tudo" de uma vez — é o
container compartilhado, não uma tela por vez):

1. **`.wrap` escalona em degraus em telas grandes** — `min-width:1680px`
   → 1400px, `min-width:1920px` → 1600px, `min-width:2400px` → 1900px.
   Degraus, não `100vw` solto: uma tabela ou linha de texto infinitamente
   larga piora a leitura tanto quanto sobra de espaço vazio — mesma razão
   de `.wrap` ter um teto em primeiro lugar. Cada degrau ainda deixa uma
   margem visível de propósito, só não mais a metade da tela.
2. **`--sidebar-w` cai de 240px pra 220px entre 681px e 1439px** (só
   nessa faixa — desktop grande e mobile ficam exatamente como estavam).
   220px foi o número que sobrou depois de testar: **208px chegou a
   cortar o rótulo "Ordens de Serviço"** (medido via
   `scrollWidth`/`clientWidth` — 9px de diferença, apareceria com
   reticência) — subi pra 220px e o texto mais longo do menu
   ("Cadastros e análise", "Ordens de Serviço") passou a caber inteiro,
   confirmado sem nenhum rótulo cortado.

**Não fiz** (fora do escopo desta rodada, registrado pra quem for atrás):
não toquei em nenhum grid/breakpoint POR TELA (`.novo-orc-body`,
`.ins-body`, `.dash`, tabelas) — só os dois containers compartilhados
(`.wrap` e a sidebar). Isso resolve a causa estrutural comum às duas
queixas do Marcos, mas telas com layout mais específico (ex.: o painel
de prévia de 420px fixo do Novo Orçamento) podem ainda ganhar um ajuste
próprio depois, se alguém sentir falta — não veio pedido pra isso agora,
e mexer em grid por tela é um projeto bem maior que "o container tá
capado errado".

Testado no Browser pane com medição real via JS (o screenshot do painel
ficou não-confiável nesta sessão especificamente para viewports grandes —
o DOM media real sempre bateu certo, então validei por
`getBoundingClientRect()`/`scrollWidth` em vez de só olhar a imagem):
1280px (sidebar 220px, zero rótulo cortado, zero overflow em Oficina/
Novo Orçamento/Estoque/Insights), 1440px (sidebar volta a 240px, fora da
faixa — conferido o limite exato), 1920px (`.wrap` 1600px, margem caiu de
240px→40px de cada lado), 2560px (`.wrap` 1900px, margem 560px→210px),
375px mobile (sidebar drawer, `padding-left:0`, nenhuma das duas
mudanças alcança essa faixa — conferido explicitamente). Zero overflow
horizontal de página em nenhuma largura testada. Zero erro novo no
console (só o ruído de Service Worker já documentado, reproduzido mesmo
sem nenhuma mudança minha, ambiente de sandbox).

sw.js: fluxa-v190 → fluxa-v191.

---

## ✅ Tarefa 4 fechada de vez — migração retroativa de "A Receber" (18/08)

Última pendência do segundo pacote de handoff (`PLANO-ACABAMENTO.md`, "Tarefa
4 — Uma fonte só pra 'A Receber'"). A entrada de 15/08 já tinha resolvido
isso uma vez com a **opção (b)** (somar as duas fontes) — mas o handoff novo
reabriu a mesma decisão com as duas opções de novo, e desta vez, perguntado
de novo, o Marcos escolheu a **opção (a)** (migração retroativa, a
recomendada pelo próprio plano) — resolve de vez, sem carregar a ressalva
"inclui R$X de registros antigos" pra sempre.

**Antes de gravar em produção, perguntei de novo** (via `AskUserQuestion`,
com números REAIS levantados por leitura direta do banco) — porque a
mecânica exata de "1 parcela à vista por orçamento" tinha uma decisão que o
texto do plano não deixava 100% explícita: o que fazer com o valor já
recebido. Apresentei o cálculo: **103 orçamentos** aprovados sem nenhuma
linha em `recebimentos`; **60** com saldo em aberto real (soma
R$139.458,86) ganhariam parcela **aberta** no valor do saldo (não o total
bruto — alguns já tinham pago parte); **43** já quitados via `valor_recebido`
ganhariam parcela **já paga** (senão, assim que o código parasse de ler
`valor_recebido`, viravam "nunca recebido" do nada). O Marcos aprovou,
pedindo cuidado explícito pra não "bugar dados e KPIs".

**Migração** (`migracao-recebimentos-retroativa-2026-08-18.sql`, rodada via
Management API):
- **Dry-run em transação primeiro** (`BEGIN; ... SELECT count/soma;
  ROLLBACK;`) — confirmou 103 linhas, soma abertas R$139.458,86 batendo
  exato com o número calculado antes de perguntar ao Marcos, soma pagas
  R$74.768,77. Só depois rodei de verdade (`COMMIT`).
- `id = 'rec_migr_' || orcamento_id` de propósito, não o padrão
  `'rec_'+timestamp+random` do app — torna a migração **idempotente**:
  rodar 2x por engano bate na PK duplicada e falha alto, em vez de duplicar
  a parcela em silêncio.
- Verificado depois: 108 linhas totais em `recebimentos` (5 antigas + 103
  novas), zero duplicata por `orcamento_id`, spot-check de 5 orçamentos
  reais com o valor batendo exato (`total − valor_recebido` pra quem tinha
  saldo; `valor_recebido` completo, pago, pra quem já tinha quitado).

**Código, só depois de confirmar a migração em produção** (nunca no mesmo
commit, como o próprio plano manda):
- **`_orcSaldoAReceber(o)`** — parou de ler `orcamentos.valor_recebido`.
  Sem nenhuma parcela em `recebimentos` pro orçamento, o fallback agora é
  **o total** (não mais `total − valor_recebido`) — cobre o caso NOVO,
  daqui pra frente: aprovar um orçamento e clicar "Decidir depois" no modal
  "Como vai receber?" não cria parcela nenhuma (`pularRecebimento()`,
  confirmado lendo o código), então sem esse fallback ele desapareceria da
  conta em vez de aparecer devendo o total. **Achado importante durante a
  revisão, evitou um bug real**: `_orcAprovadosSemReceb()` (o "card de
  gap") tinha um filtro extra `_orcSaldoAReceber(o)>0` que dependia do
  fallback antigo — se eu tivesse só apagado a leitura de `valor_recebido`
  sem pensar no fallback, esse filtro passaria a excluir TODO orçamento sem
  parcela nenhuma (porque a soma de um array vazio é 0), quebrando o card
  de gap pra sempre, silenciosamente. Escolhendo "total" como fallback em
  vez de "zero", o card continua funcionando sem nenhuma outra mudança.
- **`#d-rec`** (card "A Receber" do dashboard antigo do Histórico) —
  removido, junto com o cálculo `aRec` em `atualizarDash()`. Era o menos
  confiável dos 3 lugares que mostravam o número (só lia `valor_recebido`
  puro, sem sequer a soma das duas fontes que os outros 2 já tinham desde
  15/08). O grid `.dash` (4 colunas) ficou com 3 cards — criada
  `.dash-3` (modificador escopado, não mudei `.dash` em si porque
  `#ident-kpis` também usa a classe com contagem própria de cards) pra não
  sobrar coluna vazia no desktop.

**Testado com dado real de produção** (leitura, `dbOk=true`, nenhuma
escrita além da migração já commitada e verificada): KPI "A receber" do
Insights e o subtítulo "X em aberto" da tela A Receber batendo **exatos**
(R$143.012,36 nos dois — confirma que as duas telas agora leem a mesma
fonte, o objetivo inteiro da tarefa); dashboard do Histórico com 3 cards
alinhados (`.dash-3`, sem coluna vazia, testado em 1280px e mobile);
`#d-rec` confirmado ausente do DOM. Zero erro novo no console.

**Registrado, não é bug**: as parcelas migradas aparecem com `vencimento`
= data de aprovação (como o plano pediu) — para orçamentos aprovados há
meses, isso significa nascerem já "vencidas" no aging da tela A Receber.
É o comportamento correto e esperado (o dinheiro já estava em atraso desde
aquela data, só nunca tinha sido registrado formalmente) — não é um efeito
colateral a corrigir.

sw.js: fluxa-v189 → fluxa-v190.

---

## ✅ 3f.4 — Migrados `#mov-modal` e `#resv-modal` pro shell `.rd-modal` (18/08)

Último item do índice 3f (`PLANO-3F-OFICINA.md`). Os dois nasceram depois
da Tarefa 3c (que migrou `confirmar()`) e ficaram na pilha antiga inteira
(`.qr-modal-bg`/`.card`/`.ct`/`.row f1`/`.fl`/`<label>`/`.btn-primary`) —
abriam instantâneos (sem animação), com título peso 800, ao lado de modais
que já animam com título 600 desde a Tarefa 3c/13/14/08.

- **Shell**: `.qr-modal-bg`/`.card`/`.ct` → `.rd-modal-bg`/`.rd-modal`
  (mesmo raio 14, sombra, fade+card, sheet mobile com grip). Ids dos dois
  modais mantidos idênticos (`mov-modal`/`resv-modal`) — só a moldura
  mudou, nenhum outro código que os referencia precisou saber da migração.
- **Mecanismo de abrir/fechar mudou** (diferente da migração anterior, que
  só trocava classe CSS sem tocar JS): estes dois usavam
  `style.display='flex'/'none'`, não `classList.add/remove('on')` como o
  shell `.rd-modal-bg` espera (`display:none` por padrão, `.on` vira
  `display:flex`). `abrirMovModal`/`fecharMovModal`/`abrirResvModal`/
  `fecharResvModal` atualizados para `classList`.
- **`.row f1`/`.fl`/`<label>` → `.rd-field`/`.rd-field-lbl`/`.rd-field-box`**
  nos dois — campo a campo, mesmo padrão já usado nos cartões da Oficina
  desta sessão.
- **`#mov-modal-titulo`** — antes fazia `innerHTML` com o título E um botão
  ✕ embutido (`float:right`) porque o shell antigo não tinha X de fechar
  próprio. O shell novo fecha por Cancelar/clique no fundo (mesmo padrão
  de `crm-contato-bg`/`receb-bg`/`aprov-os-bg`, nenhum tem ✕ visível) —
  virou um `<h3>` simples com `.textContent`, sem botão embutido.
- **`#resv-info` + `#resv-detalhe` (bloco solto com borda `ad-hoc`)** viraram
  `.rd-modal-sub` (nome do produto + unidade) + **`.rd-modal-detail`**
  (pares rótulo/valor, mesmo bloco `#F7F9FC` que `confirmar()` já usa) —
  exatamente o que o plano pedia. Linhas de orçamento individual entram
  como `.rd-modal-detail-row` menores dentro do mesmo bloco; a linha de
  status final (bate/diverge/negativo) é texto livre, não um par rótulo/
  valor, então ficou fora do formato de linha — mas dentro do mesmo bloco.
- **`resv-btn-recalc`** (`.eb.eico.fix`, sistema antigo) → `.rd-btn
  rd-btn-secondary`, full width, mesmo comportamento (`resvUsarEsperado()`
  inalterada).
- **Botões finais**: `.btn-primary` solto → `.rd-modal-acts` com
  `.rd-modal-btn-nao`/`.rd-modal-btn-sim`, mesmo par Cancelar/Confirmar
  dos outros 3 modais já migrados.

Nenhuma lógica de negócio tocada — `confirmarMovimento()`, `confirmarResv()`
e `resvUsarEsperado()` só leem `gV()`/`setV()` dos mesmos ids, que
continuam existindo nos mesmos lugares.

Testado no Browser pane (offline após a 1ª rodada — achado no processo:
`dbOk` estava `true` por padrão no boot desta sessão de teste, e uma
sincronização real sobrescreveu o produto sintético que eu tinha criado à
mão antes de eu perceber — mesma classe de armadilha já documentada várias
vezes neste arquivo; sem risco real, foi só leitura, nenhum `confirmar*()`
chegou a ser clicado nessa janela. Corrigido setando `dbOk=false;db=null`
e testando com produto real da base carregada): `abrirMovModal` nos 3 tipos
(entrada/saída/ajuste — campo "O que aconteceu?" aparecendo só no ajuste);
`abrirResvModal` com o bloco de detalhe completo (reservado/esperado/lista
de orçamentos/linha de status), botão "Usar valor dos orçamentos"; os dois
fechando por Cancelar e por `classList.remove('on')`; sheet mobile (375px)
com grip, ancorada no rodapé, sem overflow. Zero erro novo no console.

sw.js: fluxa-v188 → fluxa-v189.

**Com isso, o pacote 3f do handoff (`PLANO-3F-OFICINA.md`) está fechado
por completo**: 3f.1 (emojis→SVG), 3f.2 (topbar/chips/cartão escuro),
3f.3 (recepção em 3 cartões), 3f.4 (migração dos 2 modais restantes).

---

## ✅ 3f.3 — Recepção: três cartões em vez de um (18/08)

Quarto item do índice (`PLANO-3F-OFICINA.md`). A tela cheia e o `.vb-topbar`
já estavam certos — o que mudou foi só a organização do formulário: 8 campos
empilhados num `.rd-card` só viraram 3 cartões por função.

- **Cartão 1 "Quem trouxe e o quê"** — Cliente + Equipamento em `.row`
  (grid 2 colunas, já existia no design system e colapsa pra 1 coluna
  abaixo de 680px — reusado em vez de CSS novo). Origem + o vínculo
  condicional (OS de campo) na segunda linha, também `.row` — quando não
  há vínculo condicional (origem "Balcão"), a segunda coluna fica vazia;
  aceito de propósito, é o mesmo padrão de campo opcional que sobra em
  branco em vários formulários do app. Fabricante (3 campos, não cabe em
  2 colunas) ficou como bloco próprio de largura cheia, só quando a origem
  é garantia — layout que o próprio texto do plano já antecipava
  ("3 campos não cabem na grade de 2 colunas").
- **Aviso de retrabalho reescrito** — antes só citava o número do reparo
  anterior (`OF-XXXXX`); agora inclui a **data** do reparo anterior
  (`"Este equipamento já passou pela oficina em 12/06/2026 — reparo do
  mesmo trocador de calor. Pode ser retrabalho."`) — é a data que muda a
  conversa de cobrança, que o plano pedia explicitamente. Também trocou de
  cor: era o laranja de marca (`--c1`), virou azul informativo
  (`--info`/`--info-bg`) — isto é um dado a considerar, não um alerta de
  problema, mesma distinção de cor que o resto do redesign já usa entre
  "atenção" e "informação".
  **🔴 Bug achado e corrigido no próprio teste:** o primeiro código usava
  `_dataBR(anterior.data_entrega)` — mas `_dataBR()` só entende
  `"YYYY-MM-DD"` (faz `split('-')` esperando 3 partes exatas), e
  `data_entrega` é gravado como timestamp ISO completo
  (`new Date().toISOString()`, com hora). Resultado real, visto na tela:
  `"12T10:00:00Z/06/2026"` em vez de `"12/06/2026"`. Corrigido pra
  `new Date(anterior.data_entrega).toLocaleDateString('pt-BR')` — o mesmo
  padrão já usado pra formatar esse campo em `renderOficinaHistorico`.
- **Cartão 2 "Estado de chegada"** — subtítulo explicativo
  ("é o que evita a discussão de 'já veio quebrado assim' na entrega").
  Checklist também virou `.row` (grid 2 colunas); item marcado "Com
  avaria" ganha fundo `--warn-row`/borda `--warn-border` e um rótulo
  "AVARIADO" em `--warn` — antes era só um input de texto aparecendo sem
  nenhum destaque visual do próprio item. Fotos ganharam contador
  ("N de 4" — o mock do plano falava "2 de 8", mas a oficina sempre teve 4
  slots desde a Fase 1b, não 8; segui o número real, não o do mock).
- **Cartão 3 "O que o cliente relatou"** — só o textarea, rótulo virou
  título do cartão (era um `.rd-field` dentro do cartão único de antes).
- **Botão primário fora dos cartões**, com linha de apoio ao lado. Texto
  não é literal ao do plano ("...imprime a etiqueta da bancada") — a
  etiqueta (QR, Fase 5) existe, mas não é impressa automaticamente ao
  salvar, só fica disponível na ficha depois (botão 🏷️). Escrevi o texto
  batendo com o que realmente acontece: "Gera o número do reparo — a
  etiqueta (QR) fica disponível na ficha, em 🏷️." — o próprio plano já
  avisava pra fazer isso ("só escrever isso se a etiqueta existir — se não
  existir, a frase é só o nº do reparo").

Nenhuma função de salvar/estado (`salvarOficinaRecepcao`,
`_ofRecepcaoAbrir`, `_ofToggleCamposFabricante`) foi tocada — só
reposicionamento de HTML e o CSS dos 2 pontos acima (checklist e aviso de
retrabalho). Todos os ids referenciados pelo JS continuam existindo nos
mesmos lugares (conferido 1 a 1 antes de considerar pronto).

Testado no Browser pane (offline, porta nova, clique real + `javascript_exec`
com dados sintéticos): os 3 cartões renderizando na ordem certa; origem
alternando entre balcão/os_campo/garantia_fabricante — os campos
condicionais aparecendo na posição certa nos 3 casos; item de checklist
marcado "Com avaria" ganhando fundo/borda/rótulo na hora; aviso de
retrabalho com a data certa (bug do `_dataBR` achado e corrigido antes de
seguir) e o botão "Vincular" funcionando; contador de fotos "0 de 4";
375px com os 3 cartões empilhando em coluna única sem overflow (grid
`.row` colapsando como esperado). Zero erro novo no console.

sw.js: fluxa-v187 → fluxa-v188.

---

## ✅ 3f.2 — Oficina: topbar, chips de estado e cartão escuro (18/08)

Terceiro item do índice do handoff (`PLANO-3F-OFICINA.md`). Diagnóstico do
plano: a tela já usava os componentes certos, mas sem a barra de 62px, sem
chips de contagem e sem o cartão do "maior problema do dia" — os mesmos
componentes que Orçamentos/OS/Estoque já ganharam nos redesigns anteriores.

**Badge da sidebar já estava pronto** — construído junto com a Fase 3g (o
`_ofReparosTravados()` foi desenhado ali de propósito pra ser reusado aqui,
sem duplicar o cálculo de "travado").

- **Topbar** (`.novo-orc-topbar`, mesmo padrão de toda lista redesenhada):
  título "Oficina" + subtítulo agregado `_ofAgregadoSub()` ("N equipamentos
  na bancada · N aguardando peça · N sem mexer há mais de 20 dias", sempre
  sobre a loja inteira, não afetado por busca/filtro) + trilho **Quadro/
  Histórico** (reusa `.ins-period`, o mesmo componente visual do seletor de
  período 6M/12M/Ano do Insights — o plano pedia "copiar do Dia/Semana/Lista
  da OS", mas esse trilho nunca chegou a ser construído lá, então usei o
  componente real mais parecido já em produção) + primário **"Dar entrada"**
  (sem `+`, igual todo outro primário do sistema).
- **Chips de estado** (`OFICINA_CHIPS`/`_ofRenderChips`/`_ofSetFiltroChip`,
  mesmo padrão de `OS_CHIPS`/`_osRenderChips`): Todos · **Travado** (estado
  derivado — `aguardando_peca`/`aguardando_aprovacao` há 7+ dias, não um
  valor de coluna) · Na bancada (não-terminal) · Prontos · Garantia. Contagem
  zero some, exceto "Todos" e o chip ativo. Select de origem virou filtro
  **secundário** (continua ao lado, mas os chips são o filtro principal).
  `_ofListaFiltrada()` é a fonte única (busca + origem + chip) — quadro e
  histórico não podiam divergir no que mostram.
- **Cartão escuro** (`_ofRenderHero`, reusa `.os-hero`/`.os-hero-*` — o
  mesmo componente do "cartão do maior problema do dia" que a OS já usa,
  cores idênticas às que o plano pedia porque são os MESMOS tokens
  `--bad`/`--warn-dot`/`--info`/`--ok` já no design system, não hex novo):
  travado > 0 → "N reparos · o mais antigo há Nd · R$ X em peça esperando"
  (soma só do orçamento de conserto **aprovado** vinculado aos travados em
  `aguardando_peca` — sem orçamento aprovado não entra na soma, não é pra
  parecer mais preciso do que é) + 3 colunas compactas (Aguardando peça/Sem
  aprovação/Prontos p/ retirar) + botão "Cobrar aprovação" (filtra pro chip
  Travado e rola até o quadro). Sem nada travado, mostra o andamento em vez
  de sumir ou zerar: "N em reparo · N entregues nos últimos 7 dias" —
  mesmo princípio do `_renderOSHero` calmo.
- **Cards do quadro**: borda esquerda de 3px por urgência
  (`_ofCorBordaCard` — dias parado manda: >20d vermelho escuro, >7d laranja;
  sem urgência de tempo, cor por status: em_reparo azul, pronto verde) +
  **valor do reparo** (`_ofValorCardHtml`, só em aguardando_aprovação/
  pronto — o que está sendo cobrado ou pronto pra faturar; garantia de
  fabricante mostra "garantia · sem cobrança" no lugar, porque nunca vai ter
  valor real ali) + coluna reduzida de 240px→200px + selo do cabeçalho da
  coluna reusando `OFICINA_STATUS_CLS` (aprovação/peça em `warn`, em reparo
  `info`, pronto `ok`) em vez de neutro fixo.

**Cortado de propósito, registrado pro plano não ser esquecido**: "o que
está travando" (linha `#A6521A` tipo "selo mecânico · pedido 12/08" no card)
exigiria um campo novo — hoje não existe onde registrar se a peça foi
pedida, e a qual pedido de compra (se algum) o reparo está amarrado. Fazer
isso direito precisaria de schema novo (`peca_pedido`/`peca_prevista`/
vínculo com `ordens_compra`) e uma decisão do Marcos sobre como o atendente
registraria isso — não é um ajuste de CSS/JS como o resto desta tarefa.
Ação "Ver compra"/"Comprar" do card, que dependeria do mesmo campo, ficou
de fora pelo mesmo motivo. O `renderOficinaMetricas()` (5 tiles + listas de
travados/prontos-parados, já existente desde a Fase 5/10) **não foi
removido** apesar de sobrepor parte do que o cartão escuro agora mostra —
decisão deliberada de não descartar métrica em produção (tempo médio,
retrabalho, prazo estourado) sem necessidade; a sobreposição parcial
(travados) é aceitável, mesmo padrão de duplicação leve que já existe em
outros lugares do app (ex.: hero da OS + chip "Atrasado").

Testado no Browser pane (offline, porta nova pra garantir código fresco,
clique real + `javascript_exec` com dados sintéticos): 6 reparos cobrindo
todos os estados (travado por peça há 31d com orçamento aprovado vinculado,
travado por aprovação há 9d, em reparo, pronto, garantia sem cobrança,
recém-recebido) — topbar com o agregado certo, cartão escuro com "2
reparos · o mais antigo há 31 dias · R$ 350,00 em peça esperando" e as 3
colunas batendo, "Cobrar aprovação" filtrando pro chip Travado e navegando
pro quadro, chip Travado com contagem e alerta, Histórico respeitando o
mesmo filtro de chip que o quadro; card com borda vermelha escura (31d) e
laranja (9d) visíveis; card de garantia mostrando "garantia · sem
cobrança"; estado calmo (0 travados) mostrando "N em reparo · N entregues";
estado vazio (0 reparos) com "Bancada em dia" + chips escondidos, sem
quebrar; 1180px com rolagem horizontal do quadro sem estourar a página;
375px com topbar/hero/chips empilhando sem overflow. Zero erro novo no
console (só o ruído de boot já documentado).

sw.js: fluxa-v186 → fluxa-v187.

---

## ✅ 3g — Sidebar: bloco de atendimento (Balcão/Novo orçamento/Dar entrada) (18/08)

Segundo item do índice do novo handoff (`PLANO-3G-NAVEGACAO.md`). Sidebar
ganhou um bloco de ação no topo, acima do seletor de unidade: botão primário
"Novo orçamento" (full-width) + fileira 50/50 "Balcão"/"Dar entrada"
(`.snav-secondary-row`/`.snav-secondary-btn`, novo em `styles.css`) + um
divisor antes do seletor de unidade. Objetivo do plano: as duas ações mais
usadas do dia a dia (abrir um atendimento de balcão, dar entrada na oficina)
não deveriam exigir navegar até a página — ficam ao alcance em qualquer tela.

**Reorganização de grupo, não só CSS novo:**
- `snb-oficina` (o item de navegação da PÁGINA Oficina, diferente do botão
  "Dar entrada" novo, que abre a tela cheia de recepção) saiu do grupo
  "Operação" e entrou em "Dia a dia", logo depois de "Hoje" — ganhou um badge
  (`#snb-badge-oficina`) com a contagem de reparos travados
  (`_ofReparosTravados()`, o mesmo helper que a Fase 3f.2 do próximo item vai
  reusar para o cartão escuro — construído aqui de propósito para não
  duplicar o cálculo depois).
- `snb-venda-balcao` (item antigo da sidebar que abria Balcão) foi REMOVIDO —
  o botão secundário novo já cobre essa ação; manter os dois seria
  redundante. "Operação" ficou só com Ordens de Serviço + Agenda.
- Nav mobile: `mnb-history` (ícone de relógio, ia para o Histórico) virou
  `mnb-venda-balcao` — mesma posição na barra, ícone de carrinho, abre
  Balcão. Histórico continua acessível pela sidebar/menu "Mais".
- "Venda Rápida" foi renomeado para "Balcão" nos 2 lugares que ainda diziam
  o nome antigo (atalho da tela de Estoque, título da topbar da tela cheia
  de balcão) — consistência com o rótulo do botão novo.

**Permissão por perfil, não só reposicionamento** — o próprio plano já listava
o teste esperado ("vendas não vê 'Dar entrada', técnico não vê nenhuma das
três"), então o bloco de ações precisou de regra própria em
`aplicarPermissoesPerfil()`, separada da lista `snbRules`/`mnbRules` (que só
mostra/esconde item de navegação, não estes botões de ação):
```js
const secBalcao=document.getElementById('snav-secondary-row');
if(secBalcao) secBalcao.style.display=(gestor||vendas)?'':'none';
const secOficina=document.getElementById('snav-secondary-oficina');
if(secOficina) secOficina.style.display=gestor?'':'none';
```
Resultado: técnico não vê o bloco primário inteiro (nem "Novo orçamento" nem
a fileira secundária); vendas vê "Balcão" mas não "Dar entrada"; gestor vê
os três.

**Badge no boot, não só ao visitar a página** — sem isso o contador de
travados na sidebar ficaria sempre vazio até alguém abrir a tela Oficina
manualmente (mesmo problema que o próprio badge existe para resolver: "sem
isso, reparos travados não aparecem em lugar nenhum até abrir a tela"). Boot
(dentro do `Promise.all` que já carrega dado inicial de gestor) ganhou uma
4ª chamada condicional: `loadOficinaReparos()` só se a lista ainda estiver
vazia — não recarrega à toa se outra rota já tiver preenchido antes.

Testado no Browser pane (clique real via `javascript_tool`/screenshot, os 3
perfis + os 3 breakpoints que o plano pede explicitamente): **gestor** — bloco
completo, "Dar entrada" abre a Oficina, "Balcão" abre a tela cheia certa,
grupo "Dia a dia" com Oficina 2º item (sem badge, 0 travados no teste),
"Operação" só com OS+Agenda; **técnico** — bloco de ações inteiro ausente,
só Oficina/Vistorias/Minhas OS na sidebar; **vendas** — "Novo orçamento" +
"Balcão" visíveis, "Dar entrada" ausente; **sidebar colapsada** (desktop) —
os dois botões secundários empilham full-width
(`flexDirection:column` confirmado via `getComputedStyle`); **1024px** —
sidebar renderiza cheia, sem overflow; **375px (drawer mobile)** — bloco de
ações cabe sem cortar, sem rolagem horizontal de página. Zero erro novo no
console nos 6 cenários.

sw.js: fluxa-v185 → fluxa-v186.

---

## 📦 Segundo pacote de handoff — plano de acabamento pós-oficina (18/08)

Novo pacote em `~/Downloads/design_handoff_fluxa_redesign/` (mesmo diretório
do handoff original, arquivos novos). Índice em `COMECE-AQUI.md`: 7 itens em
ordem, dos quais só o Tarefa 4 ("A Receber") exigia decisão do Marcos antes
de codar — perguntado e respondido (**migração retroativa**, a recomendada).
Trabalhando na ordem sugerida do próprio índice, 1 commit por item, mesma
disciplina de sempre.

### ✅ 3f.1 — Emojis das telas novas viram SVG (18/08)

5 pontos, `index.html`: `.cli-search-btn` em `#of-cli-nome`/`#of-eq-nome`
(🔍→SVG lupa 15px `stroke:var(--c1)`), botão de `abrirBuscaOSCampo()`
(🔍 Buscar→SVG+"Buscar"), `#of-btn-salvar` (remove 💾), `#resv-modal` título
(remove 🔒). Path da lupa reusado do login/busca de listas (não é ícone
novo). Aproveitado pra corrigir TODOS os `.cli-search-btn` do app na mesma
passada (7 ocorrências reais, não 5 como o plano contava — provavelmente o
plano só via `#of-cli-nome`/`#of-eq-nome` mais os 2 exemplos citados
explicitamente; `eq`/`venda`/`vis` também tinham o emoji e não tinham sido
citados, mas o próprio texto do plano já mandava "corrigir todos" porque é
o mesmo botão — segui o princípio, não a contagem).

**Achado no caminho, corrigido junto:** `salvarOficinaRecepcao()` (app.js)
resetava o texto do botão pra `'💾 Registrar entrada'` depois de salvar —
o emoji reaparecia depois do primeiro clique mesmo com o HTML já limpo.
Corrigido no mesmo commit (senão a Fase 3f.1 não seria "feita" de verdade,
só a primeira renderização).

Testado no Browser pane (offline, clique real): lupa aparece corretamente
em Novo Orçamento (`#cli`), modal de busca abre e lista clientes normal,
zero regressão. `sw.js`: fluxa-v184 → fluxa-v185.

---

## 🔧 OFICINA — cadastro inline de cliente na busca (18/08, feedback do Marcos)

Achado real do Marcos usando o app: "quando vai dar entrada na oficina ele
não permite colocar o nome do cliente sem ele ter sido cadastrado antes".
Confirmado — era decisão deliberada da Fase 1a ("EXIGE selecionar um
cliente já cadastrado pela busca... a busca de equipamento depende do
vínculo"), mas sem nenhuma saída pra quem chega sem cadastro prévio, o
atendente ficava travado de verdade — não dava pra continuar a entrada.

**Fix, sem reabrir a decisão da Fase 1a** (equipamento continua exigindo
`cliente_id` real — isso não muda): em vez de permitir texto livre no campo
`#of-cli-nome` (o que quebraria a busca de equipamento, que filtra por
`cliente_id`), o modal `#modal-busca-cli` ganhou "+ Não achei, cadastrar
cliente novo" — mesmo padrão exato do cadastro inline de equipamento já
existente (`_ofCadastrarEquipamentoInline`, Fase 1b): formulário mínimo
(nome/telefone/endereço) dentro do próprio modal, local-first, sincroniza
em background, e seleciona sozinho ao salvar — o atendente nunca sai da
tela de Dar Entrada.

**Não é exclusivo da oficina** — `#modal-busca-cli` é compartilhado por
todos os contextos (`_buscaCliCtx`: orc/os/vis/venda/eq/of), e a função
nova (`_cadastrarClienteInlineBusca`) só chama o mesmo `selecionarCliModal(...)`
de sempre, então funciona em qualquer um deles. Mas os outros contextos
(Orçamento, OS, Vistoria, Venda) já aceitavam nome digitado direto no
próprio campo — o botão novo é só uma alternativa a mais ali, não resolve
nenhum bloqueio real como resolve em Oficina/Equipamentos (os dois únicos
com campo `readonly`, forçando a busca).

**Achado, não corrigido nesta rodada** (fora do escopo, mesma causa raiz):
`#eq-cli-nome` (cadastro de Equipamentos, tela própria) tem exatamente a
mesma trava — também `readonly`, também precisa de `cliente_id` real pra
liberar o cadastro de piscina do cliente. Como o modal de busca agora é
compartilhado, o botão novo JÁ resolve esse caso de graça (mesma
`abrirBuscaCli('eq')` → mesmo modal → mesmo botão) — não precisou de
código extra, só não foi testado explicitamente neste ciclo.

Testado no Browser pane (offline, clique real via `ref`, ciclo completo):
Dar Entrada → 🔍 Buscar cliente → lista real da base aparece (304 clientes
de produção, cache local) → "+ Não achei, cadastrar cliente novo" → nome
preenchido automaticamente com o que já tinha sido digitado na busca →
"💾 Salvar e selecionar" → toast "✅ Cliente cadastrado" → campo Cliente
preenchido, campo Equipamento libera a busca (antes travado) → equipamento
cadastrado inline também (checklist mudou certo pro tipo "Motobomba") →
"💾 Registrar entrada" → toast "✅ Item recebido na oficina", ciclo
completo sem nenhum erro. Confirmado sem regressão no contexto `orc`
(Novo Orçamento): modal abre normal, cliente novo criado aparece na lista,
botão não interfere no fluxo de digitar nome direto que já existia. Zero
erro novo no console.

sw.js: fluxa-v183 → fluxa-v184.

---

## 🔧 MÓDULO OFICINA — Fases 9-13: a economia do serviço (18/08)

O Marcos trouxe uma pesquisa de mercado + leitura crítica do módulo (as 5
fases originais fecham o roadmap de **custódia do objeto** muito bem — termo
assinado, checklist, fotos, snapshot imutável, máquina de estados — mas não
tinham a **economia do serviço**: quem trabalhou, quanto tempo, quanto
custou, se deu lucro). Ele deu a direção e as ideias (7 hipóteses, sem
ordem definida) e pediu pra eu cruzar cada uma com o código real antes de
construir qualquer coisa, decidir a ordem e a arquitetura, e então **"faça
tudo"**.

**Cruzamento feito antes de escrever qualquer linha — 3 das 7 hipóteses já
estavam resolvidas, não precisaram de nada novo:**
- **Aprovação do cliente** — Fase 3 já cobre isso inteiro: o orçamento de
  conserto reusa `orcamentos`, que já tem assinatura com hash
  anti-adulteração + aprovação pelo Portal do Cliente. Quem aprovou e
  quando já fica registrado exatamente como em qualquer orçamento.
- **Garantia do próprio reparo** — Fase 4 (`garantia_propria_meses`/
  `garantia_propria_vencimento`) já resolve isso.
- **Peça consumida (metade do "custo do reparo")** — parcialmente resolvido
  de um jeito que não era visível de fora: `_congelarCustoOrc()` já congela
  `custo_unit`/`custo_total` por item do orçamento vinculado no momento da
  aprovação (mesmo mecanismo de qualquer orçamento, Etapa 2.1 do roadmap
  antigo). O dado já existia — só não estava exposto como "margem deste
  reparo" na ficha da oficina.

**4 gaps reais, confirmados no código, viraram as Fases 9-13** (ordem: barato
e independente primeiro, o núcleo de custo com o ponto de parada que o
próprio Marcos pediu, depois os dois fluxos mais especializados):

### ✅ Fase 9 — Prazo prometido (`migracao-oficina-fase9.sql`)

`oficina_reparos.prazo_prometido date` — editável a qualquer momento na
ficha (mesmo padrão não-bloqueante do diagnóstico, Fase 8: o atendente às
vezes só sabe o prazo depois do diagnóstico, não na entrada). `_ofPrazoAtrasado(o)`
é a fonte única de "atrasado" (prazo vencido + reparo ainda não
terminou) — usada na ficha, no badge do card do kanban e na métrica nova
"Prazo estourado".

### ✅ Fase 10 — Pronto e não retirado (sem migração — só client-side)

Achado real confirmado no código: `renderOficinaMetricas()` tratava
QUALQUER status não-terminal parado da mesma forma, inclusive `pronto` —
mesmo alerta que "travado em reparo", mesma ação implícita ("veja o que
travou"), quando a ação certa é oposta (cobrar o cliente pra retirar, não
investigar o reparo). `_ofProntoNaoRetirado(o)` (limiar próprio, 5 dias —
mais curto que os 7 de "travado", porque resolver é 1 contato, mais barato
que investigar um travamento) virou métrica e badge de kanban separados;
"travado" (`OFICINA_PARADO_DIAS`) agora exclui `pronto` de propósito.

### ✅ Fase 11 — Custo do reparo: margem de peça + mão de obra (`migracao-oficina-fase11.sql`)

**Ponto de parada do próprio Marcos, cumprido**: antes de qualquer métrica
em cima disso, esta fase só EXPÕE a margem já congelada — não recalcula
nada, não inventa número. `_ofMargemPeca(o)` lê o orçamento vinculado
(só existe depois de `aprovado`, que é quando `custo_total` congela) e
mostra receita − custo de peças na ficha. Itens avulsos (mão de obra
digitada como serviço) entram como margem pura, corretamente — mão de obra
não tem custo de produto, o custo dela é o tempo do técnico.

`tecnico_responsavel` (text) + `horas_mao_obra` (numeric), colunas novas.
As horas vêm **pré-sugeridas**, não digitadas do zero: `_ofHorasSugeridasEmReparo(o)`
calcula a partir do tempo entre a última entrada em `em_reparo` e a saída
dele (ou agora, se ainda está lá) no log de status que já existe desde a
Fase 2 — mesmo princípio já usado no diagnóstico citando o `OF-#####`
sozinho ("quem atende já está com o cliente, não digita o que o sistema já
sabe"). Técnico é um `<select>` reaproveitando `getTecnicos()` (mesma lista
usada em Agenda/OS), não texto livre.

**Deliberadamente NÃO calculado**: "quanto custa uma hora da nossa
oficina". Isso depende de um número que só o Marcos tem (pró-labore do
técnico + custo fixo da bancada ÷ horas produtivas) — não é inferível dos
dados existentes. O mecanismo de captura (técnico + horas) está pronto pra
quando esse número entrar.

### ✅ Fase 12 — Serviço terceirizado (`migracao-oficina-fase12.sql`)

`terceirizado_prestador`/`terceirizado_desde`/`terceirizado_ate`. Decisão
de arquitetura: **flag ortogonal ao status, não um status novo na
sequência** — o reparo continua `em_reparo`/`aguardando_peca` por dentro,
só ganha uma janela desde/até que as métricas descontam. Tempo médio de
reparo e o alerta de "travado" (Fase 10) agora excluem esse intervalo —
tempo na rebobinadora/usinagem não é nosso, contá-lo junto poluiria as
duas métricas. V1 suporta 1 ida-e-volta por reparo (enviar de novo
sobrescreve a janela anterior) — YAGNI até virar necessidade real de
suportar 2 no mesmo reparo.

### ✅ Fase 13 — Volta pelo campo (`migracao-oficina-fase13.sql`)

`oficina_reparos.os_campo_entrega_id text` — espelho do vínculo de ENTRADA
(Fase 7, `os_campo_id`), mas pro lado da saída: técnico leva o equipamento
reparado e instala, em vez do cliente retirar no balcão. Modal de busca
próprio (`modal-busca-os-entrega`/`abrirBuscaOSEntrega`/
`selecionarOSEntregaModal`) — clone estrutural do modal de vínculo de
entrada, NÃO reuso literal: aquele grava em `_ofOSCampoVinculada` (estado
do formulário de Dar Entrada), reusar aqui misturaria o vínculo de entrada
com o de saída.

**Escopo cortado de propósito**: só vincula uma OS de campo JÁ EXISTENTE
(mesma busca por cliente da Fase 7). Gerar uma OS nova pré-preenchida a
partir da ficha (como `criarOrcamentoDaOficina` faz pra orçamento) ficou de
fora — `ordens_servico` não tem um campo tipo `oficina_reparo_id` pra
capturar o vínculo automaticamente no save (diferente de `orcamentos`, que
já tinha isso pronto pela Fase 3), e criar esse vínculo automático exigiria
tocar o fluxo de salvar OS — mesma cautela já registrada na Fase 3 pra não
tocar `_mudarStProsseguir`.

**As 4 migrações (`fase9`/`fase11`/`fase12`/`fase13`) foram aplicadas e
verificadas em produção** via Management API (`information_schema.columns`
confirmou as 7 colunas novas com o tipo certo antes de seguir).

⚠️ **Verificação parcial nesta rodada, registrado com transparência**: o
Browser pane ficou indisponível (classificador de segurança do ambiente
sobrecarregado, todas as tentativas de `navigate`/`preview_start` falharam
por um bom tempo, mesmo após múltiplas tentativas espaçadas) — não foi
possível fazer o teste de clique real de ponta a ponta que todo o resto
deste módulo documenta. O que FOI feito em compensação: sintaxe validada
(`osascript`/`new Function` sobre o `app.js` inteiro, repetido depois de
cada fase), revisão manual linha a linha do diff inteiro (nomes de campo,
tipos, casos de escape — `esc()` quebraria se recebesse número direto,
conferido que todo valor numérico passa por `String(...)` antes), e
conferência de que cada função nova segue padrão já testado e em produção
de uma fase anterior (prazo espelha diagnóstico da Fase 8, custo/mão de obra
lê campos que `_congelarCustoOrc` já prova funcionar, entrega-por-campo
clona o modal da Fase 7 com estado próprio pra não colidir).

sw.js: fluxa-v181 → fluxa-v182.

### ✅ Pendência cumprida — teste de clique real, 2 bugs achados e corrigidos (18/08)

Browser pane voltou. Testadas as 5 fases ponta a ponta com clique de verdade
(`form_input`+`left_click` via `ref`, não só `javascript_exec`) — achando e
corrigindo **2 bugs reais** que só apareceriam clicando de verdade, mesma
lição já registrada na Fase 5 ("esse tipo de bug de empilhamento só é
visível olhando a tela de verdade").

**1. Board/métricas ficavam stale depois de salvar.** `salvarOficinaPrazo`,
`salvarOficinaCusto`, `oficinaEnviarTerceiro`, `oficinaVoltouTerceiro` e
`selecionarOSEntregaModal` (as 5 funções novas desta rodada) gravavam o
dado e reabriam a ficha, mas nunca chamavam
`_ofRenderAtiva()`/`renderOficinaMetricas()` — diferente de
`_ofAplicarStatus()` (Fase 2), que já fazia isso certo. Resultado real:
salvar um prazo atrasado, fechar a ficha e olhar o quadro por trás mostrava
"Prazo estourado: 0" e nenhum badge no card, até a página ser recarregada.
Corrigido nas 5 funções, mesmo padrão de `_ofAplicarStatus`.

**2. Modal de "Vincular OS de entrega" (Fase 13) abria atrás da ficha.**
Mesma classe exata do bug de QR da Fase 5. O botão só existe DENTRO da
ficha (`#of-ficha-overlay`, z-index 900), mas o modal usa `.modal-cli-bg`
(z-index 800 no CSS estático) — abria (`display:flex` confirmado) mas
ficava invisível atrás. Corrigido com `z-index:1000` inline no momento de
abrir (`abrirBuscaOSEntrega`), mesmo padrão do modal de assinatura
(`m.style.zIndex='1100'`).

**Achado, não corrigido nesta rodada** (fora do escopo, pré-existente): a
mesma lacuna de refresh (achado 1) também existe em
`salvarOficinaDiagnostico` (Fase 8) — mas lá é cosmeticamente invisível,
nenhum badge/contagem depende do texto do diagnóstico, não gera número
errado na tela. Registrado pra quem for mexer nessa função de novo.

**Achado no processo, não é bug**: um teste inicial deu falso-negativo —
parecia que o fix do achado 1 não funcionava. Era cache do navegador
servindo `app.js` antigo na mesma porta reaproveitada dentro da mesma
sessão, mesmo padrão já registrado na Fase 9b ("ao testar localmente na
MESMA aba/porta... ou usar porta nova, ou fazer hard-reload de verdade").
Resolvido subindo servidor em porta nova.

Testado (offline, `dbOk=false;db=null;`, clique real via ref): prazo salvo
→ toast + badge "⏰ Atrasado" aparece na ficha, no card do kanban e na
métrica "Prazo estourado" sem precisar recarregar; custo → margem de peça
calculada certa (R$350 − R$35 = R$315) exibida, técnico/horas salvos e
persistidos (horas pré-sugeridas "48.0" a partir do log de status,
confirmado); terceirizado → "Enviar pra terceiro" bloqueia campo vazio
(toast), envia com sucesso, badge "🔧 Com terceiro" aparece no card na
hora, "Voltou do terceiro" fecha a janela; entrega por campo → modal de
busca aparece por cima da ficha (fix de z-index), lista a OS certa do
cliente, vincula, ficha mostra "🚚 OS #077" com botão "Abrir OS" que
navega pra tela de OS corretamente; "Pronto, não retirado" (Fase 10)
mostrado com item real na lista quando testado com reparo `pronto` há 6
dias. Zero erro novo no console (só o ruído conhecido de sandbox).

sw.js: fluxa-v182 → fluxa-v183.

---

## 🔧 MÓDULO OFICINA — expansão de negócio, EM CONSTRUÇÃO (a partir de 17/08)

> **Se você é a outra IA e está lendo isso pela primeira vez:** a empresa está
> abrindo uma bancada de reparo física (oficina), além da manutenção de campo
> que já existe. Isto é um módulo NOVO, grande, sendo construído fase por
> fase — plano completo (schema de todas as 5 fases, decisões já tomadas,
> padrões do código a reaproveitar) em
> `/Users/marcosvinicius/.claude/plans/enchanted-conjuring-bee.md`. Pesquisa
> de mercado + mapeamento inicial do código: artefato "Módulo de Oficina"
> publicado pro Marcos numa sessão anterior (não versionado no repo).

### Decisões de negócio já confirmadas com o Marcos (não reabrir)
1. **Tabela nova** (`oficina_reparos`), separada de `ordens_servico` — a OS de
   campo é visita agendada com check-in/check-out por GPS; a oficina é
   bancada fixa com estados de reparo incompatíveis com isso.
2. **Garantia de fabricante**: só RASTREIO por enquanto (campos de texto
   livre: fabricante/protocolo/NF), sem cobrança/recebimento formal do
   fabricante — fica pra uma fase futura se um dia fizer sentido.
3. **Uma unidade de oficina só** por enquanto (não multi-loja ativo), mas
   `loja_id` nullable em todo lugar pra não fechar a porta.
4. **Decisão técnica minha** (autonomia dada pelo Marcos): a regra já em
   produção "aprovar orçamento = sai do estoque na hora" (`sincronizarBaixa
   Orcamento`, migração 07/08) **não é alterada** pra oficina — orçamento de
   conserto aprovado baixa estoque exatamente igual orçamento de campo.
   "Aguardando peça" (Fase 2) vira um status MANUAL que o técnico seta
   quando sabe que não tem a peça em mãos, independente do ledger. Motivo:
   não vale o risco de mexer em código compartilhado e sensível com o fluxo
   de campo (já teve incidente de reserva órfã documentado nesse trecho).

### Padrão de id: `text PRIMARY KEY` app-gerado
`oficina_reparos.id` = `'ofr_<timestamp>'`, mesmo padrão de `fornecedores`/
`ordens_compra` (`migracao-compras.sql`) — não o padrão de `id uuid`
server-gerado de `orcamentos`/`equipamentos`/`vendas_balcao`. Client já sabe
o id final na hora de criar, offline, sem precisar reconciliar id temporário
→ id real depois do sync. `dbInsertNumerado('oficina_reparos', payload)` só
precisa que `payload.id` já venha preenchido — o `numero` que ele calcula é
o que falta pra virar registro "de verdade" (offline: fica com
`numero:null, _pendingSync:true` até a conexão voltar).

### ✅ Fase 1a — Recepção e ficha de entrada, básico (17/08, `migracao-oficina-fase1.sql`)

Tabela `oficina_reparos` criada e aplicada em produção (verificado via
`information_schema.columns`). Fluxo fechado ponta a ponta: sidebar → "+ Nova
Recepção" (tela cheia, mesmo padrão de `venda-balcao` — sem sidebar/header,
`_telaCheia` em `go()` virou array) → busca cliente **já cadastrado**
(`abrirBuscaCli('of')`, novo branch em `selecionarCliModal`) → busca
equipamento **daquele cliente** (`abrirBuscaEq`/`filtrarListaEq`/
`selecionarEqModal` — modal genérico NOVO, não existia nada assim antes,
só clonado estruturalmente de `abrirBuscaCli`) → origem (balcão/OS de
campo/garantia de fabricante) → observação → salva (`salvarOficinaRecepcao`,
local-first, `dbInsertNumerado`) → aparece na lista (`renderOficinaLista`,
`.rd-table`/`.rd-row` — mesmo padrão de `renderOSTabela`) → abre ficha
(`abrirFichaOficina`, modal dinâmico `.cli-hist-overlay`/`.cli-hist-box`).

**Decisão de UX deliberada**: campo "Cliente" da oficina EXIGE selecionar um
cliente já cadastrado pela busca (não aceita nome digitado livre como
orçamento/OS aceitam) — diferente do resto do app, de propósito: a busca de
equipamento depende de um `cliente_id` real pra funcionar (equipamento é
filtrado por `cliente_id`), então digitar um nome sem selecionar deixaria o
campo de equipamento travado sem explicação. Trocar de cliente já selecionado
invalida o equipamento escolhido antes (evita salvar o par errado).

**Bug achado e corrigido no próprio teste**: número provisório (reparo ainda
não sincronizado, `numero:null`) renderizava como `"OF-00···"` em vez de um
placeholder limpo — `String(null||'···').padStart(5,'0')` faz padStart em
cima da STRING '···' (3 caracteres), não do número ausente, gerando "00" na
frente. Corrigido pra `o.numero ? 'OF-'+String(o.numero).padStart(5,'0') :
'OF-…'` nos dois pontos que formatam (`renderOficinaLista`/
`abrirFichaOficina`).

**Testado no Browser pane** (offline, `dbOk=false;db=null;` bare — sem
`window.`, confirmado via `read_network_requests` que nenhuma chamada foi a
`*.supabase.co`): ciclo completo criar→listar→abrir ficha; guarda de troca
de cliente invalidando equipamento; validação bloqueando salvar sem cliente/
equipamento (toast, sem gravar nada); acesso liberado pra gestor/vendas/
técnico (3 perfis testados); sem erros novos no console.

**Ainda não feito nesta rodada** (fica pra sub-passos seguintes, já
planejados): fotos de entrada + checklist estruturado (`estado_entrada`),
cadastro inline de equipamento novo dentro da busca (Fase 1b); termo de
entrada com assinatura + impressão + exibição do `OF-#####` de verdade
(Fase 1c). Depois disso, Fases 2-5 do plano.

sw.js: fluxa-v167 → fluxa-v168.

### ✅ Fase 1b — fotos de entrada + checklist + cadastro inline de equipamento (17/08)

Sem migração nova — `estado_entrada`/`fotos_entrada` já existiam na tabela
desde a Fase 1a (colunas jsonb vazias por padrão), só faltava o JS.

- **Checklist de estado na chegada** (`OFICINA_CHECKLIST_ITENS`,
  `renderOfChecklist`/`setOfChecklistItem`/`setOfChecklistObs`) — 4 itens
  fixos (carcaça, cabo/plugue, acessórios, liga ao testar), 2 estados por
  item (OK/Com avaria via `.vis-status-btn.sel-bom`/`.sel-atencao`, mesmas
  classes já usadas em Vistoria — reuso visual direto), clicar de novo no
  mesmo estado desmarca. Campo de observação só aparece quando marcado "Com
  avaria". Mais simples de propósito que o checklist de 4 estados da
  Vistoria (que avalia funcionamento) — aqui é só registrar dano
  pré-existente, pra não virar disputa depois.
- **Fotos da chegada** (`renderOfFotosSlots`/`carregarFotoOf`/
  `removerFotoOf`) — clone direto do grid de 6 fotos do orçamento
  (`renderFotosOrcSlots`, `app.js:3390`), só com 4 slots (documentação de
  entrada não precisa de tantas) e SEM `capture="environment"` no `<input
  type=file>` — omitir esse atributo é o padrão já estabelecido desde o
  Sprint 3 mobile (deixa o próprio celular oferecer Câmera OU Galeria).
  Reusa `compressImage()` existente, sem duplicar.
- **Cadastro inline de equipamento** dentro do próprio modal de busca
  (`_ofToggleNovoEq`/`_ofCadastrarEquipamentoInline`) — não reaproveita
  `salvarEquipamento()` literal (ela lê de campos do form completo de
  Equipamentos, que não existem neste modal compacto); é uma versão
  enxuta com só tipo/marca/modelo/série, mesma lógica local-first
  (`todosEq.unshift` + `dbInsert` + reconciliação de id temporário → real
  quando online). Ao salvar, já chama `selecionarEqModal()` — item
  cadastrado e selecionado num só passo.
- Ficha (`abrirFichaOficina`) ganhou `_ofFichaAvariasHtml`/
  `_ofFichaFotosHtml` — mostra avarias marcadas + miniaturas das fotos,
  com parsing defensivo (aceita `estado_entrada`/`fotos_entrada` tanto como
  objeto/array nativo quanto como string JSON, mesmo cuidado de sempre com
  campos jsonb vindos do Supabase).

Testado no Browser pane (offline, mesma disciplina de sempre — bare
`dbOk=false;db=null;`, zero chamada a `*.supabase.co` confirmada via
`read_network_requests`): toggle do checklist (marcar/observação/desmarcar);
slot de foto preenchendo e mostrando miniatura; cadastro inline criando o
equipamento, vinculando ao `cliente_id` certo e selecionando sozinho;
`_ofFichaAvariasHtml`/`_ofFichaFotosHtml` testadas isoladamente com dado
direto e com dado stringificado (os dois parseiam certo). Sem erros novos
no console.

sw.js: fluxa-v168 → fluxa-v169.

### ✅ Fase 1c — termo de entrada/retirada com assinatura + impressão (17/08)

Fecha a Fase 1 completa (recepção → estado de chegada → termo assinado).

- `abrirModalAssinaturaOficina(reparoId, tipo)` — **reusa o canvas genérico**
  (`initSigCanvas`/`limparAssinatura`, `app.js:~8775`, já usado na aprovação
  de orçamento pelo portal) sem alteração nenhuma nele: meu modal usa os
  MESMOS ids de canvas/placeholder (`sig-canvas`/`sig-placeholder`), então as
  funções existentes funcionam de graça. Só a confirmação é própria
  (`confirmarAssinaturaOficina`, já que a original é hardcoded pra
  `aprovarOrcPortal`). `tipo` é `'entrada'` ou `'retirada'` — grava em
  `termo_entrada_assinatura_*` ou `entrega_assinatura_*` (base64/data/meta,
  mesmo trio de colunas já usado em orçamento).
- **`oficina_reparos.id` é estável desde a criação** (text app-gerado,
  Fase 1a) — diferente de orçamento/equipamento, não precisa checar prefixo
  pra saber se já sincronizou antes de mandar o `dbUpdate`: se o reparo ainda
  não existir no banco, o UPDATE só afeta 0 linhas (sem erro), resolve
  sozinho no próximo `_reenviarOficinaLocais`.
- `imprimirTermoOficina(reparoId, tipo)` — mesmo padrão `window.open` +
  `document.write` + `window.print()` de `imprimirQR` (`app.js:~10941`),
  zero dependência nova. Mostra `OF-#####`, cliente, equipamento, avarias
  marcadas no checklist e a imagem da assinatura SE já assinado — senão
  imprime uma linha em branco pra assinar no papel (fallback físico).
- Ficha (`abrirFichaOficina`) ganhou 2 seções de ação (termo de entrada /
  termo de retirada), cada uma mostrando "✍️ Assinado" + botão imprimir
  quando já tem assinatura, ou "Assinar"/"Imprimir em branco" quando não tem.

Testado no Browser pane (offline, mesma disciplina): bloqueio de confirmar
sem traço no canvas (toast, não fecha o modal); traço real simulado via
`MouseEvent` (mousedown/mousemove/mouseup, não só setar a flag na mão) até
`_sigHasMark` virar `true`; confirmação salva os 3 campos corretos, fecha o
modal e reabre a ficha já mostrando "✍️ Assinado"; impressão testada
interceptando `window.open` — HTML gerado tem título/número/cliente/avaria/
imagem da assinatura quando assinado, e a linha em branco quando não.
**Achado, não é bug**: um erro "Failed to load resource: 400" aparece no
console — reproduzido também numa página recém-carregada, SEM nenhuma
interação minha, então é ruído de boot pré-existente (mesma categoria do
"unknown error... fetching the script" já documentado como artefato de
sandbox), não relacionado a este módulo.

sw.js: fluxa-v169 → fluxa-v170.

**Fase 1 completa** (1a+1b+1c). Próximo: Fase 2 (estados + quadro visual).

### ✅ Fase 2 — estados e quadro visual (17/08, `migracao-oficina-fase2.sql`)

Tabela `oficina_status_log` nova (log de transição, 1 linha por evento —
base pro tempo médio por status da Fase 5). Aplicada e verificada em
produção.

- **Máquina de estados** — `OFICINA_STATUS_SEQ` (recebido → diagnostico →
  aguardando_aprovacao → aguardando_peca → em_reparo → pronto → entregue),
  `cancelado` como saída lateral fora da sequência (sem "próximo"). Ponto
  único de mutação: `_ofAplicarStatus(reparoId, novoStatus, extra)` — grava
  no reparo, registra no log (`_ofRegistrarStatusLog`), sincroniza, e
  **re-renderiza a ficha automaticamente se estiver aberta** (fecha e reabre
  — sem isso o usuário via o kanban mudar mas a ficha aberta ficava com o
  status antigo).
- **Confirmado, não é kanban de verdade com drag-and-drop** — decisão já
  registrada no plano: não existe NENHUM precedente de drag-and-drop no
  código inteiro (grep exaustivo numa sessão anterior), e o padrão mobile
  mais próximo (`.vis-status-btn` da Vistoria) já é por toque/botão. `render
  OficinaKanban()` é um board de colunas com scroll horizontal; avançar 1
  etapa é o botão "Avançar →" no card; pular pra um status específico
  (inclusive voltar, ou pular "aguardando_peca") ou cancelar é o `<select>`
  "Mudar status" dentro da ficha — mais flexível que forçar tudo pelo card.
- **Cancelamento exige motivo** — `window.prompt()` é proibido neste app,
  então é um mini-modal próprio (`abrirModalCancelarOficina`/
  `confirmarCancelarOficina`, mesmo padrão minimalista do modal de
  assinatura) com textarea, bloqueia confirmar em branco.
- **`_ofDiasNoStatus(o)`** — dias desde a ÚLTIMA transição PRA aquele
  status (não desde a criação do reparo) — é o que aponta gargalo de etapa
  específica. Sem log ainda pro status atual (reparo criado antes desta
  fase, ou nunca transicionou), cai pra `data_criacao` como aproximação.
- Filtros de busca (cliente/número) e origem, client-side sobre a lista já
  carregada — sem query nova.
- `renderOficinaLista()` (Fase 1a, tabela plana) foi **removida**, não só
  substituída — confirmado por grep que nada mais chamava ela.

Testado no Browser pane (offline, mesma disciplina de sempre): 3 reparos
sintéticos em 3 colunas diferentes, dias-no-status calculado certo (3d pra
um criado há 3 dias); avançar status grava no reparo E no log, kanban
re-renderiza sozinho; cancelar sem motivo bloqueia com toast, com motivo
aplica e fecha o modal; filtro de busca e de origem isolam só o item certo;
select "Mudar status" da ficha lista as 8 opções corretas. Sem erros novos
no console, sem chamada a `*.supabase.co`.

sw.js: fluxa-v170 → fluxa-v171.

Próximo: Fase 3 (orçamento de conserto + aprovação via portal).

### ✅ Fase 3 — orçamento de conserto + aprovação via portal (17/08, `migracao-oficina-fase3.sql`)

`orcamentos.oficina_reparo_id text` (aditiva, aplicada e verificada). **Decisão
de arquitetura confirmada**: reusa `orcamentos` inteira, não cria
`orcamentos_oficina` — a tabela já traz numeração, assinatura com hash
anti-adulteração, aprovação/recusa e, principalmente, integração PRONTA com
o Portal do Cliente. Recriar isso numa tabela separada seria o trabalho mais
caro do módulo inteiro pra reproduzir comportamento idêntico. A decisão de
"tabela nova" do Marcos (Fase 1) foi sobre o TICKET de reparo — não sobre
orçamento, cujo ciclo de vida é o mesmo entre campo e oficina. A mera
presença de `oficina_reparo_id` já discrimina "isto é orçamento de
conserto", sem coluna `origem`/`tipo` nova (mesmo espírito de
`ordens_servico.orcamento_id`).

- `criarOrcamentoDaOficina(reparoId)` — chama `novoOrc()` existente,
  pré-preenche cliente (nome + `_orcClienteSelecionado` com o `cliente_id`
  real), campo oculto `orc-oficina-reparo-id` (novo em `index.html`, dentro
  do card Serviços) e nota interna citando o `OF-#####`. Campo flui por
  `coletarForm()` → os 2 `camposBase` (`salvarApenas`/`gerarPDF`) → grava
  como `oficina_reparo_id` no orçamento. Resetado em `_limparCamposOrc()`
  (senão o próximo "novo orçamento" herdaria o vínculo por engano).
- `_ofOrcamentoVinculado(reparoId)` — acha o orçamento mais recente vinculado
  em `todosOrc`. Ficha (`_ofFichaOrcamentoHtml`) mostra `+ Gerar orçamento`
  quando não existe ainda, ou número/valor/status quando existe.
- **Hook defensivo** no fim de `aprovarOrcPortal`/`_recusarOrcPortalConfirmado`
  (as duas funções do PORTAL PÚBLICO — não a aprovação interna do gestor via
  Histórico/`mudarSt`, decisão deliberada do plano pra não tocar código
  mais sensível e compartilhado): `if(oAtual.oficina_reparo_id) await
  _ofSincronizarStatusPosOrcamento(...)`. Aprovado → avança o reparo pra
  `em_reparo`, mas **só se ainda estiver antes do ponto de decisão**
  (`recebido`/`diagnostico`/`aguardando_aprovacao`) — não regride um reparo
  que já esteja mais adiante (ex.: já `pronto`) por algum caminho manual.
  Recusado → volta pra `diagnostico`, só se estava `aguardando_aprovacao`.
  Orçamento de campo (sem `oficina_reparo_id`) nunca entra nesse `if` —
  comportamento idêntico ao de sempre, zero efeito colateral.
- Portal: `oficina_reparo_id` entrou na lista explícita de colunas do
  `.select()` de orçamentos (`renderPortal`, ~`app.js:8647`) — **não é RPC**
  (correção a uma suposição errada do plano inicial: este repo faz `.select()`
  client-side com lista de colunas, não uma função `portal_dados` no banco).
  Card do portal ganha tag "🔧 Conserto" quando o campo existe.

**Gap conhecido, aceito de propósito**: se o GESTOR aprovar manualmente pela
tela de Histórico (`mudarSt`) em vez do cliente aprovar pelo portal, o
reparo NÃO avança sozinho — fica só no `_ofAplicarStatus` manual via "Mudar
status" na ficha. O fluxo esperado do negócio é o cliente aprovar pelo
portal (mesmo padrão de orçamento de campo); cobrir o caminho interno
também exigiria tocar `_mudarStProsseguir`, código muito mais sensível e
compartilhado com todo o resto do app — não valeu o risco nesta rodada.

Testado no Browser pane (offline): `criarOrcamentoDaOficina` pré-preenche
tudo certo e fecha a ficha; salvar o orçamento persiste `oficina_reparo_id`
através de todo o `coletarForm`→`salvarApenas`; ficha reflete o orçamento
vinculado (número/valor/status); aprovar avança o reparo pra `em_reparo` E
registra no log; **reparo já `pronto` não regride** ao aprovar (guarda
testada explicitamente); orçamento de campo comum (sem vínculo) aprovado
sem nenhum efeito colateral novo; recusar volta o reparo pra `diagnostico`;
tag "🔧 Conserto" aparece só no card certo. Sem erros novos, sem chamada a
`*.supabase.co`.

sw.js: fluxa-v171 → fluxa-v172.

Próximo: Fase 4 (garantia de fabricante + retrabalho).

### ✅ Fase 4 — garantia de fabricante (rastreio) + retrabalho (17/08, `migracao-oficina-fase4.sql`)

6 colunas aditivas em `oficina_reparos`: `fabricante`/`fabricante_protocolo`/
`fabricante_nf` (texto livre — decisão do Marcos é só rastreio, sem cobrança
formal do fabricante) e `retrabalho_de`/`garantia_propria_meses`/
`garantia_propria_vencimento` (garantia PRÓPRIA da oficina — diferente da de
fabricante: é o compromisso da oficina com o serviço que ela mesma fez).
Aplicada e verificada em produção.

- **Campos de fabricante condicionais** — `#of-campos-fabricante` só aparece
  quando origem = "Garantia de fabricante" (`_ofToggleCamposFabricante`,
  `onchange` no select). Só grava os 3 campos quando a origem é essa (senão
  `null` — não faz sentido guardar protocolo de fabricante num item de
  balcão).
- **Sugestão de retrabalho, não-bloqueante** — mesmo espírito da sugestão de
  cliente duplicado que já existe no resto do app. Ao selecionar um
  equipamento na recepção (`_ofVerificarRetrabalho`, chamado de dentro de
  `selecionarEqModal`), busca reparo anterior do MESMO `equipamento_id`,
  `status='entregue'`, com `garantia_propria_vencimento` ainda válida.
  Achando, mostra um card com botão "Vincular como retrabalho de OF-XXXXX"
  (`_ofVincularRetrabalho`) — só um clique, nunca força. Trocar de
  equipamento invalida a sugestão anterior (mesma disciplina da Fase 1a pra
  troca de cliente invalidando equipamento).
- **Garantia própria calculada ao entregar** — dentro de `_ofAplicarStatus`,
  quando `novoStatus==='entregue'`: `_ofCalcVencGarantiaPropria(data_entrega,
  garantia_propria_meses||3)`, mesmo padrão de `calcVencGarantia()` já usado
  em `equipamentos`. Sem UI pra editar os meses por reparo nesta rodada —
  default 3, YAGNI até aparecer necessidade real de variar.
- **`_ofTaxaRetrabalho(periodoDias)`** — `retrabalhos/total` sobre reparos
  `entregue` (com `periodoDias=null` = todo o histórico) — client-side sobre
  `todosOficinaReparos` já carregado, sem query nova. Função pronta, mas o
  **local de exibição é a Fase 5** (métricas), que ainda não foi construída
  — cálculo e exibição propositalmente em fases separadas.
- Badges novos no card do kanban (`_ofCardKanban`): 🏭 Fabricante /
  🔁 Retrabalho, dado que já existe desde a Fase 1/este commit, só exibição.
  Ficha ganhou `_ofFichaFabricanteHtml`/`_ofFichaRetrabalhoHtml`.

Testado no Browser pane (offline): toggle dos campos de fabricante ao trocar
origem; os 3 campos persistem só quando origem é garantia_fabricante;
badge 🏭 no kanban + campos na ficha; ciclo completo até "entregue" calcula
`garantia_propria_vencimento` certo (entrega + 3 meses, testado com data
real); nova recepção do MESMO equipamento dentro da garantia mostra a
sugestão de retrabalho; vincular grava `retrabalho_de` correto no novo
reparo; `_ofTaxaRetrabalho` testada isolada com dado sintético controlado
(3 entregues, 1 retrabalho → 33%). Sem erros novos, sem chamada a
`*.supabase.co`.

sw.js: fluxa-v172 → fluxa-v173.

Próximo: Fase 5 (métricas + etiqueta física/QR) — fecha o roadmap original.

### ✅ Fase 5 — métricas + etiqueta física/QR (17/08) — FECHA O ROADMAP ORIGINAL

Sem tabela nova — usa `oficina_reparos` + `oficina_status_log` (Fase 2) já
existentes, exatamente como o plano previu.

- **`renderOficinaMetricas()`** — card no topo de `#page-oficina` (antes da
  lista/board), 3 números: tempo médio de reparo (`data_entrega −
  data_criacao` sobre os `entregue`), equipamentos parados
  (`OFICINA_PARADO_DIAS=7`, status não-terminal há 7+ dias via
  `_ofDiasNoStatus` já existente da Fase 2, com lista dos 5 primeiros
  clicável), retrabalho nos últimos 90 dias (`_ofTaxaRetrabalho(90)`,
  função já pronta desde a Fase 4 — só a exibição faltava). Chamada junto
  com `renderOficinaKanban()` em `loadOficinaReparos()` e em
  `_ofAplicarStatus()` — atualiza sozinha a cada mudança de status.
- **Etiqueta/QR** (`verQROficina`/`fecharQROficina`/`imprimirQROficina`/
  `checkOfHash`) — **clone estrutural** de `verQR`/`fecharQR`/`imprimirQR`/
  `checkQRHash` (equipamentos), com modal (`#qr-of-modal-bg`) e hash
  (`#of/<id>`) PRÓPRIOS — decisão deliberada de não reusar o modal/funções
  de equipamento (que já estão em produção) para zero risco de regressão
  ali. `checkOfHash()` chamada no boot logo depois de `checkQRHash()`
  (`app.js:~1203`) — link/QR abre direto na ficha do reparo.
  Botão 🏷️ novo no cabeçalho da ficha (`abrirFichaOficina`).

Testado no Browser pane (offline, mesma disciplina de sempre): os 3 números
calculados certos com dado sintético controlado (8.0 dias de ciclo; 1 item
parado há 9 dias corretamente listado, outro criado há 1 dia corretamente
NÃO listado; 0% de retrabalho com 0 de 1 entregue); modal de QR abre com
nome/info/URL corretos (`#of/ofr_1` codificado na URL do QR), fecha limpo;
impressão gera HTML com número e cliente corretos (`window.open`
interceptado); `checkOfHash()` com `#of/ofr_2` na URL limpa o hash, navega
pra `oficina` e abre a ficha certa sozinho. Sem erros novos no console, sem
chamada a `*.supabase.co`.

sw.js: fluxa-v173 → fluxa-v174.

---

## 🔧 MÓDULO OFICINA — status final das 5 fases (17/08)

**Todas as 5 fases do roadmap original estão em produção**: recepção e
ficha de entrada (1a/1b/1c) → estados e quadro visual (2) → orçamento de
conserto + aprovação via portal (3) → garantia de fabricante + retrabalho
(4) → métricas + etiqueta física (5). 6 arquivos de migração
(`migracao-oficina-fase1.sql` a `fase4.sql`, mais a coluna em `orcamentos`
na fase 3) aplicados e verificados em produção via Management API.

**O que ficou de propósito fora desta rodada** (não são bugs, são escopo
deliberadamente cortado — ver os commits de cada fase pros detalhes):
- Drag-and-drop no quadro (desktop) — nenhum precedente no código, avançar
  é por botão/select.
- Cobrança/recebimento formal do fabricante — só rastreio (`fabricante`/
  `fabricante_protocolo`/`fabricante_nf` texto livre), decisão do Marcos.
- Aprovação manual do gestor (Histórico) não avança o reparo sozinho — só
  a aprovação pelo Portal do Cliente aciona `_ofSincronizarStatusPosOrcamento`
  (decisão deliberada de não tocar `_mudarStProsseguir`, código mais
  sensível e compartilhado). Gestor sempre pode avançar manualmente pelo
  "Mudar status" na ficha.
- UI pra editar `garantia_propria_meses` por reparo (default 3, fixo).
- Multi-loja ativo (campo `loja_id` existe em tudo, nullable, pronto pra
  ligar quando fizer sentido).

**Próximos passos possíveis, não implementados** (fica registrado pra
quem continuar): drag-and-drop de verdade no board desktop; tela de
relatório/exportação das métricas; se um dia a cobrança de fabricante virar
real, uma tabela própria de "a receber de fornecedor" (schema hoje é só
texto livre, não dá pra evoluir só com ALTER — precisaria de tabela nova);
impressora térmica de etiqueta de verdade (hoje é QR em papel A4 normal,
mesmo padrão de equipamentos).

### 🔴 Achado no teste ponta a ponta com clique real (17/08), corrigido

Todo o desenvolvimento das 5 fases foi testado via `javascript_exec`
(chamar as funções direto pelo console) — rápido, mas não prova que o
CLIQUE de verdade na UI funciona igual. Depois de tudo no ar, rodei uma
segunda passada clicando de verdade (mouse, `left_click`/`left_click_drag`
pra desenhar a assinatura de verdade) do início ao fim: recepção → busca
de cliente → busca de equipamento → marcar avaria → assinar termo →
gerar orçamento → salvar → voltar pra ficha → **abrir a etiqueta/QR**.

**Achei 1 bug real nesse último passo**: o modal de QR (`#qr-of-modal-bg`)
tecnicamente abria (`classList` tinha `.on`, `display:flex` computado),
mas ficava **invisível atrás da ficha**. Causa: a ficha
(`#of-ficha-overlay`) é criada dinamicamente e vai pro **fim do
`<body>`** via `appendChild` — nessa posição ela empilha por cima de
qualquer elemento com o mesmo z-index (900) que estiver mais acima na
árvore estática do HTML, que é onde `#qr-of-modal-bg` sempre morou. O
botão 🏷️ que abre o QR fica DENTRO da própria ficha — então, na prática,
o QR nunca aparecia (mesmo problema de empilhamento que o modal de
assinatura já resolve há tempos com um z-index 1100 fixo — só que o
modal de QR nunca tinha essa necessidade até o botão 🏷️ entrar dentro
de outro modal).

**Fix** (`verQROficina`): move o modal pro fim do `<body>` via
`appendChild` no momento de abrir, em vez de confiar num z-index fixo —
mais robusto, garante que fica por cima de qualquer modal aberto antes,
sem precisar manter um número mágico sincronizado.

**Todo o resto do fluxo, testado com clique de mouse de verdade, funcionou
sem nenhum outro problema**: busca de cliente auto-filtra corretamente,
busca de equipamento já vem filtrada pelo cliente selecionado, marcar
avaria mostra o campo de descrição na hora (feedback visual imediato),
assinatura desenhada com `left_click_drag` registra e confirma
corretamente (toast + ficha reabre mostrando "✍️ Assinado"), "Gerar
orçamento" navega pra tela de orçamento com cliente/origem/nota já
preenchidos e o toast de vínculo aparece, salvar o orçamento por
"Salvar rascunho" (fluxo real, não atalho) persiste `oficina_reparo_id`
corretamente (confirmado reabrindo a ficha depois), select de "Mudar
status" reflete no board na hora.

sw.js: fluxa-v174 → fluxa-v175.

**Lição pro processo**: daqui pra frente, qualquer módulo com múltiplos
modais/overlays abertos um-dentro-do-outro merece pelo menos um teste de
clique real (não só via console) antes de dar por pronto — esse tipo de
bug de empilhamento não aparece em nenhuma checagem de estado/retorno de
função, só é visível olhando a tela de verdade.

### ✅ Teste completo de aprovação real + Histórico com número em destaque (17/08)

Depois do teste de clique inicial, o Marcos pediu pra ver "os próximos
passos como se tivesse aprovado" — segui o mesmo reparo de teste pelo
Portal do Cliente de verdade (não atalho): clicou "Aprovar", desenhou a
assinatura, confirmou. **O reparo avançou sozinho** de "Em diagnóstico"
pra "Em reparo" — o hook da Fase 3 disparando pelo caminho real do
cliente, não só por chamada de função. Segui clicando "Avançar" até
"Entregue", assinei o termo de retirada, e confirmei a garantia própria
calculada certa ("Válida até 18/11/2026") e as métricas atualizando
(tempo médio, retrabalho 0%) — tudo consistente, sem achado novo nessa
parte.

Na sequência o Marcos perguntou por um lugar pra acompanhar o histórico
("o que já foi feito"), revisar dados de equipamento/observações, e
destacou que **o número do reparo precisa estar bem visível**. Perguntei
pra confirmar o que ele queria dizer (podia ser: número em destaque numa
lista, OU vínculo com o número da OS de campo de origem, OU os dois) —
ele confirmou: número em destaque numa lista/histórico.

- **Toggle "Quadro" / "Histórico"** (`_ofSetView`/`_ofRenderAtiva`) dentro
  da própria página `#page-oficina` — mesmos dados, duas formas de olhar.
  O quadro (kanban) já existia desde a Fase 2; `renderOficinaHistorico()`
  é novo: tabela (`.rd-table`, mesmo padrão de `renderOSTabela`) com
  **Número em destaque como primeira coluna** (célula em negrito,
  `OF-#####`), Cliente, Equipamento, Observação (truncada com `title` pro
  texto completo), Situação (badge) e Data — ordenada por mais recente
  primeiro. Clicar na linha abre a mesma ficha do kanban
  (`abrirFichaOficina`, reuso direto).
- Os filtros de busca/origem (já existentes desde a Fase 2) agora
  alimentam as DUAS visões — `_ofFiltrarBusca`/`_ofFiltrarOrigem` chamam
  `_ofRenderAtiva()` em vez de `renderOficinaKanban()` direto, e o mesmo
  vale pra `loadOficinaReparos()`/`_ofAplicarStatus()` — sempre
  re-renderiza a visão que estiver ativa no momento, não força de volta
  pro quadro.

Testado no Browser pane (offline, clique real): alternar as abas troca a
tabela/quadro visualmente e mantém o filtro ativo entre as duas; busca
por "Cliente B" isola a linha certa no histórico; clicar na linha abre a
ficha com todos os dados batendo (status, equipamento, origem,
observação completa); voltar pro quadro depois do histórico funciona sem
erro. Sem chamada a `*.supabase.co`.

sw.js: fluxa-v175 → fluxa-v176.

### 📝 Ajuste de nome: "Nova Recepção" → "Dar Entrada" (18/08)

Feedback do Marcos: *"na parte de oficina não vi muito sentido em chamar de
nova recepção a entrada do equipamento"*. Ele tem razão — "recepção" é
terminologia de hotel/hospital; "dar entrada" é como o próprio dono de
oficina de reparo fala do dia a dia (dar entrada num aparelho, protocolo de
entrada).

**Só texto visível ao usuário mudou, nenhum identificador interno:**
- Botão principal e botão de estado vazio: "+ Nova Recepção" → "+ Dar Entrada"
- Topbar da tela cheia: "Nova Recepção — Oficina" → "Dar Entrada — Oficina"
- Botão "Sair da recepção" → "Sair" (mais curto, o contexto já está claro na tela)
- Botão de salvar: "💾 Registrar recepção" → "💾 Registrar entrada"
- Item de checklist: "Liga ao testar na recepção" → "Liga ao testar na entrada"
- Comentários internos do código (não visíveis ao usuário), por consistência

**Deliberadamente NÃO renomeado** (risco desnecessário pra uma troca de
texto): o id da página (`#page-oficina-recepcao`), os nomes das funções
(`abrirOficinaRecepcao`/`fecharOficinaRecepcao`/`_ofRecepcaoAbrir`), e o
código de auditoria (`logAcao('oficina_recepcao', ...)`) — mudar qualquer um
desses é refactor de identificador, não ajuste de copy, e não muda nada que
o usuário vê.

Testado no Browser pane (offline, clique real): board → "+ Dar Entrada" →
tela de entrada abre com os textos novos → "Sair" volta pro board → estado
vazio mostra "+ Dar Entrada" corretamente. Sem erro novo no console, sem
chamada a `*.supabase.co`.

sw.js: fluxa-v176 → fluxa-v177.

### 🔧 Feedback do Marcos sobre a Recepção — 3 pontos, 1 resolvido (18/08)

O Marcos testou o formulário de entrada e trouxe 3 observações no mesmo
áudio. Investiguei cada uma no código real antes de agir — 1 já estava
resolvida (só precisava confirmar), 1 era um gap real e corrigido, 1 é
decisão de produto e ficou registrada como pergunta em aberto.

**1. Cliente — já integra com a base toda, confirmado (nenhuma mudança).**
`abrirBuscaEq()`/busca de cliente na Oficina usa o mesmo `abrirBuscaCli('of')`
→ `filtrarListaCli()` que Orçamento/OS/Vistoria já usam — lê `lsCliLer()`,
a base completa de clientes sincronizada. Confirmado com clique real no
Browser pane: busquei "Cliente Potência Teste" e o cliente cadastrado
apareceu na lista, igual qualquer outro módulo.

**2. Equipamento — faltava o campo "Potência", corrigido
(`migracao-oficina-fase6.sql`, já aplicada e verificada no banco).** O
Marcos está certo: equipamento que chega na oficina normalmente não está
cadastrado (qualquer marca/modelo/potência) — por isso o cadastro é
inline, na hora, dentro do próprio modal de busca (`_ofCadastrarEquipamentoInline`,
desde a Fase 1b). Mas esse formulário inline tinha só
tipo/marca/modelo/número de série — faltava **potência**, que é justamente
o dado que mais ajuda a diferenciar (ex.: duas motobombas Dancor do mesmo
cliente, só a potência distingue qual é qual). O campo já existia no
cadastro GERAL de Equipamentos (`eq-potencia`, tela própria) — só não tinha
sido levado pro atalho de dentro da oficina.

- `index.html`: campo "Potência" novo no `#of-novo-eq-form`.
- `app.js`: `_ofCadastrarEquipamentoInline()` grava `potencia` no
  equipamento; `oficina_reparos` ganhou coluna `eq_potencia` (snapshot,
  mesmo padrão de `eq_marca`/`eq_modelo` — grava o estado do equipamento
  NA ENTRADA, não muda se o cadastro geral for editado depois). Aparece em
  TODOS os pontos que já mostravam marca/modelo: resumo na própria tela de
  entrada (`of-eq-nome`), busca de equipamento (`filtrarListaEq`), card do
  kanban, ficha do reparo, termo de entrada/retirada impresso.
- `migracao-oficina-fase6.sql` — `ALTER TABLE oficina_reparos ADD COLUMN
  IF NOT EXISTS eq_potencia text;`, 100% aditiva, aplicada via Management
  API e confirmada (`information_schema.columns`).

Testado no Browser pane (offline, clique real, ciclo completo): busquei
cliente real → cadastrei equipamento novo inline com potência "1/2 CV" →
resumo na tela mostrou "Motobomba · Dancor · CAM-W1 · 1/2 CV" → registrei
a entrada → abri a ficha → potência aparece certa no card do kanban
("Motobomba · Dancor · 1/2 CV") e na ficha completa. Sem chamada a
`*.supabase.co`, sem erro novo no console.

**3. Estado de chegada — checklist fixo não servia pra todo tipo de
equipamento. RESOLVIDO — Marcos escolheu "checklist varia por tipo" entre
3 opções (perguntado via AskUserQuestion), implementado e testado.**

Estrutura nova: `OFICINA_CHECKLIST_BASE` (3 itens universais — carcaça,
cabo/plugue, acessórios — aplicam a qualquer equipamento elétrico) +
`OFICINA_CHECKLIST_POR_TIPO` (1-2 itens extras específicos, mapeados pelos
9 tipos que já existem no `<select>` de Equipamentos — Motobomba/Filtro/
Trocador de Calor/Gerador de Cloro/LED Subaquático/Spa-Hidro/Sauna/
Automação/Outro). Função única `_ofChecklistParaTipo(tipo)` monta a lista
combinada (fallback pra 'Outro' se o tipo não bater) — usada tanto pra
RENDERIZAR o formulário (`renderOfChecklist()`, com o tipo do equipamento
selecionado) quanto pra DECODIFICAR avarias de um reparo já salvo
(`_ofFichaAvariasHtml`/`imprimirTermoOficina`, com `o.eq_tipo` — sem essa
função única, a ficha de um reparo antigo mostraria o item errado se os
itens por tipo mudassem no futuro).

Primeira versão dos itens por tipo (documentado como ponto de partida, não
definitivo — ajustar conforme a prática real da oficina for mostrando o
que vale a pena checar):
- Motobomba: liga ao testar, rotor gira livre, sem vazamento na vedação
- Filtro: registro/válvula funciona, vaso sem rachadura
- Trocador de Calor: liga ao testar, sem vazamento na serpentina
- Gerador de Cloro: liga ao testar, célula eletrolítica presente
- LED Subaquático: liga ao testar, vedação/nicho íntegro
- Spa/Hidro: liga ao testar, bicos/jatos presentes
- Sauna: liga ao testar (resistência), termostato/sensor presente
- Automação: liga ao testar, placa/display sem sinal de queima
- Outro: liga ao testar (fallback genérico, igual ao checklist antigo)

`selecionarEqModal()` agora zera `_ofEstadoEntrada={}` e chama
`renderOfChecklist()` de novo ao trocar de equipamento — sem isso, trocar
de equipamento no meio do preenchimento vazaria respostas de um checklist
de tipo diferente pro envio final.

Testado no Browser pane (offline, clique real): tela em branco (sem
equipamento ainda) mostra o checklist genérico ("Outro"); cadastrei
equipamento novo tipo "Sauna" → checklist trocou na hora pra "Liga ao
testar (resistência)" + "Termostato/sensor presente" (sumiu o "Liga ao
testar na entrada" genérico); marquei "Termostato" como avaria com
observação → registrei a entrada → abri a ficha → avaria decodificada
certa: "Termostato / sensor presente: Sensor não acende luz piloto". Sem
chamada a `*.supabase.co`, sem erro novo no console (só o ruído conhecido
do sandbox).

sw.js: fluxa-v178 → fluxa-v179.

### 🔗 Vínculo real Oficina ↔ OS de campo (Fase 7, 18/08)

O Marcos perguntou explicitamente se a Oficina "integra com o sistema de
OS". Investiguei antes de responder: a origem "Trazido de uma OS de campo"
já existia no `<select>` desde a Fase 1, e `os_campo_id` já existia como
coluna no banco — mas nada ligava os dois de verdade. Escolher essa
origem só gravava um rótulo de texto solto, sem campo pra apontar QUAL
OS, sem link clicável, sem nenhum atalho do lado da tela de OS. Reportei
o gap e perguntei como ele imaginava o vínculo funcionando — ele escolheu
os DOIS caminhos propostos (não são excludentes), implementados e
testados nesta rodada:

**1. Botão "🔧 Enviar pra Oficina" dentro da própria OS de campo.**
`_renderOSAcoesEdit(o)` ganhou o botão (visível pra qualquer OS não
cancelada, técnico ou gestor — mesma barra de PDF/Concluir/Excluir).
`_ofEnviarDeOS(osId)`: abre a Recepção (`abrirOficinaRecepcao()`, que já
reseta o form via `_ofRecepcaoAbrir()` — chamada síncrona dentro de
`go()`, então o pré-preenchimento roda por cima, depois, sem corrida),
seta a origem pra "os_campo", grava o vínculo em `_ofOSCampoVinculada`, e
pré-preenche cliente (`_ofClienteSelecionado`) a partir de
`o.cliente_id`/`o.cliente` — só quando a OS tem `cliente_id` real (nem
toda OS tem, se o nome foi digitado livre sem passar pela busca; nesse
caso avisa por toast pra buscar manualmente). **Não pré-preenche
equipamento** — `ordens_servico` não tem coluna de equipamento vinculado
(confirmado: `select column_name from information_schema.columns where
table_name='ordens_servico' and column_name ilike '%equip%'` → vazio), só
a piscina como um todo. Fica pro atendente escolher/cadastrar o
equipamento específico na hora, igual ao fluxo normal.

**2. Busca de OS na própria tela de Dar Entrada**, pro caso em que o
atendente de balcão sabe que o cliente teve uma visita recente mas não
veio direto de lá. Bloco novo `#of-campos-os-campo` (mesmo padrão do
bloco de fabricante, aparece só quando origem='os_campo') com botão
"🔍 Buscar" → modal `#modal-busca-os-campo` → `abrirBuscaOSCampo()` lista
as OS do cliente JÁ selecionado (`_osListaParaVinculo(clienteId)`, une
`todosOS` + `window._minhasOSAll` por id, filtra por `cliente_id`) →
`selecionarOSCampoModal(id)` grava o vínculo. Os dois caminhos convergem
no mesmo `_ofOSCampoVinculada`, lido por `salvarOficinaRecepcao()` no
momento de gravar (`os_campo_id: gV('of-origem')==='os_campo' ?
(_ofOSCampoVinculada||null) : null`).

**Do lado da ficha do reparo**: `_ofFichaOSCampoHtml(o)` mostra o número/
data da OS vinculada com um botão "Abrir OS" (`_ofAbrirOSVinculada`, fecha
a ficha da oficina e chama `editarOS()` — sem isso ficaria ficha
sobreposta em cima da tela de OS). Badge "📋 De OS" novo no card do
kanban, ao lado dos já existentes ("🏭 Fabricante"/"🔁 Retrabalho").

Testado no Browser pane (offline, clique real, ciclo completo pelos DOIS
caminhos): (a) OS de teste #077 → cliquei "Enviar pra Oficina" → cliente e
OS pré-preenchidos automaticamente (toast confirmando) → cadastrei
equipamento → registrei a entrada → `os_campo_id` gravado certo → ficha
mostra "OS de campo vinculada: #077 · 10/08/2026" com botão "Abrir OS" →
cliquei e voltou pra tela de Editar OS #077 corretamente (ficha da
oficina fechada, sem sobreposição); (b) partindo do zero na Recepção,
escolhi cliente → origem "Trazido de uma OS de campo" → busquei e
selecionei a mesma OS #077 pelo modal → vínculo confirmado. Sem chamada
a `*.supabase.co` nos dois testes (só `libs/supabase.min.js` local); os
vários `ERR_CONNECTION_REFUSED` no console eram só o próprio mecanismo de
auto-update do app (`HEAD /?_v=...` periódico) batendo no servidor de
teste local durante os reinícios que fiz entre uma rodada e outra — não
tem relação com o código, confirmado lendo a lista de requests.

sw.js: fluxa-v179 → fluxa-v180.

### 📝 Campo "Diagnóstico" (Fase 8, 18/08) — resolve o gap registrado acima

Marcos pediu pra resolver logo em seguida. `diagnostico` (text) existia no
banco desde a Fase 1 mas nunca teve onde ser escrito.

`_ofFichaDiagnosticoHtml(o)` — textarea editável na ficha (não trava por
status; o técnico pode complementar o laudo a qualquer momento, mesmo
depois de já ter avançado o reparo), id fixo `#of-ficha-diagnostico`
(seguro porque só uma ficha fica aberta por vez no DOM, mesmo raciocínio
de `#of-ficha-overlay`). `salvarOficinaDiagnostico(reparoId)` — local-first
(`todosOficinaReparos` + `lsOfSalvar`) + `dbUpdate` quando online, toast de
confirmação. Inserido na ficha entre "Observação na entrada" e "Orçamento
de conserto" — ordem cronológica real (entrada → diagnóstico → orçamento).

**Ganho extra de usabilidade, não pedido mas de baixo risco**:
`criarOrcamentoDaOficina()` agora inclui o diagnóstico na `nota-interna`
pré-preenchida do orçamento gerado (`Orçamento de conserto — OF-XXXXX` +
`\nDiagnóstico: ...` quando existe) — quem for montar os serviços do
orçamento já vê o laudo sem precisar voltar na ficha da oficina.

Testado no Browser pane (offline, clique real): abri a ficha de um reparo
mock → escrevi o diagnóstico → salvei (toast confirmando) → fechei e
reabri a ficha → texto persistiu no textarea → cliquei "Gerar orçamento" →
`nota-interna` já veio com "Orçamento de conserto — OF-00088\nDiagnóstico:
...". Sem chamada a `*.supabase.co`, sem erro novo no console.

sw.js: fluxa-v180 → fluxa-v181.

---

## Auditoria do fluxo orçamento → OS → conclusão, a pedido do Marcos (17/08)

Marcos pediu pra percorrer a trajetória inteira (orçamento → aprovação →
OS → técnico preenche → conclui) e achar informação se perdendo no meio do
caminho. Investigação por leitura de código + simulação isolada no
navegador (nunca contra o banco real — ver incidente abaixo).

**Esclarecido pro Marcos (não era bug):** desde a migração "APROVAR = SAIR
DO ESTOQUE" (2026-08-07, `b66eb92` — ver seção mais abaixo), tanto o
estoque quanto o faturamento do dashboard já saem/contam no momento da
**aprovação** do orçamento, não na conclusão da OS. A OS virou uma
ferramenta 100% operacional (agendar, executar, registrar o que foi
feito) — concluí-la não libera mais estoque nem gera faturamento, porque
os dois já aconteceram antes. Isso explica a expectativa de "deveria
liberar ao concluir".

**Achado real, corrigido — atalho "✅ Concluir" perdia informação
(commit pendente).** `renderMinhasOS()` mostra um botão de conclusão em 1
toque em cada card de OS (pensado pra OS sem nada a registrar). Só que
ele chama `concluirOSHistorico()`, que grava **só o status** — sem
check-in/check-out, sem `obs_tecnica`, sem `materiais`, sem `fotos`.
Comparado com o fluxo certo (check-in → preenche → check-out, que grava
tudo isso), um técnico apressado que usa o atalho na lista sem nunca
abrir a OS marca o serviço como pronto sem nenhum registro do que foi
feito ali. **Fix:** antes de confirmar, `concluirOSHistorico()` agora
checa se a OS está vazia (sem obs/materiais/fotos) e troca a mensagem de
confirmação por um aviso explícito — não bloqueia (o atalho continua
válido pra OS que realmente não tem nada a anotar), só avisa com
resolução em 1 clique, mesmo padrão do aviso de "item sem vínculo de
estoque" em `mudarSt()`.

**Achado real, corrigido — sem caminho de volta ao Histórico depois de
concluir.** Nem o check-out do formulário (`_fazerCheckoutConfirmado`)
nem o atalho de 1 toque ofereciam algo depois de concluir — só o toast de
sucesso, sem navegação. Extraí `_toastOSConcluida(os, msgBase)` (usada
pelos dois pontos de conclusão): quando a OS tem `orcamento_id`
vinculado, o toast ganha um botão de ação "Ver orçamento" (`toast()` já
suporta `opts.acao`, mesmo padrão de "desfazer" usado em outro lugar do
app) que leva pro Histórico de Orçamentos. **Gated por perfil** — técnico
não tem `'history'` na própria lista de páginas permitidas
(`pagesTecnico`), então o botão só aparece pra gestor/master/vendas;
oferecer pra técnico levaria a um toast de "acesso não permitido" em vez
de navegar. Testado: OS vazia mostra o aviso certo, OS preenchida mostra
a mensagem normal, botão aparece só quando há orçamento vinculado E o
perfil tem acesso, clique navega pro Histórico de verdade.

⚠️ **Incidente durante o teste, resolvido:** ao simular o fluxo pela
primeira vez, usei `window.dbOk=false` pra tentar forçar modo offline —
isso NÃO tem efeito nenhum, porque `db`/`dbOk` são `let` de escopo de
script (`app.js:1036`), não propriedades de `window`; a forma certa
(já documentada mais abaixo neste arquivo) é a atribuição SEM `window.`.
Como esse ambiente de teste tem acesso real à internet, o boot do app
conectou de verdade na produção em segundo plano sem eu perceber, e um
orçamento + cliente fictícios ("Fluxo Teste Ltda", #357/#358) chegaram a
ser gravados no banco real antes de eu notar. **Verificado e apagado na
hora** (Management API, confirmado com `select` antes/depois) — nenhuma
aprovação, baixa de estoque ou reserva chegou a rodar sobre esses
registros (o próprio bug de sincronização, que fez o app perder a
referência ao registro local, impediu isso). Fica o buraco inofensivo na
numeração (#357/#358 pulados). Nos testes seguintes (helpers puros, sem
`salvarApenas`/`mudarSt`, com `confirmar()` interceptado antes do
callback) validei a correção sem nenhuma chamada de rede a
`*.supabase.co` — confirmado via `read_network_requests`.

**Achado incidental, não corrigido (fora do escopo pedido):** essa mesma
checagem revelou sobras de teste de sessões ANTERIORES ainda vivas no
banco de produção (`estoque_movimentos` com `produto_id` tipo
`prod_teste1`/`prod_teste_cache_...`, motivo "Venda balcão — Cliente
Teste QA"). Não mexi — só registrando pra uma limpeza geral futura, se o
Marcos quiser.

---

## Ocultar valores unitários no orçamento (17/08, commit `cfd6d3c`)

Pedido do Marcos: opção pra não mostrar o preço de cada item no PDF —
só a descrição do serviço e o TOTAL final, sem coluna de Valor nem
subtotal/desconto detalhados. Caso de uso: composição de custo item a
item que a empresa não quer expor pro cliente.

- Checkbox "Ocultar valores unitários no PDF" no form de orçamento
  (card Serviços, antes do bloco de totais).
- `orcamentos.ocultar_valores` (boolean, default `false`) —
  `migracao-ocultar-valores.sql`, aditiva, já aplicada em produção via
  Management API e verificada em `information_schema.columns`. Default
  `false`: nenhum orçamento existente muda de comportamento.
- `preencherDocOrc()` aceita `d.ocultarValores` (form) OU
  `d.ocultar_valores` (registro salvo do banco) — quando `true`, omite
  a coluna "Valor" do cabeçalho/linhas e o subtotal/desconto, deixa só
  o Total.
- Restaurado corretamente em `abrirOrc()` (edição); copiado do
  original em `duplicarOrc()` (mesmo padrão de desconto/pagamento/
  validade/loja); resetado em `novoOrc()`/`_limparCamposOrc()`. Os 2
  pontos que reconstroem `dadosOrc` a partir de registro salvo (print
  combinado orçamento+OS, e `verOrcPDF` de reimpressão) também
  respeitam a flag.
- Testado no Browser pane (offline, dados sintéticos): checked/
  unchecked, abrir/duplicar/reimprimir um orçamento salvo com a flag —
  todos os caminhos bateram, sem regressão no layout padrão.

## Bugs reportados pelo Marcos ao preencher OS do Dom Carlos (17/08, commit `ed02562`)

Marcos preencheu uma OS de verdade e achou 4 problemas de uma vez — os 3
primeiros eram sintomas do mesmo bug raiz, o 4º era uma limitação separada:

- **OS duplicada de verdade** (2 registros da mesma OS pro Dom Carlos) —
  causa raiz: `preencherDocOS()` chamava `esc(s)` passando o objeto de
  serviço inteiro em vez de `s.desc`, o que lançava
  `TypeError: (s||"").replace is not a function` bem no momento de
  imprimir — DEPOIS que a OS já tinha sido gravada no banco com sucesso.
  O usuário via "⚠️ Erro ao gerar OS" (falso — só a impressão falhou) e
  tentava de novo, criando o segundo registro de verdade. Corrigido o
  `esc()`, e adicionadas guardas de "já existe OS pra este orçamento?"
  nos dois pontos de criação (`criarOSjunto`/`criarOSdeAprovacao`) —
  agora avisa e pergunta antes de criar uma segunda, em vez de deixar
  acontecer em silêncio.
- **"Agendar OS" aparecendo 2x** — `_perguntarCriarOS()` não checava se
  já existia uma OS pro orçamento antes de montar o modal; agora esconde
  os campos de agendamento (mantém só "Ordem de entrega" quando aplicável)
  se já existir OS vinculada.
- **Limite de 3 fotos na OS** — `osFotos` era array fixo de 3 com 3 slots
  HTML hardcoded; convertido pro mesmo grid dinâmico de até 6 fotos que o
  orçamento já usa (`renderOSFotosSlots`/`carregarFotoOS`/`removerFotoOS`,
  espelhando `renderFotosOrcSlots` do orçamento) — com compressão de
  imagem, que o código antigo de OS não tinha.
- **Fluxo "aprovar → concluir"**: esclarecido pro Marcos (não era bug) —
  "concluir" é um estado da OS (check-in/check-out,
  `_fazerCheckoutConfirmado`), não do orçamento. Orçamento não tem status
  "concluído"; ele vira "aprovado" e a OS vinculada é quem é concluída.
- OS órfã duplicada (#190) do Dom Carlos apagada do banco, confirmado
  antes que #191 (não #190) tinha as fotos/dados reais do atendimento.

---

## Tarefa 3e.3 — Venda Rápida vira balcão (15/08) — fecha o plano de ajustes (3e)

Última das 3 subtarefas do handoff `design_handoff_fluxa_redesign 4/`.
**Decisão do Marcos antes de codar** (perguntada explicitamente, como o
plano pedia): venda de balcão **dá baixa real no estoque E entra no
faturamento do mês** — conta como qualquer orçamento aprovado no KPI
"Fechado no mês" e no gráfico "Aprovado por mês" do Insights, e nas
Movimentações do Estoque (isso já acontecia via `registrarMovimento`).

**Era modal (`#venda-modal`), virou página cheia (`#page-venda-balcao`)**
— sem sidebar/header/nav inferior: "cliente esperando no balcão" não tem
espaço pra cromo do app admin. O toggle mora dentro de `go()` (roda em
TODO `go()`, não só ao entrar — é o que garante que sair da tela devolve
sidebar/header sozinho, não importa por qual caminho saiu), então
`fecharVendaBalcao()` virou só `voltar()`. `abrirVendaBalcao()` continua
existindo (chamada pela sidebar e pelo atalho novo em Estoque) — só que
agora faz `go('venda-balcao')` em vez de abrir overlay. **`pagesVendas`/
`pagesTecnico` em `go()` ganharam `'venda-balcao'`** — sem isso os 2
perfis que já tinham o atalho na sidebar (`snbRules: gestor||vendas||
tecnico`) ficariam bloqueados com "sem acesso" na primeira vez que
clicassem, porque a tela virou rota de verdade sujeita ao guardrail de
perfil (o modal antigo nunca passava por `go()`, então nunca era barrado).

**Reaproveitado quase inteiro**: todo o motor de carrinho que já existia
como modal (`_vendaCarrinho`, `_vendaAddItem`, `vendaRemoverItem`,
`confirmarVendaBalcao`, busca de cliente via `abrirBuscaCli('venda')`) —
zero reescrita da lógica de negócio, só a moldura.

**Novo nesta tarefa:**
- **Grade de produtos por categoria** (`_vbRenderGrade`) — abas vêm dos
  valores reais de `produtos.categoria` (não inventadas); "Mais vendidos"
  (aba padrão) usa a mesma régua da curva ABC (`curvaABC().ordenados`,
  giro×custo 180 dias) — não fiz uma contagem de vendas nova só pra esta
  tela, reaproveitei o que já existe e já é a medida real de "o que sai
  mais".
- **Busca com leitor de código de barras** — `vendaBuscarProduto()` agora
  testa match EXATO de código a cada tecla (não só substring) e soma na
  hora, sem esperar Enter — leitor físico dispara `oninput` rápido demais
  pra confiar em `keydown`.
- **Stepper +/- de 30×30px** (`_vendaMudarQtd`) — alvo de dedo, não de
  mouse; zerar a quantidade remove o item.
- **"Item livre"** (`_vendaAbrirItemLivre`/`_vendaConfirmarItemLivre`,
  via `abrirModal()` da Tarefa 13) — item com `produto_id:null`, entra na
  venda mas `confirmarVendaBalcao()` pula ele no laço de
  `registrarMovimento` (sem baixa de estoque, como o card já avisa).
- **Desconto** (`_vendaAbrirDesconto`) — abate do subtotal, nunca passa
  do subtotal (`Math.min`); vira parte do `valor_total` líquido gravado —
  **não criei uma coluna `desconto` nova** no schema de `vendas_balcao`
  (não existe hoje, e `dbInsert` resiliente descartaria em silêncio
  qualquer coluna que eu inventasse sem rodar migração primeiro).
- **Pagamento em grade de 4 botões** (Pix/Cartão/Dinheiro/A prazo) — troca
  o `<select>` antigo; clicar de novo no mesmo desmarca (nenhuma forma
  também é uma opção válida, "A prazo" sem dado de cobrança não é
  diferente de deixar em branco por enquanto).
- **"Salvar" ≠ "Finalizar venda"** — decisão de propósito, não implementação
  parcial: não existe no schema um conceito de venda pendente/rascunho, e
  fazer "Salvar" gravar em `vendas_balcao` (mesmo que "sem finalizar")
  deixaria os dois botões fazendo a MESMA coisa — clicar nos dois em
  sequência dobraria a venda e a baixa de estoque. "Salvar"
  (`vendaSalvarRascunho`) guarda o carrinho só em `localStorage`
  (sobrevive a F5/queda de conexão no meio do atendimento, sem tocar
  banco nem estoque); ao reabrir a tela com um rascunho salvo,
  `_vbRestaurarRascunho()` pergunta via `confirmar()` se quer retomar ou
  começar do zero — nunca restaura sozinho (evitaria cobrar o cliente
  errado pelo carrinho de quem passou antes).
- **Wiring do faturamento** (decisão do Marcos) — `_crmPipelineStats()`
  (`fechValor`/`fechQtd`/`fechValorAnt`) e `renderInsightsChart()` (bucket
  mensal do gráfico) agora somam `todasVendasBalcao` do mês junto com os
  orçamentos aprovados, filtrado por loja/mês do mesmo jeito. A baixa de
  estoque já era real desde antes desta tarefa (`registrarMovimento`, já
  existia no modal antigo) — só faltava a parte do faturamento.
- **Atalho na barra de Estoque** (pedido explícito do plano) — botão
  "Venda Rápida" ao lado de "Balanço"/"Dar baixa".

Testado no browser local (`dbOk=true` pra navegar com dado real; `dbOk=
false` temporário só na hora de clicar "Finalizar venda" de verdade, pra
não escrever em produção): grade com categorias reais (Acessório/Bomba/
Equipamento/Filtro/Peça de Piscina/.../Trocador de Calor); produto
adicionado via clique no card (badge de contagem aparecendo no próprio
card); leitor de código simulado (`vendaBuscarProduto('30200401021')`)
somou direto, sem precisar de Enter; stepper +1; desconto de R$58
aplicado (subtotal R$7.826 → total R$7.768, conferido linha a linha);
item livre "Serviço de instalação" R$150 adicionado com `produto_id:
null`; pagamento Pix selecionado; **rascunho salvo → recarregado a tela →
diálogo "Retomar venda em aberto?" apareceu, "Retomar" restaurou os 3
itens exatos** (conferido por igualdade de array); "Finalizar venda" com
loja selecionada (o guard "selecione a unidade" — já existia, não é bug
novo — bloqueou corretamente quando testei com "Todas as unidades")
gravou a venda local (`dbOk=false`), zerou o carrinho, apagou o
rascunho, e **2 movimentos de estoque reais foram criados (só pros 2
itens com produto_id — o item livre corretamente não gerou nenhum)**;
`_crmPipelineStats().fechValor` e a última barra do gráfico bateram
exatos com o valor da venda de teste, confirmando o wiring do
faturamento; "Sair do balcão" devolveu sidebar/header e voltou pra tela
anterior. Tablet 1024px (grade 3 colunas, carrinho 360px — o breakpoint
que o plano pede explicitamente) e mobile 375px (empilha, sem quebrar)
sem overflow. Zero erro novo no console. `sw.js` v163→v164.

**Com isso, as 3 subtarefas da Tarefa 3e (Hoje/OS/Balcão) e o plano de
ajustes inteiro do handoff `design_handoff_fluxa_redesign 4/` estão
fechados.**

---

## Tarefa 3e.2 — OS: o atraso vira o assunto (15/08)

Segunda das 3 subtarefas da revisão com dado real (3e.3, balcão, fica pra
próxima sessão). Mesmo achado de fundo da 3e.1: com 0 agendadas hoje, os 4
KPIs de `_renderOSKPIsNovo` mostravam `0/0/24/—` — dois zeros e um
travessão em 520×130px pra dizer "nada acontecendo agora, mas tem gente
esperando".

- **`_renderOSHero(base)`** (renomeada de `_renderOSKPIsNovo`) — cartão
  escuro único com 3 estados, nessa ordem de prioridade (a regra do
  plano: "mostra o MAIOR problema do dia"):
  1. **Em atendimento agora** (alguém em campo) — número + nomes dos
     técnicos, "Concluídas hoje"/"Tempo médio" como stats secundárias.
  2. **Fila sem dono** (sem ninguém em campo, mas tem OS sem técnico) —
     total + quantas já atrasadas + a mais antiga, carga por técnico
     (top 2) + "Livres hoje: N técnicos" (da lista real de técnicos da
     loja/grupo, `LOJAS`), botão "Distribuir as N".
  3. **Calmo** (nem um nem outro) — só "Hoje: N concluídas · tempo
     médio X", cartão claro, não escuro — problema nenhum não merece o
     mesmo peso visual de "24 OS na fila".
- **🔴 Bug real achado e corrigido no próprio teste**: "a mais antiga de"
  saía **sem data nenhuma** (`"13 já atrasadas · a mais antiga de "`). A
  causa: `[...semTecnico].sort((a,b)=>(a.data_servico||'').localeCompare(...))`
  ordenava TODO o conjunto sem-técnico, e um registro com `data_servico:
  null` vence esse sort (string vazia vem antes de qualquer data real) —
  a "mais antiga" virava a que não tem data nenhuma. Corrigido nos 2
  lugares que tinham o mesmo padrão (`_renderOSHero` e o item "OS sem
  técnico" que a Tarefa 3e.1 adicionou em `_itensPainelHoje`): ordenar só
  quem TEM data, nunca a lista bruta.
- **Chips reordenados** (`OS_CHIPS`) — Atrasado passou a vir primeiro (era
  Todos); contagem zero some da tela (`.filter` antes do `.map` em
  `_osRenderChips`), exceto "Todos" e o chip que está ativo no momento
  (senão o botão pra voltar pro filtro ativo desaparecia).
- **Coluna "Cliente e serviço"** — `_osTratarServico(svc)` (nova) trata o
  separador `;,` que vem do orçamento de origem (cada item de
  `o.servicos[]` já carrega um `;` de sobra no fim; `.join(', ')` produz
  exatamente `;,` entre eles). Mostra os 2 primeiros itens + "+N itens"
  em azul quando sobra; a `.rd-cell-sub` ganhou
  `overflow:hidden;text-overflow:ellipsis;white-space:nowrap`, então vira
  1 linha mesmo sem o tratamento pegar 100% dos casos (achado no teste:
  alguns itens do array não têm o `;` final, então o split não separa
  ESSA junção específica — degrada bem, só mostra um pouco mais de texto
  na primeira linha, não quebra). Badge de unidade (`getLojaBadge`) passou
  a aparecer sempre, não só quando "Todas as unidades" está selecionado.
- **Coluna "Duração" virou "Atraso"** — mesma célula, papel por status:
  dias de atraso (vermelho) pra atrasada, duração real pra concluída, "—"
  pro resto. Não é coluna nova — o grid do handoff (7 colunas) não tinha
  espaço pras duas.
- **Checkbox + seleção em lote** — `osSelecionadas` (Set, só em memória,
  nunca persiste). Barra no rodapé (`#os-lote-barra`, `_osRenderBarraLote`)
  com "Atribuir técnico"/"Remarcar"/"Cancelar", cada um abrindo um modal
  pequeno via `abrirModal()` (o helper da Tarefa 13) e gravando com
  `dbUpdate` por OS selecionada — pulando quem já está concluída/cancelada
  (defesa dentro de cada ação, não deixa o clique errado reabrir uma OS
  fechada). "Distribuir as N" do cartão escuro seleciona toda a fila sem
  dono e já abre o picker de técnico — um clique, não dois.
- **Linha atrasada ganha fundo `--warn-row`** (reaproveita `.rd-row-warn`,
  já existia pro Estoque); concluída/cancelada recua (`.rd-row-dim`, nome
  em peso 500 em vez de 600).
- **Coluna fixa no mobile (Tarefa 5) ajustada** — o checkbox novo entrou
  como 1ª coluna do grid, empurrando Data/Cliente pra 2ª/3ª; o
  `nth-child(1)/(2)` que a Tarefa 5 tinha fixado agora é `nth-child(2)/(3)`
  só pra `#osh-body` (as outras 4 tabelas com coluna fixa não mudaram).

**Não implementado, de propósito:**
- **Alternador Lista/Dia/Semana** que aparece no mock — não existe hoje
  nenhuma visão de calendário pra OS (Dia/Semana), só a lista; construir
  isso do zero é uma tela nova, fora do que a prosa do plano pede
  explicitamente (ela só fala em "a visão padrão vira Lista", como se
  Dia já existisse). A ordenação da lista (mais atrasada primeiro) já
  era o comportamento real antes desta tarefa — conferido, não precisou
  mudar.
- Botão "Selecionar todos" no cabeçalho existe e funciona
  (`_osToggleTodos`), mas só afeta as linhas **visíveis na página atual**
  (a tabela não pagina hoje, então na prática é "todas as que passam pelo
  filtro"). Registrado caso a paginação seja adicionada depois.

Testado no browser local (`dbOk=true` pra ver os dados reais; `dbOk=false`
temporário só na hora de clicar de verdade em "Atribuir"/confirmar, pra
não escrever em produção — mesmo padrão já usado nesta sessão): cartão
"Fila sem dono" com 24 OS reais, 13 atrasadas, data certa depois do fix;
chips reordenados com contagem batendo (Atrasado 17/Agendado 28/
Concluído 1/Todos 29 — os MESMOS números do mock, confirma que o handoff
foi feito em cima deste banco); "+N itens" funcionando com serviço real
de 7 itens; checkbox selecionando sem abrir a OS (`stopPropagation`
confirmado via clique programático); modal de "Atribuir técnico" abrindo,
preenchendo e confirmando com `dbOk=false` — `tecnico` do registro em
memória mudou de "Bruno" pra "Marcos", seleção limpa depois; clique na
linha (fora do checkbox) ainda abre a OS normalmente; mobile 375px (cartão
escuro empilha, chips quebram linha, sem overflow de página) e desktop
1440px. Zero erro novo no console. `sw.js` v162→v163.

---

## Tarefa 3e.1 — Hoje: a fila manda na tela (15/08)

Novo handoff (`design_handoff_fluxa_redesign 4/`, `Fluxa Ajustes.dc.html` +
seção nova "Tarefa 3e" no `PLANO-ACABAMENTO.md`) — desta vez baseado em
revisão **com dado real de produção**, não mock genérico: 191 orçamentos,
17 avisos na fila, gráfico com escala dominada pela série "emitido",
despesas em R$ 0,00. Primeira das 3 subtarefas (3e.2 OS e 3e.3 balcão
ficam pra próxima sessão).

**Inversão de coluna** — `.ins-body` tinha o gráfico na coluna larga
(1.55fr) e a fila na estreita (1fr); a fila, mais alta, esticava além do
gráfico e sobrava branco embaixo dele (`align-items:start` impedia as
duas de baterem na mesma altura). Trocado: fila agora é a coluna larga
(1.42fr) com `align-items` padrão (stretch) — as duas colunas alinham na
mesma altura pela primeira vez. Nenhuma função mudou de lugar, só a
ordem no DOM e a proporção do grid.

**Fila agrupada por tipo, não por cliente:**
- **`_itensPainelHoje()` ganhou um item novo**: "N OS sem técnico"
  (`os-sem-tec`), mesmo critério que `_renderOSKPIsNovo()` já usa
  (`status==='agendado' && !tecnico`) — antes só quem abria Ordens de
  Serviço via esse número; agora também aparece na fila com ação
  "Distribuir". Sub mostra quantas já estão atrasadas (`data_servico` no
  passado) e a mais antiga.
- **Cadência de recompra virou UM item agrupado**, não até 5 linhas
  individuais — `_acaoQueue()` empacota a lista inteira de
  `cadenciaCandidatos()` num item `tipo:'cadencia-grupo'` com
  `itens:[{nome,valor,motivo,fn}]`; `_acaoCadenciaGrupoHTML()` (nova)
  desenha isso como cabeçalho + grade de 2 colunas de cartões compactos
  (nome com ellipsis, valor, motivo, "Novo orçamento"), 4 visíveis + "Ver
  todos os N" que expande in-place (`_acaoCadenciaExpandida`, módulo,
  sem tela dedicada pra linkar). **Fila de follow-up (`crmCandidatos`,
  motivo diferente — preço expirado, decisão em assembleia etc.) NÃO foi
  agrupada** — o plano só pede isso explicitamente pra cadência; o mock
  mistura os dois tipos no mesmo grid visualmente, mas segui a prosa (mais
  específica que o mock, que usa "dado fictício mas realista" sem rigor
  de tipo) e mantive follow-up como linha individual, como já era.
- **Subtítulo com agregado** ("N grupos de atenção · R$ X envolvidos") —
  **não é literalmente "N pendências" do mock** (esse número mistura
  contagem de registros crus com contagem de grupos de um jeito que não
  dá pra recalcular de forma honesta a partir dos dados). Uso "grupos"
  (= linhas da fila, `_acaoQueue().length`, sempre exato) e "envolvidos"
  soma só o que cada item já carrega em `valor`/`valorTotal` — adicionei
  esse campo aos itens de `_itensPainelHoje()`/follow-up/proximos que
  tinham um total monetário natural (vencido, sem cobrança, follow-up,
  chegando); os que não têm (ruptura de estoque, OS sem técnico,
  orçamento sem identidade) somam 0 sem travar a conta.

**Gráfico "Aprovado por mês"** — a barra clara "Emitido" saiu (era o que
dominava a escala do eixo Y e afundava a barra de "Aprovado" a um traço
de poucos px quando algum mês tinha proposta grande sem fechar). Só uma
série agora, `maxBarThickness` subiu de 22→34 pra ocupar o espaço que
sobrou, altura do wrap 190px→150px. **Alternador PDF/WhatsApp pra
"Emitido" (sugerido no plano como "se for necessário") não foi
construído** — sem essa série o problema que motivou a mudança já
desaparece, e um alternador sem uso claro seria feature especulativa.

- **Projeção do mês corrente** (`Agosto tem N dias corridos. No ritmo
  atual fecha em R$ X`) — linear pelos dias já passados
  (`aprovMesAtual/diasCorridos*diasNoMes`), comparada ao mês anterior. Se
  a projeção fica abaixo do mês anterior, a ÚLTIMA barra (sempre o mês
  corrente, independente do período 6M/12M/Ano) e seu rótulo de valor
  ficam âmbar em vez de azul — mesmo princípio do KPI "Fechado no mês"
  abaixo. Frase de ritmo só aparece em 6M/12M (em "Ano" o mês corrente
  incompleto já é óbvio pela posição, a frase ficaria redundante).
- **KPI "Fechado no mês" ganha borda de atenção + seta pra baixo** quando
  a variação vs. mês anterior é negativa (era sempre neutro/verde-ish,
  "-73%" tinha o mesmo peso visual que "+18%"). Card ganhou
  `id="ins-d-fech-card"` pra receber `.rd-card-warn` via JS.
- **Rodapé Receita/Despesas/Resultado só aparece com despesa lançada NO
  MÊS CORRENTE** (não no período do gráfico inteiro — o plano fala
  especificamente de "despesa em agosto"). Sem despesa, um cartão novo
  tracejado "Despesas não lançadas" (`#ins-desp-vazia-card`, terceiro
  card do `.ins-col-direita`, abaixo de "Em que fase está") ocupa o
  lugar do aviso, com link direto pra "Lançar despesas" —
  `renderInsightsChart()` alterna `display` dos dois, nunca os dois
  juntos. Regra geral do plano: "quando o denominador de um cálculo está
  vazio, mostra o estado, nunca o resultado".

**Não implementado, de propósito:** chip "Só urgentes" que aparece no
mock ao lado do título da fila — a prosa do plano não descreve nenhum
critério de filtro pra ele (só existe no visual), e um botão sem
comportamento definido seria pior que não ter o botão. Registrado pra
alguém decidir o critério antes de construir.

Testado no browser local (`dbOk=true`, dado real de produção, 330
orçamentos/121 OS/0 despesas — bate com o cenário que o próprio plano
descreve): KPI "Fechado no mês" com borda de atenção e "-73% abaixo de
julho"; fila com 16 grupos reais (vencido/sem cobrança/OS sem técnico/
recompra agrupada/follow-up individual); grupo de recompra testado com
lista sintética de 6 clientes — 4 visíveis + "Ver todos os 6" expande
e "Ver menos" recolhe, sem re-render quebrado; gráfico com barra de
agosto âmbar (projeção R$45.571,92 abaixo de julho) e rótulo de valor
também âmbar; card "Despesas não lançadas" visível (despesas reais = 0);
mobile 375px (fila logo após o hero, grid de recompra 2 colunas com
ellipsis funcionando, gráfico e cards sem overflow) e desktop 1440px;
zero erro novo no console. `sw.js` v161→v162.

---

## Tarefa 4 fechada — "A Receber" unificado, soma as duas fontes (15/08, decisão do Marcos)

Última pendência do plano de acabamento. Pergunta já registrada desde
14/08 (achado "dois sistemas de recebimento coexistindo"): o Marcos
escolheu **somar as duas fontes** — não migrar retroativamente
(inventaria vencimento/parcela pra 93 orçamentos que nunca tiveram isso)
nem deixar como estava (a maior parte do "A Receber" real ficava invisível).

**`_orcSaldoAReceber(o)`** (nova, `app.js`, perto de `_orcAprovadosSemReceb`)
é a peça que faz a unificação sem dobrar valor: por ORÇAMENTO, não por
app inteiro — se tem qualquer linha em `recebimentos`, usa só essa fonte
(soma das parcelas em aberto); sem nenhuma linha, cai no saldo do campo
antigo (`total − valor_recebido`). Nunca soma os dois pro mesmo
orçamento — um orçamento com parcela lançada não deveria contar de novo
via `valor_recebido` (que fica parado assim que a parcela nasce).

**5 pontos que mostravam "A Receber" com número diferente, agora
consistentes** (todos somando via `_orcSaldoAReceber`):
1. KPI "A receber" do Insights (`ins-d-receber`) — antes só `recebimentos`.
2. Total "X em aberto" da tela A Receber (`receb-resumo-sub`) — antes só
   `recebimentos`; "vencidos" continua só `recebimentos` de propósito (o
   sistema antigo não tem vencimento pra classificar como atrasado).
3. Card "Aprovados sem cobrança lançada" (`_renderRecebGap`, tela A
   Receber) — já existia desde 14/08, mas somava `o.total` bruto, sem
   descontar `valor_recebido` parcial; agora usa o saldo real. De quebra,
   `_orcAprovadosSemReceb()` ganhou o filtro `_orcSaldoAReceber(o)>0` —
   um aprovado antigo já quitado inteiro via `valor_recebido` não faz
   mais sentido aparecer como "precisa lançar" pra sempre.
4. Item "aprovado sem cobrança lançada" da fila "Precisa de você hoje"
   (`_itensPainelHoje`) — mesmo bug do #3 (`o.total` bruto), agora bate
   com o número do card #3 na mesma tela.
5. KPI "Em aberto" da ficha do cliente (`_renderFichaCliente`) — antes só
   `recebimentos` do cliente.
6. Card "A Receber" do dashboard antigo do Histórico (`d-rec`,
   `atualizarDash`) — pior caso: lia **só** `valor_recebido`, que para de
   ser atualizado assim que um orçamento ganha parcela em `recebimentos`
   (o pagamento passa a ser marcado lá). Um orçamento aprovado este mês
   com parcela paga via o sistema novo aparecia como "não recebido" aqui.

**Não mexido, de propósito:** o "Pagamento em aberto" do Portal do
Cliente (`checkPortalHash`/`renderPortal`) continua só `recebimentos` —
é uma query já escopada por segurança direto no servidor (achado da
auditoria de 14/08, não reaproveita o `todosOrc`/`todosReceb` em memória
que o resto do app usa). Somar o gap do sistema antigo exigiria uma 2ª
consulta ao servidor num caminho client-facing sensível, pra mostrar ao
cliente um valor sem vencimento/parcela — decidi não arriscar essa
superfície por uma consistência que é interna (cobrança do sistema
antigo é dívida da empresa formalizar, não algo pra jogar sem contexto
na tela do cliente).

Testado no browser local (`dbOk=true`, dado real de produção, 330
orçamentos/4 recebimentos carregados): antes do fix, KPI "A receber"
mostrava R$2.268,30 (só as 4 parcelas já lançadas) — **93 de 96
aprovados nunca tiveram parcela nenhuma**. Depois do fix: R$122.417,79
em TODOS os 5 lugares acima, e a matemática bate exata em cascata (gap
R$120.149,49 + recebimentos em aberto R$2.268,30 = R$122.417,79 —
conferido por igualdade direta, não só "parece certo"). Gap card caiu de
93 para 51 orçamentos depois do filtro de saldo zero. Ficha de cliente
testada com "Edifício Infinity Coast Residence" (2 orçamentos no gap,
soma R$3.710,25 batendo com a lista). Sintaxe validada via `new
Function` (JXA). Zero erro novo no console. `sw.js` v160→v161.

---

## Tarefa 13 — Helper `abrirModal()` + migrados os 3 modais que faltavam (dup/QR/NF-e) (15/08)

Última pendência da migração de modais que a Tarefa 3c tinha deixado pra
depois ("os modais montados em string no JS ganharem o helper, ainda não
feita"). Os 3 (`#dup-modal-bg`, `#qr-modal-bg`, `#nfe-modal-bg`) tinham
naturezas diferentes — só o primeiro era de fato "montado em string" — e
foram tratados de acordo, não com a mesma receita.

- **`abrirModal({corpo, largura, id})`/`atualizarModal(corpo, id)`/
  `fecharModal(id)`** (novas, `app.js`, perto de `confirmar()`) — monta a
  moldura `.rd-modal-bg`/`.rd-modal` uma vez, o chamador só manda o HTML de
  dentro do card. `abrirRevisaoDuplicatas()` (que criava
  `document.createElement('div')`+`.modal-bg`/`.modal` do zero toda vez)
  agora usa `abrirModal()`; `confirmarLimpezaDuplicatas()` troca o conteúdo
  do MESMO card três vezes (lista → progresso → resultado) via
  `atualizarModal()`, sem fechar/reabrir. `id:'dup-modal-bg'` preservado de
  propósito — nada mais no código referenciava esse id, mas mantive o
  padrão de nomear por finalidade, não genérico.
- **`#qr-modal-bg`** (QR code de equipamento) — já era um shell ESTÁTICO no
  `index.html` (não montado em string; só o conteúdo era preenchido por
  id), então "migrar" aqui foi trocar `.qr-modal-bg`/`.qr-modal`/`.qr-acts`
  pelo shell novo. **Importante:** `.qr-modal-bg` (o de fora, cuidando só
  do fundo escurecido) é uma classe COMPARTILHADA por outros **13** modais
  do Estoque/Compras (`prod-modal`, `compras-modal`, `venda-modal`,
  `oc-form-modal`, etc.) — não toquei nessa classe em si, só troquei a
  classe do elemento `#qr-modal-bg` especificamente pra `rd-modal-bg`. Os
  outros 13 continuam exatamente como estavam, no sistema antigo — nenhum
  no escopo desta tarefa. Testado explicitamente abrindo `prod-modal`
  depois da mudança pra confirmar zero regressão.
- **`#nfe-modal-bg`** (emitir Nota Fiscal) — mesmo caso do `qr-modal-bg`
  (shell estático, migração de classe), mas aqui `.nfe-modal-bg`/
  `.nfe-modal`/`.nfe-acts` eram exclusivas desse modal (não compartilhadas
  — confirmado por grep antes de decidir), então pude apagar essas 3
  regras do CSS depois de migrar, em vez de só desalinhar sem remover.
  `.nfe-tipo-tabs`/`.nfe-tab`/`.nfe-status-badge`/`.nfe-info-row`
  continuam — são conteúdo específico da NF-e, não moldura de modal.
  **Achado ao migrar:** o botão "Emitir Nota Fiscal" tem o texto trocado
  por `textContent=` em 6 pontos do JS (abrir/emitindo/tentar de novo/já
  emitida), cada um com o emoji (⚡/✅) embutido na própria string — tirar
  só do HTML estático não bastava, o JS reescrevia o emoji de volta a cada
  abertura. Os 6 pontos corrigidos junto. **Não mexido, de propósito:** o
  emoji dos toasts (`❌`/`⚠️`) e do badge de status
  (`✅ Nota Autorizada`/`⏳ Processando…`/etc.) — é conteúdo dinâmico de
  fluxo, não moldura, mesmo critério que a varredura de emoji de 14/08 já
  registrou como "sem pressa".
- **Larguras novas** (`styles.css`): `.rd-modal-wide` (560px + `max-height:
  90vh;overflow-y:auto` — o form de NF-e é comprido, precisa rolar dentro
  do card) e `.rd-modal-narrow` (340px, `text-align:center`, pro QR
  compacto). **Modificador em classe, não `style=` inline** — inline
  venceria o `max-width:100%` do media query mobile e travaria a folha
  numa largura de desktop (mesmo bug já documentado na Fase 7 do
  redesign, lá com `grid-template-columns`).
- **Limpeza de CSS morta** — com o `dup-modal-bg` migrado, `.modal-bg`/
  `.modal`/`.modal-acts`/`.btn-pri` (o sistema de modal ORIGINAL, pré-
  redesign) ficaram sem nenhum elemento usando — removidos. `.btn-sec`
  continua (ainda usado em 3 pontos fora deste escopo: download de XML da
  NF-e, e dois formulários não migrados). `.qr-modal-bg .ct,.nfe-modal-bg
  .ct` (regra de título sticky dentro de modal com scroll) perdeu a
  metade `.nfe-modal-bg .ct` (a NF-e não tinha nenhum `.ct` dentro — a
  regra nunca chegou a valer pra ela; conferido antes de tirar); a metade
  `.qr-modal-bg .ct` fica, ainda serve os outros 13 modais que
  compartilham essa classe.

Testado no browser local (dbOk=true, conectado no Supabase real de
leitura, sessão sintética via `setSessao()`): os 3 modais abertos com
dado real/sintético — QR (equipamento sintético, imagem gerando,
Fechar/Imprimir), NF-e (orçamento sintético, abas NFS-e/NF-e trocando,
scroll interno confirmado via `scrollTop`, botão sem emoji em todos os
estados simulados), duplicatas (lista→progresso→resultado no mesmo card
via `atualizarModal`, `fecharModal` remove do DOM limpo); mobile 375px
(folha com grip nos 3, sem overflow de página) e desktop 1280px; aberto
`prod-modal` (um dos 13 que ainda usa `.qr-modal-bg` compartilhada) depois
da mudança — sem regressão. Sintaxe validada via `new Function` (JXA),
chaves de CSS balanceadas (1278/1278). Zero erro novo no console (só o
ruído de rede pré-existente já documentado). `sw.js` v159→v160.

---

## Tarefa 3d — Redesign da tela de login (15/08)

Novo handoff (`design_handoff_fluxa_redesign 3/`, "Fluxa Login.dc.html" +
seção nova no `PLANO-ACABAMENTO.md`) pedindo pra refazer a tela de login do
zero: painel de branding à esquerda + card de formulário à direita, PIN em
caixas visuais, sugestão de nome com avatar, erro com título+explicação,
"manter conectado", e o seletor de empresa/unidade redesenhado.

**Reaproveitado, não recriado:** o mecanismo de lockout real (3 tentativas,
30s — `loginAttempts`/`loginLockedUntil`) já existia e é o que a UI nova
mostra; o hash de PIN (`pinValido()`, SHA-256 + fallback legado) não mudou;
`fazerLogin()` continua com os mesmos 4 ramos de sucesso (gestor principal,
master/gestor sem loja, gestor com loja, técnico multi-empresa, técnico/
vendas fixo) — só o que cada ramo faz na tela mudou, não a lógica de quem
vai pra onde.

- **CSS/HTML** (`styles.css`/`index.html`): painel esquerdo escuro com
  logo/tagline/versão; card de login com campo de nome + PIN em 4 caixas
  decorativas sobre um `<input type="password">` real e invisível (mesmo
  padrão de sempre nesse tipo de UI — o input real garante autofill/colar/
  teclado numérico; as caixas só refletem o valor). Bloco de erro
  ícone+título+mensagem (`.login-err`/`-title`/`-msg`, era uma linha de
  texto vermelho sem contexto). Checkbox "Manter conectado neste aparelho".
- **`_loginErrMostrar(titulo,msg)`/`_loginErrLimpar()`** (novas) — todo
  ponto que antes fazia `err.textContent='...'` (dentro de `fazerLogin` e
  em `iniciarCountdownLockout`) passou a usar essas duas. Números reais do
  mecanismo (não inventados pro visual): "restam N tentativas" e "bloqueio
  de 30 segundos" — o mock tinha um placeholder de 5 minutos, descartado.
  "Esqueceu a senha" também não nomeia uma pessoa específica — qualquer
  gestor pode redefinir, então o texto é genérico ("peça a um gestor").
- **🔴 Bug real achado e corrigido no próprio teste:** `iniciarCountdownLockout()`
  ainda escrevia direto em `#login-err.textContent` — código de antes da
  troca pro bloco ícone+título+mensagem. Sem a classe `.on` (que o CSS
  novo exige pra mostrar o bloco) o contador de bloqueio **nunca aparecia
  na tela**, e pior: escrever texto solto no container apagava a estrutura
  interna (ícone + spans de título/mensagem) — o próximo erro normal (não
  de lockout) ficaria quebrado depois de um bloqueio acontecer uma vez.
  Corrigido pra usar `_loginErrMostrar`/`_loginErrLimpar` como todo o
  resto. Reproduzido e confirmado corrigido no browser: 3 tentativas
  erradas → bloco vermelho aparece na hora com "Muitas tentativas /
  Aguarde Ns…", contador atualiza a cada 500ms, some sozinho ao zerar.
- **Estado ocupado do botão** (`_loginBusy`) — `.login-btn.busy` + spinner
  + rótulo "Entrando…" durante a checagem do PIN (`pinValido`, é rápido
  mas assíncrono — `crypto.subtle.digest`), desligado antes de navegar ou
  no erro.
- **PIN errado treme** (`_loginPinShake`) — `.login-pin-boxes.shake`
  (320ms) + `.error` (tom vermelho nas 4 caixas) até o próximo dígito
  (`atualizarDotsPIN` limpa as duas classes e o bloco de erro assim que
  `val.length` > 0 — testado que digitar de novo limpa mesmo com erro
  ainda visível).
- **"Manter conectado"** (`setSessaoLembrada`/`getSessaoLembrada`/
  `limparSessaoLembrada`, `localStorage`, 30 dias) — não existia antes: a
  sessão sempre foi só `sessionStorage` (some ao fechar a aba/app), então
  o técnico digitava o PIN toda vez que reabria em campo. Boot (linha
  ~1121) tenta a sessão lembrada quando não há `sessionStorage` ativa,
  ANTES de mostrar o login — e grava de volta em `sessionStorage` via
  `setSessao()`, então o resto do app não precisou mudar (continua lendo
  só `getSessao()`). Capturado no clique de "Entrar"
  (`_loginManterConectado`) e usado nos 4 pontos que finalizam sessão —
  inclusive os 2 que passam pela escolha de empresa
  (`confirmarLojaGestor`/`confirmarEmpresaTecnico`), guardado numa
  variável de módulo porque o checkbox já não está mais na tela nesse
  momento. `fazerLogout()` limpa. Desktop começa desmarcado (mesa
  compartilhada); celular começa marcado (aparelho de campo do técnico o
  dia inteiro) — decisão via `window.innerWidth<680` no boot.
  **🔴 Achado em teste:** ler `window.innerWidth` de forma síncrona no
  meio do boot voltava `0` neste ambiente de teste (headless), marcando o
  checkbox mesmo em tela larga — corrigido com `requestAnimationFrame`
  antes de checar a largura, sem custo perceptível.
- **Seletor de empresa/unidade** (`mostrarSelecaoLojaGestor`/
  `mostrarSelecaoEmpresaTecnico`, já usavam as classes `.login-loja-*` de
  antes do redesign — só precisaram do `<svg>` de check e do wrapper
  `.login-loja-info` que o CSS novo espera) — cartão da unidade/empresa
  atual ganha destaque (`.current`, borda azul + check), calculado contra
  `sessionStorage('fluxa_loja_ativa'/'fluxa_vis_empresa_tec')`.
  "N orçamentos abertos" por unidade (`_loginOrcAbertosLoja`, reusa
  `orcAbertoNoPipeline` sem duplicar cálculo) — **só aparece se `todosOrc`
  já carregou** (retorna `null`, não `0`): o login acontece ANTES do boot
  buscar orçamentos (`loadHist` só roda ao entrar em Histórico/Insights),
  então mostrar "0 orçamentos" aqui seria sempre falso — caiu no
  subtítulo genérico de antes ("Gerenciar esta unidade") nesse caso.
- **Não implementado, de propósito:** `#login-versao`/`#login-suporte-tel`
  não têm fonte de dado real no app (não existe controle de versão nem
  campo de telefone de suporte no `FLUXA_CONFIG`) — versão ficou como
  texto estático no HTML (não é rastreada em lugar nenhum hoje) e o link
  de telefone continua oculto (`style="display:none"` já era o default).

Testado inteiramente no browser local (`dbOk=true`, conectado no Supabase
real de leitura — nenhuma escrita disparada: falha de PIN só mexe em
`localStorage`/contador local, nunca chama `logAcao`/rede): nome não
encontrado, PIN errado com número real de tentativas restantes, sequência
completa até o bloqueio (contador ao vivo, caixas vermelhas, unlock
automático), digitar de novo limpa erro e tremor, "manter conectado" —
sessão restaurada sozinha numa recarga sem `sessionStorage`, `fazerLogout`
limpa, sessão expirada (`exp` no passado) não restaura — seletor de
unidade (gestor) e de empresa (técnico) com o cartão atual destacado em
mobile 375px e desktop 1280px, zero erro novo no console (só o ruído de
rede pré-existente já documentado). `sw.js` v158→v159.

---

## Migrados os 3 modais restantes pro shell `.rd-modal` (14/08)

Continuação da Tarefa 3c, que só tinha migrado `confirmar()` de propósito
("um de cada vez"). Migrados agora: `crm-contato-bg` (registrar contato,
formulário), `receb-bg` (como vai receber, aparece na aprovação),
`aprov-os-bg` (criar OS da aprovação) — os 3 que ainda usavam `.modal-bg`/
`.modal`.

- **`crm-contato-bg`** — sem o bloco ícone+título+mensagem (não é uma
  confirmação, é formulário puro); título viraram `<h3>` direto dentro do
  `.rd-modal`, criada regra `.rd-modal>h3`/`.rd-modal-sub` genérica pra
  cobrir esse caso (não existia antes — só `.rd-modal-headtx h3` do bloco
  de confirmar()).
- **`receb-bg`/`aprov-os-bg`** — já tinham o formato ícone-grande+título+
  subtítulo (emoji solto de 30-32px); esses dois **viraram o bloco real**
  `.rd-modal-head`/`.rd-modal-ico`/`.rd-modal-headtx` (ícone num quadrado
  de 36px com cor de fundo, igual ao `confirmar()` já fazia) — mais
  correto que só trocar `.modal`→`.rd-modal` e deixar o emoji solto.
- Todos os botões `.btn-sec`/`.btn-pri`/`.btn-primary` (3 nomes de classe
  diferentes entre os 3 modais!) viraram `.rd-modal-btn`/
  `-nao`/`-sim`, e o emoji dos botões principais ("💰 Registrar", "📋
  Criar OS agendada", "📦 Ordem de entrega") saiu — mesmo critério da
  varredura de emoji já feita.
- Nenhuma função JS mudou: `abrirModalXxx()`/`fecharXxx()` só fazem
  `classList.add/remove('on')`, mecanismo idêntico entre `.modal-bg` e
  `.rd-modal-bg` — confirmado antes de mexer, pra não precisar tocar em
  `app.js` nesta tarefa.
- **Não mexido, de propósito** (registrado desde a Tarefa 3c): `.modal-cli-bg`/
  `.cli-hist-overlay` (busca de cliente, histórico) e os modais montados
  em string (`#dup-modal-bg`, `#qr-modal-bg`, `#nfe-modal-bg`) — helper
  `abrirModal()` é a próxima tarefa, ainda não feita.

Testado no browser local (dbOk=true): os 3 modais abertos manualmente via
`classList.add('on')` — visual bate com `confirmar()` (mesmo raio, sombra,
animação fade+card); folha com grip no mobile (375px) confirmada no
`aprov-os-bg`; sem erro novo no console. `sw.js` v157→v158.

---

## 🔴 Auditoria de segurança do Portal do Cliente — 2 vazamentos reais + 1 bug de conexão (14/08)

A única superfície pública do app nunca tinha tido revisão própria (achado
da análise de usabilidade, item #9). Auditados os dois pontos que o plano
pedia — dado interno no payload e registro de aprovação — e achado um
terceiro problema não previsto (conexão) enquanto testava os outros dois.

### 🔴 `recebimentos` vazava para TODOS os clientes (o mais grave)

`renderPortal()` buscava `db.from('recebimentos').select('*').is(
'data_pagamento',null)` **sem nenhum filtro por cliente** — trazia as
parcelas em aberto (valor, vencimento) de **toda a base**, de todas as
empresas que dividem este banco, e só filtrava pro cliente certo depois,
no JavaScript. Qualquer link de portal válido, de qualquer cliente,
baixava no payload da rede o financeiro em aberto de todo mundo — só não
aparecia na tela porque o filtro rodava depois de a rede já ter
respondido. **Confirmado com o Management API** (leitura, mesmo PAT desta
sessão): a tabela tem só `id/orcamento_id/loja_id/parcela_n/
parcelas_total/vencimento/valor/data_pagamento/forma/obs/origem/
data_criacao` — nada "inofensivo" ali, é dinheiro de cliente.

**Fix:** filtro `.in('orcamento_id', [...])` no servidor, construído a
partir dos orçamentos que já são do cliente (`orcIdsCliente`) — a mesma
lista que already existia, só nunca tinha sido usada na query. Query nem
roda mais se o cliente não tem nenhum orçamento (`orcIdsCliente.size`).

### 🟡 `orcamentos`/`ordens_servico` mandavam a linha inteira (`select('*')`)

Consultado o schema real das duas tabelas (Management API, só leitura).
Achados campos claramente internos sendo enviados ao navegador do
cliente mesmo sem aparecer em nenhuma tela:

- **`orcamentos`**: `nota_interna` (rotulada no form como "Anotações
  internas, negociação, condições especiais"), `crm_notas`,
  `motivo_perda`, `proximo_contato`, `decisao_prevista`, `valor_recebido`.
- **`ordens_servico`**: `obs_tecnica`, `materiais`, e — o mais sensível —
  `checkin_lat`/`checkin_lng`/`checkout_lat`/`checkout_lng`: a
  **localização GPS do técnico**, sem relação nenhuma com o que o cliente
  precisa ver.

**Fix:** `select()` com lista explícita de colunas em vez de `*`, nas duas
queries. A lista não é só "o que a tela mostra" — inclui também o que
`_hashDocumentoOrc()` (hash anti-adulteração da assinatura) e
`sincronizarBaixaOrcamento()`/`sincronizarReservaOrcamento()` (baixa e
reserva de estoque na aprovação) precisam pra continuar funcionando na
aprovação. Testado depois do fix: hash gerado normalmente com um
orçamento real via `select()` restrito, sem `undefined` em nenhum campo.
**Não mexido:** `vistorias`/`equipamentos`/`clientes` — `vistorias` é
relatório que o próprio cliente já vê em PDF (os campos "internos" ali
são o conteúdo do laudo, não algo escondido dele); `equipamentos` e
`clientes` não têm campo claramente interno no schema; os três já vêm
filtrados por cliente (sem o vazamento cross-cliente do `recebimentos`).

### 🔴 Achado ao testar os dois de cima: portal não conectava em navegador novo

`checkPortalHash()` só tentava conectar com `ls('sb_url')`/`ls('sb_key')`
— credenciais que só existem no `localStorage` **depois** do boot normal
rodar (`conectarDB` grava lá na linha ~1007). Só que `checkPortalHash()`
roda **antes** disso e corta o boot cedo pra rota `/portal` — nunca
alcança o código que gravaria essas chaves. Resultado: um navegador que
nunca logou no app interno (o caso normal de um **cliente de verdade**
abrindo o link pela primeira vez, no celular dele) caía direto em "Portal
não encontrado", mesmo com token válido. Reproduzido: limpei localStorage
e testei um token real — falhou; com o fix, conectou.

**Fix:** usar `FLUXA_CONFIG.supabaseUrl`/`supabaseKey` (do `config.js`,
sempre presente, é a mesma fonte que o boot normal usa) como prioridade,
`localStorage` só como fallback. Como cada empresa tem seu próprio
`config.js` no próprio deploy (arquitetura multi-empresa já documentada
mais abaixo), isso funciona igual pra Forthemp/Aquamotor/qualquer empresa
nova — cada uma aponta pro Supabase dela mesma.

### O que já estava certo (não precisou mexer)

O achado #9 também pedia conferir o registro de "quem aprovou, quando, de
qual IP". **Quem/quando/conteúdo já estava resolvido, e bem** — no fluxo
de assinatura (`confirmarAssinatura`→`aprovarOrcPortal`): imagem da
assinatura (`assinatura_base64`), timestamp (`assinatura_data`), hash
SHA-256 do conteúdo assinado (`assinatura_hash` — recalculável depois pra
provar se algo mudou) e `navigator.userAgent` do aparelho
(`assinatura_meta`). **IP não é capturado, e não dá pra fazer direito
neste ponto** — o app é 100% client-side (sem backend próprio), e obter o
IP real exigiria uma chamada a um serviço externo de terceiros (novo
gasto/dependência/trade-off de privacidade) que não é decisão pra tomar
sozinho. Registrado aqui como limitação de arquitetura, não como bug.

Testado no browser local com **tokens reais de clientes reais** (só
leitura — nenhuma aprovação/recusa foi clicada, dados de produção
intocados): cliente sem orçamento (query de recebimentos nem dispara);
cliente com orçamento pendente real (#350, André) — `select()` restrito
confirmado via inspeção direta das chaves do objeto retornado (bate
exato com a lista, sem os campos internos); hash de assinatura gerado
sem erro com o objeto restrito; conexão funcionando em sessão sem
`localStorage` prévio. Sintaxe validada via `new Function`. `sw.js`
v156→v157.

---

## Continuação do acabamento — itens deixados "sem pressa" agora feitos (14/08, pedido do Marcos)

O Marcos pediu pra fechar os itens que a Tarefa 6 tinha registrado como
adiados de propósito — exceto as pendências antigas (CNPJs, tokens Focus
NFe, etc., que dependem dele). Um item de cada vez, mesmo protocolo.

### Varredura completa de emoji em `.rd-btn`/`.rd-chip` — feita

A Tarefa 6 só tinha tocado os ~15 citados nominalmente pela análise de
usabilidade. Varredura em Python (regex de blocos Unicode de emoji,
excluindo setas/✓ — glyphs tipográficos simples, não pictogramas
coloridos, mesmo critério da Tarefa 6) achou mais 24 ocorrências em
`.rd-btn`, zero em `.rd-chip` (já limpo). Todas removidas.

- **Com texto ao lado** (maioria — barra de ações do orçamento aberto, OS,
  ficha de cliente, produto no Estoque): emoji removido, texto fica
  sozinho. Ex.: "📋 Gerar OS" → "Gerar OS".
- **Badges dinâmicos com emoji embutido no texto** (2 achados no caminho):
  `stTx` da barra de ações da OS (✅/⚠️/📅 Concluída/Atrasada/Agendada) e
  o aviso "⏳ preço a revalidar" do orçamento — removido também, o badge já
  comunica por cor.
- **Ícone sozinho, sem texto** (3 botões de ação da tabela de Despesas —
  reembolsar/ver comprovante/excluir, espaço de coluna não cabe texto):
  emoji trocado por SVG de traço 1.8 (mesmo padrão da Tarefa 1), não
  "simplesmente removido" — apagar deixaria o botão vazio. Ícones novos:
  check (reembolsar), documento (ver comprovante, reaproveita o path já
  usado em Orçamentos/Histórico), lixeira (excluir).
- **Não mexido:** "✓ Recebi" (A Receber) — glyph tipográfico simples
  (U+2713), mesmo critério das setas já excluídas na Tarefa 1/6.

Testado no browser local (dbOk=true): orçamento aberto (PDF/Duplicar/OS/
WA/Excluir), produto do Estoque (+Entrada/−Saída/Corrigir/Reserva/
Transferir/Histórico) — ambos com dado real, sem emoji; botões de ícone
de Despesas testados com linha sintética injetada (sem despesa no mês
testado) — os 3 SVGs renderizam alinhados dentro do botão (`.rd-btn` já é
`inline-flex` centralizado, não precisou de CSS novo). Sintaxe validada
via `new Function` (JXA). Sem erro novo no console. `sw.js` v154→v155.

### Legenda do calendário — cor fixa corrigida sem trocar por `var(--c1)`

A Tarefa 6 tinha achado que mexer só na legenda ("Do orçamento") sem
também mexer no `app.js` criaria uma inconsistência nova (pontos reais do
calendário continuariam laranja). **Ao corrigir os dois juntos, achei um
segundo problema que a análise de usabilidade não previu:** trocar
`#c45e0a` por `var(--c1)` faria "Do orçamento" colidir visualmente com
"Serviço avulso" — a categoria `servico` já é azul (`#1d4ed8`/`#2563eb`)
nos dois lugares (`tipoCor`/legenda), e `var(--c1)` no tema padrão da
Forthemp **também** resolve pra azul (`#0B62CE`). Duas categorias do
mesmo seletor ficariam quase idênticas.

**Fix:** não usar `var(--c1)` aqui — trocar o laranja específico da
Forthemp por um tom que já existe no design system e não colide com as
outras duas categorias (`vistoria` roxo `#7c3aed`, `servico` azul):
`#A6521A`/`#FDF3E7` (`--warn`/`--warn-bg`, já usados em toda badge de
"atenção" do redesign). Os 3 pontos que usavam o hex antigo agora usam o
mesmo tom, nos 3 lugares — legenda (`index.html`), pílula do dia no
calendário e badge do modal "detalhes da OS" (`app.js`, `tipoCor`/
`tipoBg`/`extraStyle`). Emoji das 4 legendas removido de brinde (já
tinham swatch de cor + texto — mesmo critério da varredura acima).
**Não mexido:** os emoji dentro das pílulas de dia do calendário
(`🔧`/`✅`/`🚫`/`🔍`/`📄` antes do nome do cliente) — ali NÃO são
redundantes: são o único sinal não-cor pra diferenciar 5 tipos de evento
dentro de uma pílula de 10px, mesmo critério que manteve forma+cor no
Estoque/Vistoria.

Testado no browser local: legenda com os 4 itens sem emoji e cor
consistente; pílula de dia sintética (`#A6521A`) confere visualmente com
a legenda; `verDetalhesOS()` chamado com objeto sintético — badge "Do
orçamento" no modal com o mesmo tom, claramente diferente do azul de
"Serviço avulso". Sintaxe validada via `new Function`. `sw.js` v155→v156.

---

## Fase 9c-rev ajustada — forma além de cor no dot da Vistoria (14/08, pedido do Marcos)

O Marcos pediu pra conferir se o dot novo da Fase 9c-rev (logo abaixo) e a
correção de acessibilidade que a Tarefa 6 do plano de acabamento tinha
acabado de fazer em Estoque eram "a mesma coisa" — e eram: os dois são o
achado #10 da análise de usabilidade ("pontos de status de 7px em Estoque
e Vistoria comunicam apenas por cor"). Só que a Fase 9c-rev (commit
`605ca42`) resolveu o `.vis-equip-hdr::before` como um dot **só de cor**
(verde/âmbar/vermelho) — reintroduzindo, sem querer, o exato problema que
a Tarefa 6 tinha corrigido em Estoque horas antes na mesma sessão.

**As duas não eram excludentes** — a ideia de esconder emoji+pílula no
mobile pra descongestionar o cabeçalho recolhido é boa e ficou; só faltava
a forma. Ajustado em cima do `.vis-equip-hdr::before` já existente, mesmo
vocabulário do Estoque: **círculo cheio** = bom, **anel** (`border`,
fundo transparente) = atenção, **triângulo** (`clip-path`) = crítico —
literalmente as 3 formas que a análise de usabilidade sugeriu. "Não
avaliado" (sem `status-*`) fica cinza cheio — não é severidade, não
precisava de forma própria.

Testado no browser local (`dbOk=false`, 4 blocos sintéticos injetados
direto no DOM — bom/atenção/crítico/não avaliado, mesmo markup real de
`buildEquipBlock()`): 375px mostra círculo verde, anel âmbar, triângulo
vermelho e círculo cinza, emoji/pílula ocultos; 1440px sem nenhuma
mudança (emoji+pílula de volta, media query não vaza). `sw.js` v153→v154.

---

## REDESIGN Fase 9b-rev + 9c-rev fechadas — wizard literal + dot colorido (14/08)

Duas sessões trabalharam no MESMO worktree ao mesmo tempo hoje (achado, não
plano — ver seção logo abaixo). Esta entrada documenta as duas revisões da
Fase 9 pedidas pelo Marcos depois de ver as 3 telas mobile no ar; a outra
sessão, em paralelo, fez as Tarefas 1-5 do "plano de acabamento" (ver seção
seguinte). **Nenhuma sobreposição de arquivo/função entre as duas** — conferido
commit a commit (`19b9b3f`…`1361cb6`) antes de continuar: nenhum toca
`page-form`, `#orc-step-*`, `vis-equip-block` ou `renderVisEquipGrid()`.

**Contexto:** a Fase 9 original (ver entrada mais abaixo) tinha ficado
deliberadamente conservadora — indicador de passos que só rola até a seção
(Novo Orçamento) e cor de borda já existente sem recriar nada (Vistoria). O
Marcos perguntou direto por que a captura de dado não tinha sido recriada como
o mock mostrava, e pediu explicitamente para implementar mesmo com o risco que
eu tinha levantado ("então preciso que você faça").

**Fase 9b-rev — wizard literal no Novo Orçamento mobile.** Ao reavaliar o
risco que motivou a versão conservadora original (esconder campos por passo
quebraria autosave/prévia ao vivo): **falso** — `upd()` e o autosave de
rascunho leem `.value` direto do input, não dependem de visibilidade/
`display`. `_orcMobileStep`/`_orcApplyMobileStep`/`_orcIrParaPasso`/
`_orcMobileFinalizar` (app.js) — 3 grupos de campos (`orc-step-cliente`/
`orc-step-servicos-card`/`orc-step-final`+`card-os-toggle`) escondidos por
`style.display` conforme o passo atual, só abaixo de 900px
(`_orcIsMobileWizard()`). Indicador de passos (`#novo-orc-steps`) ganhou
estado `.on`/`.done`; barra fixa no rodapé (`#novo-orc-mobile-bar`) troca
Voltar/Próximo/Gerar PDF dinamicamente. **Validação nunca aponta pra campo
escondido**: `_orcMobileFinalizar()` checa os 3 campos obrigatórios do Passo 1
(`cli`/`loc`/`origem-cli`) e força volta ao Passo 1 ANTES de chamar o
`gerarPDF()` real (não modificado) — os 3 únicos `scrollIntoView`/`focus` de
validação vivem todos no Passo 1. Reset em `novoOrc()`/`abrirOrc()`/
`duplicarOrc()`. Escape-hatch: os botões reais "Salvar rascunho"/"Gerar PDF"
do topbar continuam sempre visíveis, nenhum passo bloqueia salvar.

Esta revisão foi implementada e testada por uma sessão que bateu o **limite de
uso da conta** com o trabalho pronto no worktree mas sem commitar — outra
sessão assumiu, revisou o diff inteiro antes de commitar (achou e corrigiu 1
bug real: só os 3 pontos de entrada originais chamavam
`_orcApplyMobileStep()`, então chegar em `'form'` por outro caminho —
guardrail de vendas, botão "← Voltar" de OS — deixava a barra de ações mobile
vazia; fix: 1 chamada a mais dentro do próprio `if(p==='form')` de `go()`,
idempotente). Testado (mobile 375px + desktop, `dbOk=false`): barra populada
em todos os caminhos de entrada, navegação entre os 3 passos, validação volta
pro passo 1, desktop sem regressão. `sw.js` v137→v138 (nessa sessão anterior).

**Fase 9c-rev — status por dot colorido na Vistoria mobile (agora, sessão
atual).** Só CSS, aditivo, abaixo de 680px: `.vis-equip-hdr::before` vira um
círculo de 10px na cor do status (`--green`/`--yellow`/`--red`, mesmas
variáveis que já coloriam a borda/fundo do card), substituindo visualmente o
emoji (`.vis-equip-emoji{display:none}`) e a pílula de texto
(`.vis-equip-badge{display:none}`) — os dois elementos continuam no DOM
(nada de captura foi reescrito), só ficam ocultos no mobile. Botões de
status/observação/fotos dentro do card, inalterados. Testado no browser local
(`dbOk=false`, 3 equipamentos sintéticos bom/atenção/crítico): 375px mostra
dot verde/âmbar/vermelho + nome, sem emoji/pílula, tanto expandido quanto
recolhido; 1440px confirma `content:none` no `::before` — emoji e pílula
voltam a aparecer, zero regressão desktop. `sw.js` v151→v152.

---

## ⚠️ Duas sessões no MESMO worktree ao mesmo tempo — 2ª ocorrência real (14/08)

Aconteceu de novo (1ª vez documentada em 08/08, seção "Duas sessões de IA
escrevendo no MESMO worktree", mais abaixo). Desta vez foi mais sério: durante
uma falha de permissão de disco (TCC do macOS) que bloqueou toda leitura/
escrita de uma sessão por vários minutos, a OUTRA sessão continuou operando no
mesmo worktree físico e commitou 5 vezes (`19b9b3f`…`1361cb6`, "Tarefas 1-5 do
plano de acabamento") — e, como as duas sessões compartilham os MESMOS
arquivos em disco (não são checkouts separados), esses commits também
arrastaram junto o trabalho não commitado da sessão bloqueada (Fase 9b-rev).

Nenhum dado foi perdido — mas só porque a sessão que recuperou o acesso seguiu
o protocolo já documentado neste arquivo (seção "🔄 SINCRONIZE COM O
`origin/main`" mais abaixo) **antes de mexer em qualquer coisa**: confirmou
working tree limpo (`git diff --quiet`), rodou `git fetch origin`, viu que o
HEAD local estava 5 commits atrás, e só então `git reset --hard origin/main`.
Depois conferiu por `grep` que as funções da Fase 9b-rev sobreviveram
intactas no novo HEAD, e revisou os 5 commits da outra sessão (`git show
--stat` em cada um) antes de continuar trabalhando, para confirmar zero
sobreposição de arquivo/função com o que viria a seguir (Fase 9c-rev).

**Lição reforçada:** o protocolo de sincronização não é só "rodar no início
da sessão" — é rodar de novo **depois de qualquer interrupção longa**
(falha de ambiente, limite de uso, o que for), porque é exatamente nessa
janela que a outra sessão tem chance de commitar por baixo.

---

## Plano de acabamento do redesign — Tarefa 1 fechada: ícones SVG na navegação mobile (14/08)

Segunda leva de feedback pós-implementação (`design_handoff_fluxa_redesign 2/`,
`ANALISE-USABILIDADE.md` + `PLANO-ACABAMENTO.md`, 6 tarefas por ordem de
retorno). Iniciando a execução, uma tarefa por commit, como nas fases
anteriores. **Tarefa 4 (unificar fonte de "A Receber") continua bloqueada —
precisa de decisão do Marcos entre migração retroativa e soma das duas
fontes**, já perguntado no achado de 14/08 acima.

**Tarefa 1 — feita.** `.mob-nb` (nav inferior mobile) usava emoji (🔍🗂️☀️＋📋📊☰)
enquanto a sidebar ao lado já usava SVG de traço desde a Fase 2 — as duas
navegações principais do produto em idiomas visuais diferentes. Troquei os 7
emoji pelos mesmos paths SVG do item equivalente da sidebar (mesma rota):
Vistorias→lupa, Minhas OS/OS→3 linhas, Hoje→pulso, Orçam.→mais, Histórico→
documento, Mais→hambúrguer novo (`M4 6h16M4 12h16M4 18h16`, não existia
ícone de sidebar equivalente). `.micon` deixou de ser `font-size` de emoji e
virou wrapper `19×19` com `display:flex`; o SVG interno herda `currentColor`
— o estado ativo (`.mob-nb.on{color:var(--c1)}`) continua funcionando sem
mudança de JS.

Testado no browser local (porta nova, `8912`, evitando o cache de porta
reaproveitada já registrado neste arquivo): os 7 ícones renderizam em 375px,
estado ativo "Hoje" em azul, sem emoji residual, sem erro novo no console;
sidebar desktop (1440px) sem regressão — o seletor `.mob-nb .micon` não
alcança `.sicon` da sidebar. `sw.js` v146→v147.

**Tarefa 2 — feita.** `#page-history` empilhava 5 blocos de análise (KPIs,
gráfico de faturamento, origem dos clientes, alerta de estoque, resumo do
período) **antes** da lista de orçamentos, que era o ponto da tela — a fila
de trabalho ficava abaixo da dobra em qualquer monitor.

- **Lista sobe ao topo** de `#page-history` (era o último bloco do `.wrap`,
  virou o primeiro).
- **`#dash-estoque-card` removido**, não só escondido: duplicava o item
  `estoque-ruptura` que a fila "Precisa de você hoje" do Insights já mostra
  (`_itensPainelHoje()`, confirmado por grep antes de decidir). Foram junto,
  por não terem outro chamador (conferido por grep): `dispensarAlertaEstoque()`,
  `_estoqueDismissAtivo()`, `renderEstoqueDash()` e a chave `fluxa_estoque_dismiss`
  do localStorage.
- **Gráfico de faturamento (`#dash-chart`) e Origem dos Clientes
  (`#dash-origem-card`) migraram para `page-produtividade`** — o Insights já
  tem gráfico próprio (`#ins-chart`), e Produtividade é a tela de análise.
  `renderGraficoDash()`/`renderOrigemDash()` (funções inalteradas) agora
  disparam em `go('produtividade')` e em `trocarLojaAtiva()` quando a página
  ativa é produtividade — **não mais** em `go('history')`/`trocarLojaAtiva()`
  pid `history`. `atualizarDash()` (chamada em ~15 pontos do app sempre que
  orçamentos mudam, não só na navegação) manteve a chamada a
  `renderOrigemDash()` — inofensiva mesmo com a página fechada, o dado só
  fica pronto quando o gestor abrir Produtividade.
- **"Resumo do período" ganhou uma linha explícita** ("recorte de período só
  deste resumo — a lista de orçamentos acima mostra todos os orçamentos
  abertos, não é filtrada por mês") — antes o card ficava acima da lista e a
  relação entre os dois não estava dita em lugar nenhum.
- **Não fiz:** remover o card "A Receber" (`#d-rec`) do `.dash` — isso é a
  Tarefa 4, bloqueada em decisão do Marcos (achado de 14/08 acima).

Testado no browser local (dbOk=true, conectado no Supabase real — só
leitura, nenhum dado criado/alterado): sessão de teste via `setSessao()`
para passar o guardrail de perfil. `#page-history` renderiza lista → KPIs →
resumo, nessa ordem, com 304 orçamentos reais paginados (25/página);
`#page-produtividade` renderiza o gráfico de faturamento (canvas com largura
real, não o bug de canvas 0px que o handoff avisava) e origem dos clientes
com dados reais; mobile 375px sem regressão; sem erro novo no console.
`sw.js` v147→v148.

**Tarefas 3 e 3b — feitas (mesmo commit, como o plano pedia).** Sidebar
reorganizada por frequência de uso real informada pelo Marcos (14/08), não
mais por "o que a tela é" — referência `Fluxa Nav v2.dc.html`.

- **Botão primário fixo no topo**, acima do seletor de unidade:
  `.snav-primary-btn`, mesma cor/hover de `.rd-btn-primary` (`var(--c1)` /
  `var(--c1-hover)`). Herdou o `onclick="novoOrc();go('form')"` do antigo
  `snb-form`, que foi removido — assim como `snb-os` (+ OS), ambos marcados
  `<!-- temporário -->` desde a Fase 2: a condição que os segurava (botão
  primário ainda não existia nas listas) foi satisfeita pelas Fases 5/6.
  `novaOS()`/`novoOrc()` continuam com outros chamadores (barra de OS,
  nav mobile), não viraram código morto.
- **3 grupos novos**, substituindo Operação/Comercial/Recursos: **Dia a
  dia** (Hoje, Orçamentos, Estoque, A Receber, Vistorias — e Minhas OS,
  visível só pro técnico), **Operação** (Ordens de Serviço, Agenda, Venda
  Rápida), **Cadastros e análise** (Clientes, Equipamentos, Despesas,
  Produtividade). Cada grupo virou um `<div class="snav-group">` para a
  regra abaixo conseguir mirar por container.
- **Rótulo de grupo vazio some sozinho.** Com um perfil que esconde todos os
  itens de um grupo (ex.: técnico não vê nada de "Cadastros e análise"),
  o `<span class="snav-group-lbl">` ficaria sozinho, sem lista embaixo —
  `aplicarPermissoesPerfil()` agora varre cada `.snav-group` depois de
  aplicar `snbRules` e esconde o rótulo se nenhum `.snb` ali dentro ficou
  visível. Testado com sessão técnico sintética: "Dia a dia" sobra só com
  Vistorias + Minhas OS (rótulo fica), "Operação" só com Venda Rápida
  (rótulo fica), "Cadastros e análise" fica 100% oculto, rótulo incluso.
- **Seletor de unidade da sidebar virou o seletor real** (Tarefa 3b): antes
  eram DOIS controles de unidade na mesma tela — `#hdr-loja-select` no
  header (que funcionava) e `.snav-unit` na sidebar (que só abria o menu de
  Configurações via `toggleGear()`, parecia seletor e não era). Removido
  `#hdr-loja-select` do header (junto a `.loja-select` morta em
  `styles.css`, sem outro uso). No lugar: `<select id="snav-unit-select">`
  nativo, transparente (`opacity:0`), posicionado por cima do bloco visual
  `.snav-unit` — abre a lista nativa do sistema operacional e dispara
  `trocarLojaAtiva(this.value)` direto, sem depender de JS pra desenhar um
  popover. `populaLojaSelect()` (app.js) passou a escrever nesse select, não
  mais no do header. Acessibilidade de graça: é um `<select>` de verdade,
  então tab/setas do teclado já funcionam (o `<div onclick>` antigo não
  tinha nenhum dos dois). Critério de exibição não mudou: só
  `isMainGestor()`, controlado por `atualizarHeaderLoja()` como já era.
- **Modo colapsado:** botão primário vira quadrado só com o ícone
  (`.sidebar.collapsed .snav-primary-label{opacity:0}`); seletor de unidade
  continua oculto no colapsado, como já era.

Testado no browser local (dbOk=true, só leitura): sessão master sintética —
estrutura completa bate com o mock (`+Novo orçamento` → Unidade → Dia a
dia/Operação/Cadastros e análise, badges reais 21/1/! chegando com o
carregamento); troquei de unidade pelo select da sidebar de verdade
(`dispatchEvent('change')`) e confirmei `trocarLojaAtiva()` rodou — header,
KPIs e nome da unidade recalcularam para Fortemp Camboriú; sessão técnico
sintética confirma o auto-hide de grupo vazio; modo colapsado (desktop) e
sidebar mobile (375px, `openSidebar()`) sem regressão; header sem vão onde
o `<select>` antigo ficava; sem erro novo no console. `sw.js` v148→v149.

**Tarefa 3c — feita** (a maior das 6, ~35 pontos de chamada de `confirmar()`
e ~80 de `toast()` no app inteiro). Referência `Fluxa Feedback.dc.html`.
Escopo desta sessão: reescrever os DOIS componentes-base (`toast()` e
`confirmar()`) com assinatura nova retrocompatível, migrar **só**
`#confirmar-modal-bg` para o shell novo, e marcar `destrutivo:true` nos
pontos de exclusão/ação irreversível — deixando o resto para depois, como
o próprio plano manda ("migrar por uso, não de uma vez").

- **`toast(msg, opts)`** — `opts={tipo:'ok'|'warn'|'bad'|'info', titulo, ms,
  acao:{label,fn}}`. `toast('msg')` (as ~80 chamadas existentes) continua
  funcionando, cai em `info`. Ícone à esquerda por severidade, título+
  mensagem que **quebra linha** (`max-width:min(560px,calc(100vw-32px))` —
  antes era `white-space:nowrap`, estourava a tela no celular), botão de
  ação opcional (ex.: "Desfazer"), ✕ de fechar, barra de tempo na cor do
  estado. `pointer-events:none` **removido** — só existia porque nada no
  toast era clicável; agora o botão de ação precisa funcionar.
  **Duração:** 4000 padrão, 8000 para `bad`/`warn`, `ms:0` fica permanente.
  **A regex que adivinhava severidade pelo texto (`/⚠️|❌|erro|falh|.../`)
  foi removida, como o plano pedia** — consequência real: chamadas antigas
  não migradas (as ~80) agora mostram 4s mesmo quando o texto tem "erro" ou
  "falhou" (antes ganhavam 8,5s pela regex). Aceito de propósito, registrado
  aqui pra não parecer regressão silenciosa — resolve conforme cada chamada
  for migrada para passar `opts.tipo` (mesmo padrão do "emoji duplicado" do
  plano). `aria-live` vira `polite` quando o toast tem ação (`assertive`
  interromperia o leitor de tela no meio de outra coisa).
- **`confirmar()`** — aceita objeto novo
  (`{titulo,msg,detalhe:[{k,v}],destrutivo,labelSim,labelNao,onSim,onNao}`)
  **ou** os argumentos posicionais de sempre
  (`confirmar(msg,cbSim,titulo,cbNao,labelNao,labelSim)`), que continuam
  funcionando sem mudar nenhuma das ~35 chamadas restantes. Sem
  `destrutivo`, o comportamento é idêntico ao de antes (foco no "Confirmar",
  igual sempre foi). Com `destrutivo:true`: ícone e botão de confirmar em
  vermelho, **foco inicial no botão de CANCELAR** — a correção do bug real
  que a análise de usabilidade achou (`setTimeout(()=>simBtn.focus(),50)`
  focava sempre o botão de confirmar; num diálogo de exclusão, Enter
  apagava). Bloco `detalhe` opcional (fundo cinza, vermelho-claro se
  destrutivo) pra mostrar os números afetados. Escape e clique no fundo
  fecham cancelando; foco volta pra quem abriu o diálogo ao fechar.
- **Shell novo só em `#confirmar-modal-bg`** (`.rd-modal-bg`/`.rd-modal`,
  raio 14, sombra unificada, animação fade+card 160/200ms, vira folha com
  grip abaixo de 680px). Os outros 3 modais que usam `.modal-bg`/`.modal`
  (`crm-contato-bg`, `receb-bg`, `aprov-os-bg`) **não foram tocados** —
  migração deles é próxima tarefa, "um de cada vez" como o plano pede.
  IDs do modal (`confirmar-modal-bg/titulo/msg/nao/sim`) mantidos
  **exatamente iguais**: `_excluirOrcVerificarEstoque()` clona
  `#confirmar-nao` em tempo de execução pra adicionar um 3º botão
  ("Não estornar") — testado manualmente contra o shell novo, o hack
  continua funcionando sem mudança.
- **9 pontos de exclusão/ação irreversível upgradados para
  `destrutivo:true`**, com mensagem honesta sobre a consequência real
  (verificada lendo a função que executa, não copiada do mock): excluir
  orçamento (libera reserva de estoque + remove parcelas), excluir OS,
  excluir cliente, excluir despesa, excluir equipamento, desativar usuário,
  remover local recorrente (desativa agendamento + cancela OS agendadas),
  excluir vistoria, remover fornecedor, cancelar série de OS, confirmar
  balanço de inventário (já dizia "não pode ser desfeita"). Descartar
  vistoria em andamento ganhou `destrutivo` **condicional**: só quando é
  vistoria nova (perda real) — descartar uma *edição* continua não-
  destrutivo, porque a vistoria já salva não é apagada, só as edições da
  sessão. **Não upgradado, de propósito:** desativar produto (a própria
  mensagem já diz "pode reativar depois" — não é destrutivo de verdade),
  recusar orçamento/check-out/marcar OS concluída/confirmar recebimento de
  OC (ações de fluxo normal, reversíveis, não perda de dado).
- **Não fiz** (registrado no `PLANO-ACABAMENTO.md` como "depois"): migrar
  `crm-contato-bg`/`receb-bg`/`aprov-os-bg` para o shell novo; os modais
  montados em string no JS (`#dup-modal-bg`, `#qr-modal-bg`,
  `#nfe-modal-bg`) ganharem o helper `abrirModal({titulo,corpo,acoes})`;
  variante de progresso do `confirmar()` pra operação em lote (a barra
  já existe em CSS/spec, só não foi ligada em nenhum fluxo real); tirar
  emoji das ~80 chamadas de `toast()` restantes.

Testado no browser local (dbOk=true, só leitura): as 4 severidades de toast
(ok/warn/bad/info, ícone e cor certos); `toast('msg')` antigo sem título,
quebrando linha, sem estourar; diálogo destrutivo real (`excluirOrc` com id
inexistente) — ícone/botão vermelhos, foco confirmado em `confirmar-nao`
via `document.activeElement`, hint visível; Escape fecha cancelando; clique
no fundo fecha cancelando; diálogo não-destrutivo com bloco `detalhe`
renderizando linhas; hack de clonagem do botão (`_excluirOrcVerificarEstoque`)
simulado manualmente contra o shell novo — 3 botões, sem erro; folha mobile
(375px) com grip, ancorada no rodapé; os 3 outros `.modal-bg` conferidos
sem classe alterada; sintaxe do `app.js` validada via `new Function` (JXA);
sem erro novo no console. `sw.js` v149→v150.

**Tarefa 5 — feita.** Duas correções pequenas, mesmo commit.

- **Primeira coluna fixa** nas 5 tabelas que a Fase 5 tinha deixado "pra
  depois se fizer falta" — fazia: em 375px, ao rolar até "Próxima ação" o
  nome do cliente já tinha saído da tela. As 5 já tinham rolagem horizontal
  (wrapper `overflow-x:auto` + `min-width` por tabela, do próprio handoff);
  faltava só a coluna de identificação não sumir. `position:sticky;left:0`
  (ou `left:<Xpx>` quando o cliente/descrição é a 2ª coluna, não a 1ª) só
  abaixo de 680px, escopado por id de container — cada tabela tem uma
  largura de coluna(s) diferente antes da que fica fixa, não dá pra usar
  uma regra genérica:
  - `#receb-lista`, `#estoque-body` — Cliente/Produto já são a 1ª coluna,
    só ela fica fixa.
  - `#hist-body` (Orçamentos, 64px de Nº antes), `#osh-body` (OS, 100px de
    Data antes), `#desp-lista` (Despesas, 84px de Data antes) — 1ª E 2ª
    coluna ficam fixas juntas (senão sobraria um vão em branco à esquerda
    da coluna do cliente ao rolar).
  Fundo sólido por estado da linha (normal/hover/`rd-row-action`/
  `rd-row-warn`) nas células fixas — sem isso o conteúdo das outras colunas
  passa por baixo ao rolar. Sombra sutil (`2px 0 4px`) separando a área fixa
  da rolável. **Não mexido:** Equipamentos e Produtividade — fora da lista
  que a análise de usabilidade citou.
- **Skeleton em vez de spinner** — `.rd-skel` foi construído na Fase 3 e
  nunca tinha sido usado (`grep` confirmou zero ocorrências antes desta
  tarefa). `#ins-fila-corpo` abria com `<div class="load"><div
  class="spin">…` — spinner centralizado, menor que o conteúdo final, a
  tela saltava quando os dados chegavam. Substituído por 3 blocos no
  padrão `.rd-q-item`/`.rd-q-compact` (mesmo componente da fila de
  verdade, então a altura bate exata). Os 4 KPIs do Insights (`ins-d-*`)
  ganharam o mesmo tratamento — bloco cinza (translúcido no card escuro do
  Pipeline) no lugar do "—". Nenhuma mudança em `app.js`: os `set(id,
  txt){ el.textContent=txt }` que populam esses elementos já limpam
  qualquer filho ao escrever o valor real, então o skeleton "se remove
  sozinho" assim que os dados chegam.

Testado no browser local (dbOk=true, só leitura): coluna fixa confirmada
via scroll programático (`scrollLeft`) nas 5 tabelas — Orçamentos e Estoque
com dados reais (screenshot: Nº+Cliente permanecem visíveis rolando até
"Próxima ação"), OS/Despesas/A Receber com `getComputedStyle` (`despesas`
sem dado no mês testado, verificado com linha sintética injetada só pra
conferir o CSS); desktop confere `position:static` — a regra não vaza pra
telas largas. Skeleton renderizado com a mesma altura dos itens reais
(visual, screenshot), shimmer herda `.rd-skel::after` já existente.
`sw.js` v150→v151.

**Tarefa 6 — feita (acabamento, um commit só).** Última do plano — só a
Tarefa 4 continua bloqueada (decisão do Marcos sobre "A Receber").

- **Emoji em botões/abas** — removidos dos itens que o plano citava
  nominalmente (Nova Vistoria/Histórico/Meus Locais, Calendário/Contratos,
  Com Crítico/Com Atenção, Backup, Check-in ×2, Concluídas, Dar baixa,
  Gerar da lista, Enviar WhatsApp, Balcão, Reorganizar) + o botão
  "Histórico" do modal de produto do Estoque, mesmo padrão. **Achado no
  caminho:** os chips "Com Crítico"/"Com Atenção" de Vistorias não tinham
  NENHUM outro sinal visual além do 🔴/⚠️ — removendo o emoji cru, ficariam
  idênticos aos chips neutros. Criada `.rd-chip-crit`/`.rd-chip-alert`
  (a segunda já existia, usada no chip "Vencido" do Histórico de
  Orçamentos) e `filtVisStatus()` (app.js) reescrita pra alternar `on`
  (selecionado) ↔ cor de severidade (não selecionado) — nunca as duas
  juntas, mesmo padrão dos chips "Vencido"/"Repor" já usados em
  Orçamentos/OS/A Receber. **Não fiz:** varredura completa das ~23
  ocorrências — só as citadas + 1 achada no mesmo padrão; o resto continua
  pendente, como o plano já previa ("sem pressa").
- **Emoji no placeholder** — só `#hist-busca-input` (único citado
  nominalmente). Vira ícone de lupa posicionado dentro do campo
  (`position:absolute` + `padding-left` no input), placeholder sem emoji.
  Os outros 11 campos de busca do app com o mesmo padrão (`🔍 Buscar...`)
  não foram tocados — fora do escopo que o plano definiu.
- **Hex laranja fixo** — só 2 dos "3 pontos" que o plano listava. Botão da
  tela de erro (`#fluxa-error-screen`) virou `var(--c1,#0B62CE)`, sem
  dependência — feito. Swatch da legenda do calendário ("📄 Do orçamento",
  `#c45e0a`) **não mexido**: achado no caminho — mudar só o swatch sem
  também mudar `app.js` (`tipoCor.orcamento` nas linhas ~9370/9347, usado
  nos pontos do calendário E no modal de detalhes da OS) criaria uma
  inconsistência NOVA (legenda de uma cor, pontos de outra) pior que a que
  existe hoje. Registrado para quando alguém tocar o sistema de cores do
  calendário como um todo — não é um ponto isolado como o plano estimou.
  3º ponto (default do seletor de cor em Configurações) meio deixado de
  propósito pelo próprio plano ("pode continuar laranja se for
  intencional").
- **Rótulo de valor no `#ins-chart`** — plugin do Chart.js
  (`afterDatasetsDraw`) desenha o valor abreviado ("62,4k") no topo de
  cada barra de Aprovado, mesma ideia do gráfico de aging de A Receber
  (que é HTML/CSS puro — aqui precisou de plugin porque é canvas).
  **Bug pego no próprio teste:** a primeira versão lia o valor de uma
  variável (`aprovDados`) capturada no closure do render — funciona no
  fluxo normal (a função sempre roda de novo antes do plugin desenhar),
  mas eu testei mutando `chart.data` direto + `.update()` pra simular
  dado sintético, e os rótulos não apareciam (closure desatualizado,
  ainda via zeros). Corrigido pra ler de `chart.data.datasets[0].data[i]`
  em vez do closure — mais robusto de qualquer forma, não depende de quem
  chama `.update()`.
- **Chip de filtro ativo em "Em que fase está"** — dois ajustes. (1) texto
  do subtítulo virou neutro quanto à posição ("toque numa faixa pra
  filtrar a fila", sem "ao lado" — abaixo de 1180px a fila fica ACIMA,
  não ao lado). (2) chip removível novo no cabeçalho de "Precisa de você
  hoje" (`#ins-fila-chip-filtro`), mostra o nome da fase + ✕, clicar limpa
  o filtro. **Bug pego no próprio teste:** quando o pipeline está vazio
  (`pipeQtd=0`), `_crmRenderEstagio()` sempre teve um `return` antecipado
  que esconde o card inteiro — meu código do chip vinha DEPOIS desse
  return, então clicar no chip pra limpar o filtro nunca escondia o
  próprio chip (ficava preso mostrando um filtro que a função nunca
  chegava a recalcular). Corrigido: o `return` antecipado agora também
  zera `_crmFaixaFiltro` e esconde o chip.
- **`role="button"` + teclado nas linhas clicáveis** — as 3 tabelas com
  `.rd-row` clicável (Orçamentos, OS, Estoque) ganharam `role="button"`,
  `aria-label` e handler de **Espaço** (só tinham Enter). De brinde,
  Estoque ganhou forma além de cor no ponto de status (achado #10 da
  análise): círculo cheio = normal, **anel** = abaixo do mínimo/encomenda,
  quadrado = sem giro — mesma correção aplicada ao ponto de garantia de
  equipamento na ficha do cliente (só esse, achado no mesmo padrão; o
  "e Vistoria" que a análise citava não existe mais como ponto de 7px —
  o histórico de vistoria já usa emoji distinto por status, não só cor).

**Achado à parte, não corrigido (pré-existente, não é desta tarefa):**
navegar para "Hoje" repetidas vezes em sequência rápida (múltiplos
`go('insights')` no mesmo tick) pode disparar "Canvas is already in use"
no `#ins-chart` — `go()` chama `renderPainelInsights()` de forma síncrona
E de novo dentro de um `.then()` do carregamento de dados; sob navegação
rápida o `Chart.destroy()`/`new Chart()` de `renderInsightsChart()` corre
risco de sobrepor. **Confirmado com `git stash` que o bug já existia antes
desta sessão** (reproduz igual no código anterior à Tarefa 6) — não é
regressão desta tarefa. Não acontece em uso normal (testado à exaustão
nesta sessão com navegação única); só sob clique/chamada repetida na
mesma tela em milissegundos.

Testado no browser local (dbOk=true, só leitura): os 4 achados acima
(closure do gráfico, chip preso, chips de severidade sem cor) pegos e
corrigidos DURANTE o próprio teste, não só depois; anel âmbar visível em
produtos reais abaixo do mínimo (filtro "Repor"); chip "Quente ✕"
aparecendo/sumindo corretamente com dado sintético (pipeline vazio nos
dados reais desta sessão); campo de busca com ícone; tela de erro em
azul; chips de vistoria alternando on↔cor; sintaxe validada via
`new Function` (JXA) duas vezes (antes e depois do fix do closure); sem
erro novo no console em navegação normal. `sw.js` v151→v152.

## ✅ RESOLVIDO — botão antigo de Pagamento removido (14/08, decisão do Marcos)

O achado abaixo foi levado direto pro Marcos (com explicação de onde o
tipo de pagamento é definido no orçamento e onde as parcelas nascem de
verdade na aprovação, pra ele decidir com contexto completo). Decisão:
**remover o botão antigo.** Feito — botão "Pagamento", `abrirModalPg()`/
`fecharModal()`/`salvarPagamento()`, `#modal-pg` e a variável `modalOrcId`
removidos (nenhum tinha outro uso, conferido por grep antes de apagar).
`orcamentos.valor_recebido` em si não foi tocado (ainda alimenta o KPI
"A Receber" do Insights) — só o caminho de escrita antigo (o botão) saiu.
Testado: barra de ações do orçamento renderiza sem erro, resto dos
botões intacto. `sw.js` v145→v146.

## Achado original (contexto, já resolvido acima): dois sistemas de recebimento coexistindo (14/08)

Ao investigar o achado de ontem ("`#cr-card` em Produtividade pode ser
duplicação"), confirmei que é mais sério do que "tela repetida":
**existem dois sistemas de recebimento desconectados, ativos ao mesmo
tempo.**

- **Antigo:** `orcamentos.valor_recebido` — um número escalar por
  orçamento, sem parcela/vencimento/data de pagamento. Escrito pelo botão
  **"💰 Pagamento" que ainda existe no Histórico de Orçamentos**
  (`abrirModalPg`/`salvarPagamento`). Ainda alimenta o KPI "A Receber" do
  Insights (`d-rec`).
- **Novo (Fase 1 do roadmap de indicadores, depois Fase 8b do redesign):**
  tabela `recebimentos` — uma linha por PARCELA, com vencimento/data de
  pagamento/aging/PMR. É o que a tela dedicada "A Receber"
  (`page-recebiveis`) lê. Gerado **só na aprovação** do orçamento (não
  retroativo — o próprio código documenta por quê: dado de parcelamento
  real só existe a partir daí pra frente, gerar de trás pra frente
  inventaria vencimento).

**O problema prático:** se alguém clica no botão antigo "💰 Pagamento" de
um orçamento aprovado, o valor grava em `valor_recebido` — mas a tela
"A Receber" (`page-recebiveis`) **não lê esse campo**, só lê
`recebimentos`. Ou seja, dá pra "registrar" um pagamento que nunca aparece
na tela feita pra mostrar pagamentos. Removi só a exibição duplicada
(`#cr-card` dentro de Produtividade, que mostrava o campo antigo) — **não
mexi no botão nem no campo em si**, porque:
1. Orçamentos aprovados **antes** da Fase 1 existir nunca vão ganhar uma
   linha em `recebimentos` (o sistema novo não retroage) — pra esses,
   `valor_recebido` pode ser a única forma de registrar que foi pago.
2. Decidir se o botão antigo deve sumir, virar um atalho pro fluxo novo,
   ou os dois deveriam conviver permanentemente (um pra histórico, outro
   pra parcela) é decisão de produto — de quem sabe se ainda tem orçamento
   velho sendo cobrado hoje.

**Pergunta direta pro Marcos:** o botão "💰 Pagamento" do Histórico ainda
é usado por alguém, ou pode sumir (redirecionando pra abrir o orçamento
na tela de A Receber, se tiver parcela lá)?

---

## Etapa 5 fechada de ponta a ponta — piscina ligada ao fluxo de vistoria (14/08)

Última pendência da Etapa 5 (roadmap de CRM). Seguida a recomendação do
próprio doc de auditoria (`docs/etapa5-ficha-tecnica-piscina-auditoria-
2026-08-12.md`, §3, opção c2): vistoria referencia a piscina do LOCAL
(plano de vistoria, `window._visLocalId`) quando existe, senão do CLIENTE.
Migração `vistorias.piscina_id text` (aditiva, já rodada em produção).

Escopo pequeno de propósito, igual o doc já registrava: só a referência.
**Não inclui** a reescrita maior de puxar equipamentos de `equipamentos`
filtrados por piscina em vez do jsonb duplicado — isso o próprio doc já
apontava como "mudança de fluxo maior", fora desta etapa.

Novo select `#vis-piscina` em "Dados da Visita", opcional, populado/
resetado em todos os pontos que trocam cliente/local (busca, autocomplete,
abrir de um plano, nova vistoria em branco, reabrir vistoria salva —
restaura o `piscina_id` gravado). Testado com dados sintéticos (filtro por
local e por cliente, reset, reabertura, cliente sem piscina cadastrada,
mobile) — sem erro no console.

**Com isso, as 8 etapas do roadmap de CRM propostas em 12-14/08 estão
todas endereçadas** (1-6 e a Etapa 7 itens 1-2 fechadas; Etapa 8 é só
remedir o baseline depois, sem código pendente).

---

## Redesign das 4 telas restantes — em andamento (14/08)

O Marcos autorizou continuar sem supervisão ("Você está expressamente
autorizado a fazer qualquer atualização aí que você necessite"). Retomando
a lista de telas sem handoff pronto (README não cobre): **Vistoria
desktop, Agenda, Equipamentos, Produtividade**. Sem mockup literal —
seguindo os padrões `.rd-*` já estabelecidos nas 13 telas já feitas.

**Equipamentos — fechada.** `renderEqGrid()` reescrita de cards em grid
pra `rd-table-wrap` densa (mesmo idioma do Histórico de Orçamentos/
Estoque). Badge de garantia (`_eqGarantiaBadge()`) substitui o texto
solto colorido de antes. Header migrado pra `novo-orc-topbar`. Testado
com dados sintéticos (4 cenários de garantia, campos vazios, estado
vazio, mobile 375px) — sem erro no console.

**Produtividade — fechada.** Cards por técnico (`renderProd()`) migraram
pra `.rd-card`/`.rd-kpi-num`/`rd-badge` (taxa de conclusão vira badge, não
texto colorido solto). Tabela comparativa saiu de `<table>` nativo pra
`rd-table-wrap` em grid de divs, mesmo idioma do Histórico/Equipamentos.
**Achado, não mexido:** essa página tem um bloco `#cr-card` (Contas a
Receber) embutido, ainda populado por `renderContasReceber()` — mas já
existe uma tela dedicada mais completa (`page-recebiveis`, Fase 8b) fora
daqui. Pode ser duplicação a limpar, mas não tinha certeza suficiente de
que é código morto pra remover sem confirmar com o Marcos — fica
registrado, não mexi. Testado com dados sintéticos de OS por técnico,
estado "sem técnico configurado", mobile 375px — sem erro no console.

**Agenda — fechada.** Header (título + abas Calendário/Contratos + Novo)
migrado pra `novo-orc-topbar`/`rd-chip` (`agTab()` não precisou mudar,
já era agnóstico ao nome da classe). Lista de Contratos (`renderAgLista()`)
saiu de cards com hex fixo inline (`#7c3aed`) pra `rd-q-item`/`rd-q-expand`
(mesmo componente da fila "Precisa de você hoje"), badge "Plano" virou
`rd-badge` de verdade. **Calendário em si (`table.cal`) não mexido** — é
um paradigma visual diferente (grade de dias) sem equivalente `.rd-*`
pronto, arriscado migrar sem necessidade. Testado com dados sintéticos
(lista com item normal + item de plano, estado vazio, troca de aba,
calendário renderizando sem regressão, mobile 375px) — sem erro no
console.

**Vistoria desktop — fechada (escopo reduzido de propósito).** Header
(título + abas Nova Vistoria/Histórico/Meus Locais) migrado pra
`novo-orc-topbar`/`rd-chip`. Filtros do Histórico (busca/mês/técnico)
viram `rd-field-box`; chips de status (Todos/Crítico/Atenção) viram
`rd-chip`. Cabeçalho de Meus Locais migrado pra `novo-orc-titulo`.
**Formulário de captura (Nova Vistoria) e os cards de equipamento — status/
observação/foto — NÃO mexidos**, mesma cautela já registrada na Fase 9c/
Fase B da crítica de design: é a captura de dado real, alto risco pra
reescrever sem necessidade. **Também fora do escopo, registrado pra
decisão futura:** os cards de stats/ranking/lista do Histórico e o
formulário/lista de planos de Meus Locais continuam no estilo antigo —
funcionais, só não usam `.rd-*` ainda; são blocos grandes e complexos,
arriscado migrar tudo junto. Testado (3 abas trocando sem erro, filtro de
status, `renderVisHistorico()` limpo, mobile 375px) — sem erro no console.

**Com isso, as 4 telas da lista original estão com pelo menos header/
navegação/filtros no padrão novo.** As 17 telas do app inteiro (13 do
handoff + estas 4) estão, no mínimo, com a mesma tipografia/tokens/
componentes de navegação — o que ficou de fora em cada uma foi registrado
explicitamente acima, não esquecido.

---

## Etapa 7 implementada (14/08) — itens 1 e 2 da proposta

O Marcos aprovou a proposta (`docs/crm-etapas-7-8-proposta-2026-08-14.md`,
"proponham vocês o que fazem sentido") e autorizou seguir sem supervisão.
Implementados os 2 itens que exigiam código (o 3º já existia — a fila
"Precisa de você hoje"):

1. **Ligar/WhatsApp na fila agora também abrem "Registrar contato"** no
   mesmo momento (`_acaoWA()` chama `abrirCrmContato()`; o link "Ligar"
   ganhou `onclick` junto do `href="tel:..."` — `_acaoItemHTML` agora
   suporta os dois ao mesmo tempo). "Registrar contato" continua existindo
   à parte, pra quem contatou por outro canal.
2. **Sinal "Xd desde o contato" / "sem contato registrado"** no Histórico
   de Orçamentos, só em orçamento aberto (`_orcSinalContato()`, deriva de
   `crm_notas`).

Testado no browser local (`dbOk=false`): os 3 casos de `_orcSinalContato`
(sem nota/8d/hoje), sinal aparece só no pendente (não no aprovado),
`_acaoWA` abre WhatsApp E o modal com dados corretos, botão Ligar gera
`href=tel:` com `onclick` junto, fila renderiza sem erro. `sw.js`
v138→v139.

**Etapa 8** continua exatamente como a proposta define — não é código, é
remedir o baseline depois que isso gerar `crm_notas`/`proximo_contato`
de verdade. Sugestão: reexecutar por volta de 21-22/08 (uma semana depois
desta mudança ir pro ar).

---

## Fase 9b fechada + bug real achado — outra sessão bateu limite de uso (14/08)

A sessão que revisou o wizard mobile do Novo Orçamento (comentário já
documentado no HTML: "wizard literal do handoff mobile") bateu o **limite
de uso da conta** com o trabalho pronto mas não commitado — `app.js`/
`index.html`/`styles.css` ficaram modificados no worktree, sem chegar a
rodar `git commit`. O Marcos pediu pra eu assumir e fechar.

**Antes de commitar, revisei o diff inteiro** (não commitei às cegas por
cima do trabalho de outra sessão — lição já registrada neste arquivo,
"Duas sessões de IA escrevendo no MESMO worktree"). O código em si estava
completo e coerente (`_orcMobileStep`/`_orcApplyMobileStep`/
`_orcIrParaPasso`/`_orcMobileFinalizar`, chamados nos 3 pontos de entrada
do form: `novoOrc`/`abrirOrc`/`duplicarOrc`).

**🔴 Testei antes de commitar e achei um bug real:** só esses 3 pontos
chamavam `_orcApplyMobileStep()`. Quem chegava em `'form'` por qualquer
OUTRO caminho — o guardrail que redireciona `vendas` pra fora de
`pagesVendas`, ou os botões "← Voltar" das telas de OS (ambos chamam
`go('form')` direto) — nunca chamava. Resultado no mobile: a barra fixa
de ações (`#orc-mobile-acts`) ficava **completamente vazia**, sem Salvar
nem Gerar PDF, sem forma nenhuma de continuar. Reproduzido no browser
local antes de mexer em qualquer coisa.

**Fix:** uma chamada a mais, dentro do próprio bloco `if(p==='form')` de
`go()` — cobre qualquer caminho de entrada, não só os 3 que já existiam.
Idempotente (chamar de novo não quebra nada).

⚠️ **Achado no processo de debug, não no código:** o primeiro teste no
browser local deu falso-negativo — parecia que o fix não funcionava. Era
cache do navegador servindo um `app.js` antigo de um teste anterior nesta
MESMA sessão, na mesma porta (`localhost:8791`), mesmo sem Service Worker
registrado (0 registrations, 0 caches — não foi o SW, foi cache HTTP
comum do `python -m http.server`, que não manda `Cache-Control`). Resolvido
subindo o servidor de teste numa porta nova (nunca visitada antes nesta
aba). **Lição pro protocolo:** ao testar localmente na MESMA aba/porta
usada antes na sessão, ou usar porta nova, ou fazer hard-reload de
verdade — `navigate()` sozinho não é garantia de bypass de cache.

Testado (mobile 375px + desktop, `dbOk=false`): barra de ações populada
entrando via `go('form')` direto (o caminho que estava quebrado);
navegação entre os 3 passos; validação de campo obrigatório volta pro
passo 1 antes de apontar erro; desktop sem regressão (3 cards sempre
visíveis). `sw.js` v137→v138.

---

## REDESIGN — Fases 1-3 (tokens, sidebar, componentes base) — 13/08

Marcos trouxe um handoff de design completo
(`~/Downloads/design_handoff_fluxa_redesign/`: README.md + 2 arquivos
`.dc.html` estáticos de referência visual) para um redesign de navegação,
densidade e ícones do Fluxa inteiro — não é mais um ajuste pontual, é
troca de sistema visual em 13 telas + 3 mobile. Antes de escrever
qualquer código, mapeei os arquivos atuais que correspondem a cada tela
do handoff e apresentei o plano ao Marcos (ordem sugerida do próprio
README: tokens → sidebar → componentes base → telas, uma fase por vez
com aprovação entre elas — não tudo de uma sessão só).

**Três decisões tomadas com o Marcos antes de começar:**
1. **White-label preservado.** O handoff fixa `#0B62CE` como "a cor da
   marca" em todo lugar, mas o Fluxa troca `--c1`/`--c2` por empresa em
   runtime (`CFG.cor`/`LC.cor` — Forthemp é laranja `#C45E0A`, outras
   lojas têm cor própria). Decisão: `#0B62CE` vira só o DEFAULT estático
   de `--c1` (o que aparece antes do JS rodar, ou se uma empresa não tiver
   `cor` configurada) — o mecanismo de override continua intacto.
   Testado: com `CFG.cor` no valor real da Forthemp, o item ativo da
   sidebar e os botões primários saem laranja, não azul.
2. **"Insights" do handoff substitui a decisão de "Hoje"/"Resultado"**
   que fechamos mais cedo hoje (o handoff é uma tela só, sem item
   "Resultado" na nav). Ainda não fiz esse merge de conteúdo (é Fase 4) —
   por ora as duas páginas continuam existindo, `snb-insights`
   ("Resultado") marcado explicitamente como temporário no HTML: some
   assim que Financeiro/DRE/Análise de clientes forem remanejados pra
   dentro de "Hoje" na Fase 4.
3. **Fase por fase, com aprovação** — não a sessão inteira de uma vez.

### O que foi feito

**Fase 1 — tokens + tipografia.** Google Fonts trocado de Inter pra
Instrument Sans (`index.html` + cache do `sw.js`); `font-family:'Inter'`
substituído por `font-family:'Instrument Sans'` nos 3 arquivos (127
ocorrências — 55 em `index.html`, 59 em `styles.css`, 13 em `app.js`,
`sed` direto, conferido zero sobra). Tokens novos aditivos no `:root`
(`--tx2/3/4`, `--bg-app`, `--surface2`, `--line`/`--line2`,
`--nav-*`, `--ok`/`--warn`/`--bad`/`--info` + fundos, `--r-lg/sm/xs/pill`)
— **não substituem** os tokens antigos (`--gray`, `--green`, `--red` etc.
continuam com os hex de sempre, ainda usados pelas telas não migradas).
`--c1` e `--c2` mudaram só o DEFAULT (ver decisão 1 acima). `body{background}`
passou a usar `var(--bg-app)`.

**Fase 2 — sidebar.** Reescrita completa (`index.html` + CSS): fundo
`--nav-bg` fixo (`#0D131B`, não troca por empresa), logo+nome da empresa,
seletor de unidade (só aparece pra `isMainGestor()`, mesmo critério do
`<select>` antigo do header), três grupos (Operação/Comercial/Recursos)
com ícones SVG (`stroke:currentColor`, paths exatamente do README),
badges reais (`atualizarBadgesNav()` — orçamentos abertos, OS não
concluídas, parcelas vencidas, alerta de estoque negativo — reaproveita
os mesmos motores do sino de notificações, não duplica cálculo), rodapé
com Configurações (chama o `toggleGear()` já existente, não duplicou
lógica) e usuário (avatar+nome+papel). IDs de todos os `snb-*` mantidos
idênticos aos de antes — `aplicarPermissoesPerfil()`/`snbRules` não
precisou mudar. Dois grupos de itens temporários, marcados com comentário
no HTML: `snb-insights` (Resultado, decisão 2 acima) e os atalhos de
criar (`+ Orçamento`/`+ OS`/Venda Rápida) — o handoff move a criação pra
um botão primário na barra superior de cada lista, que só existe a
partir da Fase 5/6; tirar os atalhos da sidebar agora, antes de esse
botão existir, deixaria sem como criar nada.

**Fase 3 — componentes base.** Classes novas prefixadas `rd-` (botão
primário/secundário/ghost/link, campo, badge de status, chip de filtro,
pílula de atalho, cartão sem sombra — só borda, tabela densa com cabeçalho
UPPERCASE e números tabulares, estado vazio de 4 partes, skeleton com
shimmer respeitando `prefers-reduced-motion`) — **nenhuma tela usa ainda**,
zero risco, entram conforme cada tela for migrada a partir da Fase 4.

### Testado

Browser local (`dbOk=false`, sessão gestor): fonte trocou em toda a tela
confirmada via `getComputedStyle`; sidebar 240px, cor ativa laranja
Forthemp (confirmado depois de limpar `empresa_cfg` do localStorage —
tinha lixo de teste de sessão anterior sobrescrevendo `CFG.cor` pra azul,
não era bug do redesign); modo colapsado (só ícones) funciona; drawer
mobile desliza certo (um screenshot no meio da transição CSS de 250ms
pareceu cortado — não é bug, é timing de captura, confirmado com
screenshot depois da animação terminar); telas ainda não migradas
(testei Clientes) continuam renderizando normalmente ao lado da sidebar
nova, sem quebra. Zero erro de console além do ruído de 400 já
documentado. `sw.js` v124→v126.

### Próximo passo (histórico — Fase 4 já feita, ver entrada abaixo)

---

## REDESIGN — Fase 4: Insights unificado (merge "Hoje"+"Resultado") — 13/08

O handoff só tem UMA tela de landing ("Insights", rótulo de nav "Hoje") —
substitui o desdobramento "Hoje"/"Resultado" que tinha sido fechado mais
cedo hoje, como já estava documentado como decisão do Marcos na Fase 1-3.
Rota interna unificada em `'insights'` (era `'hoje'`+`'insights'`
convivendo): `go()`, `telaInicial()`, `snbRules`/`mnbRules`,
`crmFiltrarFaixa()`, `getNotificacoes()`, `crmDispensar()` — tudo
apontando pra uma função só, `renderPainelInsights()`. `page-hoje` e
`renderPainelHojePage()` foram removidos (não desviados/renomeados —
apagados, junto com `renderCadenciaFila/Proximos`, `_crmRenderTrilho`,
`_crmCardHTML`, `_cadenciaCardHTML`, `_cadenciaProximoCardHTML`,
`crmSugestaoFala` e os `CRM_TETO_*`/`CADENCIA_*_TETO` que só serviam pra
elas — ficaram órfãos com o merge, sem chamador nenhum sobrando).

**"Precisa de você hoje" é a peça central** — em vez de 3 cards
competindo (painel de sistema, fila de follow-up, cadência), agora é UMA
fila só, `_acaoQueue()`, que junta os três motores que já existiam
(`_itensPainelHoje()`, `crmCandidatos()`, `cadenciaCandidatos()` +
`cadenciaProximos()` com urgência baixa de propósito) num ranking por
urgência numérica, sem duplicar nenhum cálculo. Primeiro item vem
expandido (borda esquerda, ações Ligar/WhatsApp/Registrar contato — usa
`tel:` direto e um novo helper pequeno `_acaoWA()` pra mandar WhatsApp
sobre um orçamento específico), os demais compactos com 1 link de ação.
Teto de 7 na tela (`ACAO_TETO`), com "ver N" quando sobra mais.

**KPIs remapeados pro exato do handoff** (Pipeline aberto / Fechado no
mês / A receber / Taxa de fechamento — os 4 do README, não mais os 4 do
dashboard antigo). "Fechado no mês" ganhou comparação com o mês anterior
(`fechValorAnt` em `_crmPipelineStats()`) e "Taxa de fechamento" ganhou
"média de N dias até o sim" (`diasMedioFechar`, calculado de
emissão→aprovação dos fechados do mês) — nenhum dos dois existia antes,
os dois são aditivos ao objeto que `_crmPipelineStats()` já retornava.

**Gráfico "Faturamento aprovado" é dedicado** (`#ins-chart`,
`renderInsightsChart()`) — NÃO é o mesmo do Histórico (`dash-chart`,
que continua intocado com seu próprio seletor de tipo/período). Duas
barras por mês (aprovado escuro `var(--c1)` + emitido claro
`var(--c1-mid)`, sempre juntas, sem toggle) e trilho de período 6M/12M/
Ano (`_insSetPeriodo`) em vez do dropdown antigo.

**Bug pego em teste, corrigido antes do commit:** o cartão do gráfico
transbordava a coluna do grid (`.ins-body`, 1.55fr/1fr) e empurrava a
página inteira pra rolagem horizontal — Chart.js dá ao `<canvas>` uma
largura própria, e item de grid não encolhe abaixo do conteúdo por
padrão (`min-width:auto` implícito). Precisou `min-width:0` em
`.ins-fat-card`, `.ins-chart-wrap` e `.ins-col-direita`. Sem isso o
`docWidth` (1366px) ficava maior que o `winWidth` (1140px) — só percebi
comparando as duas medidas via JS, não era visível a olho na resolução
que eu estava testando.

Testado: KPIs/fila/fase/gráfico com dado real de produção (190
orçamentos, R$2,4M em pipeline); trilho 6M→12M troca os meses do
gráfico; clique numa faixa de "Em que fase está" filtra a fila de
follow-up inline (sem navegar — a fila mora na mesma tela agora) e
clicar de novo limpa; "Cobrar" na fila leva pra A Receber; responsivo
1440px (lado a lado) → 1180px (empilha, fila acima do gráfico, regra
exata do handoff) → 375px mobile (KPIs 2 colunas, sem overflow
horizontal em nenhuma largura). `sw.js` v126→v127.

**Achado fora do escopo, sinalizado, não mexido:** ao testar, o boot
disparou ~229 chamadas repetidas pro endpoint `clientes` do Supabase,
várias retornando 400. Não é causado por este redesign (Insights não
mexe em cliente) — parece uma rotina de sincronização em massa. Spawnei
uma task separada pro Marcos investigar (`task_a27cf171`).

**Decisão pendente com o Marcos:** Financeiro, DRE e Análise de clientes
saíram da tela (não estão no handoff). As funções (`renderRelatorioFinanceiro`,
`renderDRE`, `renderAnaliseClientes`) continuam no código, só não são
chamadas por nada agora — precisam de um lugar novo (aba própria? dentro
de Produtividade? uma tela "Financeiro" nova?) antes da Fase 5.

### Próximo passo (histórico — Fase 5 já feita, ver entrada abaixo)

---

## REDESIGN — Fase 5: lista de Orçamentos, ações mudaram de lugar — 13/08

O handoff desenha a lista de Orçamentos enxuta — linha inteira clicável
abre o orçamento, uma coluna "Próxima ação" — mas a tela de hoje tinha uma
linha de ação pesada (trocar status ali mesmo, gerar OS, marcar entrega,
NF, pagamento, WhatsApp, excluir, pontos de progresso). As duas coisas não
cabem juntas. Perguntei ao Marcos como resolver esse conflito antes de
mexer — três opções: manter os botões e só trocar o visual, ir literal no
handoff e mover os botões pra dentro do orçamento aberto, ou fazer híbrido
(acrescentar "Próxima ação" sem tirar nada). Ele escolheu **handoff
literal**: a lista virou um clique só, e os botões se mudaram pra dentro
do orçamento.

**O que mudou:**
- `renderTabela()` reescrita: grade `.rd-table-*` com Nº/Cliente/Valor/
  Situação/Idade/Próxima ação/Origem (mesmas colunas do handoff), linha
  inteira com `onclick="abrirOrc(...)"`, foco por teclado (`tabindex`).
  Não é mais recortada por mês — vira fila de trabalho, não relatório
  contábil (isso ficou só com o card "Resumo do período" que já existia,
  que continua alimentando o dashboard `.dash` de cima via `orcMesRef`/
  `_orcListaMes()` — nada nesses dois foi tocado, só passou a não
  alimentar mais a lista também).
- `_orcSituacao(o)` e `_orcProximaAcao(o)` são NOVAS — derivam badge e
  texto de ação a partir de sinais que a fila de follow-up já calculava
  (`_crmDiasAteDecisao`, `proximo_contato`, idade, OS vinculada). Não é
  dado novo, é vocabulário novo em cima do que já existia.
- **Barra de ações do orçamento aberto** (`#form-acoes-edit`, populada por
  `_renderFormAcoesEdit(o)` em `abrirOrc()`) — status, PDF, Duplicar,
  Gerar/Ver OS, Entregar, Pagamento, Mês, NF, WA, Excluir. São os MESMOS
  `onclick` que a linha da tabela já chamava, só mudaram de endereço.
  Precisa esconder/repopular em `_limparCamposOrc()` (novo orçamento) e em
  `duplicarOrc()` (senão ficava mostrando os botões do orçamento errado)
  — os dois casos foram testados.
- Chips (`Todos/Em aberto/Pendente/Aprovado/Recusado/Vencido`) com
  contagem ao vivo, `.rd-chip`. "Em aberto" não é status (Etapa 21 do
  roadmap, preservada) — é pendente+vencido, a visão de carteira.
- Paginação real (25/página, antes mostrava tudo de uma vez) e "Exportar"
  (CSV simples, função nova `_orcExportarCSV()` — não existia antes).
- Origem virou só coluna de leitura — o dropdown de filtro por origem
  saiu (não está no handoff); month-nav e mini-KPIs continuam existindo,
  só se moveram pra um card próprio ("Resumo do período") acima da lista.

**Dois bugs reais pegos em teste, corrigidos antes do commit:**
1. `.rd-thead`/`.rd-row` (Fase 3) nunca tiveram `gap` — colunas ficavam
   coladas, texto ilegível ("VALORSITUAÇÃO" grudado). Corrigido na base
   (`gap:12px` em `styles.css`), não só neste uso — protege as próximas
   tabelas (Fase 7, Estoque) do mesmo bug.
2. Tabela sem rolagem própria: em telas estreitas o `.rd-table-wrap`
   cortava as colunas de fora (Situação/Idade/Próxima ação/Origem
   invisíveis, sem barra de rolagem nem aviso). Corrigido com um wrapper
   `overflow-x:auto` + `min-width` nas colunas — testado em 375px: a
   PÁGINA não estica (sem scroll horizontal geral), só a tabela rola por
   dentro, exatamente como o handoff pede ("rolagem horizontal, nunca
   corta"). Não implementei a "primeira coluna fixa" que o handoff
   também sugere — fica pra depois se fizer falta.
3. (Achado à parte, não relacionado à Fase 5) o atalho "+ Orçamento" da
   sidebar e do menu mobile chamava só `go('form')`, sem `novoOrc()` antes
   — se você estivesse editando algo, abria "novo" ainda mostrando o
   orçamento anterior. Já era assim antes de hoje, mas a barra de ações
   nova tornava isso perigoso (dá pra clicar "Excluir" no orçamento
   errado por engano). Corrigido pro mesmo padrão que `snb-os` já usava
   (`novaOS();go('os')`).

Testado com dado real de produção (299 orçamentos): chips, paginação,
abrir/voltar, barra de ações completa (status/PDF/Duplicar/OS/Entrega/
Pagamento/Mês/NF/WA/Excluir), exportar CSV, responsivo 375px sem overflow
de página.

**Achado fora do escopo, sinalizado, não mexido de novo:** os ~229
upserts repetidos em `/clientes` continuam lá (task `task_a27cf171` já
aberta na Fase 4).

### Próximo passo (histórico — Fase 6 já feita, ver entrada abaixo)

---

## REDESIGN — Fase 6: Novo Orçamento, formulário + prévia lado a lado — 13/08

A que o próprio README chama de "a parte mais longa". Layout `1fr 420px`
(`.novo-orc-body`) — coluna esquerda com o formulário que já existia
(cliente/serviços/observações — **não reescrevi os componentes internos**:
vincular item ao estoque, checkbox "não é produto", aviso de quantidade no
texto, preset com preço editável são interações reais demais pra arriscar
sem necessidade; só o container geral virou `.novo-orc-*`/`.rd-card`),
coluna direita nova: prévia do PDF que atualiza a cada tecla.

**Barra superior nova** (`.novo-orc-topbar`) — título ("Novo orçamento" ou
"Orçamento #350", trocado em `abrirOrc`/`_limparCamposOrc`/`duplicarOrc`)
+ indicador de rascunho automático (já existia, só mudou de lugar) à
esquerda; "Salvar rascunho" (= `salvarApenas()`, renomeado) e "Gerar PDF e
enviar" (= `gerarPDF()`, renomeado) à direita — os botões que viviam soltos
no rodapé da tela. "Copiar"/"Enviar WhatsApp" se mudaram pra dentro da
aba WhatsApp da prévia (mesmo `copiarWA()`/`enviarWA()` de sempre).

**Prévia do PDF é renderização própria, não o template de impressão** —
`renderPrevSheet()`, chamada de dentro de `upd()` (então atualiza a cada
tecla, junto com o preview de WhatsApp que já existia). O template
escondido que `preencherDocOrc()` preenche pra imprimir é dimensionado
pra página inteira, não cabe num painel de 420px — a prévia é uma segunda
renderização, miniatura, alimentada pelos mesmos campos (`sub()`/`disc()`/
`tot()`/`svcs`/`getLojaConfig()`). Alternador PDF/WhatsApp troca qual dos
dois aparece; o WhatsApp reaproveita o `#prev-wa` que já existia (só
mudou de painel).

**Bug real pego em teste, corrigido antes do commit:** a prévia resolve o
nome da empresa pelo select `#orc-loja` (`getLojaConfig`), mas esse select
só recebe as opções reais depois que `LOJAS` carrega do banco — se
`upd()` rodasse antes disso (comum ao abrir "Novo orçamento" logo no
boot), a prévia ficava presa mostrando o nome genérico do `CFG` global
("Fluxa") até a pessoa digitar alguma coisa. Corrigido chamando
`renderPrevSheet()` de novo em `popularSelectsLojaForm()` (assim que o
valor certo existe) e em `go('form')`.

Testado com dado real: orçamento novo (nome/item/preço aparecendo ao
vivo na prévia) e orçamento existente de 2 itens (#350, André,
R$1.114,80) — a barra de ações da Fase 5 e a barra nova convivem sem
conflito. Responsivo: 1440px lado a lado, abaixo de 1280px empilha
(simplificação — o handoff sugere a prévia virar um painel acionado por
botão "Prévia" abaixo de 1280px; empilhar é mais simples e não perde
informação, só não é idêntico ao mock), 375px sem overflow de página.

### Próximo passo (histórico — Fase 7 já feita, ver entrada abaixo)

---

## REDESIGN — Fase 7: Estoque, indicadores + "Comprar agora" — 13/08

Primeira versão desta fase manteve a lista de produtos como estava (só
trocou a moldura) — o mesmo dilema da Fase 5 (a `.est-item` tinha até 7
botões de ação por linha, rico demais pra caber na grade `1.6fr 90px
78px 78px 70px 90px 100px` do handoff), só que dessa vez decidi sozinho
em vez de perguntar. O Marcos revisou e pediu handoff literal aqui
também — mesma escolha que ele já tinha feito na Fase 5. **Revisado**
(ainda 13/08): a lista virou a tabela densa de verdade, e os 7 botões se
mudaram pro modal "Editar produto" (mesmo padrão da Fase 5 — o modal é o
equivalente do "orçamento aberto" pra produto, já que não existe uma
tela de produto própria).

**O que mudou nesta revisão:**
- `renderEstoque()`: a lista virou `.rd-table-*` — grade exata do handoff
  (Produto/SKU/Disp./Reserv./Mín./Giro 90d/Valor), linha inteira clicável
  (`abrirProdutoModal(id)`), ponto de status (verde/âmbar/cinza), fundo
  `--warn-row` na linha abaixo do mínimo. Teto de 30 linhas com "Ver
  todos" (handoff: "9 de 148 · Ver todos") — `_estoqueVerTodos`, reseta a
  cada troca de filtro/categoria/busca.
- `_renderProdAcoesEdit(p)` (nova, chamada por `abrirProdutoModal`) — a
  barra de ações dentro do modal: Entrada/Saída/Corrigir/Reserva/
  Transferir/Histórico (mesmas funções de sempre, só mudaram de
  endereço); produto inativo mostra só "Reativar".
- CSS morta removida: `.est-item`/`.est-main`/`.est-dot`/`.est-badge`/
  `.est-acts`/`.eb.ein`/`.eb.eout`/etc. — inclusive os dois ajustes de
  `flex-wrap` que eu tinha acabado de escrever pra "salvar" o layout
  antigo (ficaram sem uso assim que a linha antiga saiu). Fiquei só com
  `.eb`/`.eb.eico.fix`, que o modal de reserva ainda usa em outro lugar.
- **Perda real, sinalizada:** a antiga `.est-item` mostrava o saldo por
  loja lado a lado (`Fortemp Camboriú: 3 · Fortemp Itapema: 0`) direto na
  lista — a grade do handoff não tem essa coluna. Quem gerencia "Todas as
  unidades" perde essa visão rápida na lista (o número de Disp. agora é
  só o total consolidado); o detalhe por loja continua existindo dentro
  do modal do produto, só não é mais visível sem abrir.

O resto da fase (KPIs, "Comprar agora", Movimentações recentes, Curva
ABC/comparativo entre lojas fora do handoff) não mudou — só a lista e o
modal.

**O que é novo:**
- `_renderEstoqueKPIsNovo({...})` — os 4 cards do handoff (Valor em
  estoque / Abaixo do mínimo / Reservado em OS / Sem giro 90d), chamada
  de dentro de `renderEstoque()` recebendo os números que a função JÁ
  calculava (`valorEstoque`, `repor`, `valorReservado`, `parados`) — zero
  cálculo duplicado.
- `_renderCompraAgora()` — cartão "Comprar agora" compacto (top 3 +
  "+N outros"), usando o MESMO motor que `_insightsPontoDePedido()` já
  usava (`pontoDePedido()`/`disponivelProduto()`, mínimo − disponível
  ajustado pelo lead time do fornecedor). Estado vazio no padrão do
  handoff (ícone neutro, título, explicação do que aparece depois, ação)
  quando não há nada abaixo do ponto de pedido.
- Movimentações recentes (`renderMovEstoque()`, já existia) só mudou de
  lugar — saiu do fim da página antiga pra dentro da coluna direita nova.
- Curva ABC, comparativo entre lojas, margem, "vão acabar em breve",
  capital parado (tudo dentro de `#estoque-insights`) e os indicadores
  derivados do razão — ficaram onde estavam, sistema visual antigo, sem
  equivalente no handoff.

**Três bugs de CSS reais pegos em teste, todos corrigidos antes do commit:**
1. `.est-item` (flex, sem wrap) sempre viveu numa coluna de ~1170px; a
   Fase 7 meteu ela numa coluna de `1fr` ao lado de 340px — `.est-main`
   (flex:1;min-width:0) ia pra ~23px e o NOME DO PRODUTO sumia. Já
   existia exatamente esse bug documentado pra tela de celular (media
   query 680px, com o mesmo comentário no CSS) — apliquei o mesmo remédio
   (`flex-wrap:wrap` nos filhos), só que por container (`.novo-orc-left
   .est-item`) em vez de por viewport, porque agora o gatilho é a coluna
   estreita, não o tamanho da tela.
2. Passei `style="grid-template-columns:1fr 340px"` inline pra dar à
   Estoque uma coluna direita mais estreita que a de Novo Orçamento
   (420px) — só que inline sempre vence media query, então o
   `@media(max-width:1280px){.novo-orc-body{grid-template-columns:1fr}}`
   da Fase 6 parou de colapsar pra Estoque especificamente. 375px ficava
   com ~538px de largura mínima e rolagem de página inteira. Virou uma
   classe própria (`.novo-orc-body-340`) com o próprio override dentro do
   mesmo media query.
3. Achado à parte, não causado por este redesign: o alerta de saldo
   negativo (`#estoque-alerta`, já existia) usa o NOME DO PRODUTO como
   texto de um `<button class="tb">`, e `.tb` tem `white-space:nowrap` —
   um nome comprido virava um botão sozinho mais largo que a tela toda em
   celular. Corrigido só ali (`#estoque-alerta .tb{white-space:normal}`),
   sem tocar no `.tb` global usado em dezenas de outras telas.

Testado com dado real (406 produtos, Forthemp): os 4 indicadores, cartão
"Comprar agora" com estado vazio real (nada abaixo do ponto de pedido
com lead time configurado agora), movimentações recentes, lista de
produtos legível com todos os botões, responsivo 1440/375px sem overflow
de página nas duas larguras — e confirmei que Orçamentos e Novo
Orçamento (que compartilham `.novo-orc-body`/`.novo-orc-left`) continuam
normais depois dos ajustes de CSS.

### Próximo passo (histórico — Fase 8a já feita, ver entrada abaixo)

---

## REDESIGN — Fase 8a: quadro de OS ("Ordens de Serviço") — 13/08

Início do "turno 3" do handoff (OS, A Receber, Despesas, Clientes, Portal).
Li as 5 telas inteiras em `Fluxa Redesign.dc.html` antes de começar — o
handoff pede "quadro do dia por técnico": topbar com resumo do dia, 4 KPIs,
tabela "Agenda de hoje" e coluna direita (carga por técnico, peças a
separar, últimos check-ins).

**Mapeamento (3 telas diferentes de OS já existiam, não confundir):**
`page-os-history` (`renderOSTabela`) = lista do gestor, todos os técnicos —
era a mais parecida com o "quadro" do handoff, virou o alvo desta fase.
`page-minhas-os` (`renderMinhasOS`) = cards do próprio técnico, **não
mexida** — já é mobile-first e role-gated, o handoff não desenha um
equivalente técnico separado. `page-os` = formulário de abrir/editar UMA
OS, usado pelos dois (drill-in) — ganhou só a barra de ações nova.

**O que mudou:**
- `renderOSTabela()`: virou tabela densa `.rd-table-*` (Data/Cliente/
  Técnico/Situação/Duração/Próxima ação), linha inteira clicável
  (`editarOS(id)`) — mesmo padrão handoff-literal de Orçamentos/Estoque
  (Fases 5/7, confirmado como preferência do Marcos em
  `fluxa-redesign-preferencia-handoff-literal.md` na memória). Os botões
  que viviam na linha (PDF/WhatsApp/Concluir/Excluir) se mudaram pra
  dentro da OS aberta.
- **Barra de ações da OS aberta** (`#os-acoes-edit`, populada por
  `_renderOSAcoesEdit(o)` em `_abrirOSForm()`) — badge de situação, PDF,
  Concluir (some se já concluída/cancelada), WhatsApp (conclusão ou
  lembrete de visita, conforme o status), Excluir. Mesmos `onclick` que a
  linha antiga já chamava. Escondida/limpa em `novaOS()`.
- **Chips com contagem ao vivo** (`OS_CHIPS`/`_osRenderChips`, mesmo padrão
  de `ORC_CHIPS`): Todos/Agendado/Atrasado/Concluído/Cancelado — "Atrasado"
  é novo como filtro (antes só colorizava a linha), calculado igual
  (`agendado` com `data_servico` no passado), chip fica em destaque
  (`rd-chip-alert`) quando > 0.
- **4 KPIs do handoff** (`_renderOSKPIsNovo`): "Em atendimento agora"
  (`checkin_time` setado, sem `checkout_time`), "Concluídas hoje",
  "Sem técnico" (agendada sem `tecnico` preenchido), "Tempo médio"
  (`duracao_min` médio das concluídas de hoje — "—" sem nenhuma). Todos
  derivados de campos que a OS já grava (`checkin_time`/`checkout_time`/
  `duracao_min`, ver "Fase B da crítica de design" abaixo) — nenhum dado
  novo, nenhuma tabela nova.
- **"Carga por técnico" na coluna direita** (`_renderCargaTecnico`) — o
  handoff pede "Xh / 8h" com barra de progresso, mas o app não guarda
  ESTIMATIVA de duração de OS futura, só a real de quem já foi concluída.
  Mostrar horas seria inventar número que a base não sustenta — o cartão
  virou **contagem** de OS de hoje por técnico com barra proporcional ao
  técnico mais carregado. Card só aparece com dado real (some se não há
  nenhuma OS hoje) — mesmo princípio de estado vazio das fases anteriores.
- **Não implementado, de propósito:** os outros 2 cards da coluna direita
  do handoff — "Peças a separar" (exigiria cruzar todos os itens
  vinculados a estoque de todas as OS de hoje, ainda não construído) e
  "Últimos check-ins" (o app não guarda um LOG de check-ins, só o
  check-in ATUAL de cada OS — não haveria histórico pra listar). Nenhum
  dos dois foi simulado com dado fictício.
- Não desliguei nem redesenhei `page-minhas-os` — segue como estava,
  cards + "✅ Concluir" de um toque, é o fluxo mobile do técnico em campo.

Testado no browser local (`dbOk=false`, sessão master simulada via
`sessionStorage`, 5 OS sintéticas cobrindo os 5 estados: em campo,
sem técnico, atrasada, agendada normal, concluída com duração): KPIs
batendo (1/1/1/1h02), chips com contagem e alerta no "Atrasado", tabela
com badges corretos (Em campo azul/Atrasado laranja/Agendada cinza/
Concluída verde) e "Próxima ação" certa por linha (Atribuir técnico /
Fazer check-out / Atrasado · remarcar / — pros sem ação), carga por
técnico com barras proporcionais, clique na linha abre a OS certa com a
barra de ações populada (testado com OS concluída E agendada — botões
certos em cada caso), `novaOS()` esconde a barra. Responsivo: 1440px
(3 colunas + coluna direita), 375px (KPIs empilham 2×2, chips quebram
linha, tabela rola por dentro do próprio wrapper sem esticar a página —
confirmado `docWidth===winWidth===375`). Zero erro novo de console (só
o ruído de 400 pré-existente, do boot inicial com `dbOk=true` antes de eu
sobrescrever pra teste local). `sw.js` v131→v132.

### Próximo passo (histórico — Fase 8b já feita, ver entrada abaixo)

---

## REDESIGN — Fase 8b: A Receber (aging + previsto do mês) — 13/08

Mapeamento: `page-recebiveis`/`renderRecebiveis()` — tela já existia com
KPIs `.dash` antigos, 6 filtros (`_RECEB_FILTROS`) e lista em cards. O
handoff troca os KPIs por um gráfico de idade do saldo (4 faixas) + card
escuro "Previsto do mês", e a lista vira tabela densa com só 3 chips.

**O que mudou:**
- **`_renderRecebAging(abertas)`** (nova) — 4 barras (A vencer/1 a 15d/
  16 a 30d/+30d), altura proporcional ao maior valor, cores do handoff.
  Substitui os KPIs "A receber"/"Vencido"/"Vence hoje" — a mesma
  informação (quanto está aberto, quanto vencido) já está nas barras,
  só que segmentada por idade em vez de 3 números soltos.
- **`_renderRecebPrevisto(todas)`** (nova) — card escuro "Previsto para
  [mês atual]": soma das parcelas com vencimento no mês corrente
  (pagas+abertas), barra Recebido/Falta, e uma frase condicional ("Todo
  o saldo que falta está vencido...") **só aparece se for verdade** —
  não é texto fixo do mock, é calculado (`faltantes.every(diasAtraso>0)`).
- **Prazo médio (PMR)** não tinha equivalente no handoff — não sumiu,
  virou uma cláusula no subtítulo do card de aging ("...· prazo médio:
  +4d"), sem inventar um 5º card.
- **Chips**: `_RECEB_FILTROS` foi de 6 pra 3 (Vencidas/A vencer/
  Recebidas — os outros 3 antigos, hoje/semana/todos, não tinham
  equivalente no handoff e não faziam falta com a tabela mais legível).
  Filtro inicial resolve pra `'vencido'` SE houver parcela vencida
  (mesmo destaque do mock), senão cai em `'avencer'` — evitar abrir a
  tela numa lista vazia quando está tudo em dia.
- **Tabela densa** `.rd-table-*`: Cliente/Valor/Venc./Situação/Origem/
  Ação. "Origem" é sempre `Orç. #N` — o handoff mostra também "OS #N" e
  "Contrato", mas `recebimentos` só liga a `orcamento_id`, não guarda
  origem por OS/contrato; não fabriquei essa distinção. "Último contato"
  do handoff **não entrou** — não existe log de contato nas parcelas,
  mostrar sempre "—" seria pior que não ter a coluna. "Ação" continua
  sendo a MESMA função de sempre (`marcarRecebido`/`desmarcarRecebido`),
  só virou link de texto em vez de botão — o handoff usa palavras
  diferentes por linha ("Cobrar"/"Negociar"/"Enviar Pix"/"Recibo") que
  exigiriam construir cobrança por WhatsApp e recibo, fora do escopo
  desta fase de redesign visual.
- **Botão primário "Registrar recebimento"** (topbar) não abre um
  formulário novo — não existe um "criar parcela do zero" independente
  de orçamento no app hoje. Aponta (`_recebIrParaGap`) pro card real que
  já resolve isso: "Aprovados sem cobrança lançada" (rola até ele, ou
  avisa que não há nenhum pendente).
- Card de gap (aprovados sem NENHUMA parcela) não está no handoff, mas
  continua — é o único jeito de ver esse buraco. Só ganhou moldura
  `rd-card-warn`.

Testado no browser local (`dbOk=false`, 6 orçamentos + 5 parcelas
sintéticas cobrindo vencida/a vencer/paga + 1 aprovado sem parcela):
subtítulo do topbar (`R$ X em aberto · R$ Y vencidos`), gráfico de aging
com os 4 valores batendo, card previsto com Recebido/Falta corretos,
chips com contagem e destaque em Vencidas, clique real em "✓ Recebi"
(não só chamada de função) atualizou toast + tabela + gráfico + previsto
juntos, "↩ Desfazer" reverte. **Bug pego em teste:** botão de ação sem a
classe base `.rd-btn` saiu com borda 3D padrão do navegador (só
`.rd-btn-link` não reseta `border`) — todo outro uso no código já
combinava as duas classes, corrigido pra seguir o mesmo padrão.
Responsivo: 1440px (grid 1fr 340px) → 375px (empilha, sem overflow de
página, `docWidth===winWidth===375` confirmado). Zero erro novo de
console. `sw.js` v132→v133.

### Próximo passo (histórico — Fase 8c já feita, ver entrada abaixo)

---

## REDESIGN — Fase 8c: Despesas (KPIs fixa/variável + tabela densa) — 13/08

Mapeamento: `page-despesas`/`renderDespesas()`. Handoff pede 3 KPIs (mês/
fixa/variável), tabela densa de lançamentos e coluna direita (por
categoria, sem comprovante, resultado do mês).

**Achado antes de codar — o dado não distinguia fixa/variável.** O
formulário só captura `centro_custo` (fixo/variável/administrativo/
campo) pra despesa "da empresa"; despesa "de campo" (a maioria, técnico
gastando) nunca teve essa classificação. Decisão: `_despFixaOuVariavel(tipo)`
classifica por TIPO da despesa, não por natureza — mapa fixo de 7 tipos
que não mudam com o volume de venda (Aluguel, Salário, Energia,
Internet, Software, Contador, Imposto) contra os demais (Combustível,
Material, Alimentação, Manutenção de veículo, Marketing, Outro) como
variável. "Outro" caiu em variável por ser o lado menos previsível —
registrado aqui porque é uma classificação NOVA em cima de dado que já
existia, não um campo que o formulário já perguntava.

**O que mudou:**
- **3 KPIs** (`_renderDespKPIsNovo`): Despesa do mês (card escuro, com
  "% da receita aprovada" — nova função `_despReceitaAprovadaMes()`,
  soma de `todosOrc` aprovados no mês por `data_aprovacao`, mesma lógica
  usada em Resultado), Fixa, Variável.
- **Tabela densa** `.rd-table-*`: Data/Descrição/Categoria/Vínculo/Valor/
  Comprovante. "Vínculo" é sempre `OS #N` (quando `os_numero` existe) ou
  "—" — o handoff também mostra "Estoque" como vínculo, mas despesa não
  liga a movimento de estoque no schema atual, não fabriquei essa
  distinção. Ações (reembolsar/ver foto/excluir) continuam as mesmas
  funções de sempre, só mudaram de aparência (botões pequenos na célula
  de Comprovante em vez de coluna própria).
- **"Por categoria"** (`_renderDespCategoria`) — mesmo cálculo que já
  existia (`desp-cat-card`), só moveu pra coluna direita e trocou ícone
  fixo por barra proporcional, igual ao handoff.
- **"N sem comprovante"** (`_renderDespSemComprovante`, nova) — conta e
  soma despesas do mês sem `foto_base64`. O handoff diz "o fechamento do
  mês fica bloqueado até resolver" — **não existe essa trava no app**
  (não há "fechar o mês"), reescrevi o texto sem essa frase pra não
  prometer um bloqueio que não acontece. Botão rola até a tabela (não
  filtra — filtrar exigiria um 3º dropdown novo, fora do escopo).
- **"Resultado do mês"** (`_renderDespResultado`) — Receita aprovada
  (mesma `_despReceitaAprovadaMes()`) − Despesas = Resultado, cores
  ok/bad conforme sinal.
- **`_despExportarCSV()`** (nova) — mesmo padrão de `_orcExportarCSV`
  (Fase 5), exporta só os campos que já existem, nenhum dado novo.
- CSS: `.ins-kpis-3` nova (`styles.css`) — variante de 3 colunas do
  `.ins-kpis` que Insights/Estoque já usavam (4 colunas); classe própria
  em vez de `style=` inline pelo mesmo motivo já documentado nas Fases
  6/7 (inline sempre vence media query, quebraria o colapso mobile).

**Bug pego em teste, corrigido antes do commit:** as linhas da tabela
(`.rd-row`) saíram sem `style="grid-template-columns:${grid}"` — só o
cabeçalho (`.rd-thead`) tinha. Sem isso `.rd-row` (que não define
`grid-template-columns` na base, cada tela injeta via inline) colapsava
pra 1 coluna só, empilhando as 6 células verticalmente em vez de lado a
lado. Pego comparando `getComputedStyle` do thead com o do row antes de
assumir que "renderizou parecido" bastava — none dos outros redesigns
(Orçamentos/OS/Estoque/Recebíveis) tinha esse bug porque todos já
passavam o `style=` linha a linha; este foi o único onde esqueci.

Testado no browser local (`dbOk=false`, 6 despesas sintéticas cobrindo
fixa/variável/campo/empresa/com e sem comprovante/vinculada a OS, 2
orçamentos aprovados no mês pra "Receita aprovada"): KPIs batendo
(28.020 total = 16.800 fixa + 11.220 variável, 45% da receita de
62.400), tabela com 6 colunas alinhadas, "Por categoria" ranqueado
certo, "2 sem comprovante · R$3.740" batendo com as 2 despesas sem
foto, "Resultado" 34.380 verde. Ação real testada: `reembolsarDesp` muda
o status de verdade (não só chamada isolada). Responsivo: 1440px (3
KPIs lado a lado + coluna direita), 375px (`.ins-kpis-3` empilha em 1
coluna abaixo de 640px, `docWidth===winWidth===375` sem overflow de
página). Zero erro novo de console. `sw.js` v133→v134.

### Próximo passo (histórico — Fase 8d já feita, ver entrada abaixo)

---

## REDESIGN — Fase 8d: Clientes (lista + ficha lado a lado) — 13/08

Mudança de padrão mais estrutural do turno 3: o handoff pede lista
compacta (380px) + ficha do cliente selecionado sempre visível ao lado —
diferente do padrão "linha clicável abre em outra tela/modal" das fases
anteriores (5/7/8a). Aqui os dois ficam lado a lado o tempo todo.

**Mapeamento:** `page-clientes`/`renderClientes()` (lista simples em
cards) + `verHistoricoCliente()` (modal dinâmico com abas de Orçamentos/
OS/Vistorias/Agendamentos/Vendas balcão) — o handoff funde os dois numa
ficha só, sempre aberta.

**O que mudou:**
- **Lista à esquerda** (`.cli-master-left`, 380px, rolagem própria):
  busca + 3 chips novos (Todos/Contrato/Inadimplente — `_cliTemContratoAtivo`
  checa agendamento recorrente não cancelado, `_cliTemInadimplencia` checa
  parcela vencida em `recebimentos`; os dois já eram deriváveis do que o
  app carrega, não é dado novo). Cada linha mostra faturamento e, se
  inadimplente, "venc." em vermelho. Primeiro cliente da lista seleciona
  sozinho ao abrir (mesmo estado do mock, que já mostra uma ficha aberta).
- **Ficha à direita** (`_renderFichaCliente`, nova) — reaproveita os
  MESMOS dados que `verHistoricoCliente` já calculava (orçamentos/OS/
  vistorias/vendas balcão por nome+`cliente_id`), só reformatados: header
  (avatar por iniciais, badge Contrato ativo/Avulso, WhatsApp, Novo
  orçamento), 4 KPIs (Faturado total/Cliente desde/OS realizadas/Em
  aberto — este último soma `recebimentos` não pagos do cliente,
  dado novo mas derivado, não fabricado), Histórico (timeline unificada,
  6 eventos mais recentes dos 4 tipos), Equipamentos no local
  (`todosEq.filter(e=>e.cliente_id===id)`, já existia desde a Etapa 5 do
  CRM) e Acesso ao portal (botão "Copiar link do portal", reaproveita
  `getPortalLinkCliente()` que já existia).
- **`verHistoricoCliente()` removida** — sem chamador algum depois da
  fusão (confirmado por grep antes de apagar), a própria ficha agora É
  o histórico.
- Ações que não couberam no header viraram links pequenos no rodapé da
  ficha: "✏️ Editar cadastro" (mesmo form inline de sempre, só
  `#cli-form-titulo` trocou de seletor — antes buscava `.ct`, que não
  existe mais no form redesenhado), "🔧 Nova OS", "🗑 Excluir cliente".

**Bug real pego em teste, corrigido antes do commit:** os botões
"WhatsApp" e "Copiar link do portal" usavam `JSON.stringify(cli.nome)`
dentro de um atributo `onclick="..."` — `JSON.stringify` produz aspas
DUPLAS, que fecham o atributo HTML (também delimitado por aspas duplas)
no meio da string, quebrando o botão (o resto do onclick vazava como
texto visível). Corrigido com duas funções novas, `_cliEnviarWA(id)` e
`_cliCopiarLinkPortal(id)`, que buscam o cliente pelo ID (já seguro em
`onclick="fn('${id}')"`, mesmo padrão usado em todo o resto do código)
em vez de receber nome/telefone livres pelo HTML — mais seguro contra
qualquer caractere especial no nome do cliente, não só este caso.

CSS novo: `.cli-master-body` (grid 380px 1fr, colapsa em 1 coluna abaixo
de 1024px), `.cli-row`/`.cli-row.on` (linha da lista, borda esquerda
azul quando selecionada), `.cli-ficha-grid` (Histórico/Equipamentos+Portal
lado a lado, 1 coluna abaixo de 640px).

Testado no browser local (`dbOk=false`, 4 clientes sintéticos + orçamento/
OS/agendamento/equipamento/recebimento vinculados): ficha renderiza com
KPIs corretos, badge Contrato ativo quando há agendamento, "R$X venc."
na lista quando inadimplente, timeline com 4 eventos ordenados por data,
equipamentos e portal certos; clique real numa linha troca a ficha;
`editarCliente()` abre o form pré-preenchido com o título certo. Achado
à parte, não relacionado a este código: durante o teste, `todosOrc`
global foi sobrescrito por um sync assíncrono real de produção entre
duas chamadas de ferramenta (mesma classe de risco já documentada em
sessões anteriores sobre `dbOk` ser `let`, não `window.dbOk`) — validada
a lógica do filtro isoladamente (`orcCli.length===1` com dado
controlado) para confirmar que não era bug do redesign. Responsivo:
1440px (lista+ficha lado a lado), 375px (empilha,
`docWidth===winWidth===375`, ficha com KPIs 2×2). Zero erro novo de
console. `sw.js` v134→v135.

### Próximo passo (histórico — Fase 8e já feita, ver entrada abaixo)

---

## REDESIGN — Fase 8e: Portal do Cliente (última do turno 3) — 13/08

Fecha o turno 3 do handoff (OS/A Receber/Despesas/Clientes/Portal — as 5
telas do mapeamento inicial desta sessão, todas concluídas). O portal é
a ÚNICA tela client-facing do app — sem sidebar, sem jargão interno,
acessada via `#portal/<token>` sem login.

**Mapeamento:** `page-portal`/`renderPortal(cli)` — já mostrava próxima
visita, orçamentos pendentes, histórico de OS concluída, equipamentos e
um botão de WhatsApp fixo, em coluna única (`.portal-wrap`, max-width
680px, mobile-first porque o link chega pelo WhatsApp).

**Decisões de conteúdo, não só de estilo:**
- **"Últimos relatórios" prioriza vistorias** (com "Abrir PDF" real,
  `_gerarPDFVistoria(vis)` chamado direto no objeto já buscado — não usa
  `baixarPDFVistoria(id)` porque essa depende do cache local, que o
  dispositivo do cliente nunca teve) — cai pra "Histórico de Serviços"
  (OS concluída, como antes) só se o cliente não tiver NENHUMA vistoria
  registrada. Union, não substituição: nenhum cliente perde informação
  que já tinha.
- **"Visita de hoje" é novo** — antes só existia "próxima visita futura"
  (qualquer data ≥ hoje). Agora, se o técnico já fez check-in numa OS de
  hoje (`checkin_time` setado, sem `checkout_time`), mostra badge "Em
  andamento" com o nome do técnico e hora de chegada — meio real que o
  handoff pede ("Júlio chegou às 9:36"), sem inventar geolocalização.
  Cai pra "OS de hoje agendada" e depois pra "próxima futura", nessa
  ordem, sempre com o rótulo certo pro que está mostrando.
- **"Pagamento em aberto" mostra dado real (`recebimentos` do cliente),
  mas SEM Pix/boleto fake** — o app não tem gateway de pagamento
  integrado. O handoff mostra botões "Pagar com Pix"/"Boleto"; puxar
  isso literalmente teria fabricado uma funcionalidade que não processa
  nada de verdade. Botão vira "Falar sobre pagamento" (WhatsApp real).
- **Header ganhou nav visual** (Início/Relatórios/Orçamentos/Pagamentos,
  só "Início" ativo) — são sub-páginas que não existem; construí-las
  seria escopo novo (múltiplas rotas dentro do portal), não redesign
  visual desta fase. Nav só aparece ≥640px (mobile prioriza o conteúdo).
- **"Seu contato"** usa dados da EMPRESA (`LC.nome`/`LC.tel`), não de um
  "responsável técnico" por cliente — esse dado não existe no schema
  hoje (não fabricado).
- Grid 1.4fr/1fr só ativa ≥900px (`.portal-grid`); abaixo disso empilha
  em coluna única, que já era o layout inteiro antes — zero regressão
  mobile, só ganho em desktop.

**Bug real achado e corrigido, fora do texto/CSS mas na própria tela do
portal:** `checkPortalHash()` só escondia `.hdr` e `#mob-nav` antes de
mostrar o portal — nunca escondia a `#sidebar`. Quem abrisse o link
direto (sem passar pela tela de login) via a barra lateral inteira do
app admin por trás do conteúdo do cliente, incluindo nomes de telas
internas (Orçamentos, Despesas, Estoque…) que um cliente não deveria
ver. Corrigido: `#sidebar`/`#sidebar-overlay` escondidos junto.

Testado no browser local (`dbOk=false`, cliente sintético "Hotel
Marlin" com OS em campo hoje, orçamento pendente, parcela vencida,
vistoria com item em atenção): header sem sidebar por trás (confirmado
o fix acima), "Visita de hoje" com badge "Em andamento" e hora de
chegada, "Últimos relatórios" com "Abrir PDF", "Pagamento em aberto"
com valor e "Falar sobre pagamento", "Orçamento aguardando você" com
Aprovar/Recusar, "Seu contato" com dados da empresa. Achado à parte, não
relacionado a este código: durante o teste, `localStorage` foi
sobrescrito por uma promise de sync pendente de um boot anterior desta
mesma aba (mesma classe de artefato já documentado nas Fases 8b/8d) —
validada a lógica de filtro isoladamente com dado controlado antes de
seguir. Responsivo: 900px+ (grid 2 colunas), 375px (empilha,
`docWidth===winWidth===375`, nav do header oculta). Zero erro novo de
console. `sw.js` v135→v136.

Com isso o turno 3 do handoff está completo: OS (8a), A Receber (8b),
Despesas (8c), Clientes (8d), Portal (8e).

### Próximo passo (histórico — Fase 9 já feita, ver entrada abaixo)

---

## REDESIGN — Fase 9: as 3 telas mobile do handoff — 13/08

Última seção do arquivo (`Fluxa Redesign.dc.html`, linhas 1422-1703),
rotulada no próprio handoff como **"Turno 1 · Proposta A"** — rótulo
diferente do resto (que era só "turno 2"/"turno 3"), o que levantou a
dúvida de ser uma exploração de design não aprovada. Perguntei ao Marcos
antes de construir; ele confirmou que é pra implementar mesmo.

As 3 telas são frames de celular (390×800) com uma linguagem visual
mobile própria — hero escuro, wizard de passos, timer de check-in — bem
diferente do "colapsa em coluna única" que as fases anteriores já faziam
em todo breakpoint mobile. Decisão de escopo, válida pras 3: **tudo foi
aditivo dentro de `@media`, nenhum HTML/JS de captura de dado real foi
reescrito** — mesma cautela já registrada na Fase 6 ("os componentes
internos do formulário são interações reais demais pra arriscar sem
necessidade") e na Fase 9b especificamente. Nenhuma das 3 telas teve
comportamento de desktop alterado — testado e confirmado nas 3.

**9a — Insights.** `_renderInsMobileHero(s)` (nova) monta, só abaixo de
680px, um hero escuro "Pipeline aberto" com barra segmentada por
SITUAÇÃO (reaproveita `_orcSituacao()` da Fase 5 — Enviado/Negociando/
Assembleia — em vez de inventar uma 2ª categorização por idade) + 3
cards compactos (Vence 7d/Parado 30d/Fechado mês). Mesmos dados de
`_crmPipelineStats()` que a faixa de 4 KPIs do desktop já usa — o
`.ins-kpis` de sempre continua existindo e sendo calculado, só troca de
visibilidade via CSS (`.ins-kpis{display:none}` / `.ins-mobile-hero
{display:flex}` dentro do mesmo `@media(max-width:680px)`). "Precisa de
você hoje" não precisou de nada novo — a Fase 4 já entrega exatamente
isso (1º item expandido, resto compacto).

**9b — Novo Orçamento.** O mock pede wizard de 3 passos (Cliente/
Serviços/Pagamento) com campos escondidos por passo. **Não implementei
isso.** A "Pagamento" no formulário real já mora dentro do card Cliente
(select de forma de pagamento), não é um 3º card separado — esconder
cards por trás de passos arriscava quebrar o rascunho automático e a
prévia ao vivo (dependem de tudo estar no DOM o tempo todo). Em vez
disso: indicador de 3 passos (`#novo-orc-steps`, renomeado "Cliente/
Serviços/Finalizar" pra bater com a estrutura real) que **rola até a
seção** em vez de esconder — todos os campos continuam sempre
presentes e funcionais. + barra fixa de total no rodapé
(`#novo-orc-mobile-bar`, espelha `#d-tot` via `upd()`), acima do
`.mob-nav` real (`bottom:64px` abaixo de 680px, onde os dois convivem).

**9c — Vistoria.** Também não recriei os cards de equipamento (já
tinham cor por status desde antes — `.vis-equip-block.status-*` — e são
a captura de dado real que a Fase B da crítica de design já tinha
protegido). O que entrou: barra de progresso "N de M vistoriados"
(`renderVisEquipGrid()` já calculava a lista `ordem`, só adicionei a
contagem) + check-in sticky no topo (reposiciona `#vis-checkin-bar`
existente via CSS, sem duplicar) + ações fixas no rodapé (mesmo padrão
da 9b, reaproveitando os MESMOS botões/funções, só com `id` novo pra
escopar o CSS).

**Achado e corrigido durante a implementação:** o critério óbvio pra
"vistoriado" (`visEquipDados[id]?.status` truthy) dava sempre 100% —
`toggleVisEquip()` já grava `status:'na'` no momento em que o
equipamento é ADICIONADO à lista, antes de qualquer avaliação real (é o
valor inicial, não uma escolha consciente do técnico). Sem mudar esse
dado (produção real, muitas vistorias já usam esse padrão), o critério
virou "status diferente de 'na'" — mais conservador (um N/A
genuinamente confirmado nunca conta como "feito", fica pendente pra
sempre), mas não finge progresso que não existe.

Testado no browser local (`dbOk=false`) nas 3 telas, 375px e 1440px:
Insights (hero com R$45.000 · 4 orç., segmentos Enviado 1/Negociando 2,
3 stats corretos, desktop com 4-KPI grid intacto), Novo Orçamento
(passos rolam pra seção certa testado via `scrollIntoView`, barra de
total espelhando em tempo real, desktop com prévia PDF ao lado sem
regressão), Vistoria (progresso "2 de 3" batendo com bom+atenção
setados e N/A de fora, check-in e ações fixas sem sobrepor a nav
inferior real, desktop com layout inline de sempre). Zero erro novo de
console (só ruído de Service Worker do ambiente de dev local, não
relacionado). `sw.js` v136→v137.

Com isso, todo o handoff visual mapeado nesta sessão está implementado:
turno 2 (Insights/Orçamentos/Novo Orçamento/Estoque), turno 3 (OS/A
Receber/Despesas/Clientes/Portal) e as 3 telas mobile.

### Próximo passo

Telas sem handoff pronto (o próprio README já orienta seguir os padrões
`.rd-*` estabelecidos quando chegar a vez, sem mock pra seguir
literalmente): Vistoria desktop, Agenda, Equipamentos, Produtividade.

---

## Fase B da crítica de design — captura de dado na tela do técnico (13/08)

Continuação da crítica externa: "todo o esforço de design foi pra tela de
quem lê o dado, quase nenhum pra tela de quem cria" — `page-os` tinha 15
linhas contra as 130+ do antigo Insights, e os indicadores quebrados do
`CLAUDE.md` (24,3% de `produto_id`, `duracao_min` zerado em 118 OS,
follow-up em 0/214) são todos de captura, não de análise. As três
recomendações concretas, implementadas:

**1. Check-in automático ao abrir a OS.** Antes exigia selecionar o
técnico e apertar "Check-in" — 118 OS ficaram com `duracao_min` zerado
porque o botão existia e ninguém apertava. Agora `_abrirOSForm()` chama
`fazerCheckin()` sozinho quando: é técnico (`eTecnico()`), a OS não está
concluída, ainda não há check-in ativo, e essa OS ainda não recebeu
auto-checkin nesta sessão do navegador (`_autoCheckinFeitoPara`, um
`Set` — guarda contra resetar o cronômetro toda vez que o técnico só
volta a olhar a mesma OS já aberta antes). Check-out continua manual
de propósito — só o técnico sabe quando terminou, abrir a tela não
implica isso.

**2. "Materiais utilizados" virou seletor de produto.** Card novo
"🧰 Materiais utilizados" com busca (mesmo padrão de busca+carrinho da
Venda Rápida — `osMatBuscarProduto`/`osMatAddItem`/`osMatRemoverItem`):
escolher da lista dá baixa no estoque **na hora** via
`registrarMovimento()`, não só quando alguém depois interpreta texto
livre. Remover um item devolve o estoque (entrada de estorno, histórico
de movimento preservado — nunca edita/apaga o movimento original).
`os-mat` (textarea) não sumiu — virou "Outras observações de material",
pra quando o material não está no estoque cadastrado (trazido pelo
cliente, peça de terceiro). `_osMatTextoFinal()` junta os dois numa
string só na hora de salvar (`gerarOSPDF`/`_fazerCheckoutConfirmado`) —
**sem migração de schema**: `ordens_servico.materiais` continua sendo
uma coluna de texto, PDF e histórico não mudam de formato. Limitação
aceita conscientemente: a lista estruturada não persiste entre sessões
de edição (reabrir uma OS já salva mostra o texto final, não os chips
de novo) — resolver isso exigiria coluna nova, fora do escopo desta
mudança.

**3. "Registrar contato" entrou no orçamento.** Antes só existia na fila
de follow-up (tela separada) — achado da Etapa 3 já dizia que Tamara/
Elis são reativas, não navegam lista pra ligar; o problema não era a
posição do card, era a ação viver fora do momento em que a pessoa já
está olhando o cliente. Botão "📞 Registrar contato" novo em
`form-back-bar` (só aparece editando um orçamento existente — mesma
condição do "← Voltar ao Histórico"), chama a MESMA
`abrirCrmContato(editId)` já usada pela fila — zero duplicação de
lógica, só um segundo ponto de entrada pro mesmo modal.

Testado no browser local (`dbOk=false`, sessão técnico e gestor):
check-in dispara sozinho ao abrir OS (confirmado em desktop e mobile),
reabrir a mesma OS não reseta o cronômetro; adicionar material baixa o
estoque de verdade (`registrarMovimento` com `ref` rastreável
`os_mat:<os_id>:<produto_id>:<timestamp>`), remover estorna
corretamente (verificado o histórico completo de movimentos, saída +
estorno, nenhum apagado); botão de contato aparece só editando orçamento
existente, abre o modal certo com os dados certos. Zero erro de console
além do ruído de 400 já documentado. `sw.js` v123→v124.

---

## Desdobrado "Insights" em "Hoje" + "Resultado" — crítica de design externa (13/08)

O Marcos colou uma crítica de design formal (markup-only, sem ver o app
rodando) apontando o achado central certo: a tela de Insights tinha sido
reordenada 3x no mesmo dia (ver notas acima) e nunca "parecia certa" —
não porque a ordem estivesse errada, mas porque uma coluna só de 9 cards
respondia três perguntas incompatíveis ao mesmo tempo ("o que eu faço
agora" / "como está a carteira" / "como foi o resultado"). Reordenar só
trocava quem ganhava aquela semana; nunca resolvia.

**Aprovado pelo Marcos: fazer a recomendação 1 (desdobrar) E a
recomendação de fundo da parte 2 (tela do técnico) na mesma sessão.**
Esta nota cobre a 1; a da tela do técnico vem depois.

### O que mudou

- **`page-hoje`** (nova, `snb-hoje`/`mnb-hoje`) — só AÇÃO: Precisa de você
  hoje, Fila de follow-up, Cadência de recompra, Chegando aí. Vira a
  landing do gestor (`telaInicial()` retorna `'hoje'`, não mais
  `'insights'`).
- **`page-insights`** vira "Resultado" — só leitura: KPIs, Em que fase
  está, Análise de clientes, Financeiro, DRE. **Manteve o id `insights`
  de propósito** (minimiza raio de mudança em quem referencia
  `page-insights`/`renderPainelInsights()` no código — só o rótulo
  visível virou "Resultado").
- **Blocos de ação sempre visíveis com estado vazio explícito** (achado
  🔴 da crítica): `renderCadenciaFila()` e `renderCadenciaProximos()`
  escondiam o card inteiro (`display:none`) quando vazios —
  `renderPainelHoje()` já não fazia isso. Agora as três mostram "✅ nada
  pendente" em vez de sumir. Landing estável = memória muscular de onde
  as coisas ficam.
- **`renderPainelInsights()` dividida em duas**: `renderPainelHojePage()`
  (novo, `_itensPainelHoje`/notif/fila/cadência/chegando) e
  `renderPainelInsights()` enxuta (só KPIs/estágio/análise/financeiro/
  DRE — absorveu as chamadas que antes viviam soltas no `.then()` de
  `go()`).
- **`crmFiltrarFaixa()` cruza páginas** — clicar numa faixa em "Resultado"
  navega pra "Hoje" com a fila já filtrada (a fila não mora mais na
  mesma tela do gráfico). Chip "✕ limpar filtro" novo no subtítulo da
  fila, porque o gesto antigo ("toque de nov na faixa") não está mais
  visível de "Hoje".
  🔴 **Bug pego em teste, corrigido antes de commitar:** limpar o filtro
  atualizava `_crmFaixaFiltro` mas não redesenhava nada quando a pessoa
  já estava em "Hoje" (nenhum dos dois ramos originais cobria esse
  caso) — o chip ficava travado na tela mesmo com o filtro já limpo por
  baixo. Corrigido: a função agora sempre redesenha a página onde está,
  além de navegar quando precisa setar o filtro vindo de "Resultado".
- **Sino de notificações**: os 3 itens que apontavam `go('insights')`
  (fila, cadência atrasada, cadência chegando) agora apontam
  `go('hoje')` — é onde o conteúdo deles mora agora.
- **Nav mobile do gestor**: "Vistorias" saiu do slot inferior (continua
  na sidebar), "Hoje" entrou no lugar — landing precisa caber em 1
  toque no celular (achado 🟡 da crítica: Insights nunca esteve na nav
  inferior, ficava só dentro de "☰ Mais"). Técnico mantém "Vistorias"
  no slot de baixo — quem faz vistoria de verdade é ele.
- **Removido `.hdr-nav`/`.nb`** (achado 🟢, código morto): 11 botões com
  `display:none!important` fixo desde sempre — a navegação real sempre
  foi a sidebar. Removida a marcação HTML, o CSS (2 regras + 1 na media
  query mobile) e o `navRules` do JS que só existia pra esconder/mostrar
  botões que nunca apareciam.

Testado no browser local (`dbOk=false`) em desktop e mobile: landing
correta (`page-hoje`), sidebar com "Hoje"/"Resultado", nav mobile com 5
slots corretos por perfil, os 3 blocos de ação em "Hoje" mostrando
estado vazio em vez de sumir, filtro de faixa cruzando pra "Hoje" e
voltando a limpar corretamente, sino navegando pro lugar certo, zero
erro de console (fora o ruído de 400 já documentado, de testes locais
anteriores, sem relação com este código). `sw.js` v122→v123.

---

## Causa 1 fechada — `_autoSalvarCliente()` agora checa o servidor antes de criar (13/08)

Continuação direta da nota "Fichas duplicadas voltando sempre" (acima).
Marcos escolheu a **Opção 2** das três propostas: checar o servidor antes
de criar, em vez de parar de auto-criar ou só refrescar o cache por
idade.

**O que mudou em `_autoSalvarCliente()` (`app.js`, perto de
`salvarNovoCliente`):** virou `async`. Quando não acha o nome no cache
local (comportamento de antes, inalterado), agora — se `dbOk&&db` —
consulta o servidor (`db.from('clientes').select(...).ilike('nome',
nome).limit(20)`, `ilike` sem `%` é match exato case-insensitive, mesmo
critério do check local) antes de decidir criar. Achou lá (criado por
outro aparelho): só adiciona ao cache local deste aparelho com o `id`
real do servidor — não cria de novo. Não achou (ou deu erro de
rede/timeout): cai no mesmo fluxo de sempre (cria local + sincroniza),
sem travar o salvamento do orçamento por causa disso.

**Continua fire-and-forget** nos 3 pontos que chamam a função
(`salvarApenas`/`gerarPDF`) — não precisei tocar nos call sites, `await`
numa função async chamada sem `await` continua válido, só não bloqueia
quem chamou. O `cliente_id` do orçamento em si nunca dependeu desta
função (vem de `_orcClienteSelecionado`, mecanismo separado da Etapa 2),
então não há risco de o orçamento salvar "sem cliente" enquanto a
checagem ainda está rodando.

**Testado com mock de `db`/`salvarClienteRemoto`** (nenhuma escrita real
em produção — só a query de leitura simulada, nunca executada de
verdade): 5 cenários — (1) não existe em lugar nenhum → cria; (2) existe
no servidor, não no cache local → usa o do servidor, não duplica; (3) já
existe no cache local → nem consulta o servidor; (4) existe no servidor
mas em outro grupo de loja (aquamotor × Fortemp) → não casa, cria (grupo
isolado continua isolado); (5) erro de rede na consulta → cai no
fallback de sempre, `console.warn` correto, não trava o fluxo. Todos
passaram.

⚠️ **Pegadinha de teste registrada pra próxima sessão:** `db` (igual
`dbOk`) é uma variável léxica (`let`), não `window.db` — setar
`window.db = mock` no console/DevTools NÃO troca o que as funções do
app enxergam. Primeira rodada de teste falhou silenciosamente por
causa disso (o mock nunca era chamado, a função sempre caía no
fallback real). Setar sempre `db = mock` (bare), mesmo padrão já
documentado pra `dbOk`.

**Não fechado, fora do escopo desta mudança:** o `_dupGrupos()` mais
completo (passada 1B, nota acima) resolve o que já existe hoje; esta
mudança impede que o MESMO padrão (auto-criação cega) continue gerando
duplicata nova a partir de agora. Os dois juntos fecham o ciclo.

`sw.js` v121→v122.

---

## Fichas duplicadas voltando sempre — investigado, causa real achada e parcialmente fechada (13/08)

Marcos: "volta e meia está aparecendo no sistema pra mim pra limpar as
fichas" — pediu pra confirmar se o incidente de duplicação (encerrado
11/08) foi realmente resolvido. **Resposta curta: não completamente —
achei duas causas distintas, uma corrigida agora, outra ainda em
aberto, precisa de decisão do Marcos.**

**Confirmado contra produção (leitura, anon key):** existem **16
grupos / 19 fichas duplicadas reais agora mesmo**, todas criadas
DEPOIS do fechamento de 11/08. Isso não é a tela "grudada" mostrando
lixo antigo — é duplicata nova, genuína.

**Causa 1 — `_autoSalvarCliente()` continua criando fichas cegas
(NÃO CORRIGIDO, decisão do Marcos pendente).** Já tinha sido apontada
como risco na Etapa 2 ("mesma classe de risco da causa raiz do
incidente... não mexido, fora do escopo") — agora confirmado como a
causa ativa. A função só checa o **cache local do aparelho**
(`lsCliLer()`) antes de criar ficha nova — nunca consulta o servidor.
Todo aparelho que salva um orçamento/OS/vistoria pra um cliente que
não está no cache DAQUELE aparelho específico cria sua própria cópia,
quase sempre com telefone/endereço em branco (só o nome, capturado no
momento do salvamento). Com Marcos/Bruno/Josimar/Eldecir/Tamara/Elis
em aparelhos diferentes, cada um "descobrindo" o mesmo cliente pela
primeira vez no seu próprio cache gera uma ficha nova. Padrão batendo
100% nos 16 grupos achados: 1 ficha "real" (endereço/telefone
preenchido, geralmente a mais antiga) + 1-2 cópias com campos em
branco.

Três jeitos de fechar isso de vez, nenhum implementado ainda —
**precisa o Marcos escolher**, é mudança na forma como cliente é
criado, mesma cautela usada pra desligar `_migrarClientesDeOrcamentos`:
1. Parar de auto-criar: orçamento com nome não reconhecido fica sem
   `cliente_id`, sem ficha nova — só é criada ficha na Identidade ou
   na busca explícita (regride conveniência, elimina o risco de vez).
2. Checar o servidor antes de criar (não só o cache local) — mais
   fiel ao comportamento atual, adiciona 1 consulta por orçamento
   salvo com nome não reconhecido.
3. Atualizar o cache local do servidor antes de checar, só quando
   estiver velho — meio-termo, sem consulta em toda gravação.

**Causa 2 — lacuna no `_dupGrupos()` (CORRIGIDO agora).** Mesmo
quando o Marcos clicava "Revisar e limpar", boa parte dessas 19
fichas **não aparecia pra limpar** — por isso "nunca resolvia de
verdade". A passada 1 (por nome) só disparava com **exatamente 1**
cópia em uso; a passada 2 exigia a **tripla idêntica** (nome+endereço+
telefone). Nos 16 grupos achados, NENHUMA cópia tem uso (nem
orçamento, nem OS, nem equipamento, nem local de vistoria) — e os
endereços divergem entre as cópias (um preenchido, o outro em
branco). Isso não batia em NENHUMA das duas passadas — ficava pra
sempre invisível pro "Revisar e limpar", mesmo sendo exatamente o
tipo de duplicata vazia que a ferramenta existe pra resolver.

**Fix:** nova "PASSADA 1B" em `_dupGrupos()` (`app.js`, entre a
passada 1 e a passada 2) — mesmo nome, **zero** cópias em uso (não só
exatamente 1), CNPJ não pode divergir (mesma trava da passada 2),
mantém a ficha mais completa (telefone+endereço+cnpj+tipo+email
preenchidos desempata; empate total cai pra mais antiga). Testado
contra o banco real de produção (dados carregados read-only num teste
isolado, `_dupGrupos()` chamada como função pura, nenhuma exclusão
executada): **detecta corretamente os 16 grupos/19 fichas** — bate
com uma análise independente feita em Python direto contra os dados
crus. Confirmado também na tela real (`abrirRevisaoDuplicatas()` →
modal lista os 16 grupos certos, cada um mantendo a ficha mais
completa).

**Não apaguei nada** — nem via API direta, nem confirmando o modal de
teste. Isso é decisão do Marcos: da próxima vez que ele abrir Clientes
e clicar "Revisar e limpar", agora VAI aparecer e limpar essas 19
fichas de verdade (antes, várias ficavam invisíveis pra sempre). Mas
sem resolver a Causa 1, o mesmo padrão volta a se acumular — é
questão de tempo, não "se".

`sw.js` v120→v121.

---

## Densidade dos cards — reduzido whitespace geral (13/08, feedback de voz)

Marcos: os cards ficaram legíveis mas grandes demais pro conteúdo que
carregam — "acho que dava pra posicionar mais coisas numa tela junto...
pra dar pra ver um pouco de tudo". Cortado padding/margin em cascata,
mantendo tipografia intacta (só espaço em branco, não tamanho de fonte):

| Classe | Antes | Depois |
|---|---|---|
| `.card` padding / margin-bottom | 22px / 16px | 16px / 12px |
| `.ct` margin-bottom / padding-bottom | 16px / 9px | 10px / 6px |
| `.dash` gap / margin-bottom | 12px / 20px | 10px / 14px |
| `.dc` padding | 16px 18px | 12px 14px |
| `.fin-card` padding / margin | 18px 20px / mt 20px | 14px 16px / mt+mb 12px |
| `.crm-card` padding / margin-bottom | 14px 16px / 10px | 11px 13px / 8px |
| `.notif-item` padding | 11px 14px | 9px 12px |
| linha de `_itensPainelHoje` (app.js) | 9px 0 | 7px 0 |
| `.card-action` fade do wash tonal | 110px | 70px (proporcional ao card menor) |

**Não mexido de propósito:** `.crm-acts .tb{min-height:44px}` — é regra
de acessibilidade (alvo de toque mínimo pra botão usado em campo), não
espaço decorativo; comprimir isso seria trocar densidade por erro de
toque no celular do técnico/vendedor.

Testado no browser local e em mobile (375px): nitidamente mais conteúdo
visível por tela sem quebra de layout nem texto cortado — comparação
direta do "Em que fase está" (cabia parcialmente cortado antes, cabe
inteiro + começo do próximo card agora, mesma viewport). `sw.js`
v119→v120.

---

## Insights reordenado de novo — "Em que fase está" é o mais no topo (13/08, correção)

Marcos corrigiu a reordenação anterior por áudio: não era Cadência de
recompra que ele mais queria em cima, era **"Em que fase está"** ("a fila
de conversões" — a barra de estágio do funil). Movida pra primeiro card
depois dos KPIs, na frente de Cadência/Chegando aí. Ordem final:
KPIs → Em que fase está → Cadência de recompra → Chegando aí → Análise
de clientes → Precisa de você hoje → Fila de follow-up → Resultado
Financeiro → DRE. Testado no browser (`dbOk=false`, seed de orçamentos
pipeline pra popular a barra): renderiza primeiro, sem erro. `sw.js`
v118→v119.

**Padrão pra próxima sessão:** posição de card no Insights é
literalmente o que o Marcos falar por último — não travar numa
justificativa própria (a nota anterior, de UMA hora atrás, já tinha
"corrigido" a mesma seção uma vez). Se ele pedir de novo, mover de novo,
sem resistência.

---

## Reordenação do Insights + rótulo "Venda Rápida" (13/08, feedback de voz direto)

Duas mudanças pontuais de UX pedidas pelo Marcos, por áudio, depois de ver
o app no ar:

**1. Ordem do Insights invertida.** Ele achou que Cadência de recompra,
Em que fase está e Análise de clientes ("uma das que mais precisa
aparecer lá no topo") deveriam vir antes de Precisa de você hoje e Fila
de follow-up, não depois — o oposto da decisão registrada na nota "Etapa
3" (mais antiga, mesma data). Aquela decisão era uma inferência minha a
partir da adoção zerada da fila; esta é instrução direta e mais recente,
prevalece. Nova ordem em `index.html`: Cadência → Chegando aí → Em que
fase está → Análise de clientes → Precisa de você hoje → Fila de
follow-up → Resultado Financeiro → DRE. Justificativa que também faz
sentido por conta própria: "Precisa de você hoje" e "Fila de follow-up"
já aparecem em QUALQUER tela via o sino de notificações — não perdem
alcance por sair do topo do Insights.

**Bug pré-existente corrigido de passagem:** a `<div class="fin-card">`
(Resultado Financeiro) nunca tinha sua própria tag de fechamento —
"Análise de clientes" e "DRE por unidade" ficavam aninhados dentro dela
por acidente (só não quebrava visualmente porque divs toleram isso).
Como já precisei mexer nesse trecho pra reordenar, fechei o `.fin-card`
no lugar certo (logo depois de `.fin-tabela-wrap`).

**2. "Nova Venda" → "Venda Rápida".** Rótulo não era autoexplicativo (o
Marcos: "ela não ficou autoexplicativa o suficiente"). Trocado no botão
da sidebar (`#snb-venda-balcao`) e no cabeçalho do modal
(`#venda-modal`), único outro lugar com o texto.

Testado no browser local (`dbOk=false`): ordem nova confere, `.fin-card`
fechado renderiza Resultado Financeiro/DRE como cards separados sem
regressão, modal abre com o texto novo. `sw.js` v117→v118.

---

## Task #37 fechada — 2 ligações acidentais de cliente corrigidas em produção (13/08)

Investigado direto contra produção (leitura via REST + anon key, mesmo
padrão dos baselines). "Torri di Mare" **não tinha problema**: as 7
fichas (1 orçamento + 6 OS, cliente_id `d2f3d1a9...`) têm todas o mesmo
`local_servico` ("SENADOR ATILIO FONTANA, 933, PEREQUE"), só espalhadas
entre `fortemp-itapema` e `aquamotor` — é o mesmo condomínio atendido
pelas duas lojas, ligação correta.

O problema real estava em **"Di Maria"**, que são DUAS entidades
diferentes com nome parecido:
- `0d8131bd...` "RESIDENCIAL DI MARIA" (endereço da ficha: Rua Rio
  Canoinhas)
- `7661aef8...` "CONDOMINIO DI MARIA" (endereço da ficha: Rua 428,
  Morretes, Itapema)

Dos 4 orçamentos ligados a `0d8131bd` ("Residencial"), **2 tinham
`local_servico` = "Rua 428, Morretes-Itapema"** — o endereço da OUTRA
ficha, não da que estavam ligados. Prova independente e objetiva (o
campo é preenchido por orçamento, não herdado da ficha do cliente) —
não foi achismo por nome parecido. Corrigido via `PATCH` direto nas
duas linhas (`orcamentos.id` `518985aa...` e `21edf050...`,
`cliente_id` → `7661aef8...`). Verificado depois: as duas fichas agora
têm 100% de coerência interna entre `local_servico` e endereço próprio.

**Nota pra quem for investigar caso parecido de novo:** `local_servico`
(preenchido por orçamento, independente da ficha) é um sinal mais
confiável que nome/CNPJ pra flagrar ligação errada entre clientes de
nome parecido — CNPJ e telefone às vezes é de terceiro (síndico,
administradora) que se repete entre condomínios diferentes.

---

## Etapa 6 (motor de eventos recorrentes) — versão enxuta, deliberadamente pequena (13/08)

O Marcos pediu pra seguir pro "motor de recorrência e demais evoluções". O
texto original das 8 etapas nunca foi salvo em lugar nenhum do repo (só foi
colado direto numa conversa, ver aviso mais abaixo) e ele não tinha o texto
à mão pra colar de novo — me pediu pra decidir. Antes de construir qualquer
coisa, voltei à nota de duas seções abaixo ("Etapa 3 — cobertura da
carteira"): o próprio roadmap original já marcava a Etapa 6 como prematura
(base com poucos meses de histórico) e a Etapa 3 mediu **0% de adoção** do
mecanismo de follow-up mais simples que já existia. Construir agendamento
automático ou geração de OS em cima disso — a leitura mais óbvia de "motor
de eventos recorrentes" — repetiria o mesmo erro: mecanismo pesado sobre
hábito que ainda não existe.

**O que fiz em vez disso:** só mudei O MOMENTO do aviso. `cadenciaCandidatos()`
(Etapa 4) só avisava depois que o cliente já tinha passado do próprio
ritmo — reativo, "já era". `cadenciaProximos()` (nova, `app.js`, logo depois
de `cadenciaDispensar()`) avisa **~7 dias antes**, reaproveitando o mesmo
cálculo (intervalo observado via `analiseClientes()`, ou `previsaoTeorica`
pra quem só comprou uma vez) — zero tabela nova, zero side effect. Cor
cinza/azul em vez de laranja, tanto no card `#ins-proximos-card`
("📅 Chegando aí", `.card` neutro, não `.card-action`) quanto na notificação
(`crm-cadencia-proximos` em `getNotificacoes()`) — sinal deliberadamente
mais suave que "atrasado", porque ainda não é.

**Por que não usei a tabela `agendamentos` existente:** ela já é um motor de
recorrência de verdade — plano com periodicidade/dia/técnico que
auto-gera OS (`gerarOSdoAgendamento`). Mas é semântica de **visita técnica
agendada**, não de "avise que este cliente vai precisar comprar mais
cloro". Usar a tabela errada teria dois efeitos colaterais reais: OS sendo
criada sozinha pra algo que ainda é só uma estimativa (margem de erro
±35-50%, documentada em `docs/referencia-consumo-quimico-piscinas-2026-08-12.md`),
e um técnico sendo implicitamente atribuído a uma reposição que talvez
seja só telefonema.

Testado no browser local (`dbOk=false`): cliente com 2 compras a cada 30d,
última há 26d → aparece em "Chegando aí" com "faltam ~4d" (não em
"atrasado"), badge do sino sobe, toast dispara. `sw.js` v116→v117.

**Etapas 7 e 8:** pedi pro Marcos decidir se tinha o texto original — ele
me deixou propor. A 8 (atribuição) já tem baseline capturado em
`docs/crm-baseline-atribuicao-2026-08-12.md`; construir em cima dela sem
saber o que o texto original pedia é o mesmo risco de adivinhar errado que
evitei aqui. Deixei registrado como próximo passo a discutir com o Marcos,
não construí nada às cegas.

---

## Hierarquia visual — cards de ação vs. informativo (13/08)

Segunda parte do pedido do Marcos sobre a interface ficar "um pouco
arcaica": antes TODO card do Insights (KPI, ação, análise, DRE) tinha o
mesmo branco liso, mesma sombra, mesmo cabeçalho em caixa alta laranja —
zero pista visual de prioridade. Ele citou a hierarquia do Insights como
exemplo concreto.

**Duas peças novas em `styles.css`, reaproveitadas em vários lugares:**
- `.card-action` — borda superior de 3px na cor de marca (`--c1`, que é
  branded via JS por empresa — no teste local do Forthemp saiu azul, não
  laranja, e está certo, é o próprio sistema de white-label já existente)
  + wash tonal (`--c1-light`) que desvanece pro branco nos primeiros
  ~110px. Aplicado só nos 3 cards que pedem ação HOJE: "Precisa de você
  hoje", "Fila de follow-up", "Cadência de recompra". Os informativos
  ("Em que fase está", "Resultado Financeiro", "Análise de clientes",
  "DRE por unidade") continuam brancos lisos — o contraste é a hierarquia.
- `.ct-ico` / `.icon-badge` — badge circular colorido em vez de emoji
  solto no meio do texto. `.ct-ico` nos títulos de seção (`.ct`,
  `index.html`); `.icon-badge` nas linhas de lista dinâmica
  (`_itensPainelHoje` em `renderPainelHoje()` e o painel de notificações
  em `renderNotificacoes()`, `app.js`) — cor do badge = `_corParaBadge()`
  mapeando a mesma `cor` que cada item já carregava (antes usada só numa
  barrinha lateral de 4px, que foi removida por redundante depois do
  badge assumir o sinal de cor).

**Não mexi** nos `.dc` (cards de KPI — já tinham diferenciação via borda
superior colorida, essa camada já existia) nem nos `.crm-card` (itens da
fila/cadência — ícone fica dentro do texto do motivo, reestruturar isso é
escopo maior, ficou de fora de propósito).

Testado no browser local (`dbOk=false`, mesma sessão simulada via
`sessionStorage`) em desktop e mobile (375px): contraste de ação vs.
informativo visível de cara, sem overflow, sem regressão nos KPIs/DRE/
tabela financeira. `sw.js` v115→v116.

---

## Central de notificações — sino no cabeçalho (13/08)

Pedido direto do Marcos: "criar um tópico de notificações, que vai
enumerando e cada vez que vai aparecer uma notificação diferente fica um
popup ali, se abrir as notificações ele vai deixando o histórico...
separado em outro local". Motivação de fundo é a mesma da Etapa 3: Tamara
e Elis são reativas, não navegam pra achar avisos — os avisos precisam
aparecer sozinhos, em qualquer tela, não só em Insights.

**O que existe agora:** sino 🔔 no `.hdr-right` (só gestor/master — as
fontes de dado são todas telas de gestor; pra vendas/técnico ficaria
sempre vazio e confundiria). Badge com contagem, popup toast na primeira
vez que uma categoria aparece, painel com abas **Pendentes** (com botão
de ação + ✕ dispensar por 1 dia) e **Histórico** (últimos 50 dispensados,
`localStorage`, sem expirar).

**Não duplica nenhum motor** — `getNotificacoes()` (`app.js`, perto de
`renderPainelHoje`) só agrega o que já existia: `_itensPainelHoje()`
(extraída de `renderPainelHoje()` pra virar reaproveitável — recebível
vencido/hoje, aprovado sem cobrança, ruptura de estoque, despesa fixa,
orçamento sem identidade), mais um item agregado cada pra fila de
follow-up (`crmCandidatos()`), cadência de recompra
(`cadenciaCandidatos()`) e saldo negativo (`_estoqueNegativos()`). Cada
item carrega um `id` estável (`receb-vencido`, `crm-fila`,
`estoque-negativo`, etc.) — precisa ser estável porque dismiss/seen/
histórico são chaveados por ele, não pelo texto (que muda com os
números).

Semântica do popup: toca **uma vez** por categoria nova (marca "vista" na
hora); se a categoria sumir e voltar depois, toca de novo (o
`_notifSeen*` é podado a cada render pra categorias que não estão mais
presentes). Dispensar (✕) é 1 dia — mais curto que os 14 dias da
cadência, porque isso aqui é operacional do dia a dia, não recompra.

⚠️ **Bug pego em teste, corrigido antes de commitar:** dispensar uma
notificação fechava o painel inteiro sem querer. Causa: `notifDispensar`
reconstrói o `innerHTML` do painel na hora, o que desconecta do DOM o
próprio botão que disparou o clique — quando o evento chegava (bubbling)
no listener de "clicar fora" (`e.target.closest('.notif-wrap')`), o
`target` já estava órfão e `closest()` retornava `null`, fechando o
painel. Troquei para `e.composedPath()`, que é o caminho capturado no
momento do despacho do evento e continua válido mesmo depois da mutação
do DOM.

Testado no browser local (`dbOk=false`, sessão de gestor simulada via
`sessionStorage` direto — sem passar pelo login real pra não gravar
auditoria contra o Supabase de produção, que estava com `dbOk=true` por
padrão neste worktree): badge conta certo, toast dispara só na primeira
aparição de cada categoria, dispensar remove da lista sem fechar o
painel, histórico acumula e persiste entre reloads, aba
Pendentes/Histórico troca certo, botão de ação fecha o painel e navega
(`closeNotif();go(...)`), engrenagem e sino se fecham mutuamente. `sw.js`
v114→v115.

**Nota de infra de teste:** `.claude/launch.json` na raiz de
`~/Documents` (não no worktree) apontava `http.server` sem `--directory`
pro próprio `~/Documents` — 404 em tudo. Tentei `--directory` apontando
pro worktree e ainda assim 404 (o wrapper `disclaimer` do preview parece
restringir o quê o subprocesso pode abrir quando o caminho vem por flag
explícita). O que funcionou foi o padrão já usado alhures no projeto:
`sh -c "cd <worktree> && exec python3 -m http.server 4321"` — `cd`
dentro do `sh -c` passa pelo sandbox, `--directory` como argumento não.
Deixado assim no launch.json global pra próxima sessão não perder tempo
com o mesmo problema.

**Ainda não feito** (próximo passo, mesmo pedido do Marcos): "ajustar o
resto que você sugeriu" — o mockup de hierarquia visual (fundos tonais
distinguindo seção de ação vs. informativa, badges de ícone) que ficou
combinado como trabalho separado, depois do sino.

---

## 🔴 Bloqueio real reportado pela Elis — corrigido (13/08)

O Marcos relatou que a Elis foi aprovar um orçamento **só de mão de obra**
(sem produto de estoque nenhum) e o sistema travou, pedindo pra "cadastrar
no estoque" algo que não deveria precisar de estoque. Root cause: o check
de `semVinculo` em `mudarSt()` (item sem `produto_id` E sem `avulso=true`)
era um **bloqueio duro** — `toast()` + `return`, sem nenhum caminho de
saída além de abrir o orçamento e marcar a checkbox "não é produto" item
por item. Essa validação em si é recente e tem propósito real (medido:
Camboriú só linkava 24,3% dos itens ao estoque, causando saldo errado em
silêncio) — não é bug de lógica, é falta de uma saída rápida pro caso mais
comum (serviço puro).

**Fix:** o bloqueio virou uma confirmação (`confirmar()`, nunca
`window.confirm` — proibido neste projeto) com resolução em 1 clique —
"Aprovar mesmo assim" marca todos os itens sem vínculo como `avulso=true`
e prossegue a aprovação; "Cancelar, vou revisar" reverte exatamente como
antes. `mudarSt()` foi dividida em `mudarSt()` (só as validações) +
`_mudarStProsseguir()` (o resto do fluxo, chamado direto ou depois da
confirmação). O aviso de que aquele item não vai gerar baixa automática
continua aparecendo — só não é mais um beco sem saída.

Testado no browser local (`dbOk=false`, servido diretamente deste
worktree — `preview_start` com nome de servidor caiu num launch.json de
outro diretório e serviu app.js desatualizado, corrigido subindo um
`python3 -m http.server` direto neste path): (1) item sem vínculo →
abre confirmação com o texto certo, orçamento continua pendente até
decidir; (2) "Aprovar mesmo assim" → marca avulso, aprova, grava
`data_aprovacao`, fecha modal; (3) "Cancelar" → reverte pro status
anterior, não mexe no item; (4) bloqueio de forma de pagamento (checagem
anterior, não relacionada) continua intacto; (5) item já com `avulso` ou
`produto_id` aprova direto, sem modal — caminho feliz sem regressão. `sw.js`
v113→v114.

⚠️ **Achado no próprio processo, corrigido antes de commitar:** ao
refatorar, uma limpeza de código apagada por engano a chamada de
`_congelarCustoOrc(o)` (congela o custo do item antes da baixa de estoque)
— pego relendo o diff antes de testar, não em produção.

---

## Etapa 3 — cobertura da carteira, achado real de adoção (13/08)

O próprio roadmap original tinha um ponto de parada nunca verificado:
"depois da 3, medir a cobertura da carteira — perto de zero, parar e
rever o desenho antes de seguir." Medi: **0 de 214 orçamentos abertos**
têm qualquer sinal de follow-up (`proximo_contato`/`decisao_prevista`/
`motivo_perda`/`crm_notas`) — mesmo número de ontem, apesar do mecanismo
("📞 Registrar contato" na fila) existir há semanas.

**Auditei o fluxo antes de mexer** (mesmo método usado pra achar o
problema da Nova Venda): a fila renderiza bem, o modal é curto (2 campos
com default sensato, salva em 1 clique) — **não é friction de UI**. O
achado real veio do Marcos: quem usa o sistema todo dia de verdade é
**Tamara e Elis**, e a rotina delas é **reativa** — recebem demanda de
cliente (loja, tráfego) e montam orçamento. Não navegam uma "lista pra
ligar" porque o dia delas não é feito de ligações de saída, é resposta a
quem já chegou.

**O que mudei (só isso — reordenação, não redesenho):** "Fila de
follow-up" e "Cadência de recompra" mudaram de lugar em `index.html`,
pra logo depois de "Precisa de você hoje" (a seção que já é "faça isso
agora") e antes de "Em que fase está" (que é mais análise que ação).
Antes, a fila ficava depois do gráfico de estágio — dava pra nunca rolar
até lá antes de já estar no próximo orçamento, mesmo passando pelo
Insights todo dia (que já é a tela inicial delas).

Efeito colateral aceito: clicar numa faixa do gráfico "Em que fase está"
pra filtrar a fila agora exige rolar pra CIMA pra ver o resultado (a fila
ficou acima do gráfico no HTML). É uma interação secundária, não o fluxo
principal — troca que vale a pena.

**Não fiz mais nada em cima disso** — não sei se mover resolve, é uma
mudança de posição, não de hábito. Não construí Etapa 6 (motor de eventos
— o próprio roadmap já dizia que não é urgente, base tem só 4 meses) nem
fui além na Etapa 8 (atribuição), porque os dois dependem do mesmo hábito
de registrar contato que está zerado. Próxima sessão: medir de novo depois
de alguns dias de uso com a fila no topo — se continuar zerado, o problema
não é posição na tela, é processo (talvez a decisão de "ligar" nem seja da
Tamara/Elis, e sim de quem recebe o WhatsApp — vale perguntar ao Marcos
antes de mexer mais).

---

## Etapa 4 estendida — fatores de piscina + bromo/peróxido + editar piscina (13/08)

Marcos pediu pra "estender e fazer tudo certinho" em cima do consumo
teórico (seção "Etapa 4 fechada" logo abaixo). Aplicados os campos que o
documento (`docs/referencia-consumo-quimico-piscinas-2026-08-12.md`, seção
7.2) lista como maior retorno preditivo, na ordem de prioridade dele.

- **`piscinas` ganhou 6 colunas** (`migracao-piscinas-fatores.sql`):
  `capa_termica`, `exposicao_solar` (`pleno`/`parcial`), `aquecida`,
  `tipo_uso` (`residencial`/`condominio`), `banhistas_dia`,
  `estabilizante`.
- **`demandaDiaria(piscina)`** (app.js) — aplica os coeficientes da seção
  2.2 sobre `D_REF_CLORO`: estação do ano pelo mês atual (verão dez-mar
  1,0× · meia-estação 0,70× · inverno 0,45×), capa térmica 0,50×,
  exposição parcial 0,70×, aquecida 1,30×, sem estabilizante 2,15× —
  todos multiplicativos. Banhista de condomínio **soma**, não multiplica:
  `d += (banhistas_dia×4)/V`. `consumoTeoricoDias()` agora recebe esse `d`
  já calculado em vez de usar a referência fixa direto.
- **Bromo e peróxido** entraram em `consumoTeoricoDias()` como casos
  especiais (mesmo padrão de sal/cloro líquido). Bromo usa `d_Br` — **não**
  o `d` combinado de estação/capa/etc (achado no próprio teste: um `d`
  baixo por causa do inverno lia como "piscina protegida" mesmo sendo
  externa — sinais diferentes, confundir os dois dava conta errada).
  Corrigido pra usar `exposicao_solar` da piscina direto: parcial→2,5,
  pleno→7,0 (seção 3.6). PHMB continua sem estimativa — o documento manda
  tratar como parâmetro aprendido, não estimado.
- **Editar piscina** — não existia (só criar). Botão "✏️" ao lado do
  `<select>` de piscina no formulário de Equipamento reabre o mesmo form
  inline pré-preenchido; `_eqPiscinaCriar()` virou insert-ou-update
  conforme `_eqPiscinaEditId`. Necessário porque o import em massa de
  vistoria (que ficou de propósito só com nome/volume/tratamento, é fluxo
  de velocidade) precisa de algum jeito de completar os campos novos depois.

Testado no browser local (dbOk=false): cada coeficiente isolado bate com o
documento; cenário composto (piscina de condomínio 95m³, capa térmica,
exposição parcial, 60 banhistas/dia) calculado à mão e conferido —
banhistas domina mesmo com dois fatores "protetores" ativos (21 dias vs
145 de uma residencial equivalente sem carga de banhistas — bate com o
que o documento avisa sobre condomínio consumir 2-4× mais). Bug achado e
corrigido no próprio teste (bromo usando o `d` errado, acima). Criar
piscina com todos os campos, editar sem duplicar, campo de banhistas
só aparece pra condomínio — todos confirmados. Sem erro novo no console.

**Pendências que ficaram de fora, de propósito (registradas no documento
salvo, não no código):** calibração de `d` a partir de histórico real
(o documento recomenda como evolução natural depois de 2-3 ciclos
observados — ainda cedo, base tem 4 meses), corretores de pH/algicida/
clarificante/estabilizante como produtos próprios (consumo secundário,
menor sinal de recompra que o sanitizante principal), acumulação de ácido
cianúrico (seção 5 do documento — evento de compra oculto interessante,
mas não é o "quando recompra" central).

---

## Etapa 4 fechada — consumo teórico implementado (13/08, mesmo dia)

O Marcos trouxe a referência de dosagem química que faltava (pediu pra uma
IA de pesquisa, documento completo em
`docs/referencia-consumo-quimico-piscinas-2026-08-12.md`). Isso fecha a
segunda metade da Etapa 4 que tinha ficado de fora mais cedo hoje.

**Implementado (`app.js`, `CONSUMO_QUIMICO_REF`/`consumoTeoricoDias()`):**
só os tratamentos de confiança **alta** no documento têm cálculo real —
dicloro granulado, hipoclorito de cálcio, cloro líquido, pastilha/tricloro,
sal (gerador salino). `d` fixado em 2,0 g Cl₂/m³/dia (referência "verão/
externa/uso moderado/estabilizada", seção 2 do documento) — **os
coeficientes de ajuste por estação, capa térmica e carga de banhistas
(seção 2.2) NÃO foram aplicados**, porque a ficha da piscina não captura
esses campos hoje. Validei a fórmula contra os valores de referência do
próprio documento pra V=1m³ (bateu exato nos 4 clorados).

- `piscinas.tipo_tratamento` deixou de ser texto livre — virou select com
  os 8 tipos do documento (os 3 sem cálculo — bromo, peróxido, PHMB — ficam
  cadastrados corretamente mas sem estimativa, documento já os marca como
  nicho/baixa confiança). Os dois lugares que criam piscina (formulário de
  Equipamento e o import em massa de vistoria) ganharam o mesmo select.
- `analiseClientes()` calcula `previsaoTeorica` só pra cliente com
  **1 compra** e piscina com volume conhecido — some sozinho assim que
  há 2ª compra, porque o intervalo OBSERVADO sempre vence um número
  teórico (mesma hierarquia que o documento recomenda na seção 7).
- Fila de cadência agora mistura os dois: observado (`ritmo`) e teórico
  (`previsaoTeorica`), cada um com motivo e linguagem diferentes — o card
  teórico mostra explicitamente "⚠️ estimativa por fórmula, margem de erro
  grande (±35-50%)" porque é isso mesmo que o documento diz pra cliente sem
  histórico, e esconder essa incerteza seria enganoso.
- Só entra na fila teórica quem já **passou** da previsão (`diasAte<0`) —
  antes disso não vale incomodar com estimativa.

**Não implementado, registrado no documento salvo pra quem quiser
estender depois:** ajuste por estação/capa/banhistas (precisaria de campos
novos na ficha da piscina), calibração de `d` a partir do histórico real
(documento recomenda isso como evolução natural — depois de 2-3 ciclos
observados, o sistema já tem o `intervaloMedioDias`, dá pra inverter a
fórmula), corretores de pH/algicida/clarificante/estabilizante (consumo
secundário, menor sinal de recompra que o sanitizante principal), bromo/
peróxido/PHMB (nicho ou baixa confiança no próprio documento), acumulação
de ácido cianúrico (seção 5 — evento de compra oculto, interessante mas
não é o "quando recompra" central).

Testado no browser local (dbOk=false): fórmula validada contra os 4
valores de referência do documento pra V=1m³ (bateu exato), cliente
sintético de 1ª compra com piscina de 20m³/dicloro → previsão de 145 dias,
161 dias já passados → aparece na fila com o aviso de incerteza, os 3
seletores de tratamento (form de equipamento, import em massa, e a criação
de piscina em si) gravam `tipo_tratamento` corretamente. Sem erro novo no
console.

Com isso a Etapa 4 do roadmap está fechada — as duas fontes de previsão
que o briefing original pediu (observado + teórico) estão no ar.

---

## Etapa 4 do roadmap de CRM — só metade construída, de propósito (13/08)

O briefing original pedia duas fontes de previsão de recompra: **intervalo
observado** (dado real, cliente com 2+ compras) e **consumo teórico**
(volume da piscina × dosagem química, prevê recompra na 1ª venda). Só
construí a primeira.

**Motivo de não ter feito a segunda:** perguntei ao Marcos se ele tinha uma
regra real de dosagem (kg de cloro por m³ por mês, etc.) e ele não tinha de
cabeça — pediu um prompt pra levar numa IA de pesquisa e trazer a
referência pronta. Passei o prompt (não ficou salvo em arquivo, foi direto
no chat). **Até ele trazer essa referência, a Etapa 4 fica só com a metade
observada — não inventei número de dosagem.** Quando ele trouxer, a
próxima sessão pluga em cima do que já está pronto (o campo
`piscinas.volume_m3`/`tipo_tratamento` da Etapa 5 já existe esperando).

**O que foi construído (intervalo observado):**
- `analiseClientes()` agora calcula, por cliente com `cliente_id` real
  (`porId`) e 2+ compras aprovadas: `intervaloMedioDias` (média real entre
  compras) e `ritmo` (`em_dia`/`reduziu`/`parou` — os multiplicadores 1.3x/
  2.5x sobre o intervalo observado são heurística de bucket, não fato;
  ajustável). Coluna "Ritmo" nova na tabela de Análise de Clientes.
- Nova fila **"🔁 Cadência de recompra"** no painel de Insights, ao lado da
  fila de follow-up de orçamento — mesmo card visual (`.crm-card`), mesmas
  ações no espírito ("uma fila só" do briefing): ➕ Novo orçamento (já
  ligado ao `cliente_id`, corrigido `novoOrcParaCliente` que não fazia
  isso), 👁 Ver histórico, ✕ Dispensar (oculta por 14 dias — ciclo mais
  longo que o de orçamento, que usa 3).
- **Só entra na fila quem já tem `cliente_id` real** — sem isso não dá pra
  abrir orçamento/histórico ligado a uma ficha. Como a maioria dos 216
  nomes históricos ainda não tem identidade confirmada, a fila vai começar
  pequena e crescer conforme a Etapa 2 (cliente_id em orçamento novo) e a
  tela de Identidade forem confirmando mais clientes.

Testado no browser local (dbOk=false): cliente sintético com 2 compras
30 dias separadas e a última há 121 dias → classificado `parou` corretamente,
card aparece na fila, os 3 botões funcionam (novo orçamento liga cliente_id,
histórico abre, dispensar esconde e respeita os 14 dias). Sem erro novo no
console.

---

## Etapa 5 fechada — import em massa (63 equipamentos) agora escolhe piscina (12/08)

Última pendência da Etapa 5 registrada mais cedo hoje: a tela "Equipamentos
vistos em vistoria" (`renderEqImport`/`importarEqDaVistoria`, os 63
equipamentos vistos ao vivo em produção esperando cadastro) agora deixa
escolher a piscina de cada cliente antes de importar — igual ao formulário
manual de equipamento, mas por grupo (um seletor por card de cliente, não
por equipamento individual, já que o grupo inteiro do card veio da mesma
vistoria/local).

- Cada card de cliente na lista de import ganha um seletor de piscina
  (existentes daquele `cliente_id` + "+ Nova piscina…" inline) — só aparece
  quando o grupo já tem `cliente_id` resolvido (vistoria antiga, de antes da
  correção anterior, pode não ter — aí mostra um aviso em vez do seletor).
- Escolha fica guardada em `_eqImportPiscinaEscolhida` (por cliente_id),
  sobrevive a re-render (criar piscina nova re-renderiza a lista inteira).
- "Cadastrar N" (por cliente) e "Cadastrar todos" os 63 de uma vez **os
  dois** respeitam a piscina escolhida em cada card — não é preciso usar
  os botões individuais só para isso.

Testado no browser local (dbOk=false): seletor aparece só com cliente_id
resolvido, aviso aparece sem ele, criar piscina inline seleciona sozinha,
import grava `cliente_id`+`piscina_id` juntos no equipamento. Sem escrita
real ao Supabase durante o teste (confirmado via log de rede). Sem erro
novo relacionado ao código — dois erros de rede pré-existentes no ambiente
de teste local (404/400, ruído de infraestrutura do sandbox, não afetam
produção) continuam aparecendo, como já documentado em testes anteriores.

Com isso a Etapa 5 está fechada de ponta a ponta: cadastro manual e import
em massa, os dois linkam cliente_id e piscina_id de verdade.

---

## Continuação da Etapa 5 — vistoria também captura cliente_id (12/08)

Fechando a pendência que a própria entrada da Etapa 5 registrou: sem isso,
`importarEqDaVistoria()` quase nunca herdava `cliente_id` da vistoria de
origem (achado da auditoria: 1 vistoria em 7 tinha o campo preenchido), o
que deixava o import em massa (63 equipamentos esperando cadastro, visto ao
vivo em produção) sem vínculo de cliente nem chance de vir com piscina.

Mesmo padrão de sempre (orçamento/OS/equipamento/venda): o campo `#vis-cli`
captura `cliente_id` real nos dois caminhos — autocomplete ao digitar
(`selecionarCliVis`) e busca pela lupa 🔍 (`selecionarCliModal`, contexto
`'vis'` já existia, só não capturava id). Vistoria criada a partir de um
plano (`iniciarVistoriaPlena`) herda o `cliente_id` do local, quando
existir. Editar preserva; digitar por cima invalida — mesma regra de sempre.

**Ainda não fechado:** `importarEqDaVistoria()` não pergunta qual piscina
do cliente o equipamento importado pertence — só herda `cliente_id`. Ligar
a piscina no import em massa é mais UI (picker por grupo de cliente na
tela de import) — fica pra próxima rodada.

Testado no browser local (dbOk=false): autocomplete e busca capturam o id,
digitar por cima invalida, `_montarRecVistoria()` grava `cliente_id`
corretamente. Sem erro novo no console.

---

## Etapa 5 do roadmap de CRM — construída em 12/08 (ficha técnica da piscina)

Seguindo a recomendação da auditoria
(`docs/etapa5-ficha-tecnica-piscina-auditoria-2026-08-12.md`, opção b/c2):
nova entidade `piscinas`, ligada a `cliente_id` (mesmo padrão text de
cliente_id nas outras tabelas). Não liguei a `locais_vistoria` ainda
(`local_id` existe na coluna, mas nada preenche por enquanto) — a
integração com o fluxo de vistoria fica pra próxima rodada, matéria em
aberto no próprio doc da auditoria.

**O que foi feito (`migracao-piscinas.sql`):**
- Tabela `piscinas` (cliente_id, local_id opcional, nome, volume_m3,
  tipo_tratamento, loja_id).
- `equipamentos.piscina_id` — vínculo opcional com a piscina específica.
- Formulário de Equipamento ganhou: (1) busca de cliente por lupa 🔍
  (mesmo padrão de orçamento/OS/venda — captura `cliente_id` real, o
  datalist antigo continua só pra digitação rápida sem vínculo), (2) select
  de piscina do cliente selecionado, com "+ Cadastrar nova piscina" inline.
  Piscina só existe depois de um cliente_id real — nunca criada a partir de
  texto solto.
- Editar um equipamento existente restaura cliente e piscina vinculados.

**Testado no browser local (dbOk=false):** sem cliente selecionado o campo
de piscina fica bloqueado; selecionando cliente libera a lista (vazia +
"cadastrar nova"); criar piscina salva e seleciona sozinha; salvar
equipamento grava `cliente_id`+`piscina_id`; reabrir pra editar restaura os
dois. Sem erro novo no console.

**Pendências:**
- [x] Marcos rodar `migracao-piscinas.sql` no Supabase. **Confirmado rodado
  (verificação read-only 13/08, Sessão B): `to_regclass('public.piscinas')`
  retorna a tabela; `equipamentos.piscina_id`/`cliente_id` existem como
  `text`.**
- [ ] Ligar piscina ao fluxo de vistoria (hoje o equipamento é redigitado à
  mão lá, como o doc da auditoria já registrou) — decisão de UX de onde a
  piscina é escolhida na tela de vistoria, não implementado ainda.
- [x] Consumo teórico (Etapa 4) pode usar `volume_m3` agora que existe —
  **construído, ver "Etapa 4 fechada" no topo deste arquivo.**

---

## Etapa 2 do roadmap de CRM — iniciada em 12/08 (cliente_id em orçamento/OS)

O Marcos apontou que ~80% do que a empresa vende (químico, peça) passa por
**orçamento**, não por venda de balcão avulsa — venda de balcão vai
continuar sendo esporádica por natureza do negócio. Isso reprioriza a Etapa
2: em vez de esperar adoção da Etapa 1 pra decidir o próximo passo, ligar
`cliente_id` de verdade no orçamento (o canal que já é 80% do faturamento)
é o que rende mais agora.

**O que foi feito (aditivo, sem tocar em dado existente):**
- `orcamentos.cliente_id`/`ordens_servico.cliente_id` — a coluna já existia
  (`text`, desde sessão anterior), só não era preenchida por NENHUM caminho
  de criação. Agora é: as duas formas de escolher cliente no formulário de
  orçamento e de OS — autocomplete ao digitar (`mostrarSugestoesCli`/`OS`) e
  a busca pela lupa (`abrirBuscaCli`) — capturam o `id` real quando o
  cliente é **selecionado de uma lista**, nunca quando é só digitado.
- Editar um registro existente preserva o `cliente_id` que já tinha
  (`abrirOrc`/`_abrirOSForm` restauram `_orcClienteSelecionado`/
  `_osClienteSelecionado` a partir do registro). Digitar por cima do nome
  invalida o vínculo (não dá pra garantir que ainda é o mesmo cliente).
- **Sem backfill em massa dos ~303 orçamentos/118 OS existentes** — de
  propósito. Isso já tem um mecanismo próprio, humano, existente desde antes
  (`identLigar`/tela de Identidade, task #15/#36 do roadmap anterior) — não
  duplicar caminho.

**Achado no meio do caminho, NÃO mexido:** `_autoSalvarCliente()`
(`app.js`, chamada dentro de `gerarPDF`/`salvarApenas`) cria uma ficha nova
de cliente toda vez que um orçamento é salvo com um nome que não bate com
nada no cache local (`lsCliLer()`) daquele aparelho. É a mesma classe de
risco da causa raiz do incidente de duplicação (checagem contra cache local,
não contra o banco) — mas dispara só numa ação humana explícita (salvar UM
orçamento), não num loop de sincronização em background sem guarda, que foi
o que causou a explosão de duplicatas. Não desliguei nem alterei — está
fora do escopo do que foi pedido, e qualquer mudança aqui merece a mesma
cautela usada pra decidir desligar `_migrarClientesDeOrcamentos`. Registrado
pra quem for decidir isso depois.

**Bug achado e corrigido no processo:** `vendas_balcao.cliente_id` tinha
sido criado como `uuid` (Etapa 1) em vez de `text` — inconsistente com o
padrão do resto do sistema, e quebra na hora de vincular um cliente ainda
não sincronizado (id local `cli_<timestamp>`, não é uuid válido). Confirmado
com um insert de teste real que falhou (`22P02`) antes da correção.
`migracao-vendas-balcao.sql` já tem o `ALTER COLUMN ... TYPE text` — precisa
rodar de novo no Supabase, mesmo se a tabela já existir.

**Pendências:**
- [x] Rodar `migracao-vendas-balcao.sql` de novo (tem a correção do tipo).
  **Confirmado rodado (verificação read-only 13/08, Sessão B):
  `vendas_balcao.cliente_id` já é `text` em produção.**
- [ ] Verificar depois de uma semana: quantos orçamentos novos já nascem com
  `cliente_id` preenchido (mede se a captura por autocomplete está pegando
  de verdade, ou se a maioria continua sendo digitada solta).

**Checagem antecipada, só como referência (13/08, Sessão B, leitura, não
substitui a verificação de uma semana acima):** hoje (escopo fortemp)
`orcamentos.cliente_id` preenchido em **287 de 290 (98,9%)**;
`ordens_servico.cliente_id` em **17 de 26 (65,4%)**. ⚠️ **Não interpretar
isso como "a captura por autocomplete da Etapa 2 já converteu quase tudo"**
— o número é dominado pelo trabalho manual acumulado da tela de Identidade
(`identLigar`, ferramenta anterior à Etapa 2), não pela captura nova, que
só passou a rodar há poucas horas. Sinal real da Etapa 2 só aparece
comparando o preenchimento **dos orçamentos criados a partir de agora**
contra os já existentes — é exatamente o que a pendência de uma semana
acima está desenhada para medir; esta linha é só contexto pra não
confundir "base já linkada" com "captura nova funcionando".

---

## 🔴 HISTÓRICO DO GIT FOI REESCRITO em 12/08 — leia antes de fazer qualquer git pull/push

Um agente (auditoria da Etapa 5) citou um **endereço real de cliente** (puxado
do banco de produção) como exemplo num doc, e isso foi commitado neste
**repositório público** (`f18f36a`). Corrigi o arquivo (`63cfce3`), mas o
Marcos pediu para também remover do histórico — dado sensível não pode ficar
acessível nem no histórico de commits de um repo público.

Rodei `git filter-repo --replace-text` numa clonagem separada (não neste
worktree, para não corromper o object store compartilhado com outros
worktrees) e fiz **force-push** para `origin/main`. Isso trocou o hash de
TODOS os commits a partir do que introduziu o problema — inclusive commits
que não tinham nada a ver com o incidente.

**Se seu clone/worktree local estiver com histórico antigo (hashes
`f18f36a`, `79fade8`, `63cfce3`, ou qualquer coisa anterior a
`a1b2276`/`8edc168`/`a0f9bca`): não dê `git pull` nem `git rebase` — vai
divergir e tentar reconciliar dois históricos diferentes do mesmo conteúdo.
Dê `git fetch origin && git reset --hard origin/main`** (mesmo comando que
este arquivo já pede no início de toda sessão — só reforçando que ele é
obrigatório agora, não opcional). Nenhum arquivo de conteúdo mudou por causa
disso (só o texto do endereço no doc da Etapa 5) — é seguro resetar.

**Regra nova a partir de agora, para as duas sessões:** nunca cite dado real
de cliente (nome, endereço, telefone, e-mail, CNPJ) como "exemplo" em
qualquer doc que vá pro repo. Use placeholder genérico sempre — o ponto de
qualquer exemplo é ilustrar a estrutura do dado, não o dado em si.

---

## 🔀 COORDENAÇÃO — reaberta em 12/08 (roadmap de CRM, 8 etapas)

> **Se você é uma sessão nova entrando agora: comece por aqui.** O Marcos
> trouxe um briefing de produto e método (não está neste arquivo — foi colado
> direto na conversa; se precisar do texto completo, peça a ele) com um
> roadmap de 8 etapas pra tirar o CRM do "registra venda" pro "ajuda a
> vender". Está sendo trabalhado por **duas sessões em paralelo, divididas
> por ARQUIVO** (mesmo modelo que já funcionou em 08/08 — dividir por
> ASSUNTO já causou colisão de commit antes, não repetir).

### Divisão agora
| | Sessão A (esta, em andamento) | Sessão B (nova — se o Marcos chamar) |
|---|---|---|
| **Pode editar** | `app.js`, `index.html`, `styles.css`, `sw.js`, `migracao-vendas-balcao.sql` | `docs/**` |
| **NÃO toca** | — | `app.js`, `index.html`, `styles.css`, `sw.js` |
| **Tarefa agora** | Etapa 1 — venda de balcão como transação própria (em andamento, ver abaixo) | Etapa 8 (parte de atribuição) — capturar a **linha de base** antes da Etapa 1 subir: conversão por trilho (equipamento × serviço) e faixa de valor, tempo até fechar, valor expirado. O próprio briefing do Marcos pede isso explicitamente **antes** da Etapa 1 ir pro ar, pra depois dar pra medir se ela mudou alguma coisa. Documentar em `docs/crm-baseline-atribuicao-2026-08-12.md`, mesmo padrão de `docs/crm-baseline-2026-08-06.md` (leitura via REST com a anon key, sem escrever nada). |

**Antes de todo commit, as duas:** `git fetch origin` + `git diff --stat` e confirmar que só aparecem arquivos seus.

### Etapa 1 — venda de balcão como transação (em andamento pela Sessão A)
Hoje venda de balcão (químico, peça avulsa) só existe como saída de estoque
com motivo em texto ("vendido loja") — sem cliente, sem histórico, dado que
evapora todo dia. **Decisão de arquitetura:** entidade própria
(`vendas_balcao`), não reaproveita `orcamentos` — misturar distorceria
conversão/ticket médio do funil de orçamento, que tem ciclo de vida diferente
(venda de balcão fecha na hora, sem negociação).

- **Schema:** `migracao-vendas-balcao.sql` (raiz do repo) — `vendas_balcao`
  (id uuid, loja_id, cliente_id uuid nullable, cliente_nome, itens jsonb,
  valor_total, custo_total, forma_pagamento, vendedor, observacao,
  data_criacao). **Ainda não rodada em produção** — `curl`/Management API
  bloqueados pro Claude nesta sessão (classificador de auto-mode, tentado via
  Bash direto e via browser+dashboard, os dois recusados). O Marcos precisa
  rodar manualmente no SQL Editor do Supabase. Até lá o app funciona
  local-first (a venda fica salva no aparelho e sincroniza sozinha quando a
  tabela existir — mesmo padrão de despesas/equipamentos).
- **UI:** modal `venda-modal` (index.html) — carrinho multi-item, cliente
  opcional (reaproveita `abrirBuscaCli`, contexto novo `'venda'`, que agora
  também carrega o `cliente_id` real — os contextos antigos orc/os/vis nunca
  precisaram disso). Botão "🛒 Nova Venda" ao lado de "⚡ Dar baixa" em
  Estoque e Minhas OS.
- **Lógica:** `confirmarVendaBalcao()` (app.js, logo após
  `confirmarBaixaRapida()`) — reaproveita `registrarMovimento()` por item
  (não duplica a baixa de estoque), grava a venda em `vendas_balcao` com o
  mesmo cuidado de `despesas`/`equipamentos` (payload sem `id` local — a
  coluna é `uuid`, mandar id texto derruba o insert inteiro em silêncio).
- **Histórico do cliente:** `verHistoricoCliente()` ganhou seção "Vendas
  balcão", casando por `cliente_id` (quando veio da busca) ou nome (fallback,
  venda digitada à mão).

### Pendências desta etapa (pra fechar antes de ir pra Etapa 2)
- [ ] Marcos rodar `migracao-vendas-balcao.sql` em produção.
- [ ] QA no browser local (`dbOk=false`) — em andamento.
- [ ] **Ponto de parada do próprio briefing:** confirmar que a venda de
  balcão está sendo usada de verdade antes de avançar pra Etapa 2 (Histórico
  unificado) — se o time não registrar, as etapas 4 e 6 (recorrência, motor
  de eventos) ficam sem combustível.

---

## ✅ INCIDENTE ENCERRADO (aberto 10/08, causa achada e tudo fechado 11/08)

> Fica registrado como referência — não precisa retomar nada. Causa raiz
> corrigida, dados duplicados limpos (3.269→944→273 clientes reais),
> índice único criado, `INSERT` de cliente destravado de novo. Timeline e
> achados completos abaixo, do mais recente pro mais antigo.

**`_dupGrupos()` ganha 2ª passada — 110 grupos que exigiam revisão manual
viram automáticos (12/08).** Depois do fechamento, sobraram ~125 grupos de
nome repetido (o Marcos achou pesado demais revisar na mão). Analisando os
110 que tinham pelo menos 1 ficha em uso: **em TODOS os 110, é sempre
exatamente 1 ficha usada + o resto 100% vazio** (zero orçamento/OS/
vistoria/equipamento/local em qualquer uma das outras cópias) — nenhuma
ambiguidade real. A única razão de `_dupGrupos()` não limpar sozinho era
exigir endereço/telefone idênticos entre as cópias, e a cópia vazia quase
sempre tem esses campos em branco (diferente da cópia real).

Adicionada uma **passada por NOME** antes da passada por tripla exata:
quando exatamente 1 cópia do nome está em uso, remove todas as outras —
divergência de endereço/telefone entre elas não importa, porque uma ficha
sem nenhum vínculo não carrega histórico de ninguém pra proteger (só
protege quando **2+** cópias têm uso — aí sim pode ser gente/lugar
diferente, cai pra passada 2 sem mudança). A passada por tripla exata
(0 usadas, ou 2+ usadas) continua exatamente como antes.

Testado: 3 cenários sintéticos (nova regra limpa endereço divergente com 1
uso; caso "Torri Di Mare" — 0 uso, endereços divergentes — continua só
juntando as idênticas; caso ambíguo — 2 usadas — nunca mexe) + contra o
banco real: **112 grupos / 119 fichas** capturados agora (era só 3 antes).
🔴 **Achado no próprio teste**: dado sintético de um cenário de teste
("Ambiguo") vazou pro banco real na mesma aba reciclada — o índice único
bloqueou a 2ª tentativa (409, prova que funciona), mas a 1ª entrou. Achado
e apagado na hora (registro de teste meu, óbvio, não é julgamento sobre
dado de cliente real). **Lição:** `localStorage.clear()` sempre antes de
alternar entre teste sintético e teste contra banco real na mesma aba —
`carregarClientesRemoto()` empurra pro banco qualquer "local-only" que
achar, sem saber se é teste ou de verdade.

Relatório `docs/identidade-cliente-lista-priorizada-2026-08-11.md` fica
como registro histórico do que foi mapeado manualmente antes desta
automação — não precisa mais ser usado pra revisão, mas documenta a
análise que levou à correção.

**Ressurgimento pós-fechamento, causa e blindagem (11/08, depois do
fechamento acima):** ao reverificar tudo a pedido do Marcos, uma aba de
teste (que tinha rodado `_migrarClientesDeOrcamentos` de verdade, antes
dela ser desligada) empurrou ~124 fichas "só locais" que ficaram presas no
cache dela pro banco assim que `carregarClientesRemoto()` rodou de novo —
mesmo padrão do incidente original (dezenas de nomes diferentes, mesmo
segundo, uso zero), só que como efeito colateral tardio, não recorrência
da causa raiz (essa está desligada e confirmada). **Risco real:** qualquer
aparelho da equipe que tenha ficado com esse mesmo lixo preso no cache
(criado enquanto o bug ainda estava ativo) faria o mesmo na próxima
sincronização, mesmo com o código já corrigido.

**Blindado:** `carregarClientesRemoto()` agora só empurra pro banco ficha
"só local" com **menos de 48h** (idade extraída do próprio `id`,
`cli_<timestamp>` — todo ponto de criação de cliente local usa esse
padrão, confirmado por grep). Ficha órfã mais velha que isso é log de
aviso e ignorada, nunca mais sincronizada — cliente offline de verdade
sincroniza em horas, não dias, então 48h é folga generosa sem arriscar
perder criação legítima. Testado no browser: local de 10min atrás
sincroniza, local de 48h+ não, aviso correto no console.

**Pendente, mesmo processo de sempre:** as ~124 fichas que já vazaram
pro banco nesta rodada — zero uso real confirmado (mesma checagem das 5
tabelas) — precisam da mesma limpeza (`_dupGrupos()`/"Revisar e limpar")
que as rodadas anteriores. Eu não apago.

**Varredura sistêmica (11/08, a pedido do Marcos — "o que mais vemos de
lacuna pra não passar por isso de novo"):** o mesmo padrão sem guarda de
idade existia em MAIS 6 lugares — `loadHist` (orçamentos), `loadOSHist` +
`_reenviarPendentes` (OS, 2 pontos), `loadAgendamentos`, `loadDespesas`,
`loadEquipamentos`. Todos agora usam o mesmo helper compartilhado
`_idadeIdMs(id)` (perto de `_tombLer`/`_tombAdd`) com o teto de 48h.

🔴 **Bug achado no próprio teste do fix, corrigido antes de ir pro ar:**
`_idadeIdMs` original fazia `id.split('_')[1]` — funciona pra
`local_<ts>`/`ag_<ts>`/`desp_<ts>`/`eq_<ts>`/`cli_<ts>` (2 partes), mas
`local_os_<ts>` tem 3 partes — `split('_')[1]` pegava `"os"`, não o
timestamp, `parseInt` virava `NaN`, e a função silenciosamente tratava
TODO id de OS como "idade zero" (nunca filtrava nada). Corrigido pra usar
regex (acha o número de 10-13 dígitos em qualquer posição do id) — mais
robusto contra qualquer prefixo, não só o de hoje.

Testado no browser, os 6 pontos + clientes de novo: registro com <48h
sincroniza, com 48h+ é ignorado e logado, em cada tabela. Caso especial
de OS (`_pendingSync`, edição offline sobre OS já existente — id real,
sem timestamp pra medir) passa sempre, não tem como ficar "velho" nesse
sentido. Zero erro de console.

**Itens 2 e 3 da varredura sistêmica (11/08):**
- **Item 3 (outra "migração única" que roda sempre):** só existem 2
  funções `_migrar*` no código inteiro. `_migrarClientesDeOrcamentos`
  (a causa raiz, já desligada). `_migrarDataAprovacao` — **confirmada
  segura, sem mudança**: usa `UPDATE` por id real (nunca `INSERT`) e a
  própria condição (`!o.data_aprovacao`) se autolimita — uma vez migrado,
  a próxima passada nem olha pro registro de novo. Não tem o defeito que
  causou o incidente (checar contra cache local possivelmente incompleto).
- **Item 2 (escrita direta em `localStorage`, fora do `lsSet`):** 14
  chamadas cruas achadas. A maioria sem NENHUM try/catch — pior que
  silencioso, uma exceção não pega podia interromper a função no meio
  (ex.: login com PIN errado em modo privado poderia travar sem limpar o
  campo). 9 sites migrados pra `lsSet` (tentativas de login/lockout,
  colapsar sidebar, dispensar alerta de estoque, filtros de
  orçamento/OS, e os 3 pontos de `locais_vistoria` — plano recorrente de
  visita, dado real de negócio). **5 NÃO mexidos, de propósito** — já
  eram mais sofisticados que `lsSet`: `LS_VIS` (`lsVisSalvar`) já tenta
  de novo sem fotos se a quota estourar, com toast avisando o técnico;
  `LS_VIS_DRAFT` (rascunho de vistoria em andamento) tem comentário
  explícito no código dizendo por que NÃO usa `lsSet` (o catch genérico
  engoliria o erro antes do fallback sem-fotos rodar — achado documentado
  de uma sessão anterior, "pego em teste"); e um ponto de restauração de
  rascunho da nuvem já está dentro de um try/catch mais amplo.
  Testado no browser (forçando `Storage.prototype.setItem` a lançar
  exceção): `dispensarAlertaEstoque`, `loadLocais` e o fluxo de
  tentativa/lockout de login sobrevivem sem lançar exceção, aviso
  correto no console nos dois primeiros.

**Fechamento final (11/08):** com zero duplicata restante na base
(confirmado por query direta — `group by` na tripla normalizada devolveu
vazio), criado `clientes_nome_end_tel_uniq` — índice único funcional sobre
`lower(trim(coalesce(nome,''))), lower(trim(coalesce(endereco,''))),
lower(trim(coalesce(telefone,'')))` (usa `coalesce` porque a base tem
mistura real de `NULL` e string vazia nesses 3 campos — sem isso, duas
fichas com os três campos `NULL` não colidiriam no índice). Testado com
`begin;...rollback;`: insert duplicado é rejeitado (pego pelo trigger
antigo `fluxa_bloquear_cliente_duplicado`, que segue ativo como primeira
camada — o índice novo é o backstop à prova de concorrência que o trigger
sozinho não garantia). Depois disso, `grant insert on clientes to anon;`
— confirmado via `information_schema` e um insert de teste real (papel
`anon`, dentro de transação desfeita) que funciona sem bloqueio. Cadastro
de cliente pelo app está liberado de novo.

### Causa raiz — confirmada por 3 evidências independentes
`_migrarClientesDeOrcamentos()` (linha ~3811 do `app.js`, comentário dizia
"migração única") era chamada **sem NENHUMA guarda de "já rodou"** no fim de
`loadHist()` — toda vez que orçamentos sincronizavam com sucesso. `loadHist()`
é chamado de **6+ lugares** (abrir Histórico, reload, Identidade, etc.). Cada
execução varre TODOS os orçamentos/OS e, pra cada nome sem ficha no cache
LOCAL do aparelho, cria uma ficha nova — sem checar o servidor, só o
`localStorage` daquele aparelho específico.

1. **Padrão da rajada bate exatamente:** query direta no banco (PAT) mostrou
   picos de **centenas de nomes DIFERENTES** inseridos dentro do MESMO
   segundo (ex.: 23:15:36.476 até 23:15:36.532, ~40 clientes distintos) — isso
   não é alguém clicando um botão repetidamente (que reproduziria o MESMO
   nome), é um loop varrendo histórico de uma vez.
2. **O relato do Marcos bate exatamente:** ele notou que a contagem *aumentava*
   toda vez que pedia pra limpar as duplicatas pela tela. `abrirRevisaoDuplicatas()`
   (a tela de limpeza) chama `await loadHist()` de propósito, pra não confiar
   em cache velho antes de uma exclusão em massa — mas isso significava que
   **abrir a tela de limpeza era o gatilho mais garantido de criar mais
   duplicata**, bem no momento em que ele checava se tinha melhorado.
3. **Conecta com o outro achado da sessão anterior:** o cache local de
   clientes cortava em 1000 linhas (bug separado, já corrigido, ver abaixo) —
   um aparelho com cache incompleto acha que MUITO mais clientes "não
   existem" do que realmente não existem, e recria em massa.

**Corrigido:** a chamada automática foi **desligada** (comentada, não
apagada — o código fica documentado pra quem precisar entender/readaptar
depois). `loadHist()` segue funcionando normal sem ela. Testado no browser:
`loadHist()` (offline e com sync mockado) confirmado **não** chama mais
`_migrarClientesDeOrcamentos()`, resto do sync intacto, zero erro de console.

### O que ainda falta (nesta ordem — não pular)
1. ~~Confirmar se o REVOKE pegou~~ → **confirmado** (query direta em
   `information_schema.role_table_grants`: `anon` não tem `INSERT` em
   `clientes`, só `authenticated` tem — e o app roda inteiro como `anon`).
2. ~~Confirmar que a criação parou~~ → **confirmado**: último `data_criacao`
   foi `2026-08-11 23:41:02 UTC`; zero clientes novos desde então (checado
   16min depois, ainda zero).
3. ~~Achar a fonte~~ → **feito, ver acima.**
4. **Limpeza dos dados já duplicados — PENDENTE, só o Marcos.** A tela
   "Revisar e limpar" já existe e já foi corrigida (progresso real, cache
   fresco, checa as 5 tabelas de uso). Rodar ela vai gerar uma lista limpa
   agora que a causa parou de recriar duplicata no meio do processo. **Eu não
   faço essa limpeza — é exclusão de dado, recusado mesmo com autorização
   explícita, inclusive nesta mesma investigação.**

   **Verificação extra pedida pelo Marcos antes de autorizar, feita e
   aprovada (11/08):** ele queria confirmar que nada "importante" seria
   apagado. Refiz `_dupGrupos()` do zero em Python, direto contra o banco de
   produção (não contra cache de navegador) — 138 grupos, 2.333 fichas
   marcadas pra remover de 3.269 clientes totais. Cruzei as 2.333 contra TODO
   `cliente_id` de `orcamentos`/`ordens_servico`/`vistorias`/`equipamentos`/
   `locais_vistoria` (confirmado por `information_schema` que são as ÚNICAS 5
   colunas no banco inteiro que referenciam `clientes.id` — não tem sexta
   escondida): **zero sobreposição**. Nenhuma ficha marcada pra apagar tem
   orçamento/OS/vistoria/equipamento/local vinculado.

   Achado menor, corrigido: em 23 fichas a apagar, a cópia removida tinha
   `tipo='condominio'` preenchido e a que sobrevivia (a mais antiga, regra
   antiga) estava vazia nesse campo. `_dupGrupos()` agora prefere a ficha
   mais COMPLETA (`tipo`/`email_responsavel` preenchidos) em vez da mais
   antiga quando nenhuma das cópias tem uso real — uso real continua
   ganhando de completude sempre (não dá pra descartar histórico de serviço
   por uma etiqueta). Resultado após o fix: só 1 dos 23 casos continua
   perdendo o `tipo` (o caso em que a ficha mantida tem uso real — correto
   por desenho, recuperável reeditando a ficha depois). Testado no browser:
   3 cenários (mais completa vence idade; uso real vence completude; grupo
   sem nenhuma em uso e sem divergência de tipo cai no desempate por idade
   como antes) — todos corretos, zero erro de console.
5. **Depois da limpeza:** criar índice único de verdade em
   `(nome, endereco, telefone)` em `clientes` (não dá antes — índice único
   não sobe em cima de duplicata existente), e só então
   `grant insert on clientes to anon;` de volta. Até lá, cadastro de cliente
   novo pelo app não funciona — avise o time se perguntarem.

### Achado separado, já corrigido: `carregarClientesRemoto()` cortava em 1000
Bug de longa data, achado ao investigar o incidente (não é a causa raiz, mas
alimentava o cache incompleto que a piorava — ver evidência 3 acima):
`select('*')` sem paginação, PostgREST corta em 1000 linhas em silêncio. Base
real tem 3.269 clientes. **Corrigido** com paginação via `.range()` em loop
(commit `c52d69c`) — revisado de novo nesta sessão: lógica está correta
(`while(true)` com `.range(from, from+999)`, quebra em página curta). A
dúvida da sessão anterior ("retornou só 435 numa checagem") era mesmo o
`if(!dbOk||!db) return;` no início pulando a função em silêncio quando
offline no momento da chamada — não um bug na paginação em si.

### Também corrigido antes desta sessão (não é a causa raiz, mas eram bugs reais)
- Modal de limpeza de duplicatas fechava instantaneamente ao clicar
  "Confirmar" — agora fica aberto com progresso real.
- Lista de duplicatas usava cache desatualizado — `abrirRevisaoDuplicatas()`
  força reload antes de montar a lista (esse reload, ironicamente, era o que
  disparava mais duplicata — ver causa raiz acima; agora que `loadHist()` não
  tem mais o efeito colateral, esse reload é seguro).
- Tombstone gravado ANTES de confirmar delete remoto — corrigido.
- `_dupGrupos()` não checava `equipamentos`/`locais_vistoria` como uso —
  corrigido para checar as 5 tabelas.

sw.js está em `fluxa-v95` (bumped por este commit). Todos os commits já em
`origin/main`.

### 🔴 Achado grave à parte (11/08): `localStorage` cheio derrubava a contagem de duplicatas em SILÊNCIO
Depois de tudo acima, o Marcos rodou a limpeza e a tela mostrou **5 fichas**
em vez das 138 grupos/2.333 fichas calculadas. Não era bug no `_dupGrupos()`
— era `localStorage.setItem('fluxa_clientes_full', ...)` **falhando por
quota cheia**, silenciosamente, no navegador do Marcos. `carregarClientesRemoto()`
busca os 3.269 clientes certinho (isso é a demora que ele via na tela), mas
`merged` só existe em memória — a ÚNICA forma de qualquer outra parte do
app enxergar esse dado é através do `localStorage` gravado por
`lsCliSalvar()`. Se esse `setItem` falha, o fetch inteiro (rede, tempo,
paginação) vira pó: `_dupGrupos()` lê de volta o que já estava lá antes
(pouco), sem nenhum aviso de que os 3.269 recém-buscados nunca chegaram a
ficar disponíveis. **Só apareceu no console porque o fix desta sessão em
`lsSet()` (fechar `catch(e){}` vazio) passou a logar — antes disso, essa
falha era 100% muda.**

**Causa raiz do estouro:** 15 orçamentos antigos com foto embutida em
`orcamentos.foto_base64` (base64 direto no banco, nunca migrado pro
Storage — achado NOVO, não é o mesmo bug do `carregarClientesRemoto`)
somavam 3,2 MB sozinhos; combinado com o resto do cache local do
navegador (~4,4 MB no total, e o `.length` do JS mede em UTF-16 — o
consumo real de quota costuma ser o dobro disso), estourava o limite do
navegador. Diagnosticado ao vivo com o Marcos: `Object.keys(localStorage)`
por tamanho apontou `fluxa_orc_data` (3,59 MB) como o maior de longe.

**Corrigido, duas partes:**
1. **Daqui pra frente:** `_uploadFotoStorage` (já existia, só pra vistoria)
   ganhou parâmetro de bucket; nova `_fotosOrcParaStorage(orcId, fotos)`
   roda em background depois de QUALQUER salvamento de orçamento (`salvarApenas`
   e `gerarPDF`, tanto criar quanto editar — 4 pontos), sobe as fotos pro
   bucket novo `orcamentos-fotos` (criado nesta sessão, mesmas políticas de
   `vistorias-fotos`: leitura pública, insert por `anon`) e troca o
   `foto_base64` no banco por URL. Foto que falhar no upload mantém base64
   — nunca perde a foto. Não toca no fluxo principal de salvar (que já é
   local-first e crítico) — só um passo extra, opcional, depois.
2. **Backfill dos 15 já existentes:** migrados na hora (script Python +
   curl, upload real pro Storage + update do banco). **Confirmado depois:**
   `0` orçamentos com base64 restante, tamanho total da coluna caiu de
   3.247 kB pra **3.612 bytes** (~99,9%). URLs testadas publicamente
   acessíveis (HTTP 200) antes de considerar a migração concluída.

**Resultado final confirmado pelo Marcos:** depois de limpar só a chave
`fluxa_orc_data` (sem perigo — confirmado zero orçamento local-only ali
antes de limpar) e recarregar, a tela passou a mostrar os 138 grupos/2.333
fichas corretos. Ele autorizou e rodou a limpeza.

**Lição pra próxima vez que algo "não bate" entre o que o código calcula e
o que a tela mostra:** antes de suspeitar da lógica, checar se algum
`lsSet`/`localStorage.setItem` no meio do caminho está falhando em
silêncio — é indistinguível de "a lógica está errada" sem olhar o console.

### 🟡 Rodada 2 de limpeza — `_dupGrupos()` agrupava por nome, deixava passar centenas de duplicata idêntica
Depois da 1ª limpeza (3.269→944 clientes), o índice único ainda não podia
ser criado: `group by nome/endereco/telefone normalizados` no banco mostrou
**"Torri Di Mare Residenziale" com 626 cópias idênticas** (endereço e
telefone em branco nas duas) ainda sobrando, mais outros 13 nomes menores
(671 fichas no total). Causa: `_dupGrupos()` agrupava só por NOME e, se
QUALQUER cópia daquele nome tivesse endereço divergente em algum lugar
(4 cópias de "Torri Di Mare" tinham endereço real, diferente entre si),
o grupo INTEIRO era descartado como "divergiu, não mexe" — inclusive as
626 idênticas entre si, que nunca tiveram chance de ser limpas.

**Corrigido:** agrupamento agora é pela TRIPLA exata
(nome+endereço+telefone normalizados) direto, não por nome com checagem de
divergência depois — matematicamente mais correto (duplicata = mesma
tripla, não "mesmo nome E zero divergência em qualquer outra cópia do
mesmo nome"). CNPJ continua fora da chave de agrupamento mas ainda bloqueia
o grupo se divergir (não muda). Mesma lógica de segurança de antes
inalterada: uso real sempre vence, completude desempata, cnpj/tripla
divergente nunca é tocado.

Testado contra o banco real (aba local, dados reais): **15 grupos, 672
fichas** — bate com o cálculo independente em Python (14/671, diferença de
2 por clientes criados no meio do caminho). Zero sobreposição com uso real
(mesma checagem das 5 tabelas de antes). Zero erro de console.

**Próximo passo:** Marcos roda "Revisar e limpar" mais uma vez agora com o
código corrigido. Só depois disso — zero duplicata real restante — dá pra
criar o índice único de verdade e destravar o `INSERT` de cliente.

---

## 🔀 COORDENAÇÃO — reaberta em 08/08

> **QA das 4 correções de tombstone (08/08, rodada 2), tudo confirmado por
> clique real, não só chamada de função.** Nos 9 commits novos desde a última
> QA (`010996a`…`09042de`), testei end-to-end: **despesa, equipamento, cliente,
> OS** — pros 4, criei o registro pela tela, forcei o id pra um uuid fake
> (simulando "já sincronizado"), chamei o `excluirX(id)` real, conferi que o
> `confirmar()` abriu **visível** (o fix de z-index da rodada 1 segurou pros 4
> — nenhum ficou atrás de outro modal), cliquei em "Confirmar" de verdade nas
> coordenadas da tela, e verifiquei: item some da view, tombstone grava o id
> certo, toast aparece, zero erro novo no console. `dbOk=false` o tempo todo,
> conferido também pela aba de rede no fim — nenhum POST/PATCH real saiu pro
> Supabase durante o teste inteiro.
>
> Sem achado novo desta vez — as 4 correções (`a5149c9`, `28b2086`, `58e207a`,
> `09042de`) funcionam como descrito nos recados abaixo. O que valia a pena
> conferir com clique real (não só mock) era exatamente o que o fix de
> z-index da rodada 1 tinha me ensinado a desconfiar: um `confirmar()` chamado
> de um contexto novo pode renderizar errado mesmo com a lógica certa por
> trás. Não foi o caso aqui.

> **QA de runtime feita (08/08, sessão à parte, escopo: index.html/styles.css,
> sem tocar em app.js).** Testado no localhost:8778, `dbOk=false` antes de
> qualquer coisa que grava — nenhuma escrita chegou a bater no Supabase real
> (conferido pela aba de rede). Cobertura: orçamento criar/editar/aprovar
> (os dois gates novos — pagamento e vínculo — testados end-to-end pelo
> `<select>` real da tabela, não só chamada isolada), produto (gate de custo
> clicado de verdade no `confirmar()`), despesa (validação antiga intacta),
> filtro de OS por técnico (a correção de hoje, `filtTecOS`/`filtStatusMinhasOS`
> — testei os dois, sem colisão), mobile 375px, perfis gestor e técnico.
>
> **1 bug real achado e corrigido:** `#confirmar-modal-bg` tinha `z-index:500`
> (styles.css), abaixo de `#prod-modal` (`z-index:600`, classe `.qr-modal-bg`).
> Quando o gate de custo do produto chama `confirmar()`, o diálogo renderizava
> **atrás** do modal de produto — invisível, inclicável, ninguém percebia que
> travou. Bug pré-existente de stacking, só nunca tinha sido exercitado porque
> nada chamava `confirmar()` de dentro de um modal com z-index maior antes de
> hoje. Corrigido: `#confirmar-modal-bg{z-index:900}`, acima de tudo (o maior
> outro modal é 800). Reproduzido, corrigido, re-testado com clique real —
> confirma agora aparece por cima e funciona.
>
> **Modal órfão removido:** `#concluir-vis-bg` (index.html) + `fecharConcluirVis`/
> `salvarConcluirVis` (app.js — única exceção autorizada) — nada mais abria
> esse modal desde que as funções que o chamavam foram removidas em `807672a`.
> Confirmado via grep antes de apagar. Coletor (`mortas:0`, `duplicadas:0`)
> confere depois. Entrou no commit `7958c75` (arquivos compartilhados em tempo
> real, não deu pra separar num commit à parte sem risco).
>
> Nada mais quebrado encontrado nesta rodada.

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

- *(A, 08/08)* 🔴 **Achado ao conferir "cliente" na lista de 7 tabelas
  simétricas acima — não era bem simétrico.** `excluirCliente(id)` nunca
  chamou `db.from('clientes').delete(...)` em lugar nenhum — só removia da
  lista local. Diferente dos outros (que TENTAM apagar remoto e só falham em
  silêncio às vezes), aqui o delete remoto **nunca existiu**: o próprio
  comentário de `carregarClientesRemoto` já dizia "BD é fonte de verdade" —
  então TODO cliente excluído voltava, sempre, no próximo sync (não é
  condição de corrida, é garantido). Corrigido com o mesmo tombstone
  (`fluxa_cli_tombstones`) + agora `excluirCliente` chama o delete remoto de
  verdade. Testado no browser: excluir → tombstone gravado → simulei que o
  servidor ainda tinha a linha → `carregarClientesRemoto` filtra e reenvia o
  delete, cliente não ressuscita. Zero erro de console.

- *(A, 08/08)* **Varredura final: TODAS as `excluir*`/`deletar*` do app.js,
  uma a uma.** Fechando o assunto tombstone de vez.
  `deletarFornecedor`/`loadFornecedores` tinham o mesmo gap (delete tentado,
  sem tombstone — resurgia no próximo load) — corrigido, mesmo padrão
  `_tombLer`/`_tombAdd`, chave `fluxa_fornec_tombstones`. Testado igual às
  outras: exclui → tombstone → simulei delete remoto falho → não ressuscita.
  As demais já estavam corretas por desenho, conferidas uma a uma, sem
  mudança: `_excluirUsuarioConfirmado` é soft-delete (`ativo:false`) e
  `carregarUsuarios` já filtra `ativo=true` — não é o mesmo bug, é
  intencional (mantém histórico/auditoria). `excluirLocal`
  (locais_vistoria) e `excluirVistoria`/`desfazerVistoriaLocal` (vistorias)
  já tinham tombstone + delete remoto de verdade desde antes desta sessão
  (`_locTombAdd`/`_visTombAdd`). `produtos`/`ordens_compra` não têm delete
  nenhum no app (nem função `excluirProduto`/`excluirOC` existe) — nada a
  proteger.

  **Estado final:** toda tabela com delete no app.js protegida contra
  ressurreição — orçamento, OS, cliente, despesa, equipamento, fornecedor
  (corrigidos nesta sessão) + usuário, local de vistoria, vistoria (já
  corretos). Não fica mais nenhuma tabela sem esse cuidado.

- *(A, 08/08)* **Estratégia de rotina financeira, a pedido do Marcos.**
  Analisei os números reais (query direta, PAT) pra entender se "financeiro
  está completo": não é código, é rotina — e desigual entre lojas.
  Camboriú lança 35,5% dos recebimentos aprovados contra 92,3% da Itapema,
  com o MESMO app — prova que o gargalo não é a tela. Achado bom: a
  cobertura de vínculo produto→estoque, que era 24,3%/47,2% no histórico
  total, já subiu pra 50%/70% nos últimos 14 dias desde que o nudge de
  sugestão no catálogo (`406c39c`) entrou no ar — o padrão "nudge visível,
  não bloqueio" funciona, então apliquei o mesmo aqui.

  **`renderPainelHoje()`** (painel diário de ação, tela inicial do gestor)
  já mostrava recebível **vencido** — mas isso exige que uma parcela já
  exista pra poder vencer. O buraco real de Camboriú é orçamento aprovado
  **sem NENHUMA parcela lançada** — esse nunca aparecia ali, por mais velho
  que fosse, porque não tinha o que vencer. Reusei
  `_orcAprovadosSemReceb()` (já existia, alimentava só o card da página
  Recebíveis) e acrescentei um item novo no painel: valor total + contagem
  + data do mais antigo, com botão "Lançar" indo direto pra Recebíveis.
  Zero tabela/coluna nova — só deixa visível na tela que o gestor já abre
  todo dia um problema que antes só aparecia pra quem lembrasse de navegar
  até Recebíveis. Testado no browser: aparece com número/data corretos
  quando há gap, some quando todos os aprovados têm recebimento lançado,
  orçamento não-aprovado corretamente ignorado. Zero erro de console.

  **Resto da estratégia não é código — é para o Marcos:** (1) conversa com
  Camboriú comparando com Itapema usando esses números; (2) decisão de
  negócio sobre padronizar a precificação lá (≈42% do valor aprovado é
  orçamento "Investimento total: R$ X" numa linha só, sem preço por item —
  isso não tem nudge de app que resolva, é como o serviço é cotado). Não
  investir em mais DRE/dashboard granular até a cobertura melhorar — feriam
  número bonito em cima de dado incompleto.

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
