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

## O mecanismo único (proposta, para "as ferramentas se comunicarem")

Antes de listar campo por campo, a peça que falta é um **padrão comum** que
qualquer formulário novo (e os que já existem) usem, em vez de reinventar:

1. **No HTML:** o campo ganha uma classe `campo-obrig` e um `<span
   class="obrig-badge" title="por que isso importa">*</span>` ao lado do
   rótulo. O `title` já carrega a explicação — sem precisar de tela extra.
2. **No JS:** uma função só, `validarObrigatorios(formId)`, varre os campos
   marcados, e para o primeiro vazio: rola até ele, foca, pinta a borda de
   vermelho e mostra o toast com a explicação. Cada `salvarX()` chama essa
   função uma linha no início, em vez de reescrever o `if(!campo)`.
3. **Explicação curta, não bloqueio raso:** o texto do `title`/toast segue um
   padrão de duas partes — *o que* falta e *o que quebra* se não preencher.
   Ex.: "Forma de pagamento — sem isso o relatório financeiro não sabe
   separar boleto de pix, e o prazo médio de recebimento fica errado."
4. **Obrigatório condicional existe** (ex.: técnico só é obrigatório se a
   despesa NÃO for da empresa) — o mecanismo precisa aceitar uma função de
   condição, não só "sempre obrigatório".

Isso é useful para TODAS as telas de uma vez, e é a parte que eu ficaria à
disposição pra implementar depois deste levantamento — o Marcos decide o quê
vira obrigatório, eu construo o mecanismo e aplico.

---

## Por área, o que falta

### 1. Orçamento (`salvarApenas`) — o formulário mais usado do sistema

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Forma de pagamento** (`pag_cod`) | Opcional — sem checagem nenhuma | Medido: **33 dos 88 aprovados** não têm código real, **30 estão em "A combinar"** — e "2 parcelas" aparece porque é o *default do formulário*, não decisão de ninguém. Foi por isso que a Sessão A decidiu **não** gerar parcela de recebimento sozinha a partir daí. | **Obrigatório.** Sem ele, a Fase 1 (contas a receber) inteira nasce capenga. |
| **Item vinculado ao estoque** (`produto_id` em cada linha) | Opcional, mesmo depois do datalist de sugestão que já existe | Medido: Camboriú **24,3%** de cobertura nos aprovados. É a causa raiz do estoque não bater — a baixa automática só enxerga item vinculado. | **Obrigatório condicional:** cada linha de material precisa estar vinculada OU marcada como "avulso/mão de obra" (um toggle, não um vínculo forçado — nem tudo é produto de estoque). |
| **Cliente com ficha** (`cliente_id`) | Existe tela de confirmação de identidade, mas não bloqueia salvar | Medido: **43% dos nomes** de orçamento não têm ficha — R$ 1,19 milhão. | **Não travar o salvar** (atrapalharia o fluxo de vendedor em campo) — mas reforçar a tela de confirmação para aparecer sempre que o nome for novo, com o motivo já dito no relatório de dedup. |
| Local do serviço | Opcional | Sem local, a rota do técnico e a OS gerada ficam incompletas | Obrigatório — é rápido de preencher e sempre existe. |

### 2. Estoque — ajuste manual (`registrarMovimento`, tipo `ajuste`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| Motivo padronizado (`motivo_cod`) | **Já obrigatório** (`if(!motivoCod){ toast(...) }`) | — | Nenhuma ação — já está certo, é o modelo a copiar para o resto. |
| **Quantidade no campo certo** | Não é campo, é hábito: a equipe escreve "05 Leds" na *descrição* do orçamento em vez de usar o campo `qty` | Medido: **456 unidades** subnotificadas na base — com a baixa automática, vira estoque errado por um fator de 5, silenciosamente. | Isto não se resolve com "obrigatório" — é o formulário de orçamento precisar detectar o número no início do texto e oferecer jogar pro campo de quantidade (já registrado como pendência técnica em `docs/cobertura-produto-id-2026-08-07.md`). |

### 3. Contas a receber (`salvarRecebimento`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Forma de pagamento** (`forma`) | Opcional (`forma:forma\|\|null`) | Sem ela, o relatório financeiro não separa boleto de pix de cartão, e nenhuma reconciliação bancária futura é possível. | Obrigatório. |
| Modo (à vista/parcelado/entrada) | Já efetivamente obrigatório (tem default e um caminho de "decidir depois" explícito) | — | Nenhuma ação. |

### 4. Produtos — cadastro (`salvarProduto`)

| Campo | Hoje | Por que importa | Recomendação |
|---|---|---|---|
| **Custo** | Opcional, vira `0` em silêncio (`parseFloat(...)\|\|0`) | Medido: **6 dos 7 modelos de trocador Pooltec** — o equipamento mais caro da empresa — estão com custo zero. Toda margem calculada sobre eles hoje está errada. | **Obrigatório**, com uma saída: se realmente não souber agora, um botão "cadastrar depois" que grava e marca o produto com um aviso visível na lista (em vez de deixar em zero sem ninguém saber). |
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
| **Data prevista** (`data_prevista`) | Opcional | Sem ela, não existe lead time real nem OTIF de fornecedor — a coluna virou `date` de verdade nesta semana justamente para viabilizar isso. | Obrigatório quando o status sai de "rascunho" — não em "rascunho", porque nem toda OC nasce com data combinada com o fornecedor. |

### 7. Despesas — **já está bem resolvido**

`categoria` e `centro_custo` são preenchidos automaticamente a partir do tipo
(empresa × campo) — não são campos manuais, então não entram na lista. O que
já é validado (`tipo`, `valor`, `técnico` quando não é despesa da empresa)
está correto.

---

## Prioridade de implementação, se for seguir em frente

1. **Forma de pagamento no orçamento e no recebimento** — maior volume de
   dinheiro afetado, dado já quantificado, sem ambiguidade de "quando não se
   aplica".
2. **Custo do produto** — afeta cálculo de margem hoje, poucos produtos por
   vez (começar pelos 6 trocadores Pooltec resolve a maior fatia).
3. **Vínculo de item ao estoque no orçamento (condicional)** — o de maior
   impacto no negócio, mas o mais delicado de implementar bem (precisa do
   toggle "avulso" para não travar quem vende serviço/material genérico).
4. **Conversa sobre o check-in de OS** — não é implementação, é entender com
   a equipe por que o passo está sendo pulado, antes de forçar qualquer coisa.

Não incluí segurança (Auth/RLS) nem nada do que já está combinado ficar para
depois — isto aqui é só o levantamento de campo.
