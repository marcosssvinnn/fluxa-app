# Fluxa App — Contexto do Projeto

## O que é
Sistema de gestão para empresa de manutenção de piscinas. Single-file HTML app (`index.html`) com todo CSS, HTML e JS em um único arquivo (~5000+ linhas). Deployed no Netlify com auto-deploy via GitHub.

## URLs
- **Produção:** https://sistemaorcamentopiscina.netlify.app
- **Repositório:** https://github.com/marcosssvinnn/fluxa-app
- **Banco de dados:** Supabase (credenciais hardcoded no index.html — buscar por `lbxwclwzeqqtnwvlxsxs`)

## Stack
- HTML/CSS/JS puro (sem framework, sem build step)
- Supabase como banco de dados + Realtime sync
- localStorage como cache offline / fallback
- PWA com Service Worker (`sw.js`)
- Deploy: git push → Netlify auto-deploya em ~30s

## Como deployar
```bash
cd ~/Downloads  # ou onde estiver o index.html
git add index.html sw.js
git commit -m "descrição da mudança"
git push
```

## Arquitetura do index.html
- Linhas 1–700: CSS completo
- Linhas 700–1700: HTML de todas as páginas
- Linhas 1700+: JavaScript (boot, funções, módulos)

## Banco de dados — tabelas existentes
- `orcamentos` — orçamentos com status, serviços, pagamento
- `ordens_servico` — OS com check-in/check-out, fotos, técnico
- `empresa_config` — configurações da empresa (cores, nome, PIN, templates WA)
- `clientes` — cadastro de clientes com portal_token, cnpj
- `agendamentos` — agendamentos recorrentes
- `equipamentos` — equipamentos com QR Code
- `despesas` — despesas de campo dos técnicos

## Módulos já implementados
1. **Agendamento Recorrente** — agenda visitas, check-in/check-out com GPS
2. **Equipamentos + QR Code** — ficha do equipamento, QR abre via hash `#eq/ID`
3. **Despesas de Campo** — técnico registra despesas com foto, gestor aprova
4. **Produtividade** — dashboard por técnico, faturamento, taxa de conclusão
5. **Portal do Cliente** — link único `#portal/TOKEN`, sem login
6. **Notificações WhatsApp** — templates editáveis, botão copiar mensagem

## Próximos módulos planejados (aguardando alinhamento)

### Estrutura Multi-Loja (FUNDAÇÃO — implementar primeiro)
Duas unidades: **Loja Camboriú** e **Loja Itapema** com CNPJs diferentes.
- Nova tabela `lojas` com dados fiscais por unidade
- Nova tabela `usuarios` com perfis: gestor | técnico
- Adicionar `loja_id` em todas as tabelas existentes
- Login substituirá o PIN único atual: usuário seleciona nome + digita PIN
- Sessão armazenada em `sessionStorage` com `{ perfil, loja_id, nome }`

### Perfis de usuário
- **Gestor:** acesso total às duas lojas, cria técnicos, vê financeiro
- **Técnico:** só vê sua loja e suas OS, sem acesso a orçamentos/config/financeiro
- **Cliente:** acesso via token URL, área isolada (já funciona via `#portal/TOKEN`)

### Dashboard consolidado (gestor)
Cards lado a lado Camboriú vs Itapema: orçamentos, OS por status, faturamento, ticket médio.

### Módulo 7 — Nota Fiscal
- NF-e modelo 55 (produtos) e NFS-e (serviços)
- Biblioteca: NFeWizard-io (open source, GPL-3.0, sem mensalidade)
- **Atenção:** NF-e para SC não está oficialmente homologada na biblioteca — testar em homologação
- NFS-e: Itapema ✅ (padrão nacional desde jan/2026). Camboriú/BC depende de qual município
- Fluxo: orçamento aprovado → botão "Emitir nota" → confirmação → envia SEFAZ/prefeitura → PDF DANFE
- Nova tabela `notas_fiscais`
- Apenas gestor emite notas

## Padrões de código importantes

### Variáveis globais principais
```js
let db, dbOk=false;          // conexão Supabase
let CFG = {...CFG_DEF};      // configurações da empresa
let todosOrc = [];           // orçamentos em memória
let todosEq = [];            // equipamentos em memória
let todasDesp = [];          // despesas em memória
```

### Funções utilitárias
```js
gV('id')          // pega valor de input por id
setV('id', val)   // define valor de input
ls('key')         // localStorage.getItem
lsSet('key', val) // localStorage.setItem
toast('msg')      // notificação temporária
go('pagina')      // navegação entre páginas
brl(valor)        // formata em R$
esc(str)          // escapa HTML
```

### Navegação
```js
go('form')        // novo orçamento
go('history')     // histórico orçamentos
go('os')          // nova OS
go('os-history')  // histórico OS
go('clientes')    // cadastro clientes
go('equipamentos')
go('agendamentos')
go('despesas')
go('produtividade')
go('empresa')     // configurações
go('portal')      // portal cliente (via hash)
```

### localStorage keys relevantes
- `fluxa_orcamentos` — cache de orçamentos
- `fluxa_clientes_full` — cache de clientes
- `fluxa_eq` — cache de equipamentos
- `fluxa_desp` — cache de despesas
- `empresa_cfg` — configurações da empresa

### Autenticação atual
- PIN único de 4 dígitos em `sessionStorage.fluxa_auth`
- Após implementar multi-loja: trocar por `sessionStorage.fluxa_user = { perfil, loja_id, nome }`

## CSS — variáveis principais
```css
--c1: #F07820   /* laranja — cor primária */
--c2: #2B3244   /* azul escuro — cor secundária */
--r: 12px       /* border-radius padrão */
```

## Realtime Sync
Tabelas sincronizadas em tempo real: `orcamentos`, `equipamentos`, `despesas`.
Tabelas ainda não no Realtime channel: `clientes`, `agendamentos` (carregam manualmente ao conectar).

## Observações de UX
- Header: `position:fixed`, height 56px → body tem `padding-top:56px`
- `.wrap` tem `max-width:1200px` (foi ampliado de 900px)
- Bottom nav mobile (`.mob-nav`) para telas < 680px
- Inputs com `font-size:16px` para evitar zoom automático no iOS
- Foto em base64 direto no banco (sem storage separado)
