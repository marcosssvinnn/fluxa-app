# Fluxa App — Contexto do Projeto

---

## ⚠️ PROTOCOLO OBRIGATÓRIO — LEIA ANTES DE QUALQUER COISA

Este arquivo é o **canal de comunicação entre todos os devs e instâncias do Claude** que trabalham neste projeto. Pode haver mais de um dev trabalhando simultaneamente. Para que todos falem a mesma língua, siga estas regras:

### Toda sessão de trabalho deve:
1. **Começar lendo este arquivo** para entender o estado atual do projeto
2. **Terminar atualizando este arquivo** com tudo que foi feito ou decidido na sessão

### O que sempre atualizar ao final de cada sessão:
- Módulos ou funcionalidades implementadas → mover para a lista de "já implementados"
- Decisões tomadas com o Marcos → registrar em "Decisões" e remover das "Perguntas em aberto"
- Planejamento novo → adicionar na seção correspondente
- SQL novo rodado no Supabase → atualizar a lista de tabelas/colunas
- Bugs corrigidos ou comportamentos alterados → atualizar "Observações importantes"
- Perguntas que surgiram → adicionar em "Perguntas em aberto"

### Como atualizar:
```bash
git add CLAUDE.md
git commit -m "docs: atualiza CLAUDE.md — [resumo do que foi feito]"
git push
```

> **Regra de ouro:** se você implementou algo e não atualizou o CLAUDE.md, o próximo dev vai partir de um estado desatualizado e pode duplicar trabalho ou tomar decisões erradas. Sempre atualize.

---

## O que é
Sistema de gestão para empresa de manutenção de piscinas. Single-file HTML app (`index.html`) com todo CSS, HTML e JS em um único arquivo (~5500+ linhas). Deployed no Netlify com auto-deploy via GitHub.

## URLs
- **Produção:** https://sistemaorcamentopiscina.netlify.app
- **Repositório:** https://github.com/marcosssvinnn/fluxa-app
- **Banco de dados:** Supabase — URL e key hardcoded no index.html (buscar por `lbxwclwzeqqtnwvlxsxs`)

## Stack
- HTML/CSS/JS puro — sem framework, sem build step, tudo em um arquivo
- Supabase como banco de dados + Realtime sync entre dispositivos
- localStorage como cache offline / fallback (app funciona sem internet)
- PWA com Service Worker (`sw.js`) — instalável no celular
- Deploy: `git push` → Netlify auto-deploya em ~30s

## Como deployar
```bash
git add index.html sw.js
git commit -m "descrição da mudança"
git push
```

## Arquitetura do index.html
- Linhas 1–700: CSS completo
- Linhas 700–1700: HTML de todas as páginas
- Linhas 1700+: JavaScript (boot, funções, módulos)

---

## As 3 empresas (DECISÃO FINAL — não mudar sem consultar Marcos)

| ID (loja_id) | Nome | CNPJ | Técnicos |
|---|---|---|---|
| `fortemp-camboriu` | Fortemp Camboriú | mesmo CNPJ que Itapema | Marcos, Josimar, Eldecir, Bruno |
| `fortemp-itapema` | Fortemp Itapema | mesmo CNPJ que Camboriú | Marcos, Josimar, Eldecir, Bruno |
| `aquamotor` | Aquamotor | CNPJ diferente (a informar) | Marcos, Bruno |

**Regras importantes:**
- Fortemp Camboriú e Itapema compartilham o mesmo CNPJ (gestão separada, CNPJ único)
- Josimar e Eldecir **não aparecem** como técnicos em OS/agendamentos da Aquamotor
- O gestor define datas e atribuições; técnico apenas executa (check-in/out, fotos, materiais)
- Técnico vê **todas as suas OS** consolidadas (sem filtro de empresa), pois Marcos e Bruno trabalham nas 3
- CNPJs reais ainda não informados pelo Marcos — usar string IDs por enquanto

**Constante `LOJAS` no código:**
```js
const LOJAS = [
  { id:'fortemp-camboriu', nome:'Fortemp Camboriú',  cor:'loja-0', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'fortemp-itapema',  nome:'Fortemp Itapema',   cor:'loja-1', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'aquamotor',        nome:'Aquamotor',          cor:'loja-2', tecs:['Marcos','Bruno'] }
];
```

---

## Banco de dados — tabelas existentes no Supabase

| Tabela | O que armazena |
|--------|----------------|
| `orcamentos` | Orçamentos com status, serviços, pagamento, cnpj, nota_interna, loja_id |
| `ordens_servico` | OS com check-in/check-out, fotos, técnico, cnpj, agendamento_id, loja_id |
| `empresa_config` | Config da empresa: cores, nome, PIN, templates WhatsApp |
| `clientes` | Clientes com portal_token, cnpj, portal_ativo, loja_id |
| `agendamentos` | Agendamentos recorrentes com periodicidade, loja_id |
| `equipamentos` | Equipamentos com QR Code, garantia, foto, loja_id |
| `despesas` | Despesas de campo dos técnicos com comprovante, loja_id |
| `lojas` | Config por empresa: focusnfe_token, focusnfe_ambiente, iss_aliquota, etc. |
| `usuarios` | Técnicos com PIN, perfil, loja_id |
| `notas_fiscais` | NF-e/NFS-e emitidas via Focus NFe |

**SQL já executado (ou planejado para executar no Supabase):**
```sql
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE equipamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS loja_id text;

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
```

---

## Módulos já implementados e funcionando

1. **Orçamentos** — criação, edição, duplicar, histórico, filtros, PDF, status, campo Empresa
2. **Ordens de Serviço** — criação, histórico, PDF, fotos, vídeo, campo Empresa
3. **Agendamento Recorrente** — visitas recorrentes, check-in/check-out com GPS, calendário
4. **Equipamentos + QR Code** — ficha do equipamento, QR abre via hash `#eq/ID`
5. **Despesas de Campo** — técnico registra no celular com foto, gestor aprova
6. **Produtividade** — dashboard por técnico, faturamento, taxa de conclusão
7. **Portal do Cliente** — link único `#portal/TOKEN`, sem login, cliente aprova orçamentos
8. **Notificações WhatsApp** — templates editáveis com variáveis, botão copiar mensagem
9. **Cadastro de Clientes** — com busca por nome/CNPJ, auto-save ao criar orçamento
10. **Cadastro de Técnicos** — via tela Gestão de Usuários (substituiu campo de config)
11. **Multi-loja (3 empresas)** — loja_id em todos os registros, filtro no header, badges coloridos
12. **Login por usuário** — seleção de nome + PIN, gestor usa PIN da empresa
13. **Vista do Técnico (Minhas OS)** — OS consolidadas de todas as lojas onde está alocado
14. **Gestão de Usuários** — gestor cria/desativa técnicos com PIN
15. **Focus NFe (Módulo 7)** — modal de emissão NF-e/NFS-e via Focus NFe API (estrutura pronta)

---

## Sessão e perfis

```js
// sessionStorage após login:
{ perfil: 'gestor'|'tecnico', loja_id: null, nome: 'Marcos' }

// Gestor:
// - perfil: 'gestor', loja_id: null
// - Acesso total, pode filtrar por empresa via dropdown no header
// - PIN = CFG.pin (PIN único da empresa, configurado em Empresa)
// - Não tem registro no banco de usuários

// Técnico:
// - perfil: 'tecnico', loja_id: null (vê OS de todas as lojas onde está)
// - Só vê: Minhas OS, Agenda, Equipamentos
// - Não vê: Orçamentos, Financeiro, Config, Produtividade global
// - PIN = usuario.pin (cadastrado pelo gestor)
```

**Seed de técnicos:** ao primeiro boot sem usuários no localStorage, cria automaticamente
Marcos, Josimar, Eldecir, Bruno sem PIN (gestor define PIN depois em Gestão de Usuários).

---

## Filtro de loja no gestor

```js
let lojaAtiva = ''; // '' = todas as empresas

// Header do gestor tem dropdown:
// "Todas as empresas" | "Fortemp Camboriú" | "Fortemp Itapema" | "Aquamotor"

// Ao mudar: trocarLojaAtiva(id) re-renderiza a página ativa
// renderTabela() e renderOSTabela() filtram por lojaAtiva quando != ''
// novoOrc() e novaOS() pré-selecionam lojaAtiva no campo Empresa
```

---

## Próxima fase — ainda pendente

### Focus NFe — Módulo 7 (estrutura pronta, aguardando CNPJs e tokens)
- Modal de emissão já existe no HTML/JS
- Falta configurar `focusnfe_token` por loja (gestor insere em Configurações)
- Municípios confirmados: Camboriú-SC (IBGE 4203204, AtendeNet) e Itapema-SC (IBGE 4208450, MeuISS)
- Apenas gestor emite notas

### SQL no Supabase — ainda não executado
O SQL da seção "Banco de dados" acima precisa ser executado no painel do Supabase.
Atualmente o app funciona via localStorage; as colunas `loja_id` nas tabelas existentes
**precisam ser adicionadas** para que o Supabase persista corretamente.

---

## Perguntas em aberto (aguardando Marcos responder)

1. **CNPJs reais** das 3 empresas — para preencher tabela `lojas` e para emissão de NF
2. **Tokens Focus NFe** — um por CNPJ (homologação e produção)
3. **SQL no Supabase** — confirmar se as colunas `loja_id` e tabelas novas já foram criadas

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
let lojaAtiva = '';          // empresa ativa no filtro do gestor ('' = todas)
```

### Funções utilitárias
```js
gV('id')          // pega valor de input por id
setV('id', val)   // define valor de input
ls('key')         // localStorage.getItem
lsSet('key', val) // localStorage.setItem
toast('msg')      // notificação temporária
go('pagina')      // navegação entre páginas
brl(valor)        // formata em R$ (ex: brl(150) → "R$ 150,00")
esc(str)          // escapa HTML (sempre usar ao renderizar dados do usuário)

// Multi-loja:
getLoja(id)       // retorna objeto da LOJAS por id
getLojaNome(id)   // retorna nome legível da loja
getLojaBadge(id)  // retorna <span class="loja-badge loja-0/1/2">Nome</span>

// Sessão:
getSessao()       // retorna objeto { perfil, loja_id, nome } ou null
eGestor()         // true se perfil === 'gestor'
fazerLogout()     // limpa sessão e mostra tela de login
```

### Navegação entre páginas
```js
go('form')         // novo orçamento
go('history')      // histórico orçamentos
go('os')           // nova OS
go('os-history')   // histórico OS
go('minhas-os')    // OS consolidada do técnico (só técnico)
go('clientes')     // cadastro clientes
go('equipamentos') // equipamentos + QR
go('agendamentos') // agendamentos recorrentes
go('despesas')     // despesas de campo
go('produtividade')// relatório de produtividade
go('empresa')      // configurações da empresa
go('usuarios')     // gestão de usuários (só gestor)
go('portal')       // portal do cliente (via hash #portal/TOKEN)
```

### localStorage keys
- `fluxa_orcamentos` — cache de orçamentos
- `fluxa_clientes_full` — cache de clientes
- `fluxa_eq` — cache de equipamentos
- `fluxa_desp` — cache de despesas
- `fluxa_os` — cache de OS (se usado)
- `fluxa_usuarios` — cache de usuários/técnicos
- `fluxa_usuarios_seed_pendente` — flag para sincronizar seed com Supabase
- `empresa_cfg` — configurações da empresa

### Autenticação
```js
// Login: usuário seleciona nome na lista → digita PIN
// Gestor: PIN = CFG.pin (campo na tela Empresa)
// Técnico: PIN = usuario.pin (cadastrado em Gestão de Usuários)
// Sessão: sessionStorage.fluxa_user = JSON.stringify({ perfil, loja_id, nome })
sessionStorage.getItem('fluxa_user') // null = não logado
```

### Salvamento de dados — padrão
Sempre salvar local primeiro, depois sincronizar com Supabase em background:
```js
lsOrcUpsert(rec);          // 1. salva local imediatamente
todosOrc.unshift(rec);     // 2. atualiza memória
db.from('tabela')...       // 3. sincroniza com BD sem bloquear UI
```

---

## CSS — variáveis e classes principais
```css
--c1: #F07820   /* laranja — cor primária */
--c2: #2B3244   /* azul escuro — cor secundária */
--r: 12px       /* border-radius padrão */

.wrap           /* container de página: max-width 1200px */
.card           /* card branco com sombra */
.ct             /* título de seção dentro do card */
.row            /* grid 2 colunas */
.row.f1/f3/f4   /* grid 1/3/4 colunas */
.fl             /* field wrapper com label */
.btn-primary    /* botão laranja principal */
.tb             /* botão de ação na tabela (ícone) */
.ta             /* container de botões de ação */
.ht             /* tabela de histórico */
.htw            /* wrapper com overflow-x:auto */
.mob-nav        /* bottom nav mobile (<680px) */

/* Multi-loja */
.loja-badge     /* badge colorido de empresa */
.loja-0         /* laranja — Fortemp Camboriú */
.loja-1         /* azul — Fortemp Itapema */
.loja-2         /* verde — Aquamotor */
.loja-select    /* dropdown de seleção de empresa no header */
.hdr-user       /* badge do usuário logado no header */

/* Vista do técnico */
.tec-os-card    /* card de OS na lista do técnico */
```

---

## Realtime Sync
```js
// Tabelas com sync automático em tempo real:
orcamentos, equipamentos, despesas

// Tabelas carregadas manualmente ao conectar:
clientes (via carregarClientesRemoto())
agendamentos (via loadAgendamentos())
empresa_config (via carregarCFGremoto())
usuarios (via loadUsuarios())
```

---

## Observações importantes de UX/comportamento
- Header `position:fixed` height 56px → `body { padding-top: 56px }`
- iOS: inputs precisam de `font-size:16px` para não dar zoom automático
- Fotos armazenadas como base64 diretamente no banco (sem Supabase Storage)
- QR Code gerado via `api.qrserver.com` — sem biblioteca local
- Hash routing: `#portal/TOKEN` abre portal do cliente, `#eq/ID` abre ficha do equipamento
- Service Worker cacheia o app shell para funcionar offline
- Técnico ao fazer login vai direto para `minhas-os`; gestor vai para `history`
- `lojaAtiva` é volátil (não persiste entre sessões) — gestor sempre começa com "Todas"
