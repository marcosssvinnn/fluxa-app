# Mapa do `app.js`

> Gerado de dentro do próprio arquivo. **Regenere** com `python3 docs/gerar-mapa.py`
> sempre que mexer bastante — os números de linha mudam a cada commit.

O `app.js` tem **20818 linhas** e **1088 funções**. Ele NÃO foi dividido em vários
arquivos, e isso é uma decisão, não pendência — a justificativa está no fim.

## Seções

- **l.1272 — Sql Setup** · 18 funções
- **l.1692 — Supabase** · 3 funções
- **l.1725 — Navegação** · 71 funções
- **l.3244 — Form — Init** · 1 funções
- **l.3254 — Presets** · 33 funções
- **l.3557 — Cálculos** · 4 funções
- **l.3565 — Atualizar Ui** · 7 funções
- **l.3666 — Whatsapp** · 21 funções
- **l.4066 — Gerar Pdf Orçamento** · 8 funções
- **l.4345 — Ordem De Serviço** · 2 funções
- **l.4359 — Checklist De Execução (Os)** · 14 funções
- **l.4657 — Histórico** · 3 funções
- **l.4763 — Trilho Comercial E Ciclo De Decisão** · 7 funções
- **l.4832 — Fila De Follow-Up** · 61 funções
- **l.6086 — Gráfico De Faturamento** · 42 funções
- **l.7144 — Os History** · 75 funções
- **l.8835 — Os Fotos** · 4 funções
- **l.8876 — Clientes** · 26 funções
- **l.9304 — Modal Busca Cliente** · 8 funções
- **l.9464 — Chips Clientes** · 26 funções
- **l.9871 — Módulo 6 — Notificações Whatsapp** · 8 funções
- **l.9953 — Módulo 5 — Portal Do Cliente** · 5 funções
- **l.10268 — Assinatura Do Cliente (Portal)** · 9 funções
- **l.10387 — Módulo 4 — Produtividade Por Técnico** · 10 funções
- **l.10474 — Dre Gerencial Por Unidade** · 8 funções
- **l.10865 — Módulo 3 — Despesas De Campo** · 25 funções
- **l.11283 — Módulo 1 — Agendamento Recorrente + Check-In/Out** · 19 funções
- **l.11552 — Calendário** · 5 funções
- **l.11699 — Check-In / Check-Out** · 3 funções
- **l.11804 — Módulo 2 — Equipamentos + Qr Code** · 42 funções
- **l.12522 — Gestão De Usuários** · 18 funções
- **l.12939 — Vistorias De Manutenção** · 47 funções
- **l.14087 — Rascunho Automático Da Vistoria** · 42 funções
- **l.14980 — Dossiê De Assembleia** · 116 funções
- **l.17453 — Baixa Rápida De Material** · 35 funções
- **l.17899 — Correção Manual Da Reserva** · 151 funções
- **l.20293 — Fornecedores** · 11 funções
- **l.20388 — Ponto De Pedido** · 1 funções
- **l.20399 — Ordens De Compra (Oc)** · 19 funções
- **l.20578 — Balanço De Inventário** · 7 funções
- **l.20702 — Análise De Margens** · 5 funções

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
