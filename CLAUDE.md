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
Sistema de gestão para empresas de manutenção de piscinas. Single-file HTML app (`index.html`) com todo CSS, HTML e JS em um único arquivo (~5600+ linhas). Deployed no GitHub Pages.

## URLs
- **Produção:** https://marcosssvinnn.github.io/fluxa-app/
- **Repositório:** https://github.com/marcosssvinnn/fluxa-app (**público** — necessário para GitHub Pages gratuito)
- **Banco de dados:** Supabase — URL e key hardcoded no index.html (buscar por `lbxwclwzeqqtnwvlxsxs`)

> ⚠️ O repositório é **público**. Não commit dados sensíveis além da anon key do Supabase (que é necessária para o app funcionar). A anon key sozinha não dá acesso de escrita irrestrito — o RLS já está ativo.

## Stack
- HTML/CSS/JS puro — sem framework, sem build step, tudo em um arquivo
- Supabase como banco de dados + Realtime sync entre dispositivos
- localStorage como cache offline / fallback (app funciona sem internet)
- PWA com Service Worker (`sw.js`, cache `fluxa-v2`) — instalável no celular
- Deploy: `git push` → GitHub Pages auto-deploya em ~1 min

## Como deployar
```bash
git add index.html sw.js CLAUDE.md
git commit -m "descrição da mudança"
git push
```
> O GitHub Pages serve a branch `main` do repositório diretamente. Não há build step.

## Arquitetura do index.html
- Linhas 1–700: CSS completo
- Linhas 700–1700: HTML de todas as páginas
- Linhas 1700+: JavaScript (boot, funções, módulos)

---

## As 3 empresas (DECISÃO FINAL — não mudar sem consultar Marcos)

| ID (loja_id) | Nome | Grupo | CNPJ | Técnicos |
|---|---|---|---|---|
| `fortemp-camboriu` | Fortemp Camboriú | `forthemp` | mesmo CNPJ que Itapema | Marcos, Josimar, Eldecir, Bruno |
| `fortemp-itapema` | Fortemp Itapema | `forthemp` | mesmo CNPJ que Camboriú | Marcos, Josimar, Eldecir, Bruno |
| `aquamotor` | Aquamotor | `aquamotor` | CNPJ diferente (a informar) | Marcos, Bruno |

**Regras importantes:**
- Fortemp Camboriú e Itapema compartilham o mesmo CNPJ (gestão separada, CNPJ único)
- Josimar e Eldecir **não aparecem** como técnicos em OS/agendamentos da Aquamotor
- O gestor define datas e atribuições; técnico apenas executa (check-in/out, fotos, materiais)
- Técnico vê **todas as suas OS** consolidadas (sem filtro de empresa), pois Marcos e Bruno trabalham nas 3
- CNPJs reais ainda não informados pelo Marcos — usar string IDs por enquanto

**Constante `LOJAS` e `GRUPO_FORTHEMP` no código:**
```js
const LOJAS = [
  { id:'fortemp-camboriu', nome:'Fortemp Camboriú',  cor:'loja-0', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'fortemp-itapema',  nome:'Fortemp Itapema',   cor:'loja-1', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
  { id:'aquamotor',        nome:'Aquamotor',          cor:'loja-2', grupo:'aquamotor', tecs:['Marcos','Bruno'] }
];
const GRUPO_FORTHEMP = ['fortemp-camboriu','fortemp-itapema'];
```

---

## Sessão, perfis e login

```js
// sessionStorage após login:
{ perfil: 'gestor'|'tecnico', loja_id: null|'string-id', nome: 'Marcos' }
```

| Perfil | loja_id na sessão | Acesso |
|--------|------------------|--------|
| Gestor principal (Forthemp) | `null` | Vê dados Forthemp (Camboriú + Itapema). Dropdown no header para filtrar. |
| Gestor de empresa (ex: Acquamotor) | `'aquamotor'` | Vê apenas dados da sua empresa. Sem dropdown. |
| Técnico | `null` | Apenas: Minhas OS, Agenda, Equipamentos. Vê OS de todas as lojas onde está. |

**Importante — gestores de empresa** são registros na tabela `usuarios` com `perfil='gestor'` e `loja_id` preenchido. O gestor principal da Forthemp **não tem** registro no banco — usa o `CFG.pin`.

```js
function isMainGestor(){
  const s=getSessao();
  return s?.perfil==='gestor' && !s?.loja_id;
}
```

**Seed de técnicos:** ao primeiro boot sem usuários no localStorage, cria automaticamente Marcos, Josimar, Eldecir, Bruno sem PIN (gestor define PIN depois em Gestão de Usuários). O seed inclui `id:'tec_'+nome.toLowerCase()` para evitar erro de insert no Supabase.

---

## Filtro multi-empresa — `filtrarPorLoja()`

Esta é a função central de separação de dados. **Sempre usar esta função** em vez de filtrar manualmente.

```js
let lojaAtiva = ''; // '' = todas as empresas do grupo ativo

function filtrarPorLoja(lista, campo='loja_id'){
  if(lojaAtiva){
    const loja = getLoja(lojaAtiva);
    if(loja?.grupo === 'forthemp'){
      // Forthemp específico: inclui registros legados sem loja_id
      return lista.filter(o => (o[campo]||'') === lojaAtiva || !o[campo]);
    }
    // Acquamotor ou outro grupo: filtro estrito
    return lista.filter(o => (o[campo]||'') === lojaAtiva);
  }
  if(isMainGestor())
    return lista.filter(o => GRUPO_FORTHEMP.includes(o[campo]) || !o[campo]);
  return lista;
}
```

**Comportamento:**
- `lojaAtiva = ''` + gestor principal → vê Forthemp Camboriú + Itapema (e legados sem loja_id)
- `lojaAtiva = 'fortemp-camboriu'` → vê Camboriú + registros sem loja_id (legados Forthemp)
- `lojaAtiva = 'aquamotor'` → vê APENAS Aquamotor (isolamento total)
- Técnico → `lojaAtiva` já está definido pela empresa dele ao fazer login

**Módulos que já usam `filtrarPorLoja`:**
- `renderTabela()` — orçamentos
- `renderOSTabela()` — OS
- `renderClientes()` — clientes
- `renderDespesas()` — despesas
- `renderAgLista()` — agendamentos
- `renderEqGrid()` — equipamentos
- `osNoPeriodo()` — produtividade OS
- `despNoPeriodo()` — produtividade despesas
- `atualizarDash()` — totais do dashboard
- `renderProdutividade()` — produtividade

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
| `usuarios` | Técnicos e gestores com PIN (SHA-256), perfil, loja_id |
| `notas_fiscais` | NF-e/NFS-e emitidas via Focus NFe |

**SQL já executado no Supabase (✅ confirmado pelo Marcos):**
```sql
-- Colunas adicionadas às tabelas existentes:
ALTER TABLE orcamentos     ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE clientes       ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE agendamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE equipamentos   ADD COLUMN IF NOT EXISTS loja_id text;
ALTER TABLE despesas       ADD COLUMN IF NOT EXISTS loja_id text;

-- Tabelas novas criadas:
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

-- RLS ativado (✅ já executado):
ALTER TABLE orcamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lojas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON orcamentos     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON ordens_servico FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON clientes       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON agendamentos   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON equipamentos   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON despesas       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON empresa_config FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON lojas          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON usuarios       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON notas_fiscais  FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## Módulos já implementados e funcionando

1. **Orçamentos** — criação, edição, duplicar, histórico, filtros, PDF, status, campo Empresa
2. **Ordens de Serviço** — criação, histórico, PDF, fotos (3), vídeo, campo Empresa
3. **Agendamento Recorrente** — visitas recorrentes, check-in/check-out com GPS, calendário (click abre detalhes da OS)
4. **Equipamentos + QR Code** — ficha do equipamento, QR abre via hash `#eq/ID`
5. **Despesas de Campo** — técnico registra no celular com foto, gestor aprova
6. **Produtividade** — dashboard por técnico, faturamento, taxa de conclusão, filtro por loja
7. **Portal do Cliente** — link único `#portal/TOKEN`, sem login, cliente aprova orçamentos
8. **Notificações WhatsApp** — templates editáveis com variáveis, botão copiar mensagem
9. **Cadastro de Clientes** — com busca por nome/CNPJ, auto-save ao criar orçamento, edição inline
10. **Cadastro de Técnicos / Usuários** — via tela Gestão de Usuários (substitui campo de config); gestor por empresa tem `loja_id` no cadastro
11. **Multi-empresa (3 lojas)** — separação total Forthemp vs Acquamotor; `loja_id` em todos os módulos; filtro no header; badges coloridos; gestor por empresa (registro em `usuarios` com `perfil='gestor'`)
12. **Login por usuário** — seleção de nome + PIN (SHA-256 + salt `fluxa2025`), lockout 3 tentativas/30s, gestor de empresa vê apenas sua loja
13. **Vista do Técnico (Minhas OS)** — OS consolidadas de todas as lojas onde está alocado
14. **Gestão de Usuários** — gestor cria/desativa técnicos e gestores por empresa
15. **Focus NFe (Módulo 7)** — modal de emissão NF-e/NFS-e via Focus NFe API (estrutura pronta, aguardando CNPJs)
16. **Segurança** — PIN hasheado (SHA-256), lockout login, validação de foto (2 MB), dados sensíveis fora do DOM (cache `_nc`)
17. **Busca de clientes** — modal 🔍 no form de ORC e OS; importação batch de clientes de orçamentos existentes
18. **Opções de pagamento avançadas** — boleto parcelado, entrada + boleto, entrada + Pix, cartão parcelado (com nº de parcelas e valor de entrada)
19. **Quantidade de produto** — campo `qty` em serviços/produtos do orçamento; exibe subtotal quando qty > 1
20. **Dashboard filtrado por empresa** — `atualizarDash()` usa `filtrarPorLoja()` para exibir totais da empresa ativa

---

## Formas de pagamento — como funciona

O campo `pag` do orçamento tem valores especiais para formas parceladas:

```js
// Valores especiais (option value):
'boleto-parc'    // Boleto parcelado
'entrada-boleto' // Entrada + Boleto
'entrada-pix'    // Entrada + Pix/Dinheiro
'cartao-parc'    // Cartão parcelado

// Campos extras exibidos condicionalmente:
'pag-entrada'    // input R$ de entrada (entrada-boleto, entrada-pix)
'pag-parcelas'   // select nº parcelas (boleto-parc, entrada-boleto, cartao-parc)
```

```js
function updPag()          // mostra/esconde campos extras ao mudar o select
function formatPagamento(pag, total)  // formata string legível para PDF/WhatsApp
```

---

## Filtro de loja no gestor

```js
let lojaAtiva = ''; // '' = todas as empresas do grupo

// Header do gestor principal (Forthemp) tem dropdown:
// "Todas" | "Fortemp Camboriú" | "Fortemp Itapema"
// (Acquamotor não aparece no dropdown do gestor Forthemp)

// Gestor de empresa (ex: Acquamotor) não tem dropdown — lojaAtiva fixo na sessão

// Ao mudar: trocarLojaAtiva(id) re-renderiza a página ativa
// novoOrc() e novaOS() pré-selecionam lojaAtiva no campo Empresa ao criar novo registro
// Novos registros: sempre gravam loja_id = lojaAtiva || 'fortemp-camboriu'
```

---

## Próxima fase — ainda pendente

### Focus NFe — Módulo 7 (estrutura pronta, aguardando CNPJs e tokens)
- Modal de emissão já existe no HTML/JS
- Falta configurar `focusnfe_token` por loja (gestor insere em Configurações)
- Municípios confirmados: Camboriú-SC (IBGE 4203204, AtendeNet) e Itapema-SC (IBGE 4208450, MeuISS)
- Apenas gestor emite notas

---

## Perguntas em aberto (aguardando Marcos responder)

1. **CNPJs reais** das 3 empresas — para preencher tabela `lojas` e para emissão de NF
2. **Tokens Focus NFe** — um por CNPJ (homologação e produção)

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
let lojaAtiva = '';          // empresa ativa no filtro do gestor ('' = todas do grupo)
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
getLoja(id)           // retorna objeto da LOJAS por id
getLojaNome(id)       // retorna nome legível da loja
getLojaBadge(id)      // retorna <span class="loja-badge loja-0/1/2">Nome</span>
filtrarPorLoja(lista) // filtra lista pelo contexto de empresa ativo (USAR SEMPRE)
isMainGestor()        // true se gestor principal (sem loja_id na sessão)

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
// Gestor principal: PIN = CFG.pin (campo na tela Empresa) → sessão sem loja_id
// Gestor de empresa: PIN = usuario.pin (registro no banco com loja_id) → lojaAtiva = loja_id
// Técnico: PIN = usuario.pin (cadastrado em Gestão de Usuários)
// Sessão: sessionStorage.fluxa_user = JSON.stringify({ perfil, loja_id, nome })
sessionStorage.getItem('fluxa_user') // null = não logado
```

### PIN — segurança
```js
// Hash: SHA-256 com salt 'fluxa2025'
// Armazenado: hash hex em usuario.pin
// Retrocompatível: PINs antigos sem hash ainda funcionam (comparação direta)
// Lockout: 3 tentativas erradas → 30s bloqueado
```

### Salvamento de dados — padrão
Sempre salvar local primeiro, depois sincronizar com Supabase em background:
```js
lsOrcUpsert(rec);          // 1. salva local imediatamente
todosOrc.unshift(rec);     // 2. atualiza memória
db.from('tabela')...       // 3. sincroniza com BD sem bloquear UI
```

### Regra crítica: loja_id em novos registros
Todo novo registro **deve** ter `loja_id` definido. Usar:
```js
loja_id: gV('orc-loja') || lojaAtiva || 'fortemp-camboriu'
// ou
loja_id: lojaAtiva || 'fortemp-camboriu'
```
Nunca gravar `loja_id: null` em registros novos — registros sem loja_id são tratados como legados Forthemp e ficam invisíveis para Acquamotor.

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

/* Pagamento avançado */
.pag-extra      /* container de campos extras (parcelas, entrada) */
.pag-field      /* campo individual dentro de pag-extra */

/* Produto com quantidade */
.qty-f          /* input de quantidade no serviço/produto */
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
- Service Worker cacheia o app shell (cache `fluxa-v2`) para funcionar offline
- Técnico ao fazer login vai direto para `minhas-os`; gestor vai para `history`
- `lojaAtiva` é volátil (não persiste entre sessões) — gestor sempre começa com "Todas"
- Inputs de valor monetário: `type="text"` com `inputmode="decimal"` (não `type="number"`) para suportar vírgula como separador decimal
- Input de quantidade (`qty-f`): `type="number"` com spinners desativados via CSS
- Foto no PDF: `object-fit:contain` para não cortar imagem vertical
- Spinners de input[type=number] desativados globalmente via CSS (webkit + moz)
- Click em evento do calendário → abre `verDetalhesOS(id)` com modal de detalhes
