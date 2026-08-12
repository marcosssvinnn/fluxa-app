# Levantamento — o que precisa virar obrigatório

> **Por que este arquivo existe.** Pedido do Marcos: a equipe administrativa
> está numa fase de aprendizado do sistema, e várias informações importantes
> ficam de fora porque **nada impede de salvar sem preencher**. A ideia é
> transformar essas informações em campos obrigatórios de verdade — com um
> sinal visual, uma explicação curta do porquê, e travando o salvar até a
> pessoa preencher ou confirmar que não se aplica.
>
> Este documento é o levantamento pedido, **antes de qualquer código**: o que
> existe hoje, o que falta, e por quê. Feito lendo os formulários reais do
> `app.js`/`index.html` e cruzando com os números de produção que já medimos
> esta semana (baseline, cobertura de estoque, funil) — cada recomendação tem
> o dado que a sustenta, não é achismo.
>
> **Atualização — implementado no mesmo dia.** O Marcos pediu para seguir com
> tudo. Os itens marcados **✅ implementado** abaixo já estão no código
> (testado sem escrever no banco de produção, com orçamento/produto/OC falsos
> em memória). O check-in de OS **não foi mexido** — é o único caso do
> levantamento em que a recomendação era conversar com a equipe antes, não
> travar campo nenhum, e essa conversa ainda não aconteceu.

---

## O que existe hoje

Toda validação do Fluxa é feita **na hora de salvar**, dentro de cada função
`salvarX()`, e cada uma reinventa o próprio jeito de avisar:

```js
if(!dados.cli||dados.cli==='—'){ toast('⚠️ Informe o nome do cliente'); return; }
if(!tipo){ toast('⚠️ Informe tipo e valor'); return; }
if(!_cat){ toast('⚠️ Selecione a categoria do produto'); ... }
```

33 checagens desse tipo espalhadas pelo arquivo, cada uma com sua mensagem,
nenhuma com explicação do *porquê*. Funciona, mas exatamente o problema que o
Marcos apontou: **não existe um padrão único**, então cada tela "obriga" de um
jeito, e não tem nenhum sinal ANTES de tentar salvar — a pessoa só descobre
que faltou algo depois de clicar. Não existe também nenhum estilo de "campo
obrigatório" no CSS hoje — isso é infraestrutura nova, não uma extensão do
que já tem.

## O mecanismo único — implementado

Ao ler o CSS pra construir isto, achei que **o marcador visual já existia**:
`label.req` (asterisco vermelho) já era usado em 8 campos, só que sem nenhuma
validação de verdade atrás — reaproveitado em vez de inventar um segundo
padrão (`obrig-badge`) do zero.

O que entrou de novo:

1. **`avisarCampoObrigatorio(id, msg)`** (app.js) — foca o campo, rola até
   ele, pinta a borda de vermelho (`.campo-obrig-erro`, some sozinha assim
   que a pessoa começa a digitar) e mostra o toast já com a explicação do
   porquê, não só "preencha isto". Toda checagem nova usa essa função em vez
   de reinventar o próprio aviso.
2. **Obrigatório condicional funciona** de dois jeitos, conforme o caso pedia:
   um toggle explícito (checkbox "não é produto" no item do orçamento) e um
   momento certo em vez de sempre (forma de pagamento só trava na aprovação,
   não na criação da proposta — enviar sem saber como o cliente vai pagar é
   normal).

**Não fiz** um `validarObrigatorios(formId)` genérico que varre o form
inteiro — os 5 campos novos têm regras diferentes demais entre si (um trava
no salvar, dois travam num MOMENTO diferente do salvar — aprovação, envio ao
fornecedor —, um é condicional a um toggle) para uma função única de
"campo vazio = bloqueia" resolver sozinha. `avisarCampoObrigatorio` cobre a
parte que de fato se repetia — o aviso — e cada `salvarX()`/`mudarSt` decide
quando chamá-la, o que a validação anterior (33 checagens) também já fazia
certo. Se aparecer um sexto campo com a mesma regra simples de um desses,
vale reconsiderar.

---

## Por área, o que falta

### 1. Orçamento (`salvarApenas`) — o formulário mais usado do sistema

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Forma de pagamento** (`pag_cod`) | ✅ **Implementado** — mas não no salvar, **na aprovação** (`mudarSt`). Enviar uma proposta sem forma de pagamento definida é normal; aprovar sem isso é que trava a Fase 1 inteira. Reverter para pendente/recusado não exige. | Medido: **33 dos 88 aprovados** não têm código real, **30 estão em "A combinar"**. | ~~Obrigatório.~~ Feito. |
| **Item vinculado ao estoque** (`produto_id` em cada linha) | ✅ **Implementado**, condicional e também na aprovação. Checkbox **"não é produto"** por linha (`toggleSvcAvulso`) para mão de obra/material genérico — quem marca não precisa vincular. | Medido: Camboriú **24,3%** de cobertura nos aprovados. | ~~Obrigatório condicional.~~ Feito. |
| **Cliente com ficha** (`cliente_id`) | Sem mudança — mantido como estava. | Medido: **43% dos nomes** de orçamento não têm ficha — R$ 1,19 milhão. | Não travar o salvar (fica para reforçar a tela de confirmação de identidade, separado deste levantamento). |
| Local do serviço | ✅ **Implementado** — trava no salvar (`salvarApenas` e `gerarPDF`). | Sem local, a rota do técnico e a OS gerada ficam incompletas | ~~Obrigatório.~~ Feito. |

### 2. Estoque — ajuste manual (`registrarMovimento`, tipo `ajuste`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| Motivo padronizado (`motivo_cod`) | **Já obrigatório** (`if(!motivoCod){ toast(...) }`) | — | Nenhuma ação — já está certo, é o modelo a copiar para o resto. |
| **Quantidade no campo certo** | Não é campo, é hábito: a equipe escreve "05 Leds" na *descrição* do orçamento em vez de usar o campo `qty` | Medido: **456 unidades** subnotificadas na base — com a baixa automática, vira estoque errado por um fator de 5, silenciosamente. | Isto não se resolve com "obrigatório" — é o formulário de orçamento precisar detectar o número no início do texto e oferecer jogar pro campo de quantidade (já registrado como pendência técnica em `docs/cobertura-produto-id-2026-08-07.md`). |

### 3. Contas a receber (`salvarRecebimento`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Forma de pagamento** (`forma`) | ✅ **Implementado** — trava no lançar. | Sem ela, o relatório financeiro não separa boleto de pix de cartão, e nenhuma reconciliação bancária futura é possível. | ~~Obrigatório.~~ Feito. |
| Modo (à vista/parcelado/entrada) | Já efetivamente obrigatório (tem default e um caminho de "decidir depois" explícito) | — | Nenhuma ação. |

### 4. Produtos — cadastro (`salvarProduto`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Custo** | ✅ **Implementado** — com `custo=0`, salvar abre confirmação ("sem custo, este produto não tem margem calculável — salvar assim mesmo?") em vez de travar de vez, porque às vezes o preço de compra ainda não chegou. | Medido: **6 dos 7 modelos de trocador Pooltec** — o equipamento mais caro da empresa — estão com custo zero. | ~~Obrigatório com saída.~~ Feito. |
| Categoria | **Já obrigatório** | — | Nenhuma ação. |

### 5. Ordens de serviço — conclusão

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Duração / check-in / check-out** | Não é um campo — é um **passo do fluxo inteiro** (botão "Fazer check-in" → trabalha → "Fazer check-out", que calcula a duração sozinho) que está sendo pulado. | Medido: **0 das 118 OS** têm duração registrada; só **1** está com status `concluido`. Sem isso, produtividade por técnico e mão de obra no DRE (já implementado, Patch C) ficam sempre em branco. | **Não dá pra resolver marcando um campo como obrigatório** — não existe campo, existe um botão que ninguém aperta. Duas saídas possíveis: (a) impedir marcar a OS como concluída por qualquer outro caminho que não seja o check-out, ou (b) conversar com a equipe pra entender se o check-in atrapalha o fluxo de campo deles (pode ser que o problema seja de usabilidade, não de disciplina). Recomendo a conversa antes do bloqueio — é exatamente o padrão que já apareceu no achado do baseline: a equipe registra o que considera útil (`obs_tecnica` está preenchida em 103 das 118). |

### 6. Ordem de compra (`salvarOC`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| Fornecedor | **Já obrigatório** (`if(!fornId){ toast(...) }`) | — | Nenhuma ação. |
| Item na ordem | **Já obrigatório** | — | Nenhuma ação. |
| **Data prevista** (`data_prevista`) | ✅ **Implementado** — trava só ao enviar ao fornecedor (`status='enviada'`), não em rascunho. | Sem ela, não existe lead time real nem OTIF de fornecedor — a coluna virou `date` de verdade nesta semana justamente para viabilizar isso. | ~~Obrigatório quando sai de rascunho.~~ Feito. |

### 7. Despesas — **já está bem resolvido**

`categoria` e `centro_custo` são preenchidos automaticamente a partir do tipo
(empresa × campo) — não são campos manuais, então não entram na lista. O que
já é validado (`tipo`, `valor`, `técnico` quando não é despesa da empresa)
está correto.

---

## O que ficou de fora, de propósito

1. **Check-in de OS.** Continua sem nenhuma trava. Não existe campo pra
   marcar obrigatório — existe um botão que ninguém aperta — então forçar
   qualquer coisa aqui sem entender o porquê arrisca é piorar (a pessoa
   inventa um check-in só pra passar da tela, e aí o dado além de ausente
   fica falso). Fica esperando a conversa com a equipe.
2. **Identidade do cliente (`cliente_id`).** Mantive como estava — travar o
   salvar do orçamento atrapalharia o vendedor em campo. A tela de
   confirmação de identidade que já existe é o lugar certo pra reforçar isto,
   e é trabalho separado deste levantamento.
3. **Quantidade escrita no texto em vez do campo.** Não é um campo que vira
   obrigatório — é o formulário aprender a detectar o número na descrição e
   oferecer aplicar no campo certo. Registrado como pendência técnica em
   `docs/cobertura-produto-id-2026-08-07.md`, ainda não feito.
4. Segurança (Auth/RLS) — combinado que fica para depois, com o Marcos
   presente.

## Um ponto de atenção pra quando isto for pro ar

O bloqueio de forma de pagamento e de vínculo de item acontece **na
aprovação**, não só em orçamento novo — e vale pros que já estão parados no
funil hoje. Camboriú tem cobertura de vínculo de ~28%, então a maioria dos
147 orçamentos hoje em aberto vai pedir pra vincular ou marcar "não é
produto" na primeira vez que alguém tentar aprovar um deles depois do
deploy. Resolver um orçamento existente é rápido — o datalist de sugestão já
vincula sozinho quem bate com o nome do produto, e o resto é um clique por
item — mas é um atrito que vai aparecer de uma vez, não gradualmente.
