# Mapa do `app.js`

> Gerado de dentro do próprio arquivo. **Regenere** com `python3 docs/gerar-mapa.py`
> sempre que mexer bastante — os números de linha mudam a cada commit.

O `app.js` tem **13732 linhas** e **754 funções**. Ele NÃO foi dividido em vários
arquivos, e isso é uma decisão, não pendência — a justificativa está no fim.

## Seções

- **l.1044 — Sql Setup** · 18 funções
- **l.1615 — Supabase** · 3 funções
- **l.1648 — Navegação** · 55 funções
- **l.2501 — Form — Init** · 1 funções
- **l.2511 — Presets** · 31 funções
- **l.2792 — Cálculos** · 4 funções
- **l.2800 — Atualizar Ui** · 3 funções
- **l.2849 — Whatsapp** · 15 funções
- **l.3115 — Gerar Pdf Orçamento** · 8 funções
- **l.3369 — Ordem De Serviço** · 2 funções
- **l.3383 — Checklist De Execução (Os)** · 11 funções
- **l.3561 — Histórico** · 3 funções
- **l.3636 — Trilho Comercial E Ciclo De Decisão** · 7 funções
- **l.3705 — Fila De Follow-Up** · 36 funções
- **l.4393 — Gráfico De Faturamento** · 23 funções
- **l.4934 — Modal Pagamento** · 3 funções
- **l.4949 — Os History** · 20 funções
- **l.5304 — Os Fotos** · 2 funções
- **l.5334 — Clientes** · 5 funções
- **l.5429 — Histórico Completo Do Cliente** · 13 funções
- **l.5666 — Modal Busca Cliente** · 6 funções
- **l.5771 — Chips Clientes** · 22 funções
- **l.6059 — Módulo 6 — Notificações Whatsapp** · 9 funções
- **l.6145 — Módulo 5 — Portal Do Cliente** · 3 funções
- **l.6308 — Assinatura Do Cliente (Portal)** · 11 funções
- **l.6434 — Módulo 4 — Produtividade Por Técnico** · 10 funções
- **l.6522 — Contas A Receber** · 1 funções
- **l.6557 — Relatório Financeiro** · 0 funções
- **l.6560 — Dre Gerencial Por Unidade** · 8 funções
- **l.6888 — Módulo 3 — Despesas De Campo** · 18 funções
- **l.7152 — Módulo 1 — Agendamento Recorrente + Check-In/Out** · 19 funções
- **l.7421 — Calendário** · 5 funções
- **l.7556 — Check-In / Check-Out** · 4 funções
- **l.7638 — Módulo 2 — Equipamentos + Qr Code** · 23 funções
- **l.7969 — Gestão De Usuários** · 18 funções
- **l.8383 — Vistorias De Manutenção** · 54 funções
- **l.9719 — Rascunho Automático Da Vistoria** · 40 funções
- **l.10565 — Dossiê De Assembleia** · 115 funções
- **l.12887 — Baixa Rápida De Material** · 9 funções
- **l.13030 — Correção Manual Da Reserva** · 12 funções
- **l.13240 — Fornecedores** · 11 funções
- **l.13326 — Ponto De Pedido** · 1 funções
- **l.13337 — Ordens De Compra (Oc)** · 19 funções
- **l.13510 — Balanço De Inventário** · 7 funções
- **l.13628 — Análise De Margens** · 5 funções

## Onde mexer em cada coisa

| Quero mudar… | Procure por |
|---|---|
| tela inicial por perfil | `telaInicial(` |
| baixa de estoque ao aprovar | `sincronizarSaidaOrcamento(` |
| custo congelado / margem | `_congelarCustoOrc(`, `margemOrcamento(` |
| contas a receber | `gerarParcelas(`, `renderRecebiveis(` |
| DRE | `_dreCalcular(`, `renderDRE(` |
| identidade do cliente | `_identSugerir(`, `identLigar(` |
| base instalada | `_eqCandidatos(`, `importarEqDaVistoria(` |
| indicadores de estoque | `saldoNaData(`, `historicoRuptura(` |
| documentos impressos | `preencherDoc`, `imprimirDoc(` |
| o que aparece no painel diário | `renderPainelHoje(` |

## Por que NÃO está dividido em módulos

Medido em 07/08/2026, antes de tentar:

- **134** declarações `let`/`const` no escopo de topo — são globais compartilhadas
  por todo o arquivo;
- **20 delas são referenciadas ANTES da linha onde são declaradas**. Num arquivo
  único isso funciona (a referência está dentro de função, que só roda depois).
  Espalhado em vários `<script>`, vira **TDZ** — e o `CLAUDE.md` já registra um
  bug desse tipo que custou depuração (`SAAS_C1`).

O app não tem build step nem módulos ES; dividir em scripts clássicos **não**
reduz acoplamento — só espalha as 134 globais por mais arquivos e torna a ordem
de carregamento uma nova fonte de bug, em troca de zero função nova.

**Quando valeria a pena:** junto de um build step (ou `type="module"`), fazendo
o inverso da ordem intuitiva — primeiro eliminar as globais compartilhadas, só
depois separar os arquivos. Enquanto for só cortar em pedaços, o risco é maior
que o ganho.
