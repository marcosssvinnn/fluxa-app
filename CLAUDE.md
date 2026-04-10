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
Sistema de gestão para empresa de manutenção de piscinas. Single-file HTML app (`index.html`) com todo CSS, HTML e JS em um único arquivo (~5000+ linhas). Deployed no Netlify com auto-deploy via GitHub.

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

## Banco de dados — tabelas existentes no Supabase

| Tabela | O que armazena |
|--------|----------------|
| `orcamentos` | Orçamentos com status, serviços, pagamento, cnpj, nota_interna |
| `ordens_servico` | OS com check-in/check-out, fotos, técnico, cnpj, agendamento_id |
| `empresa_config` | Config da empresa: cores, nome, PIN, templates WhatsApp |
| `clientes` | Clientes com portal_token, cnpj, portal_ativo |
| `agendamentos` | Agendamentos recorrentes com periodicidade |
| `equipamentos` | Equipamentos com QR Code, garantia, foto |
| `despesas` | Despesas de campo dos técnicos com comprovante |

---

## Módulos já implementados e funcionando

1. **Orçamentos** — criação, edição, duplicar, histórico, filtros, PDF, status
2. **Ordens de Serviço** — criação, histórico, PDF, fotos, vídeo
3. **Agendamento Recorrente** — visitas recorrentes, check-in/check-out com GPS, calendário
4. **Equipamentos + QR Code** — ficha do equipamento, QR abre via hash `#eq/ID`
5. **Despesas de Campo** — técnico registra no celular com foto, gestor aprova
6. **Produtividade** — dashboard por técnico, faturamento, taxa de conclusão
7. **Portal do Cliente** — link único `#portal/TOKEN`, sem login, cliente aprova orçamentos
8. **Notificações WhatsApp** — templates editáveis com variáveis, botão copiar mensagem
9. **Cadastro de Clientes** — com busca por nome/CNPJ, auto-save ao criar orçamento
10. **Cadastro de Técnicos** — via campo de configurações da empresa

---

## Melhorias recentes implementadas (contexto das últimas sessões)

- **CNPJ** adicionado em: orçamentos, OS e cadastro de clientes
- **Busca de clientes** na OS agora tem autocomplete igual ao orçamento (busca por nome ou CNPJ)
- **Auto-save de cliente**: ao salvar orçamento, cliente é criado/atualizado automaticamente em Clientes
- **CFG fix**: ao conectar no Supabase, carrega clientes remotos e atualiza form da empresa
- **Tabela histórico**: redesenhada de 8 para 6 colunas — Serviços virou subtítulo do Cliente, Total+Recebido mesclados
- **Largura global**: `.wrap` ampliado de 900px para 1200px em todas as páginas

---

## Próxima fase — aguardando alinhamento do cliente (Marcos)

### FUNDAÇÃO — implementar antes de tudo

#### Estrutura Multi-Loja
Duas unidades: **Loja Camboriú** e **Loja Itapema** com CNPJs diferentes.

**SQL planejado:**
```sql
CREATE TABLE lojas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text, cnpj text, razao_social text,
  inscricao_estadual text, inscricao_municipal text,
  regime_tributario text,  -- 'simples' | 'lucro_presumido'
  endereco text, tel text, cidade text,
  logo_base64 text, cor_primaria text,
  -- campos fiscais para Módulo 7:
  certificado_pfx_base64 text,
  certificado_senha text,
  iss_aliquota numeric(5,2),
  codigo_servico_municipal text,
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

CREATE TABLE usuarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text,
  pin text,                        -- 4 dígitos
  perfil text DEFAULT 'tecnico',   -- 'gestor' | 'tecnico'
  loja_id uuid REFERENCES lojas(id), -- null = gestor (acessa tudo)
  ativo boolean DEFAULT true,
  data_criacao timestamptz DEFAULT now()
);

-- Adicionar loja_id em todas as tabelas existentes:
ALTER TABLE orcamentos     ADD COLUMN loja_id uuid;
ALTER TABLE ordens_servico ADD COLUMN loja_id uuid;
ALTER TABLE clientes       ADD COLUMN loja_id uuid;
ALTER TABLE agendamentos   ADD COLUMN loja_id uuid;
ALTER TABLE equipamentos   ADD COLUMN loja_id uuid;
ALTER TABLE despesas       ADD COLUMN loja_id uuid;
```

#### Perfis de usuário
- **Gestor:** acesso total às duas lojas, cria técnicos, vê financeiro, emite notas
- **Técnico:** só vê sua loja e suas OS, sem orçamentos/config/financeiro
- **Cliente:** acesso via token URL (já funciona via `#portal/TOKEN`) — não muda

**Lógica de sessão:**
```js
// sessionStorage após login:
{ perfil: 'gestor'|'tecnico', loja_id: 'uuid'|null, nome: 'João' }

// Gestor: loja_id = null → busca todas as lojas
// Técnico: loja_id = 'uuid' → todas queries filtram .eq('loja_id', loja_id)
//          → queries de OS também filtram .eq('tecnico', nome)
//          → não renderiza: orçamentos, financeiro, config, produtividade global
```

**Login:** substitui o PIN único atual. Usuário seleciona nome na lista + digita PIN.

#### Telas a criar
- Login com seleção de usuário + PIN
- Dashboard consolidado gestor (cards Camboriú vs Itapema lado a lado)
- Gestão de usuários (gestor cria/desativa técnicos)
- Configurações por loja (substituir "Empresa" atual)

#### Telas existentes a modificar
Orçamento, OS, Históricos, Clientes, Equipamentos, Agendamentos, Despesas, Produtividade — todas ganham filtro por loja e respeitam permissões do perfil logado.

---

### Módulo 7 — Nota Fiscal (planejado, aguardando decisão)

**Tipos:** NF-e modelo 55 (venda de produtos) e NFS-e (serviços).

**Biblioteca escolhida:** NFeWizard-io (open source, GPL-3.0, sem custo por nota).
- npm: `nfewizard-io` (NF-e) + `@nfewizard/nfse` (NFS-e)
- Certificado A1 (.pfx) obrigatório — A3/token não suportado

**Status de suporte por município (pesquisado):**
- NFS-e Itapema/SC ✅ — migrou para padrão nacional em jan/2026
- NFS-e Balneário Camboriú/SC ✅ — migrou para padrão nacional em jan/2026
- NFS-e Camboriú/SC (município do interior) ⚠️ — pode usar sistema proprietário, não confirmado
- NF-e modelo 55 em SC ⚠️ — **não está oficialmente homologada** na biblioteca (só SP está homologado). Pode funcionar mas sem garantia

**❓ Pendente:** Marcos precisa confirmar se é Camboriú ou Balneário Camboriú.

**Opções de implementação (aguardando escolha do Marcos):**
- **Opção A:** usar NFeWizard-io para tudo, aceitar risco SC não homologado
- **Opção B:** NFeWizard-io para NFS-e + biblioteca alternativa para NF-e em SC
- **Opção C:** implementar telas e banco agora, plugar biblioteca depois (mais seguro)

**SQL planejado:**
```sql
CREATE TABLE notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid REFERENCES lojas(id),
  orcamento_id uuid,
  tipo text,       -- 'nfe' | 'nfse'
  numero integer, serie text, chave_acesso text,
  status text DEFAULT 'pendente', -- 'autorizada'|'cancelada'|'rejeitada'
  xml_autorizado text,
  pdf_danfe_base64 text,
  protocolo text, motivo_rejeicao text,
  data_emissao timestamptz DEFAULT now(),
  data_criacao timestamptz DEFAULT now()
);
```

**Fluxo:** orçamento aprovado → botão "Emitir nota" → seletor NF-e/NFS-e → tela de confirmação com dados preenchidos → envia SEFAZ/prefeitura → PDF DANFE gerado → envia ao cliente via WhatsApp.

---

## Perguntas em aberto (aguardando Marcos responder antes de codar)

1. **Camboriú ou Balneário Camboriú?** — afeta suporte NFS-e
2. **Opção A, B ou C** para integração fiscal?
3. **Gestor é usuário fixo** (hardcoded) ou cadastrado no banco junto com técnicos?
4. **Dados das duas lojas:** nome, CNPJ, cidade — já pré-cadastrar no código ou via tela?
5. **Quantos técnicos** e a qual loja pertence cada um?

---

## Padrões de código

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
brl(valor)        // formata em R$ (ex: brl(150) → "R$ 150,00")
esc(str)          // escapa HTML (sempre usar ao renderizar dados do usuário)
```

### Navegação entre páginas
```js
go('form')         // novo orçamento
go('history')      // histórico orçamentos
go('os')           // nova OS
go('os-history')   // histórico OS
go('clientes')     // cadastro clientes
go('equipamentos') // equipamentos + QR
go('agendamentos') // agendamentos recorrentes
go('despesas')     // despesas de campo
go('produtividade')// relatório de produtividade
go('empresa')      // configurações da empresa
go('portal')       // portal do cliente (via hash #portal/TOKEN)
```

### localStorage keys
- `fluxa_orcamentos` — cache de orçamentos
- `fluxa_clientes_full` — cache de clientes
- `fluxa_eq` — cache de equipamentos
- `fluxa_desp` — cache de despesas
- `empresa_cfg` — configurações da empresa

### Autenticação atual
```js
// hoje: PIN único
sessionStorage.getItem('fluxa_auth') === '1'

// após multi-loja (planejado):
sessionStorage.fluxa_user = JSON.stringify({ perfil, loja_id, nome })
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
```

---

## Observações importantes de UX/comportamento
- Header `position:fixed` height 56px → `body { padding-top: 56px }`
- iOS: inputs precisam de `font-size:16px` para não dar zoom automático
- Fotos armazenadas como base64 diretamente no banco (sem Supabase Storage)
- QR Code gerado via `api.qrserver.com` — sem biblioteca local
- Hash routing: `#portal/TOKEN` abre portal do cliente, `#eq/ID` abre ficha do equipamento
- Service Worker cacheia o app shell para funcionar offline
