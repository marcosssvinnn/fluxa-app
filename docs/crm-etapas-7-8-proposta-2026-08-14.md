# Proposta — Etapas 7 e 8 do roadmap de CRM

> O texto original do briefing das 8 etapas (colado direto no chat numa
> sessão anterior) se perdeu. O Marcos autorizou propor o conteúdo em vez
> de reconstruir de memória — este documento é essa proposta, ancorada no
> que já foi **medido** e **construído**, não inventada do zero. Precisa da
> aprovação dele antes de qualquer sessão implementar.

## Onde as etapas 1-6 deixaram o sistema

| Etapa | O que é | Status |
|---|---|---|
| 1 | Venda de balcão como transação própria (`vendas_balcao`) | ✅ feita |
| 2 | `cliente_id` real em orçamento/OS (autocomplete/busca) | ✅ feita |
| 3 | Cobertura da carteira — achado de adoção | ✅ feita |
| 4 | Cadência de recompra (intervalo observado + consumo teórico) | ✅ feita |
| 5 | Ficha técnica da piscina (`piscinas`, volume, tratamento) | ✅ feita (falta ligar ao fluxo de vistoria) |
| 6 | Motor de eventos recorrentes (avisa antes) | ✅ feita, versão enxuta |
| 8 | Atribuição — baseline | 🟡 só o "antes" medido, sem o "depois" |

## Achado que decide o que a Etapa 7 precisa ser

O baseline da Etapa 8 (`docs/crm-baseline-atribuicao-2026-08-12.md`) mediu
algo concreto: **`proximo_contato` e `crm_notas` estão vazios em 100% dos
317 orçamentos da base** — incluindo os 34 aprovados nos últimos 30 dias.
Não é um campo pouco usado, é um campo que **ninguém nunca tocou**.

Isso significa uma coisa simples: **não dá pra medir atribuição (Etapa 8)
sobre um dado que não existe.** A Etapa 8 não pode ser "a próxima etapa" —
ela depende de a Etapa 7 gerar o dado primeiro.

## Proposta — Etapa 7: fechar o ciclo de captura de contato

**Objetivo:** registrar contato deixa de ser uma ação extra que ninguém
lembra de fazer, e vira parte natural do fluxo de quem já está falando
com o cliente.

**O que já existe, sem ter sido pensado como "Etapa 7" (construído durante
a crítica de design de 13/08):**
- Botão "📞 Registrar contato" dentro do próprio orçamento (`form-back-bar`).
- Fila "Precisa de você hoje" (`_acaoQueue()`) já reúne follow-up de
  orçamento + cadência de recompra num só lugar, com ações Ligar/WhatsApp
  direto no card.

**O que falta pra fechar de verdade (proposto, não implementado):**
1. **Registrar contato ao clicar Ligar/WhatsApp, não como passo separado.**
   Hoje "Registrar contato" é um botão à parte — a pessoa precisa lembrar
   de clicar nos dois. Juntar: ao clicar Ligar/WhatsApp num orçamento
   aberto, oferecer (não forçar) "o que ficou combinado?" no mesmo
   momento, não depois.
2. **Sinal visível de "há quanto tempo sem contato nenhum".** Hoje isso só
   aparece pra quem já abriu a fila. Um indicador no próprio card/linha do
   orçamento (histórico, funil) tornaria o vazio de dado visível no
   dia a dia, não só pra quem entra em Insights.
3. **Não recriar a fila que já existe** — a "Precisa de você hoje" já
   cobre o mecanismo certo; Etapa 7 é sobre reduzir o atrito de alimentar
   ela, não inventar uma fila nova.

## Proposta — Etapa 8: medir de novo, depois de dado real existir

**Não é ação de código nova** — é reexecutar o mesmo baseline
(`docs/crm-baseline-atribuicao-2026-08-12.md`, seções 7-8) depois que a
Etapa 7 estiver no ar tempo suficiente pra gerar contato registrado de
verdade, e comparar:
- Cobertura de `proximo_contato`/`crm_notas` subiu do 0% atual?
- Orçamentos com contato registrado fecham mais rápido ou convertem mais
  que os sem? (a pergunta original do briefing: "quanto do que fecha teve
  contato registrado antes")
- Se o sinal aparecer, um indicador simples no Insights (ex.: "orçamentos
  com contato registrado convertem X% mais") fecha o ciclo mostrando o
  valor do hábito pra quem preenche.

**Deliberadamente sequencial** — não faz sentido medir atribuição de novo
antes da Etapa 7 gerar dado; reexecutar o baseline agora só repetiria o
mesmo zero.

## Resumo pro Marcos

Etapa 7 = tornar fácil e natural registrar contato (3 melhorias pequenas em
cima do que já existe, sem recriar nada). Etapa 8 = remedir depois — não é
trabalho novo, é comparar o antes/depois. Se topar essa leitura, a próxima
sessão que mexer em `app.js` pode implementar os 3 itens da Etapa 7
diretamente.
