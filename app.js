// ══════════════════════════════════════════════════
//  SESSÃO — login multi-usuário
// ══════════════════════════════════════════════════
function getSessao(){ try{ return JSON.parse(sessionStorage.getItem('fluxa_user')||'null'); }catch(e){ return null; } }
function setSessao(u){ sessionStorage.setItem('fluxa_user',JSON.stringify(u)); }
function clearSessao(){ sessionStorage.removeItem('fluxa_user'); }
function eGestor(){ const s=getSessao(); return s?.perfil==='gestor'||s?.perfil==='master'; } // master herda acesso de gestor

// ── Tela inicial do app — PONTO ÚNICO ──
// Havia 6 lugares decidindo isso com regra própria (login por PIN, seleção de
// loja, seleção de empresa do técnico, boot, fim do setup). Eles divergiram: o
// login mandava o gestor para o Insights e o boot para o Novo Orçamento, então
// qualquer F5 tirava a gestora do lugar certo. Quem for mudar o destino, mude
// AQUI — não espalhe go('...') pelos pontos de entrada de novo.
// Insights é gestor/master: não está em pagesVendasOk nem em pagesTecnicoOk,
// então mandar vendas ou técnico para lá só dispara "Acesso não permitido".
function telaInicial(sessao){
  const s = sessao || getSessao();
  if(!s) return 'form';                        // sem sessão: fica atrás do login
  if(s.perfil==='tecnico') return 'minhas-os';
  if(s.perfil==='vendas')  return 'form';
  return 'insights';                           // gestor e master
}

// Estado de estoque declarado no TOPO (antes do boot) para evitar TDZ.
// O boot (aplicarCFG → aplicarPermissoesPerfil) chama loadEstoque() para gestor,
// que usa estas variáveis — antes elas eram declaradas lá embaixo (erro
// "Cannot access 'todosProdutos/todosFornecedores' before initialization").
let todosFornecedores = [], todasOC = [], todosProdutos = [], todosMovEstoque = [], estoqueBusca = '';

// ── Log de auditoria (quem fez o quê) ──
let _auditoria = [];
function lsAuditLer(){ try{ return JSON.parse(ls('fluxa_auditoria')||'[]'); }catch(e){ return []; } }
function lsAuditSalvar(l){ lsSet('fluxa_auditoria', JSON.stringify(l.slice(0,500))); }
function logAcao(acao, detalhe){
  const s=getSessao();
  const reg={
    id:'aud_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
    usuario: s?.nome||'(não logado)', perfil: s?.perfil||'',
    acao, detalhe: detalhe||'',
    loja_id: s?.loja_id||lojaAtiva||null,
    data: new Date().toISOString()
  };
  if(!_auditoria.length) _auditoria=lsAuditLer();
  _auditoria.unshift(reg);
  lsAuditSalvar(_auditoria);
  if(dbOk&&db){ (async()=>{ try{ await _comTimeout(dbInsert('auditoria',reg),15000,'audit'); }catch(e){ /* tabela pode não existir ainda */ } })(); }
  if(document.getElementById('page-auditoria')?.classList.contains('on')) renderAuditoria();
}
async function loadAuditoria(){
  _auditoria = lsAuditLer();
  renderAuditoria();
  if(dbOk&&db){
    try{
      const {data}=await db.from('auditoria').select('*').order('data',{ascending:false}).limit(500);
      if(data){
        const ids=new Set(data.map(x=>x.id));
        const soLocal=_auditoria.filter(x=>!ids.has(x.id));
        _auditoria=[...data,...soLocal].sort((a,b)=>new Date(b.data)-new Date(a.data));
        lsAuditSalvar(_auditoria);
      }
    }catch(e){ console.warn('[loadAuditoria]', e?.message||e); }
  }
  const sel=document.getElementById('audit-filtro-user');
  if(sel){ const v=sel.value; const us=[...new Set(_auditoria.map(a=>a.usuario).filter(Boolean))].sort(); sel.innerHTML='<option value="">Todos os usuários</option>'+us.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join(''); sel.value=v; }
  renderAuditoria();
}
function renderAuditoria(){
  const body=document.getElementById('audit-body'); if(!body) return;
  const fA=document.getElementById('audit-filtro-acao')?.value||'';
  const fU=document.getElementById('audit-filtro-user')?.value||'';
  let lista=filtrarPorLoja(_auditoria.length?_auditoria:lsAuditLer());
  if(fA) lista=lista.filter(a=>(a.acao||'').startsWith(fA));
  if(fU) lista=lista.filter(a=>a.usuario===fU);
  lista=lista.slice(0,300);
  if(!lista.length){ body.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhum registro ainda.</div>'; return; }
  const acaoTxt={login:'🔑 Login',orcamento_criado:'📝 Orçamento criado',orcamento_status:'🔄 Status do orçamento',orcamento_excluido:'🗑 Orçamento excluído',estoque_mov:'📦 Movimento de estoque',estoque_entrega:'📦 Baixa/entrega',os_concluida:'✅ OS concluída',usuario_criado:'👤 Usuário criado',usuario_editado:'✏️ Usuário editado',usuario_removido:'🗑 Usuário removido'};
  body.innerHTML=lista.map(a=>{
    const d=new Date(a.data);
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light)">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${acaoTxt[a.acao]||esc(a.acao)}${a.detalhe?' <span style="font-weight:400;color:var(--gray)">— '+esc(a.detalhe)+'</span>':''}</div>
        <div style="font-size:11px;color:var(--gray)">👤 ${esc(a.usuario||'—')}${a.perfil?' ('+esc(a.perfil)+')':''}${a.loja_id?' · '+esc(getLojaNome(a.loja_id)):''}</div>
      </div>
      <div style="font-size:11px;color:var(--gray);white-space:nowrap;text-align:right">${d.toLocaleDateString('pt-BR')}<br>${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  }).join('');
}
function eVendas(){ const s=getSessao(); return s?.perfil==='vendas'; }
function eTecnico(){ const s=getSessao(); return s?.perfil==='tecnico'; }
function getLojaFiltro(){ const s=getSessao(); return s?.loja_id||null; }

// Oculta/exibe nav conforme perfil
function aplicarPermissoesPerfil(){
  const gestor  = eGestor();
  const vendas  = eVendas();
  const tecnico = eTecnico();

  // ── Desktop nav ──
  // Mapa: id do botão → quem pode ver
  const navRules = {
    'nb-insights'     : gestor,
    'nb-form'         : gestor||vendas,
    'nb-history'      : gestor||vendas,
    'nb-clientes'     : gestor||vendas,
    'nb-agendamentos' : gestor||vendas,
    'nb-os'           : gestor||vendas,
    'nb-os-history'   : gestor,
    'nb-equipamentos' : gestor,
    'nb-visitas'      : gestor||tecnico,
    'nb-despesas'     : gestor,
    'nb-produtividade': gestor,
  };
  Object.entries(navRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });

  // ── Sidebar nav ──
  const snbRules = {
    'snb-insights'     : gestor,
    'snb-form'         : gestor||vendas,
    'snb-venda-balcao' : gestor||vendas||tecnico,
    'snb-history'      : gestor||vendas,
    'snb-clientes'     : gestor||vendas,
    'snb-agendamentos' : gestor||vendas,
    'snb-os'           : gestor||vendas,
    'snb-os-history'   : gestor,
    'snb-minhas-os'    : tecnico,
    'snb-equipamentos' : gestor,
    'snb-visitas'      : gestor||tecnico,
    'snb-recebiveis'   : gestor,
    'snb-despesas'     : gestor,
    'snb-estoque'      : gestor,
    'snb-produtividade': gestor,
  };
  Object.entries(snbRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });
  // Botão "← Minhas OS" no topo da página de Vistorias (só técnico precisa)
  const visBack=document.getElementById('vis-back-os'); if(visBack) visBack.style.display=tecnico?'':'none';
  // Reveal sidebar now that user is logged in
  const _sb=document.getElementById('sidebar');
  if(_sb){ _sb.classList.remove('s-hidden'); }
  document.body.classList.remove('no-sbar');
  initSidebar();

  // ── Seletor de loja no header — só gestor principal ──
  const lojaSelEl=document.getElementById('hdr-loja-select');
  if(lojaSelEl){
    const mostrarSelect=isMainGestor();
    lojaSelEl.style.display=mostrarSelect?'':'none';
    if(mostrarSelect) populaLojaSelect();
  }
  // Preenche os selects de empresa dos formulários a partir da config das lojas
  popularSelectsLojaForm();
  // Carrega estoque em background (gestor) — necessário p/ baixa automática e reservado
  // Adiado p/ depois do parse completo do script: loadEstoque() usa variáveis de
  // estoque declaradas mais abaixo; chamá-lo durante o boot causava TDZ
  // ("Cannot access 'todosProdutos' before initialization"). setTimeout(0) roda
  // após todos os `let` inicializarem. .catch cobre a rejeição do async.
  if(eGestor()){ setTimeout(()=>{ Promise.resolve(loadEstoque()).catch(e=>console.warn('[boot loadEstoque]', e?.message||e)); }, 0); }
  // Vendas de balcão — mesmo gate de loadEstoque (feature de gestor por ora).
  setTimeout(()=>{ if(typeof loadVendasBalcao==='function') Promise.resolve(loadVendasBalcao()).catch(e=>console.warn('[boot loadVendasBalcao]', e?.message||e)); }, 0);
  setTimeout(()=>{ if(typeof loadPiscinas==='function') Promise.resolve(loadPiscinas()).catch(e=>console.warn('[boot loadPiscinas]', e?.message||e)); }, 0);

  // ── Gear menu ──
  // Regras por id
  const gearRules = {
    'gear-btn-empresa' : gestor,
    'gear-btn-usuarios': gestor,
    'gear-btn-auditoria': gestor,
    'gear-btn-prod'    : gestor,
    'gear-btn-estoque' : gestor,
    'gear-btn-visitas' : gestor||tecnico,
  };
  Object.entries(gearRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });
  // Regras por conteúdo do onclick
  const gearHideVendas = ['despesas','equipamentos','os-history'];
  document.querySelectorAll('#gear-menu button').forEach(btn=>{
    const oc=btn.getAttribute('onclick')||'';
    if(gearHideVendas.some(k=>oc.includes(k)))
      btn.style.display=(vendas||tecnico)?'none':'';
  });

  // ── Mobile nav — prioridade por perfil ──
  // Técnico:       Vistorias | Minhas OS | Mais
  // Gestor/Master: Vistorias | Orçam. | OS | Histórico | Mais
  // Vendas:        Orçam. | OS | Histórico | Mais
  const mnbRules = {
    'mnb-visitas'  : gestor||tecnico,
    'mnb-minhas-os': tecnico,
    'mnb-form'     : gestor||vendas,
    'mnb-os'       : gestor||vendas,
    'mnb-history'  : gestor||vendas,
  };
  Object.entries(mnbRules).forEach(([id,pode])=>{
    const el=document.getElementById(id); if(el) el.style.display=pode?'':'none';
  });

  // ── Cards financeiros e gráfico: ocultos para vendas ──
  const dashEl   =document.querySelector('.dash');
  const chartCard=document.querySelector('.dash-chart-card');
  if(dashEl)    dashEl.style.display   =vendas?'none':'';
  if(chartCard) chartCard.style.display=vendas?'none':'';

  // ── Abas de Vistorias: técnico vê só "Meus Locais" e "Histórico" ──
  const visTabNova=document.getElementById('vis-tab-nova');
  if(visTabNova) visTabNova.style.display=tecnico?'none':'';

  // ── Redirecionamentos ──
  const pAtiva=document.querySelector('.page.on');
  const pid=pAtiva?pAtiva.id.replace('page-',''):'';
  const pagesVendasOk=['form','history','clientes','agendamentos','os'];
  const pagesTecnicoOk=['minhas-os','visitas','os']; // 'os' para abrir/preencher a OS atribuída
  if(tecnico && !pagesTecnicoOk.includes(pid)) go('minhas-os');
  if(vendas  && !pagesVendasOk.includes(pid))  go('form');
}

// Atualiza badge de usuário no header
function atualizarBadgeUsuario(){
  const s=getSessao();
  const nome=s?.nome||'Gestor';
  const inicial=nome.charAt(0).toUpperCase();
  const el=document.getElementById('hdr-user-avatar');
  const elNome=document.getElementById('hdr-user-nome');
  const avatarExtra = s?.perfil==='gestor'?' gestor': s?.perfil==='vendas'?' vendas':'';
  if(el){ el.textContent=s?.perfil==='vendas'?'💼':inicial; el.className='hdr-user-avatar'+avatarExtra; }
  // Técnico: mostra a empresa da sessão ao lado do nome (Fortemp/Aquamotor)
  let suf='';
  if(s?.perfil==='tecnico'){
    const emp=s?.empresa_tec||visEmpresaTecnico||sessionStorage.getItem('fluxa_vis_empresa_tec')||'';
    if(emp) suf=' · '+(emp==='aquamotor'?'Aquamotor':'Fortemp');
  }
  if(elNome) elNome.textContent=nome+suf;
}

function fazerLogout(){
  const _sbLogout=document.getElementById('sidebar');
  if(_sbLogout){ _sbLogout.classList.add('s-hidden'); }
  closeSidebar();
  document.body.classList.add('no-sbar');
  clearSessao();
  loginUserSelecionado=null;
  // Resetar passos
  const su=document.getElementById('login-step-users');
  const sp=document.getElementById('login-step-pin');
  const sl=document.getElementById('login-step-loja');
  if(su) su.style.display='';
  if(sp) sp.classList.remove('show');
  if(sl) sl.classList.remove('show');
  document.getElementById('login-overlay').style.display='flex';
  renderLoginUsers();
}

// ══════════════════════════════════════════════════
//  LOJAS — 3 empresas do grupo
// ══════════════════════════════════════════════════
// Config da empresa: usa window.FLUXA_CONFIG (config.js) e, se ausente, os
// defaults da Fortemp/Aquamotor — assim o deploy atual segue idêntico.
const FLUXA_CONFIG = Object.assign({
  appName: 'Fluxa',
  supabaseUrl: 'https://lbxwclwzeqqtnwvlxsxs.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHdjbHd6ZXFxdG53dmx4c3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDc3MTUsImV4cCI6MjA5MTA4MzcxNX0.M1ET8Ho-AFJP9Fh-EtYHt4tdQMZj9zdIayYddrwIlhk',
  lojaPadrao: 'fortemp-camboriu',
  todasLabel: 'Forthemp — Todas',
  grupoPrincipal: ['fortemp-camboriu','fortemp-itapema'],
  // Acesso a grupos "separados": grupos NÃO listados (ex.: forthemp) são abertos
  // a todos os gestores. A Aquamotor é restrita — só estes usuários (por nome).
  // Marcos/Tamara = gestão; Bruno = técnico que faz as vistorias da Aquamotor.
  // (Sem ele aqui, o login de técnico do Bruno caía direto na Fortemp e a
  // vistoria acabava sendo feita na sessão da Tamara — técnico errado no PDF.)
  acessoGrupo: { aquamotor: ['Marcos','Tamara','Bruno'] },
  lojas: [
    { id:'fortemp-camboriu', nome:'Fortemp Camboriú',  cor:'loja-0', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
    { id:'fortemp-itapema',  nome:'Fortemp Itapema',   cor:'loja-1', grupo:'forthemp', tecs:['Marcos','Josimar','Eldecir','Bruno'] },
    { id:'aquamotor',        nome:'Aquamotor',          cor:'loja-2', grupo:'aquamotor', tecs:['Marcos','Bruno'] }
  ]
}, (typeof window!=='undefined' && window.FLUXA_CONFIG) || {});

const LOJAS = FLUXA_CONFIG.lojas;
const GRUPO_FORTHEMP = FLUXA_CONFIG.grupoPrincipal;
const LOJA_PADRAO_ID = FLUXA_CONFIG.lojaPadrao; // loja padrão — usada como fallback em todo o app
try{ if(FLUXA_CONFIG.appName) document.title = FLUXA_CONFIG.appName; }catch(e){ console.warn('[appName]', e?.message||e); }

let lojaAtiva = ''; // '' = todas do grupo; string = empresa específica
// Empresa escolhida pelo técnico no login ('forthemp' | 'aquamotor').
// Técnico atende as duas empresas, mas escolhe uma por sessão p/ não misturar vistorias.
let visEmpresaTecnico = '';

// Retorna true só para o gestor principal da Forthemp (sem loja fixa na sessão)
function isMainGestor(){ const s=getSessao(); return (s?.perfil==='gestor'||s?.perfil==='master')&&!s?.loja_id; }

// ── ACESSO POR GRUPO (empresas separadas) ──
// Grupos não listados em FLUXA_CONFIG.acessoGrupo são abertos a todos. A Aquamotor
// é restrita aos nomes da lista (ex.: Marcos e Tamara).
function _normNome(s){ return (s||'').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function _nomeUsuarioAtual(){ return getSessao()?.nome || (typeof loginUserSelecionado!=='undefined' && loginUserSelecionado?.nome) || ''; }
// Normaliza o campo acessos (jsonb array, string JSON ou nulo) para array
function _acessosDoUsuario(u){
  const a=u&&u.acessos;
  if(Array.isArray(a)) return a;
  if(typeof a==='string'){ try{ const p=JSON.parse(a); return Array.isArray(p)?p:[]; }catch(e){ return []; } }
  return [];
}
// Fonte primária: campo `acessos` do CADASTRO do usuário (checkboxes em
// Usuários → "Acessos extras"). Reserva: lista fixa FLUXA_CONFIG.acessoGrupo
// (vale enquanto a coluna não existir no banco ou estiver vazia).
function podeAcessarGrupo(grupo, nome){
  const n=_normNome(nome!==undefined?nome:_nomeUsuarioAtual());
  // 1º: acessos do cadastro (gerenciável na tela Usuários)
  const u=(typeof todosUsuarios!=='undefined'?todosUsuarios:[]).find(x=>x&&x.ativo!==false&&_normNome(x.nome)===n);
  if(u && _acessosDoUsuario(u).includes(grupo)) return true;
  // 2º: reserva da config
  const lista=(FLUXA_CONFIG.acessoGrupo||{})[grupo];
  if(!lista||!lista.length) return true; // grupo aberto a todos
  return lista.map(_normNome).includes(n);
}
// Grupos "separados" (fora do grupo principal) — base dos checkboxes de acesso
function gruposSeparados(){
  const m=new Map();
  LOJAS.filter(l=>!GRUPO_FORTHEMP.includes(l.id)).forEach(l=>{ if(!m.has(l.grupo)) m.set(l.grupo, l.nome); });
  return [...m.entries()].map(([grupo,nome])=>({grupo,nome}));
}

// Filtra lista pelo contexto de loja/grupo ativo
function filtrarPorLoja(lista, campo='loja_id'){
  if(lojaAtiva){
    // Loja específica selecionada → mostra SOMENTE os registros daquela loja.
    // Registros sem loja_id (legados/órfãos) NÃO entram aqui — apareciam nas duas
    // lojas Forthemp ao mesmo tempo e bagunçavam os totais. Eles só aparecem na
    // visão "Todas". Registros novos sempre recebem loja_id, então isto só afeta
    // dados antigos.
    return lista.filter(o=>(o[campo]||'')===lojaAtiva);
  }
  if(isMainGestor()) return lista.filter(o=>GRUPO_FORTHEMP.includes(o[campo])||!o[campo]);
  // company gestor ou técnico — lojaAtiva já está definido na sua empresa
  return lista;
}

function getLoja(id){ return LOJAS.find(l=>l.id===id)||null; }
function getLojaNome(id){ return getLoja(id)?.nome || id || '—'; }
function getLojaBadge(id){
  const l=getLoja(id); if(!l) return '';
  return `<span class="loja-badge ${l.cor}">${l.nome}</span>`;
}
// Emoji por origem do lead (captação)
const ORIGEM_EMOJI={'Já é cliente':'✅','Indicação':'🗣️','Anúncio Google':'🔎','Instagram / Facebook':'📱','WhatsApp direto':'💬','Passou na loja / Fachada':'🏪','Parceiro / Construtora':'🤝'};
function getOrigemBadge(origem){
  if(!origem) return '';
  const emoji=ORIGEM_EMOJI[origem]||'✏️';
  return `<span class="origem-badge" title="Origem do cliente">${emoji} ${esc(origem)}</span>`;
}

// Preenche o <select> do header com todas as lojas (gestor principal vê tudo)
function populaLojaSelect(){
  const sel=document.getElementById('hdr-loja-select'); if(!sel) return;
  const principais=LOJAS.filter(l=>GRUPO_FORTHEMP.includes(l.id));
  // Empresas separadas (ex.: Aquamotor) só entram se o usuário tiver acesso ao grupo
  const outros=LOJAS.filter(l=>!GRUPO_FORTHEMP.includes(l.id) && podeAcessarGrupo(l.grupo));
  sel.innerHTML=
    `<option value="">${esc(FLUXA_CONFIG.todasLabel||'Todas')}</option>`+
    principais.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('')+
    (outros.length?'<option disabled>──────────</option>'+outros.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join(''):'');
  sel.value=lojaAtiva;
}
// Preenche os <select> de empresa dos formulários (orçamento, OS, usuários) a
// partir das lojas configuradas — antes eram options chumbadas no HTML.
function popularSelectsLojaForm(){
  const opts=LOJAS.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('');
  const orc=document.getElementById('orc-loja'); if(orc){ const v=orc.value; orc.innerHTML=opts; orc.value=v||LOJA_PADRAO_ID; }
  const os=document.getElementById('os-loja');  if(os){ const v=os.value;  os.innerHTML=opts;  os.value=v||LOJA_PADRAO_ID; }
  const usr=document.getElementById('usr-loja-id'); if(usr){ const v=usr.value; usr.innerHTML='<option value="">— Selecione —</option>'+opts; usr.value=v; }
}

function trocarLojaAtiva(id){
  // Defesa: não deixa entrar em empresa separada sem acesso (ex.: Aquamotor)
  const _lojaAlvo=getLoja(id);
  if(_lojaAlvo && !podeAcessarGrupo(_lojaAlvo.grupo)){ toast('⚠️ Você não tem acesso a esta empresa'); return; }
  lojaAtiva=id;
  sessionStorage.setItem('fluxa_loja_ativa', id||'');
  _invalidarSaldoCache(); // cache de saldos depende de lojaAtiva — deve ser limpo a cada troca
  atualizarHeaderLoja();
  // Re-renderiza a página atual
  const paginaAtiva=document.querySelector('.page.on');
  if(!paginaAtiva) return;
  const pid=paginaAtiva.id.replace('page-','');
  if(pid==='history') { initOrcMes(); atualizarDash(); renderTabela(); renderGraficoDash(); }
  else if(pid==='insights') renderPainelInsights();
  else if(pid==='os-history') renderOSTabela();
  else if(pid==='clientes') renderClientes();
  else if(pid==='despesas') renderDespesas();
  else if(pid==='produtividade') loadProdutividade();
  else if(pid==='agendamentos'){ renderAgLista(); renderCal(); }
  else if(pid==='estoque') renderEstoque();
  else if(pid==='auditoria') renderAuditoria();
  else if(pid==='visitas'){
    renderLocaisTab(); renderVisHistorico(); // desenha já com o cache local
    // e re-sincroniza no novo escopo em background (vistorias são filtradas por
    // empresa na BUSCA — o cache pode não ter as da empresa recém-selecionada)
    (async()=>{ try{
      if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
      if(typeof loadVistoriasRemoto==='function') await loadVistoriasRemoto();
      renderLocaisTab(); renderVisHistorico();
    }catch(e){ console.warn('[trocaLoja visitas sync]', e?.message||e); } })();
  }
}

function atualizarHeaderLoja(){
  const LC = getLojaConfig(lojaAtiva);
  document.documentElement.style.setProperty('--c1', LC.cor||CFG.cor);
  document.documentElement.style.setProperty('--c1-light', hexA(LC.cor||CFG.cor, .1));
  document.documentElement.style.setProperty('--c1-mid',  hexA(LC.cor||CFG.cor, .2));
  document.documentElement.style.setProperty('--c2', LC.cor2||CFG.cor2);
  const hNome=document.getElementById('hdr-nome');
  const hSub =document.getElementById('hdr-sub');
  if(hNome) hNome.textContent = LC.nome||CFG.nome||'';
  if(hSub)  hSub.textContent  = LC.sub ||CFG.sub ||'Serviços';
  const img=document.getElementById('hdr-logo-img');
  if(img){
    img.alt = LC.nome||CFG.nome||'Logo';
    if(LC.logoB64){ img.src=LC.logoB64; img.classList.add('has-logo'); }
    else { img.classList.remove('has-logo'); }
  }
  document.title=(LC.nome||CFG.nome||'Fluxa')+' — Orçamentos';
}

// Atualiza o select de técnicos de acordo com a loja selecionada no form
function atualizarTecsPorLoja(lojaId, selectId){
  const sel=document.getElementById(selectId); if(!sel) return;
  const loja=getLoja(lojaId);
  const tecs=loja?loja.tecs:(CFG.tecnicos||LOJAS.flatMap(l=>l.tecs).filter((v,i,a)=>a.indexOf(v)===i));
  const atual=sel.value;
  const opts=tecs.map(t=>`<option value="${t}"${t===atual?' selected':''}>${t}</option>`).join('');
  // mantém opção vazia se não houver seleção
  sel.innerHTML='<option value="">Selecione…</option>'+opts;
  if(tecs.includes(atual)) sel.value=atual;
}

// ══════════════════════════════════════════════════
//  USUÁRIOS — tabela `usuarios` no Supabase
// ══════════════════════════════════════════════════
let todosUsuarios = [];

// Pré-cadastra os 4 técnicos na primeira vez que o app abre
function seedTecnicosIniciais(){
  const TECNICOS_PADRAO = ['Marcos','Josimar','Eldecir','Bruno'];
  try{ todosUsuarios=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ todosUsuarios=[]; }
  if(todosUsuarios.length > 0) return; // já tem usuários, não faz nada
  const seed = TECNICOS_PADRAO.map(nome=>({
    id: 'tec_'+nome.toLowerCase(),
    nome, perfil:'tecnico', loja_id:null, loja_nome:null,
    pin:null, ativo:true, data_criacao:new Date().toISOString()
  }));
  todosUsuarios = seed;
  lsSet('fluxa_usuarios', JSON.stringify(seed));
  // Sincroniza com Supabase em background quando o banco conectar
  lsSet('fluxa_usuarios_seed_pendente','1');
}

async function sincronizarSeedUsuarios(){
  if(!ls('fluxa_usuarios_seed_pendente')) return;
  if(!dbOk||!db) return;
  try{
    const {data:existentes}=await db.from('usuarios').select('id').limit(1);
    if(existentes&&existentes.length>0){ lsSet('fluxa_usuarios_seed_pendente',''); return; }
    const TECNICOS_PADRAO=['Marcos','Josimar','Eldecir','Bruno'];
    const payload=TECNICOS_PADRAO.map(nome=>({id:'tec_'+nome.toLowerCase(),nome,perfil:'tecnico',loja_id:null,loja_nome:null,pin:null,ativo:true}));
    const {data:ins}=await db.from('usuarios').insert(payload).select('*');
    if(ins){
      // Merge: preserva usuários já existentes (ex: vendedores criados offline)
      const seedIds=payload.map(p=>p.id);
      const naoSeed=todosUsuarios.filter(u=>!seedIds.includes(u.id));
      todosUsuarios=[...naoSeed,...ins];
      lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
    }
    lsSet('fluxa_usuarios_seed_pendente','');
  }catch(e){ console.warn('seed técnicos BD falhou:',e.message); }
}

async function carregarUsuarios(){
  // Carrega do localStorage primeiro
  let local=[];
  try{ local=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ console.warn('[carregarUsuarios] cache local corrompido:',e?.message||e); }
  // Tenta carregar do Supabase e faz merge
  try{
    if(dbOk&&db){
      const {data}=await db.from('usuarios').select('*').eq('ativo',true).order('nome');
      if(data){
        // Registros locais temporários (usr_xxx) não presentes no Supabase
        const locaisNaoSincronizados=local.filter(u=>
          String(u.id).startsWith('usr_') &&
          !data.find(d=>d.nome===u.nome && d.perfil===u.perfil)
        );
        for(const u of locaisNaoSincronizados){
          try{
            const payload={nome:u.nome,perfil:u.perfil,loja_id:u.loja_id||null,loja_nome:u.loja_nome||null,pin:u.pin||null,ativo:true};
            const {data:ins}=await dbInsert('usuarios', payload);
            if(ins) data.push(ins);   // sincronizado → usa registro do banco
            else    data.push(u);     // insert sem retorno → mantém local
          }catch(e2){
            data.push(u);             // insert falhou → mantém local
          }
        }
        todosUsuarios=data;
        lsSet('fluxa_usuarios',JSON.stringify(data));
        return;
      }
    }
  }catch(e){ console.warn('[carregarUsuarios] sync falhou, usando cache local:',e?.message||e); }
  todosUsuarios=local;
}


function atualizarDotsPIN(val){
  // No novo formulário não há dots visuais — apenas foco automático ao completar 4 dígitos
  if(val && val.length === 4) setTimeout(fazerLogin, 80);
}


// Lista interna para autocomplete; preenchida por renderLoginUsers
let _loginUsersCache = [];

function renderLoginUsers(){
  // Reconstrói cache de usuários para o autocomplete do formulário de login
  _loginUsersCache = todosUsuarios.filter(u=>u.ativo!==false);
  // Adiciona gestor legado se não houver master/gestor individual
  const temIndividual = _loginUsersCache.some(u=>u.perfil==='master'||u.perfil==='gestor');
  if(!temIndividual) _loginUsersCache.push({id:'__gestor__',nome:'Gestor',perfil:'gestor',loja_id:null,loja_nome:null,pin:null});
  // Atualiza sugestões se o input já tem texto
  const inp = document.getElementById('login-nome-input');
  if(inp && inp.value.trim()) loginNomeInput(inp.value);
}

function loginNomeInput(val){
  const box = document.getElementById('login-nome-sugestoes'); if(!box) return;
  loginUserSelecionado = null; // reset ao digitar
  const q = val.trim().toLowerCase();
  if(q.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = _loginUsersCache.filter(u=>u.nome.toLowerCase().includes(q)).slice(0,6);
  if(!matches.length){ box.style.display='none'; box.innerHTML=''; return; }
  const perfilEmoji={master:'👑',gestor:'🛡️',vendas:'💼',tecnico:'🔧'};
  box.innerHTML = matches.map(u=>`
    <button type="button" onclick="loginEscolherSugestao('${u.id}')"
      style="display:flex;align-items:center;gap:10px;width:100%;padding:9px 14px;border:none;background:none;cursor:pointer;text-align:left;transition:background .1s"
      onmouseenter="this.style.background='var(--c1-bg)'" onmouseleave="this.style.background='none'">
      <span style="font-size:16px">${perfilEmoji[u.perfil]||'🔧'}</span>
      <span style="font-size:14px;font-weight:600;color:var(--c2)">${esc(u.nome)}</span>
      <span style="font-size:12px;color:var(--gray);margin-left:auto">${u.loja_nome||''}</span>
    </button>`).join('');
  box.style.display='block';
}

function loginEscolherSugestao(id){
  const u = _loginUsersCache.find(x=>x.id===id); if(!u) return;
  loginUserSelecionado = {id:u.id, perfil:u.perfil, nome:u.nome, loja_id:u.loja_id};
  const inp = document.getElementById('login-nome-input');
  if(inp) inp.value = u.nome;
  const box = document.getElementById('login-nome-sugestoes');
  if(box){ box.style.display='none'; box.innerHTML=''; }
  document.getElementById('login-err').textContent='';
  setTimeout(()=>document.getElementById('pin-input').focus(), 80);
}

let loginUserSelecionado = null; // {id, perfil, nome, loja_id}


// ── Segurança: hash + lockout ──────────────────────
const PIN_SALT = 'fluxa2025';
// Cache de objetos para botões de notificação (evita JSON no DOM)
const _nc = {};
function getNC(id){ return _nc[id]||{}; }
const LS_LOCKOUT_KEY = 'fluxa_login_lockout';
const LS_ATTEMPTS_KEY = 'fluxa_login_attempts';
// Lê do localStorage para persistir entre recarregamentos (anti-brute-force)
let loginAttempts = parseInt(localStorage.getItem(LS_ATTEMPTS_KEY)||'0', 10);
let loginLockedUntil = parseInt(localStorage.getItem(LS_LOCKOUT_KEY)||'0', 10);
let lockoutTimer = null;

async function hashPIN(pin){
  if(!pin) return null;
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin + PIN_SALT));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){ return pin; }
}

async function pinValido(input, stored){
  if(!stored) return false;
  // Aceita apenas hash SHA-256 (64 chars hex). Texto plano não é mais suportado.
  if(stored.length === 64){ const h = await hashPIN(input); return h === stored; }
  // PIN legado (texto plano): força migração para hash no próximo login
  if(stored === input){
    console.warn('[fluxa] PIN legado detectado — atualize o PIN do usuário para hash.');
    return true;
  }
  return false;
}

function iniciarCountdownLockout(){
  if(lockoutTimer) clearInterval(lockoutTimer);
  lockoutTimer = setInterval(()=>{
    const resto = loginLockedUntil - Date.now();
    if(resto <= 0){
      clearInterval(lockoutTimer); lockoutTimer = null;
      const e = document.getElementById('login-err'); if(e) e.textContent='';
    } else {
      const e = document.getElementById('login-err');
      if(e) e.textContent = `Muitas tentativas. Aguarde ${Math.ceil(resto/1000)}s.`;
    }
  }, 500);
}

async function fazerLogin(){
  const err = document.getElementById('login-err');
  if(Date.now() < loginLockedUntil){ return; }

  // Resolve usuário: sugestão clicada OU busca pelo nome digitado
  if(!loginUserSelecionado){
    const nomeDigitado = (document.getElementById('login-nome-input')?.value||'').trim().toLowerCase();
    if(!nomeDigitado){ err.textContent='Digite seu nome.'; return; }
    const encontrados = _loginUsersCache.filter(u=>u.nome.toLowerCase()===nomeDigitado);
    if(!encontrados.length){ err.textContent='Nome não encontrado. Verifique ou selecione da lista.'; return; }
    if(encontrados.length > 1){ err.textContent='Nome ambíguo — selecione da lista.'; return; }
    const u = encontrados[0];
    loginUserSelecionado = {id:u.id, perfil:u.perfil, nome:u.nome, loja_id:u.loja_id};
  }

  const pin = document.getElementById('pin-input').value;
  if(!pin || pin.length < 4){ err.textContent='Digite os 4 dígitos da senha.'; return; }

  let pinCorreto = false;
  if(loginUserSelecionado.id === '__gestor__'){
    pinCorreto = await pinValido(pin, CFG.pin||'1234');
  } else {
    const u = todosUsuarios.find(x=>x.id===loginUserSelecionado.id);
    if(u){
      pinCorreto = await pinValido(pin, u.pin);
      if(!pinCorreto && !u.pin) pinCorreto = await pinValido(pin, CFG.pin||'1234');
    }
  }

  if(pinCorreto){
    loginAttempts = 0; loginLockedUntil = 0;
    localStorage.removeItem(LS_LOCKOUT_KEY); localStorage.removeItem(LS_ATTEMPTS_KEY);
    err.textContent = '';
    if(loginUserSelecionado.id === '__gestor__'){
      // Gestor principal da Forthemp → escolhe qual unidade gerenciar
      document.getElementById('login-step-pin').classList.remove('show');
      mostrarSelecaoLojaGestor();
    } else if((loginUserSelecionado.perfil==='master'||loginUserSelecionado.perfil==='gestor') && !loginUserSelecionado.loja_id){
      // Master/gestor geral → escolhe a empresa (Forthemp todas/unidade ou Aquamotor)
      // Era aqui que o Marcos caía direto em "Todas" sem ver a opção da Aquamotor.
      document.getElementById('login-step-pin').classList.remove('show');
      mostrarSelecaoLojaGestor();
    } else if(loginUserSelecionado.perfil === 'gestor' && loginUserSelecionado.loja_id){
      // Gestor de empresa específica (ex: Acquamotor) → entra direto na sua empresa
      lojaAtiva = loginUserSelecionado.loja_id;
      sessionStorage.setItem('fluxa_loja_ativa', lojaAtiva);
      const sessao = {perfil:'gestor', loja_id:loginUserSelecionado.loja_id, nome:loginUserSelecionado.nome};
      setSessao(sessao);
      document.getElementById('login-overlay').style.display = 'none';
      atualizarBadgeUsuario();
      aplicarPermissoesPerfil();
      atualizarHeaderLoja();
      logAcao('login', loginUserSelecionado.nome+' (gestor '+(getLojaNome(loginUserSelecionado.loja_id))+')');
      go(telaInicial(sessao));
    } else if(loginUserSelecionado.perfil==='tecnico' &&
              (!loginUserSelecionado.loja_id ||
               Object.keys(FLUXA_CONFIG.acessoGrupo||{}).some(g=>podeAcessarGrupo(g, loginUserSelecionado.nome)))){
      // Técnico que atende mais de uma empresa → escolhe a empresa da sessão.
      // Inclui técnico com loja FIXA mas com acesso a empresa separada (ex.:
      // Bruno, fortemp-camboriu, que também faz as vistorias da Aquamotor —
      // sem isto ele caía direto na Fortemp e nunca via os locais da Aquamotor).
      document.getElementById('login-step-pin').classList.remove('show');
      mostrarSelecaoEmpresaTecnico();
    } else {
      // Técnico de empresa fixa / Vendas → lojaAtiva = sua empresa
      lojaAtiva = loginUserSelecionado.loja_id || '';
      const sessao = {perfil:loginUserSelecionado.perfil, loja_id:loginUserSelecionado.loja_id, nome:loginUserSelecionado.nome};
      setSessao(sessao);
      document.getElementById('login-overlay').style.display = 'none';
      atualizarBadgeUsuario();
      aplicarPermissoesPerfil();
      atualizarHeaderLoja();
      logAcao('login', loginUserSelecionado.nome+' ('+sessao.perfil+')');
      go(telaInicial(sessao));
    }
  } else {
    loginAttempts++;
    lsSet(LS_ATTEMPTS_KEY, loginAttempts);
    if(loginAttempts >= 3){
      loginLockedUntil = Date.now() + 30000;
      loginAttempts = 0;
      lsSet(LS_LOCKOUT_KEY, loginLockedUntil);
      localStorage.removeItem(LS_ATTEMPTS_KEY);
      iniciarCountdownLockout();
    } else {
      err.textContent = `PIN incorreto. ${3 - loginAttempts} tentativa(s) restante(s).`;
    }
    document.getElementById('pin-input').value = '';
    atualizarDotsPIN('');
    document.getElementById('pin-input').focus();
  }
}

function mostrarSelecaoLojaGestor(){
  const list=document.getElementById('login-loja-list');
  const _nomeLogin=loginUserSelecionado?.nome;
  const forthemp=LOJAS.filter(l=>l.grupo==='forthemp');
  // Empresas separadas só aparecem para quem tem acesso (ex.: Aquamotor → Marcos/Tamara)
  const outros=LOJAS.filter(l=>l.grupo!=='forthemp' && podeAcessarGrupo(l.grupo, _nomeLogin));
  const corGrupo={aquamotor:'#16a34a'};

  function lojaBtn(id, cor, icon, nome, sub){
    return `<button class="login-loja-btn" onclick="confirmarLojaGestor('${id}')">
      <div class="login-loja-circle" style="background:${cor}">${icon}</div>
      <div>
        <div class="login-loja-info-nome">${nome}</div>
        <div class="login-loja-info-sub">${sub}</div>
      </div>
    </button>`;
  }

  let html = lojaBtn('','var(--c1)','📊','Todas as unidades','Camboriú + Itapema consolidado');
  forthemp.forEach(l=>{
    html += lojaBtn(l.id,'var(--c2)',l.nome.replace('Fortemp ','').charAt(0),esc(l.nome),'Gerenciar esta unidade');
  });
  if(outros.length){
    html += `<div class="login-section-label" style="margin-top:14px">Outras empresas</div>`;
    outros.forEach(l=>{
      html += lojaBtn(l.id,corGrupo[l.grupo]||'var(--blue)',l.nome.charAt(0),esc(l.nome),'Gerenciar empresa');
    });
  }

  list.innerHTML = html;
  document.getElementById('login-step-users').style.display='none';
  document.getElementById('login-step-loja').classList.add('show');
}

function confirmarLojaGestor(lojaId){
  lojaAtiva=lojaId;
  sessionStorage.setItem('fluxa_loja_ativa', lojaId||'');
  const loja=getLoja(lojaId);
  // Preserva perfil/nome reais do usuário (ex.: Marcos master); só o PIN genérico
  // "__gestor__" vira "Gestor <unidade>".
  const u=loginUserSelecionado;
  const ehReal=u&&u.id&&u.id!=='__gestor__';
  const perfil=ehReal&&u.perfil?u.perfil:'gestor';
  const nome=ehReal&&u.nome?u.nome:(loja?'Gestor '+loja.nome:'Gestor');
  const sessao={perfil,loja_id:null,nome};
  setSessao(sessao);
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('login-step-loja').classList.remove('show');
  atualizarBadgeUsuario();
  aplicarPermissoesPerfil();
  atualizarHeaderLoja();
  go(telaInicial(sessao));
}

// Técnico escolhe a empresa da sessão (Fortemp ou Aquamotor) — reusa a tela de seleção
function mostrarSelecaoEmpresaTecnico(){
  const list=document.getElementById('login-loja-list');
  const corGrupo={forthemp:'var(--c1)',aquamotor:'#16a34a'};
  function empBtn(grupo,icon,nome,sub){
    return `<button class="login-loja-btn" onclick="confirmarEmpresaTecnico('${grupo}')">
      <div class="login-loja-circle" style="background:${corGrupo[grupo]}">${icon}</div>
      <div>
        <div class="login-loja-info-nome">${nome}</div>
        <div class="login-loja-info-sub">${sub}</div>
      </div>
    </button>`;
  }
  // Aquamotor só para técnicos com acesso. Se só sobrar Fortemp, entra direto (sem picker).
  const temAquamotor=podeAcessarGrupo('aquamotor', loginUserSelecionado?.nome);
  if(!temAquamotor){ confirmarEmpresaTecnico('forthemp'); return; }
  list.innerHTML =
    empBtn('forthemp','F','Fortemp','Vistorias Camboriú + Itapema')+
    empBtn('aquamotor','A','Aquamotor','Vistorias da Aquamotor');
  document.getElementById('login-step-users').style.display='none';
  document.getElementById('login-step-loja').classList.add('show');
}

function confirmarEmpresaTecnico(grupo){
  visEmpresaTecnico = grupo;
  // lojaAtiva guia cor/header; vistorias herdam a empresa do LOCAL, não daqui.
  // Fortemp: técnico com loja fixa mantém a sua loja (header/cor certos).
  lojaAtiva = (grupo==='aquamotor') ? 'aquamotor' : (loginUserSelecionado.loja_id||'');
  sessionStorage.setItem('fluxa_loja_ativa', lojaAtiva);
  sessionStorage.setItem('fluxa_vis_empresa_tec', grupo);
  // Na Aquamotor a sessão NÃO pode carregar a loja Fortemp do técnico:
  // getLojaFiltro() pré-filtraria a sincronização de vistorias na loja errada.
  const _lojaSessao = (grupo==='aquamotor') ? null : (loginUserSelecionado.loja_id||null);
  const sessao={perfil:'tecnico', loja_id:_lojaSessao, nome:loginUserSelecionado.nome, empresa_tec:grupo};
  setSessao(sessao);
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('login-step-loja').classList.remove('show');
  atualizarBadgeUsuario();
  aplicarPermissoesPerfil();
  atualizarHeaderLoja();
  logAcao('login', loginUserSelecionado.nome+' (técnico '+(grupo==='aquamotor'?'Aquamotor':'Fortemp')+')');
  go('minhas-os');
}

function voltarParaPin(){
  document.getElementById('login-step-loja').classList.remove('show');
  document.getElementById('login-step-users').style.display='';
  const inp=document.getElementById('pin-input'); if(inp){ inp.value=''; }
  document.getElementById('login-err').textContent='';
  setTimeout(()=>{ const ni=document.getElementById('login-nome-input'); if(ni) ni.focus(); },100);
}


// ══════════════════════════════════════════════════
//  CFG — configurações da empresa (white-label)
// ══════════════════════════════════════════════════
const CFG_DEF = {
  nome:'Minha Empresa', sub:'Serviços', tel:'', whatsapp:'', cidades:'',
  tagline:'', cor:'#C45E0A', cor2:'#2B3244', logoB64:'', segmento:'geral',
  svcs:['Serviço 1','Serviço 2','Serviço 3'], pin:'1234',
  tecnicos:['Marcos','Josimar','Eldecir','Bruno'],
  notif_visita: 'Olá, {nome}! 👋\n\nLembramos que amanhã teremos nossa visita técnica agendada.\n\n⏰ Horário: {hora}\n👤 Técnico: {tecnico}\n🔧 Serviço: {servico}\n\nQualquer dúvida estamos à disposição!\n\n*{empresa}*\n📞 {tel_empresa}',
  notif_concluida: 'Olá, {nome}! ✅\n\nO serviço foi concluído com sucesso!\n\n🔧 Serviço: {servico}\n👤 Técnico: {tecnico}\n\nAcesse seu portal para ver o histórico completo:\n{link_portal}\n\n*{empresa}*\n📞 {tel_empresa}',
  notif_orcamento: 'Olá, {nome}! 📋\n\nPreparamos um orçamento especial para você:\n\n🔧 Serviços: {servico}\n💰 Valor Total: {valor}\n\nAcesse seu portal para aprovar ou recusar:\n{link_portal}\n\nO orçamento é válido por 5 dias. Qualquer dúvida é só falar!\n\n*{empresa}*\n📞 {tel_empresa}',
  notif_garantia: 'Olá, {nome}! ⚠️\n\nA garantia do seu equipamento está vencendo em breve.\n\n🔧 Equipamento: {servico}\n\nEntre em contato para verificarmos a situação!\n\n*{empresa}*\n📞 {tel_empresa}',
  emailjs_pubkey:   'bG1GwMxEr8eiFH5Nd',
  emailjs_service:  'service_5ujy47a',
  emailjs_template: 'template_s9fo89b'
};
let CFG = { ...CFG_DEF };
let lojasExtraConfig = {}; // { lojaId: { nome, sub, logoB64, tel, cidades, cor, cor2, tagline } }
let db = null, dbOk = false;
let svcs = [], editId = null;
let osSvcs = [], modalOrcId = null, osOrcId = null; // osOrcId = ID do orçamento vinculado à OS
let todosOrc = [], filtroSt = localStorage.getItem('fluxa_filtroSt')||'todos', busca = '', filtroOrigem = '';
// Ordenação do histórico: 'recente' (padrão, como sempre foi) ou 'idade' (mais
// parado primeiro — a ordem para cobrar carteira). Declarada AQUI no topo, não
// junto da função: renderTabela roda no boot via loadHist, e `let` no meio do
// arquivo daria TDZ (ver nota de _orcRemotoOk — já aconteceu neste projeto).
let histOrdem = 'recente';
// Confirmação de que a lista veio do BANCO nesta sessão (não do cache local).
// Declaradas aqui no topo de propósito: são lidas por loadHist/loadEstoque, que
// podem rodar durante o boot — declarar junto da função daria TDZ (já aconteceu).
let _orcRemotoOk = false, _estoqueRemotoOk = false;
let todosOS = [], filtroOSSt = localStorage.getItem('fluxa_filtroOSSt')||'todos', buscaOS = '', filtroOSTec = '';
let osEditId = null; // id da OS sendo editada (null = nova) — evita duplicar ao salvar
// Etapa 2 do roadmap de CRM (2026-08-12): cliente_id real em orçamento/OS,
// mesmo padrão já usado em vendas_balcao. {id,nome} só quando o cliente foi
// ESCOLHIDO de uma lista (autocomplete ou busca) — nunca criado a partir de
// texto digitado. Reafirmando a lição do incidente de duplicação: ligar é
// seguro, criar sozinho não é.
let _orcClienteSelecionado = null;
let _osClienteSelecionado = null;
let orcMesRef = ''; // YYYY-MM ou '' = todos os períodos
let osFotos = ['','',''];
let printMode = ''; // 'orc' | 'os' | 'both'

// ── Checklist OS ──
const OS_CHECKLIST_DEFAULT = [
  {id:1, nome:'Serviço executado conforme solicitado',    checked:false, obs:''},
  {id:2, nome:'Equipamentos testados após o serviço',     checked:false, obs:''},
  {id:3, nome:'Materiais e ferramentas recolhidos',       checked:false, obs:''},
  {id:4, nome:'Local limpo e organizado ao término',      checked:false, obs:''},
  {id:5, nome:'Cliente informado sobre o que foi feito',  checked:false, obs:''},
];
let osChecklist = OS_CHECKLIST_DEFAULT.map(x=>({...x}));

// ── Gráfico dashboard ──
let _dashChart = null;

// ── Assinatura ──
let _sigDrawing = false, _sigHasMark = false;

// ══════════════════════════════════════════════════
//  PERSISTÊNCIA LOCAL — localStorage é fonte primária
// ══════════════════════════════════════════════════
const LS_ORC = 'fluxa_orc_data';
function lsOrcLer(){ try{ return JSON.parse(ls(LS_ORC)||'[]'); }catch(e){ return []; } }
function lsOrcSalvar(lista){ lsSet(LS_ORC, JSON.stringify(lista)); }
function lsOrcUpsert(rec){
  const lista=lsOrcLer(), idx=lista.findIndex(x=>x.id===rec.id);
  if(idx>=0) lista[idx]={...lista[idx],...rec}; else lista.unshift(rec);
  lsOrcSalvar(lista);
}
function lsOrcAtualizar(id, changes){
  const lista=lsOrcLer(), idx=lista.findIndex(x=>x.id===id);
  if(idx>=0){ lista[idx]={...lista[idx],...changes}; lsOrcSalvar(lista); }
}
function lsOrcRemover(id){ lsOrcSalvar(lsOrcLer().filter(x=>x.id!==id)); }
function lsOrcProxNum(){ return lsOrcLer().reduce((a,o)=>Math.max(a,o.numero||0),0)+1; }

// ──────────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────────
;(async () => {
  carregarCFGlocal();
  aplicarCFG();
  initEmailJS(); // inicializa EmailJS com chave local se configurada

  const isPortal = await checkPortalHash();
  if(isPortal) return;

  injetarPWA();
  atualizarSQL();
  initForm();
  todosOrc = lsOrcLer();
  // CFG local já foi carregado por carregarCFGlocal() — inicializa lojas_extra a partir dele
  loadLojasExtraConfig();

  // ── Seed técnicos iniciais (roda 1x se não houver usuários) ──
  seedTecnicosIniciais();

  // ── Login check ──
  const sessaoExistente = getSessao();
  if(sessaoExistente){
    // Restaura loja ativa: gestor específico usa loja_id da sessão;
    // gestor principal usa o valor salvo no sessionStorage (persiste em F5)
    if(sessaoExistente.loja_id) lojaAtiva = sessaoExistente.loja_id;
    else { const sal=sessionStorage.getItem('fluxa_loja_ativa'); if(sal) lojaAtiva=sal; }
    // Defesa: se restaurou uma empresa separada sem acesso, volta p/ Forthemp
    { const _lr=getLoja(lojaAtiva); if(_lr && !podeAcessarGrupo(_lr.grupo, sessaoExistente.nome)){ lojaAtiva=''; sessionStorage.setItem('fluxa_loja_ativa',''); } }
    // Restaura a empresa escolhida pelo técnico (Fortemp/Aquamotor) em F5
    visEmpresaTecnico = sessaoExistente.empresa_tec || sessionStorage.getItem('fluxa_vis_empresa_tec') || '';
    document.getElementById('login-overlay').style.display='none';
    atualizarBadgeUsuario();
    aplicarPermissoesPerfil();
  } else {
    try{ todosUsuarios=JSON.parse(ls('fluxa_usuarios')||'[]'); }catch(e){ todosUsuarios=[]; }
    renderLoginUsers();
    document.getElementById('login-overlay').style.display='flex';
  }

  // ── Credenciais do Supabase (vêm do config.js da empresa; fallback nos defaults) ──
  const sbUrl = FLUXA_CONFIG.supabaseUrl;
  const sbKey = FLUXA_CONFIG.supabaseKey;
  lsSet('sb_url', sbUrl); lsSet('sb_key', sbKey);

  // ── Tela inicial: mesma regra do login ──
  // Era go('form') fixo, então o login levava o gestor ao Insights mas QUALQUER
  // recarga (F5, reabrir o app pelo atalho, voltar de um PDF) o largava no Novo
  // Orçamento. Sem sessão o destino é irrelevante (fica atrás do login), mas
  // 'form' evita disparar o toast de "acesso não permitido".
  go(telaInicial(sessaoExistente));

  async function tentarConectar(tentativa){
    try {
      const ok = await conectarDB(sbUrl, sbKey, false);
      if(ok){
        await carregarCFGremoto(); aplicarCFG(); initEmailJS();
        loadLojasExtraConfig();
        atualizarHeaderLoja(); // re-aplica após lojas_extra carregado do Supabase
        // Sincroniza select de loja no form de orçamento (pode estar desatualizado do boot)
        if(lojaAtiva && !editId) setV('orc-loja', lojaAtiva);
        loadLocais(); // carrega locais_vistoria que vieram no CFG (modo legado)
        loadLocaisRemoto(); // tabela dedicada (se existir) — fonte de verdade + auto-migração
        await carregarClientesRemoto();
        await sincronizarSeedUsuarios();
        await carregarUsuarios();
        loadVistoriasRemoto();
        loadRecebimentos(); // contas a receber (não bloqueia o boot)
        renderLoginUsers(); // sempre atualiza lista de usuários após carregar do banco
        // Atualiza aba Locais se estiver aberta
        if(document.getElementById('vis-view-locais')?.style.display!=='none') renderLocaisTab();
      }
      else if(tentativa < 3) setTimeout(()=>tentarConectar(tentativa+1), tentativa===1?3000:15000);
    } catch(e) {
      console.warn('BD offline (tentativa '+tentativa+'):', e.message);
      if(tentativa < 3) setTimeout(()=>tentarConectar(tentativa+1), tentativa===1?3000:15000);
    }
  }
  tentarConectar(1);
  checkQRHash();
})();

// ──────────────────────────────────────────────────
//  M-09 — ATALHOS DE TECLADO (Ctrl+S, /)
// ──────────────────────────────────────────────────
document.addEventListener('keydown', function(e){
  // Ctrl+S / Cmd+S — salva o formulário ativo
  if((e.ctrlKey || e.metaKey) && e.key === 's'){
    e.preventDefault();
    const activePage = document.querySelector('.page.on');
    if(!activePage) return;
    const pid = activePage.id;
    if(pid === 'page-form') salvarApenas();
    else if(pid === 'page-os') { const btn=document.getElementById('btn-os-pdf'); if(btn) btn.click(); }
    else if(pid === 'page-empresa') salvarEmpresa();
    else if(pid === 'page-visitas') salvarVistoria();
  }
  // '/' — foca no campo de busca da página ativa
  if(e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT'){
    e.preventDefault();
    const activePage = document.querySelector('.page.on');
    if(!activePage) return;
    const srch = activePage.querySelector('.hsrch, input[type="search"]');
    if(srch) srch.focus();
  }
});

// ──────────────────────────────────────────────────
//  PWA
// ──────────────────────────────────────────────────
function injetarPWA() {
  const m = { name: CFG.nome, short_name: CFG.nome, start_url:'.', display:'standalone',
    background_color:'#f0f2f5', theme_color: CFG.cor,
    icons:[{src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="'+encodeURIComponent(CFG.cor)+'"/><text y=".9em" font-size="80" x="10">🔧</text></svg>',sizes:'192x192',type:'image/svg+xml'}]
  };
  const b = new Blob([JSON.stringify(m)],{type:'application/manifest+json'});
  let l = document.querySelector('link[rel=manifest]');
  if (!l){ l=document.createElement('link'); l.rel='manifest'; document.head.appendChild(l); }
  l.href = URL.createObjectURL(b);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', CFG.cor);
}

// ──────────────────────────────────────────────────
//  SQL SETUP
// ──────────────────────────────────────────────────
function atualizarSQL(){
  // Antes: o SQL de setup vinha duplicado aqui como string — e o arquivo
  // setup.sql na raiz do repo era uma SEGUNDA cópia. As duas divergiam da
  // produção (e uma da outra): esta aqui nem tinha `recebimentos`,
  // `fornecedores` ou `ordens_compra`, e ainda criava `equipamentos.cliente_id`
  // como uuid — o mesmo bug de tipo que travava a Fase 4 em produção.
  // Agora só existe UM arquivo. setup.sql é servido estático pelo GitHub
  // Pages (mesma raiz de index.html/app.js), então esta função só busca e
  // mostra — impossível divergir de novo, porque não sobrou um segundo lugar
  // para esquecer de atualizar.
  const el=document.getElementById('sql-code'); if(!el) return;
  fetch('setup.sql').then(r=>r.ok?r.text():Promise.reject(r.status))
    .then(txt=>{ el.textContent=txt; })
    .catch(()=>{
      el.textContent='-- Não consegui carregar automaticamente (sem internet?).\n'+
        '-- Copie o arquivo setup.sql da raiz do repositório:\n'+
        '-- https://github.com/marcosssvinnn/fluxa-app/blob/main/setup.sql';
    });
}

// ──────────────────────────────────────────────────
//  CFG — carregar / salvar
// ──────────────────────────────────────────────────
function carregarCFGlocal(){
  try { const s=ls('empresa_cfg'); if(s) CFG={...CFG_DEF,...JSON.parse(s)}; } catch(e){ console.warn('[carregarCFGlocal] cache corrompido, usando defaults:',e?.message||e); }
  // Carrega lojasExtraConfig do cache dedicado (mais confiável que depender do CFG.lojas_extra)
  try {
    const cached=ls('fluxa_lojas_extra_cfg');
    if(cached){ const ex=JSON.parse(cached); if(ex&&Object.keys(ex).length) lojasExtraConfig=ex; }
  } catch(e){ console.warn('[carregarCFGlocal:extra]',e?.message||e); }
  // Merge com CFG.lojas_extra caso tenha dados mais recentes
  if(CFG.lojas_extra && Object.keys(CFG.lojas_extra).length){
    lojasExtraConfig={...lojasExtraConfig,...CFG.lojas_extra};
  }
}
async function carregarCFGremoto(){
  if(!dbOk||!db) return;
  try{
    const {data} = await db.from('empresa_config').select('dados').eq('id',1).single();
    if(data?.dados){ CFG={...CFG_DEF,...data.dados}; lsSet('empresa_cfg',JSON.stringify(CFG)); }
  }catch(e){ console.warn('[carregarCFGremoto]', e?.message||e); }
}

// loadLojasExtraConfig: lê de CFG.lojas_extra (já carregado junto com CFG global)
function loadLojasExtraConfig(){
  lojasExtraConfig = CFG.lojas_extra || {};
  lsSet('fluxa_lojas_extra_cfg', JSON.stringify(lojasExtraConfig));
}

function getLojaConfig(lojaId){
  if(!lojaId) return CFG;
  // Se lojasExtraConfig estiver vazio, tenta carregar do cache localStorage
  if(!Object.keys(lojasExtraConfig).length){
    try{
      const cached=ls('fluxa_lojas_extra_cfg');
      if(cached){ const ex=JSON.parse(cached); if(ex&&Object.keys(ex).length) lojasExtraConfig=ex; }
    }catch(e){ console.warn('[getLojaConfig:lazy]',e?.message||e); }
  }
  const extra = lojasExtraConfig[lojaId];
  if(!extra) return CFG;
  return {
    ...CFG,
    nome:    extra.nome    || CFG.nome,
    sub:     extra.sub     || CFG.sub,
    logoB64: extra.logoB64 || CFG.logoB64,
    cor:     extra.cor     || CFG.cor,
    cor2:    extra.cor2    || CFG.cor2,
    tel:     extra.tel     || CFG.tel,
    cidades: extra.cidades || CFG.cidades,
    tagline: extra.tagline !== undefined ? extra.tagline : CFG.tagline
  };
}

async function salvarLojaConfig(lojaId){
  if(!lojaId) return;
  const dados = {
    nome:    gV('loja-cfg-nome-'+lojaId)||'',
    sub:     gV('loja-cfg-sub-'+lojaId)||'',
    tagline: gV('loja-cfg-tagline-'+lojaId)||'',
    tel:     gV('loja-cfg-tel-'+lojaId)||'',
    cidades: gV('loja-cfg-cidades-'+lojaId)||'',
    cor:     (document.getElementById('loja-cfg-cor-'+lojaId)?.value)||'',
    cor2:    (document.getElementById('loja-cfg-cor2-'+lojaId)?.value)||'',
    logoB64: lojasExtraConfig[lojaId]?.logoB64||''
  };
  // campos vazios → fallback para CFG global (não sobrescreve com vazio)
  Object.keys(dados).forEach(k=>{ if(!dados[k]) delete dados[k]; });
  // guarda dentro do CFG, na chave lojas_extra
  if(!CFG.lojas_extra) CFG.lojas_extra={};
  CFG.lojas_extra[lojaId] = dados;
  lojasExtraConfig[lojaId] = dados;
  lsSet('empresa_cfg', JSON.stringify(CFG)); // persiste local
  lsSet('fluxa_lojas_extra_cfg', JSON.stringify(lojasExtraConfig));
  if(dbOk && db){
    try{
      // salva tudo junto no registro global id=1 — mesma estratégia do salvarEmpresa
      await dbUpsert('empresa_config', {id:1, dados:CFG, updated_at:new Date().toISOString()});
      toast('✅ Branding da '+getLojaNome(lojaId)+' salvo!');
    }catch(e){
      console.warn('[salvarLojaConfig]', e?.message||e);
      toast('✅ Salvo localmente (sync falhou)');
    }
  } else {
    toast('✅ Branding salvo localmente');
  }
}

function uploadLojaLogo(input, lojaId){
  const file = input.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = e => {
    if(!lojasExtraConfig[lojaId]) lojasExtraConfig[lojaId]={};
    lojasExtraConfig[lojaId].logoB64 = e.target.result;
    // sincroniza com CFG.lojas_extra para persistência posterior
    if(!CFG.lojas_extra) CFG.lojas_extra={};
    if(!CFG.lojas_extra[lojaId]) CFG.lojas_extra[lojaId]={};
    CFG.lojas_extra[lojaId].logoB64 = e.target.result;
    const prev = document.getElementById('loja-logo-preview-'+lojaId);
    if(prev){ prev.src=e.target.result; prev.style.display='block'; }
  };
  r.readAsDataURL(file);
}

// Atualização manual: re-sincroniza os dados da tela atual com o banco.
async function atualizarDados(btn){
  if(btn){ btn.disabled=true; btn.classList.add('girando'); }
  toast('🔄 Atualizando…');
  try{
    if(typeof _reenviarPendentes==='function') await _reenviarPendentes(true);
    const pid=document.querySelector('.page.on')?.id.replace('page-','')||'';
    if(pid==='visitas'){ if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto(); if(typeof loadVistoriasRemoto==='function') await loadVistoriasRemoto(); if(typeof renderLocaisTab==='function') renderLocaisTab(); if(typeof renderVisHistorico==='function') renderVisHistorico(); }
    else if(pid==='agendamentos'){ if(typeof loadAgendamentos==='function') await loadAgendamentos(); }
    else if(pid==='estoque'){ if(typeof loadEstoque==='function') await loadEstoque(); }
    else if(pid==='history'){ if(typeof loadHist==='function') await loadHist(); }
    else if(pid==='minhas-os'){ if(typeof loadMinhasOS==='function') await loadMinhasOS(); }
    else if(typeof carregarClientesRemoto==='function'){ await carregarClientesRemoto(); }
    toast('✅ Dados atualizados');
  }catch(e){ console.warn('[atualizarDados]', e?.message||e); toast('⚠️ Não foi possível atualizar agora'); }
  if(btn){ btn.disabled=false; btn.classList.remove('girando'); }
}
async function carregarClientesRemoto(){
  if(!dbOk||!db) return;
  try{
    // Sempre busca TODOS os clientes — nunca filtra no banco.
    // A separação Aquamotor/Fortemp é feita em renderClientes().
    // Filtrar no banco causava sobrescrita do localStorage com só um grupo,
    // apagando os clientes do outro grupo ao trocar de contexto.
    // ⚠️ PostgREST corta em 1000 linhas por padrão. Sem paginar, qualquer
    // cliente cujo nome caísse depois do 1000º alfabético ficava invisível
    // pro app inteiro (Clientes, autocomplete, Identidade, limpeza de
    // duplicatas — todos leem daqui). Achado com 1.684 clientes reais: só
    // os 1000 primeiros chegavam. Pagina até esgotar.
    let remoto=[], from=0;
    const PAGINA=1000;
    while(true){
      const {data,error}=await db.from('clientes').select('*').order('nome',{ascending:true}).range(from, from+PAGINA-1);
      if(error) throw error;
      remoto=remoto.concat(data||[]);
      if(!data || data.length<PAGINA) break;
      from+=PAGINA;
    }
    const _tombCli=new Set(_tombLer('fluxa_cli_tombstones'));
    if(_tombCli.size){
      remoto.filter(r=>_tombCli.has(r.id)).forEach(r=>db.from('clientes').delete().eq('id',r.id).then(()=>{}).catch(()=>{}));
      remoto=remoto.filter(r=>!_tombCli.has(r.id));
    }
    const local=lsCliLer();
    const dbIds=new Set(remoto.map(x=>x.id));
    // Merge: BD é fonte de verdade + preserva clientes criados offline
    const merged=[...remoto];
    const soLocal=local.filter(l=>!dbIds.has(l.id)&&!_tombCli.has(l.id));
    soLocal.forEach(l=>merged.push(l));
    lsCliSalvar(merged);
    if(document.getElementById('page-clientes').classList.contains('on')) renderClientes();
    // Sobe ao Supabase clientes criados offline — mas só os RECENTES.
    // Achado real (11/08): _migrarClientesDeOrcamentos (já desligada) deixou
    // centenas de fichas "só locais" presas no cache de abas que ficaram
    // muito tempo sem recarregar. Quando essa aba finalmente rodou
    // carregarClientesRemoto de novo, esse lixo velho foi empurrado pro
    // banco em massa — recriando o mesmo padrão do incidente, mesmo com a
    // causa raiz já corrigida. Cliente criado offline de verdade sincroniza
    // em horas; id 'cli_<timestamp>' com mais de 48h parado é quase certo
    // lixo travado, não uso legítimo — não empurra pro banco.
    const soLocalRecente=soLocal.filter(c=>_idadeIdMs(c.id) < DOIS_DIAS_MS);
    const soLocalAntigo=soLocal.length-soLocalRecente.length;
    if(soLocalAntigo) console.warn('[carregarClientesRemoto] '+soLocalAntigo+' ficha(s) local(is) com mais de 48h ignorada(s) — provável lixo de bug antigo, não sincronizada.');
    soLocalRecente.forEach(c=>{
      salvarClienteRemoto(c);   // sem id: uuid vem do banco (ver salvarClienteRemoto)
    });
  }catch(e){ console.warn('[carregarClientesRemoto]', e?.message||e); }
}
function aplicarCFG(){
  document.documentElement.style.setProperty('--c1', CFG.cor);
  document.documentElement.style.setProperty('--c1-light', hexA(CFG.cor,.1));
  document.documentElement.style.setProperty('--c1-mid', hexA(CFG.cor,.2));
  document.documentElement.style.setProperty('--c2', CFG.cor2);
  document.getElementById('hdr-nome').textContent = CFG.nome;
  document.getElementById('hdr-sub').textContent  = CFG.sub || 'Serviços';
  const img = document.getElementById('hdr-logo-img');
  img.alt = CFG.nome || 'Logo';
  if(CFG.logoB64){ img.src=CFG.logoB64; img.classList.add('has-logo'); }
  else { img.classList.remove('has-logo'); }
  // Atualiza brand no login
  const loginLogoImg = document.getElementById('login-logo-img');
  const loginInitials = document.getElementById('login-brand-initials');
  const loginName = document.getElementById('login-brand-name');
  if(loginName) loginName.textContent = CFG.nome || 'Fluxa';
  if(loginLogoImg && loginInitials){
    if(CFG.logoB64){ loginLogoImg.src=CFG.logoB64; loginLogoImg.style.display='block'; loginInitials.style.display='none'; }
    else { loginLogoImg.style.display='none'; loginInitials.style.display='flex'; loginInitials.textContent=(CFG.nome||'F').charAt(0).toUpperCase(); }
  }
  // Tagline no painel lateral do login
  const loginTagline=document.getElementById('login-brand-tagline');
  if(loginTagline) loginTagline.textContent=CFG.tagline||'';
  document.title = CFG.nome + ' — Orçamentos';
  renderPresets();
  preencherFormEmpresa();
  injetarPWA();
  populaTecSelects(); populaTecCheckIn();
  atualizarBadgeUsuario();
  aplicarPermissoesPerfil();
  atualizarHeaderLoja(); // sobrescreve header/cores com config da loja ativa
}

function preencherFormEmpresa(){
  // Para gestores de empresa específica, exibe os dados da sua loja
  const LC = (lojaAtiva && !isMainGestor()) ? getLojaConfig(lojaAtiva) : CFG;
  setV('cfg-nome',LC.nome||CFG.nome); setV('cfg-sub',LC.sub||CFG.sub);
  setV('cfg-tagline',LC.tagline!==undefined?LC.tagline:(CFG.tagline||''));
  setV('cfg-tel',LC.tel||CFG.tel); setV('cfg-cidades',LC.cidades||CFG.cidades);
  setV('cfg-cor',LC.cor||CFG.cor); setV('cfg-cor-txt',LC.cor||CFG.cor);
  setV('cfg-cor2',LC.cor2||CFG.cor2); setV('cfg-cor2-txt',LC.cor2||CFG.cor2);
  setV('cfg-servicos', (CFG.svcs||[]).join('\n'));
  setV('cfg-tecnicos', (CFG.tecnicos||[]).join('\n'));
  setV('cfg-pin', ''); // não exibir hash; usuário digita novo PIN para alterar
  setV('cfg-notif-visita', CFG.notif_visita || CFG_DEF.notif_visita);
  setV('cfg-notif-concluida', CFG.notif_concluida || CFG_DEF.notif_concluida);
  setV('cfg-notif-orcamento', CFG.notif_orcamento || CFG_DEF.notif_orcamento);
  setV('cfg-notif-garantia', CFG.notif_garantia || CFG_DEF.notif_garantia);
  // Nota Fiscal
  setV('cfg-nfe-token-prod', CFG.nfe_token_prod||'');
  setV('cfg-nfe-token-hom', CFG.nfe_token_hom||'');
  setV('cfg-nfe-cnpj', CFG.nfe_cnpj||'');
  setV('cfg-nfe-iss', CFG.nfe_iss||'2.0');
  setV('cfg-nfe-cod-svc', CFG.nfe_cod_svc||'7.10');
  setV('cfg-ejs-pubkey',   CFG.emailjs_pubkey||'');
  setV('cfg-ejs-service',  CFG.emailjs_service||'');
  setV('cfg-ejs-template', CFG.emailjs_template||'');
  const ejsSt=document.getElementById('ejs-status');
  if(ejsSt) ejsSt.textContent=emailJSConfigurado()?'✅ EmailJS configurado':'';
  const lp = document.getElementById('logo-preview');
  const logoAtivo = LC.logoB64||CFG.logoB64;
  if(logoAtivo){ lp.src=logoAtivo; lp.style.display='block'; } else { lp.style.display='none'; }
  // Per-loja branding — só para gestor principal
  const brandCard=document.getElementById('lojas-branding-card');
  if(brandCard) brandCard.style.display=isMainGestor()?'block':'none';
  if(isMainGestor()) renderLojasBrandingUI();
}

function renderLojasBrandingUI(){
  const body=document.getElementById('lojas-branding-body'); if(!body) return;
  body.innerHTML=LOJAS.map(loja=>{
    const ec=lojasExtraConfig[loja.id]||{};
    const idN=loja.id.replace(/[^a-z0-9]/g,'-');
    return `
    <div class="loja-cfg-block">
      <div class="loja-cfg-hdr">
        <img id="loja-logo-preview-${loja.id}" src="${esc(ec.logoB64||'')}" class="loja-logo-sm" style="display:${ec.logoB64?'block':'none'}">
        <div>
          <div class="loja-cfg-title">${esc(loja.nome)}</div>
          <div class="loja-cfg-badge">${loja.id}</div>
        </div>
      </div>
      <div class="row">
        <div class="fl"><label>Nome nos documentos</label><input type="text" id="loja-cfg-nome-${loja.id}" value="${esc(ec.nome||'')}" placeholder="${esc(loja.nome)}"></div>
        <div class="fl"><label>Subtítulo / Segmento</label><input type="text" id="loja-cfg-sub-${loja.id}" value="${esc(ec.sub||'')}" placeholder="${esc(CFG.sub||'Manutenção de Piscinas')}"></div>
      </div>
      <div class="row f1">
        <div class="fl"><label>Slogan / Tagline <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gray)">(opcional)</span></label><input type="text" id="loja-cfg-tagline-${loja.id}" value="${esc(ec.tagline||'')}" placeholder="${esc(CFG.tagline||'')}"></div>
      </div>
      <div class="row">
        <div class="fl"><label>Telefone / WhatsApp</label><input type="text" id="loja-cfg-tel-${loja.id}" value="${esc(ec.tel||'')}" placeholder="${esc(CFG.tel||'')}"></div>
        <div class="fl"><label>Cidades / Regiões</label><input type="text" id="loja-cfg-cidades-${loja.id}" value="${esc(ec.cidades||'')}" placeholder="${esc(CFG.cidades||'')}"></div>
      </div>
      <div class="row">
        <div class="fl"><label>Cor principal</label>
          <div class="color-row">
            <input type="color" id="loja-cfg-cor-${loja.id}" value="${ec.cor||CFG.cor||'#C45E0A'}">
            <input type="text" value="${ec.cor||CFG.cor||'#C45E0A'}" oninput="document.getElementById('loja-cfg-cor-${loja.id}').value=this.value" placeholder="#C45E0A">
          </div>
        </div>
        <div class="fl"><label>Cor secundária</label>
          <div class="color-row">
            <input type="color" id="loja-cfg-cor2-${loja.id}" value="${ec.cor2||CFG.cor2||'#2B3244'}">
            <input type="text" value="${ec.cor2||CFG.cor2||'#2B3244'}" oninput="document.getElementById('loja-cfg-cor2-${loja.id}').value=this.value" placeholder="#2B3244">
          </div>
        </div>
      </div>
      <div class="fl" style="margin-bottom:10px">
        <label>Logo exclusiva</label>
        <div class="loja-logo-upload-sm">
          <input type="file" accept="image/*" onchange="uploadLojaLogo(this,'${loja.id}')">
          🖼️ Clique para enviar logo (PNG ou JPG)
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn-primary" style="padding:8px 18px;font-size:13px" onclick="salvarLojaConfig('${loja.id}')">💾 Salvar ${esc(loja.nome)}</button>
        ${ec.logoB64?`<button class="btn-sec" style="padding:8px 14px;font-size:12px;color:var(--red);border-color:var(--red)" onclick="removerLojaLogo('${loja.id}')">🗑 Remover logo</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function removerLojaLogo(lojaId){
  if(!lojasExtraConfig[lojaId]) lojasExtraConfig[lojaId]={};
  lojasExtraConfig[lojaId].logoB64='';
  if(CFG.lojas_extra?.[lojaId]) CFG.lojas_extra[lojaId].logoB64='';
  const prev=document.getElementById('loja-logo-preview-'+lojaId);
  if(prev){ prev.src=''; prev.style.display='none'; }
  renderLojasBrandingUI();
}

function syncCor(v){ if(/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('cfg-cor').value=v; previewCfg(); }
function syncCor2(v){ if(/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('cfg-cor2').value=v; previewCfg(); }
function previewCfg(){
  const c=gV('cfg-cor'); const c2=gV('cfg-cor2');
  document.documentElement.style.setProperty('--c1',c);
  document.documentElement.style.setProperty('--c2',c2);
  setV('cfg-cor-txt',c); setV('cfg-cor2-txt',c2);
}

function uploadLogo(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=async e=>{
    const raw=e.target.result;
    const dataUrl=await compressImage(raw,1200,0.75);
    if(lojaAtiva && !isMainGestor()){
      // Gestor de empresa específica → salva logo na sua loja
      if(!lojasExtraConfig[lojaAtiva]) lojasExtraConfig[lojaAtiva]={};
      lojasExtraConfig[lojaAtiva].logoB64=dataUrl;
      if(!CFG.lojas_extra) CFG.lojas_extra={};
      if(!CFG.lojas_extra[lojaAtiva]) CFG.lojas_extra[lojaAtiva]={};
      CFG.lojas_extra[lojaAtiva].logoB64=dataUrl;
    } else {
      CFG.logoB64=dataUrl;
    }
    const lp=document.getElementById('logo-preview'); lp.src=dataUrl; lp.style.display='block';
  };
  r.readAsDataURL(f);
}

async function salvarEmpresa(){
  // Gestor de empresa específica → salva branding somente da sua loja
  if(lojaAtiva && !isMainGestor()){
    if(!CFG.lojas_extra) CFG.lojas_extra={};
    if(!lojasExtraConfig[lojaAtiva]) lojasExtraConfig[lojaAtiva]={};
    const dadosLoja={
      nome:    gV('cfg-nome')||'',
      sub:     gV('cfg-sub')||'',
      tagline: gV('cfg-tagline')||'',
      tel:     gV('cfg-tel')||'',
      cidades: gV('cfg-cidades')||'',
      cor:     gV('cfg-cor')||CFG.cor,
      cor2:    gV('cfg-cor2')||CFG.cor2,
      logoB64: lojasExtraConfig[lojaAtiva]?.logoB64||''
    };
    Object.keys(dadosLoja).forEach(k=>{ if(k!=='logoB64'&&!dadosLoja[k]) delete dadosLoja[k]; });
    CFG.lojas_extra[lojaAtiva]=dadosLoja;
    lojasExtraConfig[lojaAtiva]=dadosLoja;
    lsSet('empresa_cfg',JSON.stringify(CFG));
    lsSet('fluxa_lojas_extra_cfg',JSON.stringify(lojasExtraConfig));
    if(dbOk&&db){
      try{ await dbUpsert('empresa_config', {id:1,dados:CFG,updated_at:new Date().toISOString()}); }
      catch(e){ console.warn('[salvarEmpresa:loja]',e?.message||e); toast('✅ Configurações salvas localmente (sync falhou)'); atualizarHeaderLoja(); return; }
    }
    atualizarHeaderLoja();
    toast('✅ Configurações salvas!');
    return;
  }
  // Gestor principal → salva no CFG global
  CFG.nome = gV('cfg-nome')||CFG_DEF.nome;
  CFG.sub  = gV('cfg-sub');
  CFG.tagline = gV('cfg-tagline')||'';
  CFG.tel  = gV('cfg-tel');
  CFG.cidades = gV('cfg-cidades');
  CFG.cor  = gV('cfg-cor');
  CFG.cor2 = gV('cfg-cor2');
  CFG.svcs = gV('cfg-servicos').split('\n').map(s=>s.trim()).filter(Boolean);
  CFG.tecnicos = gV('cfg-tecnicos').split('\n').map(s=>s.trim()).filter(Boolean);
  const novoPin = gV('cfg-pin').trim();
  if(novoPin.length===4 && /^\d{4}$/.test(novoPin)){
    hashPIN(novoPin).then(h=>{ CFG.pin=h; lsSet('empresa_cfg',JSON.stringify(CFG)); });
  }
  CFG.notif_visita = gV('cfg-notif-visita') || CFG_DEF.notif_visita;
  CFG.notif_concluida = gV('cfg-notif-concluida') || CFG_DEF.notif_concluida;
  CFG.notif_orcamento = gV('cfg-notif-orcamento') || CFG_DEF.notif_orcamento;
  CFG.notif_garantia = gV('cfg-notif-garantia') || CFG_DEF.notif_garantia;
  // Nota Fiscal
  CFG.nfe_token_prod = gV('cfg-nfe-token-prod').trim();
  CFG.nfe_token_hom  = gV('cfg-nfe-token-hom').trim();
  CFG.nfe_cnpj       = gV('cfg-nfe-cnpj').trim();
  CFG.nfe_iss        = gV('cfg-nfe-iss')||'2.0';
  CFG.nfe_cod_svc    = gV('cfg-nfe-cod-svc')||'7.10';
  // EmailJS
  CFG.emailjs_pubkey   = gV('cfg-ejs-pubkey').trim();
  CFG.emailjs_service  = gV('cfg-ejs-service').trim();
  CFG.emailjs_template = gV('cfg-ejs-template').trim();
  lsSet('empresa_cfg',JSON.stringify(CFG));
  if(CFG.emailjs_pubkey) initEmailJS();
  if(dbOk&&db){
    try{ await dbUpsert('empresa_config', {id:1,dados:CFG,updated_at:new Date().toISOString()}); }catch(e){ console.warn('cfg sync:',e.message); toast('✅ Configurações salvas localmente (sync falhou)'); aplicarCFG(); return; }
  }
  aplicarCFG();
  toast('✅ Configurações salvas!');
}

// ──────────────────────────────────────────────────
//  SUPABASE
// ──────────────────────────────────────────────────
function setDbSt(ok, txt){
  dbOk=ok;
  const cls='db-dot '+(ok?'ok':'err');
  document.getElementById('db-dot').className=cls;
  const d2=document.getElementById('db-dot2'); if(d2) d2.className=cls;
  const t2=document.getElementById('db-txt2'); if(t2) t2.textContent=(ok?'✅ Banco conectado':'⚠️ Banco offline — salvando local');
}
async function conectarDB(url, key, mostrarErro=true){
  try{
    const {createClient}=supabase;
    db=createClient(url,key);
    const {error}=await db.from('orcamentos').select('id').limit(1);
    if(error) throw error;
    dbOk=true; setDbSt(true,'conectado'); iniciarRealtimeSync(); return true;
  }catch(e){ if(mostrarErro) console.error(e); setDbSt(false,'erro'); return false; }
}
async function salvarBD(){
  const url=gV('sb-url').trim(), key=gV('sb-key').trim();
  const msg=document.getElementById('bd-msg'), btn=document.getElementById('btn-bd');
  if(!url||!key){ msg.style.color='var(--red)'; msg.textContent='Preencha URL e chave.'; return; }
  btn.disabled=true; btn.textContent='Testando…'; msg.textContent='';
  const ok=await conectarDB(url,key,true);
  if(ok){ lsSet('sb_url',url); lsSet('sb_key',key); await carregarCFGremoto(); aplicarCFG();
    msg.style.color='var(--green)'; msg.textContent='✅ Conectado! Abrindo o app…';
    const backRow=document.getElementById('setup-back-row'); if(backRow) backRow.style.display='flex';
    setTimeout(()=>go(telaInicial()),1100);
  } else { msg.style.color='var(--red)'; msg.textContent='❌ Verifique URL e chave.'; }
  btn.disabled=false; btn.textContent='Conectar e Salvar';
}

// ──────────────────────────────────────────────────
//  NAVEGAÇÃO
// ──────────────────────────────────────────────────
/* ── SIDEBAR ── */
function initSidebar(){
  const col=localStorage.getItem('fluxa_sbar_col')==='1';
  const sb=document.getElementById('sidebar');
  if(!sb) return;
  if(col){ sb.classList.add('collapsed'); document.body.classList.add('sbar-col'); }
  else   { sb.classList.remove('collapsed'); document.body.classList.remove('sbar-col'); }
}
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  if(!sb) return;
  const isMob=window.innerWidth<=680;
  if(isMob){
    sb.classList.contains('mob-open') ? closeSidebar() : openSidebar();
  } else {
    const col=sb.classList.toggle('collapsed');
    document.body.classList.toggle('sbar-col',col);
    lsSet('fluxa_sbar_col',col?'1':'0');
  }
}
function openSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb) sb.classList.add('mob-open');
  if(ov) ov.classList.add('on');
}
function closeSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebar-overlay');
  if(sb) sb.classList.remove('mob-open');
  if(ov) ov.classList.remove('on');
}

function go(p){
  // ── Controle de acesso por perfil ──
  const _vendas  = eVendas();
  const _tecnico = eTecnico();
  const _gestor  = eGestor();
  const pagesVendas  = ['form','history','clientes','agendamentos','os'];
  const pagesTecnico = ['minhas-os','visitas','os']; // 'os' para abrir/preencher a OS atribuída
  if(_vendas  && !pagesVendas.includes(p))  { toast('Você não tem acesso a essa área.'); return; }
  if(_tecnico && !pagesTecnico.includes(p)) { toast('Você não tem acesso a essa área.'); return; }
  if(!_gestor && !_vendas && !_tecnico &&
     ['form','history','insights','empresa','usuarios','produtividade'].includes(p)){
    toast('⚠️ Acesso restrito ao Gestor'); return;
  }
  // Histórico de navegação (para o botão "← Voltar")
  const _atual = document.querySelector('.page.on')?.id?.replace('page-','');
  if(window._skipNavHist){ window._skipNavHist=false; }
  else if(_atual && _atual!==p){ window._navHist=(window._navHist||[]); window._navHist.push(_atual); if(window._navHist.length>25) window._navHist.shift(); }
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  document.getElementById('page-'+p).classList.add('on');
  document.querySelectorAll('.nb').forEach(x=>{ x.classList.remove('on'); x.removeAttribute('aria-current'); });
  const nb=document.getElementById('nb-'+p); if(nb){ nb.classList.add('on'); nb.setAttribute('aria-current','page'); }
  document.querySelectorAll('.mob-nb').forEach(x=>{ x.classList.remove('on'); x.removeAttribute('aria-current'); });
  const mnb=document.getElementById('mnb-'+p); if(mnb){ mnb.classList.add('on'); mnb.setAttribute('aria-current','page'); }
  document.querySelectorAll('.snb').forEach(x=>{ x.classList.remove('on'); x.removeAttribute('aria-current'); });
  const snb=document.getElementById('snb-'+p); if(snb){ snb.classList.add('on'); snb.setAttribute('aria-current','page'); }
  closeSidebar();
  if(p==='portal') { /* página gerenciada por checkPortalHash */ }
  if(p==='insights'){
    renderPainelInsights();
    // carrega o que o bloco "hoje" precisa e redesenha — sem isso o gestor via
    // zero recebível vencido só porque a tabela ainda não tinha sido lida
    Promise.all([
      (typeof loadRecebimentos==='function'? loadRecebimentos() : null),
      (typeof loadEstoque==='function' && !(todosProdutos||[]).length ? loadEstoque() : null),
      (typeof loadDespesas==='function' && !(todasDesp||[]).length ? loadDespesas() : null),
      (typeof loadOSHist==='function' && !(todosOS||[]).length ? loadOSHist() : null)
    ]).then(()=>{
      try{
        renderPainelHoje();
        // financeiro migrou de Produtividade para cá
        renderRelatorioFinanceiro(); renderDRE(); renderAnaliseClientes();
      }catch(e){ console.warn('[painelInsights]', e?.message||e); }
    });
  }
  if(p==='history'){ initOrcMes(); loadHist(); setTimeout(renderGraficoDash,200); }
  if(p==='form'){
    // Restaura rascunho APENAS quando se navega direto para a tela (nav/menu).
    // Nunca ao editar (abrirOrc), criar novo (novoOrc) ou duplicar — esses fluxos
    // já preencheram os campos e o rascunho antigo sobrescrevia com dados de outro orçamento.
    if(!editId && !window._skipDraftForm) restaurarRascunho('form');
    window._skipDraftForm=false;
    // Garante que o select de empresa reflete a loja ativa ao entrar na tela
    if(!editId && lojaAtiva) setV('orc-loja', lojaAtiva);
    // Garante base de clientes atualizada para o autocomplete
    carregarClientesRemoto();
  }
  if(p==='os-history') loadOSHist();
  if(p==='clientes'){
    renderClientes();
    // ⚠️ carregarClientesRemoto() e o resto abaixo rodavam em paralelo, sem se
    // esperar — o aviso de duplicata podia calcular a lista ANTES do cliente
    // mais recente chegar, e "se x já tinha algo no cache local, pula o reload"
    // fazia o mesmo com orçamento/equipamento/local se a aba já tinha visitado
    // outra tela antes. Resultado real: a limpeza "terminava" e sobrava mais.
    // Agora tudo é esperado, sempre, antes de calcular o que é seguro apagar.
    (async()=>{
      await carregarClientesRemoto();
      if(typeof loadHist==='function') await loadHist();
      if(typeof loadEquipamentos==='function') await loadEquipamentos();
      if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
      try{ renderAvisoIdentidade(); }catch(e){ console.warn('[avisoIdentidade]',e?.message||e); }
      try{ renderAvisoDuplicatas(); }catch(e){ console.warn('[avisoDuplicatas]',e?.message||e); } })();
    // Não faz parte da checagem de duplicata — só precisa estar pronto antes
    // do gestor abrir "📋 Hist." de algum cliente, então não bloqueia o resto.
    if(typeof loadVendasBalcao==='function') loadVendasBalcao();
  }
  if(p==='empresa') preencherFormEmpresa();
  if(p==='equipamentos'){ loadEquipamentos(); if(typeof loadPiscinas==='function') loadPiscinas(); setTimeout(renderEqImport,400); }
  if(p==='agendamentos'){ loadAgendamentos(); populaTecSelects(); initCal(); renderCal(); }
  if(p==='identidade') loadIdentidade();
  if(p==='recebiveis') loadRecebiveisPage();
  if(p==='despesas'){ loadDespesas(); setTimeout(renderAvisoRecorrentes,300); }
  if(p==='estoque'){ loadEstoque(); setTimeout(renderIndicadoresEstoque,400); }
  if(p==='produtividade') loadProdutividade();   // financeiro migrou para Insights
  if(p==='usuarios') loadUsuarios();
  if(p==='auditoria') loadAuditoria();
  if(p==='minhas-os') loadMinhasOS();
  if(p==='visitas'){
    initVisitas();
    // Todos os perfis caem direto na aba Locais (acompanhamento mensal)
    // "Nova Vistoria" fica acessível pela aba, mas não é a tela inicial
    visTab('locais');
    // Vistoria interrompida (tela apagou / app fechou)? Restaura e volta p/ o form
    if(typeof _restaurarRascunhoVis==='function') _restaurarRascunhoVis();
    // Sincroniza com o banco AO ENTRAR na tela (não só no 🔄 manual): o sync do
    // boot roda ANTES do login e filtra no escopo errado — vistorias feitas em
    // outro aparelho não apareciam (caso Bruno/Aquamotor: contador em 0).
    (async()=>{ try{
      if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
      if(typeof loadVistoriasRemoto==='function') await loadVistoriasRemoto();
      // Rascunho na NUVEM mais novo que o local (celular trocado/quebrado)? Restaura.
      if(typeof _restaurarRascunhoNuvem==='function') await _restaurarRascunhoNuvem();
      renderLocaisTab(); renderVisHistorico();
    }catch(e){ console.warn('[go visitas sync]', e?.message||e); } })();
  }
  // Atualiza técnicos disponíveis quando abre form de OS
  if(p==='os'){
    if(!osEditId) restaurarRascunho('os'); // não restaura draft quando editando OS existente
    // A-04: pré-preenche data de hoje se vazio
    const osDataEl=document.getElementById('os-data');
    if(osDataEl && !osDataEl.value) osDataEl.value=_hojeLocal();
    const l=gV('os-loja')||LOJA_PADRAO_ID;
    atualizarTecsPorLoja(l,'os-tec');
    atualizarTecsPorLoja(l,'os-tec-checkin');
    // Técnico: oculta o valor financeiro (não precisa ver preço)
    const totalWrap = document.getElementById('os-total')?.closest('.fl');
    if(totalWrap) totalWrap.style.display = eTecnico() ? 'none' : '';
    // Painel de itens a validar/baixar (se a OS vier de um orçamento com produtos)
    if(typeof atualizarPainelItensOS==='function') atualizarPainelItensOS();
    // Vendas: oculta seções técnicas (check-in, checklist, fotos, detalhes)
    const soVendas = eVendas();
    ['os-checkin-card'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.display=soVendas?'none':'';
    });
    // Checklist e fotos (cards filhos do wrap da OS)
    document.querySelectorAll('#page-os .card').forEach(c=>{
      const titulo=c.querySelector('.ct');
      if(!titulo) return;
      const txt=titulo.textContent||'';
      if(soVendas && (txt.includes('Checklist')||txt.includes('Fotos')||txt.includes('Detalhes Técnicos'))){
        c.style.display='none';
      } else {
        c.style.display='';
      }
    });
  }
}

// Voltar para a página anterior (histórico de navegação); fallback por perfil
function voltar(){
  const atual=document.querySelector('.page.on')?.id?.replace('page-','');
  const hist=window._navHist||[];
  let dest=hist.pop();
  while(dest && dest===atual) dest=hist.pop(); // não volta pra própria página
  window._navHist=hist;
  if(!dest) dest = eTecnico()?'minhas-os':eVendas()?'form':'history';
  window._skipNavHist=true; // não re-empilha ao voltar
  go(dest);
}

// Gear dropdown
function toggleGear(){
  const m=document.getElementById('gear-menu');
  m.style.display=m.style.display==='none'?'block':'none';
}
function closeGear(){ document.getElementById('gear-menu').style.display='none'; }
// Fechar gear ao clicar fora
document.addEventListener('click',e=>{ if(!e.target.closest('.gear-wrap')) closeGear(); });

function toggleOsCard(){
  const on=document.getElementById('toggle-os')?.checked;
  const fields=document.getElementById('os-inline-fields');
  if(fields) fields.style.display=on?'block':'none';
}

async function criarOSjunto(dados, orcNum){
  const data=document.getElementById('os-inline-data')?.value||dados.dataSvc||'';
  const hora=document.getElementById('os-inline-hora')?.value||'08:00';
  const tec=document.getElementById('os-inline-tec')?.value||CFG.nome;
  // Preserva produto_id para que a entrega de estoque via OS funcione corretamente
  const osSvcsData=dados.svcs.map(s=>({desc:s.desc||s.d||'',produto_id:s.produto_id||null,qty:s.qty||1,precoUnit:parseFloat(s.p||s.preco||0)||0}));
  let numStr='???';
  try{
    if(dbOk&&db){
      const {data:insOS}=await dbInsertNumerado('ordens_servico',{
        orcamento_id:editId||null, cliente:dados.cli,
        local_servico:dados.loc, data_servico:data, hora, tecnico:tec,
        servicos:osSvcsData, materiais:'', obs_tecnica:'', total:dados.tot, status:'agendado'
      });
      const num=insOS?.numero||1;
      numStr=String(num).padStart(3,'0');
    }else{
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',n); numStr=String(n).padStart(3,'0');
    }
    // Preenche ambos docs e imprime juntos
    const numOrcStr=String(orcNum||0).padStart(3,'0');
    preencherDocOrc(dados, numOrcStr);
    const osDados={ cli:dados.cli, loc:dados.loc, data, hora, tec, tot:dados.tot, mat:'', obs:'', svcs:osSvcsData, loja_id:dados.loja_id||LOJA_PADRAO_ID };
    preencherDocOS(osDados, numStr);
    imprimirDoc('both');
  }catch(e){ console.error('criarOSjunto:',e); toast('⚠️ Erro ao gerar OS: '+e.message); }
}

// ══════════════════════════════════════════════════════════════════════
//  CONTAS A RECEBER  (tabela `recebimentos`, uma linha por parcela)
//  Antes, o recebimento era UM número escalar em orcamentos.valor_recebido:
//  sem vencimento, sem data de pagamento, sem linha por parcela — logo, sem
//  aging, sem prazo médio, sem inadimplência e sem projeção de caixa.
//
//  ⚠️ Por que NÃO gero as parcelas sozinho a partir de pag_cod/pag_parcelas:
//  medido em 07/08 nos 88 aprovados — 33 sem pag_cod, 30 "A combinar", só 2 com
//  código real; e o pag_parcelas=2 da maioria é o DEFAULT do formulário
//  (`parseInt(gV('pag-parcelas'))||2`), não uma decisão de ninguém. Gerar a
//  partir disso criaria ~176 cobranças com vencimento inventado. Por isso o dado
//  é capturado na aprovação, o único momento em que alguém sabe a resposta.
//  `orcamentos.valor_recebido` continua intacto — o histórico depende dele.
// ══════════════════════════════════════════════════════════════════════
let todosReceb = [];
function lsRecebLer(){ try{ return JSON.parse(ls('fluxa_recebimentos')||'[]'); }catch(e){ return []; } }
function lsRecebSalvar(l){ lsSet('fluxa_recebimentos', JSON.stringify(l)); }

// _addDias fica definida mais abaixo (perto de _hojeISO) — havia duas
// declarações com o mesmo nome; a de baixo sempre venceu por hoisting, e esta
// aqui era código morto que nunca rodou. Removida para não confundir quem for
// mexer no bloco de recebíveis achando que está editando a versão em uso.
function _dataBR(iso){ const p=String(iso||'').split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):(iso||''); }

// PURA — só parâmetros, sem DOM e sem banco (por isso dá para testar isolada).
// Trabalha em centavos e joga o resto na ÚLTIMA parcela, para a soma bater exato.
function gerarParcelas(o){
  const tot=Math.round((parseFloat(o&&o.total)||0)*100);
  const modo=(o&&o.modo)||'avista';
  if(tot<=0 || modo==='depois') return [];
  const venc=(o&&o.primeiroVenc)||_hojeLocal();
  const intv=parseInt(o&&o.intervalo)||30;
  if(modo==='avista') return [{parcela_n:1, parcelas_total:1, vencimento:venc, valor:tot/100}];

  const qtd=Math.max(1, parseInt(o&&o.n)||1);
  let ent=0, resto=tot;
  if(modo==='entrada'){
    ent=Math.round((parseFloat(o&&o.entrada)||0)*100);
    if(ent<=0) return gerarParcelas({total:o.total, modo:'parcelado', n:qtd, primeiroVenc:venc, intervalo:intv});
    if(ent>=tot) return [{parcela_n:1, parcelas_total:1, vencimento:venc, valor:tot/100}];
    resto=tot-ent;
  }
  const base=Math.floor(resto/qtd);
  const totalLinhas=qtd+(ent>0?1:0);
  const out=[];
  if(ent>0) out.push({parcela_n:1, parcelas_total:totalLinhas, vencimento:venc, valor:ent/100});
  for(let i=0;i<qtd;i++){
    const v = (i===qtd-1) ? (resto-base*(qtd-1)) : base;
    out.push({ parcela_n:out.length+1, parcelas_total:totalLinhas,
      vencimento:_addDias(venc, intv*(ent>0 ? i+1 : i)), valor:v/100 });
  }
  return out;
}

function _perguntarRecebimento(orc){
  if(!orc) return;
  const tot=parseFloat(orc.total)||0;
  if(tot<=0){ _perguntarCriarOS(orc); return; }
  document.getElementById('receb-orc-id').value=orc.id;
  document.getElementById('receb-titulo').textContent='Orçamento #'+String(orc.numero||'?').padStart(3,'0')+' aprovado!';
  document.getElementById('receb-total').textContent=brl(tot);
  setV('receb-modo','avista'); setV('receb-n','2'); setV('receb-entrada','');
  setV('receb-intervalo','30'); setV('receb-venc',_hojeLocal());
  const f=(orc.pag_cod||'').trim();
  setV('receb-forma', /combinar/i.test(f) ? '' : f);
  _recebPreview();
  document.getElementById('receb-bg').classList.add('on');
}
function fecharReceb(){ document.getElementById('receb-bg').classList.remove('on'); }

function _recebPreviewParcelas(){
  const orc=(todosOrc||[]).find(o=>String(o.id)===String(gV('receb-orc-id')));
  return gerarParcelas({ total: orc?orc.total:0, modo:gV('receb-modo'), n:gV('receb-n'),
    entrada:gV('receb-entrada'), primeiroVenc:gV('receb-venc'), intervalo:gV('receb-intervalo') });
}
function _recebPreview(){
  const modo=gV('receb-modo');
  const mostra=(id,v)=>{ const e=document.getElementById(id); if(e) e.style.display=v?'':'none'; };
  mostra('receb-wrap-entrada', modo==='entrada');
  mostra('receb-wrap-n', modo==='parcelado'||modo==='entrada');
  mostra('receb-wrap-int', modo==='parcelado'||modo==='entrada');
  const campos=document.getElementById('receb-campos'); if(campos) campos.style.display = modo==='depois'?'none':'';
  const lbl=document.getElementById('receb-lbl-venc');
  if(lbl) lbl.textContent = modo==='avista' ? 'Vencimento' : (modo==='entrada'?'Data da entrada':'1º vencimento');
  const btn=document.getElementById('receb-btn'), pv=document.getElementById('receb-preview');
  if(modo==='depois'){
    if(btn) btn.textContent='Deixar em aberto';
    if(pv) pv.innerHTML='<span style="color:var(--gray)">Nada é cobrado agora. Dá para registrar depois, pelo histórico.</span>';
    return;
  }
  if(btn) btn.textContent='💰 Registrar';
  const ps=_recebPreviewParcelas();
  if(pv) pv.innerHTML = ps.length
    ? ps.map(p=>'<div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--gray-light);padding:3px 0">'+
        '<span>'+(p.parcelas_total>1?p.parcela_n+'/'+p.parcelas_total+' · ':'')+_dataBR(p.vencimento)+'</span>'+
        '<strong style="color:var(--c2)">'+brl(p.valor)+'</strong></div>').join('')
      + '<div style="display:flex;justify-content:space-between;padding-top:5px;font-weight:700"><span>Total</span><span>'+brl(ps.reduce((a,p)=>a+p.valor,0))+'</span></div>'
    : '<span style="color:var(--gray)">Informe o valor.</span>';
}

function pularRecebimento(){
  const orc=(todosOrc||[]).find(o=>String(o.id)===String(gV('receb-orc-id')));
  fecharReceb();
  setTimeout(()=>{ if(orc) _perguntarCriarOS(orc); }, 200);
}

async function salvarRecebimento(){
  const orc=(todosOrc||[]).find(o=>String(o.id)===String(gV('receb-orc-id')));
  if(!orc){ toast('⚠️ Orçamento não encontrado'); fecharReceb(); return; }
  if(gV('receb-modo')==='depois'){ pularRecebimento(); return; }
  const ps=_recebPreviewParcelas();
  if(!ps.length){ toast('⚠️ Confira os valores'); return; }
  const forma=(gV('receb-forma')||'').trim();
  if(!forma){ avisarCampoObrigatorio('receb-forma','Informe a forma de pagamento — sem ela o financeiro não separa boleto de pix de cartão, e nenhuma reconciliação bancária é possível depois.'); return; }
  const lj=orc.loja_id||lojaAtiva||LOJA_PADRAO_ID;
  const linhas=ps.map((p,i)=>({
    id:'rec_'+Date.now()+'_'+i+'_'+Math.random().toString(36).slice(2,6),
    orcamento_id:orc.id, loja_id:lj,
    parcela_n:p.parcela_n, parcelas_total:p.parcelas_total,
    vencimento:p.vencimento, valor:p.valor,
    data_pagamento:null, forma:forma||null, obs:null, origem:'aprovacao'
  }));
  // Local-first, igual ao resto do app. Regravar substitui as parcelas antigas
  // deste orçamento — evita duplicar se a pessoa aprovar, reverter e reaprovar.
  todosReceb=[...linhas, ...todosReceb.filter(r=>String(r.orcamento_id)!==String(orc.id))];
  lsRecebSalvar(todosReceb);
  fecharReceb();
  toast('✅ '+linhas.length+' parcela'+(linhas.length>1?'s':'')+' registrada'+(linhas.length>1?'s':''));
  if(document.getElementById('page-recebiveis')?.classList.contains('on')) renderRecebiveis();
  setTimeout(()=>_perguntarCriarOS(orc), 250);
  if(dbOk&&db){
    for(const l of linhas){
      try{ await dbInsert('recebimentos', l); }catch(e){ console.warn('[receb sync]', e?.message||e); }
    }
  }
}

// ── Limpa as parcelas de um orçamento que deixou de ser uma venda ──────────
// Excluir o orçamento, tirá-lo de "aprovado" ou recusá-lo no portal invalida
// o que estava A RECEBER — e não existia nenhum delete de recebimentos no
// app, então essas parcelas ficavam órfãs contando dinheiro de uma venda que
// não existe mais (só aparece quando alguém soma o aging).
// Parcela já PAGA é mantida de propósito: é registro de dinheiro que entrou;
// se o orçamento sumiu, isso é um problema para uma pessoa olhar, não para o
// código resolver sozinho apagando em silêncio.
async function _limparRecebDoOrc(orcId, contexto){
  const doOrc=(todosReceb||[]).filter(r=>String(r.orcamento_id)===String(orcId));
  if(!doOrc.length) return;
  const pagas=doOrc.filter(r=>r.data_pagamento);
  const aRemover=doOrc.filter(r=>!r.data_pagamento);
  if(aRemover.length){
    const ids=new Set(aRemover.map(r=>r.id));
    todosReceb=(todosReceb||[]).filter(r=>!ids.has(r.id));
    lsRecebSalvar(todosReceb);
    if(dbOk&&db){
      try{ await db.from('recebimentos').delete().in('id', [...ids]); }
      catch(e){ console.warn('[receb limpar]', e?.message||e); }
    }
    logAcao('receb_removido', `orc ${orcId} · ${aRemover.length} parcela(s) · ${contexto||''}`);
  }
  if(pagas.length){
    const soma=pagas.reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
    toast(`⚠️ ${pagas.length} parcela(s) já paga(s) — ${brl(soma)} — foram mantidas`);
  } else if(aRemover.length){
    toast(`↩️ ${aRemover.length} parcela(s) a receber removida(s)`);
  }
  if(typeof renderRecebiveis==='function' && document.getElementById('page-recebiveis')?.classList.contains('on')) renderRecebiveis();
}

async function loadRecebimentos(){
  todosReceb = lsRecebLer();
  if(dbOk&&db){
    try{
      const {data}=await db.from('recebimentos').select('*').order('vencimento',{ascending:true}).limit(3000);
      if(data){
        const ids=new Set(data.map(r=>r.id));
        todosReceb=[...data, ...todosReceb.filter(r=>!ids.has(r.id))];
        lsRecebSalvar(todosReceb);
      }
    }catch(e){ console.warn('[loadRecebimentos]', e?.message||e); }
  }
}

// ── Painel de recebíveis: aging, prazo médio e baixa ──────────────────
// A tabela só vira indicador quando alguém marca o que entrou. Sem a baixa,
// tudo vira "vencido" e o número perde sentido — por isso a ação de marcar é
// o elemento mais visível da tela.
let _recebFiltro='aberto';
const _RECEB_FILTROS=[['aberto','Em aberto'],['vencido','Vencido'],['hoje','Vence hoje'],
                      ['semana','Próx. 7 dias'],['pago','Recebido'],['todos','Todos']];

function _recebDoDia(){ return _hojeLocal(); }
function _recebDiasAtraso(r){
  if(r.data_pagamento) return 0;
  const h=_recebDoDia();
  if(!r.vencimento) return 0;
  return Math.round((new Date(h+'T00:00:00') - new Date(r.vencimento+'T00:00:00'))/86400000);
}
// Escopo por loja: usa o mesmo filtro do resto do app, para "Todas" não
// misturar Aquamotor com Forthemp.
function _recebVisiveis(){ return filtrarPorLoja(todosReceb||[]); }

function _recebClassifica(r){
  if(r.data_pagamento) return 'pago';
  const d=_recebDiasAtraso(r);
  if(d>0) return 'vencido';
  if(d===0) return 'hoje';
  if(d>=-7) return 'semana';
  return 'futuro';
}
function _recebFiltrar(lista){
  if(_recebFiltro==='todos') return lista;
  if(_recebFiltro==='aberto') return lista.filter(r=>!r.data_pagamento);
  return lista.filter(r=>_recebClassifica(r)===_recebFiltro);
}

// Prazo médio de recebimento: dias entre vencimento e pagamento efetivo.
// Só conta parcela paga — senão o número mede espera, não desempenho.
function _recebPMR(lista){
  const pagas=lista.filter(r=>r.data_pagamento&&r.vencimento);
  if(!pagas.length) return null;
  const soma=pagas.reduce((a,r)=>a+Math.round(
    (new Date(r.data_pagamento+'T00:00:00')-new Date(r.vencimento+'T00:00:00'))/86400000),0);
  return Math.round(soma/pagas.length);
}

function _orcDoReceb(r){ return (todosOrc||[]).find(o=>String(o.id)===String(r.orcamento_id)); }

// ── Buraco na captura de recebimento ──────────────────────────────────────
// _perguntarRecebimento só é chamado dentro de mudarSt() (aprovação pela
// equipe). Aprovação pelo portal (aprovarOrcPortal) e "Pular" no modal
// (pularRecebimento) deixam o orçamento aprovado sem NENHUMA parcela — e sem
// isto, o buraco é invisível: o painel só lista parcelas que já existem.
// Não gero as parcelas sozinho aqui pelo mesmo motivo do resto do módulo
// (comentário acima de gerarParcelas): pag_cod não é confiável na maioria dos
// casos. Em vez disso, ABRE a lacuna para alguém decidir — o mesmo modal que
// a aprovação manual já usa.
function _orcAprovadosSemReceb(){
  const comReceb=new Set((todosReceb||[]).map(r=>String(r.orcamento_id)));
  return filtrarPorLoja(todosOrc||[])
    .filter(o=>o.status==='aprovado' && (parseFloat(o.total)||0)>0 && !comReceb.has(String(o.id)))
    .sort((a,b)=>String(b.data_aprovacao||b.data_criacao||'').localeCompare(String(a.data_aprovacao||a.data_criacao||'')));
}
function _renderRecebGap(){
  const card=document.getElementById('receb-gap-card'); if(!card) return;
  const lista=_orcAprovadosSemReceb();
  if(!lista.length){ card.style.display='none'; return; }
  card.style.display='';
  const total=lista.reduce((a,o)=>a+(parseFloat(o.total)||0),0);
  const cnt=document.getElementById('receb-gap-contagem');
  if(cnt) cnt.textContent=`${lista.length} orçamento${lista.length!==1?'s':''} · ${brl(total)}`;
  const el=document.getElementById('receb-gap-lista'); if(!el) return;
  el.innerHTML=lista.map(o=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-light);flex-wrap:wrap">
      <div style="flex:1;min-width:150px">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(o.cliente||'—')}</div>
        <div style="font-size:11px;color:var(--gray)">#${String(o.numero||'?').padStart(3,'0')} · aprovado em ${_dataBR(String(o.data_aprovacao||o.data_criacao||'').slice(0,10))}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div style="font-size:14px;font-weight:700;color:var(--c2)">${brl(parseFloat(o.total)||0)}</div>
        <button class="tb g" style="font-size:11px;margin-top:3px;font-weight:700" onclick="_perguntarRecebimento(todosOrc.find(x=>String(x.id)==='${o.id}'))">💰 Lançar</button>
      </div>
    </div>`).join('');
}

function renderRecebiveis(){
  _renderRecebGap();
  const todas=_recebVisiveis();
  const abertas=todas.filter(r=>!r.data_pagamento);
  const venc=abertas.filter(r=>_recebDiasAtraso(r)>0);
  const hoje=abertas.filter(r=>_recebDiasAtraso(r)===0);
  const soma=l=>l.reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
  const pmr=_recebPMR(todas);

  const kpis=document.getElementById('receb-kpis');
  if(kpis) kpis.innerHTML=
    `<div class="dc o"><div class="dl">A receber</div><div class="dv">${brl(soma(abertas))}</div><div class="ds">${abertas.length} parcela${abertas.length!==1?'s':''}</div></div>`+
    `<div class="dc ${venc.length?'r':'g'}"><div class="dl">Vencido</div><div class="dv" style="${venc.length?'color:var(--red)':''}">${brl(soma(venc))}</div><div class="ds">${venc.length} parcela${venc.length!==1?'s':''}</div></div>`+
    `<div class="dc y"><div class="dl">Vence hoje</div><div class="dv">${brl(soma(hoje))}</div><div class="ds">${hoje.length} parcela${hoje.length!==1?'s':''}</div></div>`+
    `<div class="dc b"><div class="dl">Prazo médio</div><div class="dv">${pmr===null?'—':(pmr>0?'+':'')+pmr+'d'}</div><div class="ds">${pmr===null?'nada recebido ainda':(pmr>0?'depois do vencimento':'em dia ou adiantado')}</div></div>`;

  const fl=document.getElementById('receb-filtros');
  if(fl) fl.innerHTML=_RECEB_FILTROS.map(([k,rot])=>{
    const qtd = k==='todos'?todas.length
      : k==='aberto'?abertas.length
      : todas.filter(r=>_recebClassifica(r)===k).length;
    return `<button class="tb${_recebFiltro===k?' g':''}" onclick="_recebSetFiltro('${k}')"${_recebFiltro===k?' style="font-weight:700"':''}>${rot} ${qtd}</button>`;
  }).join('');

  const lista=_recebFiltrar(todas).sort((a,b)=>String(a.vencimento||'').localeCompare(String(b.vencimento||'')));
  const cont=document.getElementById('receb-contagem');
  if(cont) cont.textContent=lista.length?`· ${lista.length} de ${todas.length}`:'';
  const el=document.getElementById('receb-lista');
  if(!el) return;
  if(!lista.length){
    el.innerHTML=`<div class="empty-st"><div class="ei">💰</div><p>${
      todas.length? 'Nada nesta situação.' :
      'Nenhuma parcela ainda. Elas nascem ao aprovar um orçamento, quando você informa como vai receber.'}</p></div>`;
    return;
  }
  el.innerHTML=lista.map(r=>{
    const o=_orcDoReceb(r);
    const cls=_recebClassifica(r);
    const d=_recebDiasAtraso(r);
    const cor = cls==='pago'?'var(--green)' : cls==='vencido'?'var(--red)' : cls==='hoje'?'var(--yellow)':'var(--gray)';
    const sit = cls==='pago' ? `recebido em ${_dataBR(r.data_pagamento)}`
      : cls==='vencido' ? `${d} dia${d!==1?'s':''} em atraso`
      : cls==='hoje' ? 'vence hoje' : `vence em ${Math.abs(d)} dia${Math.abs(d)!==1?'s':''}`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-light);flex-wrap:wrap">
      <div style="width:4px;align-self:stretch;border-radius:2px;background:${cor};min-height:34px"></div>
      <div style="flex:1;min-width:150px">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(o?.cliente||'(orçamento removido)')}</div>
        <div style="font-size:11px;color:var(--gray)">
          ${o?'#'+String(o.numero||'?').padStart(3,'0')+' · ':''}${r.parcelas_total>1?`parcela ${r.parcela_n}/${r.parcelas_total} · `:''}${_dataBR(r.vencimento)}
          ${r.forma?' · '+esc(r.forma):''}
        </div>
        <div style="font-size:11px;font-weight:700;color:${cor}">${sit}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div style="font-size:15px;font-weight:700;color:var(--c2)">${brl(parseFloat(r.valor)||0)}</div>
        ${r.data_pagamento
          ? `<button class="tb" style="font-size:11px;margin-top:3px" onclick="desmarcarRecebido('${r.id}')">↩ desfazer</button>`
          : `<button class="tb g" style="font-size:11px;margin-top:3px;font-weight:700" onclick="marcarRecebido('${r.id}')">✓ Recebi</button>`}
      </div>
    </div>`;
  }).join('');
}
function _recebSetFiltro(k){ _recebFiltro=k; renderRecebiveis(); }

async function marcarRecebido(id){
  const r=(todosReceb||[]).find(x=>String(x.id)===String(id));
  if(!r) return;
  r.data_pagamento=_hojeLocal();
  lsRecebSalvar(todosReceb);
  renderRecebiveis();
  toast(`✅ ${brl(parseFloat(r.valor)||0)} recebido`);
  logAcao('receb_baixa', `${brl(parseFloat(r.valor)||0)} · ${_orcDoReceb(r)?.cliente||''}`);
  if(dbOk&&db){
    try{ await dbUpdate('recebimentos', {data_pagamento:r.data_pagamento}, 'id', r.id); }
    catch(e){ console.warn('[marcarRecebido]', e?.message||e); toast('⚠️ Salvo aqui, mas não sincronizou'); }
  }
}
async function desmarcarRecebido(id){
  const r=(todosReceb||[]).find(x=>String(x.id)===String(id));
  if(!r) return;
  r.data_pagamento=null;
  lsRecebSalvar(todosReceb);
  renderRecebiveis();
  if(dbOk&&db){
    try{ await dbUpdate('recebimentos', {data_pagamento:null}, 'id', r.id); }
    catch(e){ console.warn('[desmarcarRecebido]', e?.message||e); }
  }
}

async function loadRecebiveisPage(){
  await loadRecebimentos();
  if(!(todosOrc||[]).length && typeof loadHist==='function') await loadHist();
  renderRecebiveis();
}

// ══════════════════════════════════════════════════════════════════════
//  IDENTIDADE DO CLIENTE — confirmação assistida (fase 3 do roadmap)
//  `orcamentos.cliente` é texto livre: 216 nomes para 141 fichas, e nenhum
//  orçamento aponta para uma ficha. Sem isso não há LTV, recompra, ABC de
//  cliente nem base instalada.
//
//  ⚠️ Por que NÃO é automático (medido pela outra sessão em 07/08):
//   • CNPJ é da ADMINISTRADORA — 5 CNPJs são compartilhados por condomínios
//     diferentes (Torre de Esmeralda / Villa Di Mare / Villa dos Corais).
//   • Telefone é do SÍNDICO — 4 telefones aparecem em clientes distintos.
//   • "Infinity Coast", "Infinity Paradise" e "Infinity Flat" são condomínios
//     DIFERENTES: nome parecido não é o mesmo cliente.
//  Casar por qualquer um desses funde clientes distintos, e o erro fica
//  invisível depois. Por isso a tela sugere e a pessoa decide.
// ══════════════════════════════════════════════════════════════════════
let _identFiltro='pendente';
function _identNorm(t){ return _normNome? _normNome(t) : String(t||'').trim().toLowerCase(); }

// Agrupa os orçamentos por nome digitado, dentro do escopo de loja atual.
function _identGrupos(){
  const orcs=filtrarPorLoja(todosOrc||[]);
  const map=new Map();
  orcs.forEach(o=>{
    const nome=(o.cliente||'').trim();
    if(!nome) return;
    const k=_identNorm(nome);
    if(!map.has(k)) map.set(k,{chave:k, nomes:new Set(), orcs:[], valor:0, ligados:0});
    const g=map.get(k);
    g.nomes.add(nome); g.orcs.push(o); g.valor+=parseFloat(o.total)||0;
    if(o.cliente_id) g.ligados++;
  });
  return [...map.values()].map(g=>{
    const nomes=[...g.nomes];
    const ficha=_identSugerir(nomes);
    return {...g, nomes, ficha,
      estado: g.ligados===g.orcs.length ? 'ok' : (g.ligados>0 ? 'parcial' : 'pendente')};
  }).sort((a,b)=>b.valor-a.valor);
}

// Sugestão: só nome idêntico depois de normalizar, ou idêntico sem a palavra de
// tipo (condomínio/edifício/residencial). Nada de distância de edição — foi o
// que fez "Bella Vista" casar com "Bella Citta" no relatório, e são prédios
// diferentes.
const _IDENT_TIPOS=/^(condominio|condomínio|cond\.?|edificio|edifício|ed\.?|residencial|resid\.?|torre|villa|vila)\s+/i;
// Chaves de comparação de um nome: o nome inteiro E o nome sem a palavra de tipo.
// Comparar só núcleo com núcleo errava "Condominio Villa dos Corais" × ficha
// "Villa dos Corais": o regex tirava "Villa" do segundo também, sobrando
// "dos corais", e os dois deixavam de casar. Cruzando as duas chaves de cada
// lado, basta UMA coincidir.
function _identChaves(n){
  const full=_identNorm(n);
  const sem=_identNorm(String(n||'').replace(_IDENT_TIPOS,''));
  return sem && sem!==full ? [full, sem] : [full];
}
function _identCasa(a,b){
  const ka=_identChaves(a), kb=_identChaves(b);
  return ka.some(x=>x && kb.includes(x));
}
// Distância de edição só para SUGERIR conferência — nunca para ligar sozinho.
// "Bella Vista" × "Bella Citta" e "Infinity Coast" × "Infinity Flat" são
// prédios diferentes com nome parecido; por isso isto vira aviso, não ação.
function _identParecido(a,b){
  const x=_identNorm(a), y=_identNorm(b);
  if(!x||!y||Math.abs(x.length-y.length)>3) return 0;
  const m=x.length, n=y.length; let prev=[...Array(n+1).keys()], cur=[];
  for(let i=1;i<=m;i++){ cur=[i];
    for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(x[i-1]===y[j-1]?0:1));
    prev=cur;
  }
  return 1 - prev[n]/Math.max(m,n);
}
function _identSugerir(nomes){
  const cli=lsCliLer()||[];   // o app guarda clientes no localStorage, não em global
  for(const n of nomes){
    const alvo=_identNorm(n);
    const ex=cli.filter(c=>_identNorm(c.nome)===alvo);
    if(ex.length===1) return {id:ex[0].id, nome:ex[0].nome, conf:'exato', motivo:'nome idêntico'};
    if(ex.length>1)  return {conf:'duplicada', motivo:`${ex.length} fichas com esse mesmo nome`, fichas:ex};
  }
  for(const n of nomes){
    const pr=cli.filter(c=>_identCasa(c.nome, n));
    if(pr.length===1) return {id:pr[0].id, nome:pr[0].nome, conf:'provavel', motivo:'igual sem a palavra de tipo'};
    if(pr.length>1)  return {conf:'duplicada', motivo:`${pr.length} fichas equivalentes`, fichas:pr};
  }
  // Nada casou: procura o mais parecido só para a pessoa conferir
  let melhor=null, score=0;
  for(const n of nomes) for(const c of cli){
    const sc=_identParecido(c.nome, n);
    if(sc>score){ score=sc; melhor=c; }
  }
  if(melhor && score>=0.82)
    return {conf:'conferir', id:melhor.id, nome:melhor.nome, score,
            motivo:`parecido com "${melhor.nome}" (${Math.round(score*100)}%) — confira, nome parecido não é o mesmo cliente`};
  return {conf:'nenhum', motivo:'não existe ficha — criar'};
}

function _identFiltrar(gs){
  if(_identFiltro==='todos') return gs;
  if(_identFiltro==='pendente') return gs.filter(g=>g.estado!=='ok');
  if(_identFiltro==='decidir')  return gs.filter(g=>g.estado!=='ok' && ['duplicada','nenhum'].includes(g.ficha.conf));
  if(_identFiltro==='variante') return gs.filter(g=>g.nomes.length>1);
  return gs.filter(g=>g.estado==='ok');
}

// Aviso de identidade dentro de Clientes. A tela de Identidade é uma TAREFA de
// limpeza, não uma seção — ter "Clientes" e "Identidade" lado a lado no menu
// fazia parecer que eram dois cadastros diferentes. Agora ela aparece aqui
// enquanto houver o que ligar, e some sozinha quando acabar.
function renderAvisoIdentidade(){
  const el=document.getElementById('cli-identidade-aviso'); if(!el) return;
  const orcs=filtrarPorLoja(todosOrc||[]).filter(o=>(o.cliente||'').trim());
  const semFicha=orcs.filter(o=>!o.cliente_id);
  if(!semFicha.length){ el.style.display='none'; return; }
  const valor=semFicha.reduce((a,o)=>a+(parseFloat(o.total)||0),0);
  const nomes=new Set(semFicha.map(o=>_identNorm(o.cliente))).size;
  el.style.display='';
  el.innerHTML=`<div class="card" style="border-left:3px solid var(--yellow);background:#fffbeb;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:4px">
      ${semFicha.length} orçamento${semFicha.length!==1?'s':''} sem ficha de cliente</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
      ${nomes} nome${nomes!==1?'s':''} diferente${nomes!==1?'s':''} · ${brl(valor)} que não entra no histórico do cliente.
      O nome vem digitado no orçamento e não está ligado a nenhuma ficha daqui.</div>
    <button class="tb g" style="font-weight:700" onclick="go('identidade')">🪪 Ligar às fichas</button>
  </div>`;
}

// Fichas de cliente clonadas por engano — achado real de 08/08–08/10: uma
// sessão criou ficha nova em vez de reusar a existente, gerando até 13 cópias
// idênticas do mesmo condomínio. Só entra aqui quem é clone PURO: mesmo nome,
// mesmo endereço, mesmo telefone/CNPJ, e no máximo 1 das cópias com algum
// orçamento/OS/vistoria vinculado (essa é sempre a mantida). Nome com dado
// divergente entre as cópias (ex: dois "Gabriel" com telefones diferentes)
// fica de fora de propósito — pode ser gente diferente, não é decisão de código.
function _dupGrupos(){
  const cli=lsCliLer()||[];
  const orcs=todosOrc||[], osArr=todosOS||[], vis=(typeof lsVisLer==='function')?lsVisLer():[];
  // ⚠️ clientes.id é referenciado por MAIS de 3 tabelas — a checagem original só
  // olhava orçamento/OS/vistoria e deixava passar ficha em uso por equipamento
  // (base instalada) ou local de vistoria. Achado ao conferir o schema antes de
  // liberar a exclusão em massa: setup.sql tem `equipamentos.cliente_id` e
  // `locais_vistoria.cliente_id`, nenhum dos dois cobertos aqui até agora.
  const eqs=(typeof lsEqLer==='function')?lsEqLer():[];
  const locs=(typeof locaisVistoria!=='undefined')?locaisVistoria:[];
  const usado=id => orcs.some(o=>String(o.cliente_id)===String(id)) || osArr.some(o=>String(o.cliente_id)===String(id)) || vis.some(v=>String(v.cliente_id)===String(id))
    || eqs.some(e=>String(e.cliente_id)===String(id)) || (locs||[]).some(l=>String(l.cliente_id)===String(id));
  const grupos=[];
  const processados=new Set(); // ids já decididos por qualquer uma das 2 passadas

  // PASSADA 1 — por NOME, não pela tripla. Achado real (11/08): 110 grupos
  // travados na passada 2 (abaixo) só porque a cópia "extra" tem endereço/
  // telefone diferente (ou em branco) da cópia real — mas essa cópia extra
  // não tem NENHUM orçamento/OS/vistoria/equipamento/local vinculado. Uma
  // ficha com zero uso não carrega histórico de ninguém pra proteger, então
  // divergência de endereço nela é irrelevante — só importa quando as DUAS
  // cópias têm uso (aí sim pode ser gente/lugar diferente de verdade, decide
  // a passada 2). Só dispara quando exatamente 1 cópia do nome está em uso;
  // 0 ou 2+ cai pra passada 2 sem mudança de comportamento.
  const porNome={};
  cli.forEach(c=>{ const k=_identNorm(c.nome); (porNome[k]=porNome[k]||[]).push(c); });
  Object.keys(porNome).forEach(k=>{
    const fichas=porNome[k];
    if(fichas.length<2) return;
    const comUso=fichas.filter(f=>usado(f.id));
    if(comUso.length!==1) return;
    const remover=fichas.filter(f=>f.id!==comUso[0].id);
    if(!remover.length) return;
    remover.forEach(f=>processados.add(f.id));
    processados.add(comUso[0].id);
    grupos.push({ nome:fichas[0].nome, manterId:comUso[0].id, removerIds:remover.map(f=>f.id), qtd:remover.length,
      endereco:comUso[0].endereco||'', telefone:comUso[0].telefone||'' });
  });

  // PASSADA 2 — pela TRIPLA exata (nome+endereço+telefone normalizados), como
  // antes. Cobre o que a passada 1 não resolveu: nenhuma cópia em uso (ex.:
  // "Torri Di Mare" tinha 626 cópias vazias idênticas + 4 com endereço real,
  // divergentes entre si — aqui as 626 idênticas ainda se limpam sozinhas) ou
  // 2+ cópias em uso (ambíguo de verdade, não mexe).
  const porTripla={};
  cli.forEach(c=>{
    if(processados.has(c.id)) return; // já decidido na passada 1
    const k=_identNorm(c.nome)+'|'+_identNorm(c.endereco)+'|'+_identNorm(c.telefone);
    (porTripla[k]=porTripla[k]||[]).push(c);
  });
  Object.keys(porTripla).forEach(k=>{
    const fichas=porTripla[k];
    if(fichas.length<2) return;
    // cnpj não faz parte da chave de agrupamento, mas ainda não pode divergir
    const cnpj=new Set(fichas.map(f=>(f.cnpj||'').trim()).filter(Boolean));
    if(cnpj.size>1) return; // cnpj divergente — não mexe
    const comUso=fichas.filter(f=>usado(f.id));
    if(comUso.length>1) return; // ambíguo — não mexe
    // Sem ficha em uso: mantém a mais COMPLETA (tem tipo/e-mail preenchido),
    // não só a mais antiga — achado numa conferência antes de liberar a
    // limpeza: cópia mais nova às vezes tinha "tipo: condomínio" preenchido
    // e a mais antiga não, e a antiga sempre vencia, perdendo a etiqueta.
    // Empate de completude cai no desempate antigo (mais antiga primeiro).
    const completude=f=>(f.tipo?1:0)+(f.email_responsavel?1:0);
    const manter=comUso[0] || fichas.slice().sort((a,b)=>{
      const d=completude(b)-completude(a);
      return d!==0 ? d : new Date(a.data_criacao||0)-new Date(b.data_criacao||0);
    })[0];
    const remover=fichas.filter(f=>f.id!==manter.id);
    if(!remover.length) return;
    grupos.push({ nome:fichas[0].nome, manterId:manter.id, removerIds:remover.map(f=>f.id), qtd:remover.length,
      endereco:fichas[0].endereco||'', telefone:fichas[0].telefone||'' });
  });
  return grupos.sort((a,b)=>b.qtd-a.qtd);
}

function renderAvisoDuplicatas(){
  const el=document.getElementById('cli-dup-aviso'); if(!el) return;
  const grupos=_dupGrupos();
  if(!grupos.length){ el.style.display='none'; return; }
  const totalFichas=grupos.reduce((a,g)=>a+g.qtd,0);
  el.style.display='';
  el.innerHTML=`<div class="card" style="border-left:3px solid var(--yellow);background:#fffbeb;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:4px">
      ${totalFichas} ficha${totalFichas!==1?'s':''} duplicada${totalFichas!==1?'s':''} vazia${totalFichas!==1?'s':''}</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
      ${grupos.length} nome${grupos.length!==1?'s':''} com cópia idêntica (mesmo nome, endereço e telefone), sem nenhum orçamento vinculado a essas cópias.
      Nome com dado divergente entre as cópias não entra aqui — fica pra você decidir na tela Identidade.</div>
    <button class="tb g" style="font-weight:700" onclick="abrirRevisaoDuplicatas()">🧹 Revisar e limpar</button>
  </div>`;
}

let _dupGruposAtual=[];
async function abrirRevisaoDuplicatas(){
  // Força atualização de TUDO que a checagem de segurança usa, sem depender de
  // cache que a aba já tinha de uma visita anterior — é o instante mais crítico
  // (logo antes de uma exclusão em massa), não dá pra confiar em dado velho.
  toast('Atualizando antes de montar a lista…');
  await carregarClientesRemoto();
  if(typeof loadHist==='function') await loadHist();
  if(typeof loadOSHist==='function') await loadOSHist();
  if(typeof loadEquipamentos==='function') await loadEquipamentos();
  if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
  _dupGruposAtual=_dupGrupos();
  if(!_dupGruposAtual.length){ toast('Nada pra limpar'); renderAvisoDuplicatas(); return; }
  const totalFichas=_dupGruposAtual.reduce((a,g)=>a+g.qtd,0);
  const linhas=_dupGruposAtual.map(g=>`
    <div style="padding:9px 0;border-bottom:1px solid var(--gray-light)">
      <div style="font-size:13px;font-weight:700;color:var(--c2)">${esc(g.nome)}</div>
      <div style="font-size:11.5px;color:var(--gray)">${[g.endereco,g.telefone].filter(Boolean).map(x=>esc(x)).join(' · ')||'sem endereço/telefone cadastrado'}</div>
      <div style="font-size:11.5px;color:#b45309">mantém 1 ficha · remove ${g.qtd} cópia${g.qtd!==1?'s':''}</div>
    </div>`).join('');
  const m=document.createElement('div');
  m.className='modal-bg'; m.style.display='flex'; m.id='dup-modal-bg';
  m.innerHTML=`<div class="modal" style="max-width:520px;max-height:80vh;overflow:auto">
    <div style="font-size:16px;font-weight:800;color:var(--c2);margin-bottom:6px">🧹 Limpar fichas duplicadas</div>
    <div style="font-size:12.5px;color:var(--gray);margin-bottom:14px">
      ${_dupGruposAtual.length} nomes, ${totalFichas} fichas vazias no total. Nenhuma tem orçamento, OS ou vistoria vinculado — o histórico real de cada cliente fica intacto, ligado à ficha que sobra.</div>
    ${linhas}
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn-primary" style="flex:1" onclick="confirmarLimpezaDuplicatas()">🗑 Confirmar exclusão de ${totalFichas} fichas</button>
      <button onclick="document.getElementById('dup-modal-bg').remove()" style="flex:1;padding:12px;border:2px solid var(--gray-mid);border-radius:10px;background:var(--white);font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(m);
}

// Corrida com lote pequeno em paralelo: apagar uma por uma (628 chamadas
// sequenciais) levava tempo demais SEM nenhum feedback na tela — o modal
// sumia no clique (era removido antes do laço começar) e ficava parecendo
// travado ou "saindo sozinho" até o usuário fechar a aba no meio do processo.
// Agora o modal fica aberto mostrando progresso real, e o lote em paralelo
// reduz o tempo total de ~2min para poucos segundos.
async function confirmarLimpezaDuplicatas(){
  const grupos=_dupGruposAtual;
  const totalFichas=grupos.reduce((a,g)=>a+g.qtd,0);
  const m=document.getElementById('dup-modal-bg');
  if(m) m.innerHTML=`<div class="modal" style="max-width:420px">
    <div style="font-size:16px;font-weight:800;color:var(--c2);margin-bottom:10px">🧹 Apagando fichas duplicadas…</div>
    <div id="dup-progresso-txt" style="font-size:13px;color:var(--gray);margin-bottom:10px">0 de ${totalFichas}</div>
    <div style="height:8px;background:var(--gray-light);border-radius:50px;overflow:hidden">
      <div id="dup-progresso-barra" style="height:100%;width:0%;background:var(--c1);transition:width .2s"></div>
    </div>
    <div style="font-size:11.5px;color:var(--gray);margin-top:10px">Não feche esta aba até terminar.</div>
  </div>`;

  const todos=grupos.flatMap(g=>g.removerIds);
  let cli=lsCliLer();
  let removidas=0, falhas=0;
  const LOTE=15;
  for(let i=0;i<todos.length;i+=LOTE){
    const lote=todos.slice(i,i+LOTE);
    await Promise.all(lote.map(async id=>{
      // ⚠️ Tombstone só DEPOIS de confirmar o delete no banco — tombar antes
      // escondia localmente registro que na real não tinha sido apagado (o
      // delete falhava, o catch engolia o erro, e o registro "sumia" da tela
      // mas continuava existindo no banco, fazendo o total local não bater
      // com o banco de verdade).
      if(String(id).startsWith('cli_')){ cli=cli.filter(c=>c.id!==id); removidas++; return; }
      if(!(dbOk&&db)){ falhas++; return; }
      try{
        const {error}=await db.from('clientes').delete().eq('id',id);
        if(error) throw error;
        _tombAdd('fluxa_cli_tombstones', id);
        cli=cli.filter(c=>c.id!==id);
        removidas++;
      }catch(e){ console.warn('[limpezaDup]',e?.message||e); falhas++; }
    }));
    lsCliSalvar(cli); // grava a cada lote — se a aba fechar no meio, o progresso já feito não se perde
    const txt=document.getElementById('dup-progresso-txt'); if(txt) txt.textContent=`${removidas+falhas} de ${totalFichas}`;
    const barra=document.getElementById('dup-progresso-barra'); if(barra) barra.style.width=((removidas+falhas)/totalFichas*100)+'%';
  }

  logAcao('limpeza_duplicatas', `${removidas} fichas vazias removidas em ${grupos.length} nomes${falhas?` · ${falhas} falharam`:''}`);
  renderClientes(); renderAvisoDuplicatas();
  if(m) m.innerHTML=`<div class="modal" style="max-width:420px;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">${falhas?'⚠️':'✅'}</div>
    <div style="font-size:15px;font-weight:800;color:var(--c2);margin-bottom:14px">${removidas} fichas duplicadas removidas${falhas?`<br><span style="color:var(--red);font-size:13px">${falhas} falharam — continuam no banco, tente de novo</span>`:''}</div>
    <button class="btn-primary" style="width:100%" onclick="document.getElementById('dup-modal-bg').remove()">Fechar</button>
  </div>`;
  toast(falhas?`⚠️ ${removidas} removidas, ${falhas} falharam`:`✅ ${removidas} fichas duplicadas removidas`);
}

function renderIdentidade(){
  const gs=_identGrupos();
  const pend=gs.filter(g=>g.estado!=='ok');
  const soma=l=>l.reduce((a,g)=>a+g.valor,0);
  const k=document.getElementById('ident-kpis');
  if(k) k.innerHTML=
    `<div class="dc o"><div class="dl">Sem ficha ligada</div><div class="dv">${pend.length}</div><div class="ds">de ${gs.length} nomes</div></div>`+
    `<div class="dc y"><div class="dl">Valor sem identidade</div><div class="dv">${brl(soma(pend))}</div><div class="ds">não entra no histórico do cliente</div></div>`+
    `<div class="dc r"><div class="dl">Precisam de decisão</div><div class="dv">${gs.filter(g=>g.estado!=='ok'&&['duplicada','nenhum'].includes(g.ficha.conf)).length}</div><div class="ds">sem ficha ou ficha duplicada</div></div>`+
    `<div class="dc g"><div class="dl">Já ligados</div><div class="dv">${gs.length-pend.length}</div><div class="ds">${gs.length?Math.round((gs.length-pend.length)/gs.length*100):0}% dos nomes</div></div>`;

  const fl=document.getElementById('ident-filtros');
  if(fl) fl.innerHTML=[['pendente','Pendentes'],['decidir','Precisam de decisão'],
      ['variante','Escritos de vários jeitos'],['ok','Já ligados'],['todos','Todos']]
    .map(([kk,rot])=>`<button class="tb${_identFiltro===kk?' g':''}" onclick="_identSetFiltro('${kk}')"${_identFiltro===kk?' style="font-weight:700"':''}>${rot} ${_identFiltro===kk?'':''}${(kk==='todos'?gs.length:_identFiltroCount(gs,kk))}</button>`).join('');

  const lista=_identFiltrar(gs);
  const c=document.getElementById('ident-contagem');
  if(c) c.textContent=`· ${lista.length} de ${gs.length}`;
  const el=document.getElementById('ident-lista'); if(!el) return;
  if(!lista.length){ el.innerHTML='<div class="empty-st"><div class="ei">🪪</div><p>Nada nesta situação.</p></div>'; return; }

  el.innerHTML=lista.slice(0,120).map(g=>{
    const f=g.ficha;
    const cor = g.estado==='ok'?'var(--green)' : f.conf==='exato'?'var(--blue)'
              : (f.conf==='provavel'||f.conf==='conferir')?'var(--yellow)':'var(--red)';
    const variantes = g.nomes.length>1
      ? `<div style="font-size:11px;color:#b45309;margin-top:2px">✎ escrito de ${g.nomes.length} jeitos: ${g.nomes.map(n=>esc(n)).join(' · ')}</div>` : '';
    let acao='';
    if(g.estado==='ok') acao=`<span style="font-size:11.5px;color:var(--green);font-weight:700">✅ ligado</span>`;
    else if(f.conf==='exato'||f.conf==='provavel'||f.conf==='conferir')
      acao=`<button class="tb g" style="font-weight:700" onclick="identLigar('${g.chave}','${f.id}')">Ligar a "${esc((f.nome||'').slice(0,22))}"</button>
            <button class="tb" onclick="identCriarFicha('${g.chave}')">Criar nova</button>`;
    else if(f.conf==='duplicada')
      acao=(f.fichas||[]).map(x=>`<button class="tb" onclick="identLigar('${g.chave}','${x.id}')">Usar "${esc(x.nome.slice(0,20))}"</button>`).join(' ')
           +` <button class="tb" onclick="identCriarFicha('${g.chave}')">Criar nova</button>`;
    else acao=`<button class="tb g" style="font-weight:700" onclick="identCriarFicha('${g.chave}')">＋ Criar ficha</button>`;
    return `<div style="display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--gray-light);flex-wrap:wrap;align-items:flex-start">
      <div style="width:4px;align-self:stretch;border-radius:2px;background:${cor};min-height:38px"></div>
      <div style="flex:1;min-width:190px">
        <div style="font-size:13.5px;font-weight:700;color:var(--c2)">${esc(g.nomes[0])}</div>
        <div style="font-size:11px;color:var(--gray)">${g.orcs.length} orçamento${g.orcs.length!==1?'s':''} · ${brl(g.valor)}${g.ligados?` · ${g.ligados} já ligado${g.ligados!==1?'s':''}`:''}</div>
        <div style="font-size:11px;color:${cor};font-weight:600">${esc(f.motivo)}</div>
        ${variantes}
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">${acao}</div>
    </div>`;
  }).join('') + (lista.length>120?`<div style="font-size:11.5px;color:var(--gray);padding:9px 0">Mostrando os 120 de maior valor. Confirme esses e a lista recarrega.</div>`:'');
}
function _identFiltroCount(gs,k){ const s=_identFiltro; _identFiltro=k; const n=_identFiltrar(gs).length; _identFiltro=s; return n; }
function _identSetFiltro(k){ _identFiltro=k; renderIdentidade(); }

// Liga TODOS os orçamentos daquele nome à ficha escolhida. Também marca OS e
// vistorias com o mesmo nome — é a mesma decisão, e pedir de novo seria ruído.
async function identLigar(chave, clienteId){
  const cli=(lsCliLer()||[]).find(c=>String(c.id)===String(clienteId));
  if(!cli){ toast('⚠️ Ficha não encontrada'); return; }
  const alvo=(todosOrc||[]).filter(o=>_identNorm(o.cliente)===chave && !o.cliente_id);
  for(const o of alvo){
    o.cliente_id=cli.id;
    lsOrcAtualizar(o.id,{cliente_id:cli.id});
    if(dbOk&&db&&!String(o.id).startsWith('local_')){
      try{ await orcSyncUpdate(o.id,{cliente_id:cli.id}); }catch(e){ console.warn('[identLigar]',e?.message||e); }
    }
  }
  let extras=0;
  const _vis = (typeof lsVisLer==='function') ? lsVisLer() : [];
  for(const t of [['ordens_servico',todosOS],['vistorias',_vis]]){
    for(const r of (t[1]||[])){
      if(_identNorm(r.cliente)===chave && !r.cliente_id){
        r.cliente_id=cli.id; extras++;
        if(t[0]==='vistorias' && typeof lsVisSalvar==='function') lsVisSalvar(_vis);
        if(dbOk&&db){ try{ await dbUpdate(t[0],{cliente_id:cli.id},'id',r.id); }catch(e){ console.warn('[identLigar '+t[0]+']',e?.message||e); } }
      }
    }
  }
  logAcao('cliente_identidade', `${alvo.length} orç. + ${extras} reg. → ${cli.nome}`);
  renderIdentidade();
  try{ renderAvisoIdentidade(); }catch(e){ console.warn('[avisoIdentidade]',e?.message||e); }
  toast(`✅ ${alvo.length} orçamento${alvo.length!==1?'s':''} ligado${alvo.length!==1?'s':''} a ${cli.nome}`);
}

// Cria a ficha e já liga. É o caminho MAJORITÁRIO: 43% dos nomes (R$ 1,19 mi)
// nunca tiveram cadastro — não é erro de grafia, é cliente que nunca foi criado.
async function identCriarFicha(chave){
  const g=_identGrupos().find(x=>x.chave===chave);
  if(!g){ toast('⚠️ Grupo não encontrado'); return; }
  const base=g.orcs.find(o=>o.tel_cliente||o.cnpj)||g.orcs[0]||{};
  const telNovo=base.tel_cliente||'', endNovo=base.local_servico||base.local||'';
  // Trava contra corrida entre sessões: confere no BANCO (não só no cache local,
  // que pode estar desatualizado) se não surgiu ficha idêntica entre o clique e
  // agora. Foi exatamente essa corrida — duas sessões vendo "não existe" ao
  // mesmo tempo — que gerou até 13 cópias do mesmo condomínio em 08/08–08/10.
  // Não elimina 100% (ainda há uma janela entre este select e o insert) — a
  // trava definitiva é um índice único em (nome, endereco, telefone), mas isso
  // só pode entrar DEPOIS que as 629 fichas duplicadas existentes forem
  // removidas (índice único falha ao criar com duplicata já no banco).
  if(dbOk&&db){
    try{
      const {data:dup}=await db.from('clientes').select('id,nome,telefone,endereco')
        .ilike('nome', g.nomes[0]).limit(20);
      const achou=(dup||[]).find(c=>_identNorm(c.nome)===chave
        && (c.telefone||'')===telNovo && (c.endereco||'')===endNovo);
      if(achou){
        const _cl=lsCliLer();
        if(!_cl.find(x=>x.id===achou.id)) _cl.unshift({id:achou.id, nome:achou.nome, tel:achou.telefone||'', end:achou.endereco||''});
        lsCliSalvar(_cl);
        await identLigar(chave, achou.id);
        return;
      }
    }catch(e){ console.warn('[identCriarFicha:checarDup]', e?.message||e); }
  }
  // ⚠️ clientes.id é UUID com default no banco. Mandar um id de texto ('cli_…')
  // faz o insert ser REJEITADO (22P02) e a ficha fica só no aparelho. Por isso o
  // id é gerado pelo BANCO e só então usado para ligar os orçamentos — se o link
  // apontasse para o id local, apontaria para uma ficha que não existe lá.
  // Offline mantém o id local, e a reconciliação acontece no próximo salvamento.
  const local={ id:'cli_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    nome:g.nomes[0], tel:base.tel_cliente||'', end:base.local_servico||base.local||'',
    cnpj:base.cnpj||'', email_responsavel:'', tipo:'',
    portal_token:crypto.randomUUID(), loja_id:base.loja_id||lojaAtiva||LOJA_PADRAO_ID };
  let rec=local;
  if(dbOk&&db){
    try{
      // tel/end são nomes LOCAIS; a tabela usa telefone/endereco — todo o resto
      // do app traduz antes de gravar, e sem isso o dbInsert descartaria os dois.
      const {data:ins,error}=await dbInsert('clientes', {
        nome:local.nome, telefone:local.tel||null, endereco:local.end||null,
        cnpj:local.cnpj||null, portal_token:local.portal_token, loja_id:local.loja_id
      });
      if(error) throw error;
      if(ins&&ins.id) rec={...local, id:ins.id};
    }catch(e){
      console.warn('[identCriarFicha]', e?.message||e);
      toast('⚠️ Ficha criada aqui, mas não sincronizou');
    }
  }
  const _cl=lsCliLer(); _cl.unshift(rec); lsCliSalvar(_cl);
  await identLigar(chave, rec.id);
}

async function loadIdentidade(){
  if(!(todosOrc||[]).length && typeof loadHist==='function') await loadHist();
  if(!(todosOS||[]).length && typeof loadOSHist==='function') await loadOSHist();
  if(typeof carregarClientesRemoto==='function') await carregarClientesRemoto();
  renderIdentidade();
}

// ══════════════════════════════════════════════════════════════════════
//  SALVAR CLIENTE NO BANCO — o id tem que vir de LÁ
//  `clientes.id` é uuid com default. O app gera 'cli_<timestamp>' localmente e
//  mandava esse id no insert: o Postgres devolve 22P02 e o insert falha INTEIRO.
//  Não é coluna faltando, então o dbInsert resiliente não salva. Resultado: todo
//  cliente cadastrado pelo app ficava só no aparelho e nunca subia — é por isso
//  que existem 216 nomes de cliente para 141 fichas.
//  Aqui o insert vai SEM id, o uuid devolvido substitui o id local (na lista e
//  em quem já apontava para ele), e offline o id local permanece.
// ══════════════════════════════════════════════════════════════════════
async function salvarClienteRemoto(local){
  if(!dbOk||!db||!local) return null;
  try{
    const {data,error}=await dbInsert('clientes', {
      nome:local.nome||'', telefone:local.tel||null, endereco:local.end||null,
      cnpj:local.cnpj||null, email_responsavel:local.email_responsavel||null,
      tipo:local.tipo||null, portal_token:local.portal_token||null,
      loja_id:local.loja_id||null
    });
    if(error) throw error;
    if(!data||!data.id) return null;
    // troca o id local pelo do banco onde ele já foi usado
    const antigo=local.id, novo=data.id;
    if(antigo && antigo!==novo){
      const cl=lsCliLer().map(c=>c.id===antigo?{...c, id:novo}:c);
      lsCliSalvar(cl);
      (todosOrc||[]).forEach(o=>{ if(o.cliente_id===antigo) o.cliente_id=novo; });
      (todosOS||[]).forEach(o=>{ if(o.cliente_id===antigo) o.cliente_id=novo; });
    }
    return novo;
  }catch(e){ console.warn('[salvarClienteRemoto]', e?.message||e); return null; }
}

// ── Modal: Criar OS a partir da aprovação do orçamento ──
function _perguntarCriarOS(orc){
  document.getElementById('aprov-os-orc-id').value=orc.id;
  document.getElementById('aprov-os-titulo').textContent=`Orçamento #${String(orc.numero||'?').padStart(3,'0')} aprovado!`;
  const dataEl=document.getElementById('aprov-os-data');
  dataEl.value=orc.data_servico||_hojeLocal();
  document.getElementById('aprov-os-hora').value='08:00';
  const sel=document.getElementById('aprov-os-tec');
  const tecs=getTecnicos();
  sel.innerHTML='<option value="">Selecione…</option>'+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  // Só oferece a Ordem de Entrega se houver o que entregar.
  const _row=document.getElementById('aprov-entrega-row');
  if(_row) _row.style.display = _orcTemItens(orc) ? '' : 'none';
  document.getElementById('aprov-os-bg').classList.add('on');
}
function fecharAprovOS(){ document.getElementById('aprov-os-bg').classList.remove('on'); }

// Orçamento tem itens? (aceita `servicos` como array ou string JSON — dado legado)
function _orcTemItens(orc){
  let s=orc&&orc.servicos;
  if(typeof s==='string'){ try{ s=JSON.parse(s||'[]'); }catch(e){ return false; } }
  return Array.isArray(s) && s.length>0;
}
// Botão "Ordem de entrega" do modal de aprovação
function gerarEntregaDaAprovacao(){
  const id=document.getElementById('aprov-os-orc-id').value;
  if(!id){ toast('⚠️ Orçamento não identificado'); return; }
  fecharAprovOS();
  // deixa o modal fechar antes de abrir a impressão (senão o modal entra no PDF)
  setTimeout(()=>gerarOrdemEntrega(id), 180);
}

async function criarOSdeAprovacao(){
  const orcId=document.getElementById('aprov-os-orc-id').value;
  const data=document.getElementById('aprov-os-data').value;
  const hora=document.getElementById('aprov-os-hora').value||'08:00';
  const tec=document.getElementById('aprov-os-tec').value;
  // data e tec são opcionais — podem ser preenchidos depois via "Editar OS"
  const orc=todosOrc.find(x=>x.id===orcId);
  if(!orc){ toast('⚠️ Orçamento não encontrado'); fecharAprovOS(); return; }
  const btn=document.getElementById('aprov-os-btn');
  if(btn){ btn.disabled=true; btn.textContent='Criando…'; }
  try{
    const osSvcs=(orc.servicos||[]).map(s=>({desc:s.desc||s.d||'',produto_id:s.produto_id||null,qty:s.qty||1,precoUnit:parseFloat(s.p||s.preco||0)||0}));
    let numStr='???', salvouOnline=false;
    if(dbOk&&db){
      try{
        const {data:insOS,error}=await dbInsertNumerado('ordens_servico',{
          orcamento_id:String(orcId).startsWith('local_')?null:orcId,
          cliente:orc.cliente, local_servico:orc.local_servico,
          data_servico:data, hora, tecnico:tec,
          servicos:osSvcs, materiais:'', obs_tecnica:'',
          total:orc.total, status:'agendado', loja_id:orc.loja_id||LOJA_PADRAO_ID
        });
        if(error) throw error;
        numStr=String(insOS?.numero||1).padStart(3,'0');
        salvouOnline=true;
      }catch(e){ console.warn('[criarOSdeAprovacao] falha ao salvar no banco:', e?.message||e); }
    }
    if(!salvouOnline){
      // Offline, ou o salvamento online falhou: nunca deixa a OS existir só
      // no toast — grava local e marca para reenvio automático.
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n)); numStr=String(n).padStart(3,'0');
      _salvarOSLocal({
        id:'local_os_'+Date.now(), numero:n, status:'agendado', data_criacao:new Date().toISOString(),
        orcamento_id:String(orcId).startsWith('local_')?null:orcId,
        cliente:orc.cliente, local_servico:orc.local_servico,
        data_servico:data, hora, tecnico:tec,
        servicos:osSvcs, materiais:'', obs_tecnica:'',
        total:orc.total, loja_id:orc.loja_id||LOJA_PADRAO_ID,
        _pendingSync:true
      });
    }
    fecharAprovOS();
    const dataFmt=new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
    toast(salvouOnline
      ? `✅ OS #${numStr} criada — agendada para ${dataFmt} às ${hora} · Técnico: ${tec}`
      : `💾 OS #${numStr} salva neste aparelho (sem conexão) — agendada para ${dataFmt} às ${hora} · Técnico: ${tec}`);
    logAcao('os_criada',`#${numStr} via aprovação do orçamento #${String(orc.numero||'?').padStart(3,'0')}`);
    await loadOSHist();
  }catch(e){
    console.error('criarOSdeAprovacao:',e); toast('⚠️ Erro ao criar OS: '+e.message);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='📋 Criar OS agendada'; }
  }
}

// Limpar formulário para novo orçamento
// Limpa TODOS os campos do formulário de orçamento (sem navegar). Usado ao
// iniciar um novo orçamento e ao terminar de salvar/gerar um — assim o form
// nunca fica com dados do orçamento anterior (que causava duplicatas).
function _limparCamposOrc(){
  editId=null; fotosB64=[]; _orcClienteSelecionado=null;
  svcs=[{id:Date.now(),d:'',p:''}];
  ['cli','loc','tel-cli','cnpj-cli','obs','escopo','data-svc','data-orc','nota-interna','origem-cli','origem-cli-outro','pag-parcelas','pag-entrada'].forEach(id=>setV(id,''));
  updOrigemCli();
  setV('pag','A combinar'); setV('val','5'); setV('disc-v',''); setV('disc-t','R$');
  setV('orc-loja', lojaAtiva||LOJA_PADRAO_ID);
  renderSvcs(); upd();
  renderFotosOrcSlots();
  // Reset OS toggle
  const tog=document.getElementById('toggle-os'); if(tog) tog.checked=false;
  const osf=document.getElementById('os-inline-fields'); if(osf) osf.style.display='none';
  ['os-inline-data','os-inline-hora','os-inline-tec'].forEach(id=>{const el=document.getElementById(id);if(el){el.value=id==='os-inline-hora'?'08:00':'';}});
  const bb=document.getElementById('form-back-bar'); if(bb) bb.style.display='none';
}
function novoOrc(){
  limparRascunho('form'); window._skipDraftForm=true; // novo orçamento = começar do zero, sem rascunho antigo
  _limparCamposOrc();
  go('form');
}

// ──────────────────────────────────────────────────
//  FORM — INIT
// ──────────────────────────────────────────────────
let fotosB64 = []; // array de até 6 base64 strings
function initForm(){
  document.getElementById('data-orc').value=_hojeLocal();
  svcs=[]; editId=null; fotosB64=[]; _orcClienteSelecionado=null;
  addSvc('',''); renderPresets(); upd(); renderChips(); renderFotosOrcSlots();
}

// ──────────────────────────────────────────────────
//  PRESETS
// ──────────────────────────────────────────────────
function getPresets(){ const s=JSON.parse(ls('fluxa_presets')||'{}'); return (CFG.svcs||[]).map(d=>({d,p:s[d]||''})); }
function salvarPrecoPreset(d,p){ const s=JSON.parse(ls('fluxa_presets')||'{}'); s[d]=p; lsSet('fluxa_presets',JSON.stringify(s)); }

function renderPresets(){
  const el=document.getElementById('presets'); if(!el) return;
  el.innerHTML='';
  getPresets().forEach(({d,p})=>{
    const k=safeKey(d), pn=parseFloat(p)||0;
    const pl=pn>0?brl(pn):'Definir preço', ec=pn>0?'':' empty';
    const it=document.createElement('div'); it.className='pi';
    it.innerHTML=`<button class="pi-add" onclick="addPreset('${esc(d)}')">＋ ${esc(d)}</button>
      <div class="pi-pw">
        <span class="pi-pd${ec}" id="pd-${k}" onclick="editPP('${esc(d)}')">${pl}</span>
        <input class="pi-pi" id="pi-${k}" onblur="savePP('${esc(d)}',this)" onkeydown="if(event.key==='Enter')this.blur()">
        <button class="pi-eb" onclick="editPP('${esc(d)}')">✎</button>
      </div>`;
    el.appendChild(it);
  });
}
function addPreset(d){ const p=getPresets().find(x=>x.d===d); addSvc(d,p?p.p:''); }
function editPP(d){
  const k=safeKey(d), disp=document.getElementById('pd-'+k), inp=document.getElementById('pi-'+k);
  if(!disp||!inp) return;
  const v=parseFloat(JSON.parse(ls('fluxa_presets')||'{}')[d])||0;
  disp.style.display='none'; inp.style.display='block';
  inp.value=v>0?v.toFixed(2).replace('.',','):''; inp.focus(); inp.select();
}
function savePP(d,inp){
  const k=safeKey(d), disp=document.getElementById('pd-'+k);
  const v=parseFloat(inp.value.replace(',','.'))||0;
  salvarPrecoPreset(d,v>0?String(v):'');
  inp.style.display='none';
  if(disp){ disp.style.display=''; if(v>0){disp.textContent=brl(v);disp.classList.remove('empty');}else{disp.textContent='Definir preço';disp.classList.add('empty');} }
}

// ──────────────────────────────────────────────────
//  SERVIÇOS (form)
// ──────────────────────────────────────────────────
function addSvc(d,p,qty){ svcs.push({id:Date.now()+Math.random(),d:d||'',p:p||'',qty:qty||1}); renderSvcs(); upd(); }
function rmSvc(id){ if(svcs.length===1){toast('⚠️ Mín. 1 serviço');return;} svcs=svcs.filter(s=>s.id!==id); renderSvcs(); upd(); }
function renderSvcs(){
  const el=document.getElementById('slist'); el.innerHTML='';
  svcs.forEach(s=>{
    const v=parseFloat(s.p)||0;
    const qty=parseInt(s.qty)||1;
    const r=document.createElement('div'); r.className='srow';
    const prod = s.produto_id ? produtoById(s.produto_id) : null;
    const prodBadge = s.produto_id
      ? `<span title="Vinculado ao estoque — dá baixa quando aprovado" style="display:inline-flex;align-items:center;gap:4px;background:var(--c1-light);color:var(--c1);border:1px solid var(--c1);border-radius:50px;padding:2px 8px;font-size:11px;font-weight:600">📦 ${esc(prod?prod.nome:'produto')}<span onclick="desvincularProdutoSvc(${s.id})" style="cursor:pointer;font-weight:700" title="Desvincular">✕</span></span>`
      : s.avulso
        ? `<span style="display:inline-flex;align-items:center;gap:4px;color:var(--gray);font-size:11px"><label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" checked onchange="toggleSvcAvulso(${s.id})" style="margin:0"> não é produto de estoque</label></span>`
        : `<span style="display:inline-flex;align-items:center;gap:8px">
            <button type="button" onclick="abrirPickerProduto(${s.id})" style="background:none;border:1px dashed var(--gray-mid);border-radius:50px;padding:3px 10px;font-size:11px;color:var(--gray);cursor:pointer;font-family:'Inter',sans-serif">📦 Vincular produto do estoque</button>
            <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:var(--gray);cursor:pointer" title="Mão de obra, serviço ou material que não tem SKU no estoque"><input type="checkbox" onchange="toggleSvcAvulso(${s.id})" style="margin:0"> não é produto</label>
          </span>`;
    r.innerHTML=`<div class="srow-t">
      <input type="number" class="qty-f" placeholder="1" min="1" value="${qty}" data-id="${s.id}" data-f="qty" oninput="updSvcQty(this)" title="Quantidade">
      <input type="text" list="svc-prod-list" placeholder="Descrição — comece a digitar para buscar no estoque" value="${esc(s.d)}" data-id="${s.id}" data-f="d" oninput="updSvc(this)" style="flex:1">
      <button class="btn-rm" onclick="rmSvc(${s.id})">✕</button>
    </div>
    <div class="srow-b">
      <span class="plabel">Valor unit. (R$):</span>
      <input type="text" inputmode="decimal" class="pf" placeholder="0,00" value="${v>0?v.toFixed(2).replace('.',','):''}" data-id="${s.id}" oninput="updSvcP(this)" onblur="fmtP(this)">
      ${qty>1?`<span class="plabel" style="margin-left:8px">= ${brl(v*qty)}</span>`:''}
      <span style="margin-left:auto">${prodBadge}</span>
    </div>${(()=>{
      const pre=_extrairQtdPrefixo(s.d);
      if(!pre || pre.qtd===qty) return '';
      return `<div style="padding:5px 0 2px;font-size:11.5px;color:#b45309">
        A quantidade <strong>${pre.qtd}</strong> está no texto, mas o campo diz <strong>${qty}</strong> —
        a baixa usa o campo.
        <button type="button" onclick="aplicarQtdDoTexto(${s.id})" style="margin-left:6px;background:#fef3c7;border:1px solid #fbbf24;color:#b45309;border-radius:50px;padding:2px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Usar ${pre.qtd}</button>
      </div>`;
    })()}`;
    el.appendChild(r);
  });
  renderDatalistProdutos();
  renderAvisoVinculo();
}
// Fora do renderSvcs de propósito: precisa atualizar a cada tecla, e o
// renderSvcs só roda quando a linha muda de forma (senão o aviso ficava mudo
// justamente no caso que ele existe para avisar — o texto livre).
function renderAvisoVinculo(){
  const av=document.getElementById('svc-aviso-vinculo'); if(!av) return;
  const semv=_svcSemVinculo();
  av.style.display = semv? '' : 'none';
  av.innerHTML = semv
    ? `<span style="color:var(--gray)">${semv} ${semv>1?'itens ficaram':'item ficou'} sem vínculo com o estoque — ${semv>1?'eles não movem':'ele não move'} saldo nem custo ao aprovar.</span>`
    : '';
}
function updSvc(inp){
  const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id));
  if(s){
    s[inp.dataset.f]=inp.value;
    if(inp.dataset.f==='d') renderDatalistProdutos(_prefixoDigitado(inp.value));
    if(inp.dataset.f==='d' && _svcAutoVincular(s)){
      renderSvcs(); upd();
      toast('📦 '+(produtoById(s.produto_id)?.nome||'Produto')+' vinculado ao estoque');
      return;
    }
  }
  renderAvisoVinculo();
  upd();
}
function updSvcQty(inp){ const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id)); if(s){ s.qty=parseInt(inp.value)||1; renderSvcs(); upd(); } }
function updSvcP(inp){
  const raw=inp.value.replace(',','.').replace(/[^\d.]/g,'');
  const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id));
  if(s) s.p=raw||'';
  upd();
}
function fmtP(inp){
  const raw=inp.value.replace(',','.').replace(/[^\d.]/g,'');
  const v=parseFloat(raw)||0;
  const s=svcs.find(x=>x.id===parseFloat(inp.dataset.id));
  if(s) s.p=v>0?String(v):'';
  inp.value=v>0?v.toFixed(2).replace('.',','):'';
  renderSvcs(); upd();
}
function gP(s){ return (parseFloat(s.p)||0)*(parseInt(s.qty)||1); }

// ── Vincular item do orçamento a um produto do estoque ──
let _pickerSvcId=null;
function abrirPickerProduto(svcId){
  _pickerSvcId=svcId;
  if(!todosProdutos.length) loadEstoque(); // garante catálogo carregado
  setV('prodpicker-busca','');
  renderPickerProduto('');
  document.getElementById('prodpicker-modal').style.display='flex';
  setTimeout(()=>document.getElementById('prodpicker-busca')?.focus(),80);
}
function fecharPickerProduto(){ document.getElementById('prodpicker-modal').style.display='none'; }
function renderPickerProduto(q){
  const body=document.getElementById('prodpicker-body'); if(!body) return;
  q=(q||'').toLowerCase();
  const lista=produtosVisiveis()
    .filter(p=>!q||(p.nome||'').toLowerCase().includes(q)||(p.codigo||'').toLowerCase().includes(q))
    .sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).slice(0,50);
  if(!lista.length){
    body.innerHTML=`<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhum produto.${todosProdutos.length?'':' Cadastre em Estoque primeiro.'}</div>`;
    return;
  }
  body.innerHTML=lista.map(p=>{
    const saldo=saldoProduto(p.id);
    return `<div class="modal-cli-item" onmousedown="vincularProdutoSvc('${p.id}')">
      <div class="mcn">${esc(p.nome)} <span style="font-weight:400;color:var(--gray);font-size:12px">${brl(p.preco_venda||0)}</span></div>
      <div class="mcd">${[p.codigo,'saldo: '+fmtQtd(saldo)+' '+(p.unidade||'')].filter(Boolean).map(esc).join(' · ')}</div>
    </div>`;
  }).join('');
}

// ── Cobertura de produto_id: vincular tem que ser MAIS FÁCIL que digitar ──
// Medido em 07/08 nos itens aprovados: Camboriú 24,3%, Itapema 47,2%. Como a
// baixa passou a acontecer na aprovação, três quartos do que Camboriú vende não
// move estoque — foi digitado como texto livre. O picker existia, mas era um
// passo A MAIS; aqui o catálogo entra como sugestão no próprio campo de
// descrição e já traz o preço, então o caminho vinculado vira o mais curto.
// A equipe escreve a quantidade DENTRO da descrição e deixa qty=1:
// "05 Leds RGS Resinado", "21 Sal para gerador de cloro". Isso cria DOIS
// problemas, e os dois são resolvidos tirando o prefixo do texto:
//  1) o item baixaria 1 unidade em vez de 21 assim que fosse vinculado — trocaria
//     um problema visível (o aviso do rodapé) por um invisível (estoque parece
//     certo e está errado por 5x);
//  2) o prefixo cega a sugestão: nenhum produto do catálogo contém "01 Trocador",
//     então quem digita assim não vê sugestão nenhuma. São 19,8% dos usos.
// Só trata como quantidade número de até 3 dígitos seguido de espaço — "220V
// Motobomba" não vira quantidade 220.
function _extrairQtdPrefixo(txt){
  const m=String(txt||'').match(/^\s*(\d{1,3})\s*[-–x×]?\s+(.{3,})$/i);
  if(!m) return null;
  const q=parseInt(m[1]);
  if(!q || q>999) return null;
  return {qtd:q, resto:m[2].trim()};
}
// Aplica: joga o número no campo de quantidade e limpa a descrição.
function aplicarQtdDoTexto(svcId){
  const s=(svcs||[]).find(x=>x.id===svcId); if(!s) return;
  const p=_extrairQtdPrefixo(s.d); if(!p) return;
  s.qty=p.qtd; s.d=p.resto;
  _svcAutoVincular(s);
  renderSvcs(); upd();
  toast(`✔ Quantidade ${p.qtd} · "${p.resto.slice(0,28)}"`);
}

function _catalogoSugestoes(){
  const vis = (typeof produtosVisiveis==='function') ? produtosVisiveis() : (todosProdutos||[]);
  return (vis||[]).filter(p=>p && p.nome && p.ativo!==false);
}
function renderDatalistProdutos(prefixo){
  const dl=document.getElementById('svc-prod-list'); if(!dl) return;
  const pre=prefixo||'';
  dl.innerHTML=_catalogoSugestoes()
    .map(p=>`<option value="${esc(pre+p.nome)}">${p.preco_venda?brl(p.preco_venda):''}</option>`).join('');
}
// Detecta um prefixo numérico SENDO digitado (sem exigir texto depois — ao
// contrário de _extrairQtdPrefixo, que só reconhece quantidade quando já há
// pelo menos 3 caracteres de descrição). Usado só para casar o <datalist>
// nativo com o que a pessoa já digitou, não para decidir quantidade.
function _prefixoDigitado(txt){
  const m=String(txt||'').match(/^\s*\d{1,3}\s*[-–x×]?\s+/i);
  return m ? m[0] : '';
}
// Casa o texto digitado com um produto do catálogo (exato, ignorando caixa/acento)
function _produtoPorNome(txt){
  const n=_normNome? _normNome(txt) : String(txt||'').trim().toLowerCase();
  if(!n) return null;
  return _catalogoSugestoes().find(p=>(_normNome? _normNome(p.nome) : String(p.nome).trim().toLowerCase())===n)||null;
}
// Chamado no input da descrição: se o texto bate com o catálogo, vincula sozinho.
// NÃO desvincula quando deixa de bater — quem desvincula é o ✕, senão editar a
// descrição de um item já vinculado o soltaria do estoque sem a pessoa perceber.
function _svcAutoVincular(s){
  if(!s || s.produto_id) return false;
  let p=_produtoPorNome(s.d);
  if(!p){ const pre=_extrairQtdPrefixo(s.d); if(pre) p=_produtoPorNome(pre.resto); }
  if(!p) return false;
  s.produto_id=p.id;
  if(!s.p || parseFloat(s.p)===0) s.p=String(p.preco_venda||0);
  return true;
}
// Quantos itens ficaram sem vínculo — mostrado no rodapé da lista, sem bloquear
// aqui (o bloqueio é na aprovação, em mudarSt). "avulso" tira o item da conta:
// mão de obra e material sem SKU não têm produto para vincular, e forçar um
// vínculo forjado seria pior que não ter vínculo nenhum.
function _svcSemVinculo(){ return (svcs||[]).filter(x=>!x.produto_id && !x.avulso && (x.d||'').trim()).length; }
function toggleSvcAvulso(svcId){
  const s=svcs.find(x=>x.id===svcId); if(s) s.avulso=!s.avulso;
  renderSvcs(); upd();
}

function vincularProdutoSvc(produtoId){
  const p=produtoById(produtoId); if(!p) return;
  const s=svcs.find(x=>x.id===_pickerSvcId);
  if(s){
    s.produto_id=produtoId;
    if(!s.d || !s.d.trim()) s.d=p.nome;       // preenche descrição se vazia
    if(!s.p || parseFloat(s.p)===0) s.p=String(p.preco_venda||0); // preenche preço se vazio
  }
  fecharPickerProduto();
  renderSvcs(); upd();
  toast('📦 Produto vinculado — dá baixa ao aprovar');
}
function desvincularProdutoSvc(svcId){
  const s=svcs.find(x=>x.id===svcId); if(s) s.produto_id=null;
  renderSvcs(); upd();
}

// ──────────────────────────────────────────────────
//  FOTO
// ──────────────────────────────────────────────────
const FOTO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB — compressImage reduz antes de salvar

// fix #5: comprime imagem antes de armazenar como base64 (evita payloads gigantes no banco)
// maxW: largura máxima em px; quality: 0–1 JPEG
function compressImage(dataUrl, maxW=1200, quality=0.75){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const scale=Math.min(1, maxW/img.width);
      const w=Math.round(img.width*scale);
      const h=Math.round(img.height*scale);
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>resolve(dataUrl); // fallback: retorna original se falhar
    img.src=dataUrl;
  });
}
function renderFotosOrcSlots(){
  const grid=document.getElementById('fotos-orc-grid'); if(!grid) return;
  grid.innerHTML='';
  for(let i=0;i<6;i++){
    const slot=document.createElement('div');
    slot.className='fotos-orc-slot'+(fotosB64[i]?' filled':'');
    slot.innerHTML=`
      <input type="file" id="forc-inp-${i}" accept="image/*" capture="environment" style="display:none" onchange="carregarFotoOrc(this,${i})">
      ${fotosB64[i]?`<img src="${fotosB64[i]}" alt="foto ${i+1}">`:'' }
      <div class="fotos-orc-slot-icon">📷</div>
      <div class="fotos-orc-slot-lbl">Foto ${i+1}</div>
      <button class="fotos-orc-rm" onclick="event.stopPropagation();removerFotoOrc(${i})" title="Remover">✕</button>`;
    slot.addEventListener('click',()=>document.getElementById(`forc-inp-${i}`).click());
    grid.appendChild(slot);
  }
}
function carregarFotoOrc(inp, idx){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=async e=>{ fotosB64[idx]=await compressImage(e.target.result); renderFotosOrcSlots(); }; // fix #5: comprime antes de armazenar
  r.readAsDataURL(f);
}
function removerFotoOrc(idx){
  fotosB64[idx]=null;
  // compact: remove trailing nulls
  while(fotosB64.length && !fotosB64[fotosB64.length-1]) fotosB64.pop();
  renderFotosOrcSlots();
}

// ──────────────────────────────────────────────────
//  CÁLCULOS
// ──────────────────────────────────────────────────
function sub(){ return svcs.reduce((a,s)=>a+gP(s),0); }
function disc(st){ const v=parseFloat(gV('disc-v'))||0,t=gV('disc-t'); if(v<=0) return 0; return t==='%'?st*v/100:Math.min(v,st); }
function tot(){ const s=sub(); return Math.max(0,s-disc(s)); }
function brl(v){ return 'R$ '+v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }

// ──────────────────────────────────────────────────
//  ATUALIZAR UI
// ──────────────────────────────────────────────────
function updPag(){
  const v=gV('pag');
  const temExtra=['boleto-parc','entrada-boleto','entrada-pix','cartao-parc'].includes(v);
  const temEntrada=['entrada-boleto','entrada-pix'].includes(v);
  const temParc=['boleto-parc','entrada-boleto','cartao-parc'].includes(v);
  const extraEl=document.getElementById('pag-extra');
  if(extraEl) extraEl.style.display=temExtra?'flex':'none';
  const fEnt=document.getElementById('pag-f-entrada');
  if(fEnt) fEnt.style.display=temEntrada?'block':'none';
  const fParc=document.getElementById('pag-f-parcelas');
  if(fParc) fParc.style.display=temParc?'block':'none';
}
function formatPagamento(pag, total){
  const entrada=parseFloat((gV('pag-entrada')||'0').replace(',','.'))||0;
  const parcelas=parseInt(gV('pag-parcelas'))||2;
  if(pag==='boleto-parc'){
    const vParc=total/parcelas;
    return `Boleto parcelado — ${parcelas}x de ${brl(vParc)}`;
  }
  if(pag==='entrada-boleto'){
    const resto=Math.max(0,total-entrada);
    const vParc=parcelas>1?resto/parcelas:resto;
    const parcStr=parcelas>1?`${parcelas}x de ${brl(vParc)} no Boleto`:`${brl(resto)} no Boleto`;
    return `Entrada de ${brl(entrada)} + ${parcStr}`;
  }
  if(pag==='entrada-pix'){
    const resto=Math.max(0,total-entrada);
    return `Entrada de ${brl(entrada)} + ${brl(resto)} no Pix/Dinheiro`;
  }
  if(pag==='cartao-parc'){
    const vParc=total/parcelas;
    return `Cartão parcelado — ${parcelas}x de ${brl(vParc)}`;
  }
  return pag;
}
function upd(){
  const s=sub(),d=disc(s),t=Math.max(0,s-d);
  setV_el('d-tot',brl(t),'textContent');
  if(d>0){ show('row-sub'); show('row-disc'); setV_el('d-sub',brl(s),'textContent'); setV_el('d-disc','− '+brl(d),'textContent'); }
  else { hide('row-sub'); hide('row-disc'); }
  // validade
  const dias=parseInt(gV('val'))||5, base=gV('data-orc');
  if(base){ const dv=new Date(base+'T12:00:00'); dv.setDate(dv.getDate()+dias); document.getElementById('vdate').textContent='Válido até '+dv.toLocaleDateString('pt-BR'); }
  gerarPrev();
}

// ──────────────────────────────────────────────────
//  WHATSAPP
// ──────────────────────────────────────────────────
function txtWA(){
  const cli=gV('cli')||'Cliente', loc=gV('loc'), pag=gV('pag'), dias=parseInt(gV('val'))||5, obs=gV('obs'), escopo=gV('escopo'), base=gV('data-orc');
  const s=sub(), d=disc(s), t=Math.max(0,s-d);
  let vData='', vStr=`${dias} dias`;
  if(base){
    const dv=new Date(base+'T12:00:00'); dv.setDate(dv.getDate()+dias);
    vData=dv.toLocaleDateString('pt-BR'); vStr=`${dias} dias — até *${vData}*`;
  }
  const nome1=cli.split(' ')[0]; // primeiro nome
  const vals=svcs.filter(s=>s.d.trim());
  let tx=`Olá, *${nome1}*! 👋\n\n`;
  tx+=`Preparei o orçamento que você solicitou. Segue abaixo:\n\n`;
  tx+=`━━━━━━━━━━━━━━━━━━━━━━━\n`;
  tx+=`🏢 *${CFG.nome}*\n`;
  if(loc) tx+=`📍 ${loc}\n`;
  tx+=`━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if(escopo) tx+=`📝 _${escopo}_\n\n`;
  if(vals.length){
    tx+=`🔧 *Serviços:*\n`;
    const temMultiWA=vals.some(sv=>(parseInt(sv.qty)||1)>1);
    vals.forEach((sv,i)=>{
      const qty=parseInt(sv.qty)||1;
      const pUnit=parseFloat(sv.p)||0;
      const pTotal=gP(sv);
      let detalhe='';
      if(pTotal>0){
        if(temMultiWA&&qty>1) detalhe=` — ${qty}× ${brl(pUnit)} = *${brl(pTotal)}*`;
        else detalhe=` — *${brl(pTotal)}*`;
      }
      tx+=`  ${i+1}. ${sv.d.trim()}${detalhe}\n`;
    });
    tx+=`\n`;
  }
  if(d>0){
    tx+=`Subtotal: ${brl(s)}\n`;
    tx+=`🎁 Desconto especial: *− ${brl(d)}*\n\n`;
  }
  tx+=`💰 *Valor total: ${brl(t)}*\n`;
  tx+=`💳 Pagamento: ${pag}\n`;
  tx+=`⏳ Válido por ${vStr}\n\n`;
  if(obs) tx+=`📋 _${obs}_\n\n`;
  tx+=`━━━━━━━━━━━━━━━━━━━━━━━\n`;
  tx+=`✅ *Para confirmar, é só responder aqui!*\n`;
  tx+=`_Assim que aprovado, agendamos tudo com prioridade._ 🗓️\n\n`;
  tx+=`_Qualquer dúvida estou à disposição. 😊_\n\n`;
  tx+=`*${CFG.nome}*`;
  if(CFG.tel) tx+=`\n📞 ${CFG.tel}`;
  return tx;
}
function gerarPrev(){ document.getElementById('prev-wa').textContent=txtWA(); }
function copiarWA(){ navigator.clipboard.writeText(txtWA()).then(()=>toast('✅ Copiado!')).catch(()=>toast('✅ Copiado!')); }
function enviarWA(){
  let tel=(gV('tel-cli')||'').replace(/\D/g,'');
  if(!tel){ toast('⚠️ Informe o telefone do cliente'); return; }
  if(!tel.startsWith('55')) tel='55'+tel;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(txtWA())}`, '_blank');
  salvarChip();
}

// ──────────────────────────────────────────────────
//  SALVAR ORÇAMENTO (sem PDF)
// ──────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════
//  SINCRONIZAÇÃO RESILIENTE COM SUPABASE (proteção contra coluna ausente)
// ────────────────────────────────────────────────────────────────────
//  Se o código gravar uma coluna que ainda não existe no banco, o Supabase
//  rejeita a operação INTEIRA — e, se ignorarmos o erro, o registro deixa de
//  sincronizar SEM avisar ninguém (foi o que aconteceu com origem_cliente e
//  derrubou todos os orçamentos). Estes wrappers detectam a coluna que falta,
//  removem do payload e reenviam — registrando um aviso claro no console.
//  Use SEMPRE dbInsert/dbUpdate para gravar em tabelas, nunca db.from().insert direto.
function _colunaFaltante(err){
  if(!err) return null;
  const msg=((err.message||'')+' '+(err.details||'')+' '+(err.hint||''));
  // formatos comuns:
  //  PostgREST select: column "x" of relation "t" does not exist  /  column t.x does not exist
  //  PostgREST insert (schema cache): Could not find the 'x' column of 't' in the schema cache
  let m=msg.match(/column "?([a-z_][a-z0-9_]*)"? of relation/i)
       || msg.match(/find the '([a-z_][a-z0-9_]*)' column/i)
       || msg.match(/column ["']?[a-z_]+\.([a-z_][a-z0-9_]*)["']? does not exist/i)
       || msg.match(/column ["']?([a-z_][a-z0-9_]*)["']? does not exist/i);
  return m?m[1]:null;
}
// Envolve uma query do Supabase num timeout — evita que o app fique preso
// em "Salvando…" para sempre quando a rede falha sem responder.
function _dbRace(promise, ms=12000){
  return Promise.race([
    Promise.resolve(promise),
    new Promise(res=>setTimeout(()=>res({ data:null, error:{ message:'timeout: banco não respondeu em '+(ms/1000)+'s', _timeout:true } }), ms))
  ]);
}
async function dbInsert(table, payload, select){
  let p={...payload};
  for(let i=0;i<8;i++){
    let q=db.from(table).insert([p]);
    if(select) q=q.select(select).single(); else q=q.select('*').single();
    const r=await _dbRace(q);
    if(!r.error) return r;
    const col=_colunaFaltante(r.error);
    if(col && (col in p)){ delete p[col]; console.warn(`[dbInsert ${table}] coluna "${col}" não existe no banco — reenviando sem ela. Crie a coluna no Supabase.`); continue; }
    return r; // outro erro: devolve para o chamador tratar
  }
  return { data:null, error:{ message:'dbInsert: colunas faltantes demais em '+table } };
}
async function dbUpdate(table, payload, idCol, idVal){
  let p={...payload};
  for(let i=0;i<8;i++){
    const r=await _dbRace(db.from(table).update(p).eq(idCol,idVal));
    if(!r.error) return r;
    const col=_colunaFaltante(r.error);
    if(col && (col in p)){ delete p[col]; console.warn(`[dbUpdate ${table}] coluna "${col}" não existe no banco — reenviando sem ela.`); continue; }
    return r;
  }
  return { error:{ message:'dbUpdate: colunas faltantes demais em '+table } };
}
// Upsert resiliente — insere ou atualiza pela PK; ideal p/ tabelas com id texto (vistorias).
// Remove coluna ausente e reenvia, como dbInsert/dbUpdate.
async function dbUpsert(table, payload){
  let p={...payload};
  for(let i=0;i<8;i++){
    const r=await _dbRace(db.from(table).upsert([p]).select('*').single());
    if(!r.error) return r;
    const col=_colunaFaltante(r.error);
    if(col && (col in p)){ delete p[col]; console.warn(`[dbUpsert ${table}] coluna "${col}" não existe no banco — reenviando sem ela.`); continue; }
    return r;
  }
  return { data:null, error:{ message:'dbUpsert: colunas faltantes demais em '+table } };
}
// Insere um registro atribuindo o próximo `numero` de forma segura contra
// concorrência. Sem isto, dois usuários simultâneos liam o mesmo "max+1" e
// geravam OS/orçamentos com número duplicado. Aqui, se o banco rejeitar o
// número por já existir (UNIQUE, código 23505), tentamos o próximo automaticamente.
// Requer índice único em `numero` (ver migração migracao-numero-unico.sql).
async function dbInsertNumerado(table, payload, tentativas=6){
  for(let t=0;t<tentativas;t++){
    const {data:rows}=await _dbRace(db.from(table).select('numero').order('numero',{ascending:false}).limit(1));
    const num=(rows&&rows.length?(rows[0].numero||0):0)+1+t; // +t evita reusar o mesmo nº em colisões seguidas
    const r=await dbInsert(table, {...payload, numero:num});
    if(!r.error) return r;
    const msg=(r.error.message||'').toLowerCase();
    const conflito = r.error.code==='23505' || /duplicate key|unique|already exists|violates unique/.test(msg);
    if(conflito) continue; // outro usuário pegou esse número — tenta o próximo
    return r; // erro diferente: devolve ao chamador
  }
  return { data:null, error:{ message:'dbInsertNumerado: não conseguiu número único em '+table } };
}
// Compat: helpers de orçamento agora delegam ao wrapper genérico
async function orcSyncInsert(payload){ return dbInsert('orcamentos', payload); }
async function orcSyncUpdate(id, payload){ return dbUpdate('orcamentos', payload, 'id', id); }
// Reenvia ao banco orçamentos que ficaram presos só no aparelho (id local_*),
// ex.: criados enquanto o insert falhava pela coluna origem_cliente ausente.
// Tombstones genéricos por chave de localStorage — mesmo padrão já provado em
// _locTombLer/_visTombLer (locais_vistoria/vistorias), só parametrizado para
// não copiar o par de funções a cada tabela nova.
function _tombLer(chave){ try{ return JSON.parse(ls(chave)||'[]'); }catch(e){ return []; } }
// Extrai a idade (ms) de um id local no padrão 'prefixo_<Date.now()>...' —
// usado pra não reenviar pro banco registro "só local" travado há dias
// (achado real 11/08: registro velho preso no cache, de um bug já corrigido,
// vazava em massa assim que uma sincronização finalmente rodava de novo).
// id sem número reconhecível (formato diferente) retorna idade 0 — trata
// como recente, não bloqueia por via das dúvidas.
const DOIS_DIAS_MS=2*24*60*60*1000;
function _idadeIdMs(id){
  // Pega o número de 10-13 dígitos (timestamp Date.now()) em QUALQUER posição do
  // id — split('_')[1] quebrava pra prefixo de 2 partes como 'local_os_<ts>'
  // (pegava "os", não o timestamp). Regex acha o timestamp onde quer que esteja.
  const m=String(id).match(/\d{10,13}/);
  const t=m?parseInt(m[0]):NaN;
  return isFinite(t) ? Date.now()-t : 0;
}
function _tombAdd(chave,id){ const t=_tombLer(chave); if(!t.includes(id)){ t.push(id); lsSet(chave, JSON.stringify(t.slice(-500))); } }

// ── OS OFFLINE: nunca perder uma OS por falta de conexão ───────────────────
// gerarOSPDF/criarOSdeAprovacao, sem conexão, só incrementavam um contador de
// exibição (fluxa_os_num) — a OS não ia pra lugar nenhum, nem local nem
// remoto. O técnico via "OS #003 criada", imprimia, e a OS não existia em
// lugar nenhum. Daqui pra frente toda OS que não confirma salvar no banco
// passa por aqui: id local_os_<ts> (nova) ou o id real com _pendingSync
// (edição sem conexão sobre OS já existente).
function _salvarOSLocal(rec){
  const lista=(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]'); }catch(e){ return []; } })();
  const i=lista.findIndex(x=>x.id===rec.id);
  if(i>=0) lista[i]=rec; else lista.unshift(rec);
  lsSet('fluxa_os_hist', JSON.stringify(lista.slice(0,200)));
  todosOS=[rec, ...todosOS.filter(x=>x.id!==rec.id)];
}
// Reenvia OS presas no aparelho: criadas offline (id local_os_*, vira insert
// numerado) ou editadas offline sobre uma OS já existente (_pendingSync sobre
// id real, vira update). Mesmo padrão de _pendingSync já usado em vistorias.
async function _reenviarOSLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    try{
      const payload={...rec}; delete payload.id; delete payload._pendingSync; delete payload.numero;
      const ehNova=String(rec.id).startsWith('local_os_');
      let ins=null, error=null;
      if(ehNova){ const r=await dbInsertNumerado('ordens_servico', payload); ins=r.data; error=r.error; }
      else{ const r=await dbUpdate('ordens_servico', payload, 'id', rec.id); error=r.error; }
      if(error){ console.warn('[reenvioOSLocal] falhou #'+(rec.numero||'?')+':', error.message); continue; }
      const lista=(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]'); }catch(e){ return []; } })();
      const i=lista.findIndex(x=>x.id===rec.id);
      if(ehNova && ins){
        if(i>=0) lista.splice(i,1);
        lista.unshift(ins);
        todosOS=todosOS.filter(x=>x.id!==rec.id); todosOS.unshift(ins);
      } else {
        const atualizado={...rec}; delete atualizado._pendingSync;
        if(i>=0) lista[i]=atualizado;
        todosOS=todosOS.map(x=>x.id===rec.id?atualizado:x);
      }
      lsSet('fluxa_os_hist', JSON.stringify(lista.slice(0,200)));
      mudou=true;
    }catch(e){ console.warn('[reenvioOSLocal] erro:', e?.message||e); }
  }
  return mudou;
}

async function _reenviarOrcamentosLocais(soLocal){
  if(!dbOk||!db||!soLocal||!soLocal.length) return false;
  let mudou=false;
  for(const rec of soLocal){
    try{
      const payload={...rec}; delete payload.id; // banco gera o id definitivo
      const {data:ins,error}=await orcSyncInsert(payload);
      if(error){ console.warn('[reenvioLocal] falhou #'+(rec.numero||'?')+':', error.message); continue; }
      if(ins){
        lsOrcRemover(rec.id); lsOrcUpsert(ins);
        todosOrc=todosOrc.filter(x=>x.id!==rec.id);
        todosOrc.unshift(ins);
        mudou=true;
      }
    }catch(e){ console.warn('[reenvioLocal] erro:', e?.message||e); }
  }
  return mudou;
}

async function salvarApenas(){
  const btn=document.getElementById('btn-salvar');
  const dados=coletarForm();
  if(!dados.cli||dados.cli==='—'){ toast('⚠️ Informe o nome do cliente'); return; }
  if(!dados.origem){ toast('⚠️ Informe de onde veio o cliente'); document.getElementById('origem-cli')?.focus(); document.getElementById('origem-cli')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  if(!dados.loc){ avisarCampoObrigatorio('loc','Informe o local do serviço — sem ele a rota do técnico e a OS gerada ficam incompletas.'); return; }
  btn.disabled=true; btn.textContent='Salvando…';
  let savedNum=null;
  try{
    const now=new Date().toISOString();
    const camposBase={
      cliente:dados.cli, cliente_id:_orcClienteSelecionado?.id||null, local_servico:dados.loc, tel_cliente:dados.tel, cnpj:dados.cnpj||null,
      loja_id:dados.loja_id||LOJA_PADRAO_ID,
      origem_cliente:dados.origem||null,
      servicos:dados.svcs, subtotal:dados.sub, desconto:dados.desc, total:dados.tot,
      pagamento:dados.pagFormatado, pag_cod:dados.pag, pag_parcelas:dados.pagParcelas, pag_entrada:dados.pagEntrada,
      validade_dias:dados.dias, validade_data:dados.vData,
      data_servico:dados.dataSvc, escopo:dados.escopo, obs:dados.obs,
      foto_base64:fotosB64.filter(Boolean).length?JSON.stringify(fotosB64.filter(Boolean)):null, nota_interna:gV('nota-interna')||null
    };

    if(editId){
      // ── EDITAR ──
      const existing=todosOrc.find(x=>x.id===editId)||{};
      savedNum=existing.numero||lsOrcProxNum();
      const updated={...existing,...camposBase,id:editId,numero:savedNum};
      // 1. Salva local
      lsOrcUpsert(updated);
      const idx=todosOrc.findIndex(x=>x.id===editId);
      if(idx>=0) todosOrc[idx]=updated; else todosOrc.unshift(updated);
      // 2. Tenta sincronizar com BD (sem bloquear)
      if(dbOk&&db&&!String(editId).startsWith('local_')){
        orcSyncUpdate(editId, camposBase).then(r=>{
          if(r.error) console.warn('[salvarApenas] update falhou:', r.error.message);
          else _fotosOrcParaStorage(editId, fotosB64.filter(Boolean));
        }).catch(e=>console.warn('[salvarApenas] update erro:', e?.message||e));
      }
      _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id);
      toast('✅ Orçamento atualizado!');
    } else {
      // ── NOVO ──
      const tempId='local_'+Date.now();
      const num=lsOrcProxNum(); savedNum=num;
      const rec={...camposBase, id:tempId, numero:num, status:'pendente', data_criacao:now};
      _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id);
      // 1. Salva local IMEDIATAMENTE
      lsOrcUpsert(rec);
      todosOrc.unshift(rec);
      editId=tempId;
      toast('✅ Orçamento #'+String(num).padStart(3,'0')+' salvo!');
      // 2. Tenta sincronizar com BD em background
      if(dbOk&&db){
        (async()=>{
          try{
            const {data:ins,error:insErr}=await dbInsertNumerado('orcamentos',{...camposBase,status:'pendente',data_criacao:now});
            if(insErr){ console.warn('Sync BD falhou — orçamento permanece local:', insErr.message); return; }
            if(ins){
              lsOrcRemover(tempId);
              lsOrcUpsert(ins);
              todosOrc=todosOrc.filter(x=>x.id!==tempId);
              todosOrc.unshift(ins);
              if(editId===tempId) editId=ins.id; // só atualiza se AINDA estiver neste orçamento
              savedNum=ins.numero;
              atualizarDash(); renderTabela();
              _fotosOrcParaStorage(ins.id, fotosB64.filter(Boolean));
            }
          }catch(e){ console.warn('Sync BD falhou — salvo local:', e?.message||e); }
        })();
      }
    }
    salvarChip();
    autoSalvarClienteDoOrc(dados);
    // Se o orçamento editado já está aprovado, reconcilia o estoque (qtd/produtos podem ter mudado)
    { const _o=todosOrc.find(x=>x.id===editId); if(_o&&_o.status==='aprovado') sincronizarBaixaOrcamento(_o); }
    atualizarDash(); renderTabela();
    if(document.getElementById('toggle-os')?.checked) await criarOSjunto(dados, savedNum);
    limparRascunho('form');
    toast(`✅ Orçamento #${String(savedNum).padStart(3,'0')} salvo!`);
    // Após salvar (edição OU novo): limpa o form (evita dados/duplicata do
    // orçamento anterior) e volta ao histórico.
    _limparCamposOrc();
    go('history');
  }catch(e){ console.error(e); toast('⚠️ Erro ao salvar: '+e.message); }
  btn.disabled=false; btn.textContent='Salvar Orçamento';
}


// ──────────────────────────────────────────────────
//  GERAR PDF ORÇAMENTO
// ──────────────────────────────────────────────────
async function gerarPDF(){
  const btn=document.getElementById('btn-pdf');
  const dadosPre=coletarForm();
  if(!dadosPre.origem){ toast('⚠️ Informe de onde veio o cliente'); document.getElementById('origem-cli')?.focus(); document.getElementById('origem-cli')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  if(!dadosPre.loc){ avisarCampoObrigatorio('loc','Informe o local do serviço — sem ele a rota do técnico e a OS gerada ficam incompletas.'); return; }
  btn.disabled=true; btn.textContent='Gerando…';
  const dados=dadosPre;
  const now=new Date().toISOString();
  const camposBase={
    cliente:dados.cli, cliente_id:_orcClienteSelecionado?.id||null, local_servico:dados.loc, tel_cliente:dados.tel, cnpj:dados.cnpj||null,
    loja_id:dados.loja_id||LOJA_PADRAO_ID,
    origem_cliente:dados.origem||null,
    servicos:dados.svcs, subtotal:dados.sub, desconto:dados.desc, total:dados.tot,
    pagamento:dados.pagFormatado, pag_cod:dados.pag, pag_parcelas:dados.pagParcelas, pag_entrada:dados.pagEntrada,
    validade_dias:dados.dias, validade_data:dados.vData,
    data_servico:dados.dataSvc, escopo:dados.escopo, obs:dados.obs,
    foto_base64:fotosB64.filter(Boolean).length?JSON.stringify(fotosB64.filter(Boolean)):null, nota_interna:gV('nota-interna')||null
  };
  let num=null;
  _autoSalvarCliente(dados.cli, dados.tel, dados.loc, dados.cnpj, dados.loja_id);

  if(editId){
    // Editando: mantém número existente
    const existing=todosOrc.find(x=>x.id===editId)||{};
    num=existing.numero||lsOrcProxNum();
    const updated={...existing,...camposBase,id:editId,numero:num};
    lsOrcUpsert(updated);
    const idx=todosOrc.findIndex(x=>x.id===editId);
    if(idx>=0) todosOrc[idx]=updated;
    if(dbOk&&db&&!String(editId).startsWith('local_')){
      orcSyncUpdate(editId, camposBase).then(r=>{
        if(r.error) console.warn('[gerarPDF] update falhou:', r.error.message);
        else _fotosOrcParaStorage(editId, fotosB64.filter(Boolean));
      }).catch(e=>console.warn('[gerarPDF] update erro:', e?.message||e));
    }
  } else {
    // Novo: salva local primeiro, depois sincroniza BD
    num=lsOrcProxNum();
    const tempId='local_'+Date.now();
    const rec={...camposBase,id:tempId,numero:num,status:'pendente',data_criacao:now};
    lsOrcUpsert(rec);
    todosOrc.unshift(rec);
    editId=tempId;
    logAcao('orcamento_criado', `#${num} ${camposBase.cliente||''} · R$ ${(camposBase.total||0).toFixed(2)}`);
    if(dbOk&&db){
      (async()=>{
        try{
          const {data:ins,error:insErr}=await dbInsertNumerado('orcamentos',{...camposBase,status:'pendente',data_criacao:now});
          if(insErr){ console.warn('gerarPDF: sync BD falhou — orçamento permanece local:', insErr.message); return; }
          if(ins){
            lsOrcRemover(tempId);
            lsOrcUpsert(ins);
            todosOrc=todosOrc.filter(x=>x.id!==tempId);
            todosOrc.unshift(ins);
            if(editId===tempId) editId=ins.id; // só atualiza se AINDA estiver neste orçamento
            num=ins.numero;
            atualizarDash(); renderTabela();
            _fotosOrcParaStorage(ins.id, fotosB64.filter(Boolean));
          }
        }catch(e){ console.warn('gerarPDF: sync BD falhou:', e?.message||e); }
      })();
    }
  }

  const numStr=String(num).padStart(3,'0');
  preencherDocOrc(dados, numStr);
  salvarChip();
  { const _o=todosOrc.find(x=>x.id===editId); if(_o&&_o.status==='aprovado') sincronizarBaixaOrcamento(_o); }
  limparRascunho('form'); // orçamento salvo → rascunho não deve vazar para o próximo
  btn.disabled=false; btn.textContent='Gerar PDF';
  if(document.getElementById('toggle-os')?.checked){
    await criarOSjunto(dados, num);
  } else {
    imprimirDoc('orc');
  }
  // Após gerar PDF: limpa o form (evita dados/duplicata do anterior) e volta ao histórico
  _limparCamposOrc();
  go('history');
}

function updOrigemCli(){
  const sel=gV('origem-cli');
  const wrap=document.getElementById('origem-cli-outro-wrap');
  if(wrap) wrap.style.display=(sel==='outro')?'':'none';
}
function setOrigemCli(valor){
  const sel=document.getElementById('origem-cli');
  if(!sel) return;
  if(!valor){ sel.value=''; setV('origem-cli-outro',''); updOrigemCli(); return; }
  const opcao=[...sel.options].find(o=>o.value===valor);
  if(opcao){ sel.value=valor; setV('origem-cli-outro',''); }
  else { sel.value='outro'; setV('origem-cli-outro',valor); }
  updOrigemCli();
}
function getOrigemCli(){
  const sel=gV('origem-cli');
  if(sel==='outro') return (gV('origem-cli-outro')||'').trim();
  return sel||'';
}

function coletarForm(){
  const base=gV('data-orc'), dias=parseInt(gV('val'))||5;
  let dataStr=new Date().toLocaleDateString('pt-BR'), vData='';
  if(base){ dataStr=new Date(base+'T12:00:00').toLocaleDateString('pt-BR'); const dv=new Date(base+'T12:00:00'); dv.setDate(dv.getDate()+dias); vData=dv.toLocaleDateString('pt-BR'); }
  return { cli:gV('cli')||'—', loc:gV('loc'), tel:gV('tel-cli'), cnpj:gV('cnpj-cli'),
    loja_id:gV('orc-loja')||LOJA_PADRAO_ID,
    origem:getOrigemCli(),
    pag:gV('pag'), pagFormatado:formatPagamento(gV('pag'),tot()),
    pagParcelas:parseInt(gV('pag-parcelas'))||null,
    pagEntrada:parseFloat((gV('pag-entrada')||'').replace(',','.'))||null,
    dias, obs:gV('obs'),
    escopo:gV('escopo'), dataSvc:gV('data-svc'), dataStr, vData, sub:sub(), desc:disc(sub()), tot:tot(),
    svcs:svcs.filter(s=>s.d.trim()).map(s=>({desc:s.d.trim(),preco:gP(s),precoUnit:parseFloat(s.p)||0,qty:parseInt(s.qty)||1,produto_id:s.produto_id||null,avulso:s.avulso||false})) };
}

// ══════════════════════════════════════════════════
//  ORDEM DE ENTREGA — comprovante que viaja com a mercadoria
//  Venda de produto avulso (químico, peça) não gera OS: o material só sai e
//  alguém no local recebe. Este é o papel que o comprador confere e assina.
//  NÃO cria registro no banco — é derivado do orçamento, então pode ser
//  reimpresso quantas vezes precisar sem duplicar nada.
// ══════════════════════════════════════════════════
function preencherDocEntrega(orc){
  const LC=getLojaConfig(orc.loja_id||lojaAtiva);
  const c1=LC.cor, c2=LC.cor2;
  document.getElementById('pd-header-ent').style.background=c1;
  document.getElementById('pd-thead-ent').style.background=c2;
  document.getElementById('pd-foot-ent').style.background=c2;
  document.getElementById('pd-cli-bar-ent').style.background=c1;
  document.getElementById('pd-obs-bar-ent').style.background=c1;
  const logoEl=document.getElementById('pd-hdr-logo-ent'), initEl=document.getElementById('pd-hdr-init-ent');
  if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
  else { logoEl.className='pd-hdr-logo-img'; initEl.textContent=(LC.nome||'?').charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  setV_el('pd-nm-ent',LC.nome,'textContent');
  setV_el('pd-sb-ent',LC.sub,'textContent');
  const tagEnt=document.getElementById('pd-tag-ent'); if(tagEnt){ tagEnt.textContent=LC.tagline||''; tagEnt.style.display=LC.tagline?'block':'none'; }
  setV_el('pd-cont-ent',[LC.tel,LC.cidades].filter(Boolean).join('  ·  ')||LC.nome,'textContent');

  const numStr=String(orc.numero||'?').padStart(3,'0');
  setV_el('pd-num-ent','#'+numStr,'textContent');
  // Data da entrega vai em branco de propósito: a entrega costuma acontecer dias
  // depois da aprovação, e quem preenche é quem recebe, na hora.
  document.getElementById('pd-meta-ent').innerHTML=
    'Ref. Orçamento <strong>#'+esc(numStr)+'</strong><br>Data da entrega: ____ / ____ / ______';
  setV_el('pd-cli-nm-ent',orc.cliente||'—','textContent');
  setV_el('pd-cli-loc-ent',orc.local||'','textContent');
  setV_el('pd-sign-resp-ent','Entregue por — '+(LC.nome||''),'textContent');
  setV_el('pd-foot-ent',(LC.nome||'')+(LC.tel?'   ·   '+LC.tel:'')+(LC.cidades?'   ·   '+LC.cidades:''),'textContent');

  // Lista TODOS os itens, não só os com produto_id: químico digitado à mão não
  // tem vínculo de produto e mesmo assim precisa ser conferido na entrega.
  let svcs=orc.servicos;
  if(typeof svcs==='string'){ try{ svcs=JSON.parse(svcs||'[]'); }catch(e){ console.warn('[docEntrega svcs]',e?.message||e); svcs=[]; } }
  svcs=Array.isArray(svcs)?svcs:[];
  const tb=document.getElementById('pd-tbody-ent');
  tb.innerHTML = svcs.length
    ? svcs.map((s,i)=>'<tr>'+
        '<td style="text-align:center;font-size:19px;line-height:1;padding-top:7px;padding-bottom:7px">☐</td>'+
        '<td>'+(i+1)+'</td>'+
        '<td>'+esc(s.desc||'—')+'</td>'+
        '<td style="text-align:center;font-weight:700">'+fmtQtd(parseFloat(s.qty)||1)+'</td>'+
      '</tr>').join('')
    : '<tr><td colspan="4" style="text-align:center;color:#777">Sem itens no orçamento</td></tr>';
  return svcs.length;
}

// Abre a Ordem de Entrega para impressão (histórico ou modal de aprovação)
function gerarOrdemEntrega(orcId){
  const orc=(todosOrc||[]).find(o=>String(o.id)===String(orcId));
  if(!orc){ toast('⚠️ Orçamento não encontrado'); return; }
  if(!preencherDocEntrega(orc)){ toast('⚠️ Este orçamento não tem itens para entregar'); return; }
  imprimirDoc('entrega');
}

function preencherDocOrc(d, num){
  const LC=getLojaConfig(d.loja_id||lojaAtiva); // fix #4: fallback para loja ativa se registro antigo sem loja_id
  const c1=LC.cor, c2=LC.cor2;
  // header
  document.getElementById('pd-header-orc').style.background=c1;
  document.getElementById('pd-thead-orc').style.background=c2;
  document.getElementById('pd-foot-orc').style.background=c2;
  document.getElementById('pd-cli-bar-orc').style.background=c1;
  // logo or initials
  const logoEl=document.getElementById('pd-hdr-logo-orc'), initEl=document.getElementById('pd-hdr-init-orc');
  if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
  else { logoEl.className='pd-hdr-logo-img'; initEl.textContent=LC.nome.charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  // names + tagline
  setV_el('pd-nm-orc',LC.nome,'textContent');
  setV_el('pd-sb-orc',LC.sub,'textContent');
  const tagOrc=document.getElementById('pd-tag-orc'); if(tagOrc){ tagOrc.textContent=LC.tagline||''; tagOrc.style.display=LC.tagline?'block':'none'; }
  const contato=[LC.tel,LC.cidades].filter(Boolean).join('  ·  ');
  setV_el('pd-cont-orc',contato||LC.nome,'textContent');
  setV_el('pd-num-orc','#'+num,'textContent');
  const validStr=d.vData?`Válido até ${d.vData}`:`${d.dias} dias de validade`;
  document.getElementById('pd-meta-orc').innerHTML=`Data de emissão: <strong>${d.dataStr}</strong><br>${validStr}`;
  setV_el('pd-cli-nm-orc',d.cli,'textContent');
  setV_el('pd-cli-loc-orc',d.loc||'','textContent');
  setV_el('pd-pag-orc',d.pagFormatado||d.pag,'textContent');
  setV_el('pd-val-orc',d.dias+' dias'+(d.vData?' · até '+d.vData:''),'textContent');
  setV_el('pd-sign-resp-orc',LC.nome+' — Responsável Técnico','textContent');
  setV_el('pd-foot-orc',LC.nome+(LC.tel?'   ·   '+LC.tel:'')+(LC.cidades?'   ·   '+LC.cidades:''),'textContent');
  // table body
  const tb=document.getElementById('pd-tbody-orc'); tb.innerHTML='';
  const temMulti=d.svcs.some(s=>(parseInt(s.qty)||1)>1);
  document.getElementById('pd-thead-orc').innerHTML=temMulti
    ?'<th>#</th><th>Descrição</th><th>Qtd × Unit.</th><th>Total</th>'
    :'<th>#</th><th>Descrição</th><th>Valor</th>';
  d.svcs.forEach((s,i)=>{
    const tr=document.createElement('tr');
    const qty=parseInt(s.qty)||1;
    if(temMulti){
      const qtyUnit=s.preco>0?`${qty} × ${brl(s.precoUnit||0)}`:'—';
      const total=s.preco>0?brl(s.preco):'—';
      tr.innerHTML=`<td>${i+1}</td><td>${esc(s.desc)}</td><td>${qtyUnit}</td><td>${total}</td>`;
    } else {
      tr.innerHTML=`<td>${i+1}</td><td>${esc(s.desc)}</td><td>${s.preco>0?brl(s.preco):'—'}</td>`;
    }
    tb.appendChild(tr);
  });
  // totals block (below table, outside table element)
  const tw=document.getElementById('pd-totals-orc');
  let th='';
  if(d.desc>0){
    th+=`<div class="pd-tot-row"><span>Subtotal</span><span>${brl(d.sub)}</span></div>`;
    th+=`<div class="pd-tot-row is-dis"><span>Desconto aplicado</span><span>− ${brl(d.desc)}</span></div>`;
  }
  th+=`<div class="pd-tot-final" style="background:${c1}"><span class="pd-tot-final-lbl">Total</span><span class="pd-tot-final-val">${brl(d.tot)}</span></div>`;
  tw.innerHTML=th;
  // fotos
  const fotosSec=document.getElementById('pd-fotos-orc-section');
  const fotosGrid=document.getElementById('pd-fotos-orc-grid');
  const fotosArr=(Array.isArray(fotosB64)?fotosB64:[]).filter(Boolean);
  if(fotosSec && fotosGrid && fotosArr.length){
    const n=fotosArr.length;
    // Colunas por quantidade; largura de coluna FIXA (não estica p/ largura da
    // página) + altura casada → fotos proporcionais e uniformes, sem faixa gigante.
    const cols = n===1?1 : n<=4?2 : 3;
    const cellW = n===1?200 : cols===2?230 : 150; // px
    const cellH = Math.round(cellW*0.75);           // 4:3
    fotosGrid.style.gridTemplateColumns=`repeat(${cols}, ${cellW}px)`;
    fotosGrid.innerHTML=fotosArr.map(b=>`<img src="${b}" style="width:${cellW}px;height:${cellH}px">`).join('');
    fotosSec.style.display='block';
  } else if(fotosSec){
    fotosSec.style.display='none';
  }
  // escopo
  const escopoEl=document.getElementById('pd-escopo-orc');
  if(escopoEl){ if(d.escopo){ document.getElementById('pd-escopo-txt-orc').textContent=d.escopo; escopoEl.style.display='block'; } else escopoEl.style.display='none'; }
  // obs
  const ob=document.getElementById('pd-obs-orc');
  if(d.obs){
    document.getElementById('pd-obs-txt-orc').textContent=d.obs;
    document.getElementById('pd-obs-bar-orc').style.background=c1;
    ob.style.display='flex';
  } else ob.style.display='none';
}

// ──────────────────────────────────────────────────
//  ORDEM DE SERVIÇO
// ──────────────────────────────────────────────────
function initOS(){
  osSvcs=[];
  addOSSvc();
  renderOSSvcs();
}

function addOSSvc(d=''){
  osSvcs.push({id:Date.now()+Math.random(),d});
  renderOSSvcs();
}

// ──────────────────────────────────────────────────
//  CHECKLIST DE EXECUÇÃO (OS)
// ──────────────────────────────────────────────────
function renderOsChecklist(){
  const el=document.getElementById('os-chklist'); if(!el) return;
  if(!osChecklist.length){
    el.innerHTML='<div style="font-size:13px;color:var(--gray);padding:6px 0">Nenhum item. Adicione abaixo ou clique em ↺ Resetar.</div>';
    return;
  }
  el.innerHTML=osChecklist.map((item,i)=>`
    <div class="chk-item ${item.checked?'ok':''}" id="chk-item-${i}">
      <input type="checkbox" class="chk-cb" ${item.checked?'checked':''} onchange="toggleChk(${i},this.checked)">
      <div class="chk-body">
        <div class="chk-nome">${esc(item.nome)}</div>
        <input type="text" class="chk-obs-inp" placeholder="Observação (opcional)" value="${esc(item.obs||'')}" oninput="updChkObs(${i},this.value)">
      </div>
      <button class="chk-rm" onclick="rmChkItem(${i})" title="Remover item">✕</button>
    </div>`).join('');
}
function toggleChk(i, checked){
  if(!osChecklist[i]) return;
  osChecklist[i].checked=checked;
  const el=document.getElementById('chk-item-'+i);
  if(el){ el.className='chk-item'+(checked?' ok':''); }
  if(navigator.vibrate) navigator.vibrate(30);
}
function updChkObs(i, val){ if(osChecklist[i]) osChecklist[i].obs=val; }
function rmChkItem(i){ osChecklist.splice(i,1); renderOsChecklist(); }
function resetChecklist(){ osChecklist=OS_CHECKLIST_DEFAULT.map(x=>({...x})); renderOsChecklist(); }
function addChkItem(){
  const inp=document.getElementById('chk-add-inp'); if(!inp) return;
  const nome=inp.value.trim(); if(!nome){ toast('⚠️ Digite o nome do item'); return; }
  osChecklist.push({id:Date.now(), nome, checked:false, obs:''});
  inp.value=''; renderOsChecklist();
  // scroll para o último item
  const el=document.getElementById('os-chklist');
  if(el) el.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function renderOSSvcs(){
  const el=document.getElementById('os-slist'); el.innerHTML='';
  osSvcs.forEach(s=>{
    const r=document.createElement('div'); r.className='srow';
    r.innerHTML=`<div class="srow-t">
      <input type="text" placeholder="Descrição do serviço" value="${esc(s.d)}" data-id="${s.id}" oninput="updOSSvc(this)">
      <button class="btn-rm" onclick="rmOSSvc(${s.id})">✕</button>
    </div>`;
    el.appendChild(r);
  });
}
function updOSSvc(inp){ const s=osSvcs.find(x=>x.id===parseFloat(inp.dataset.id)); if(s) s.d=inp.value; }
function rmOSSvc(id){ if(osSvcs.length===1){toast('⚠️ Mín. 1');return;} osSvcs=osSvcs.filter(s=>s.id!==id); renderOSSvcs(); }

async function gerarOSPDF(modo='os'){
  const dados={
    cli:gV('os-cli')||'—', loc:gV('os-loc'), cnpj:gV('os-cnpj')||null, data:gV('os-data'), hora:gV('os-hora'),
    tec:gV('os-tec'), tot:parseFloat(gV('os-total'))||0,
    mat:gV('os-mat'), obs:gV('os-obs'),
    svcs:osSvcs.filter(s=>s.d.trim()).map(s=>s.d.trim()),
    fotos:osFotos.filter(Boolean), videoLink:gV('os-video-link'),
    checklist: osChecklist.filter(x=>x.checked),
    loja_id: gV('os-loja')||LOJA_PADRAO_ID
  };
  const orcId=osOrcId||null;
  const lojaIdOS=gV('os-loja')||LOJA_PADRAO_ID;
  const payload={orcamento_id:orcId,loja_id:lojaIdOS,cliente:dados.cli,cliente_id:_osClienteSelecionado?.id||null,local_servico:dados.loc,cnpj:dados.cnpj||null,data_servico:dados.data,hora:dados.hora,tecnico:dados.tec,servicos:dados.svcs,materiais:dados.mat,obs_tecnica:dados.obs,total:dados.tot,fotos:dados.fotos,video_link:dados.videoLink||null,checklist:dados.checklist.length?JSON.stringify(dados.checklist):null};
  let numStr='???', salvouOnline=false;
  if(dbOk&&db){
    try{
      if(osEditId && !String(osEditId).startsWith('local_')){
        // EDIÇÃO: atualiza a OS existente (mantém número e status)
        const existente=todosOS.find(x=>x.id===osEditId);
        await dbUpdate('ordens_servico', payload, 'id', osEditId);
        numStr=String(existente?.numero||'').padStart(3,'0')||'???';
        salvouOnline=true;
        toast('✅ OS atualizada');
      } else {
        const {data:insOS}=await dbInsertNumerado('ordens_servico',{...payload,status:'agendado'});
        numStr=String(insOS?.numero||'').padStart(3,'0')||'???';
        salvouOnline=true;
      }
    }catch(e){ console.warn('[gerarOSPDF] falha ao salvar OS no banco:', e?.message||e); }
  }
  if(!salvouOnline){
    // Offline, ou o salvamento online falhou: NUNCA deixa a OS existir só no
    // PDF impresso. Sempre grava local (fluxa_os_hist) e marca para reenvio
    // automático assim que a conexão voltar (_reenviarOSLocais).
    if(osEditId){
      const existente=todosOS.find(x=>x.id===osEditId);
      const rec={...(existente||{}), ...payload, id:osEditId, numero:existente?.numero, _pendingSync:true};
      _salvarOSLocal(rec);
      numStr=String(existente?.numero||'').padStart(3,'0')||'???';
      toast('💾 OS salva neste aparelho — sem conexão para sincronizar');
    } else {
      const n=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',String(n)); numStr=String(n).padStart(3,'0');
      const rec={...payload, id:'local_os_'+Date.now(), numero:n, status:'agendado', data_criacao:new Date().toISOString(), _pendingSync:true};
      _salvarOSLocal(rec);
      toast(dbOk&&db ? '⚠️ OS não sincronizou — salva neste aparelho, reenvio automático' : '💾 OS salva neste aparelho — sem conexão, reenvio automático quando voltar');
    }
  }

  // Se modo 'both', preenche também o orçamento vinculado
  if(modo==='both' && osOrcId){
    const o=todosOrc.find(x=>x.id===osOrcId);
    if(o){
      const numOrc=String(o.numero||0).padStart(3,'0');
      const base=o.validade_data?null:null; // já temos os dados
      const dadosOrc={
        cli:o.cliente||'—', loc:o.local_servico||'', pag:o.pagamento||'—',
        dias:o.validade_dias||5, obs:o.obs||'', dataSvc:o.data_servico||'',
        dataStr:new Date(o.data_criacao||Date.now()).toLocaleDateString('pt-BR'),
        vData:o.validade_data||'', sub:o.subtotal||0, desc:o.desconto||0, tot:o.total||0,
        svcs:o.servicos||[], loja_id:o.loja_id||LOJA_PADRAO_ID
      };
      const savedFotos=[...fotosB64];
      try{ const raw=o.foto_base64||''; fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]); }catch(e){ fotosB64=[]; }
      preencherDocOrc(dadosOrc, numOrc);
      fotosB64=savedFotos;
    }
  }

  autoSalvarClienteDoOrc({cli:dados.cli, loc:dados.loc, tel:dados.tel||'', cnpj:dados.cnpj||''});
  const _orcRef=osOrcId?todosOrc.find(x=>x.id===osOrcId):null;
  const _orcNumStr=_orcRef?String(_orcRef.numero||'').padStart(3,'0'):null;
  preencherDocOS({...dados, fotos:dados.fotos, videoLink:dados.videoLink, orcNum:_orcNumStr}, numStr);
  imprimirDoc(modo);
  // OS salva → limpa o rascunho para não vazar dados na próxima OS
  if(numStr!=='???') limparRascunho('os');
}

function preencherDocOS(d, num){
  const LC=getLojaConfig(d.loja_id||lojaAtiva); // fix #4: fallback para loja ativa se registro antigo sem loja_id
  const c1=LC.cor, c2=LC.cor2;
  document.getElementById('pd-header-os').style.background=c2;
  document.getElementById('pd-thead-os').style.background=c2;
  document.getElementById('pd-foot-os').style.background=c2;
  document.getElementById('pd-cli-bar-os').style.background=c1;
  // logo or initials
  const logoEl=document.getElementById('pd-hdr-logo-os'), initEl=document.getElementById('pd-hdr-init-os');
  if(LC.logoB64){ logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo'; initEl.className='pd-hdr-logo-initials'; }
  else { logoEl.className='pd-hdr-logo-img'; initEl.textContent=LC.nome.charAt(0).toUpperCase(); initEl.className='pd-hdr-logo-initials show-init'; }
  setV_el('pd-nm-os',LC.nome,'textContent');
  setV_el('pd-sb-os',LC.sub,'textContent');
  const tagOs=document.getElementById('pd-tag-os'); if(tagOs){ tagOs.textContent=LC.tagline||''; tagOs.style.display=LC.tagline?'block':'none'; }
  const contato=[LC.tel,LC.cidades].filter(Boolean).join('  ·  ');
  setV_el('pd-cont-os',contato||LC.nome,'textContent');
  setV_el('pd-num-os','#'+num,'textContent');
  const _orcRef=d.orcNum?` · Referente ao Orçamento <strong>#${d.orcNum}</strong>`:'';
  document.getElementById('pd-meta-os').innerHTML=`Emitida em: <strong>${new Date().toLocaleDateString('pt-BR')}</strong>${_orcRef}`;
  setV_el('pd-cli-nm-os',d.cli,'textContent');
  setV_el('pd-cli-loc-os',d.loc||'','textContent');
  setV_el('pd-data-os',d.data?new Date(d.data+'T12:00:00').toLocaleDateString('pt-BR'):'—','textContent');
  setV_el('pd-hora-os',d.hora||'—','textContent');
  setV_el('pd-tec-os',d.tec||LC.nome,'textContent');
  setV_el('pd-tot-os',d.tot>0?brl(d.tot):'A definir','textContent');
  setV_el('pd-sign-resp-os',LC.nome+' — Responsável Técnico','textContent');
  setV_el('pd-foot-os',LC.nome+(LC.tel?'   ·   '+LC.tel:'')+(LC.cidades?'   ·   '+LC.cidades:''),'textContent');
  const tb=document.getElementById('pd-tbody-os'); tb.innerHTML='';
  d.svcs.forEach((s,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${esc(s)}</td>`; tb.appendChild(tr); });
  const mb=document.getElementById('pd-mat-os');
  if(d.mat){ document.getElementById('pd-mat-txt-os').textContent=d.mat; mb.style.display='flex'; } else mb.style.display='none';
  const ob=document.getElementById('pd-obs-os');
  if(d.obs){
    document.getElementById('pd-obs-txt-os').textContent=d.obs;
    document.getElementById('pd-obs-bar-os').style.background=c1;
    ob.style.display='flex';
  } else ob.style.display='none';
  // checklist OS no PDF (itens verificados/feitos — dá profundidade ao relatório)
  const chkEl=document.getElementById('pd-checklist-os');
  if(chkEl){
    let chk=[];
    try{ chk=d.checklist?(typeof d.checklist==='string'?JSON.parse(d.checklist):d.checklist):[]; }catch(e){ chk=[]; }
    const ok=(chk||[]).filter(x=>x&&x.checked);
    if(ok.length){
      chkEl.style.display='block';
      chkEl.innerHTML='<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:8px">Checklist do Serviço</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">'+
        ok.map(x=>`<div style="display:flex;align-items:flex-start;gap:6px;font-size:11.5px;color:#374151"><span style="color:#16a34a;font-weight:700">✓</span><span>${esc(x.nome)}${x.obs?` <span style="color:#6b7280">— ${esc(x.obs)}</span>`:''}</span></div>`).join('')+
        '</div>';
    } else { chkEl.style.display='none'; chkEl.innerHTML=''; }
  }
  // fotos OS no PDF
  const fotosEl=document.getElementById('pd-fotos-os');
  const fotosArr=(d.fotos||[]).filter(Boolean);
  if(fotosEl){
    if(fotosArr.length){
      fotosEl.style.display='block';
      const nOS=fotosArr.length;
      const colsOS=nOS===1?1:nOS<=4?2:3;
      const wOS=nOS===1?200:colsOS===2?230:150, hOS=Math.round(wOS*0.75);
      fotosEl.innerHTML='<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:8px">Fotos do Serviço</div><div style="display:grid;grid-template-columns:repeat('+colsOS+','+wOS+'px);gap:8px;justify-content:center">'+
        fotosArr.map(f=>`<img src="${f}" style="width:${wOS}px;height:${hOS}px;object-fit:cover;border-radius:8px;border:1px solid #e9ecef">`).join('')+'</div>';
      if(d.videoLink) fotosEl.innerHTML+=`<div style="margin-top:8px;font-size:11px;color:#6b7280">📹 Vídeo: <a href="${esc(d.videoLink)}">${esc(d.videoLink)}</a></div>`;
    } else { fotosEl.style.display='none'; fotosEl.innerHTML=''; }
  }
}

// ──────────────────────────────────────────────────
//  HISTÓRICO
// ──────────────────────────────────────────────────
async function loadHist(){
  initOrcMes(); // garante que o mês de referência esteja definido
  // 1. SEMPRE mostra dados locais primeiro — sem depender do banco
  const local=lsOrcLer();
  if(local.length>0) todosOrc=local;
  verificarVencidos();
  atualizarDash(); renderTabela();

  // 2. Se BD disponível: sincroniza em background e atualiza a view
  if(dbOk&&db){
    try{
      const {data,error}=await db.from('orcamentos').select('*').order('data_criacao',{ascending:false});
      if(error) throw error;
      let remoto=data;
      // Respeita tombstones: orçamento apagado não volta. Se o delete anterior
      // falhou (linha ainda viva no banco), tenta apagar de novo aqui.
      const _tombOrc=new Set(_tombLer('fluxa_orc_tombstones'));
      if(_tombOrc.size){
        remoto.filter(r=>_tombOrc.has(r.id)).forEach(r=>db.from('orcamentos').delete().eq('id',r.id).then(()=>{}).catch(()=>{}));
        remoto=remoto.filter(r=>!_tombOrc.has(r.id));
      }
      // Merge: BD é fonte de verdade + mantém registros local-only ainda não sincronizados
      const dbIds=new Set(remoto.map(x=>x.id));
      // Só reenvia órfão local recente — mesma guarda de 48h do carregarClientesRemoto,
      // achado real 11/08: registro preso há dias de um bug já corrigido não deve
      // ressurgir em massa na primeira sincronização.
      const soLocal=todosOrc.filter(x=>String(x.id).startsWith('local_')&&!dbIds.has(x.id)&&_idadeIdMs(x.id)<DOIS_DIAS_MS);
      todosOrc=[...remoto,...soLocal];
      _orcRemotoOk=true; // orçamentos confirmados pelo banco — libera a reconciliação de órfãs
      lsOrcSalvar(todosOrc);
      verificarVencidos();
      atualizarDash(); renderTabela();
      // Recupera orçamentos presos só no aparelho (não sincronizados) → reenvia ao banco
      if(soLocal.length){
        const mudou=await _reenviarOrcamentosLocais(soLocal);
        if(mudou){ lsOrcSalvar(todosOrc); verificarVencidos(); atualizarDash(); renderTabela(); }
      }
      // Migração única: aprovados sem data_aprovacao recebem data_criacao como referência
      await _migrarDataAprovacao();
      // _migrarClientesDeOrcamentos() DESLIGADA (2026-08-11) — investigação do
      // incidente de duplicação de clientes em produção aponta ela como causa
      // raiz mais provável: chamada aqui SEM NENHUMA guarda de "já rodou",
      // toda vez que loadHist() sincroniza com sucesso (6+ call sites). Cada
      // execução varre TODOS os orçamentos/OS e, pra cada nome sem ficha no
      // CACHE LOCAL do aparelho (lsCliLer — que pode estar incompleto, ver
      // bug separado de corte em 1000 linhas no carregarClientesRemoto,
      // corrigido), cria uma ficha nova. Em vários aparelhos/abas
      // reconectando perto um do outro, cada um decide independentemente
      // "esse cliente não existe" pro mesmo nome e cria duplicata — bate com
      // o padrão observado (dezenas de nomes DIFERENTES inseridos dentro do
      // mesmo segundo, não o mesmo nome repetido). Ver seção de incidente no
      // topo deste arquivo antes de reativar.
      // _migrarClientesDeOrcamentos();
    }catch(e){ console.warn('Sync do histórico falhou:', e?.message||e); }
  }
}

// ⚠️ DESATIVADA (2026-08-11) — suspeita forte de ser a causa raiz do incidente
// de duplicação de clientes em produção. NÃO reativar sem: (1) confirmar que
// carregarClientesRemoto() nunca devolve lista incompleta (paginação já
// corrigida, mas verificar de novo), e (2) trocar a chamada automática por um
// botão explícito, com o gestor decidindo quando rodar — nunca de novo como
// efeito colateral silencioso de abrir uma tela. Ver seção de incidente no
// topo do CLAUDE.md.
// Migração única: aprovados sem data_aprovacao → usa data_criacao como referência contábil
// Importa clientes de orçamentos/OS históricos para a base (roda uma vez após sync)
// Regra: loja_id='aquamotor' → grupo Aquamotor. Qualquer outra → grupo Fortemp.
function _migrarClientesDeOrcamentos(){
  const todos=[...todosOrc,...todosOS];
  let lista=lsCliLer();
  let mudou=false;
  todos.forEach(o=>{
    const nome=(o.cliente||'').trim(); if(!nome||nome==='—') return;
    const lojaId=o.loja_id||null;
    const eAqua=lojaId==='aquamotor';
    const jaExiste=lista.some(c=>
      (c.nome||'').toLowerCase()===nome.toLowerCase() &&
      (eAqua ? c.loja_id==='aquamotor' : c.loja_id!=='aquamotor')
    );
    if(jaExiste) return;
    const novo={id:'cli_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),nome,tel:o.tel_cliente||'',end:o.local_servico||'',cnpj:o.cnpj||'',email_responsavel:'',tipo:'',portal_token:crypto.randomUUID(),loja_id:lojaId};
    lista.unshift(novo); mudou=true;
    if(dbOk&&db) salvarClienteRemoto({...novo, nome, loja_id:lojaId});
  });
  if(mudou){ lsCliSalvar(lista); console.log('[migração] base de clientes atualizada'); }
}

async function _migrarDataAprovacao(){
  const semData=todosOrc.filter(o=>o.status==='aprovado'&&!o.data_aprovacao&&(o.data_criacao||o.data_orc||o.data));
  if(!semData.length) return;
  semData.forEach(o=>{
    const ref=o.data_criacao||o.data_orc||o.data;
    o.data_aprovacao=ref;
    lsOrcAtualizar(o.id,{data_aprovacao:ref});
  });
  // Sincroniza cada um com o Supabase em background
  if(dbOk&&db){
    for(const o of semData){
      orcSyncUpdate(o.id,{data_aprovacao:o.data_aprovacao}).catch(e=>console.warn('[migrarDataAprovacao]',e?.message||e));
    }
  }
  console.log(`[migração] data_aprovacao preenchida em ${semData.length} orçamento(s) aprovado(s)`);
}

// ══ TRILHO COMERCIAL E CICLO DE DECISÃO ═════════════════════════════════════
// Medido em 2026-08-06 (ver docs/crm-baseline-2026-08-06.md): equipamento
// converte ~8% em TODAS as faixas de valor — inclusive abaixo de R$ 15k —
// enquanto serviço abaixo de R$ 15k converte 43,5%. Ou seja, o que alonga a
// decisão é o TRILHO (equipamento é investimento, muitas vezes com assembleia
// de condomínio no meio), e o valor agrava. Por isso os dois entram na regra.
const ORC_RX_EQUIPAMENTO = /trocador|aquecedor|bomba de calor|fromtherm|jelly/i;
const ORC_VALOR_CICLO_LONGO = 15000;

// Roda por linha ao renderizar o histórico: quando `servicos` já é string
// (vindo do banco), testa direto, sem parse+stringify de ida e volta.
function orcEhEquipamento(o){
  if(!o||!o.servicos) return false;
  try{
    const s = typeof o.servicos==='string' ? o.servicos : JSON.stringify(o.servicos);
    return ORC_RX_EQUIPAMENTO.test(s);
  }catch(e){ console.warn('[orcEhEquipamento]', e?.message||e); return false; }
}
// Negócio de decisão lenta — não pode ser declarado morto em 5 dias.
function orcCicloLongo(o){
  return orcEhEquipamento(o) || (parseFloat(o?.total)||0) >= ORC_VALOR_CICLO_LONGO;
}
function _hojeZero(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
// Idade em DIAS DE CALENDÁRIO (não em horas corridas). Um orçamento feito
// ontem às 18h tem 1 dia, não 0 — é assim que a pessoa conta. Comparar horas
// cruas fazia o mesmo registro cair em faixas diferentes conforme a hora do dia.
function _idadeEmDias(o){
  const d=(typeof _orcData==='function')?_orcData(o):null;
  if(!d||isNaN(d)) return 0;
  const d0=new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((_hojeZero()-d0)/86400000));
}
// Data em que o PREÇO expira. Prefere validade_data (pt-BR ou ISO) e cai para
// data_criacao + validade_dias. Centralizado aqui porque este parsing estava
// duplicado em verificarVencidos e autoVencerOrc, com regras sutilmente
// diferentes entre as duas.
function _orcValidadeData(o){
  if(o?.validade_data){
    const p=String(o.validade_data).split('/');
    const d = p.length===3 ? new Date(p[2]+'-'+p[1]+'-'+p[0]+'T00:00:00')
                           : new Date(o.validade_data+'T00:00:00');
    if(!isNaN(d)) return d;
  }
  const base = (typeof _orcData==='function') ? _orcData(o) : null;
  if(!base) return null;
  const d=new Date(base);
  d.setDate(d.getDate()+(parseInt(o?.validade_dias)||5));
  d.setHours(23,59,59,999);
  return isNaN(d)?null:d;
}
// O preço expirou, mas o negócio continua de pé. São dois conceitos distintos
// que hoje dividem o mesmo campo: `validade_data` é compromisso de PREÇO (vai
// no PDF, segue curta para não travar custo por 90 dias), enquanto a vida no
// funil é até quando vale perseguir o negócio (interna, longa).
function orcPrecoARevalidar(o){
  if(!o || (o.status!=='pendente' && o.status!=='vencido')) return false;
  if(!orcCicloLongo(o)) return false;
  const dv=_orcValidadeData(o);
  return !!dv && dv < _hojeZero();
}
// Negócio ainda perseguível. Inclui os que o RELÓGIO matou (status 'vencido'
// sem o cliente ter recusado) quando são de ciclo longo — foi o sistema que os
// declarou mortos, não o cliente. Base para a fila de follow-up.
function orcVivoNoFunil(o){
  if(!o) return false;
  if(o.status==='pendente') return true;
  return o.status==='vencido' && orcCicloLongo(o);
}

// ══ FILA DE FOLLOW-UP ═══════════════════════════════════════════════════════
// DUAS filas, uma por trilho. Medido (docs/crm-baseline-2026-08-06.md): serviço
// converte 43,5% e decide em 24h; equipamento converte ~8% e leva semanas. Uma
// fila única ordenada por valor ficaria 11/12 em equipamento e o vendedor
// passaria o dia no trilho que não fecha.
//
// Cliente é casado por NOME normalizado — este banco não tem cliente_id
// (214 nomes distintos em orçamentos × 141 clientes cadastrados). Funciona
// dentro de `orcamentos`, onde o autocomplete mantém a grafia consistente;
// NÃO serve para cruzar com vistorias/planos, onde os nomes divergem.
function _normCliente(n){
  // _normNome já resolve caixa + acento ("Atlântico" = "ATLANTICO").
  return _normNome(n)
    // Prefixo de tipo não identifica o condomínio: "Edifício Green Valey" e
    // "Residencial Green Valey" são o mesmo lugar. Medido: 6 grupos assim.
    .replace(/^(condominio|edificio|residencial|resid\.?|cond\.?|ed\.?)\s+/,'')
    .replace(/\s+/g,' ')
    .trim();
}
// ⚠️ Deliberadamente CONSERVADOR: só acento, caixa, prefixo e espaço. Nada de
// similaridade fuzzy — na base real existem "Infinity Coast", "Infinity
// Paradise" e "Infinity Flat", que são condomínios DIFERENTES. Aproximar por
// semelhança fundiria clientes distintos, e um CRM que mistura cliente é pior
// que um CRM que duplica.
// Uma varredura só para os dois conjuntos — evita reprocessar todosOrc por item.
function _crmConjuntosCliente(){
  const comEquip=new Set(), jaComprou=new Set();
  (todosOrc||[]).forEach(o=>{
    if(o.status!=='aprovado') return;
    const c=_normCliente(o.cliente); if(!c) return;
    jaComprou.add(c);
    if(orcEhEquipamento(o)) comEquip.add(c);
  });
  return {comEquip, jaComprou};
}
// score = (valor em milhares) × peso da relação ÷ dias parado.
// Valor alto e recente sobe; negócio velho desce. Quem já comprou vale 3× mais
// tempo de telefone: 14 clientes que já fecharam têm R$ 239k em aberto contra
// 114 que nunca fecharam com R$ 2,04 mi — os primeiros convertem muito melhor.
// Conversão histórica por trilho (medida na base em ago/2026). Usada para
// converter valor bruto em valor ESPERADO no score da fila — ver crmCandidatos.
const CRM_CONV_EQUIP=0.068, CRM_CONV_SERV=0.398;

function crmCandidatos(){
  const {comEquip, jaComprou}=_crmConjuntosCliente();
  const hoje=_hojeZero();
  const out=[];
  filtrarPorLoja(todosOrc||[]).filter(orcVivoNoFunil).forEach(o=>{
    const equip=orcEhEquipamento(o);
    const cli=_normCliente(o.cliente);
    // FILTRO NEGATIVO: trocador é venda única por condomínio. Reofertar a quem
    // já comprou queima tempo e credibilidade — a inteligência aqui é calar a
    // boca. (Caso real: Ibiza comprou em 02/05 e recebeu 5 ofertas depois.)
    if(equip && comEquip.has(cli)) return;
    if(_crmFbOculto(o.id)) return; // dispensado 3x, ou "liguei" há menos de 3 dias
    if(_crmAguardando(o)) return;  // follow-up agendado / assembleia ainda longe
    const dias=_idadeEmDias(o);
    const jaCliente=jaComprou.has(cli);
    const valor=parseFloat(o.total)||0;
    const diasDecisao=_crmDiasAteDecisao(o);
    // Compromisso vencido e assembleia recém-ocorrida furam a fila: no primeiro
    // caso alguém JÁ tinha decidido ligar; no segundo, a decisão acabou de sair.
    const atrasado = !!(o.proximo_contato && o.proximo_contato <= _hojeISO());
    // VALOR ESPERADO, não valor bruto. Antes o score usava `valor/1000` puro, e
    // como equipamento tem ticket ~12x maior ele monopolizava a fila — só que
    // equipamento fecha ~7% e serviço ~40%. Ponderar pela conversão histórica
    // do trilho aproxima o score do retorno real por ligação:
    //   equipamento R$ 28.000 x 6,8% ≈ R$ 1.900 esperado
    //   serviço     R$  2.267 x 39,8% ≈ R$   900 esperado
    // (dentro de um mesmo trilho a ordem não muda — o fator é constante —,
    //  mas os dois passam a ser comparáveis na mesma régua.)
    const esperado=valor*(equip?CRM_CONV_EQUIP:CRM_CONV_SERV);
    let score=(esperado/1000)*(jaCliente?3:1)/Math.max(dias,1);
    if(atrasado || (diasDecisao!==null && diasDecisao<=7)) score*=10;
    out.push({
      orc:o, equip, dias, jaCliente, valor, diasDecisao, atrasado,
      revalidar:orcPrecoARevalidar(o),
      score
    });
  });
  out.sort((a,b)=>b.score-a.score);
  return { equipamento:out.filter(c=>c.equip), servico:out.filter(c=>!c.equip) };
}
// Por que este está na fila. Quem usa o Fluxa não é vendedor profissional
// (são técnicos que também orçam): mostrar o motivo constrói repertório — a
// pessoa aprende o padrão usando — em vez de virar ordem sem contexto.
function crmMotivos(c){
  const p=[];
  if(c.atrasado) p.push('⏰ você marcou de ligar — prazo venceu');
  if(c.diasDecisao!==null && c.diasDecisao!==undefined){
    if(c.diasDecisao<0)       p.push(`🗳️ a assembleia foi há ${Math.abs(c.diasDecisao)} dia(s) — pergunte o resultado`);
    else if(c.diasDecisao===0) p.push('🗳️ a assembleia é HOJE');
    else                       p.push(`🗳️ assembleia em ${c.diasDecisao} dia(s) — confirme se entrou na pauta`);
  }
  if(c.jaCliente) p.push('✅ já é cliente — fechou antes com vocês');
  if(c.revalidar) p.push('⏳ preço expirado: revalide o valor antes de ligar');
  if(c.equip && c.valor>=50000) p.push('🔴 faixa que nunca fechou (0% acima de R$ 50 mil) — considere propor em etapas');
  else if(c.equip) p.push('🔧 equipamento: decisão leva semanas e pode passar por assembleia');
  else p.push('⚡ serviço: decide rápido, 43% fecham');
  if(c.dias===0) p.push('🆕 emitido hoje');
  else if(c.dias<=2) p.push(`🔥 ${c.dias} dia(s) — ainda quente`);
  else if(c.dias>=30) p.push(`🕐 parado há ${c.dias} dias`);
  return p;
}
// Frase pronta: quem não é vendedor trava no telefone. Um script destrava.
function crmSugestaoFala(c){
  if(c.diasDecisao!==null && c.diasDecisao!==undefined){
    if(c.diasDecisao<0)  return 'Vi que a reunião de vocês já aconteceu. Conseguiram avaliar nossa proposta? Fico à disposição para ajustar o que for preciso.';
    if(c.diasDecisao<=7) return 'A assembleia de vocês está chegando. O nosso orçamento entrou na pauta? Posso mandar um resumo de uma página para ajudar na apresentação.';
  }
  if(c.equip && c.valor>=50000)
    return 'Esse valor precisa passar por assembleia? Se sim, posso preparar um resumo de uma página para o síndico apresentar na reunião.';
  if(c.equip)
    return 'Ficou alguma dúvida sobre o equipamento ou sobre o prazo de instalação? Posso explicar o que está incluso.';
  if(c.dias>=15)
    return 'Passando para saber se ainda faz sentido esse serviço — consigo encaixar na agenda desta semana.';
  return 'Vi que o orçamento ainda está em aberto. Quer que eu já reserve uma data na agenda?';
}

// ── Feedback da fila: aprender do silêncio ──────────────────────────────────
// Local (sem schema ainda — Fase 3 persiste isso no banco). Regra: dispensou
// o MESMO orçamento 3x → some da fila de vez. "Ligar" some por 3 dias (não
// precisa reaparecer amanhã) sem exigir dizer o desfecho da ligação — 1 toque.
const LS_CRM_FB='fluxa_crm_feedback';
function _crmFbLer(){ try{ return JSON.parse(localStorage.getItem(LS_CRM_FB)||'{}'); }catch(e){ return {}; } }
function _crmFbSalvar(m){ try{ localStorage.setItem(LS_CRM_FB, JSON.stringify(m)); }catch(e){ console.warn('[crmFb]', e?.message||e); } }
function _crmFbOculto(orcId){
  const f=_crmFbLer()[orcId]; if(!f) return false;
  if((f.dispensas||0)>=3) return true;
  if(f.liguei_em && (Date.now()-f.liguei_em) < 3*86400000) return true;
  return false;
}
// Follow-up agendado para o futuro → não é abandono, é espera deliberada.
// Cobrar antes da hora é justamente a "chatice" que mata a confiança na fila.
function _crmAguardando(o){
  const hojeISO=_hojeISO();
  // Assembleia a 7 dias ou menos (ou já ocorrida) tem PRECEDÊNCIA sobre
  // qualquer silêncio: é a única janela em que dá para influenciar o
  // resultado — confirmar a pauta, mandar material — ou, se já passou, saber
  // como foi. Sem isto o proximo_contato (que aponta para depois da reunião)
  // esconderia justamente o momento que importa.
  const dd=_crmDiasAteDecisao(o);
  if(dd!==null && dd<=7) return false;
  if(o.proximo_contato && o.proximo_contato > hojeISO) return true;
  if(o.decisao_prevista && o.decisao_prevista > _addDias(hojeISO,7)) return true;
  return false;
}
// Dias até a assembleia: negativo = já aconteceu (hora de perguntar o resultado)
function _crmDiasAteDecisao(o){
  if(!o.decisao_prevista) return null;
  const d=new Date(o.decisao_prevista+'T12:00:00'); if(isNaN(d)) return null;
  // Ambos ao meio-dia: comparar 00:00 com 12:00 daria meio dia de diferença e o
  // Math.round jogaria "assembleia hoje" para 1 (off-by-one).
  const h=_hojeZero(); h.setHours(12,0,0,0);
  return Math.round((d-h)/86400000);
}
function crmDispensar(orcId){
  const m=_crmFbLer();
  m[orcId]=m[orcId]||{}; m[orcId].dispensas=(m[orcId].dispensas||0)+1;
  _crmFbSalvar(m);
  toast(m[orcId].dispensas>=3 ? '🔕 Não vou mais sugerir este' : 'Ok, tiro da lista de hoje');
  if(typeof renderPainelInsights==='function') renderPainelInsights();
}

// ══════════════════════════════════════════════════════════════════════════════
//  CADÊNCIA DE RECOMPRA — Etapa 4 do roadmap de CRM (2026-08-13), parte 1
//  Só o INTERVALO OBSERVADO (dado real, cliente com 2+ compras). A parte de
//  "consumo teórico" por volume de piscina (clientes de 1ª compra) fica pra
//  quando tivermos uma referência real de dosagem — ver CLAUDE.md.
//  Só entra na fila quem tem cliente_id de verdade (c.porId) — sem isso não
//  dá pra abrir "Novo orçamento"/"Ver histórico" ligado a uma ficha real.
// ══════════════════════════════════════════════════════════════════════════════
function cadenciaCandidatos(){
  const {lista}=analiseClientes();
  const observado=lista
    .filter(c=>c.porId && (c.ritmo==='reduziu'||c.ritmo==='parou') && !_cadFbOculto(c.chave.slice(3)))
    .map(c=>({...c, origem:'observado', atraso:c.diasDesdeUltima-c.intervaloMedioDias}));
  // Teórico: só quem já devia ter recomprado segundo a estimativa (diasAte<0)
  // — antes disso não vale incomodar com um número que é chute educado.
  const teorico=lista
    .filter(c=>c.porId && c.previsaoTeorica && c.previsaoTeorica.diasAte<0 && !_cadFbOculto(c.chave.slice(3)))
    .map(c=>({...c, origem:'teorico', atraso:-c.previsaoTeorica.diasAte}));
  return [...observado, ...teorico].sort((a,b)=>b.atraso-a.atraso);
}
const LS_CAD_FB='fluxa_cadencia_feedback';
function _cadFbLer(){ try{ return JSON.parse(localStorage.getItem(LS_CAD_FB)||'{}'); }catch(e){ return {}; } }
function _cadFbSalvar(m){ try{ localStorage.setItem(LS_CAD_FB, JSON.stringify(m)); }catch(e){ console.warn('[cadFb]', e?.message||e); } }
// 14 dias, não 3 como o de orçamento — ciclo de recompra é de semanas/meses,
// cobrar nesse ritmo de novo em 3 dias seria chatice, não follow-up.
function _cadFbOculto(cid){
  const f=_cadFbLer()[cid]; if(!f) return false;
  return (Date.now()-f.dispensado_em) < 14*86400000;
}
function cadenciaDispensar(cid){
  const m=_cadFbLer(); m[cid]={dispensado_em:Date.now()}; _cadFbSalvar(m);
  toast('Ok, não aviso de novo por 14 dias');
  renderCadenciaFila();
}
function _cadenciaCardHTML(c){
  const cid=c.chave.slice(3);
  let motivo1, avisoTeorico='';
  if(c.origem==='observado'){
    const rotulo = c.ritmo==='parou' ? '🔴 Parou de comprar' : '🟡 Reduziu o ritmo';
    motivo1 = `${rotulo} — costuma comprar a cada ${c.intervaloMedioDias}d, já são ${c.diasDesdeUltima}d`;
  } else {
    const pt=c.previsaoTeorica;
    motivo1 = `🧪 Estimativa (1ª compra, sem histórico ainda) — ${esc(pt.piscinaNome||'a piscina')} deve consumir ${pt.embalagemLabel} em ~${pt.dias}d; já se passaram ${c.diasDesdeUltima}d`;
    avisoTeorico=`<span class="crm-motivo" style="opacity:.75">⚠️ estimativa por fórmula, margem de erro grande (documento: ±35-50%) — confirme antes de cobrar</span>`;
  }
  return `<div class="crm-card">
    <div class="crm-card-top">
      <div class="crm-cliente">${esc(c.nome)}</div>
      <div class="crm-valor">${brl(c.valor)}</div>
    </div>
    <div class="crm-motivos">
      <span class="crm-motivo">${motivo1}</span>
      <span class="crm-motivo">🛒 ${c.compras} compra${c.compras!==1?'s':''} até agora</span>
      ${avisoTeorico}
    </div>
    <div class="crm-acts">
      <button class="tb g" onclick="novoOrcParaCliente('${cid}')">➕ Novo orçamento</button>
      <button class="tb" onclick="verHistoricoCliente('${cid}')">👁 Ver histórico</button>
      <button class="tb d" onclick="cadenciaDispensar('${cid}')">✕ Dispensar</button>
    </div>
  </div>`;
}
const CADENCIA_TETO=6;
function renderCadenciaFila(){
  const card=document.getElementById('ins-cadencia-card'), el=document.getElementById('ins-cadencia-corpo');
  if(!card||!el) return;
  const cands=cadenciaCandidatos();
  if(!cands.length){ card.style.display='none'; return; }
  card.style.display='';
  const visiveis=cands.slice(0,CADENCIA_TETO);
  el.innerHTML=visiveis.map(_cadenciaCardHTML).join('')
    + (cands.length>visiveis.length?`<div style="text-align:center;font-size:11px;color:var(--gray);padding:6px 0">+${cands.length-visiveis.length} outro(s)</div>`:'');
  const sub=document.getElementById('ins-cadencia-sub');
  if(sub) sub.textContent = `${cands.length} cliente${cands.length!==1?'s':''} atrasado${cands.length!==1?'s':''} pelo próprio ritmo`;
}

// ── Registrar contato (persiste no banco, não só no aparelho) ───────────────
// O "Liguei" antigo vivia só no localStorage: trocou de celular, perdeu o
// histórico, e o gestor nunca via o que o vendedor tinha feito. Agora grava em
// orcamentos (proximo_contato / decisao_prevista / motivo_perda / crm_notas).
let _crmCtId=null;
function abrirCrmContato(orcId){
  const o=(todosOrc||[]).find(x=>String(x.id)===String(orcId));
  if(!o){ toast('Orçamento não encontrado'); return; }
  _crmCtId=orcId;
  const sub=document.getElementById('crm-contato-sub');
  if(sub) sub.textContent=`${o.cliente||'—'} · ${brl(parseFloat(o.total)||0)}`;
  setV('crm-ct-resultado','vai_avaliar');
  setV('crm-ct-assembleia', o.decisao_prevista||'');
  setV('crm-ct-motivo', o.motivo_perda||'');
  setV('crm-ct-prox','7');
  setV('crm-ct-nota','');
  _crmCtToggle();
  document.getElementById('crm-contato-bg')?.classList.add('on');
}
function fecharCrmContato(){
  document.getElementById('crm-contato-bg')?.classList.remove('on');
  _crmCtId=null;
}
// Mostra só o campo que importa para o resultado escolhido — um formulário
// cheio de campo irrelevante é o caminho mais curto para ninguém preencher.
function _crmCtToggle(){
  const r=gV('crm-ct-resultado');
  const mostra=(id,cond)=>{ const el=document.getElementById(id); if(el) el.style.display=cond?'':'none'; };
  mostra('crm-ct-wrap-assembleia', r==='assembleia');
  mostra('crm-ct-wrap-motivo',     r==='perdido');
  // Em assembleia o retorno é derivado da data da reunião (dia seguinte), então
  // deixar o campo à mostra seria oferecer uma escolha que o código ignora.
  mostra('crm-ct-wrap-prox',       r!=='perdido' && r!=='assembleia');
}
async function salvarCrmContato(){
  const id=_crmCtId; if(!id) return;
  const o=(todosOrc||[]).find(x=>String(x.id)===String(id));
  if(!o){ toast('Orçamento não encontrado'); return; }
  const res=gV('crm-ct-resultado'), nota=(gV('crm-ct-nota')||'').trim();
  const patch={};

  if(res==='assembleia'){
    const d=gV('crm-ct-assembleia');
    if(!d){ toast('⚠️ Informe a data prevista da assembleia'); return; }
    patch.decisao_prevista=d;
    patch.proximo_contato=_addDias(d,1); // cobra no dia seguinte à reunião
  } else if(res==='perdido'){
    const mt=gV('crm-ct-motivo');
    if(!mt){ toast('⚠️ Informe o motivo da perda'); return; }
    patch.motivo_perda=mt;
    patch.status='recusado';
    patch.proximo_contato=null;
  } else {
    const dias=gV('crm-ct-prox');
    patch.proximo_contato = dias ? _addDias(_hojeISO(), parseInt(dias)) : null;
  }

  const notas=Array.isArray(o.crm_notas)?o.crm_notas.slice():[];
  notas.push({ em:new Date().toISOString(), por:(getSessao()?.nome||''), resultado:res, texto:nota||null });
  patch.crm_notas=notas.slice(-30); // histórico recente basta; evita inchar a linha

  // local primeiro (o app é local-first), banco em seguida via wrapper resiliente
  Object.assign(o, patch);
  lsOrcAtualizar(id, patch);
  fecharCrmContato();
  toast('✅ Contato registrado');
  logAcao?.('crm_contato', `${o.cliente||''} — ${res}`);
  renderPainelInsights?.();

  if(dbOk&&db&&!String(id).startsWith('local_')){
    try{
      const r=await dbUpdate('orcamentos', patch, 'id', id);
      if(r&&r.error){ console.warn('[crmContato]', r.error.message); toast('⚠️ Salvo no aparelho, mas não sincronizou'); }
    }catch(e){
      console.warn('[crmContato]', e?.message||e);
      toast('⚠️ Salvo no aparelho, mas não sincronizou');
    }
  }
}
function _hojeISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function _addDias(iso, n){
  const d=new Date(iso+'T12:00:00'); if(isNaN(d)) return null;
  d.setDate(d.getDate()+(parseInt(n)||0));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Painel de Insights (page-insights) ──────────────────────────────────────
// "Dinheiro do mês" independe do filtro de mês do Histórico (orcMesRef): mostra
// sempre o mês corrente, sem acoplar ao estado de outra tela.
// ── Números de PIPELINE (não contábeis) ─────────────────────────────────────
// Os 4 KPIs daqui eram cópia do dashboard principal (`atualizarDash`): mesmos
// Total Emitido / Aprovados / A Receber / Ticket, e recortados pelo mês.
// Estavam errados para esta tela por três motivos:
//   1. duplicavam informação que já existe no Histórico;
//   2. pipeline de vendedor NÃO é mensal — orçamento de junho ainda aberto
//      continua sendo trabalho de hoje; mês é recorte contábil;
//   3. "A Receber" era falso: `valor_recebido` é 0 em ~100% dos aprovados,
//      então o card mostrava tudo que já foi aprovado na história.
// `atualizarDash()` continua intocado — lá os KPIs contábeis fazem sentido.

// "Aberto no pipeline" = ainda não decidido pelo cliente (nem aprovado, nem
// recusado). É MAIS amplo que `orcVivoNoFunil`, e de propósito: aquele responde
// "vale a pena ligar?" (usado pela fila de ação), este responde "o que está na
// carteira?" (visão). Um serviço vencido de R$ 800 não merece ligação mas
// continua sendo carteira aberta.
function orcAbertoNoPipeline(o){
  return !!o && (o.status==='pendente' || o.status==='vencido');
}
const CRM_FAIXAS_IDADE=[
  // Os rótulos são de INTENÇÃO, não de tempo, porque quando existir o rastreio
  // de abertura do portal a faixa 8-30d passa a se chamar "Cliente visualizou"
  // sem que o resto da tela precise mudar.
  {id:'quente',   nome:'Quente',       sub:'0-7 dias',   max:7,        cor:'#16a34a', bg:'#dcfce7'},
  {id:'semresp',  nome:'Sem resposta', sub:'8-30 dias',  max:30,       cor:'#0284c7', bg:'#e0f2fe'},
  {id:'esfriando',nome:'Esfriando',    sub:'31-90 dias', max:90,       cor:'#d97706', bg:'#fef3c7'},
  {id:'frio',     nome:'Frio',         sub:'90+ dias',   max:Infinity, cor:'#6b7280', bg:'#f3f4f6'}
];
function _crmFaixaDe(dias){
  return (CRM_FAIXAS_IDADE.find(f=>dias<=f.max)||CRM_FAIXAS_IDADE[CRM_FAIXAS_IDADE.length-1]).id;
}
function _crmPipelineStats(){
  const hoje=_hojeZero();
  const abertos=filtrarPorLoja(todosOrc||[]).filter(orcAbertoNoPipeline);
  const val=o=>parseFloat(o.total)||0;
  const idade=_idadeEmDias;

  const pipeQtd=abertos.length;
  const pipeValor=abertos.reduce((a,o)=>a+val(o),0);

  const parados=abertos.filter(o=>idade(o)>30);
  // nullish guard: empresa nova (0 abertos) não pode virar NaN%
  const paradoPct=pipeQtd>0?Math.round(parados.length/pipeQtd*100):0;

  // Vence em 7 dias: usa a validade de PREÇO (`_orcValidadeData`), não a idade.
  const em7=new Date(hoje); em7.setDate(em7.getDate()+7);
  const vencendo=abertos.filter(o=>{ const dv=_orcValidadeData(o); return dv && dv>=hoje && dv<=em7; });

  // Único card mensal — este é sobre resultado, não sobre carteira.
  const mesRef=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const doMes=filtrarPorLoja(todosOrc||[]).filter(o=>{
    const ref=(o.status==='aprovado'&&o.data_aprovacao)?new Date(o.data_aprovacao):_orcData(o);
    return ref&&!isNaN(ref)&&ref.getFullYear()+'-'+String(ref.getMonth()+1).padStart(2,'0')===mesRef;
  });
  const fechados=doMes.filter(o=>o.status==='aprovado');
  const convPct=doMes.length>0?Math.round(fechados.length/doMes.length*100):0;

  // Faixas de idade para a barra de estágio
  const faixas={}; CRM_FAIXAS_IDADE.forEach(f=>faixas[f.id]={qtd:0,valor:0});
  abertos.forEach(o=>{ const f=faixas[_crmFaixaDe(idade(o))]; f.qtd++; f.valor+=val(o); });

  return {
    pipeQtd, pipeValor,
    paradoQtd:parados.length, paradoValor:parados.reduce((a,o)=>a+val(o),0), paradoPct,
    vencQtd:vencendo.length, vencValor:vencendo.reduce((a,o)=>a+val(o),0),
    fechQtd:fechados.length, fechValor:fechados.reduce((a,o)=>a+val(o),0), emitidosMes:doMes.length, convPct,
    faixas, idadeDe:idade,
    mesLabel:hoje.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  };
}
// Teto na tela — princípio anti-chatice: 150 sugestões = nenhuma sugestão.
const CRM_TETO_FILA=8;
// Equipamento entra em DOSE MENOR que serviço, de propósito. Não é limitação
// técnica: é venda consultiva de ciclo longo (fecha ~7%, leva semanas, pode
// depender de assembleia) — trabalhar 3 por dia com profundidade rende mais que
// 8 por cima. Serviço fecha ~40% em 24h e merece o volume. Sem isto a fila do
// dia ficava dominada pelo trilho que menos fecha, só porque tem ticket maior.
const CRM_TETO_EQUIP=3;
function _crmCardHTML(c){
  const motivos=crmMotivos(c).map(m=>`<span class="crm-motivo">${esc(m)}</span>`).join('');
  return `<div class="crm-card">
    <div class="crm-card-top">
      <div class="crm-cliente">${esc(c.orc.cliente||'—')}</div>
      <div class="crm-valor">${brl(c.valor)}</div>
    </div>
    <div class="crm-motivos">${motivos}</div>
    <div class="crm-fala">💬 "${esc(crmSugestaoFala(c))}"</div>
    <div class="crm-acts">
      <button class="tb g" onclick="abrirCrmContato('${c.orc.id}')">📞 Registrar contato</button>
      <button class="tb" onclick="verOrcPDF('${c.orc.id}')">👁 Ver orçamento</button>
      <button class="tb d" onclick="crmDispensar('${c.orc.id}')">✕ Dispensar</button>
    </div>
  </div>`;
}
function _crmRenderTrilho(elId, subId, lista, vazioTxt, teto){
  const el=document.getElementById(elId); if(!el) return;
  if(!lista.length){ el.innerHTML=`<div class="empty-st" style="padding:20px"><div class="ei">✅</div><p>${vazioTxt}</p></div>`; }
  else{
    const visiveis=lista.slice(0, teto||CRM_TETO_FILA);
    el.innerHTML=visiveis.map(_crmCardHTML).join('')
      + (lista.length>visiveis.length?`<div style="text-align:center;font-size:11px;color:var(--gray);padding:6px 0">+${lista.length-visiveis.length} outro(s) — resolva estes primeiro</div>`:'');
  }
  const sub=document.getElementById(subId);
  if(sub) sub.textContent = lista.length ? `${lista.length} em aberto` : 'tudo em dia';
}
// Faixa de estágio selecionada (filtra a fila). '' = todas.
let _crmFaixaFiltro='';
function crmFiltrarFaixa(id){
  _crmFaixaFiltro = (_crmFaixaFiltro===id) ? '' : id; // clicar de novo desmarca
  renderPainelInsights();
}
function _crmRenderEstagio(s){
  const barra=document.getElementById('ins-estagio-barra');
  const leg=document.getElementById('ins-estagio-leg');
  const card=document.getElementById('ins-estagio-card');
  if(!barra||!leg) return;
  const total=s.pipeQtd;
  if(!total){ // empresa nova / nada aberto — não mostra barra vazia
    if(card) card.style.display='none';
    return;
  }
  if(card) card.style.display='';
  barra.innerHTML=CRM_FAIXAS_IDADE.map(f=>{
    const d=s.faixas[f.id]; if(!d.qtd) return '';
    const pct=d.qtd/total*100;
    const apagado=_crmFaixaFiltro&&_crmFaixaFiltro!==f.id?' off':'';
    return `<button class="fase-seg${apagado}" style="width:${pct}%;background:${f.cor}"
      title="${esc(f.nome)} (${f.sub}) — ${d.qtd} orçamento(s) · ${brl(d.valor)}"
      onclick="crmFiltrarFaixa('${f.id}')">${pct>=9?d.qtd:''}</button>`;
  }).join('');
  leg.innerHTML=CRM_FAIXAS_IDADE.map(f=>{
    const d=s.faixas[f.id];
    const sel=_crmFaixaFiltro===f.id?' on':'';
    return `<button class="fase-item${sel}" style="border-left-color:${f.cor}" onclick="crmFiltrarFaixa('${f.id}')">
      <div class="fase-nome">${esc(f.nome)}</div>
      <div class="fase-sub">${f.sub}</div>
      <div class="fase-num" style="color:${f.cor}">${d.qtd} · ${brl(d.valor)}</div>
    </button>`;
  }).join('');
  const sub=document.getElementById('ins-estagio-sub');
  if(sub) sub.textContent=_crmFaixaFiltro
    ? 'filtrando a fila — toque de novo para limpar'
    : 'toque numa faixa para filtrar a fila';
}
// ── Diário do gestor (fase 6) ────────────────────────────────────────
// O painel vem por último de propósito: agora existe dado real por trás de cada
// número. Este bloco é a camada DIÁRIA — só o que precisa de ação hoje, com o
// botão da ação junto. Dinheiro vencendo e material faltando não podem depender
// de alguém lembrar de abrir outra tela; foi essa a lição do recebimento, em
// que uma unidade registra 98% e a outra 28%.
function renderPainelHoje(){
  const card=document.getElementById('ins-hoje-card'), el=document.getElementById('ins-hoje-corpo');
  if(!card||!el) return;
  const itens=[];

  // 1. Recebíveis vencidos e vencendo
  const rec=filtrarPorLoja(todosReceb||[]).filter(r=>!r.data_pagamento);
  const venc=rec.filter(r=>_recebDiasAtraso(r)>0);
  const hoje=rec.filter(r=>_recebDiasAtraso(r)===0);
  const somaR=l=>l.reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
  if(venc.length) itens.push({cor:'var(--red)', icone:'💸',
    titulo:`${brl(somaR(venc))} vencido`,
    sub:`${venc.length} parcela${venc.length!==1?'s':''} · a mais antiga há ${Math.max(...venc.map(_recebDiasAtraso))} dias`,
    acao:'Cobrar', fn:"go('recebiveis')"});
  if(hoje.length) itens.push({cor:'var(--yellow)', icone:'📅',
    titulo:`${brl(somaR(hoje))} vence hoje`,
    sub:`${hoje.length} parcela${hoje.length!==1?'s':''} — marque quando entrar`,
    acao:'Ver', fn:"go('recebiveis')"});

  // 1b. Aprovado sem NENHUMA cobrança lançada — diferente do "vencido" acima
  // (que exige uma parcela já criada pra poder vencer): aqui não existe
  // parcela nenhuma, então nunca aparece como vencido, mesmo aprovado há
  // meses. É o gap medido entre lojas (uma loja lança quase tudo, outra
  // lança um terço) — sem esse item o painel fica cego pra ele.
  const semReceb=(typeof _orcAprovadosSemReceb==='function'? _orcAprovadosSemReceb() : []);
  if(semReceb.length){
    const totalSemReceb=semReceb.reduce((a,o)=>a+(parseFloat(o.total)||0),0);
    const maisAntigo=semReceb[semReceb.length-1];
    itens.push({cor:'var(--red)', icone:'🧮',
      titulo:`${brl(totalSemReceb)} aprovado sem cobrança lançada`,
      sub:`${semReceb.length} orçamento${semReceb.length!==1?'s':''} · o mais antigo desde ${_dataBR(String(maisAntigo?.data_aprovacao||maisAntigo?.data_criacao||'').slice(0,10))}`,
      acao:'Lançar', fn:"go('recebiveis')"});
  }

  // 2. Material faltando (ruptura aberta) — é venda que não sai
  const rup=(typeof historicoRuptura==='function'? historicoRuptura(lojaAtiva||'') : []).filter(r=>r.aberta);
  if(rup.length) itens.push({cor:'var(--red)', icone:'📦',
    titulo:`${rup.length} produto${rup.length!==1?'s':''} em falta`,
    sub: rup.slice(0,3).map(r=>esc((produtoById(r.produto_id)||{}).nome||'—')).join(' · ')+(rup.length>3?` +${rup.length-3}`:''),
    acao:'Comprar', fn:"go('estoque')"});

  // 3. Despesa fixa não lançada — sem ela o resultado do mês fica otimista
  const dp=(typeof _despRecorrentesPendentes==='function'? _despRecorrentesPendentes() : []);
  if(dp.length) itens.push({cor:'var(--yellow)', icone:'🧾',
    titulo:`${dp.length} despesa${dp.length!==1?'s':''} fixa${dp.length!==1?'s':''} não lançada${dp.length!==1?'s':''}`,
    sub:'Sem elas o resultado do mês parece maior do que é',
    acao:'Lançar', fn:"go('despesas')"});

  // 4. Orçamentos sem identidade de cliente — trava LTV e recompra
  const semId=filtrarPorLoja(todosOrc||[]).filter(o=>!o.cliente_id && (o.cliente||'').trim());
  if(semId.length>=10) itens.push({cor:'var(--gray)', icone:'🪪',
    titulo:`${semId.length} orçamentos sem cliente identificado`,
    sub:'Não entram no histórico do cliente',
    acao:'Revisar', fn:"go('identidade')"});

  if(!itens.length){
    card.style.display='';
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
      <span style="font-size:22px">✅</span>
      <span style="font-size:13px;color:var(--gray)">Nada vencido, nada faltando, contas do mês lançadas.</span></div>`;
    return;
  }
  card.style.display='';
  el.innerHTML=itens.map(i=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light);flex-wrap:wrap">
      <div style="width:4px;align-self:stretch;border-radius:2px;background:${i.cor};min-height:32px"></div>
      <span style="font-size:18px">${i.icone}</span>
      <div style="flex:1;min-width:150px">
        <div style="font-size:13px;font-weight:700;color:var(--c2)">${i.titulo}</div>
        <div style="font-size:11.5px;color:var(--gray)">${i.sub}</div>
      </div>
      <button class="tb g" style="font-weight:700" onclick="${i.fn}">${i.acao}</button>
    </div>`).join('');
}

function renderPainelInsights(){
  if(!document.getElementById('page-insights')) return;
  try{ renderPainelHoje(); }catch(e){ console.warn('[painelHoje]', e?.message||e); }
  const s=_crmPipelineStats();
  const set=(id,txt)=>{ const el=document.getElementById(id); if(el) el.textContent=txt; };

  set('ins-mes-label','· pipeline completo');
  set('ins-d-emit', brl(s.pipeValor));
  set('ins-d-emit-q', s.pipeQtd+' orçamento(s) em aberto');
  set('ins-d-aprov', brl(s.paradoValor));
  set('ins-d-aprov-q', s.paradoQtd+' orç. · '+s.paradoPct+'% do pipeline');
  set('ins-d-rec', brl(s.vencValor));
  set('ins-d-rec-q', s.vencQtd ? s.vencQtd+' orç. — revalidar o preço' : 'nada vencendo');
  set('ins-d-tick', brl(s.fechValor));
  set('ins-d-tick-q', s.fechQtd+'/'+s.emitidosMes+' emitidos · '+s.convPct+'% · '+s.mesLabel);

  _crmRenderEstagio(s);

  let {equipamento, servico}=crmCandidatos();
  if(_crmFaixaFiltro){
    const naFaixa=c=>_crmFaixaDe(s.idadeDe(c.orc))===_crmFaixaFiltro;
    equipamento=equipamento.filter(naFaixa);
    servico=servico.filter(naFaixa);
  }
  _crmRenderTrilho('ins-fila-equip','ins-sub-equip', equipamento, 'Nenhum equipamento parado no momento.', CRM_TETO_EQUIP);
  _crmRenderTrilho('ins-fila-servico','ins-sub-servico', servico, 'Nenhum serviço parado no momento.', CRM_TETO_FILA);
  const totalFila=equipamento.length+servico.length;
  const faixaNome=_crmFaixaFiltro?(CRM_FAIXAS_IDADE.find(f=>f.id===_crmFaixaFiltro)||{}).nome:'';
  document.getElementById('ins-fila-sub').textContent = totalFila
    ? `${totalFila} orçamento(s) merecem uma ligação${faixaNome?' · filtro: '+faixaNome:''}`
    : (_crmFaixaFiltro?`nada nesta faixa (${faixaNome})`:'tudo em dia — nada parado');
  try{ renderCadenciaFila(); }catch(e){ console.warn('[renderCadenciaFila]', e?.message||e); }
}

function verificarVencidos(){
  const hoje=_hojeZero();
  let mudou=false;
  todosOrc.forEach(o=>{
    if(o.status!=='pendente') return;
    // Ciclo longo não vence sozinho: vira "preço a revalidar" e SEGUE no funil.
    if(orcCicloLongo(o)) return;
    const dv=_orcValidadeData(o);
    if(dv&&dv<hoje){
      o.status='vencido'; mudou=true;
      lsOrcAtualizar(o.id,{status:'vencido'});
      if(dbOk&&db&&!String(o.id).startsWith('local_'))
        dbUpdate('orcamentos', {status:'vencido'}, 'id', o.id).then(()=>{}).catch(()=>{});
      // Vencido não pode segurar estoque: libera reservas deste orçamento
      if(typeof sincronizarReservaOrcamento==='function') sincronizarReservaOrcamento(o);
    }
  });
  return mudou;
}

function atualizarDash(){
  // KPIs sempre refletem o período do mês selecionado (ou todos)
  const orcFiltrado=_orcListaMes();
  const tot=orcFiltrado.length, soma=orcFiltrado.reduce((a,o)=>a+(o.total||0),0);
  const aprov=orcFiltrado.filter(o=>o.status==='aprovado');
  const somaA=aprov.reduce((a,o)=>a+(o.total||0),0);
  const aRec=aprov.reduce((a,o)=>a+(o.total||0)-(o.valor_recebido||0),0);
  const tick=tot>0?soma/tot:0;
  // Sub-label mostra o período
  const periodoSub=orcMesRef?_renderOrcMesLabelStr():'Todos os períodos';
  const taxaConv = tot>0 ? Math.round(aprov.length/tot*100) : 0;
  setV_el('d-emit',brl(soma),'textContent'); setV_el('d-emit-q',tot+' orç. · '+periodoSub,'textContent');
  setV_el('d-aprov',brl(somaA),'textContent'); setV_el('d-aprov-q',aprov.length+' aprov. · '+(tot>0?taxaConv+'% conversão':'—'),'textContent');
  setV_el('d-rec',brl(Math.max(0,aRec)),'textContent');
  setV_el('d-tick',tick>0?brl(tick):'—','textContent');
  renderOrigemDash();
  renderEstoqueDash();
}

function dispensarAlertaEstoque(){
  // Salva timestamp de dismiss — oculta reposição por 7 dias.
  // Encomendas urgentes (estoque negativo) sempre aparecem, ignoram o dismiss.
  lsSet('fluxa_estoque_dismiss', String(Date.now()));
  const card=document.getElementById('dash-estoque-card');
  if(card) card.style.display='none';
  toast('🔕 Alertas de reposição ocultados por 7 dias');
}
function _estoqueDismissAtivo(){
  const t=parseInt(localStorage.getItem('fluxa_estoque_dismiss')||'0');
  return t>0 && (Date.now()-t) < 7*24*60*60*1000; // 7 dias em ms
}

// Card de estoque no dashboard: produtos abaixo do mínimo (lista de reposição)
function renderEstoqueDash(){
  const card=document.getElementById('dash-estoque-card');
  const body=document.getElementById('dash-estoque-body');
  if(!card||!body) return;
  if(!eGestor()){ card.style.display='none'; return; }
  const prods=produtosVisiveis();
  // Encomendas (disponível negativo = vendido/comprometido sem estoque) — sempre visíveis
  const enc=listaEncomendas();
  // Reposição (disponível no/abaixo do mínimo, mas ainda positivo)
  const baixo=prods.filter(p=>{ const m=parseFloat(p.estoque_minimo)||0; const d=disponivelProduto(p.id); return m>0 && d>=0 && d<=m; })
    .sort((a,b)=>disponivelProduto(a.id)-disponivelProduto(b.id));
  // Se dismiss ativo: mostra só encomendas urgentes (negativo), oculta reposição
  const baixoVis = _estoqueDismissAtivo() ? [] : baixo;
  if(!enc.length && !baixoVis.length){ card.style.display='none'; return; }
  card.style.display='';
  let html='';
  if(enc.length){
    html+=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#b91c1c;margin-bottom:4px">📥 Comprar para entregar (encomendas)</div>`;
    html+=enc.slice(0,6).map(x=>{
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.p.nome)}</div>
          <div style="font-size:11px;color:var(--gray)">faltam <span style="color:var(--red);font-weight:700">${fmtQtd(x.falta)}</span> para entregar</div></div>
        <button class="tb g" style="flex-shrink:0;font-size:11px" onclick="go('estoque');setTimeout(()=>abrirMovModal('${x.p.id}','entrada'),250)">＋ Comprar ${fmtQtd(Math.ceil(x.falta))}</button>
      </div>`;
    }).join('')+(enc.length>6?`<div style="font-size:11px;color:var(--gray);padding:6px 0;text-align:right">+${enc.length-6} outros</div>`:'');
  }
  if(baixoVis.length){
    html+=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#b45309;margin:${enc.length?'10px':'0'} 0 4px">🔄 Repor (estoque mínimo)</div>`;
    html+=baixoVis.slice(0,6).map(p=>{
      const disp=disponivelProduto(p.id), min=parseFloat(p.estoque_minimo)||0;
      const sugestao=Math.max(1, Math.ceil(min*2 - disp));
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.nome)}</div>
          <div style="font-size:11px;color:var(--gray)">disponível <span style="color:var(--yellow);font-weight:700">${fmtQtd(disp)}</span> · mín ${fmtQtd(min)}</div></div>
        <button class="tb g" style="flex-shrink:0;font-size:11px" onclick="go('estoque');setTimeout(()=>abrirMovModal('${p.id}','entrada'),250)">＋ Repor ${fmtQtd(sugestao)}</button>
      </div>`;
    }).join('')+(baixoVis.length>6?`<div style="font-size:11px;color:var(--gray);padding-top:6px;text-align:right">+${baixoVis.length-6} outros</div>`:'');
  }
  // Rodapé: aviso de dismiss ativo
  if(_estoqueDismissAtivo()&&baixo.length){
    const dias=Math.ceil((7*86400000-(Date.now()-parseInt(localStorage.getItem('fluxa_estoque_dismiss'))))/86400000);
    html+=`<div style="font-size:11px;color:var(--gray);margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-light)">🔕 ${baixo.length} produto(s) com reposição pendente · oculto por mais ${dias} dia(s) <button class="ba" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="localStorage.removeItem('fluxa_estoque_dismiss');renderEstoqueDash()">Mostrar</button></div>`;
  }
  body.innerHTML=html;
}

// ── Origem dos clientes (métricas de captação) ──
function renderOrigemDash(){
  const card=document.getElementById('dash-origem-card');
  const body=document.getElementById('dash-origem-body');
  if(!card||!body) return;
  const periodo=(document.getElementById('dash-origem-periodo')||{value:'mes'}).value;
  const hoje=new Date();
  const comOrigem=filtrarPorLoja(todosOrc).filter(o=>o.origem_cliente);
  // Sem nenhum histórico de origem em toda a base → esconde o card por completo
  if(!comOrigem.length){ card.style.display='none'; return; }
  let lista=comOrigem;
  if(periodo==='mes'){
    lista=lista.filter(o=>{ const d=_orcData(o); return d&&d.getFullYear()===hoje.getFullYear()&&d.getMonth()===hoje.getMonth(); });
  } else if(periodo!=='tudo'){
    const lim=new Date(hoje.getFullYear(),hoje.getMonth()-parseInt(periodo)+1,1);
    lista=lista.filter(o=>{ const d=_orcData(o); return d&&d>=lim; });
  }
  card.style.display='';
  // Agrupa por origem
  const counts={}, valores={}, aprovados={};
  lista.forEach(o=>{
    const k=o.origem_cliente;
    counts[k]=(counts[k]||0)+1;
    valores[k]=(valores[k]||0)+(o.total||0);
    if(o.status==='aprovado') aprovados[k]=(aprovados[k]||0)+1;
  });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max=sorted[0]?.[1]||1;
  const emojis=ORIGEM_EMOJI;
  // ── Placar de contadores: categorias padrão (sempre) + personalizadas presentes ──
  const padrao=Object.keys(ORIGEM_EMOJI);
  const custom=Object.keys(counts).filter(k=>!padrao.includes(k));
  const ordemCounter=[...padrao,...custom];
  const periodoLbl={mes:'este mês','3':'últimos 3 meses','12':'últimos 12 meses',tudo:'todo o período'}[periodo]||'';
  const counterHtml=`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Leads por categoria</span>
      <span style="font-size:11px;color:var(--gray)">${esc(periodoLbl)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:16px">
      ${ordemCounter.map(cat=>{
        const n=counts[cat]||0;
        const ativo=n>0;
        return `<div style="border:1.5px solid ${ativo?'var(--c1)':'var(--gray-light)'};border-radius:12px;padding:10px 8px;text-align:center;background:${ativo?'var(--c1-light)':'var(--white)'};opacity:${ativo?'1':'.55'}">
          <div style="font-size:20px;line-height:1">${emojis[cat]||'✏️'}</div>
          <div style="font-size:24px;font-weight:800;line-height:1.1;margin-top:4px;color:${ativo?'var(--c1)':'var(--gray)'}">${n}</div>
          <div style="font-size:10px;font-weight:600;color:var(--c2);margin-top:3px;line-height:1.2">${esc(cat)}</div>
        </div>`;
      }).join('')}
    </div>`;
  // Mês/período sem nenhum lead → mostra só o placar zerado + aviso amigável
  if(!lista.length){
    body.innerHTML=counterHtml+`<div style="text-align:center;color:var(--gray);font-size:12px;padding:6px 0">Nenhum lead com origem registrada ${periodo==='mes'?'neste mês':'neste período'} ainda.</div>`;
    return;
  }
  const detalheHtml=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:6px">Detalhamento</div>`;
  body.innerHTML=counterHtml+detalheHtml+sorted.map(([orig,cnt])=>{
    const pct=Math.round(cnt/lista.length*100);
    const apr=aprovados[orig]||0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
      <div style="font-size:16px;flex-shrink:0;width:24px;text-align:center">${emojis[orig]||'✏️'}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--c2);margin-bottom:3px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(orig)}</span>
          <span style="flex-shrink:0;margin-left:8px">${cnt} <span style="color:var(--gray);font-weight:400">(${pct}%)</span></span>
        </div>
        <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden">
          <div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(cnt/max*100)}%"></div>
        </div>
      </div>
      <div style="flex-shrink:0;text-align:right;min-width:90px">
        <div style="font-size:12px;font-weight:700;color:var(--c2)">${brl(valores[orig]||0)}</div>
        <div style="font-size:10px;color:var(--gray)">${apr} aprovado${apr!==1?'s':''}</div>
      </div>
    </div>`;
  }).join('')+`<div style="font-size:11px;color:var(--gray);padding-top:8px;text-align:right">${lista.length} orçamento${lista.length!==1?'s':''} com origem informada</div>`;
}

function filt(btn){
  document.querySelectorAll('.hf .fb[data-s]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); filtroSt=btn.dataset.s;
  lsSet('fluxa_filtroSt', filtroSt);
  renderTabela();
}
function histToggleOrdem(){
  histOrdem = histOrdem==='idade' ? 'recente' : 'idade';
  toast(histOrdem==='idade' ? '⏱ Ordenado pelo tempo parado' : '📅 Ordenado por data');
  renderTabela();
}
function buscar(v){ busca=v.toLowerCase(); renderTabela(); }
function filtOrigem(v){ filtroOrigem=v; renderTabela(); }

// ──────────────────────────────────────────────────
//  GRÁFICO DE FATURAMENTO
// ──────────────────────────────────────────────────
function _orcData(o){
  // campo correto de data: data_criacao (ISO) é o mais confiável
  const raw = o.data_criacao || o.data_orc || o.data || '';
  if(!raw) return null;
  // ⚠️ String só-data ('2026-08-01') é lida pelo JS como MEIA-NOITE UTC; no
  // Brasil (UTC-3) isso vira 31/07 no horário local, e getMonth() devolve o mês
  // ERRADO. Resultado: todo orçamento do dia 1º caía no mês anterior em qualquer
  // relatório que agrupe por mês. Ancorar ao meio-dia local elimina a borda —
  // mesmo tratamento que o app já dá às datas de despesa.
  const s=String(raw);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s+'T12:00:00' : s);
}

function renderGraficoDash(){
  const canvas=document.getElementById('dash-chart'); if(!canvas) return;
  if(typeof Chart==='undefined') return;
  const tipo=(document.getElementById('dash-chart-tipo')||{value:'aprovado'}).value;
  const periodo=(document.getElementById('dash-chart-periodo')||{value:'6'}).value;
  const hoje=new Date();
  const orcFilt=filtrarPorLoja(todosOrc);
  let meses=[];

  if(periodo==='tudo'){
    // Descobre o mês mais antigo com dados
    const datas=orcFilt.map(o=>_orcData(o)).filter(Boolean);
    const minData=datas.length?new Date(Math.min(...datas)):hoje;
    const diffMeses=(hoje.getFullYear()-minData.getFullYear())*12+(hoje.getMonth()-minData.getMonth());
    const total=Math.max(diffMeses+1, 1);
    for(let i=total-1;i>=0;i--){
      const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
      meses.push({label:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),y:d.getFullYear(),m:d.getMonth()});
    }
  } else if(periodo==='ano'){
    for(let m=0;m<=hoje.getMonth();m++){
      const d=new Date(hoje.getFullYear(),m,1);
      meses.push({label:d.toLocaleDateString('pt-BR',{month:'short'}),y:d.getFullYear(),m:d.getMonth()});
    }
  } else {
    const qtd=parseInt(periodo)||6;
    for(let i=qtd-1;i>=0;i--){
      const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
      meses.push({label:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),y:d.getFullYear(),m:d.getMonth()});
    }
  }

  // Atualiza o título dinamicamente
  const titulos={'3':'3 meses','6':'6 meses','12':'12 meses','24':'24 meses','ano':'Este ano','tudo':'Todo o período'};
  const tituloEl=document.getElementById('dash-chart-titulo');
  if(tituloEl) tituloEl.textContent='📊 Faturamento — '+titulos[periodo];

  const valores=meses.map(({y,m})=>{
    return orcFilt.filter(o=>{
      const d=_orcData(o); if(!d||isNaN(d)) return false;
      return d.getFullYear()===y && d.getMonth()===m && (tipo==='aprovado'?o.status==='aprovado':true);
    }).reduce((a,o)=>a+(o.total||0),0);
  });

  if(_dashChart){ try{_dashChart.destroy();}catch(e){} _dashChart=null; }
  const cor=getComputedStyle(document.documentElement).getPropertyValue('--c1').trim()||'#C45E0A';
  // Barras mais finas quando há muitos meses
  const muitosMeses=meses.length>12;

  _dashChart=new Chart(canvas,{
    type:'bar',
    data:{
      labels:meses.map(m=>m.label),
      datasets:[{
        label:tipo==='aprovado'?'Aprovados':'Total emitido',
        data:valores,
        backgroundColor:cor+'26',
        borderColor:cor,
        borderWidth:2,
        borderRadius:muitosMeses?3:6,
        borderSkipped:false,
        maxBarThickness:muitosMeses?24:48,
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>'R$ '+ctx.raw.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:muitosMeses?9:11,family:'Inter'},color:'#6b7280',maxRotation:muitosMeses?45:0}},
        y:{grid:{color:'rgba(0,0,0,.04)'},border:{display:false},ticks:{font:{size:11,family:'Inter'},color:'#6b7280',callback:v=>v===0?'R$0':v>=1000?'R$'+Math.round(v/1000)+'k':'R$'+v}}
      }
    }
  });
}


// ── NAVEGAÇÃO DE MÊS (orçamentos) ──────────────────────────────────────────
const _MESES_ORC=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function initOrcMes(){
  if(!orcMesRef){
    const n=new Date();
    orcMesRef=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  }
  _renderOrcMesLabel();
}

function orcNavMes(delta){
  if(!orcMesRef){ initOrcMes(); return; }
  const [y,m]=orcMesRef.split('-').map(Number);
  const d=new Date(y,m-1+delta,1);
  orcMesRef=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  _renderOrcMesLabel();
  atualizarDash(); renderTabela();
}

function orcVerTodos(){
  orcMesRef='';
  _renderOrcMesLabel();
  atualizarDash(); renderTabela();
}

function _renderOrcMesLabel(){
  const lbl=document.getElementById('orc-mes-label');
  const btn=document.getElementById('btn-orc-todos');
  if(!orcMesRef){
    if(lbl) lbl.textContent='Todos os períodos';
    if(btn){ btn.classList.add('on'); }
  } else {
    const [y,m]=orcMesRef.split('-').map(Number);
    if(lbl) lbl.textContent=_MESES_ORC[m-1]+' '+y;
    if(btn){ btn.classList.remove('on'); }
  }
}

function _renderOrcMesLabelStr(){
  if(!orcMesRef) return 'todos os períodos';
  const [y,m]=orcMesRef.split('-').map(Number);
  return _MESES_ORC[m-1]+' '+y;
}

function _orcListaMes(){
  let lista=filtrarPorLoja(todosOrc);
  if(orcMesRef){
    lista=lista.filter(o=>{
      // Aprovados: referência contábil = data_aprovacao (mês em que a venda foi fechada)
      // Demais status: data_criacao (mês em que foi proposto)
      const ref = (o.status==='aprovado' && o.data_aprovacao)
        ? new Date(o.data_aprovacao)
        : _orcData(o);
      if(!ref||isNaN(ref)) return true; // sem data → inclui para não sumir
      return ref.getFullYear()+'-'+String(ref.getMonth()+1).padStart(2,'0')===orcMesRef;
    });
  }
  return lista;
}

function renderOrcMiniKpis(lista){
  const el=document.getElementById('orc-mini-kpis'); if(!el) return;
  const ocultarFin=eVendas();
  const total=lista.length;
  const soma=lista.reduce((a,o)=>a+(o.total||0),0);
  const aprov=lista.filter(o=>o.status==='aprovado');
  const somaA=aprov.reduce((a,o)=>a+(o.total||0),0);
  const pend=lista.filter(o=>o.status==='pendente').length;
  const rec=lista.filter(o=>o.status==='recusado').length;
  const venc=lista.filter(o=>o.status==='vencido').length;
  const tick=total>0?soma/total:0;
  el.innerHTML=`
    <div class="orc-mini-kpi" style="background:#fff7ed;border-left-color:var(--c1)">
      <div class="orc-mini-kpi-lbl">Total emitido</div>
      <div class="orc-mini-kpi-val">${ocultarFin?total+' orç.':brl(soma)}</div>
      <div class="orc-mini-kpi-sub">${total} orçamento${total!==1?'s':''}</div>
    </div>
    <div class="orc-mini-kpi" style="background:#f0fdf4;border-left-color:var(--green)">
      <div class="orc-mini-kpi-lbl">✅ Aprovados</div>
      <div class="orc-mini-kpi-val" style="color:var(--green)">${ocultarFin?aprov.length:brl(somaA)}</div>
      <div class="orc-mini-kpi-sub">${aprov.length} aprovado${aprov.length!==1?'s':''}</div>
    </div>
    <div class="orc-mini-kpi" style="background:#fffbeb;border-left-color:var(--yellow)">
      <div class="orc-mini-kpi-lbl">⏳ Pendentes</div>
      <div class="orc-mini-kpi-val" style="color:var(--yellow)">${pend}</div>
      <div class="orc-mini-kpi-sub">${ocultarFin?'':tick>0?'Ticket: '+brl(tick):''}</div>
    </div>
    <div class="orc-mini-kpi" style="background:#fef2f2;border-left-color:var(--red)">
      <div class="orc-mini-kpi-lbl">❌ Recusados/Vencidos</div>
      <div class="orc-mini-kpi-val" style="color:var(--red)">${rec+venc}</div>
      <div class="orc-mini-kpi-sub">${rec} recusado${rec!==1?'s':''} · ${venc} vencido${venc!==1?'s':''}</div>
    </div>`;
}

function renderTabela(){
  // auto-vence orçamentos pendentes com prazo expirado
  autoVencerOrc(todosOrc);
  // base: filtro por mês de vigência
  let listaMes=_orcListaMes();
  // Renderiza mini KPIs para o período selecionado (antes dos filtros de status/busca)
  renderOrcMiniKpis(listaMes);
  // Popula o select de origem (uma vez) com as origens padrão + as usadas
  const selOrig=document.getElementById('hist-filtro-origem');
  if(selOrig && selOrig.options.length<=1){
    const usadas=[...new Set((todosOrc||[]).map(o=>o.origem_cliente).filter(Boolean))];
    const todas=[...new Set([...Object.keys(ORIGEM_EMOJI), ...usadas])];
    const atual=selOrig.value;
    selOrig.innerHTML='<option value="">🔎 Origem: todas</option>'
      +todas.map(o=>`<option value="${esc(o)}">${ORIGEM_EMOJI[o]||'✏️'} ${esc(o)}</option>`).join('')
      +'<option value="__sem__">✏️ Sem origem</option>';
    selOrig.value=atual;
  }
  let lista=listaMes;
  // "abertos" não é um status: é o que o cliente ainda não decidiu (pendente +
  // vencido). É a visão de carteira que faltava — sem ela o vendedor não tinha
  // onde ver o funil inteiro, só os 16 cards da fila de ação.
  if(filtroSt==='abertos') lista=lista.filter(orcAbertoNoPipeline);
  else if(filtroSt!=='todos') lista=lista.filter(o=>o.status===filtroSt);
  if(filtroOrigem==='__sem__') lista=lista.filter(o=>!o.origem_cliente);
  else if(filtroOrigem) lista=lista.filter(o=>o.origem_cliente===filtroOrigem);
  if(busca) lista=lista.filter(o=>
    (o.cliente||'').toLowerCase().includes(busca)||
    (o.local_servico||'').toLowerCase().includes(busca)||
    String(o.numero||'').includes(busca.replace('#',''))
  );
  if(!lista.length){
    const msgBusca=busca?`Nenhum resultado para "<strong>${esc(busca)}</strong>"`:
      orcMesRef?`Nenhum orçamento em ${_renderOrcMesLabelStr()}.`:'Nenhum orçamento encontrado.';
    document.getElementById('hist-body').innerHTML=`<div class="empty-st"><div class="ei">📭</div><p>${msgBusca}</p><button class="btn-primary" style="margin-top:12px" onclick="novoOrc();go('form')">＋ Criar Orçamento</button></div>`; return;
  }
  // Ordenar por idade (mais velho primeiro) é o que serve para cobrar carteira:
  // o orçamento que está há mais tempo parado é o que corre risco de morrer.
  const _idadeDias=_idadeEmDias;
  if(histOrdem==='idade') lista=lista.slice().sort((a,b)=>_idadeDias(b)-_idadeDias(a));

  const sopts=s=>['pendente','aprovado','recusado','vencido'].map(x=>`<option value="${x}" ${x===s?'selected':''}>${x.charAt(0).toUpperCase()+x.slice(1)}</option>`).join('');
  const ocultarFinanceiro=eVendas();
  const setaIdade=histOrdem==='idade'?' ▼':'';
  let h=`<div class="htw"><table class="ht"><thead><tr><th>#</th><th>Cliente</th>${ocultarFinanceiro?'':'<th>Total / Recebido</th>'}<th style="cursor:pointer;user-select:none" onclick="histToggleOrdem()" title="Ordenar pelo tempo parado">Data / idade${setaIdade}</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
  lista.forEach(o=>{
    _nc[o.id]=o;
    const num=String(o.numero||'—').padStart(3,'0');
    const svs=(o.servicos||[]).map(s=>s.desc).join(', ')||'—';
    const dt=o.data_criacao?new Date(o.data_criacao).toLocaleDateString('pt-BR'):'—';
    const rec=o.valor_recebido||0, ttl=o.total||0;
    const recCl=rec>=ttl&&ttl>0?'opaid':rec>0?'opaid partial':'opaid none';
    const recTxt=rec>0?brl(rec):'—';
    const notaIcon=o.nota_interna?` <span title="${esc(o.nota_interna)}" style="cursor:help">📝</span>`:'';
    const pendSync=String(o.id).startsWith('local_');
    h+=`<tr>
      <td><span class="on">#${num}</span>${pendSync?'<div title="Não sincronizado com o banco — aguardando conexão" style="font-size:9px;font-weight:700;color:#dc2626;background:#fee2e2;border-radius:4px;padding:1px 5px;margin-top:2px;text-align:center">⚠ PEND.</div>':''}</td>
      <td><div class="ocl">${esc(o.cliente||'—')}${notaIcon}</div><div class="oloc">${esc(o.local_servico||'')}</div><div class="osvc" title="${esc(svs)}">${esc(svs)}</div><div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap;align-items:center">${getLojaBadge(o.loja_id)}${getOrigemBadge(o.origem_cliente)}</div>${(()=>{ const etapas=[]; const st=o.status||'pendente'; const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id); const entregue=!orcTemEntregaPendente(o)&&(o.servicos||[]).some(s=>s.produto_id); const etApr=st==='aprovado'||st==='recusado'||osVinc||entregue; const etOS=!!osVinc; const etConc=osVinc?.status==='concluido'; const dot=(ok,lbl)=>`<span style="display:flex;align-items:center;gap:2px;font-size:10px;color:${ok?'#16a34a':'#9ca3af'};font-weight:${ok?'700':'400'}">${ok?'●':'○'} ${lbl}</span>`; return `<div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">${dot(true,'Criado')}›${dot(etApr,'Aprovado')}›${dot(etOS,'OS')}›${dot(etConc,'Concluído')}</div>`; })()}</td>
      ${ocultarFinanceiro?'':'<td><span class="otot">'+brl(ttl)+'</span><br><span class="'+recCl+'" style="font-size:11px">'+recTxt+'</span></td>'}
      <td><span class="odt">${dt}</span>${(()=>{ if(!orcAbertoNoPipeline(o)) return ''; const d=_idadeDias(o); const cor=d>90?'var(--red)':d>30?'var(--yellow)':'var(--gray)'; return `<div style="font-size:11px;font-weight:600;color:${cor};margin-top:2px">${d===0?'hoje':'há '+d+'d'}</div>`; })()}</td>
      <td><select class="ss ${o.status||'pendente'}" onchange="mudarSt('${o.id}',this)">${sopts(o.status||'pendente')}</select>${orcPrecoARevalidar(o)?'<div title="O prazo do preço expirou, mas o negócio continua no funil (equipamento ou acima de R$ 15 mil). Revalide o valor antes de retomar o contato." style="font-size:9px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:4px;padding:2px 5px;margin-top:3px;text-align:center;line-height:1.25">⏳ PREÇO A<br>REVALIDAR</div>':''}</td>
      <td><div class="ta">
        <button class="tb" title="Ver PDF" onclick="verOrcPDF('${o.id}')">👁</button>
        <button class="tb" title="Editar" onclick="abrirOrc('${o.id}')">✎</button>
        <button class="tb" title="Duplicar" onclick="duplicarOrc('${o.id}')">⧉</button>
        ${(()=>{ const osVinc=(todosOS||[]).find(x=>x.orcamento_id===o.id); if(osVinc){ const stOS=osVinc.status||'agendado'; const stLabel={agendado:'agendada',em_andamento:'em andamento',concluido:'concluída'}[stOS]||stOS; return `<button class="tb" title="OS #${String(osVinc.numero||'').padStart(3,'0')} — ${stLabel}" onclick="verDetalhesOS('${osVinc.id}')" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700">✅ OS#${String(osVinc.numero||'').padStart(3,'0')}</button>`; } if(o.status==='aprovado') return `<button class="tb" title="Gerar Ordem de Serviço" onclick="gerarOS_deOrc('${o.id}')" style="background:#C45E0A;color:white;border-color:#C45E0A;font-weight:700">📋 Gerar OS</button>`; return `<button class="tb" title="Gerar OS" onclick="gerarOS_deOrc('${o.id}')">📋</button>`; })()}
        ${orcTemEntregaPendente(o)?`<button class="tb g" title="Marcar como entregue (baixa do estoque)" onclick="entregarOrcamento(getNC('${o.id}'),'manual')">📦 Entregar</button>`:''}
        ${o.status==='aprovado'&&_orcTemItens(o)?`<button class="tb" title="Imprimir comprovante de entrega para o cliente conferir e assinar" onclick="gerarOrdemEntrega('${o.id}')">🧾 Entrega</button>`:''}
        ${ocultarFinanceiro?'':'<button class="tb g" title="Registrar pagamento" onclick="abrirModalPg(\''+o.id+'\','+ttl+')">💰</button>'}
        ${o.status==='aprovado'?`<button class="tb" title="Corrigir mês de aprovação no faturamento" onclick="corrigirDataAprovacao('${o.id}')" style="font-size:10px;font-weight:700;color:#b45309;border-color:#fbbf24;background:#fef9c3">MÊS</button>`:''}
        ${!ocultarFinanceiro&&o.status==='aprovado'?`<button class="tb" title="Emitir Nota Fiscal" onclick="abrirModalNFe('${o.id}')" style="background:#7c3aed;color:white;border-radius:6px;padding:4px 7px;font-size:11px;font-weight:700;border:none;cursor:pointer">NF</button>`:''}
        <button class="tb" title="Enviar no WhatsApp" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifOrcamento(getNC('${o.id}')), '${o.tel_cliente||''}')">💬 WA</button>
        ${ocultarFinanceiro?'':'<button class="tb d" title="Excluir" onclick="excluirOrc(\''+o.id+'\')">🗑</button>'}
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('hist-body').innerHTML=h;
}

function corrigirDataAprovacao(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const atual=o.data_aprovacao?o.data_aprovacao.slice(0,10):'';
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  m.innerHTML=`<div style="background:var(--white);border-radius:14px;padding:22px 24px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,.18)">
    <div style="font-size:15px;font-weight:800;color:var(--c2);margin-bottom:4px">📅 Data de aprovação</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:14px">Orçamento #${String(o.numero||'').padStart(3,'0')} — ${esc(o.cliente||'')}</div>
    <input type="date" id="_fix-aprov-inp" value="${atual}" style="width:100%;padding:10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:14px;box-sizing:border-box">
    <div style="display:flex;gap:10px;margin-top:16px">
      <button onclick="this.closest('div[style]').remove()" style="flex:1;padding:10px;border:1.5px solid var(--gray-mid);border-radius:8px;background:var(--white);cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="_salvarDataAprovacao('${id}')" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--c1);color:white;cursor:pointer;font-size:13px;font-weight:700">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
}

function _salvarDataAprovacao(id){
  const inp=document.getElementById('_fix-aprov-inp'); if(!inp) return;
  const val=inp.value; if(!val){ toast('Informe a data'); return; }
  const iso=val+'T12:00:00.000Z';
  const o=todosOrc.find(x=>x.id===id); if(o) o.data_aprovacao=iso;
  lsOrcAtualizar(id,{data_aprovacao:iso});
  if(dbOk&&db&&!String(id).startsWith('local_'))
    orcSyncUpdate(id,{data_aprovacao:iso}).catch(e=>console.warn('[fixDataAprov]',e?.message||e));
  document.querySelector('div[style*="z-index:9999"]')?.remove();
  atualizarDash(); renderTabela();
  toast('✅ Data de aprovação corrigida');
}

async function mudarSt(id, sel){
  const st=sel.value;
  const o=todosOrc.find(x=>x.id===id);
  const stAnterior=o&&o.status; // antes do Object.assign — decide se saiu de "aprovado"
  // Forma de pagamento em branco/"A combinar" é normal enquanto o orçamento é
  // só uma proposta — mas na aprovação vira o dado que a Fase 1 (contas a
  // receber) usa para saber como cobrar. Medido: 33 dos 88 aprovados nunca
  // tiveram isso resolvido. Só trava quem está ENTRANDO em aprovado — reverter
  // pra pendente/recusado não precisa disso.
  if(o && st==='aprovado' && stAnterior!=='aprovado'){
    const pag=(o.pag_cod||'').trim();
    if(!pag || /^a combinar$/i.test(pag)){
      sel.value=stAnterior||'pendente';
      toast('⚠️ Defina a forma de pagamento antes de aprovar — sem isso, a parcela de recebimento não pode ser gerada e o financeiro fica sem saber como cobrar. Edite o orçamento e escolha em "Pagamento".');
      return;
    }
    // Item sem produto_id e sem marcar "avulso" é sinal de que ninguém decidiu
    // se aquilo é estoque ou não — mão de obra pura (o caso mais comum) nunca
    // teve e nunca vai ter produto pra vincular. Isso já foi bloqueio duro (até
    // 13/08) e travava quem vende serviço puro sem dar um jeito fácil de sair —
    // Elis relatou (13/08) ficar impedida de aprovar um orçamento só de mão de
    // obra até "cadastrar no estoque" algo que não deveria precisar de estoque
    // nenhum. Virou confirmação com resolução em 1 clique: continua avisando
    // (o objetivo original — Camboriú media 24,3% de cobertura — continua
    // válido), mas ninguém fica travado tendo que abrir o orçamento e caçar a
    // checkbox "não é produto" item por item.
    const semVinculo=(o.servicos||[]).filter(s=>!s.produto_id && !s.avulso && (s.desc||'').trim());
    if(semVinculo.length){
      const lista=semVinculo.slice(0,3).map(s=>'"'+s.desc.slice(0,40)+'"').join(', ');
      confirmar(
        `${semVinculo.length} ${semVinculo.length>1?'itens não estão':'item não está'} vinculado ao estoque (${lista}${semVinculo.length>3?'…':''}). Se for mão de obra/material sem SKU, pode aprovar mesmo assim — só não vai dar baixa automática no estoque por esses itens.`,
        ()=>{ semVinculo.forEach(s=>{ s.avulso=true; }); _mudarStProsseguir(id, sel, st, o, stAnterior); },
        'Itens sem vínculo de estoque',
        ()=>{ sel.value=stAnterior||'pendente'; },
        'Cancelar, vou revisar',
        'Aprovar mesmo assim'
      );
      return;
    }
  }
  _mudarStProsseguir(id, sel, st, o, stAnterior);
}
async function _mudarStProsseguir(id, sel, st, o, stAnterior){
  sel.className='ss '+st;
  const changes={status:st};
  if(st==='aprovado') changes.data_aprovacao=new Date().toISOString();
  if(o) Object.assign(o, changes);
  // Congela o custo ANTES da baixa: a baixa pode disparar recomputarCMP numa
  // entrada concorrente, e aí o custo gravado no item já seria outro.
  if(o && st==='aprovado') _congelarCustoOrc(o);
  // Manda servicos pro banco sempre que existir mudança nele — cobre tanto o
  // congelamento de custo acima quanto marcar "avulso" no passo de confirmação
  // (resolução em 1 clique): sem isso a próxima aprovação bloquearia de novo.
  if(o) changes.servicos=o.servicos;
  lsOrcAtualizar(id, changes);
  if(o) sincronizarBaixaOrcamento(o);
  // Reverter um aprovado invalida as parcelas de recebimento que nasceram
  // dessa aprovação — sem isto o aging mostra dinheiro a receber de uma
  // venda que voltou a ser proposta.
  if(stAnterior==='aprovado' && st!=='aprovado') await _limparRecebDoOrc(id, 'saiu de aprovado → '+st);
  atualizarDash();
  if(dbOk&&db&&!String(id).startsWith('local_'))
    orcSyncUpdate(id, changes).catch(e=>console.warn('[mudarSt]', e?.message||e));
  logAcao('orcamento_status', `#${o?.numero||'?'} ${o?.cliente||''} → ${st}`);
  // Feedback da baixa de estoque ao aprovar + modal para criar OS
  if(st==='aprovado' && o){
    const prods=(o.servicos||[]).filter(s=>s.produto_id);
    if(prods.length){
      const resumo=prods.map(s=>{
        const p=produtoById(s.produto_id);
        return `${Math.abs(parseInt(s.qty)||1)}× ${p?.nome||s.desc||s.produto_id}`;
      }).join(', ');
      toast(`✅ Aprovado · 📦 Baixado do estoque: ${resumo}`);
    } else { toast('✅ Orçamento aprovado!'); }
    setTimeout(()=>_perguntarRecebimento(o), 700); // captura o recebimento e depois segue p/ a OS
  } else { toast('✅ Status atualizado'); }
}

function excluirOrc(id){
  confirmar('Excluir este orçamento?', ()=>_excluirOrcVerificarEstoque(id), 'Excluir Orçamento');
}
function _excluirOrcVerificarEstoque(id){
  // Verificar se houve saídas físicas vinculadas a este orçamento
  const saidasVinculadas = todosMovEstoque.filter(m =>
    m.tipo === 'saida' && m.ref && m.ref.includes('baixa:orc:' + id)
  );
  if(saidasVinculadas.length === 0){
    _excluirOrcConfirmado(id);
    return;
  }
  // Montar resumo dos produtos que saíram
  const resumo = saidasVinculadas.map(m => {
    const p = produtoById(m.produto_id);
    return `• ${p?.nome || m.produto_id}: ${Math.abs(m.quantidade)} ${p?.unidade||'un'}`;
  }).join('\n');
  confirmar(
    `Este orçamento teve saída de estoque registrada:\n\n${resumo}\n\nDeseja estornar essas saídas e devolver os itens ao estoque?`,
    () => { _estornarSaidasOrc(id, saidasVinculadas); _excluirOrcConfirmado(id); },
    'Estornar estoque?'
  );
  // Adicionar botão "Não estornar" customizado após abrir o modal
  setTimeout(()=>{
    const naoBtn = document.getElementById('confirmar-nao');
    if(naoBtn){
      const semEstorno = naoBtn.cloneNode(true);
      semEstorno.textContent = 'Não estornar';
      semEstorno.onclick = () => {
        document.getElementById('confirmar-modal-bg')?.classList.remove('on');
        _excluirOrcConfirmado(id);
      };
      naoBtn.parentNode.insertBefore(semEstorno, naoBtn);
      naoBtn.style.display = 'none';
    }
  }, 0);
}
function _estornarSaidasOrc(orcId, saidas){
  const orc = todosOrc.find(x => x.id === orcId);
  const numStr = String(orc?.numero || '').padStart(3, '0');
  saidas.forEach(m => {
    const qtdEstorno = Math.abs(parseFloat(m.quantidade) || 0);
    if(qtdEstorno <= 0) return;
    registrarMovimento({
      produto_id: m.produto_id,
      tipo: 'entrada',
      quantidade: qtdEstorno,
      custo_unit: null,
      motivo: `Estorno — cancelamento orçamento #${numStr}`,
      ref: `estorno:orc:${orcId}:${m.produto_id}:${Date.now()}`,
      lojaId: orc?.loja_id || m.loja_id
    });
  });
  toast('↩ Estoque estornado');
  if(document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
}
async function _excluirOrcConfirmado(id){
  // Restaurar botão "Não" do modal caso tenha sido customizado
  const naoBtn = document.getElementById('confirmar-nao');
  if(naoBtn) naoBtn.style.display = '';
  const o=todosOrc.find(x=>x.id===id);
  if(o) sincronizarBaixaOrcamento({...o, status:'excluido'});
  await _limparRecebDoOrc(id, 'orçamento excluído');
  lsOrcRemover(id);
  if(!String(id).startsWith('local_')){
    _tombAdd('fluxa_orc_tombstones', id); // protege contra o orçamento ressuscitar se o delete abaixo falhar
    if(dbOk&&db) db.from('orcamentos').delete().eq('id',id).then(()=>{}).catch(()=>{});
  }
  todosOrc=todosOrc.filter(x=>x.id!==id); atualizarDash(); renderTabela();
  logAcao('orcamento_excluido', `#${o?.numero||'?'} ${o?.cliente||''}`);
  toast('🗑 Excluído');
}

function abrirOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  editId=id;
  // Preserva o vínculo já existente (não força o usuário a reselecionar o
  // cliente só porque abriu pra editar outra coisa, tipo o desconto).
  _orcClienteSelecionado = o.cliente_id ? {id:o.cliente_id, nome:o.cliente} : null;
  setV('cli',o.cliente||''); setV('loc',o.local_servico||''); setV('tel-cli',o.tel_cliente||''); setV('cnpj-cli',o.cnpj||'');
  setV('orc-loja',o.loja_id||lojaAtiva||LOJA_PADRAO_ID); // fix #4: lojaAtiva como fallback para registros antigos
  // Restaura condição de pagamento: pag_cod=código do select; pag_parcelas/pag_entrada=detalhes
  const _PAG_CODIGOS=['boleto-parc','entrada-boleto','entrada-pix','cartao-parc'];
  const _pagCod=o.pag_cod||(_PAG_CODIGOS.includes(o.pagamento)?o.pagamento:'A combinar');
  setV('pag',_pagCod); updPag();
  if(o.pag_parcelas) setV('pag-parcelas',String(o.pag_parcelas));
  if(o.pag_entrada!=null&&o.pag_entrada!==0) setV('pag-entrada',String(o.pag_entrada).replace('.',','));
  setV('val',String(o.validade_dias||5));
  setV('obs',o.obs||''); setV('escopo',o.escopo||''); setV('data-svc',o.data_servico||'');
  setV('nota-interna',o.nota_interna||'');
  setOrigemCli(o.origem_cliente||'');
  // Restaura desconto salvo (bug: antes o desconto sumia ao editar e salvar)
  setV('disc-v',o.desconto>0?String(o.desconto):''); setV('disc-t','R$');
  svcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc,p:String(s.precoUnit||s.preco||''),qty:s.qty||1,produto_id:s.produto_id||null,avulso:s.avulso||false}));
  if(!svcs.length) svcs=[{id:Date.now(),d:'',p:''}];
  // Compatibilidade: antigo=string, novo=JSON array
  try{
    const raw=o.foto_base64||'';
    fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]);
  }catch(e){ fotosB64=[]; }
  renderFotosOrcSlots();
  renderSvcs(); upd(); go('form');
  const bb=document.getElementById('form-back-bar');
  const bl=document.getElementById('form-back-label');
  if(bb){ bb.style.display='flex'; }
  if(bl){ bl.textContent='Editando ORC #'+String(o.numero).padStart(3,'0'); }
  toast('✏️ Editando Orçamento #'+String(o.numero).padStart(3,'0'));
}

function verOrcPDF(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  const numStr=String(o.numero||'').padStart(3,'0');
  const dadosOrc={
    cli:o.cliente||'—', loc:o.local_servico||'', tel:o.tel_cliente||'', cnpj:o.cnpj||'',
    pag:o.pag_cod||o.pagamento||'A combinar', pagFormatado:o.pagamento||'A combinar',
    dias:o.validade_dias||5, obs:o.obs||'', escopo:o.escopo||'',
    dataSvc:o.data_servico||'', vData:o.validade_data||'',
    dataStr:new Date(o.data_criacao||Date.now()).toLocaleDateString('pt-BR'),
    sub:o.subtotal||0, desc:o.desconto||0, tot:o.total||0,
    svcs:o.servicos||[], loja_id:o.loja_id||LOJA_PADRAO_ID
  };
  const savedFotos=[...fotosB64];
  try{ const raw=o.foto_base64||''; fotosB64=raw.startsWith('[')?JSON.parse(raw):(raw?[raw]:[]); }catch(e){ fotosB64=[]; }
  preencherDocOrc(dadosOrc, numStr);
  fotosB64=savedFotos;
  imprimirDoc('orc');
}

function duplicarOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  editId=null; fotosB64=[];
  setV('cli',o.cliente||''); setV('loc',o.local_servico||''); setV('tel-cli',o.tel_cliente||''); setV('cnpj-cli',o.cnpj||'');
  const _PAG_COD2=['boleto-parc','entrada-boleto','entrada-pix','cartao-parc'];
  setV('pag',o.pag_cod||(_PAG_COD2.includes(o.pagamento)?o.pagamento:'A combinar')); updPag();
  if(o.pag_parcelas) setV('pag-parcelas',String(o.pag_parcelas));
  if(o.pag_entrada!=null&&o.pag_entrada!==0) setV('pag-entrada',String(o.pag_entrada).replace('.',','));
  setV('val',String(o.validade_dias||5));
  setV('obs',o.obs||''); setV('escopo',o.escopo||'');
  setV('nota-interna',''); // não copia nota interna
  setV('data-svc','');
  setOrigemCli(o.origem_cliente||'');
  setV('orc-loja',o.loja_id||LOJA_PADRAO_ID);
  document.getElementById('data-orc').value=_hojeLocal();
  setV('disc-v',String(o.desconto||0)); setV('disc-t','R$');
  svcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc,p:String(s.precoUnit||s.preco||''),qty:s.qty||1,produto_id:s.produto_id||null,avulso:s.avulso||false}));
  if(!svcs.length) svcs=[{id:Date.now(),d:'',p:''}];
  renderFotosOrcSlots();
  const tog=document.getElementById('toggle-os'); if(tog) tog.checked=false;
  const osf=document.getElementById('os-inline-fields'); if(osf) osf.style.display='none';
  limparRascunho('form'); window._skipDraftForm=true; // não deixar rascunho antigo sobrescrever os dados duplicados
  renderSvcs(); upd(); go('form');
  toast('📋 Orçamento duplicado — edite e salve como novo');
}

function gerarOS_deOrc(id){
  const o=todosOrc.find(x=>x.id===id); if(!o) return;
  osEditId = null;
  osOrcId = id;
  setV('os-cli',o.cliente||''); setV('os-loc',o.local_servico||''); setV('os-cnpj',o.cnpj||'');
  setV('os-loja',o.loja_id||lojaAtiva||LOJA_PADRAO_ID);
  setV('os-data',o.data_servico||''); setV('os-total',String(o.total||0));
  osSvcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:s.desc}));
  if(!osSvcs.length) osSvcs=[{id:Date.now(),d:''}];
  renderOSSvcs();
  document.getElementById('os-src-badge').textContent='· do Orçamento #'+String(o.numero).padStart(3,'0');
  document.getElementById('btn-os-both').style.display='flex';
  document.getElementById('btn-os-pdf').style.gridColumn='';
  // Lista de materiais do estoque para o técnico separar
  const matEl=document.getElementById('os-mat');
  const prodsSvc=(o.servicos||[]).filter(s=>s.produto_id);
  if(matEl && prodsSvc.length){
    const linhas=prodsSvc.map(s=>{
      const p=produtoById(s.produto_id);
      return `• ${Math.abs(parseInt(s.qty)||1)}× ${p?.nome||s.desc} (${p?.unidade||'un'})`;
    });
    matEl.value='📦 Materiais a separar:\n'+linhas.join('\n');
  }
  go('os');
  atualizarPainelItensOS();
}

function novaOS(){
  osEditId=null; // OS nova
  _osClienteSelecionado=null;
  checkinAt=null; if(checkinTimer){clearInterval(checkinTimer);checkinTimer=null;}
  const checkinBarEl=document.getElementById('checkin-bar'); if(checkinBarEl) checkinBarEl.style.display='none';
  const checkinFormEl=document.getElementById('checkin-form'); if(checkinFormEl) checkinFormEl.style.display='flex';
  const checkinInfoEl=document.getElementById('checkin-info'); if(checkinInfoEl) checkinInfoEl.textContent='';
  populaTecCheckIn();
  osOrcId = null;
  osFotos=['','',''];
  [0,1,2].forEach(i=>{
    const prev=document.getElementById('os-foto-prev-'+i);
    const btn=document.getElementById('os-btn-rm-foto-'+i);
    const lbl=document.getElementById('os-foto-lbl-'+i);
    const inp=document.getElementById('os-foto-inp-'+i);
    if(prev) prev.style.display='none';
    if(btn) btn.style.display='none';
    if(lbl) lbl.textContent='Tirar/selecionar';
    if(inp) inp.value='';
  });
  setV('os-video-link','');
  setV('os-loja', lojaAtiva||LOJA_PADRAO_ID);
  document.getElementById('os-src-badge').textContent='';
  document.getElementById('btn-os-both').style.display='none';
  document.getElementById('btn-os-pdf').style.gridColumn='1/-1';
  const tituloEl=document.getElementById('os-form-titulo');
  if(tituloEl) tituloEl.textContent='Nova Ordem de Serviço';
  // Reseta checklist
  osChecklist = OS_CHECKLIST_DEFAULT.map(x=>({...x}));
  renderOsChecklist();
  // Limpa campos de texto (bug: dados da OS anterior ficavam no formulário)
  ['os-cli','os-loc','os-cnpj','os-obs','os-mat','os-total','os-tec'].forEach(id=>setV(id,''));
  setV('os-data', _hojeLocal());
  setV('os-hora','08:00');
  osSvcs=[{id:Date.now(),d:''}]; renderOSSvcs();
}

// ── MODAL PAGAMENTO ──
function abrirModalPg(id, tot){ modalOrcId=id; setV('mg-tot',brl(tot)); setV('mg-val',''); document.getElementById('modal-pg').classList.add('on'); }
function fecharModal(){ document.getElementById('modal-pg').classList.remove('on'); modalOrcId=null; }
async function salvarPagamento(){
  const v=parseFloat(gV('mg-val'))||0;
  const o=todosOrc.find(x=>x.id===modalOrcId); if(o){ o.valor_recebido=v; }
  lsOrcAtualizar(modalOrcId,{valor_recebido:v}); // persiste local
  if(dbOk&&db&&!String(modalOrcId||'').startsWith('local_'))
    dbUpdate('orcamentos', {valor_recebido:v}, 'id', modalOrcId).then(()=>{}).catch(()=>{});
  fecharModal(); atualizarDash(); renderTabela();
  if(document.getElementById('page-produtividade')?.classList.contains('on')) renderContasReceber();
  toast('💰 Pagamento registrado: '+brl(v));
}

// ──────────────────────────────────────────────────
//  OS HISTORY
// ──────────────────────────────────────────────────
async function loadOSHist(){
  // 1. SEMPRE mostra dados locais primeiro — sem depender do banco (mesmo
  // padrão de loadHist/loadVistoriasRemoto; antes esta função zerava
  // todosOS sempre que offline, mesmo com fluxa_os_hist cheio no aparelho).
  const local=(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]'); }catch(e){ return []; } })();
  if(local.length>0) todosOS=local;
  renderOSTabela();
  if(!(dbOk&&db)) return;

  // 2. Sincroniza em background e atualiza a view
  const body=document.getElementById('osh-body');
  if(body && !todosOS.length) body.innerHTML='<div class="load"><div class="spin"></div> Carregando…</div>';
  try{
    const {data,error}=await db.from('ordens_servico').select('*').order('data_criacao',{ascending:false});
    if(error) throw error;
    let remoto=data||[];
    // Respeita tombstones: OS apagada não volta. Se o delete anterior falhou
    // (ficou só local), tenta apagar de novo aqui.
    const _tomb=new Set(_tombLer('fluxa_os_tombstones'));
    if(_tomb.size){
      remoto.filter(r=>_tomb.has(r.id)).forEach(r=>db.from('ordens_servico').delete().eq('id',r.id).then(()=>{}).catch(()=>{}));
      remoto=remoto.filter(r=>!_tomb.has(r.id));
    }
    // Merge: BD é fonte de verdade + mantém OS presas só no aparelho
    // (criadas offline, ou editadas offline sobre uma OS já existente)
    const remotoIds=new Set(remoto.map(x=>x.id));
    // _pendingSync (edição offline sobre OS já existente) não tem timestamp no
    // id — não dá pra medir idade, deixa passar. local_os_ (criação nova) tem, e
    // segue a mesma guarda de 48h das outras tabelas.
    const soLocal=todosOS.filter(x=>(x._pendingSync===true||(String(x.id).startsWith('local_os_')&&_idadeIdMs(x.id)<DOIS_DIAS_MS))&&!remotoIds.has(x.id)&&!_tomb.has(x.id));
    todosOS=[...remoto,...soLocal];
    lsSet('fluxa_os_hist', JSON.stringify(todosOS.slice(0,200))); // mesmo teto usado nos demais pontos que escrevem fluxa_os_hist
    renderOSTabela();
    if(soLocal.length) await _reenviarOSLocais(soLocal);
  }catch(e){ console.warn('loadOSHist erro:',e?.message||e); }
}

function filtOS(btn){
  document.querySelectorAll('#page-os-history .fb[data-oss]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); filtroOSSt=btn.dataset.oss;
  lsSet('fluxa_filtroOSSt', filtroOSSt);
  renderOSTabela();
}
function buscarOS(v){ buscaOS=v.toLowerCase(); renderOSTabela(); }
function filtTecOS(val){ filtroOSTec=val; renderOSTabela(); }

function populaFiltTecOS(){
  const sel=document.getElementById('os-filt-tec'); if(!sel) return;
  const lojaObj=lojaAtiva?getLoja(lojaAtiva):null;
  let tecs;
  if(lojaObj){ tecs=lojaObj.tecs||[]; }
  else { tecs=[...new Set(LOJAS.flatMap(l=>l.tecs||[]))]; }
  sel.innerHTML='<option value="">👤 Todos técnicos</option>'+tecs.map(t=>`<option value="${t}" ${t===filtroOSTec?'selected':''}>${t}</option>`).join('');
}

// Auto-vence orçamentos pendentes cujo prazo de validade já expirou.
// Exceção: negócio de ciclo longo (equipamento ou >= R$ 15k) não morre pelo
// relógio — vira "preço a revalidar" e continua no funil. Ver orcCicloLongo().
function autoVencerOrc(lista){
  const hoje=_hojeZero();
  let mudou=false;
  lista.forEach(o=>{
    if(o.status!=='pendente') return;
    if(orcCicloLongo(o)) return;
    const expira=_orcValidadeData(o); if(!expira) return;
    if(expira<hoje){
      o.status='vencido'; mudou=true;
      lsOrcAtualizar(o.id,{status:'vencido'});
      if(dbOk&&db&&!String(o.id).startsWith('local_'))
        dbUpdate('orcamentos', {status:'vencido'}, 'id', o.id).then(()=>{}).catch(()=>{});
      // Vencido não pode segurar estoque: libera reservas deste orçamento
      if(typeof sincronizarReservaOrcamento==='function') sincronizarReservaOrcamento(o);
    }
  });
  if(mudou) atualizarDash();
  return lista;
}

function renderOSTabela(){
  populaFiltTecOS();
  let lista=todosOS;
  lista=filtrarPorLoja(lista);
  if(filtroOSSt!=='todos') lista=lista.filter(o=>o.status===filtroOSSt);
  if(filtroOSTec) lista=lista.filter(o=>(o.tecnico||'')===filtroOSTec);
  if(buscaOS) lista=lista.filter(o=>
    (o.cliente||'').toLowerCase().includes(buscaOS)||
    String(o.numero||'').includes(buscaOS.replace('#',''))
  );
  if(!lista.length){ document.getElementById('osh-body').innerHTML=`<div class="empty-st"><div class="ei">📋</div><p>Nenhuma OS encontrada.</p><button class="btn-primary" style="margin-top:12px" onclick="novaOS();go('os')">＋ Nova OS</button></div>`; return; }
  // Ordena: pendentes/atrasadas por data crescente primeiro; concluídas/canceladas no final
  const _hoje=_hojeLocal();
  lista=lista.slice().sort((a,b)=>{
    const ac=a.status==='concluido'||a.status==='cancelado';
    const bc=b.status==='concluido'||b.status==='cancelado';
    if(ac&&!bc) return 1; if(!ac&&bc) return -1;
    const da=a.data_servico||'9999'; const db2=b.data_servico||'9999';
    return da<db2?-1:da>db2?1:0;
  });
  let h=`<div class="htw"><table class="ht"><thead><tr><th>#</th><th>Cliente</th><th>Local</th><th>Data</th><th>Técnico</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
  lista.forEach(o=>{
    _nc[o.id]=o;
    const num=String(o.numero||'—').padStart(3,'0');
    const dt=o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):(o.data_criacao?new Date(o.data_criacao).toLocaleDateString('pt-BR'):'—');
    const atrasado=o.status==='agendado'&&o.data_servico&&o.data_servico<_hoje;
    const stCl=o.status==='concluido'?'os-concluido':o.status==='cancelado'?'os-cancelado':atrasado?'os-atrasado':'os-agendado';
    const stTx=o.status==='concluido'?'✅ Concluído':o.status==='cancelado'?'Cancelado':atrasado?'⚠️ Atrasado':'📅 Agendado';
    h+=`<tr>
      <td><span class="on">#${num}</span></td>
      <td><div class="ocl">${esc(o.cliente||'—')}</div>
        <div style="margin-top:3px">${getLojaBadge(o.loja_id)}</div></td>
      <td><div class="oloc">${esc(o.local_servico||'')}</div></td>
      <td><span class="odt">${dt}</span></td>
      <td><span style="font-size:12px">${esc(o.tecnico||'—')}</span></td>
      <td><span class="os-badge ${stCl}">${stTx}</span></td>
      <td><div class="ta">
        <button class="tb" onclick="editarOS('${o.id}')">✎ Editar</button>
        <button class="tb" title="Gerar PDF desta OS" onclick="_gerarPDFdaOS('${o.id}')">📄 PDF</button>
        ${o.status!=='concluido'&&o.status!=='cancelado'?`<button class="tb" title="Marcar como concluída (baixa de estoque automática)" onclick="concluirOSHistorico('${o.id}')" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700">✅ Concluir</button>`:''}
        ${o.status==='concluido'?`<button class="tb" title="Notif. OS concluída" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifConcluida(getNC('${o.id}')), '${o.tel_cliente||''}')">✅💬</button>`:''}
        ${o.status==='agendado'||atrasado?`<button class="tb" title="Lembrete de visita" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifVisita(getNC('${o.id}')), '${o.tel_cliente||''}')">📅💬</button>`:''}
        <button class="tb d" onclick="excluirOS('${o.id}')">🗑</button>
      </div></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  document.getElementById('osh-body').innerHTML=h;
}

// Tipo da OS: vistoria mensal (agendamento), do orçamento, ou serviço avulso
function _osTipo(o){ return o?.agendamento_id?'vistoria':o?.orcamento_id?'orcamento':'servico'; }
function _acharOS(id){
  return todosOS.find(x=>x.id===id)
    || (window._minhasOSAll||[]).find(x=>x.id===id)
    || (()=>{ try{ return (JSON.parse(ls('fluxa_os_hist')||'[]')||[]).find(x=>x.id===id); }catch(e){ return null; } })()
    || (getNC(id)?.id?getNC(id):null);
}
function editarOS(id){
  const o=_acharOS(id); if(!o||!o.id){ toast('OS não encontrada'); return; }
  _abrirOSForm(o);
}
function _abrirOSForm(o){
  osEditId=o.id;
  osOrcId=o.orcamento_id||null;
  _osClienteSelecionado = o.cliente_id ? {id:o.cliente_id, nome:o.cliente} : null;
  setV('os-cli',o.cliente||''); setV('os-loc',o.local_servico||'');
  setV('os-data',o.data_servico||''); setV('os-hora',o.hora||'08:00');
  // Técnico: auto-preencher com o usuário logado se o campo estiver vazio
  const nomeSessao=getSessao()?.nome||'';
  setV('os-tec',o.tecnico||nomeSessao); setV('os-total',String(o.total||0));
  setV('os-mat',o.materiais||''); setV('os-obs',o.obs_tecnica||'');
  setV('os-video-link',o.video_link||'');
  setV('os-loja',o.loja_id||lojaAtiva||LOJA_PADRAO_ID);
  // Check-in: pré-selecionar o técnico logado
  populaTecCheckIn();
  const checkinSel=document.getElementById('os-tec-checkin');
  if(checkinSel && nomeSessao){
    checkinSel.value=nomeSessao;
    if(!checkinSel.value){ // nome não está nas opções → adicionar
      const opt=document.createElement('option'); opt.value=nomeSessao; opt.textContent=nomeSessao; checkinSel.add(opt); checkinSel.value=nomeSessao;
    }
  }
  osSvcs=(o.servicos||[]).map(s=>({id:Date.now()+Math.random(),d:typeof s==='string'?s:s.desc||''}));
  if(!osSvcs.length) osSvcs=[{id:Date.now(),d:''}];
  osFotos=(o.fotos||[]).concat(['','','']).slice(0,3);
  osFotos.forEach((f,i)=>{
    const prev=document.getElementById('os-foto-prev-'+i);
    const btn=document.getElementById('os-btn-rm-foto-'+i);
    const lbl=document.getElementById('os-foto-lbl-'+i);
    if(f){prev.src=f;prev.style.display='block';if(btn)btn.style.display='block';if(lbl)lbl.textContent='Foto carregada';}
    else{prev.style.display='none';if(btn)btn.style.display='none';if(lbl)lbl.textContent='Tirar/selecionar';}
  });
  // Checklist: carrega da OS salva ou usa o padrão
  try{
    osChecklist=o.checklist?(typeof o.checklist==='string'?JSON.parse(o.checklist):o.checklist):OS_CHECKLIST_DEFAULT.map(x=>({...x}));
    if(!Array.isArray(osChecklist)||!osChecklist.length) osChecklist=OS_CHECKLIST_DEFAULT.map(x=>({...x}));
  }catch(e){ osChecklist=OS_CHECKLIST_DEFAULT.map(x=>({...x})); }
  renderOSSvcs();
  renderOsChecklist();
  document.getElementById('os-src-badge').textContent=osOrcId?'· vinculada a ORC':'';
  document.getElementById('btn-os-both').style.display=osOrcId?'flex':'none';
  document.getElementById('btn-os-pdf').style.gridColumn=osOrcId?'':'1/-1';
  const numStr='#'+String(o.numero||o.id||'').toString().padStart(3,'0');
  const tituloEl=document.getElementById('os-form-titulo');
  if(tituloEl) tituloEl.textContent='Editar OS '+numStr;
  go('os');
  // Após go() — aplicar modo técnico (campos do gestor read-only)
  const _tecMode = eTecnico();
  ['os-cli','os-loc','os-data','os-hora','os-cnpj'].forEach(fid=>{
    const el=document.getElementById(fid);
    if(!el) return;
    if(_tecMode){ el.setAttribute('readonly',''); el.style.background='var(--gray-light)'; el.style.color='var(--gray)'; }
    else{ el.removeAttribute('readonly'); el.style.background=''; el.style.color=''; }
  });
  // Empresa (select): desabilitar para técnico
  const lojaEl=document.getElementById('os-loja');
  if(lojaEl){ if(_tecMode) lojaEl.setAttribute('disabled',''); else lojaEl.removeAttribute('disabled'); }
  const btnAddSvc=document.querySelector('#page-os .btn-add');
  if(btnAddSvc) btnAddSvc.style.display=_tecMode?'none':'';
  atualizarPainelItensOS();
}

// ── Painel de itens (produtos do orçamento) para validar/baixar na OS ──
function atualizarPainelItensOS(){
  const card=document.getElementById('os-itens-card'); if(!card) return;
  const orc = osOrcId ? todosOrc.find(o=>o.id===osOrcId) : null;
  const itens = orc ? (orc.servicos||[]).filter(s=>s.produto_id) : [];
  if(!orc || !itens.length){ card.style.display='none'; return; }
  card.style.display='';
  const lista=document.getElementById('os-itens-lista');
  const btn=document.getElementById('os-itens-btn');
  const okMsg=document.getElementById('os-itens-ok');
  const tudoTratado = itens.every(s=>_entregueProdutoOrc(orc.id,s.produto_id));
  const podeBaixar = orc.status==='aprovado' && !tudoTratado;
  lista.innerHTML=itens.map(s=>{
    const p=produtoById(s.produto_id);
    const qty=parseInt(s.qty)||1;
    const tratado=_entregueProdutoOrc(orc.id,s.produto_id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-light)">
      <input type="checkbox" class="os-item-chk" data-pid="${s.produto_id}" ${tratado?'disabled':'checked'} style="width:18px;height:18px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p?p.nome:(s.desc||'produto'))}</div>
        <div style="font-size:11px;color:var(--gray)">${tratado?'✅ já confirmado':'pedido: '+fmtQtd(qty)+' '+(p?.unidade||'')}</div>
      </div>
      ${tratado?'':`<input type="number" class="os-item-qty" data-pid="${s.produto_id}" value="${qty}" min="0" step="1" title="Qtd levada" style="width:64px;padding:6px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;text-align:center">`}
    </div>`;
  }).join('');
  if(btn) btn.style.display=podeBaixar?'':'none';
  if(okMsg) okMsg.style.display=(tudoTratado)?'block':'none';
  if(btn && orc.status!=='aprovado' && !tudoTratado){
    btn.style.display='none';
    lista.innerHTML+=`<div style="font-size:12px;color:var(--yellow);padding-top:8px">⚠️ Aprove o orçamento para dar baixa dos itens.</div>`;
  }
}
function confirmarItensOS(){
  const orc = osOrcId ? todosOrc.find(o=>o.id===osOrcId) : null;
  if(!orc){ toast('OS sem orçamento vinculado'); return; }
  const qtyMap={};
  document.querySelectorAll('#os-itens-lista .os-item-chk').forEach(chk=>{
    if(chk.disabled) return;
    const pid=chk.dataset.pid;
    if(!chk.checked){ qtyMap[pid]=0; return; }
    const qi=document.querySelector('.os-item-qty[data-pid="'+pid+'"]');
    qtyMap[pid]=qi?parseFloat(qi.value)||0:0;
  });
  entregarOrcamento(orc, 'validar', qtyMap);
  atualizarPainelItensOS();
}

function excluirOS(id){
  confirmar('Excluir esta OS?', ()=>_excluirOSConfirmado(id), 'Excluir OS');
}
async function _excluirOSConfirmado(id){
  todosOS=todosOS.filter(x=>x.id!==id);
  const lista=(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]'); }catch(e){ return []; } })();
  lsSet('fluxa_os_hist', JSON.stringify(lista.filter(x=>x.id!==id)));
  if(!String(id).startsWith('local_os_')){
    _tombAdd('fluxa_os_tombstones', id); // protege contra a OS ressuscitar se o delete abaixo falhar
    if(dbOk&&db) db.from('ordens_servico').delete().eq('id',id).then(()=>{}).catch(()=>{});
  }
  renderOSTabela(); toast('🗑 OS excluída');
}

// ──────────────────────────────────────────────────
//  MINHAS OS — vista consolidada do técnico
// ──────────────────────────────────────────────────
let tecOSFiltro = 'pendente';
async function loadMinhasOS(){
  const sess = getSessao();
  if(!sess || sess.perfil !== 'tecnico'){ go('home'); return; }
  let lista = [];
  if(dbOk && db){
    try{
      // Carrega TODAS e filtra no cliente (casar por nome exato no banco era frágil)
      let q = db.from('ordens_servico').select('*').order('data_servico', {ascending:true});
      if(lojaAtiva) q=q.eq('loja_id', lojaAtiva);
      const {data} = await q;
      if(data) lista = data;
    }catch(e){ console.warn('[loadMinhasOS]', e?.message||e); }
  }
  if(!lista.length) lista = todosOS;
  const meu = (sess.nome||'').toLowerCase().trim();
  // nomes de técnicos REAIS (config das lojas) — p/ tratar nomes fantasmas como "sem técnico"
  const nomesReais = new Set(LOJAS.flatMap(l=>l.tecs||[]).map(t=>(t||'').toLowerCase().trim()));
  // Deduplicar por id (evita duplicatas de merge local+remoto)
  const vistos = new Set();
  // Deduplicar por orcamento_id+data_servico (OS gerada duas vezes do mesmo orc na mesma data)
  const orcDatas = new Set();
  lista = lista.filter(o=>{
    if(vistos.has(o.id)) return false;
    vistos.add(o.id);
    const t = (o.tecnico||'').toLowerCase().trim();
    // Excluir vistorias mensais (agendamento_id) — aparecem só em "Vistorias"
    if(o.agendamento_id) return false;
    if(!(t===meu || t==='' || !nomesReais.has(t))) return false;
    // Remover duplicata de mesmo orçamento na mesma data (mantém o de menor número)
    if(o.orcamento_id){
      const chave = o.orcamento_id + '|' + (o.data_servico||'');
      if(orcDatas.has(chave)) return false;
      orcDatas.add(chave);
    }
    return true;
  });
  window._minhasOSAll = lista;
  renderMinhasOS();
}
function renderMinhasOS(){
  let lista = (window._minhasOSAll || []).filter(o => {
    if(tecOSFiltro === 'pendente') return o.status !== 'concluido' && o.status !== 'cancelado';
    if(tecOSFiltro === 'concluido') return o.status === 'concluido';
    return true;
  });
  const el = document.getElementById('tec-os-lista');
  if(!el) return;
  if(!lista.length){
    el.innerHTML = `<div class="empty-st"><div class="ei">📋</div><p>Nenhuma OS encontrada.</p></div>`;
    return;
  }
  const _hj=_hojeLocal();
  // Ordena: pendentes por data crescente; concluídas/canceladas no final
  lista=lista.slice().sort((a,b)=>{
    const ac=a.status==='concluido'||a.status==='cancelado';
    const bc=b.status==='concluido'||b.status==='cancelado';
    if(ac&&!bc) return 1; if(!ac&&bc) return -1;
    const da=a.data_servico||'9999'; const db2=b.data_servico||'9999';
    return da<db2?-1:da>db2?1:0;
  });
  el.innerHTML = lista.map(o => {
    const num = String(o.numero||'?').padStart(3,'0');
    const dt = o.data_servico ? new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const atrasado=o.status==='agendado'&&o.data_servico&&o.data_servico<_hj;
    const stCl = o.status==='concluido'?'os-concluido':o.status==='cancelado'?'os-cancelado':atrasado?'os-atrasado':'os-agendado';
    const stTx = o.status==='concluido'?'✅ Concluído':o.status==='cancelado'?'Cancelado':atrasado?'⚠️ Atrasado':'📅 Agendado';
    const svcs = (o.servicos||[]).map(s=>typeof s==='string'?s:(s.desc||s.d||'')).filter(Boolean).join(', ');
    const tipo=_osTipo(o);
    const tipoBadge = tipo==='vistoria'
      ? '<span style="font-size:10px;font-weight:700;background:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:50px">🔍 Vistoria</span>'
      : tipo==='orcamento'
      ? '<span style="font-size:10px;font-weight:700;background:var(--c1-light);color:var(--c1);padding:2px 8px;border-radius:50px">📄 Orçamento</span>'
      : '<span style="font-size:10px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:50px">🔧 Serviço</span>';
    const telCli=(o.tel_cliente||'').replace(/\D/g,'');
    const btnWA=o.status==='concluido'&&telCli
      ?`<button class="tb" style="background:var(--wa);color:white;border-color:var(--wa);font-size:11px;padding:5px 8px" title="Enviar relatório ao cliente via WhatsApp" onclick="event.stopPropagation();_enviarRelatorioOSWhats('${o.id}','${telCli}')">💬 WA</button>`:'';
    const btnPDF=`<button class="tb" style="font-size:11px;padding:5px 8px" title="Gerar PDF desta OS" onclick="event.stopPropagation();_gerarPDFdaOS('${o.id}')">📄 PDF</button>`;
    const naoConcluida=o.status!=='concluido'&&o.status!=='cancelado';
    // Botão grande de conclusão em 1 toque — para uso em campo, sem abrir o formulário longo
    const btnConcluir=naoConcluida
      ?`<button class="tb" style="background:#16a34a;color:white;border-color:#16a34a;font-weight:700;font-size:13px;padding:8px 14px" title="Concluir esta OS (baixa de estoque automática)" onclick="event.stopPropagation();concluirOSHistorico('${o.id}')">✅ Concluir</button>`:'';
    return `<div class="tec-os-card" onclick="editarOS('${o.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px">
        <span class="on">#${num}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${tipoBadge}<span class="os-badge ${stCl}">${stTx}</span></div>
      </div>
      <div class="tec-os-cli">${esc(o.cliente||'—')}</div>
      <div class="tec-os-det">${esc(o.local_servico||'')}${o.local_servico&&dt!=='—'?' · ':''}${dt!=='—'?`<strong>${dt}</strong>`:''}</div>
      ${svcs?`<div class="tec-os-det" style="margin-top:2px;color:var(--gray)">${esc(svcs)}</div>`:''}
      <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div>${getLojaBadge(o.loja_id)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${btnWA}${btnPDF}${btnConcluir}</div>
      </div>
    </div>`;
  }).join('');
}
// Renomeada de filtTecOS: colidia com a de cima (mesmo nome, parâmetro
// diferente — uma recebe string do <select>, esta recebe o botão clicado).
// A de baixo sempre vencia por hoisting, e o <select onchange="filtTecOS(this.value)">
// do filtro de OS por técnico quebrava em silêncio: btn.classList.add('on')
// com btn=string lança TypeError, e o filtro nunca aplicava.
function filtStatusMinhasOS(btn){
  document.querySelectorAll('[data-tec-st]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  tecOSFiltro = btn.dataset.tecSt;
  renderMinhasOS();
}

// Abre a OS no formulário e dispara geração de PDF
async function _gerarPDFdaOS(id){
  const o=_acharOS(id); if(!o){ toast('OS não encontrada'); return; }
  _abrirOSForm(o); go('os');
  await new Promise(r=>setTimeout(r,350));
  gerarOSPDF('os');
}

// Envia mensagem de relatório da OS finalizada para o cliente via WhatsApp
function _enviarRelatorioOSWhats(id, tel){
  const o=_acharOS(id)||{}; const msg=notifConcluida(o);
  enviarNotifWA(msg, tel||o.tel_cliente||'');
}

// ──────────────────────────────────────────────────
//  OS FOTOS
// ──────────────────────────────────────────────────
function carregarOSFoto(inp, idx){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=e=>{
    osFotos[idx]=e.target.result;
    const prev=document.getElementById('os-foto-prev-'+idx);
    const lbl=document.getElementById('os-foto-lbl-'+idx);
    const btn=document.getElementById('os-btn-rm-foto-'+idx);
    prev.src=e.target.result; prev.style.display='block';
    if(lbl) lbl.textContent=f.name;
    if(btn) btn.style.display='block';
  };
  r.readAsDataURL(f);
}
function removerOSFoto(idx){
  osFotos[idx]='';
  const prev=document.getElementById('os-foto-prev-'+idx);
  const lbl=document.getElementById('os-foto-lbl-'+idx);
  const btn=document.getElementById('os-btn-rm-foto-'+idx);
  const inp=document.getElementById('os-foto-inp-'+idx);
  if(prev) prev.style.display='none';
  if(lbl) lbl.textContent='Tirar/selecionar';
  if(btn) btn.style.display='none';
  if(inp) inp.value='';
}

// ──────────────────────────────────────────────────
//  CLIENTES
// ──────────────────────────────────────────────────
const LS_CLI_FULL='fluxa_clientes_full';
function lsCliLer(){ try{ return JSON.parse(ls(LS_CLI_FULL)||'[]'); }catch(e){ return []; } }
function lsCliSalvar(l){ lsSet(LS_CLI_FULL,JSON.stringify(l)); }


function renderClientes(){
  // Regra simples: loja_id='aquamotor' → Aquamotor. Tudo mais → Fortemp.
  let lista=lsCliLer();
  if(lojaAtiva==='aquamotor'){
    lista=lista.filter(c=>c.loja_id==='aquamotor');
  } else {
    lista=lista.filter(c=>c.loja_id!=='aquamotor');
  }
  const el=document.getElementById('clientes-lista');
  const busca=(document.getElementById('cli-busca')?.value||'').toLowerCase().trim();
  if(busca){
    const q=busca.replace(/\D/g,'');
    lista=lista.filter(c=>(c.nome||'').toLowerCase().includes(busca)
      || (q && (c.tel||'').replace(/\D/g,'').includes(q))
      || (q && (c.cnpj||'').replace(/\D/g,'').includes(q))
      || (c.end||'').toLowerCase().includes(busca));
  }
  // Origem de aquisição por cliente — derivada dos orçamentos (o cliente não
  // guarda origem; ela fica no orçamento). Usa a do orçamento MAIS ANTIGO
  // (a aquisição real), ignorando "Já é cliente" quando há outra origem.
  // Deriva de TODOS os orçamentos (a origem é do cliente; a lista já está
  // escopada por empresa acima) — evita marcar "sem origem" à toa.
  const _orcsOrigem=(todosOrc||[]).filter(o=>o.origem_cliente)
    .slice().sort((a,b)=>String(a.data_criacao||'').localeCompare(String(b.data_criacao||'')));
  const origemPorNome={};
  _orcsOrigem.forEach(o=>{
    const n=(o.cliente||'').toLowerCase().trim(); if(!n) return;
    const org=o.origem_cliente;
    if(!origemPorNome[n]) origemPorNome[n]=org;
    else if(origemPorNome[n]==='Já é cliente' && org!=='Já é cliente') origemPorNome[n]=org;
  });
  const _origemDoCli=c=>origemPorNome[(c.nome||'').toLowerCase().trim()]||'';
  // Faturamento por cliente (todos os orçamentos aprovados, todas as lojas)
  const fatPorNome={};
  filtrarPorLoja(todosOrc).filter(o=>o.status==='aprovado').forEach(o=>{ const n=(o.cliente||'').toLowerCase(); fatPorNome[n]=(fatPorNome[n]||0)+(o.total||0); });
  lista.sort((a,b)=>(fatPorNome[(b.nome||'').toLowerCase()]||0)-(fatPorNome[(a.nome||'').toLowerCase()]||0) || (a.nome||'').localeCompare(b.nome||''));
  if(!lista.length){ el.innerHTML=`<div class="empty-st"><div class="ei">👥</div><p>${busca?'Nenhum cliente encontrado.':'Nenhum cliente cadastrado.'}</p>${busca?'':'<button class="btn-primary" style="margin-top:12px" onclick="mostrarFormCliente()">＋ Cadastrar Cliente</button>'}</div>`; return; }
  el.innerHTML=lista.map(c=>{
    const fat=fatPorNome[(c.nome||'').toLowerCase()]||0;
    const lojas=(c.lojas||[c.loja_id]).filter(Boolean);
    const lojasBadges=lojas.map(lid=>getLojaBadge(lid)).filter(Boolean).join('');
    const origemBadge=getOrigemBadge(_origemDoCli(c));
    return `
    <div class="cli-card">
      <div class="cli-card-info">
        <div class="cli-card-nome">${esc(c.nome)}${fat>0?` <span style="font-size:10px;background:var(--green-bg);color:var(--green);padding:1px 7px;border-radius:50px;font-weight:700">${brl(fat)}</span>`:''}</div>
        <div class="cli-card-det">${[c.tel||c.telefone,c.cnpj,c.end||c.endereco].filter(Boolean).map(x=>esc(x)).join(' · ')||'—'}${c.email_responsavel?' · ✉️ '+esc(c.email_responsavel):''}</div>
        ${(lojasBadges||origemBadge)?`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">${lojasBadges}${origemBadge}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
        <button class="tb" onclick="verHistoricoCliente('${c.id}')">📋 Hist.</button>
        <button class="tb" onclick="editarCliente('${c.id}')">✏️ Editar</button>
        <button class="tb" onclick="novoOrcParaCliente('${c.id}')">＋ Orç.</button>
        <button class="tb" onclick="novaOSParaCliente('${c.id}')">🔧 OS</button>
        <button class="tb d" onclick="excluirCliente('${c.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function novoOrcParaCliente(id){
  const c=lsCliLer().find(x=>x.id===id); if(!c) return;
  novoOrc();
  // Mantém _skipDraftForm=true até depois de preencher os campos do cliente,
  // evitando que o rascunho antigo sobrescreva os dados ao chamar go('form')
  window._skipDraftForm=true;
  setTimeout(()=>{
    setV('cli', c.nome);
    if(c.end)  setV('loc', c.end);
    if(c.tel)  setV('tel-cli', c.tel);
    if(c.cnpj) setV('cnpj-cli', c.cnpj);
    _orcClienteSelecionado={id:c.id, nome:c.nome}; // cliente já conhecido — liga cliente_id de verdade
    setOrigemCli('Já é cliente');
    upd();
  }, 50);
}

function novaOSParaCliente(id){
  const c=lsCliLer().find(x=>x.id===id); if(!c) return;
  novaOS();
  setTimeout(()=>{
    if(document.getElementById('os-cli'))  setV('os-cli',  c.nome);
    if(document.getElementById('os-loc'))  setV('os-loc',  c.end||'');
    if(document.getElementById('os-cnpj')) setV('os-cnpj', c.cnpj||'');
    go('os');
  }, 50);
}

// ──────────────────────────────────────────────────
//  HISTÓRICO COMPLETO DO CLIENTE
// ──────────────────────────────────────────────────
function verHistoricoCliente(cliId){
  const lista=lsCliLer();
  const cli=lista.find(x=>x.id===cliId); if(!cli){ toast('Cliente não encontrado'); return; }
  const nomeL=cli.nome.toLowerCase();
  const orcCli=filtrarPorLoja(todosOrc).filter(o=>(o.cliente||'').toLowerCase()===nomeL||o.cliente_id===cliId);
  const osCli=filtrarPorLoja(todosOS).filter(o=>(o.cliente||'').toLowerCase()===nomeL||o.cliente_id===cliId);
  const visCli=filtrarPorLoja(lsVisLer(),'loja_id').filter(v=>(v.cliente||'').toLowerCase()===nomeL);
  const agCli=filtrarPorLoja(todosAg).filter(a=>(a.cliente||'').toLowerCase()===nomeL);
  // cliente_id é o primeiro vínculo de verdade que este app tem (Etapa 1 do
  // roadmap de CRM) — casa por id quando a venda veio da busca de cliente, e
  // por nome como fallback (venda digitada à mão, sem selecionar da lista).
  const vendasCli=filtrarPorLoja(todasVendasBalcao||[]).filter(v=>v.cliente_id===cliId||(v.cliente_nome||'').toLowerCase()===nomeL);
  const totalFat=orcCli.filter(o=>o.status==='aprovado').reduce((a,o)=>a+(o.total||0),0);
  const totalOS=osCli.filter(o=>o.status==='concluido').reduce((a,o)=>a+(o.total||0),0);
  const totalVendas=vendasCli.reduce((a,v)=>a+(v.valor_total||0),0);
  const stC={aprovado:'var(--green)',pendente:'var(--yellow)',recusado:'var(--red)',vencido:'var(--gray)',agendado:'var(--blue)',concluido:'var(--green)',cancelado:'var(--red)'};
  const stBg={aprovado:'var(--green-bg)',pendente:'var(--yellow-bg)',recusado:'var(--red-bg)',vencido:'var(--gray-light)',agendado:'var(--blue-bg)',concluido:'var(--green-bg)',cancelado:'var(--red-bg)'};
  const _dt=(d,safe)=>{ if(!d) return '—'; try{ return new Date(safe?d+'T12:00:00':d).toLocaleDateString('pt-BR'); }catch(e){ return '—'; } };
  const existing=document.getElementById('modal-hist-cli'); if(existing) existing.remove();
  const m=document.createElement('div'); m.id='modal-hist-cli'; m.className='cli-hist-overlay';
  const orcHTML=orcCli.length?[...orcCli].sort((a,b)=>(b.numero||0)-(a.numero||0)).map(o=>`
    <div class="chi">
      <div>
        <div class="chi-desc">Orçamento #${String(o.numero||'').padStart(3,'0')}</div>
        <div class="chi-sub">${esc((o.servicos||[]).map(s=>s.desc||s).slice(0,2).join(', '))||'—'} · ${_dt(o.data_criacao)}</div>
      </div>
      <div class="chi-right">
        <div class="chi-val">${brl(o.total||0)}</div>
        <span class="chi-badge" style="background:${stBg[o.status]||'var(--gray-light)'};color:${stC[o.status]||'var(--gray)'}">${o.status||'—'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhum orçamento encontrado</div>';
  const osHTML=osCli.length?[...osCli].sort((a,b)=>(b.numero||0)-(a.numero||0)).map(o=>`
    <div class="chi">
      <div>
        <div class="chi-desc">OS #${String(o.numero||'').padStart(3,'0')} · ${esc(o.tecnico||'—')}</div>
        <div class="chi-sub">${esc(Array.isArray(o.servicos)?o.servicos.map(s=>typeof s==='string'?s:(s.desc||s)).slice(0,2).join(', '):'')||'—'} · ${_dt(o.data_servico, true)}</div>
      </div>
      <div class="chi-right">
        <div class="chi-val">${o.total?brl(o.total):'—'}</div>
        <span class="chi-badge" style="background:${stBg[o.status]||'var(--blue-bg)'};color:${stC[o.status]||'var(--blue)'}">${o.status||'agendado'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhuma OS encontrada</div>';
  const visHTML=visCli.length?[...visCli].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(v=>`
    <div class="chi">
      <div>
        <div class="chi-desc">Vistoria · ${esc(v.local||v.local_servico||'—')}</div>
        <div class="chi-sub">${esc(v.tecnico||'—')} · ${_dt(v.data, true)}</div>
      </div>
      <div class="chi-right">
        <span class="chi-badge" style="background:${v.status==='concluido'?'var(--green-bg)':'var(--blue-bg)'};color:${v.status==='concluido'?'var(--green)':'var(--blue)'}">${v.status||'realizada'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhuma vistoria encontrada</div>';
  const agHTML=agCli.length?[...agCli].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(a=>`
    <div class="chi">
      <div>
        <div class="chi-desc">${esc(a.tipo_servico||'Agendamento')} · ${esc(a.local_servico||'—')}</div>
        <div class="chi-sub">${esc(a.tecnico||'—')} · ${_dt(a.data, true)}${a.hora?' às '+a.hora:''}</div>
      </div>
      <div class="chi-right">
        <span class="chi-badge" style="background:${stBg[a.status]||'var(--blue-bg)'};color:${stC[a.status]||'var(--blue)'}">${a.status||'agendado'}</span>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhum agendamento encontrado</div>';
  const vendasHTML=vendasCli.length?[...vendasCli].sort((a,b)=>(b.data_criacao||'').localeCompare(a.data_criacao||'')).map(v=>`
    <div class="chi">
      <div>
        <div class="chi-desc">🛒 Venda balcão</div>
        <div class="chi-sub">${esc((v.itens||[]).map(i=>i.nome).slice(0,2).join(', '))||'—'} · ${_dt(v.data_criacao)}</div>
      </div>
      <div class="chi-right">
        <div class="chi-val">${brl(v.valor_total||0)}</div>
      </div>
    </div>`).join('')
    :'<div style="padding:10px 0;font-size:13px;color:var(--gray)">Nenhuma venda de balcão encontrada</div>';
  const totalGeral=totalFat+totalOS+totalVendas;
  m.innerHTML=`<div class="cli-hist-box">
    <div class="cli-hist-hdr">
      <div class="cli-hist-titulo">📋 ${esc(cli.nome)}</div>
      <button class="cli-hist-close" onclick="document.getElementById('modal-hist-cli').remove()">×</button>
    </div>
    <div class="cli-hist-body">
      ${cli.tel||cli.email_responsavel||cli.cnpj?`<div class="chi-contato">
        ${cli.tel?`<span>📞 ${esc(cli.tel)}</span>`:''}
        ${cli.email_responsavel?`<span>✉ ${esc(cli.email_responsavel)}</span>`:''}
        ${cli.cnpj?`<span>🏢 ${esc(cli.cnpj)}</span>`:''}
      </div>`:''}
      <div class="cli-hist-resumo">
        <div class="chr-item"><span class="chr-val">${orcCli.length}</span><div class="chr-label">Orçamentos</div></div>
        <div class="chr-item"><span class="chr-val">${osCli.length}</span><div class="chr-label">OS</div></div>
        <div class="chr-item"><span class="chr-val">${visCli.length}</span><div class="chr-label">Vistorias</div></div>
        <div class="chr-item"><span class="chr-val">${vendasCli.length}</span><div class="chr-label">Vendas balcão</div></div>
        <div class="chr-item"><span class="chr-val">${brl(totalGeral)}</span><div class="chr-label">Faturado</div></div>
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Orçamentos</div>${orcHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Ordens de Serviço</div>${osHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Vistorias</div>${visHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Agendamentos</div>${agHTML}
      </div>
      <div class="cli-hist-secao">
        <div class="cli-hist-sec-titulo">Vendas balcão</div>${vendasHTML}
      </div>
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}

function excluirCliente(id){
  confirmar('Excluir este cliente?', ()=>{
    const lista=lsCliLer().filter(x=>x.id!==id); lsCliSalvar(lista);
    // Antes só removia local — carregarClientesRemoto ("BD é fonte de
    // verdade") trazia o cliente de volta no próximo sync, sempre, porque
    // NUNCA existia um delete remoto correspondente.
    if(!String(id).startsWith('cli_')){
      _tombAdd('fluxa_cli_tombstones', id);
      if(dbOk&&db) db.from('clientes').delete().eq('id',id).then(()=>{}).catch(()=>{});
    }
    renderClientes(); toast('🗑 Cliente removido');
  }, 'Excluir Cliente');
}

let _cliEditId = null;
function editarCliente(id){
  const lista=lsCliLer();
  const c=lista.find(x=>x.id===id); if(!c) return;
  _cliEditId=id;
  setV('cli-new-nome',c.nome||'');
  setV('cli-new-tel',c.tel||'');
  setV('cli-new-end',c.end||'');
  setV('cli-new-cnpj',c.cnpj||'');
  setV('cli-new-email',c.email_responsavel||'');
  const tipoEl=document.getElementById('cli-new-tipo'); if(tipoEl) tipoEl.value=c.tipo||'';
  const wrap=document.getElementById('cli-form-wrap');
  wrap.style.display='block';
  // muda o título do form
  const btn=wrap.querySelector('button[onclick="salvarNovoCliente()"]');
  if(btn) btn.textContent='💾 Salvar alterações';
  const titulo=wrap.querySelector('.ct');
  if(titulo) titulo.textContent='Editar Cliente';
}

// Auto-cadastra cliente ao gerar orçamento/OS.
// Aquamotor é isolada: clientes dela nunca se mesclam com a Fortemp.
// Fortemp Camboriú e Itapema compartilham a mesma base.
// Auto-cadastra cliente ao salvar orçamento.
// Regra: loja_id='aquamotor' → grupo Aquamotor. Qualquer outra → grupo Fortemp.
// Nunca mistura entre grupos.
function _autoSalvarCliente(nome, tel, end, cnpj, lojaId){
  if(!nome||nome==='—') return;
  const nomeL=nome.toLowerCase();
  const eAqua=lojaId==='aquamotor';
  const lista=lsCliLer();
  const idx=lista.findIndex(c=>
    (c.nome||'').toLowerCase()===nomeL &&
    (eAqua ? c.loja_id==='aquamotor' : c.loja_id!=='aquamotor')
  );
  if(idx>=0) return; // já existe neste grupo
  const novo={id:'cli_'+Date.now(),nome,tel:tel||'',end:end||'',cnpj:cnpj||'',email_responsavel:'',tipo:'',portal_token:crypto.randomUUID(),loja_id:lojaId||null};
  lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db) salvarClienteRemoto({...novo, nome, tel, end, cnpj});
}

async function salvarNovoCliente(){
  const nome=gV('cli-new-nome').trim();
  if(!nome){ toast('⚠️ Informe o nome do cliente'); return; }
  if(_cliEditId){
    // modo edição
    const lista=lsCliLer();
    const idx=lista.findIndex(x=>x.id===_cliEditId);
    if(idx>=0){
      lista[idx]={...lista[idx], nome, tel:gV('cli-new-tel').trim(), end:gV('cli-new-end').trim(), cnpj:gV('cli-new-cnpj').trim(), email_responsavel:gV('cli-new-email').trim(), tipo:document.getElementById('cli-new-tipo')?.value||''};
      lsCliSalvar(lista);
      if(dbOk&&db&&!String(_cliEditId).startsWith('cli_')){ dbUpdate('clientes',{nome,telefone:lista[idx].tel,endereco:lista[idx].end,cnpj:lista[idx].cnpj||null,email_responsavel:lista[idx].email_responsavel||null,tipo:lista[idx].tipo||null},'id',_cliEditId).catch(e=>console.warn('cli update sync:',e?.message||e)); }
    }
    _cliEditId=null;
    document.getElementById('cli-form-wrap').style.display='none';
    renderClientes(); toast('✅ Cliente atualizado!'); return;
  }
  // modo novo
  const novo={id:'cli_'+Date.now(), nome, tel:gV('cli-new-tel').trim(), end:gV('cli-new-end').trim(), cnpj:gV('cli-new-cnpj').trim(), email_responsavel:gV('cli-new-email').trim(), tipo:document.getElementById('cli-new-tipo')?.value||'', portal_token:crypto.randomUUID(), loja_id:lojaAtiva||LOJA_PADRAO_ID};
  const lista=lsCliLer(); lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db){
    salvarClienteRemoto(novo);
  }
  document.getElementById('cli-form-wrap').style.display='none';
  renderClientes(); toast('✅ Cliente salvo!');
}

function mostrarFormCliente(){
  _cliEditId=null;
  const wrap=document.getElementById('cli-form-wrap');
  ['cli-new-nome','cli-new-tel','cli-new-end','cli-new-cnpj'].forEach(id=>setV(id,''));
  const btn=wrap.querySelector('button[onclick="salvarNovoCliente()"]');
  if(btn) btn.textContent='💾 Salvar Cliente';
  const titulo=wrap.querySelector('.ct');
  if(titulo) titulo.textContent='Novo Cliente';
  wrap.style.display='block';
}

// Une cadastro de clientes + nomes vistos em orçamentos/OS (mesmo sem cadastro formal)
function _baseClientesUnificada(){
  const cadastrados=lsCliLer();
  const vistos=new Map(); // nome lowercase → {nome, end, tel, cnpj, _cadastrado}
  // Supabase retorna telefone/endereco; registros locais usam tel/end — aceita ambos
  cadastrados.forEach(c=>{ if(c.nome) vistos.set(c.nome.toLowerCase(),{nome:c.nome,end:c.end||c.endereco||'',tel:c.tel||c.telefone||'',cnpj:c.cnpj||'',id:c.id,_cadastrado:true}); });
  (todosOrc||[]).forEach(o=>{
    const n=(o.cliente||'').trim(); if(!n) return;
    const k=n.toLowerCase();
    if(!vistos.has(k)) vistos.set(k,{nome:n,end:o.local_servico||'',tel:o.tel_cliente||'',cnpj:o.cnpj||'',_cadastrado:false});
  });
  (todosOS||[]).forEach(o=>{
    const n=(o.cliente||'').trim(); if(!n) return;
    const k=n.toLowerCase();
    if(!vistos.has(k)) vistos.set(k,{nome:n,end:o.local_servico||'',tel:'',cnpj:o.cnpj||'',_cadastrado:false});
  });
  return [...vistos.values()];
}

function mostrarSugestoesCli(val){
  const box=document.getElementById('cli-suggestions'); if(!box) return;
  if(!val||val.length<2){ box.style.display='none'; return; }
  const q=val.toLowerCase(); const qd=q.replace(/\D/g,'');
  const lista=_baseClientesUnificada().filter(c=>
    (c.nome||'').toLowerCase().includes(q)||(qd&&(c.cnpj||'').replace(/\D/g,'').includes(qd))
  ).sort((a,b)=>(b._cadastrado-a._cadastrado)).slice(0,6);
  if(!lista.length){ box.style.display='none'; return; }
  box.innerHTML=lista.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarSugestaoCli('${esc(c.nome)}','${esc(c.end||'')}','${esc(c.tel||'')}','${esc(c.cnpj||'')}','${esc(c.id||'')}')"><div class="cli-sug-name">${esc(c.nome)}${c._cadastrado?'':' <span style=\'font-size:10px;color:var(--gray);font-weight:400\'>(sem cadastro)</span>'}</div><div class="cli-sug-tel">${[c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join(' · ')}</div></div>`).join('');
  box.style.display='block';
}
function selecionarSugestaoCli(nome,end,tel,cnpj,id){
  setV('cli',nome); if(end) setV('loc',end); if(tel) setV('tel-cli',tel); if(cnpj) setV('cnpj-cli',cnpj);
  _orcClienteSelecionado = id ? {id,nome} : null;
  // Cliente da base → pré-sugere origem "Já é cliente" (editável)
  if(!gV('origem-cli')) setOrigemCli('Já é cliente');
  document.getElementById('cli-suggestions').style.display='none'; upd();
}
function hideSugCli(){ const b=document.getElementById('cli-suggestions'); if(b) b.style.display='none'; }
// Digitar por cima invalida o id vindo da sugestão — não dá pra garantir que
// o texto editado ainda é o mesmo cliente (mesma regra da venda de balcão).
function _orcClienteEditado(){ _orcClienteSelecionado=null; }

function mostrarSugestoesCliOS(val){
  const box=document.getElementById('os-cli-suggestions'); if(!box) return;
  if(!val||val.length<2){ box.style.display='none'; return; }
  const q=val.toLowerCase(); const qd=q.replace(/\D/g,'');
  const lista=_baseClientesUnificada().filter(c=>
    (c.nome||'').toLowerCase().includes(q)||(qd&&(c.cnpj||'').replace(/\D/g,'').includes(qd))
  ).sort((a,b)=>(b._cadastrado-a._cadastrado)).slice(0,6);
  if(!lista.length){ box.style.display='none'; return; }
  box.innerHTML=lista.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarSugestaoCliOS('${esc(c.nome)}','${esc(c.end||'')}','${esc(c.cnpj||'')}','${esc(c.id||'')}')"><div class="cli-sug-name">${esc(c.nome)}${c._cadastrado?'':' <span style=\'font-size:10px;color:var(--gray);font-weight:400\'>(sem cadastro)</span>'}</div><div class="cli-sug-tel">${[c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join(' · ')}</div></div>`).join('');
  box.style.display='block';
}
function selecionarSugestaoCliOS(nome,end,cnpj,id){
  setV('os-cli',nome); if(end) setV('os-loc',end); if(cnpj) setV('os-cnpj',cnpj);
  _osClienteSelecionado = id ? {id,nome} : null;
  document.getElementById('os-cli-suggestions').style.display='none';
}
function hideSugCliOS(){ const b=document.getElementById('os-cli-suggestions'); if(b) b.style.display='none'; }
function _osClienteEditado(){ _osClienteSelecionado=null; }

// ──────────────────────────────────────────────────
//  MODAL BUSCA CLIENTE
// ──────────────────────────────────────────────────
let _buscaCliCtx = 'orc';
function abrirBuscaCli(ctx){
  _buscaCliCtx = ctx || 'orc';
  document.getElementById('modal-cli-inp').value = '';
  filtrarListaCli('');
  document.getElementById('modal-busca-cli').style.display = 'flex';
  setTimeout(()=>document.getElementById('modal-cli-inp').focus(), 80);
}
function fecharBuscaCli(){ document.getElementById('modal-busca-cli').style.display='none'; }
function filtrarListaCli(val){
  const q = (val||'').toLowerCase().trim();
  let lista = lsCliLer();
  if(q){
    const qd=q.replace(/\D/g,'');
    lista = lista.filter(c=>
      (c.nome||'').toLowerCase().includes(q) ||
      (qd && (c.tel||c.telefone||'').replace(/\D/g,'').includes(qd)) ||
      (qd && (c.cnpj||'').replace(/\D/g,'').includes(qd)) ||
      (c.end||c.endereco||'').toLowerCase().includes(q)
    );
  }
  const el = document.getElementById('modal-cli-lista');
  if(!lista.length){
    el.innerHTML=`<div style="padding:20px;text-align:center;color:var(--gray);font-size:13px">Nenhum cliente encontrado</div>`;
    return;
  }
  el.innerHTML = lista.slice(0,60).map(c=>`
    <div class="modal-cli-item" onmousedown="selecionarCliModal('${esc(c.nome)}','${esc(c.end||'')}','${esc(c.tel||'')}','${esc(c.cnpj||'')}','${esc(c.id||'')}')">
      <div class="mcn">${esc(c.nome)}</div>
      <div class="mcd">${[c.end,c.tel,c.cnpj].filter(Boolean).map(x=>esc(x)).join('  ·  ')}</div>
    </div>`).join('');
}
// `id` é o 5º parâmetro (opcional) — os contextos antigos (orc/os/vis) nunca
// precisaram do id real do cliente (só texto livre). O contexto 'venda' é o
// primeiro a precisar de verdade, pra vendas_balcao.cliente_id não ficar
// sempre nulo quando o cliente já está cadastrado.
function selecionarCliModal(nome, end, tel, cnpj, id){
  if(_buscaCliCtx === 'os'){
    setV('os-cli', nome);
    if(end) setV('os-loc', end);
    if(cnpj) setV('os-cnpj', cnpj);
    _osClienteSelecionado = id ? {id, nome} : null;
  } else if(_buscaCliCtx === 'vis'){
    setV('vis-cli', nome);
    if(end) setV('vis-loc', end);
    _visClienteSelecionado = id ? {id, nome} : null;
    // auto-fill email from client record
    const clis=JSON.parse(ls('fluxa_clientes_full')||'[]');
    const cliVis=clis.find(c=>(c.nome||'')=== nome);
    if(cliVis?.email_responsavel){
      setV('vis-email-resp', cliVis.email_responsavel);
      const st=document.getElementById('vis-email-status'); if(st) st.textContent=`📧 ${cliVis.email_responsavel} (do cadastro)`;
    }
  } else if(_buscaCliCtx === 'venda'){
    setV('venda-cli', nome);
    _vendaClienteSelecionado = id ? {id, nome} : null;
    _vendaAnonimo = false;
  } else if(_buscaCliCtx === 'eq'){
    setV('eq-cli-nome', nome);
    _eqClienteSelecionado = id ? {id, nome} : null;
    _eqPiscinaSelecionadaId = null;
    _eqRenderPiscinas();
  } else {
    setV('cli', nome);
    if(end) setV('loc', end);
    if(tel) setV('tel-cli', tel);
    if(cnpj) setV('cnpj-cli', cnpj);
    _orcClienteSelecionado = id ? {id, nome} : null;
    // Cliente da base → pré-sugere origem "Já é cliente" (editável)
    if(!gV('origem-cli')) setOrigemCli('Já é cliente');
    upd();
  }
  fecharBuscaCli();
}

async function importarClientesDeOrcamentos(){
  const orcs = todosOrc.length ? todosOrc : lsOrcLer();
  if(!orcs.length){ toast('Nenhum orçamento encontrado.'); return; }
  let novos=0, atualizados=0;
  for(const o of orcs){
    if(!o.cliente||o.cliente==='—') continue;
    const lista=lsCliLer();
    const existe=lista.find(c=>(c.nome||'').toLowerCase()===o.cliente.toLowerCase());
    if(existe){
      let mudou=false;
      if(!existe.tel&&o.tel_cliente){ existe.tel=o.tel_cliente; mudou=true; }
      if(!existe.end&&o.local_servico){ existe.end=o.local_servico; mudou=true; }
      if(!existe.cnpj&&o.cnpj){ existe.cnpj=o.cnpj; mudou=true; }
      if(mudou){ lsCliSalvar(lista); atualizados++; }
    } else {
      const novo={id:'cli_'+Date.now()+Math.random(),nome:o.cliente,tel:o.tel_cliente||'',end:o.local_servico||'',cnpj:o.cnpj||'',portal_token:crypto.randomUUID()};
      lista.unshift(novo); lsCliSalvar(lista);
      if(dbOk&&db) salvarClienteRemoto({...novo, loja_id:lojaAtiva||LOJA_PADRAO_ID});
      novos++;
    }
  }
  renderClientes();
  toast(`✅ Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s)`);
}

async function autoSalvarClienteDoOrc(dados){
  if(!dados.cli||dados.cli==='—') return;
  const lista=lsCliLer();
  const existe=lista.find(c=>(c.nome||'').toLowerCase()===dados.cli.toLowerCase());
  if(existe){
    // atualiza campos em branco se o orçamento tem mais info
    let mudou=false;
    if(!existe.tel&&dados.tel){ existe.tel=dados.tel; mudou=true; }
    if(!existe.end&&dados.loc){ existe.end=dados.loc; mudou=true; }
    if(!existe.cnpj&&dados.cnpj){ existe.cnpj=dados.cnpj; mudou=true; }
    if(mudou){ lsCliSalvar(lista); if(dbOk&&db&&!String(existe.id).startsWith('cli_')) { try{ await dbUpdate('clientes', {telefone:existe.tel,endereco:existe.end,cnpj:existe.cnpj||null}, 'id', existe.id); }catch(e){ console.warn('[cli:update]', e?.message||e); } } }
    return;
  }
  const novo={id:'cli_'+Date.now(),nome:dados.cli,tel:dados.tel||'',end:dados.loc||'',cnpj:dados.cnpj||'',portal_token:crypto.randomUUID()};
  lista.unshift(novo); lsCliSalvar(lista);
  if(dbOk&&db) salvarClienteRemoto({...novo, loja_id:novo.loja_id||LOJA_PADRAO_ID});
}

// ──────────────────────────────────────────────────
//  CHIPS CLIENTES
// ──────────────────────────────────────────────────
function salvarChip(){ const nm=gV('cli').trim(),lo=gV('loc').trim(); if(!nm) return; let l=JSON.parse(ls('fluxa_clientes')||'[]'); l=l.filter(c=>c.n!==nm); l.unshift({n:nm,l:lo}); if(l.length>8) l=l.slice(0,8); lsSet('fluxa_clientes',JSON.stringify(l)); renderChips(); }
function renderChips(){ const w=document.getElementById('chips-wrap'),c=document.getElementById('chips'); if(!w||!c) return; /* seção "Recentes" removida — sugestão/pesquisa substitui */ const l=JSON.parse(ls('fluxa_clientes')||'[]'); if(!l.length){w.style.display='none';return;} w.style.display='block'; c.innerHTML=''; l.forEach(x=>{ const ch=document.createElement('div'); ch.className='chip'; ch.innerHTML=`<span onclick="fillChip('${esc(x.n)}','${esc(x.l)}')">${esc(x.n)}</span><span class="chip-x" onclick="rmChip('${esc(x.n)}')">✕</span>`; c.appendChild(ch); }); }
function fillChip(n,l){ setV('cli',n); setV('loc',l); upd(); }
function rmChip(n){ let l=JSON.parse(ls('fluxa_clientes')||'[]'); l=l.filter(c=>c.n!==n); lsSet('fluxa_clientes',JSON.stringify(l)); renderChips(); }

// ──────────────────────────────────────────────────
//  PRINT — seleciona qual documento mostrar
// ──────────────────────────────────────────────────
let _printTitleBackup='';
window.addEventListener('beforeprint',()=>{
  const showOrc = printMode==='orc' || printMode==='both';
  const showOs  = printMode==='os'  || printMode==='both';
  const showVis = printMode==='vis';
  const showEnt = printMode==='entrega';
  document.getElementById('pdoc-orc').classList.toggle('print-active', showOrc);
  document.getElementById('pdoc-os').classList.toggle('print-active',  showOs);
  document.getElementById('pdoc-entrega')?.classList.toggle('print-active', showEnt);
  // pdoc-visita: se n\u00E3o for modo vis, garante que n\u00E3o aparece
  const pdocVis = document.getElementById('pdoc-visita');
  if(pdocVis && !showVis) pdocVis.classList.remove('print-active');
  // Auto-name the PDF file
  _printTitleBackup = document.title;
  try{
    if(showVis){
      // Nome: VISTORIA_NomeCliente_dd-mm-aaaa
      const cliEl = document.getElementById('pd-cli-nm-vis');
      const numEl = document.getElementById('pd-num-vis');
      const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const dt  = (numEl?.textContent||'').replace(/\//g,'-');
      document.title = cli ? `Vistoria_${cli}_${dt}` : `Vistoria_${dt||'relatorio'}`;
    } else {
      const refMode = printMode==='os' ? 'os' : printMode==='entrega' ? 'ent' : 'orc';
      const numEl = document.getElementById('pd-num-'+refMode);
      const cliEl = document.getElementById('pd-cli-nm-'+refMode);
      const num = (numEl?.textContent||'').replace(/[^0-9]/g,'').padStart(3,'0');
      const cli = (cliEl?.textContent||'').replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g,'').trim().replace(/\s+/g,'_');
      const prefix = printMode==='os'?'OS':printMode==='both'?'ORC+OS':printMode==='entrega'?'ENTREGA':'ORC';
      if(cli && num) document.title = `${cli}_${prefix}${num}`;
      else if(num) document.title = `${prefix}${num}`;
    }
  }catch(e){}
});
window.addEventListener('afterprint',()=>{
  document.getElementById('pdoc-orc').classList.remove('print-active');
  document.getElementById('pdoc-os').classList.remove('print-active');
  document.getElementById('pdoc-visita')?.classList.remove('print-active');
  document.getElementById('pdoc-entrega')?.classList.remove('print-active');
  document.title = _printTitleBackup || 'Sistema de Orçamentos';
  printMode = '';
});

// Impressão mobile-safe: o Android Chrome NÃO dispara o evento `beforeprint`,
// então o `.pdoc` ficava display:none e o PDF saía EM BRANCO no celular.
// imprimirDoc() aplica a classe print-active MANUALMENTE antes de window.print(),
// sem depender do evento. Use SEMPRE isto no lugar de `printMode=x; window.print()`.
function imprimirDoc(modo){
  printMode = modo;
  const showOrc = modo==='orc' || modo==='both';
  const showOs  = modo==='os'  || modo==='both';
  const showVis = modo==='vis';
  const showEnt = modo==='entrega';
  document.getElementById('pdoc-orc')?.classList.toggle('print-active', showOrc);
  document.getElementById('pdoc-os')?.classList.toggle('print-active',  showOs);
  document.getElementById('pdoc-visita')?.classList.toggle('print-active', showVis);
  document.getElementById('pdoc-entrega')?.classList.toggle('print-active', showEnt);
  // Nome do arquivo PDF: no desktop o beforeprint nomeia; no Android ele não
  // dispara — sem isto o cliente recebia "Acquamotor — Orçamentos.pdf".
  // (Mesma lógica do beforeprint — manter as duas em sincronia.)
  const _tituloOriginal = document.title;
  try{
    if(showVis){
      const cli=(document.getElementById('pd-cli-nm-vis')?.textContent||'').replace(/[^a-zA-Z0-9À-ɏ\s]/g,'').trim().replace(/\s+/g,'_');
      const dt =(document.getElementById('pd-num-vis')?.textContent||'').replace(/\//g,'-');
      document.title = cli ? `Vistoria_${cli}_${dt}` : `Vistoria_${dt||'relatorio'}`;
    } else {
      const refMode = modo==='os' ? 'os' : modo==='entrega' ? 'ent' : 'orc';
      const num=(document.getElementById('pd-num-'+refMode)?.textContent||'').replace(/[^0-9]/g,'').padStart(3,'0');
      const cli=(document.getElementById('pd-cli-nm-'+refMode)?.textContent||'').replace(/[^a-zA-Z0-9À-ɏ\s]/g,'').trim().replace(/\s+/g,'_');
      const prefix = modo==='os'?'OS':modo==='both'?'ORC+OS':modo==='entrega'?'ENTREGA':'ORC';
      if(cli && num) document.title = `${cli}_${prefix}${num}`;
      else if(num) document.title = `${prefix}${num}`;
    }
  }catch(e){ console.warn('[imprimirDoc:titulo]', e?.message||e); }
  window.print();
  // Android não dispara afterprint — restaura o título da aba depois que o
  // sistema de impressão já capturou o nome do arquivo.
  setTimeout(()=>{ document.title = _tituloOriginal; }, 4000);
}

// ──────────────────────────────────────────────────
//  REALTIME SYNC (Supabase)
// ──────────────────────────────────────────────────
let realtimeChannel = null;
function iniciarRealtimeSync(){
  if(realtimeChannel){ try{ db.removeChannel(realtimeChannel); }catch(e){ console.warn('[realtimeSync] falha ao remover canal anterior:',e?.message||e); } }
  realtimeChannel = db.channel('fluxa-sync')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'orcamentos'}, p=>{
      const novo=p.new;
      if(todosOrc.find(x=>x.id===novo.id)) return;
      todosOrc.unshift(novo);
      lsOrcUpsert(novo);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
      toast('🔔 Novo orçamento #'+String(novo.numero||'').padStart(3,'0')+' (outro dispositivo)');
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'orcamentos'}, p=>{
      const novo=p.new;
      lsOrcUpsert(novo);
      const idx=todosOrc.findIndex(x=>x.id===novo.id);
      if(idx>=0) todosOrc[idx]={...todosOrc[idx],...novo}; else todosOrc.unshift(novo);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'orcamentos'}, p=>{
      const id=p.old.id;
      todosOrc=todosOrc.filter(x=>x.id!==id);
      lsOrcRemover(id);
      atualizarDash();
      if(document.getElementById('page-history').classList.contains('on')) renderTabela();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'equipamentos'}, p=>{
      if(todosEq.find(x=>x.id===p.new.id)) return;
      todosEq.unshift(p.new); lsEqSalvar(todosEq);
      if(document.getElementById('page-equipamentos').classList.contains('on')) renderEqGrid();
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'equipamentos'}, p=>{
      const idx=todosEq.findIndex(x=>x.id===p.new.id);
      if(idx>=0) todosEq[idx]={...todosEq[idx],...p.new}; else todosEq.unshift(p.new);
      lsEqSalvar(todosEq);
      if(document.getElementById('page-equipamentos').classList.contains('on')) renderEqGrid();
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'equipamentos'}, p=>{
      todosEq=todosEq.filter(x=>x.id!==p.old.id); lsEqSalvar(todosEq);
      if(document.getElementById('page-equipamentos').classList.contains('on')) renderEqGrid();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'despesas'}, p=>{
      if(todasDesp.find(x=>x.id===p.new.id)) return;
      todasDesp.unshift(p.new); lsDespSalvar(todasDesp);
      if(document.getElementById('page-despesas').classList.contains('on')) renderDespesas();
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'despesas'}, p=>{
      const idx=todasDesp.findIndex(x=>x.id===p.new.id);
      if(idx>=0) todasDesp[idx]={...todasDesp[idx],...p.new}; else todasDesp.unshift(p.new);
      lsDespSalvar(todasDesp);
      if(document.getElementById('page-despesas').classList.contains('on')) renderDespesas();
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'despesas'}, p=>{
      todasDesp=todasDesp.filter(x=>x.id!==p.old.id); lsDespSalvar(todasDesp);
      if(document.getElementById('page-despesas').classList.contains('on')) renderDespesas();
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED') console.log('Realtime sync ativo');
    });
}

// ──────────────────────────────────────────────────
//  UTILS
// ──────────────────────────────────────────────────
function gV(id){ return (document.getElementById(id)||{}).value||''; }
function setV(id,v){ const el=document.getElementById(id); if(el) el.value=v; }
// Retorna a data de hoje no formato YYYY-MM-DD em horário local (não UTC)
function _hojeLocal(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function setV_el(id,v,prop){ const el=document.getElementById(id); if(el) el[prop]=v; }
function show(id){ const el=document.getElementById(id); if(el) el.style.display='flex'; }
function hide(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function safeKey(s){ return btoa(unescape(encodeURIComponent(s))).replace(/[^a-zA-Z0-9]/g,''); }
function ls(k){ try{return localStorage.getItem(k);}catch(e){return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch(e){ console.warn('[lsSet] localStorage.setItem falhou (quota cheia ou modo privado?) para',k,':',e?.message||e); } }
let _toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('on');
  // Erros/avisos ficam mais tempo na tela para dar tempo de ler.
  const dur=/⚠️|❌|erro|falh|inválid|cheio/i.test(msg)?8500:4000;
  if(_toastTimer) clearTimeout(_toastTimer); // não deixa um toast anterior cortar o atual
  _toastTimer=setTimeout(()=>t.classList.remove('on'),dur);
}
function hexA(hex,a){ try{ const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }catch(e){ return hex; } }

// ── Campo obrigatório: um jeito só de avisar ────────────────────────────────
// O marcador visual (asterisco) já existia — `label.req` no CSS — mas cada
// checagem de "faltou preencher" reinventava o próprio aviso, sem explicar o
// PORQUÊ (levantamento em docs/campos-obrigatorios-2026-08-08.md). Esta função
// não substitui as checagens existentes — é o padrão para as novas: foca,
// rola até o campo, pinta a borda e explica a consequência de deixar em
// branco, não só o "preencha isto aqui".
function avisarCampoObrigatorio(id, msg){
  const el=document.getElementById(id);
  if(el){
    el.classList.add('campo-obrig-erro');
    el.focus();
    el.scrollIntoView({behavior:'smooth', block:'center'});
    const limpa=()=>{ el.classList.remove('campo-obrig-erro'); el.removeEventListener('input',limpa); el.removeEventListener('change',limpa); };
    el.addEventListener('input', limpa, {once:true});
    el.addEventListener('change', limpa, {once:true});
  }
  toast('⚠️ '+msg);
}

// C-03 — Draft auto-save (rascunho automático de formulários)
const DRAFT_KEYS = {
  form: 'fluxa_draft_form',
  os:   'fluxa_draft_os',
};
function salvarRascunho(pagina){
  try{
    if(pagina === 'form'){
      const dados = {
        cli: gV('cli'), loc: gV('loc'), 'tel-cli': gV('tel-cli'), obs: gV('obs'),
        escopo: gV('escopo'), 'nota-interna': gV('nota-interna'),
        'origem-cli': gV('origem-cli'), 'origem-cli-outro': gV('origem-cli-outro'),
      };
      lsSet(DRAFT_KEYS.form, JSON.stringify(dados));
      const ind = document.getElementById('draft-indicator');
      const tm = document.getElementById('draft-time');
      if(ind && gV('cli')){
        const h = new Date(); tm.textContent = h.getHours().toString().padStart(2,'0')+':'+h.getMinutes().toString().padStart(2,'0');
        ind.style.display = 'block';
      }
    } else if(pagina === 'os'){
      const dados = {
        'os-cli': gV('os-cli'), 'os-loc': gV('os-loc'), 'os-data': gV('os-data'),
        'os-obs': gV('os-obs'), 'os-mat': gV('os-mat'),
      };
      lsSet(DRAFT_KEYS.os, JSON.stringify(dados));
    }
  }catch(e){ console.warn('[salvarRascunho] falhou:',e?.message||e); }
}
function restaurarRascunho(pagina){
  try{
    const raw = ls(DRAFT_KEYS[pagina]); if(!raw) return;
    const dados = JSON.parse(raw);
    Object.entries(dados).forEach(([k,v])=>setV(k,v));
    if(pagina==='form') updOrigemCli();
  }catch(e){ console.warn('[restaurarRascunho] rascunho corrompido, ignorado:',e?.message||e); }
}
function limparRascunho(pagina){
  try{
    localStorage.removeItem(DRAFT_KEYS[pagina]);
    if(pagina === 'form'){ const ind = document.getElementById('draft-indicator'); if(ind) ind.style.display='none'; }
  }catch(e){ console.warn('[limparRascunho]', e?.message||e); }
}
// Auto-save ao digitar
document.addEventListener('input', function(e){
  const activePage = document.querySelector('.page.on');
  if(!activePage) return;
  const pid = activePage.id;
  if(pid === 'page-form') salvarRascunho('form');
  else if(pid === 'page-os') salvarRascunho('os');
});
// Aviso antes de sair
window.addEventListener('beforeunload', function(e){
  const activePage = document.querySelector('.page.on');
  if(!activePage) return;
  const pid = activePage.id;
  if((pid === 'page-form' || pid === 'page-os') && gV(pid==='page-form'?'cli':'os-cli')){
    e.preventDefault(); e.returnValue = ''; return;
  }
  // Avisa se há orçamentos não sincronizados com o banco
  const pendentes=lsOrcLer().filter(x=>String(x.id).startsWith('local_'));
  if(pendentes.length){
    e.preventDefault();
    e.returnValue=`Atenção: ${pendentes.length} orçamento(s) ainda não foram sincronizados com o banco. Feche somente após ver o indicador ✅ na tabela.`;
  }
});

// Sync automático em background: tenta reenviar local_* a cada 90 segundos
(function _iniciarSyncPeriodico(){
  async function _tentarSync(){
    if(!dbOk||!db) return;
    const pendentes=lsOrcLer().filter(x=>String(x.id).startsWith('local_'));
    if(!pendentes.length) return;
    console.log(`[sync-auto] ${pendentes.length} orçamento(s) pendente(s), reenviando…`);
    const mudou=await _reenviarOrcamentosLocais(pendentes).catch(()=>false);
    if(mudou){
      lsOrcSalvar(todosOrc);
      atualizarDash(); renderTabela();
      toast('✅ Orçamentos pendentes sincronizados!');
    }
  }
  setInterval(_tentarSync, 90000);
  // Também tenta ao voltar para a aba (ex.: usuário estava offline e voltou)
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') setTimeout(_tentarSync,2000); });
})();

// M-01 — Diálogo de confirmação acessível (substitui window.confirm)
function confirmar(msg, cbSim, titulo, cbNao, labelNao, labelSim){
  const bg = document.getElementById('confirmar-modal-bg');
  const titEl = document.getElementById('confirmar-titulo');
  const msgEl = document.getElementById('confirmar-msg');
  const simBtn = document.getElementById('confirmar-sim');
  const naoBtn = document.getElementById('confirmar-nao');
  if(!bg){ cbSim(); return; } // fallback sem modal: confirma direto (PWA nunca cai aqui)
  titEl.textContent = titulo || 'Confirmar';
  msgEl.textContent = msg;
  naoBtn.textContent = labelNao || 'Cancelar';
  simBtn.textContent = labelSim || 'Confirmar';
  bg.classList.add('on');
  const fechar = () => { bg.classList.remove('on'); simBtn.onclick = null; naoBtn.textContent='Cancelar'; simBtn.textContent='Confirmar'; };
  naoBtn.onclick = () => { fechar(); if(cbNao) cbNao(); };
  simBtn.onclick = () => { fechar(); cbSim(); };
  setTimeout(()=>simBtn.focus(), 50);
}

// ══════════════════════════════════════════════════
//  MÓDULO 6 — NOTIFICAÇÕES WHATSAPP
// ══════════════════════════════════════════════════
function getPortalLinkCliente(nomeCliente){
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  const cli=clientes.find(c=>(c.nome||'').toLowerCase()===nomeCliente.toLowerCase());
  if(!cli||!cli.portal_token) return '';
  return window.location.origin+window.location.pathname+'#portal/'+cli.portal_token;
}

function aplicarVars(template, vars, lojaId){
  // Usa o branding da loja específica quando informado (multi-loja), senão o global
  const LC = lojaId ? getLojaConfig(lojaId) : null;
  const empresa = (LC&&LC.nome) || CFG.nome || '';
  const tel = (LC&&LC.tel) || CFG.tel || '';
  return template
    .replace(/\{nome\}/g, vars.nome||'')
    .replace(/\{hora\}/g, vars.hora||'')
    .replace(/\{tecnico\}/g, vars.tecnico||'')
    .replace(/\{servico\}/g, vars.servico||'')
    .replace(/\{valor\}/g, vars.valor||'')
    .replace(/\{link_portal\}/g, vars.link_portal||'')
    .replace(/\{empresa\}/g, empresa)
    .replace(/\{tel_empresa\}/g, tel);
}

function notifVisita(os){
  const template=CFG.notif_visita||CFG_DEF.notif_visita;
  const vars={
    nome:(os.cliente||'').split(' ')[0],
    hora:os.hora||'',
    tecnico:os.tecnico||'',
    servico:(os.servicos||[]).join(', '),
    link_portal:getPortalLinkCliente(os.cliente||'')
  };
  return aplicarVars(template, vars, os.loja_id);
}

function notifConcluida(os){
  const template=CFG.notif_concluida||CFG_DEF.notif_concluida;
  const vars={
    nome:(os.cliente||'').split(' ')[0],
    tecnico:os.tecnico||'',
    servico:(os.servicos||[]).join(', '),
    link_portal:getPortalLinkCliente(os.cliente||'')
  };
  return aplicarVars(template, vars, os.loja_id);
}

function notifOrcamento(orc){
  const template=CFG.notif_orcamento||CFG_DEF.notif_orcamento;
  const svcs=(orc.servicos||[]).map(s=>s.desc||s).join(', ');
  const vars={
    nome:(orc.cliente||'').split(' ')[0],
    servico:svcs,
    valor:brl(orc.total||0),
    link_portal:getPortalLinkCliente(orc.cliente||'')
  };
  return aplicarVars(template, vars, orc.loja_id);
}

function notifGarantia(eq){
  const template=CFG.notif_garantia||CFG_DEF.notif_garantia;
  const vars={
    nome:(eq.cliente_nome||'').split(' ')[0],
    servico:(eq.marca||'')+' '+(eq.modelo||'')+' ('+eq.tipo+')'
  };
  return aplicarVars(template, vars, eq.loja_id);
}

function copiarNotif(msg){
  navigator.clipboard.writeText(msg).then(()=>toast('✅ Mensagem copiada!')).catch(()=>toast('✅ Copiado!'));
}

function enviarNotifWA(msg, telCliente){
  let tel=(telCliente||'').replace(/\D/g,'');
  if(!tel){ toast('⚠️ Cliente sem telefone cadastrado'); return; }
  if(!tel.startsWith('55')) tel='55'+tel;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}


// ══════════════════════════════════════════════════
//  MÓDULO 5 — PORTAL DO CLIENTE
// ══════════════════════════════════════════════════
let portalCliente = null;

async function checkPortalHash(){
  const hash=window.location.hash;
  if(!hash.startsWith('#portal/')) return false;
  const token=hash.replace('#portal/','').trim();
  if(!token) return false;

  // Esconde tudo menos o portal
  document.getElementById('login-overlay').style.display='none';
  document.querySelector('.hdr').style.display='none';
  const mobNav=document.getElementById('mob-nav'); if(mobNav) mobNav.style.display='none';
  document.body.style.background='#f0f2f5';
  document.body.style.paddingTop='0';

  go('portal');

  // Conecta ao banco se não conectado
  if(!dbOk||!db){
    const sbUrl=ls('sb_url'), sbKey=ls('sb_key');
    if(sbUrl&&sbKey) await conectarDB(sbUrl,sbKey,false);
  }

  // Busca cliente pelo token
  try{
    let cli=null;
    if(dbOk&&db){
      const {data}=await db.from('clientes').select('*').eq('portal_token',token).single();
      cli=data;
    } else {
      const todos=JSON.parse(ls('fluxa_clientes_full')||'[]');
      cli=todos.find(x=>x.portal_token===token)||null;
    }
    if(!cli){ mostrarErroPortal(); return true; }
    portalCliente=cli;
    await renderPortal(cli);
  }catch(e){ mostrarErroPortal(); }
  return true;
}

function mostrarErroPortal(){
  document.getElementById('portal-loading').style.display='none';
  document.getElementById('portal-erro').style.display='block';
}

async function renderPortal(cli){
  document.getElementById('portal-loading').style.display='none';
  document.getElementById('portal-content').style.display='block';

  // fix #C: usa branding da loja do cliente, não o CFG global
  const LC = getLojaConfig(cli.loja_id);
  document.getElementById('portal-empresa-nome').textContent=LC.nome||'';
  document.getElementById('portal-empresa-sub').textContent=LC.sub||'';
  const logo=document.getElementById('portal-logo');
  if(LC.logoB64){ logo.src=LC.logoB64; logo.classList.add('has-logo'); }
  document.getElementById('portal-cli-nome').textContent='Olá, '+cli.nome+' 👋';

  // Próxima visita (busca OS agendadas do cliente)
  const osLocal=JSON.parse(ls('fluxa_os_hist')||'[]');
  let osCliente=osLocal.filter(o=>(o.cliente||'').toLowerCase()===cli.nome.toLowerCase());
  if(dbOk&&db){
    try{
      const {data}=await db.from('ordens_servico').select('*').ilike('cliente',cli.nome).order('data_servico',{ascending:true});
      if(data) osCliente=data;
    }catch(e){ console.warn('[portal:OS]', e?.message||e); }
  }
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const futuras=osCliente.filter(o=>o.status==='agendado'&&o.data_servico&&new Date(o.data_servico+'T12:00:00')>=hoje).sort((a,b)=>new Date(a.data_servico)-new Date(b.data_servico));
  const secVisita=document.getElementById('portal-sec-visita');
  if(futuras.length){
    secVisita.style.display='block';
    const prox=futuras[0];
    const d=new Date(prox.data_servico+'T12:00:00');
    document.getElementById('portal-proxima-visita').innerHTML=`
      <div class="portal-visita">
        <div class="portal-visita-data">${d.getDate()}<div style="font-size:11px">${d.toLocaleDateString('pt-BR',{month:'short'})}</div></div>
        <div class="portal-visita-info">
          <div class="portal-visita-tipo">${esc((prox.servicos||[]).join(', ')||'Visita técnica')}</div>
          <div class="portal-visita-tec">👤 ${esc(prox.tecnico||'')} ${prox.hora?' · ⏰ '+prox.hora:''}</div>
        </div>
      </div>`;
  }

  // Histórico de OS
  const concluidas=osCliente.filter(o=>o.status==='concluido').sort((a,b)=>new Date(b.data_criacao)-new Date(a.data_criacao)).slice(0,5);
  const secOS=document.getElementById('portal-sec-os');
  if(concluidas.length){
    secOS.style.display='block';
    document.getElementById('portal-os-lista').innerHTML=concluidas.map(o=>`
      <div class="portal-os-item">
        <div class="portal-os-data">${o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
        <div class="portal-os-desc">${esc((o.servicos||[]).join(', ')||'Serviço')}</div>
        <span class="os-badge os-concluido">✅</span>
      </div>`).join('');
  }

  // Orçamentos pendentes — fix #D: busca do Supabase se todosOrc estiver vazio (portal aberto sem login prévio)
  let orcsCliente=filtrarPorLoja(todosOrc).filter(o=>(o.cliente||'').toLowerCase()===cli.nome.toLowerCase()&&o.status==='pendente');
  if(!orcsCliente.length && dbOk && db){
    try{
      let qOrc=db.from('orcamentos').select('*').ilike('cliente',cli.nome).eq('status','pendente').order('data_criacao',{ascending:false});
      if(cli.loja_id) qOrc=qOrc.eq('loja_id',cli.loja_id);
      const {data:orcDb}=await qOrc;
      if(orcDb&&orcDb.length){
        orcsCliente=orcDb;
        // Adiciona ao cache em memória para aprovarOrcPortal funcionar
        orcDb.forEach(o=>{ if(!todosOrc.find(x=>x.id===o.id)) todosOrc.unshift(o); });
      }
    }catch(e){ console.warn('[portal:orcs]', e?.message||e); }
  }
  const secOrc=document.getElementById('portal-sec-orc');
  if(orcsCliente.length){
    secOrc.style.display='block';
    document.getElementById('portal-orcs').innerHTML=orcsCliente.map(o=>`
      <div class="portal-orc-item">
        <div class="portal-orc-num">Orçamento #${String(o.numero||'').padStart(3,'0')}</div>
        <div class="portal-orc-svcs">${esc((o.servicos||[]).map(s=>s.desc).join(', '))}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:8px">
          <div class="portal-orc-total">${brl(o.total||0)}</div>
          <div style="display:flex;gap:6px">
            <button class="ba" style="background:var(--green);color:white;padding:7px 14px;font-size:12px" onclick="abrirModalAssinatura('${o.id}')">✅ Aprovar</button>
            <button class="ba" style="background:var(--red);color:white;padding:7px 14px;font-size:12px" onclick="recusarOrcPortal('${o.id}')">❌ Recusar</button>
          </div>
        </div>
      </div>`).join('');
  }

  // Equipamentos
  let eqCliente=todosEq.filter(e=>(e.cliente_nome||'').toLowerCase()===cli.nome.toLowerCase());
  if(dbOk&&db&&!eqCliente.length){
    try{
      const {data}=await db.from('equipamentos').select('*').ilike('cliente_nome',cli.nome).eq('ativo',true);
      if(data&&data.length) eqCliente.push(...data);
    }catch(e){ console.warn('[portal:equipamentos]', e?.message||e); }
  }
  const secEq=document.getElementById('portal-sec-eq');
  if(eqCliente.length){
    secEq.style.display='block';
    const hoje2=new Date(); hoje2.setHours(0,0,0,0);
    const icons={Motobomba:'⚙️',Filtro:'🔵',Trocador:'🌡️','Gerador de Cloro':'🧪',Sauna:'♨️','Spa / Hidro':'🛁',Outro:'🔧'};
    document.getElementById('portal-eq-lista').innerHTML=eqCliente.map(eq=>{
      let gTxt='', gColor='var(--green)';
      if(eq.garantia_vencimento){
        const venc=new Date(eq.garantia_vencimento+'T12:00:00');
        const diff=Math.ceil((venc-hoje2)/(1000*60*60*24));
        if(diff<0){ gTxt='Garantia vencida'; gColor='var(--red)'; }
        else if(diff<=30){ gTxt=`Garantia vence em ${diff} dias`; gColor='var(--yellow)'; }
        else { gTxt=`Garantia até ${venc.toLocaleDateString('pt-BR')}`; }
      }
      return `<div class="portal-eq-item">
        <div class="portal-eq-tipo">${icons[eq.tipo]||'🔧'}</div>
        <div class="portal-eq-info">
          <div class="portal-eq-nome">${esc(eq.marca||'')} ${esc(eq.modelo||'')} <span style="font-size:11px;color:var(--gray)">${esc(eq.tipo||'')}</span></div>
          ${gTxt?`<div class="portal-eq-garantia" style="color:${gColor}">${gTxt}</div>`:''}
        </div>
      </div>`;
    }).join('');
  }
}

// ──────────────────────────────────────────────────
//  ASSINATURA DO CLIENTE (PORTAL)
// ──────────────────────────────────────────────────
function abrirModalAssinatura(orcId){
  const existing=document.getElementById('modal-assinatura'); if(existing) existing.remove();
  const m=document.createElement('div'); m.id='modal-assinatura'; m.className='cli-hist-overlay'; m.style.zIndex='1100';
  m.innerHTML=`<div class="cli-hist-box" style="max-height:none">
    <div class="cli-hist-hdr">
      <div class="cli-hist-titulo">✍️ Assinar Aprovação</div>
      <button class="cli-hist-close" onclick="document.getElementById('modal-assinatura').remove()">×</button>
    </div>
    <div style="padding:16px 20px 24px">
      <p style="font-size:13px;color:var(--gray);margin-bottom:12px">Assine abaixo para confirmar a aprovação deste orçamento. Sua assinatura será registrada.</p>
      <div class="sig-wrap">
        <canvas id="sig-canvas" class="sig-canvas"></canvas>
        <div class="sig-placeholder" id="sig-placeholder">✍️ Assine aqui com o dedo ou mouse</div>
      </div>
      <div class="sig-btns">
        <button class="sig-btn" onclick="limparAssinatura()">↺ Limpar</button>
        <button class="sig-btn ok" onclick="confirmarAssinatura('${orcId}')">✅ Confirmar Aprovação</button>
      </div>
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(initSigCanvas, 80);
}
function initSigCanvas(){
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  canvas.width=rect.width*dpr; canvas.height=130*dpr;
  canvas.style.height='130px';
  ctx.scale(dpr,dpr);
  ctx.strokeStyle='#1a1a2e'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round';
  _sigDrawing=false; _sigHasMark=false;
  function pos(e){ const r=canvas.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return [(t.clientX-r.left),(t.clientY-r.top)]; }
  canvas.onmousedown=e=>{ _sigDrawing=true; const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y); };
  canvas.onmousemove=e=>{ if(!_sigDrawing) return; const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); _sigHasMark=true; const ph=document.getElementById('sig-placeholder'); if(ph) ph.style.opacity='0'; };
  canvas.onmouseup=()=>{ _sigDrawing=false; };
  canvas.onmouseleave=()=>{ _sigDrawing=false; };
  canvas.ontouchstart=e=>{ e.preventDefault(); _sigDrawing=true; const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y); };
  canvas.ontouchmove=e=>{ e.preventDefault(); if(!_sigDrawing) return; const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); _sigHasMark=true; const ph=document.getElementById('sig-placeholder'); if(ph) ph.style.opacity='0'; };
  canvas.ontouchend=()=>{ _sigDrawing=false; };
}
function limparAssinatura(){
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
  _sigHasMark=false;
  const ph=document.getElementById('sig-placeholder'); if(ph) ph.style.opacity='1';
}
async function confirmarAssinatura(orcId){
  if(!_sigHasMark){ toast('⚠️ Por favor, assine antes de confirmar'); return; }
  const canvas=document.getElementById('sig-canvas'); if(!canvas) return;
  const sigB64=canvas.toDataURL('image/png');
  document.getElementById('modal-assinatura').remove();
  await aprovarOrcPortal(orcId, sigB64);
}

// Hash SHA-256 do conteúdo essencial do orçamento — "impressão digital" do
// documento assinado. Recalcular depois e comparar prova se algo foi alterado.
async function _hashDocumentoOrc(o){
  const canonical=JSON.stringify({
    numero:o.numero, cliente:o.cliente||'', cnpj:o.cnpj||'', total:o.total||0,
    servicos:(o.servicos||[]).map(s=>({d:s.desc||s.d||'',q:s.qty||1,p:s.precoUnit||s.preco||0})),
    desconto:o.desconto||0, validade:o.validade_data||o.validade_dias||''
  });
  try{
    const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){ return null; }
}
async function aprovarOrcPortal(id, sigB64){
  const oAtual=todosOrc.find(x=>x.id===id)||{};
  const agora=new Date().toISOString();
  const upd={status:'aprovado', data_aprovacao:agora};
  if(sigB64){
    upd.assinatura_base64=sigB64;
    upd.assinatura_data=agora;                                   // quando foi assinado
    upd.assinatura_hash=await _hashDocumentoOrc(oAtual);         // conteúdo assinado (anti-adulteração)
    upd.assinatura_meta=(navigator.userAgent||'').slice(0,180);  // dispositivo que assinou
  }
  todosOrc=todosOrc.map(o=>o.id===id?{...o,...upd}:o);
  lsOrcAtualizar(id,upd);
  sincronizarBaixaOrcamento(todosOrc.find(o=>o.id===id)); // baixa do estoque na aprovação pelo cliente
  if(dbOk&&db) orcSyncUpdate(id, upd).catch(e=>console.warn('[aprovarOrcPortal]', e?.message||e));
  if(portalCliente) await renderPortal(portalCliente);
  toast('✅ Orçamento aprovado e assinado!');
}

function recusarOrcPortal(id){
  confirmar('Recusar este orçamento?', ()=>_recusarOrcPortalConfirmado(id), 'Recusar Orçamento');
}
async function _recusarOrcPortalConfirmado(id){
  todosOrc=todosOrc.map(o=>o.id===id?{...o,status:'recusado'}:o);
  lsOrcAtualizar(id,{status:'recusado'});
  sincronizarBaixaOrcamento(todosOrc.find(o=>o.id===id)); // estorna se já tinha sido baixado
  await _limparRecebDoOrc(id, 'recusado no portal');
  if(dbOk&&db) dbUpdate('orcamentos', {status:'recusado'}, 'id', id).then(()=>{}).catch(()=>{});
  if(portalCliente) await renderPortal(portalCliente);
  toast('❌ Orçamento recusado');
}

function abrirWAPortal(){
  let tel=(CFG.tel||'').replace(/\D/g,'');
  if(!tel){ toast('⚠️ Configure o telefone da empresa nas configurações'); return; }
  if(!tel.startsWith('55')) tel='55'+tel;
  const nome=portalCliente?portalCliente.nome:'Cliente';
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent('Olá! Sou '+nome+' e gostaria de falar com vocês.')}`, '_blank');
}


// ══════════════════════════════════════════════════
//  MÓDULO 4 — PRODUTIVIDADE POR TÉCNICO
// ══════════════════════════════════════════════════
function getPeriodoProd(){
  const p=gV('prod-periodo'), hoje=new Date(); hoje.setHours(23,59,59,999);
  let inicio=new Date();
  if(p==='mes'){ inicio=new Date(hoje.getFullYear(),hoje.getMonth(),1); }
  else if(p==='mes-ant'){ inicio=new Date(hoje.getFullYear(),hoje.getMonth()-1,1); hoje.setDate(0); }
  else if(p==='30d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-30); }
  else if(p==='90d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-90); }
  else if(p==='ano'){ inicio=new Date(hoje.getFullYear(),0,1); }
  inicio.setHours(0,0,0,0);
  return {inicio, fim:hoje};
}

function getPeriodoAntProd(){
  const p=gV('prod-periodo'), hoje=new Date();
  let inicio=new Date(), fim=new Date();
  if(p==='mes'){ inicio=new Date(hoje.getFullYear(),hoje.getMonth()-1,1); fim=new Date(hoje.getFullYear(),hoje.getMonth(),0); }
  else if(p==='30d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-60); fim=new Date(); fim.setDate(fim.getDate()-30); }
  else if(p==='90d'){ inicio=new Date(); inicio.setDate(inicio.getDate()-180); fim=new Date(); fim.setDate(fim.getDate()-90); }
  else { return null; }
  inicio.setHours(0,0,0,0); fim.setHours(23,59,59,999);
  return {inicio, fim};
}

function osNoPeriodo(tec, ini, fim){
  const osLocal=filtrarPorLoja(JSON.parse(ls('fluxa_os_hist')||'[]'));
  return osLocal.filter(o=>{
    if(tec&&o.tecnico!==tec) return false;
    if(!o.data_criacao) return false;
    const d=new Date(o.data_criacao);
    return d>=ini&&d<=fim;
  });
}

function despNoPeriodo(tec, ini, fim){
  return filtrarPorLoja(todasDesp).filter(d=>{
    if(tec&&d.tecnico!==tec) return false;
    if(!d.data) return false;
    const dd=new Date(d.data+'T12:00:00');
    return dd>=ini&&dd<=fim;
  });
}

function metricasTec(tec, ini, fim){
  const os=osNoPeriodo(tec, ini, fim);
  const conc=os.filter(o=>o.status==='concluido');
  const canc=os.filter(o=>o.status==='cancelado');
  const taxa=os.length>0?Math.round(conc.length/os.length*100):0;
  const comTempo=conc.filter(o=>o.duracao_min>0);
  const tempoMed=comTempo.length>0?Math.round(comTempo.reduce((a,o)=>a+(o.duracao_min||0),0)/comTempo.length):0;
  const desp=despNoPeriodo(tec, ini, fim).reduce((a,d)=>a+(d.valor||0),0);
  const clientes=new Set(os.map(o=>o.cliente).filter(Boolean)).size;
  const faturamento=conc.reduce((a,o)=>a+(o.total||0),0); // fatura das OS concluídas do técnico
  return { total:os.length, conc:conc.length, canc:canc.length, taxa, tempoMed, desp, clientes, faturamento };
}
// Config de comissão/metas (global, editável na tela de Produtividade)
function getComissaoPct(){ return parseFloat(ls('fluxa_comissao_pct')||'0')||0; }
function getMetaTec(){ return parseFloat(ls('fluxa_meta_tec')||'0')||0; }
function setComissaoPct(v){ lsSet('fluxa_comissao_pct', String(parseFloat(v)||0)); renderProd(); }
function setMetaTec(v){ lsSet('fluxa_meta_tec', String(parseFloat(v)||0)); renderProd(); }

async function loadProdutividade(){
  // Popula select de técnicos
  const el=document.getElementById('prod-filtro-tec'); if(!el) return;
  const tecs=getTecnicos();
  el.innerHTML='<option value="">Todos os técnicos</option>'+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  // Carrega OS do Supabase se disponível
  // fix #E: não sobrescrever o cache inteiro — fazer merge para preservar OS de outras lojas no cache local
  if(dbOk&&db){
    try{
      let qProd=db.from('ordens_servico').select('*').order('data_criacao',{ascending:false}).limit(500);
      if(lojaAtiva) qProd=qProd.eq('loja_id',lojaAtiva);
      const {data}=await qProd;
      if(data&&data.length){
        const local=JSON.parse(ls('fluxa_os_hist')||'[]');
        // Merge: remotas prevalecem, locais de outras lojas são preservadas
        const merged=[...data];
        local.forEach(l=>{ if(!merged.find(r=>r.id===l.id)) merged.push(l); });
        lsSet('fluxa_os_hist',JSON.stringify(merged.slice(0,600)));
      }
    }catch(e){ console.warn('[loadProdutividade]', e?.message||e); }
  }
  renderProd();
  renderRelatorioFinanceiro();
  renderContasReceber();
}

// ── CONTAS A RECEBER ──
// Consolida os orçamentos aprovados com saldo em aberto (total − recebido).
function renderContasReceber(){
  const tbody=document.getElementById('cr-tabela-body'); if(!tbody) return;
  const resumo=document.getElementById('cr-resumo');
  const aprov=filtrarPorLoja(todosOrc).filter(o=>o.status==='aprovado');
  const comSaldo=aprov.map(o=>({o, saldo:(o.total||0)-(o.valor_recebido||0)}))
                      .filter(x=>x.saldo>0.005)
                      .sort((a,b)=>b.saldo-a.saldo);
  const totalReceber=comSaldo.reduce((a,x)=>a+x.saldo,0);
  const totalRecebido=aprov.reduce((a,o)=>a+(o.valor_recebido||0),0);
  const totalAprovado=aprov.reduce((a,o)=>a+(o.total||0),0);
  if(resumo){
    const chip=(lbl,val,cor)=>`<div style="flex:1;min-width:130px;background:var(--gray-light);border-radius:10px;padding:10px 14px">
      <div style="font-size:11px;color:var(--gray);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${lbl}</div>
      <div style="font-size:18px;font-weight:800;color:${cor}">${brl(val)}</div></div>`;
    resumo.innerHTML=chip('A Receber',totalReceber,'var(--red)')+chip('Já Recebido',totalRecebido,'var(--green)')+chip('Total Aprovado',totalAprovado,'var(--c2)');
  }
  if(!comSaldo.length){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:18px">✅ Nenhum saldo em aberto — tudo recebido!</td></tr>'; return; }
  tbody.innerHTML=comSaldo.map(({o,saldo})=>{
    const num=String(o.numero||'—').padStart(3,'0');
    const rec=o.valor_recebido||0;
    const parcial=rec>0;
    return `<tr>
      <td><strong>#${num}</strong></td>
      <td>${esc(o.cliente||'—')}${parcial?' <span style="font-size:10px;background:var(--yellow-bg);color:var(--yellow);padding:1px 6px;border-radius:50px;font-weight:700">parcial</span>':''}</td>
      <td>${brl(o.total||0)}</td>
      <td>${rec>0?brl(rec):'—'}</td>
      <td><strong style="color:var(--red)">${brl(saldo)}</strong></td>
      <td><button class="tb g" style="font-size:11px" onclick="abrirModalPg('${o.id}',${o.total||0})">💰 Registrar</button></td>
    </tr>`;
  }).join('');
}

// ──────────────────────────────────────────────────
//  RELATÓRIO FINANCEIRO
// ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
//  DRE GERENCIAL POR UNIDADE
//  Receita reconhecida − custo direto − despesa, com Camboriú e Itapema em
//  colunas separadas: o baseline mostrou que comparar as duas revela problema
//  de processo mais rápido que qualquer média consolidada.
//
//  Custo direto NÃO é recalculado pelo CMP de hoje: vem do `custo_unit` que o
//  ledger carimbou em cada saída no momento da venda. Recalcular com o custo
//  atual daria margem errada para meses passados — e ninguém perceberia.
// ══════════════════════════════════════════════════════════════════════
function _dreMesesDisponiveis(){
  const set=new Set();
  (todosOrc||[]).forEach(o=>{ const d=_orcData(o); if(d&&!isNaN(d)) set.add(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); });
  (todasDesp||[]).forEach(x=>{ const m=x.competencia||String(x.data||'').slice(0,7); if(/^\d{4}-\d{2}$/.test(m)) set.add(m); });
  const hoje=_hojeLocal().slice(0,7); set.add(hoje);
  return [...set].sort().reverse().slice(0,24);
}

// Um bloco de números por unidade. `lojas` permite somar o grupo na coluna Total.
// Mão de obra do mês: OS concluída × duração × custo/hora do técnico.
// Sem isto o custo direto do DRE só contava saída de estoque, e o trilho de
// SERVIÇO — o que converte a 43%, quase sem consumir material — aparecia com
// margem perto de 100%. Devolve `cobertura` (% dos minutos cujo técnico tem
// custo_hora cadastrado) pelo mesmo motivo de margemOrcamento: custo parcial
// não pode ser lido como custo total.
function _custoMaoDeObra(mes, lojas){
  const dentro = lj => lojas.includes(lj||'');
  const _hora = nome => {
    const n=String(nome||'').trim().toLowerCase();
    if(!n) return 0;
    const u=(todosUsuarios||[]).find(x=>String(x&&x.nome||'').trim().toLowerCase()===n);
    const h=parseFloat(u&&u.custo_hora);
    return h>0?h:0;
  };
  let custo=0, minutos=0, minSemCusto=0;
  (todosOS||[]).forEach(o=>{
    if(o.status!=='concluido' || !dentro(o.loja_id)) return;
    // 'T12:00:00' no meio do dia: sem isso a data vira o mês anterior no fuso −03.
    const ref = o.checkout_time ? new Date(o.checkout_time)
              : (o.data_servico ? new Date(o.data_servico+'T12:00:00') : null);
    if(!ref || isNaN(ref)) return;
    if((ref.getFullYear()+'-'+String(ref.getMonth()+1).padStart(2,'0'))!==mes) return;
    const min=parseInt(o.duracao_min)||0;
    if(min<=0) return;
    minutos+=min;
    const h=_hora(o.tecnico);
    if(h>0) custo+=min/60*h; else minSemCusto+=min;
  });
  return { custo, minutos,
           cobertura: minutos ? (minutos-minSemCusto)/minutos*100 : null };
}

function _dreCalcular(mes, lojas){
  const dentro = lj => lojas.includes(lj||'');
  // Receita: orçamento aprovado, pelo mês de referência que o app já usa
  const receita=(todosOrc||[]).filter(o=>{
    if(o.status!=='aprovado' || !dentro(o.loja_id)) return false;
    // Reconhece a receita no mês da APROVAÇÃO (é quando a venda aconteceu),
    // não no da criação — orçamento feito em julho e fechado em agosto é
    // receita de agosto. Mesmo critério que o histórico já usa.
    const ap=o.data_aprovacao ? new Date(o.data_aprovacao) : null;
    const d=(ap&&!isNaN(ap)) ? ap : _orcData(o);
    if(!d||isNaN(d)) return false;
    return (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))===mes;
  }).reduce((a,o)=>a+(parseFloat(o.total)||0),0);

  // Custo direto: saídas de baixa de orçamento, com o custo do dia da venda
  const custoDireto=(todosMovEstoque||[]).filter(m=>
    m.tipo==='saida' && String(m.ref||'').startsWith('baixa:orc:') &&
    dentro(m.loja_id) && String(m.data||'').slice(0,7)===mes
  ).reduce((a,m)=>a+Math.abs(parseFloat(m.quantidade)||0)*(parseFloat(m.custo_unit)||0),0);

  // Despesas por centro de custo, pela COMPETÊNCIA (não pela data de pagamento)
  const desp=(todasDesp||[]).filter(x=>{
    if(!dentro(x.loja_id)) return false;
    return (x.competencia||String(x.data||'').slice(0,7))===mes;
  });
  const porCentro=c=>desp.filter(x=>(x.centro_custo||(x.categoria==='empresa'?'fixo':'campo'))===c)
                        .reduce((a,x)=>a+(parseFloat(x.valor)||0),0);
  const campo=porCentro('campo'), variavel=porCentro('variavel');
  const fixo=porCentro('fixo'), admin=porCentro('administrativo');

  const mo=_custoMaoDeObra(mes, lojas);
  const margemContrib = receita - custoDireto - mo.custo - variavel - campo;
  const resultado = margemContrib - fixo - admin;
  return {receita, custoDireto, maoDeObra:mo.custo, moMinutos:mo.minutos, moCobertura:mo.cobertura,
          campo, variavel, fixo, admin, margemContrib, resultado,
          margemPct: receita? (margemContrib/receita*100) : null,
          resultadoPct: receita? (resultado/receita*100) : null};
}

// ══════════════════════════════════════════════════════════════════════
//  ANÁLISE DE CLIENTES (fase 6, camada trimestral) — ABC, LTV e recompra
//  Agrupa por `cliente_id` quando ele existe e cai para o nome normalizado
//  quando não existe. Sem esse fallback a tela nasceria vazia e ficaria assim
//  até alguém confirmar as 216 identidades — inútil justamente no momento em
//  que ajudaria a priorizar quais confirmar.
//  A tela declara quanto do valor já está por identidade confirmada, para o
//  número ser lido pelo que é.
// ══════════════════════════════════════════════════════════════════════
function _cliChave(o){
  return o.cliente_id ? 'id:'+o.cliente_id : 'nome:'+(_identNorm? _identNorm(o.cliente) : String(o.cliente||'').toLowerCase());
}
function analiseClientes(){
  const orcs=filtrarPorLoja(todosOrc||[]).filter(o=>(o.cliente||'').trim());
  const aprov=orcs.filter(o=>o.status==='aprovado');
  const map=new Map();
  aprov.forEach(o=>{
    const k=_cliChave(o);
    if(!map.has(k)) map.set(k,{chave:k, nome:o.cliente, porId:!!o.cliente_id, orcs:[], valor:0});
    const g=map.get(k); g.orcs.push(o); g.valor+=parseFloat(o.total)||0;
    if(o.cliente_id) g.porId=true;
  });
  const lista=[...map.values()].map(g=>{
    const datas=g.orcs.map(o=>{ const ap=o.data_aprovacao?new Date(o.data_aprovacao):null;
      return (ap&&!isNaN(ap))?ap:_orcData(o); }).filter(d=>d&&!isNaN(d)).sort((a,b)=>a-b);
    const primeiro=datas[0], ultimo=datas[datas.length-1];
    // Etapa 4 do roadmap de CRM — intervalo OBSERVADO entre compras reais.
    // Só existe com 2+ compras (datas.length>=2) — "melhor calar do que
    // inventar padrão" pra quem comprou uma vez só. A outra metade da Etapa 4
    // ("consumo teórico" por volume de piscina) fica pra depois — depende de
    // referência real de dosagem química que ainda não temos, ver CLAUDE.md.
    let intervaloMedioDias=null;
    if(datas.length>=2){
      const intervalos=[];
      for(let i=1;i<datas.length;i++) intervalos.push((datas[i]-datas[i-1])/86400000);
      intervaloMedioDias=Math.round(intervalos.reduce((a,b)=>a+b,0)/intervalos.length);
    }
    const diasDesdeUltima= ultimo? Math.round((new Date(_hojeLocal()+'T12:00:00')-ultimo)/86400000) : null;
    // Três estados, igual o briefing pediu. Multiplicadores são heurística
    // de bucket sobre dado real (não são fato) — 1.3x/2.5x dão folga contra
    // variação natural de agenda antes de soar alarme. Ajustável se precisar.
    let ritmo=null;
    if(intervaloMedioDias && diasDesdeUltima!=null){
      ritmo = diasDesdeUltima<=intervaloMedioDias*1.3 ? 'em_dia'
            : diasDesdeUltima<=intervaloMedioDias*2.5 ? 'reduziu' : 'parou';
    }
    // Consumo teórico (Etapa 4, parte 2) — só pra quem comprou 1 vez e tem
    // piscina com volume conhecido. Some sozinho assim que houver 2ª compra:
    // o intervalo OBSERVADO acima sempre tem prioridade sobre isto.
    let previsaoTeorica=null;
    if(g.porId && g.orcs.length===1 && !intervaloMedioDias && diasDesdeUltima!=null){
      const cid=g.chave.startsWith('id:')?g.chave.slice(3):null;
      const piscina=cid && (todasPiscinas||[]).find(p=>p.cliente_id===cid && p.ativo!==false && p.volume_m3);
      if(piscina){
        const calc=consumoTeoricoDias(piscina.tipo_tratamento, piscina.volume_m3, demandaDiaria(piscina), piscina.exposicao_solar);
        if(calc) previsaoTeorica={...calc, piscinaNome:piscina.nome, diasAte:calc.dias-diasDesdeUltima};
      }
    }
    return {...g, compras:g.orcs.length, ticket:g.valor/g.orcs.length,
      primeiro, ultimo, recompra:g.orcs.length>1,
      diasDesdeUltima, intervaloMedioDias, ritmo, previsaoTeorica};
  }).sort((a,b)=>b.valor-a.valor);

  // Curva ABC por faturamento: A até 80% acumulado, B até 95%, C o resto
  const total=lista.reduce((a,c)=>a+c.valor,0);
  // Classifica pelo acumulado ANTES do item: o que CRUZA os 80% pertence ao A.
  // Classificando pelo acumulado depois, um cliente que sozinho vale 81% do
  // faturamento cai em B e a curva fica sem nenhum A — exatamente ao contrário.
  let acc=0;
  lista.forEach(c=>{ const antes=total?acc/total:0; acc+=c.valor;
    c.classe = antes<0.8 ? 'A' : (antes<0.95 ? 'B' : 'C'); c.acumPct=(total?acc/total:0)*100; });
  const porId=lista.filter(c=>c.porId).reduce((a,c)=>a+c.valor,0);
  return {lista, total, cobertura: total? porId/total*100 : 0};
}

function renderAnaliseClientes(){
  const el=document.getElementById('cli-analise'); if(!el) return;
  const {lista,total,cobertura}=analiseClientes();
  if(!lista.length){ el.innerHTML='<div style="font-size:12.5px;color:var(--gray);padding:8px 0">Nenhum orçamento aprovado no escopo atual.</div>'; return; }
  const cls=c=>lista.filter(x=>x.classe===c);
  const soma=l=>l.reduce((a,c)=>a+c.valor,0);
  const rec=lista.filter(c=>c.recompra);
  const sumidos=lista.filter(c=>c.diasDesdeUltima!==null && c.diasDesdeUltima>90);

  el.innerHTML=
   `<div class="dash">
      <div class="dc o"><div class="dl">Clientes que compraram</div><div class="dv">${lista.length}</div>
        <div class="ds">${brl(total)} no total</div></div>
      <div class="dc g"><div class="dl">Classe A</div><div class="dv">${cls('A').length}</div>
        <div class="ds">${total?Math.round(soma(cls('A'))/total*100):0}% do faturamento</div></div>
      <div class="dc b"><div class="dl">Voltaram a comprar</div><div class="dv">${rec.length}</div>
        <div class="ds">${lista.length?Math.round(rec.length/lista.length*100):0}% dos clientes</div></div>
      <div class="dc ${sumidos.length?'y':'g'}"><div class="dl">Sem comprar há 90d+</div><div class="dv">${sumidos.length}</div>
        <div class="ds">${brl(soma(sumidos))} de histórico</div></div>
    </div>
    <table class="fin-tabela" style="width:100%">
      <thead><tr><th style="text-align:left">Cliente</th><th>Classe</th><th style="text-align:right">Compras</th>
        <th style="text-align:right">Total</th><th style="text-align:right">Ticket</th><th style="text-align:right">Última</th><th style="text-align:center">Ritmo</th></tr></thead>
      <tbody>${lista.slice(0,25).map(c=>{
        const ritmoTxt = c.ritmo==='em_dia'?'🟢 Em dia' : c.ritmo==='reduziu'?'🟡 Reduziu' : c.ritmo==='parou'?'🔴 Parou' : '—';
        const ritmoTitle = c.intervaloMedioDias ? `costuma comprar a cada ${c.intervaloMedioDias}d` : 'precisa de 2+ compras pra calcular';
        return `<tr>
        <td style="font-weight:600">${esc(String(c.nome).slice(0,34))}${c.porId?'':' <span title="agrupado pelo nome — identidade ainda não confirmada" style="color:var(--gray);font-weight:400">~</span>'}</td>
        <td style="text-align:center"><span style="font-weight:800;color:${c.classe==='A'?'var(--green)':c.classe==='B'?'var(--yellow)':'var(--gray)'}">${c.classe}</span></td>
        <td style="text-align:right">${c.compras}</td>
        <td style="text-align:right;font-weight:700">${brl(c.valor)}</td>
        <td style="text-align:right;color:var(--gray)">${brl(c.ticket)}</td>
        <td style="text-align:right;color:${c.diasDesdeUltima>90?'var(--yellow)':'var(--gray)'}">${c.diasDesdeUltima!==null?c.diasDesdeUltima+'d':'—'}</td>
        <td style="text-align:center;font-size:11.5px" title="${esc(ritmoTitle)}">${ritmoTxt}</td>
      </tr>`;}).join('')}</tbody>
    </table>
    ${lista.length>25?`<div style="font-size:11px;color:var(--gray);padding:6px 0">Mostrando os 25 maiores de ${lista.length}.</div>`:''}
    <div style="font-size:11.5px;color:var(--gray);margin-top:9px;line-height:1.5">
      ${cobertura>=99
        ? 'Agrupado por identidade confirmada.'
        : `Só <strong>${cobertura.toFixed(0)}%</strong> do valor está agrupado por identidade confirmada; o resto (marcado com <strong>~</strong>) foi agrupado pelo nome digitado, então o mesmo cliente escrito de dois jeitos ainda conta como dois. Confirme em <a href="#" onclick="go('identidade');return false" style="color:var(--c1);font-weight:600">Identidade</a> — comece pelos de maior valor.`}
    </div>`;
}

function renderDRE(){
  const sel=document.getElementById('dre-mes'); if(!sel) return;
  const meses=_dreMesesDisponiveis();
  if(!sel.options.length || sel.dataset.n!==String(meses.length)){
    const atual=sel.value;
    sel.innerHTML=meses.map(m=>{
      const [y,mm]=m.split('-');
      const rot=new Date(parseInt(y),parseInt(mm)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      return `<option value="${m}">${rot}</option>`;
    }).join('');
    sel.dataset.n=String(meses.length);
    if(atual && meses.includes(atual)) sel.value=atual;
  }
  const mes=sel.value||meses[0];

  // Só as unidades que o usuário pode ver agora (respeita o seletor do header)
  const visiveis = (typeof LOJAS!=='undefined'?LOJAS:[]).filter(l=>{
    if(lojaAtiva) return l.id===lojaAtiva;
    return filtrarPorLoja([{loja_id:l.id}]).length>0;
  });
  const cols = visiveis.map(l=>({id:l.id, nome:l.nome, d:_dreCalcular(mes,[l.id])}));
  const total = {nome:'Total', d:_dreCalcular(mes, visiveis.map(l=>l.id))};

  const linha=(rot, campo, opts)=>{
    const o=opts||{};
    const cel=d=>{
      const v=d[campo];
      if(v===null||v===undefined) return '<td style="text-align:right;color:var(--gray)">—</td>';
      const cor = o.neg ? 'var(--red)' : (o.destaque ? (v>=0?'var(--green)':'var(--red)') : 'var(--c2)');
      return `<td style="text-align:right;color:${cor};${o.destaque?'font-weight:800':''};font-variant-numeric:tabular-nums">${
        o.pct ? (v===null?'—':v.toFixed(1).replace('.',',')+'%') : (o.neg&&v>0?'− ':'')+brl(Math.abs(v))}</td>`;
    };
    return `<tr${o.borda?' style="border-top:2px solid var(--gray-mid)"':''}>
      <td style="${o.destaque?'font-weight:800':'font-weight:600'};${o.recuo?'padding-left:16px;font-weight:400;color:var(--gray)':''}">${rot}</td>
      ${cols.map(c=>cel(c.d)).join('')}${cols.length>1?cel(total.d):''}</tr>`;
  };

  document.getElementById('dre-corpo').innerHTML=`
  <div style="overflow-x:auto">
   <table class="fin-tabela" style="width:100%;min-width:${260+cols.length*110}px">
    <thead><tr>
      <th style="text-align:left">Conta</th>
      ${cols.map(c=>`<th style="text-align:right">${esc(c.nome)}</th>`).join('')}
      ${cols.length>1?'<th style="text-align:right">Total</th>':''}
    </tr></thead>
    <tbody>
      ${linha('Receita reconhecida','receita')}
      ${linha('Custo do produto vendido','custoDireto',{neg:true,recuo:true})}
      ${linha('Mão de obra','maoDeObra',{neg:true,recuo:true})}
      ${linha('Despesa de campo','campo',{neg:true,recuo:true})}
      ${linha('Despesa variável','variavel',{neg:true,recuo:true})}
      ${linha('Margem de contribuição','margemContrib',{destaque:true,borda:true})}
      ${linha('% sobre a receita','margemPct',{pct:true,recuo:true})}
      ${linha('Despesa fixa','fixo',{neg:true,recuo:true})}
      ${linha('Administrativo','admin',{neg:true,recuo:true})}
      ${linha('Resultado','resultado',{destaque:true,borda:true})}
      ${linha('% sobre a receita','resultadoPct',{pct:true,recuo:true})}
    </tbody>
   </table>
  </div>`;

  // Honestidade sobre o que o número ainda não cobre
  const semDesp = cols.every(c=>!c.d.campo && !c.d.variavel && !c.d.fixo && !c.d.admin);
  const semCusto = cols.every(c=>!c.d.custoDireto);
  const avisos=[];
  if(semDesp) avisos.push('Nenhuma despesa lançada neste mês — o resultado abaixo da margem é só a receita, não o lucro.');
  if(semCusto) avisos.push('Nenhum custo de produto neste mês: ou não houve venda de material, ou os itens do orçamento não estavam vinculados ao estoque.');
  // Mão de obra: só fala quando há OS com duração no mês — senão vira ruído
  // repetido todo mês enquanto duracao_min continuar zerado na base.
  if(total.d.moMinutos>0){
    const cob=total.d.moCobertura;
    avisos.push(cob>=100
      ? `Mão de obra apurada sobre 100% das horas trabalhadas neste mês.`
      : `Mão de obra apurada sobre <strong>${cob.toFixed(0)}%</strong> das horas trabalhadas — o restante é de técnico sem custo/hora cadastrado (falta preencher em Usuários).`);
  }
  // Margem pelo custo congelado no ITEM — cobre inclusive orçamento cujo
  // material já foi estornado, que o CMV do razão não pega.
  const aprovMes=(todosOrc||[]).filter(o=>{
    if(o.status!=='aprovado') return false;
    if(!visiveis.some(l=>l.id===(o.loja_id||''))) return false;
    const ap=o.data_aprovacao?new Date(o.data_aprovacao):null;
    const d=(ap&&!isNaN(ap))?ap:_orcData(o);
    return d&&!isNaN(d)&&(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))===mes;
  });
  const margens=aprovMes.map(margemOrcamento).filter(Boolean).filter(m=>m.cobertura>0);
  if(margens.length){
    const rec=margens.reduce((a,m)=>a+m.receita,0);
    const cus=margens.reduce((a,m)=>a+m.custo,0);
    const cob=margens.reduce((a,m)=>a+m.cobertura,0)/margens.length;
    avisos.push(`Margem pelo custo congelado no item: <strong>${brl(rec-cus)}</strong> em ${margens.length} orçamento${margens.length!==1?'s':''} (${((rec-cus)/rec*100).toFixed(0)}%) — custo conhecido em ${cob.toFixed(0)}% do valor.`);
  }
  avisos.push('Receita = orçamento aprovado no mês. Custo do produto vem do valor gravado na baixa, não do custo de hoje. Despesa entra pela competência.');
  document.getElementById('dre-nota').innerHTML=avisos.map(a=>'• '+a).join('<br>');
}

function renderRelatorioFinanceiro(){
  const tbody=document.getElementById('fin-tabela-body'); if(!tbody) return;
  const periodo=(document.getElementById('fin-periodo')||{value:'6m'}).value;
  const hoje=new Date();
  const meses=[];
  if(periodo==='6m'){for(let i=5;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);meses.push({y:d.getFullYear(),m:d.getMonth()});}}
  else if(periodo==='12m'){for(let i=11;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);meses.push({y:d.getFullYear(),m:d.getMonth()});}}
  else{for(let i=0;i<=hoje.getMonth();i++) meses.push({y:hoje.getFullYear(),m:i});}
  const orcFilt=filtrarPorLoja(todosOrc);
  const despFilt=filtrarPorLoja(todasDesp);
  let totRec=0,totDesp=0;
  const linhas=meses.map(({y,m})=>{
    const label=new Date(y,m,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
    const rec=orcFilt.filter(o=>{const d=_orcData(o);return d&&!isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m&&o.status==='aprovado';}).reduce((a,o)=>a+(o.total||0),0);
    const desp=despFilt.filter(d=>{const raw=(d.data||'').split('T')[0];if(!raw)return false;const dt=new Date(raw+'T12:00:00');return dt.getFullYear()===y&&dt.getMonth()===m;}).reduce((a,d)=>a+(d.valor||0),0);
    const res=rec-desp;
    totRec+=rec; totDesp+=desp;
    return `<tr>
      <td style="font-weight:600">${label}</td>
      <td class="${rec>0?'fin-pos':'fin-zero'}">${brl(rec)}</td>
      <td class="${desp>0?'fin-neg':'fin-zero'}">${brl(desp)}</td>
      <td class="${res>0?'fin-pos':res<0?'fin-neg':'fin-zero'}">${brl(res)}</td>
    </tr>`;
  });
  const totRes=totRec-totDesp;
  linhas.push(`<tr class="fin-total">
    <td>Total do período</td>
    <td class="${totRec>0?'fin-pos':'fin-zero'}">${brl(totRec)}</td>
    <td class="${totDesp>0?'fin-neg':'fin-zero'}">${brl(totDesp)}</td>
    <td class="${totRes>0?'fin-pos':totRes<0?'fin-neg':'fin-zero'}">${brl(totRes)}</td>
  </tr>`);
  tbody.innerHTML=linhas.join('');
}

function renderProd(){
  const {inicio, fim}=getPeriodoProd();
  const ant=getPeriodoAntProd();
  const filtTec=gV('prod-filtro-tec');
  const tecs=filtTec?[filtTec]:getTecnicos();

  // Cards
  const cardsEl=document.getElementById('prod-cards');
  if(!tecs.length){ cardsEl.innerHTML='<div class="empty-st"><div class="ei">👥</div><p>Nenhum técnico configurado em Dados da Empresa.</p></div>'; return; }

  const maxConc=Math.max(...tecs.map(t=>metricasTec(t,inicio,fim).conc),1);
  const comPct=getComissaoPct(), meta=getMetaTec();
  // Preenche os inputs de config com os valores salvos
  const _ip=document.getElementById('prod-comissao-pct'); if(_ip&&document.activeElement!==_ip) _ip.value=comPct||'';
  const _im=document.getElementById('prod-meta-tec'); if(_im&&document.activeElement!==_im) _im.value=meta||'';

  cardsEl.innerHTML=tecs.map(tec=>{
    const m=metricasTec(tec,inicio,fim);
    const mAnt=ant?metricasTec(tec,ant.inicio,ant.fim):null;
    let vs=''; if(mAnt){
      const diff=m.conc-mAnt.conc;
      if(diff>0) vs=`<div class="prod-vs prod-up">▲ ${diff} vs período ant.</div>`;
      else if(diff<0) vs=`<div class="prod-vs prod-down">▼ ${Math.abs(diff)} vs período ant.</div>`;
      else vs=`<div class="prod-vs prod-eq">= igual ao período ant.</div>`;
    }
    const pct=maxConc>0?Math.round(m.conc/maxConc*100):0;
    const comissao=m.faturamento*comPct/100;
    // Progresso da meta (faturamento vs meta mensal)
    let metaHtml='';
    if(meta>0){
      const mp=Math.min(100,Math.round(m.faturamento/meta*100));
      const cor=mp>=100?'var(--green)':mp>=60?'var(--yellow)':'var(--red)';
      metaHtml=`<div style="margin-top:8px;font-size:11px;color:var(--gray)">Meta: <strong style="color:${cor}">${mp}%</strong> de ${brl(meta)}</div>
        <div class="prod-bar-bg"><div class="prod-bar" style="width:${mp}%;background:${cor}"></div></div>`;
    }
    return `<div class="prod-card">
      <div class="prod-tec-nome">👤 ${esc(tec)}</div>
      <div class="prod-num">${m.conc}</div>
      <div class="prod-label">OS Concluídas</div>
      <div class="prod-bar-bg"><div class="prod-bar" style="width:${pct}%"></div></div>
      ${vs}
      <div style="margin-top:10px;font-size:12px;color:var(--gray)">Taxa: <strong style="color:${m.taxa>=70?'var(--green)':m.taxa>=40?'var(--yellow)':'var(--red)'}">${m.taxa}%</strong></div>
      <div style="font-size:12px;color:var(--gray)">Faturamento: <strong>${brl(m.faturamento)}</strong></div>
      ${comPct>0?`<div style="font-size:12px;color:var(--green);font-weight:700">Comissão: ${brl(comissao)}</div>`:''}
      <div style="font-size:12px;color:var(--gray)">Despesas: <strong>${brl(m.desp)}</strong></div>
      ${metaHtml}
    </div>`;
  }).join('');

  // Tabela
  const tbody=document.getElementById('prod-tabela-body');
  tbody.innerHTML=tecs.map(tec=>{
    const m=metricasTec(tec,inicio,fim);
    const tempoStr=m.tempoMed>0?(m.tempoMed>=60?Math.floor(m.tempoMed/60)+'h '+(m.tempoMed%60)+'min':m.tempoMed+' min'):'—';
    const comissao=m.faturamento*comPct/100;
    return `<tr>
      <td><strong>${esc(tec)}</strong></td>
      <td><span style="color:var(--green);font-weight:700">${m.conc}</span></td>
      <td><span style="color:var(--red)">${m.canc}</span></td>
      <td><span style="font-weight:700;color:${m.taxa>=70?'var(--green)':m.taxa>=40?'var(--yellow)':'var(--red)'}">${m.taxa}%</span></td>
      <td>${tempoStr}</td>
      <td><strong>${brl(m.faturamento)}</strong></td>
      <td>${comPct>0?`<span style="color:var(--green);font-weight:700">${brl(comissao)}</span>`:'—'}</td>
      <td>${brl(m.desp)}</td>
      <td>${m.clientes}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  MÓDULO 3 — DESPESAS DE CAMPO
// ══════════════════════════════════════════════════
let todasDesp = [], despFotoB64 = '';

function abrirFormDesp(natureza){
  ['desp-valor','desp-desc','desp-os-num'].forEach(id=>setV(id,''));
  const _t=document.getElementById('desp-tipo'); if(_t) _t.value='';
  despFotoB64='';
  document.getElementById('desp-form-card').style.display='block';
  document.getElementById('desp-data').value=_hojeLocal();
  setV('desp-competencia', _hojeLocal().slice(0,7));
  const rc=document.getElementById('desp-recorrente'); if(rc) rc.checked=false;
  if(natureza) setV('desp-natureza', natureza);
  _despNatureza();
  populaDespTecSelect();
  filtrarOSDesp('');
  document.getElementById('desp-form-card').scrollIntoView({behavior:'smooth'});
}
function fecharFormDesp(){
  document.getElementById('desp-form-card').style.display='none';
  despFotoB64='';
  ['desp-valor','desp-desc','desp-os-num'].forEach(id=>setV(id,''));
  const t=document.getElementById('desp-tipo'); if(t) t.value='';
}

function populaDespTecSelect(){
  const tecs=getTecnicos();
  ['desp-tec','desp-filtro-tec'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const val=el.value;
    const extra=id==='desp-filtro-tec'?'<option value="">Todos os técnicos</option>':'<option value="">Selecione…</option>';
    el.innerHTML=extra+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    el.value=val;
  });
  const ult=ls('fluxa_ultimo_tec');
  if(ult){ const el=document.getElementById('desp-tec'); if(el) el.value=ult; }
}

function filtrarOSDesp(v){
  const dl=document.getElementById('desp-os-list'); if(!dl) return;
  dl.innerHTML='';
  todosOrc.filter(o=>(String(o.numero||'')).includes(v.replace('#',''))||(o.cliente||'').toLowerCase().includes(v.toLowerCase())).slice(0,8).forEach(o=>{
    const opt=document.createElement('option');
    opt.value='#'+String(o.numero||'').padStart(3,'0')+' — '+o.cliente;
    dl.appendChild(opt);
  });
}

function carregarFotoDesp(inp){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=e=>{ despFotoB64=e.target.result;
    const prev=document.getElementById('desp-foto-prev'); prev.src=e.target.result; prev.style.display='block';
    document.getElementById('desp-foto-lbl').textContent=f.name;
    document.getElementById('desp-btn-rm-foto').style.display='block';
  };
  r.readAsDataURL(f);
}
function removerFotoDesp(){ despFotoB64=''; document.getElementById('desp-foto-prev').style.display='none'; document.getElementById('desp-foto-lbl').textContent='Fotografar comprovante'; document.getElementById('desp-btn-rm-foto').style.display='none'; document.getElementById('desp-foto-input').value=''; }

// ── Despesa: campo × empresa ─────────────────────────────────────────
// O formulário só aceitava despesa de campo (exigia técnico), então aluguel,
// salário, contador e software não cabiam — e a tabela ficou com 0 registros.
// Sem despesa não há margem, só faturamento bruto.
function _despNatureza(){
  const emp = gV('desp-natureza')==='empresa';
  const mostra=(id,v)=>{ const e=document.getElementById(id); if(e) e.style.display=v?'':'none'; };
  mostra('desp-wrap-tec', !emp);
  mostra('desp-wrap-os', !emp);
  mostra('desp-wrap-empresa', emp);
  mostra('desp-wrap-recorrente', emp);
  const gc=document.getElementById('desp-grp-campo'), ge=document.getElementById('desp-grp-empresa');
  if(gc) gc.style.display = emp?'none':'';
  if(ge) ge.style.display = emp?'':'none';
  const lbl=document.getElementById('desp-lbl-data');
  if(lbl) lbl.textContent = emp ? 'Data de pagamento' : 'Data';
  // competência default = mês da data informada (aluguel de agosto pago em
  // setembro continua pertencendo a agosto — por isso os dois campos existem)
  if(emp && !gV('desp-competencia')) setV('desp-competencia', (gV('desp-data')||_hojeLocal()).slice(0,7));
  const tipo=document.getElementById('desp-tipo'); if(tipo) tipo.value='';
}

// Despesa fixa que depende de digitação mensal vira tabela vazia. Aqui o app
// compara o mês anterior com o atual e mostra o que ficou para trás.
function _despRecorrentesPendentes(){
  const hoje=_hojeLocal(), mesAtual=hoje.slice(0,7);
  const d=new Date(parseInt(mesAtual.slice(0,4)), parseInt(mesAtual.slice(5,7))-1, 1);
  d.setMonth(d.getMonth()-1);
  const mesAnt=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const lista=filtrarPorLoja(todasDesp||[]);
  const doMes=m=>lista.filter(x=>x.recorrente && (x.competencia||String(x.data||'').slice(0,7))===m);
  const jaNoAtual=new Set(doMes(mesAtual).map(x=>((x.tipo||'')+'|'+(x.descricao||'')).toLowerCase()));
  return doMes(mesAnt).filter(x=>!jaNoAtual.has(((x.tipo||'')+'|'+(x.descricao||'')).toLowerCase()));
}
function renderAvisoRecorrentes(){
  const el=document.getElementById('desp-recorrentes-aviso'); if(!el) return;
  const p=_despRecorrentesPendentes();
  if(!p.length){ el.style.display='none'; return; }
  const tot=p.reduce((a,x)=>a+(parseFloat(x.valor)||0),0);
  el.style.display='';
  el.innerHTML=`<div class="card" style="border-left:3px solid var(--yellow);background:#fffbeb">
    <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:5px">
      ${p.length} despesa${p.length>1?'s':''} fixa${p.length>1?'s':''} ainda não lançada${p.length>1?'s':''} neste mês</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:9px">
      ${p.map(x=>esc(x.tipo||x.descricao||'—')).join(' · ')} — ${brl(tot)}</div>
    <button class="tb g" style="font-weight:700" onclick="repetirRecorrentes()">↻ Lançar no mês atual</button>
  </div>`;
}
async function repetirRecorrentes(){
  const p=_despRecorrentesPendentes();
  if(!p.length) return;
  const mes=_hojeLocal().slice(0,7);
  for(const x of p){
    // dados SEM id: despesas.id é uuid, gerado pelo banco (mesmo bug do
    // importarEqDaVistoria — id texto local numa coluna uuid derruba o insert
    // inteiro, sem aviso, e é indistinguível de "ninguém lançou despesa").
    const {id:_velhoId, ...xSemId}=x;
    const dados={ ...xSemId,
      competencia:mes, data:_hojeLocal(), data_pagamento:null, status:'pendente',
      data_criacao:new Date().toISOString() };
    delete dados.foto_base64; // comprovante é do mês anterior, não vale para este
    const tempId='desp_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    todasDesp.unshift({...dados, id:tempId});
    if(dbOk&&db){
      try{
        const {data:ins}=await dbInsert('despesas', dados);
        if(ins){ todasDesp=todasDesp.filter(x2=>x2.id!==tempId); todasDesp.unshift(ins); }
      }catch(e){ console.warn('[repetirRecorrentes]', e?.message||e); }
    }
  }
  lsDespSalvar(todasDesp);
  renderDespesas(); renderAvisoRecorrentes();
  toast(`✅ ${p.length} despesa${p.length>1?'s':''} lançada${p.length>1?'s':''} neste mês`);
}

async function salvarDespesa(){
  const emp = gV('desp-natureza')==='empresa';
  const tec=gV('desp-tec'), tipo=gV('desp-tipo'), valor=parseFloat(gV('desp-valor'))||0;
  if(!tipo||!valor){ toast('⚠️ Informe tipo e valor'); return; }
  if(!emp && !tec){ toast('⚠️ Informe o técnico'); return; }
  if(!emp) lsSet('fluxa_ultimo_tec',tec);
  let osNum=null;
  if(!emp){ const m=(gV('desp-os-num')||'').match(/\d+/); if(m) osNum=parseInt(m[0]); }
  const dataInf=gV('desp-data')||_hojeLocal();
  // dados SEM id: despesas.id é uuid, gerado pelo banco. Mandar o id texto
  // local (desp_<ts>) no insert derruba a linha inteira (22P02), sem coluna
  // pra reportar — o dbInsert resiliente não ajuda porque não é coluna
  // faltando, é tipo errado. Era 100% das despesas, silenciosamente.
  const dados={
    tecnico: emp?null:tec, data:dataInf, tipo, valor,
    descricao:gV('desp-desc'), os_numero:osNum||null,
    foto_base64:despFotoB64||null, status: emp?'empresa':'pendente',
    loja_id:lojaAtiva||LOJA_PADRAO_ID,
    categoria: emp?'empresa':'campo',
    centro_custo: emp?(gV('desp-centro')||'fixo'):'campo',
    // competência ≠ data de pagamento: aluguel de agosto pago em setembro
    // pertence a agosto. Sem isso o DRE joga a despesa no mês errado.
    competencia: (emp ? (gV('desp-competencia')||dataInf.slice(0,7)) : dataInf.slice(0,7)),
    recorrente: emp ? !!document.getElementById('desp-recorrente')?.checked : false,
    data_pagamento: emp?dataInf:null,
    data_criacao:new Date().toISOString()
  };
  const tempId='desp_'+Date.now();
  todasDesp.unshift({...dados, id:tempId}); lsDespSalvar(todasDesp);
  if(dbOk&&db){
    (async()=>{
      try{
        const {data:ins}=await dbInsert('despesas', dados);
        if(ins){ todasDesp=todasDesp.filter(x=>x.id!==tempId); todasDesp.unshift(ins); lsDespSalvar(todasDesp); renderDespesas(); }
      }catch(e){ console.warn('[salvarDespesa]', e?.message||e); toast('⚠️ Salvo aqui, mas não sincronizou'); }
    })();
  }
  fecharFormDesp(); renderDespesas(); renderAvisoRecorrentes();
  toast('✅ Despesa registrada!');
}

async function reembolsarDesp(id){
  todasDesp=todasDesp.map(d=>d.id===id?{...d,status:'reembolsado'}:d);
  lsDespSalvar(todasDesp);
  if(dbOk&&db) dbUpdate('despesas', {status:'reembolsado'}, 'id', id).then(()=>{}).catch(()=>{});
  renderDespesas(); toast('✅ Marcado como reembolsado');
}

function excluirDesp(id){
  confirmar('Excluir esta despesa?', ()=>{
    todasDesp=todasDesp.filter(x=>x.id!==id); lsDespSalvar(todasDesp);
    if(!String(id).startsWith('desp_')){
      _tombAdd('fluxa_desp_tombstones', id); // protege contra ressuscitar se o delete abaixo falhar
      if(dbOk&&db) db.from('despesas').delete().eq('id',id).then(()=>{}).catch(()=>{});
    }
    renderDespesas(); toast('🗑 Despesa excluída');
  }, 'Excluir Despesa');
}

function lsDespLer(){ try{ return JSON.parse(ls('fluxa_despesas')||'[]'); }catch(e){ return []; } }
function lsDespSalvar(lista){ lsSet('fluxa_despesas', JSON.stringify(lista)); }

async function loadDespesas(){
  todasDesp=lsDespLer(); renderDespesas(); populaDespTecSelect();
  if(dbOk&&db){
    try{
      let q=db.from('despesas').select('*').order('data_criacao',{ascending:false});
      if(lojaAtiva) q=q.eq('loja_id',lojaAtiva);
      const {data}=await q;
      if(data){
        let remoto=data;
        const _tombDesp=new Set(_tombLer('fluxa_desp_tombstones'));
        if(_tombDesp.size){
          remoto.filter(r=>_tombDesp.has(r.id)).forEach(r=>db.from('despesas').delete().eq('id',r.id).then(()=>{}).catch(()=>{}));
          remoto=remoto.filter(r=>!_tombDesp.has(r.id));
        }
        // Preserva despesas presas só no aparelho (criadas offline, id
        // desp_<ts> ainda não sincronizado) — mesmo padrão de loadAgendamentos,
        // sem isso o "banco é fonte de verdade" apagava o que nunca sincronizou.
        const idsDesp=new Set(remoto.map(x=>x.id));
        const soLocalDesp=todasDesp.filter(x=>String(x.id).startsWith('desp_')&&!idsDesp.has(x.id)&&_idadeIdMs(x.id)<DOIS_DIAS_MS);
        todasDesp=[...remoto,...soLocalDesp]; lsDespSalvar(todasDesp); renderDespesas();
        for(const d of soLocalDesp){
          try{
            const {id:_velhoId,...dSemId}=d;
            const {data:ins}=await dbInsert('despesas', dSemId);
            if(ins){ todasDesp=todasDesp.filter(x=>x.id!==d.id); todasDesp.unshift(ins); lsDespSalvar(todasDesp); }
          }catch(e){ console.warn('[reenvioDesp]', e?.message||e); }
        }
      }
    }catch(e){ console.warn('[loadDespesas]', e?.message||e); }
  }
}

function renderDespesas(){
  const filtTec=gV('desp-filtro-tec'), filtSt=gV('desp-filtro-st');
  let lista=[...todasDesp];
  lista=filtrarPorLoja(lista);
  if(filtTec) lista=lista.filter(d=>d.tecnico===filtTec);
  if(filtSt) lista=lista.filter(d=>d.status===filtSt);
  const agora=new Date(), mesAtual=agora.getMonth(), anoAtual=agora.getFullYear();
  const doMes=filtrarPorLoja(todasDesp).filter(d=>{ if(!d.data) return false; const dd=new Date(d.data+'T12:00:00'); return dd.getMonth()===mesAtual&&dd.getFullYear()===anoAtual; });
  const pend=doMes.filter(d=>d.status==='pendente');
  const reimb=doMes.filter(d=>d.status==='reembolsado');
  setV_el('desp-d-pend',brl(pend.reduce((a,d)=>a+(d.valor||0),0)),'textContent');
  setV_el('desp-d-pend-q',pend.length+' item'+(pend.length!==1?'s':''),'textContent');
  setV_el('desp-d-reimb',brl(reimb.reduce((a,d)=>a+(d.valor||0),0)),'textContent');
  setV_el('desp-d-reimb-q',reimb.length+' item'+(reimb.length!==1?'s':''),'textContent');
  setV_el('desp-d-total',brl(doMes.reduce((a,d)=>a+(d.valor||0),0)),'textContent');
  // Breakdown por categoria (onde vai o dinheiro)
  const catCard=document.getElementById('desp-cat-card'), catBody=document.getElementById('desp-cat-body');
  if(catCard&&catBody){
    const porCat={}; doMes.forEach(d=>{ const k=d.tipo||'Outro'; porCat[k]=(porCat[k]||0)+(d.valor||0); });
    const totMes=doMes.reduce((a,d)=>a+(d.valor||0),0);
    const rank=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    if(!rank.length||totMes<=0){ catCard.style.display='none'; }
    else {
      catCard.style.display='';
      const max=rank[0][1]||1;
      const catIcons={Combustível:'⛽',Pedágio:'🛣️',Material:'🔩',Alimentação:'🍽️',Outro:'📎'};
      catBody.innerHTML=rank.map(([cat,v])=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="font-size:16px;width:24px;text-align:center">${catIcons[cat]||'📎'}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--c2);margin-bottom:3px"><span>${esc(cat)}</span><span>${brl(v)} <span style="color:var(--gray);font-weight:400">(${Math.round(v/totMes*100)}%)</span></span></div>
          <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden"><div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(v/max*100)}%"></div></div>
        </div>
      </div>`).join('');
    }
  }
  const el=document.getElementById('desp-lista');
  if(!lista.length){ el.innerHTML='<div class="empty-st"><div class="ei">💸</div><p>Nenhuma despesa registrada.</p><button class="btn-primary" style="margin-top:12px" onclick="abrirFormDesp()">＋ Registrar despesa</button></div>'; return; }
  const icons={Combustível:'⛽',Pedágio:'🛣️',Material:'🔩',Alimentação:'🍽️',Outro:'📎'};
  el.innerHTML=lista.map(d=>`
    <div class="desp-card ${d.status||'pendente'}">
      <div class="desp-icon">${icons[d.tipo]||'📎'}</div>
      <div class="desp-info">
        <div class="desp-tipo">${esc(d.tipo||'')}${d.os_numero?' · OS #'+String(d.os_numero).padStart(3,'0'):''}</div>
        <div class="desp-desc">${esc(d.descricao||'—')}</div>
        <div class="desp-meta">${d.categoria==='empresa'
          ? '🏢 '+esc({fixo:'Fixo',variavel:'Variável',administrativo:'Administrativo',campo:'Campo'}[d.centro_custo]||d.centro_custo||'—')
            + (d.competencia?' · 🗓 comp. '+esc(d.competencia):'')
            + (d.recorrente?' · ↻ mensal':'')
          : '👤 '+esc(d.tecnico||'—')+' · 📅 '+(d.data?new Date(d.data+'T12:00:00').toLocaleDateString('pt-BR'):'—')}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <div class="desp-valor">${brl(d.valor||0)}</div>
        <span class="desp-st ${d.status||'pendente'}">${d.categoria==='empresa'?'🏢 Empresa':(d.status==='reembolsado'?'✅ Reembolsado':'⏳ Pendente')}</span>
        <div style="display:flex;gap:4px">
          ${d.status==='pendente'&&d.categoria!=='empresa'?`<button class="tb g" onclick="reembolsarDesp('${d.id}')">✅</button>`:''}
          ${d.foto_base64?`<button class="tb" onclick="verFotoDesp('${d.id}')">🧾</button>`:''}
          <button class="tb d" onclick="excluirDesp('${d.id}')">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

function verFotoDesp(id){
  const d=todasDesp.find(x=>x.id===id); if(!d||!d.foto_base64) return;
  // Valida formato antes de exibir — previne XSS via data: URI não-imagem
  if(!/^data:image\/(jpeg|png|gif|webp);base64,/.test(d.foto_base64)){
    console.warn('[verFotoDesp] formato inválido ignorado'); return;
  }
  const w=window.open('','_blank');
  if(!w) return;
  const img=w.document.createElement('img');
  img.src=d.foto_base64;
  img.style.cssText='max-width:100%;max-height:100vh;object-fit:contain';
  w.document.body.style.cssText='margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh';
  w.document.body.appendChild(img);
}

// ══════════════════════════════════════════════════
//  MÓDULO 1 — AGENDAMENTO RECORRENTE + CHECK-IN/OUT
// ══════════════════════════════════════════════════
let todosAg = [], calAno, calMes, checkinAt = null, checkinTimer = null;

function getTecnicos(){ return CFG.tecnicos || LOJAS.flatMap(l=>l.tecs||[]).filter((v,i,a)=>a.indexOf(v)===i); }

function populaTecSelects(){
  const tecs=getTecnicos();
  ['ag-tec','os-tec-checkin','cal-filtro-tec'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const val=el.value;
    const extra=id==='cal-filtro-tec'?'<option value="">Todos os técnicos</option>':'<option value="">Selecione…</option>';
    el.innerHTML=extra+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    el.value=val;
  });
}

function updAgForm(){
  const p=gV('ag-periodo'), sel=document.getElementById('ag-dia'); if(!sel) return;
  sel.innerHTML='';
  if(p==='mensal'){
    for(let i=1;i<=28;i++){ const o=document.createElement('option'); o.value=i; o.textContent='Dia '+i; sel.appendChild(o); }
  } else {
    ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].forEach((d,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=d; sel.appendChild(o); });
  }
}

function filtrarCliAg(v){
  const dl=document.getElementById('ag-cli-list'); dl.innerHTML='';
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  clientes.filter(c=>(c.nome||'').toLowerCase().includes(v.toLowerCase())).slice(0,8).forEach(c=>{
    const opt=document.createElement('option'); opt.value=c.nome; dl.appendChild(opt);
  });
}

function abrirFormAg(){
  document.getElementById('ag-form-card').style.display='block';
  document.getElementById('ag-inicio').value=_hojeLocal();
  populaTecSelects(); updAgForm();
  document.getElementById('ag-form-card').scrollIntoView({behavior:'smooth'});
}
function fecharFormAg(){ document.getElementById('ag-form-card').style.display='none'; }

async function salvarAgendamento(){
  const cli=gV('ag-cli').trim(), tipo=gV('ag-tipo').trim();
  if(!cli||!tipo){ toast('⚠️ Informe o cliente e o tipo de serviço'); return; }
  const dados={
    cliente:cli, local_servico:gV('ag-loc'), tecnico:gV('ag-tec'),
    tipo_servico:tipo, periodicidade:gV('ag-periodo'),
    dia_semana:parseInt(gV('ag-dia'))||1, horario:gV('ag-hora'),
    data_inicio:gV('ag-inicio'), data_fim:gV('ag-fim')||null,
    obs:gV('ag-obs'), ativo:true,
    loja_id:lojaAtiva||LOJA_PADRAO_ID
  };
  const rec={...dados, id:'ag_'+Date.now(), data_criacao:new Date().toISOString()};
  todosAg.unshift(rec);
  lsAgSalvar(todosAg);
  // Gera as OS futuras (próximas 6 ocorrências)
  await gerarOSdoAgendamento(rec, rec.id);
  if(dbOk&&db){
    (async()=>{
      try{
        const {data:ins}=await dbInsert('agendamentos', dados);
        if(ins){ todosAg=todosAg.filter(x=>x.id!==rec.id); todosAg.unshift(ins); lsAgSalvar(todosAg); }
      }catch(e){ console.warn('ag sync:',e.message); }
    })();
  }
  fecharFormAg(); renderAgLista(); renderCal();
  toast('✅ Agendamento salvo! OS geradas automaticamente.');
}

function proximasOcorrencias(ag, qtd=6){
  const datas=[];
  const inicio=new Date(ag.data_inicio+'T12:00:00');
  const fim=ag.data_fim?new Date(ag.data_fim+'T12:00:00'):null;
  const diaMes=(ag.dia_semana>=1&&ag.dia_semana<=31)?ag.dia_semana:0; // dia_semana armazena dia-do-mês para planos mensais
  let cur;
  if(ag.periodicidade==='mensal'&&diaMes){
    // Pinamos no dia preferido do mês — evita derivar para o dia da criação
    cur=new Date(inicio.getFullYear(),inicio.getMonth(),1,12,0,0);
    const maxD1=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
    cur.setDate(Math.min(diaMes,maxD1));
    if(cur<inicio){ // se o dia deste mês já passou, vai pro próximo
      cur.setMonth(cur.getMonth()+1);
      const maxD2=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
      cur.setDate(Math.min(diaMes,maxD2));
    }
  } else if(ag.periodicidade==='mensal'){
    // Plano mensal SEM dia escolhido → não agenda nada no calendário.
    // A visita fica pendente em "Meus Locais" e só aparece no calendário
    // quando a vistoria for feita (ou quando um dia for definido no plano).
    return [];
  } else {
    cur=new Date(inicio);
  }
  while(datas.length<qtd){
    if(fim&&cur>fim) break;
    datas.push(new Date(cur));
    if(ag.periodicidade==='semanal') cur.setDate(cur.getDate()+7);
    else if(ag.periodicidade==='quinzenal') cur.setDate(cur.getDate()+14);
    else {
      cur.setMonth(cur.getMonth()+1);
      if(diaMes){ // re-pina no dia preferido após avançar o mês
        const maxD=new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
        cur.setDate(Math.min(diaMes,maxD));
      }
    }
    if(datas.length>100) break;
  }
  return datas;
}

async function gerarOSdoAgendamento(ag, agId){
  const datas=proximasOcorrencias(ag, 6);
  for(const d of datas){
    const dataStr=d.toISOString().split('T')[0];
    // Idempotência: não cria de novo se já existe OS deste agendamento nesta data
    let jaExiste=false;
    try{ jaExiste=(JSON.parse(ls('fluxa_os_hist')||'[]')||[]).some(o=>o.agendamento_id===agId && o.data_servico===dataStr); }catch(e){ console.warn('[gerarOSag local]',e?.message||e); }
    if(!jaExiste && (todosOS||[]).some(o=>o.agendamento_id===agId && o.data_servico===dataStr)) jaExiste=true;
    if(!jaExiste && dbOk&&db){
      try{ const {data:ex}=await db.from('ordens_servico').select('id').eq('agendamento_id',agId).eq('data_servico',dataStr).limit(1); if(ex&&ex.length) jaExiste=true; }
      catch(e){ console.warn('[gerarOSag check]',e?.message||e); }
    }
    if(jaExiste) continue;
    const osDados={
      cliente:ag.cliente, local_servico:ag.local_servico,
      data_servico:dataStr, hora:ag.horario, tecnico:ag.tecnico,
      servicos:[ag.tipo_servico], materiais:'', obs_tecnica:ag.obs||'',
      total:0, status:'agendado', agendamento_id:agId,
      loja_id:ag.loja_id||lojaAtiva||LOJA_PADRAO_ID // fix #A: OS do plano herda loja_id do agendamento
    };
    const num=(parseInt(ls('fluxa_os_num')||'0'))+1; lsSet('fluxa_os_num',num);
    const rec={...osDados, id:'os_ag_'+Date.now()+Math.random(), numero:num, data_criacao:new Date().toISOString()};
    const localOS=JSON.parse(ls('fluxa_os_hist')||'[]'); localOS.unshift(rec); lsSet('fluxa_os_hist',JSON.stringify(localOS.slice(0,200)));
    if(dbOk&&db){
      try{
        await dbInsertNumerado('ordens_servico',{...osDados});
      }catch(e){ console.warn('OS ag sync:',e.message); }
    }
  }
}

// Reagenda as OS de um plano após editar o dia: cancela as futuras agendadas
// e regera conforme o dia atual (se o plano ficou sem dia, não regera nada).
async function _reagendarOSdoPlano(ag, agId){
  const hoje=_hojeLocal();
  try{
    const l=JSON.parse(ls('fluxa_os_hist')||'[]'); let mud=false;
    l.forEach(o=>{ if(o.agendamento_id===agId && o.status==='agendado' && (o.data_servico||'')>=hoje){ o.status='cancelado'; mud=true; } });
    if(mud) lsSet('fluxa_os_hist', JSON.stringify(l.slice(0,200)));
  }catch(e){ console.warn('[reagendarOS local]', e?.message||e); }
  try{ (todosOS||[]).forEach(o=>{ if(o.agendamento_id===agId && o.status==='agendado' && (o.data_servico||'')>=hoje) o.status='cancelado'; }); }catch(e){ console.warn('[reagendarOS mem]', e?.message||e); }
  if(dbOk&&db){ try{ await db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',agId).eq('status','agendado').gte('data_servico',hoje); }catch(e){ console.warn('[reagendarOS db]', e?.message||e); } }
  await gerarOSdoAgendamento(ag, agId);
}
// Reorganiza o calendário: passa por todos os planos da empresa e recria as
// visitas conforme o dia escolhido em cada um. Limpa visitas antigas empilhadas
// (ex.: as que caíam todas no dia 1 pelo bug do dia padrão).
function reorganizarCalendarioPlanos(btn){
  confirmar('Reorganizar o calendário conforme o dia de cada plano?\n\nVisitas antigas empilhadas serão removidas e recriadas no dia certo. Planos sem dia definido saem do calendário (continuam em Meus Locais).', ()=>_reorganizarCalConfirmado(btn), 'Reorganizar calendário');
}
async function _reorganizarCalConfirmado(btn){
  if(btn){ btn.disabled=true; btn.textContent='Reorganizando…'; }
  toast('🔧 Reorganizando calendário…');
  try{
    if(typeof loadLocaisRemoto==='function') await loadLocaisRemoto();
    const planos=(locaisVistoria||[]).filter(l=>l.ativo!==false && l.agendamento_id && escopoEmpresaMatch(l.loja_id));
    for(const l of planos){
      const base=todosAg.find(a=>a.id===l.agendamento_id)||{};
      const ag={
        cliente:l.cliente, local_servico:l.local, tecnico:l.tecnico||'',
        tipo_servico:'Vistoria de Manutenção', periodicidade:'mensal',
        dia_semana:parseInt(l.dia_pref)||null, horario:l.hora_pref||'08:00',
        data_inicio: base.data_inicio||_hojeLocal(), data_fim: base.data_fim||null,
        obs:'Plano de acompanhamento mensal', loja_id:l.loja_id, id:l.agendamento_id
      };
      await _reagendarOSdoPlano(ag, l.agendamento_id);
    }
    renderCal();
    toast('✅ Calendário reorganizado');
  }catch(e){ console.warn('[reorganizar]', e?.message||e); toast('⚠️ Falha ao reorganizar'); }
  if(btn){ btn.disabled=false; btn.textContent='🔧 Reorganizar'; }
}
// Ao concluir uma OS de agendamento recorrente, gera a ocorrência seguinte.
// dataConcluidaStr = data_servico da OS recém concluída (YYYY-MM-DD).
async function _gerarProximaOSdoAg(agId, dataConcluidaStr){
  const ag=todosAg.find(a=>a.id===agId);
  if(!ag||ag.ativo===false) return; // contrato encerrado
  // Calcula todas as ocorrências futuras a partir do dia seguinte à concluída
  const base=new Date((dataConcluidaStr||new Date().toISOString().split('T')[0])+'T12:00:00');
  const fakeAg={...ag, data_inicio: new Date(base.getTime()+86400000).toISOString().split('T')[0]};
  const proximas=proximasOcorrencias(fakeAg, 1);
  if(!proximas.length) return;
  await gerarOSdoAgendamento({...ag, data_inicio: fakeAg.data_inicio}, agId);
  renderCal();
}

function cancelarSerie(agId){
  confirmar('Cancelar TODAS as OS futuras deste agendamento?', ()=>_cancelarSerieConfirmado(agId), 'Cancelar Série');
}
async function _cancelarSerieConfirmado(agId){
  todosAg=todosAg.map(a=>a.id===agId?{...a,ativo:false}:a); lsAgSalvar(todosAg);
  if(dbOk&&db){
    db.from('agendamentos').update({ativo:false}).eq('id',agId).then(()=>{}).catch(()=>{});
    db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',agId).eq('status','agendado').then(()=>{}).catch(()=>{});
  }
  renderAgLista(); renderCal(); toast('🚫 Série cancelada');
}

function lsAgLer(){ try{ return JSON.parse(ls('fluxa_agendamentos')||'[]'); }catch(e){ return []; } }
function lsAgSalvar(lista){ lsSet('fluxa_agendamentos', JSON.stringify(lista)); }

async function loadAgendamentos(){
  todosAg=lsAgLer(); renderAgLista(); renderCal();
  if(dbOk&&db){
    try{
      let qAg=db.from('agendamentos').select('*').eq('ativo',true).order('data_criacao',{ascending:false});
      if(lojaAtiva) qAg=qAg.eq('loja_id',lojaAtiva);
      const {data}=await qAg;
      if(data){
        // MERGE (não sobrescreve): preserva agendamentos salvos offline que ainda
        // não subiram ao banco (id 'ag_...' ausente no retorno). Antes, esta linha
        // trocava a lista inteira e podia apagar um agendamento feito sem conexão.
        const idAg=new Set(data.map(x=>x.id));
        const soLocalAg=todosAg.filter(x=>String(x.id).startsWith('ag_')&&!idAg.has(x.id)&&_idadeIdMs(x.id)<DOIS_DIAS_MS);
        todosAg=[...data,...soLocalAg];
        lsAgSalvar(todosAg);
        // Reenvia ao banco os que ficaram presos só no aparelho
        for(const a of soLocalAg){
          try{
            const {id,data_criacao,..._dados}=a;
            const {data:ins}=await dbInsert('agendamentos', _dados);
            if(ins){ todosAg=todosAg.filter(x=>x.id!==a.id); todosAg.unshift(ins); lsAgSalvar(todosAg); }
          }catch(e){ console.warn('[reenvioAg]', e?.message||e); }
        }
        renderAgLista(); renderCal();
      }
    }catch(e){ console.warn('[loadAgendamentos]', e?.message||e); }
  }
  // Verifica visitas de amanhã para lembrete
  const amanha=new Date(); amanha.setDate(amanha.getDate()+1);
  const amanhaStr=amanha.toISOString().split('T')[0];
  const osLocal=JSON.parse(ls('fluxa_os_hist')||'[]');
  const visitasAmanha=osLocal.filter(o=>o.data_servico===amanhaStr&&o.status==='agendado');
  if(visitasAmanha.length){
    const el=document.getElementById('ag-alertas-amanha');
    if(el){
      el.innerHTML=`<div style="background:var(--blue-bg);border:1px solid var(--blue);border-radius:10px;padding:12px 16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">📅 ${visitasAmanha.length} visita(s) amanhã — envie o lembrete:</div>
        ${visitasAmanha.map(o=>{ _nc[o.id]=o; return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-size:13px;flex:1">${esc(o.cliente||'')} · ${o.hora||''} · ${esc(o.tecnico||'')}</span>
          <button class="tb" style="background:var(--wa);color:white;border-color:var(--wa)" onclick="enviarNotifWA(notifVisita(getNC('${o.id}')), getNC('${o.id}').tel_cliente||'')">💬 WA</button>
        </div>`; }).join('')}
      </div>`;
    }
  } else {
    const el=document.getElementById('ag-alertas-amanha');
    if(el) el.innerHTML='';
  }
}

function agTab(t){
  document.getElementById('ag-view-cal').style.display=t==='cal'?'block':'none';
  document.getElementById('ag-view-lista').style.display=t==='lista'?'block':'none';
  document.getElementById('ag-tab-cal').classList.toggle('on',t==='cal');
  document.getElementById('ag-tab-lista').classList.toggle('on',t==='lista');
}

// ── CALENDÁRIO ──
function initCal(){ const n=new Date(); calAno=n.getFullYear(); calMes=n.getMonth(); }
function navCal(d){ calMes+=d; if(calMes>11){calMes=0;calAno++;} if(calMes<0){calMes=11;calAno--;} renderCal(); }

function renderCal(){
  const el=document.getElementById('cal-tabela'); if(!el) return;
  const filtTec=gV('cal-filtro-tec');
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('cal-titulo').textContent=meses[calMes]+' '+calAno;
  const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let h=`<thead><tr>${dias.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>`;
  const primeiro=new Date(calAno,calMes,1);
  const ultimo=new Date(calAno,calMes+1,0).getDate();
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  let dia=1, inicioDia=primeiro.getDay();
  // OS do mês: mescla cache local (fluxa_os_hist) + as carregadas do banco (todosOS)
  const _osById={};
  try{ (JSON.parse(ls('fluxa_os_hist')||'[]')||[]).forEach(o=>{ if(o&&o.id) _osById[o.id]=o; }); }catch(e){ console.warn('[renderCal]',e?.message||e); }
  (todosOS||[]).forEach(o=>{ if(o&&o.id) _osById[o.id]=o; });
  // Filtro de empresa: o calendário da Aquamotor não pode mostrar OS da Fortemp
  // (e vice-versa). Era a causa de aparecerem clientes de outra empresa.
  let osLocal=filtrarPorLoja(Object.values(_osById));
  // Não polui o calendário com visitas canceladas (viravam lixo cinza).
  osLocal=osLocal.filter(o=>o.status!=='cancelado');
  // Dedup defensivo: OS do mesmo plano na mesma data (gerações repetidas).
  // Mantém a mais relevante: concluído > em andamento > agendado > cancelado.
  const _rank=s=>({concluido:3,em_andamento:2,agendado:1,cancelado:0}[s]??1);
  const _dedupOS=new Map();
  osLocal.forEach(o=>{
    const k=o.agendamento_id?('ag:'+o.agendamento_id+'|'+(o.data_servico||'')):('id:'+o.id);
    const prev=_dedupOS.get(k);
    if(!prev||_rank(o.status)>_rank(prev.status)) _dedupOS.set(k,o);
  });
  osLocal=[..._dedupOS.values()];
  while(dia<=ultimo){
    h+='<tr>';
    for(let col=0;col<7;col++){
      if((dia===1&&col<inicioDia)||dia>ultimo){ h+='<td class="outro-mes"></td>'; continue; }
      const d=new Date(calAno,calMes,dia); d.setHours(0,0,0,0);
      const isHoje=d.getTime()===hoje.getTime();
      const dStr=`${calAno}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      const osNoDia=osLocal.filter(o=>o.data_servico===dStr&&(!filtTec||o.tecnico===filtTec))
        .sort((a,b)=>(a.hora||'').localeCompare(b.hora||'')||(a.cliente||'').localeCompare(b.cliente||''));
      h+=`<td class="${isHoje?'hoje':''}"><div style="font-size:10px;color:var(--gray);margin-bottom:2px">${dia}</div>`;
      osNoDia.slice(0,3).forEach(o=>{
        _nc[o.id]=o;
        const tipo=_osTipo(o);
        let extraStyle='', emoji='🔧 ';
        if(o.status==='concluido'){ extraStyle='background:#16a34a;'; emoji='✅ '; }
        else if(o.status==='cancelado'){ extraStyle='background:#9ca3af;'; emoji='🚫 '; }
        else if(tipo==='vistoria'){ extraStyle='background:#7c3aed;'; emoji='🔍 '; }
        else if(tipo==='orcamento'){ extraStyle='background:#c45e0a;'; emoji='📄 '; }
        // avulso fica com a classe cal-ev padrão (azul)
        const evLabel=emoji+esc((o.cliente||'').split(' ')[0]);
        const title=`${esc(o.cliente||'')} — ${esc(o.tecnico||'')}${tipo==='vistoria'?' [Vistoria]':tipo==='orcamento'?' [Do orçamento]':' [Avulsa]'}`;
        h+=`<div class="cal-ev ${o.status||'agendado'}" title="${title}" onclick="verDetalhesOS('${o.id}')" style="cursor:pointer;${extraStyle}">${evLabel}</div>`;
      });
      if(osNoDia.length>3) h+=`<div style="font-size:9px;color:var(--gray)">+${osNoDia.length-3}</div>`;
      h+='</td>';
      if(dia>ultimo&&col<6) h+='<td class="outro-mes"></td>';
      dia++;
    }
    h+='</tr>';
  }
  h+='</tbody>';
  el.innerHTML=h;
}

function verDetalhesOS(id){
  const o=getNC(id)||todosOS.find(x=>x.id===id)||(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]').find(x=>x.id===id); }catch(e){ return null; } })();
  if(!o){ toast('OS não encontrada'); return; }
  const tipo=_osTipo(o);
  const statusLabel={agendado:'📋 Agendado',concluido:'✅ Concluído',cancelado:'🚫 Cancelado',em_andamento:'🔧 Em andamento'};
  const tipoBg={vistoria:'#f3e8ff',orcamento:'#fff7ed',servico:'#eff6ff'};
  const tipoCor={vistoria:'#7c3aed',orcamento:'#c45e0a',servico:'#1d4ed8'};
  const tipoLabel={vistoria:'🔍 Vistoria mensal',orcamento:'📄 Do orçamento',servico:'🔧 Serviço avulso'};
  const dataFmt=o.data_servico?new Date(o.data_servico+'T12:00:00').toLocaleDateString('pt-BR'):'—';
  const svcs=Array.isArray(o.servicos)?o.servicos.map(s=>typeof s==='string'?s:(s.desc||s)).filter(Boolean).join(', '):'—';
  const existing=document.getElementById('modal-detalhes-os');
  if(existing) existing.remove();
  const m=document.createElement('div');
  m.id='modal-detalhes-os';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px';
  const podeExecutar=o.status!=='concluido'&&o.status!=='cancelado';
  m.innerHTML=`<div style="background:#fff;border-radius:16px;padding:24px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Inter,sans-serif">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:16px;font-weight:800;color:#111">OS #${String(o.numero||'').padStart(3,'0')}</div>
        <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:50px;font-size:11px;font-weight:700;background:${tipoBg[tipo]};color:${tipoCor[tipo]}">${tipoLabel[tipo]}</span>
      </div>
      <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${o.status==='concluido'?'#dcfce7':o.status==='cancelado'?'#fee2e2':'#dbeafe'};color:${o.status==='concluido'?'#16a34a':o.status==='cancelado'?'#dc2626':'#2563eb'}">${statusLabel[o.status]||o.status}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px;font-size:13px;color:#374151">
      <div><span style="font-weight:700">👤 Cliente:</span> ${esc(o.cliente||'—')}</div>
      <div><span style="font-weight:700">📍 Local:</span> ${esc(o.local_servico||'—')}</div>
      <div><span style="font-weight:700">📅 Data:</span> ${dataFmt}${o.hora?' às '+esc(o.hora):''}</div>
      <div><span style="font-weight:700">🔧 Técnico:</span> ${esc(o.tecnico||'—')}</div>
      <div><span style="font-weight:700">🛠 Serviços:</span> ${esc(svcs)}</div>
      ${o.obs_tecnica?`<div><span style="font-weight:700">📝 Obs:</span> ${esc(o.obs_tecnica)}</div>`:''}
      ${o.duracao_min?`<div><span style="font-weight:700">⏱ Duração:</span> ${o.duracao_min} min</div>`:''}
      ${(()=>{ try{ const chk=o.checklist?(typeof o.checklist==='string'?JSON.parse(o.checklist):o.checklist):[]; const ok=chk.filter(x=>x.checked); if(!ok.length) return ''; return `<div><span style="font-weight:700">✅ Checklist:</span><div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">${ok.map(x=>`<div style="display:flex;align-items:flex-start;gap:6px;font-size:12px"><span style="color:var(--green);font-weight:700">✓</span><span>${esc(x.nome)}${x.obs?` <span style="color:#6b7280">— ${esc(x.obs)}</span>`:''}</span></div>`).join('')}</div></div>`; }catch(e){ return ''; } })()}
    </div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button onclick="this.closest('[id=modal-detalhes-os]').remove()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #e5e7eb;background:#fff;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer">Fechar</button>
      ${podeExecutar?`<button onclick="this.closest('[id=modal-detalhes-os]').remove();editarOS('${o.id}');go('os')" style="flex:2;padding:10px;border-radius:8px;border:none;background:var(--c1);color:#fff;font-family:Inter,sans-serif;font-size:13px;font-weight:700;cursor:pointer">🔧 Abrir e executar</button>`:''}
    </div>
  </div>`;
  m.addEventListener('click',e=>{ if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}

function renderAgLista(){
  const el=document.getElementById('ag-lista-body'); if(!el) return;
  let ativos=todosAg.filter(a=>a.ativo!==false);
  ativos=filtrarPorLoja(ativos);
  if(!ativos.length){ el.innerHTML='<div class="empty-st"><div class="ei">📅</div><p>Nenhum agendamento recorrente.</p></div>'; return; }
  const periodos={semanal:'Semanal',quinzenal:'Quinzenal',mensal:'Mensal'};
  el.innerHTML=ativos.map(a=>{
    const isPlano=!!(a.local_id||(a.id&&a.id.startsWith('ag_plano_')));
    const badge=isPlano?`<span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:#ede9fe;color:#7c3aed;margin-left:6px">📍 Plano</span>`:'';
    return `
    <div class="agenda-card" style="${isPlano?'border-left:3px solid #7c3aed;':''}" >
      <div class="agenda-info">
        <div class="agenda-titulo">${esc(a.cliente||'—')}${badge} <span style="font-size:12px;font-weight:400;color:var(--gray)">— ${esc(a.tipo_servico||'')}</span></div>
        <div class="agenda-sub">📍 ${esc(a.local_servico||'—')} &nbsp;·&nbsp; 👤 ${esc(a.tecnico||'—')} &nbsp;·&nbsp; ⏰ ${esc(a.horario||'')}</div>
        <div class="agenda-sub" style="margin-top:2px">🔁 ${periodos[a.periodicidade]||a.periodicidade} &nbsp;·&nbsp; Início: ${a.data_inicio?new Date(a.data_inicio+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
        ${isPlano?`<button class="tb" style="background:#ede9fe;color:#7c3aed;border-color:#ddd6fe" onclick="go('visitas')">📍 Ver Plano</button>`:`<button class="tb" style="background:var(--c1-light);color:var(--c1);border-color:var(--c1-mid)" onclick="novaVistoria('${esc(a.cliente||'')}','${esc(a.local_servico||'')}','${esc(a.tecnico||'')}')">🔍 Vistoria</button>`}
        <button class="tb d" onclick="cancelarSerie('${a.id}')">🚫 Cancelar</button>
      </div>
    </div>`;
  }).join('');
}

// ── CHECK-IN / CHECK-OUT ──
function populaTecCheckIn(){
  const sel=document.getElementById('os-tec-checkin'); if(!sel) return;
  const tecs=getTecnicos();
  sel.innerHTML='<option value="">Selecione o técnico…</option>'+tecs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  // Pré-seleciona o último técnico usado
  const ult=ls('fluxa_ultimo_tec'); if(ult) sel.value=ult;
}

let osCheckinId=null;
function fazerCheckin(){
  const tec=gV('os-tec-checkin'); if(!tec){ toast('⚠️ Selecione o técnico'); return; }
  checkinAt=new Date(); lsSet('fluxa_ultimo_tec',tec);
  osCheckinId=osEditId; // id da OS aberta (antes usava editId do orçamento — registro errado)
  document.getElementById('checkin-form').style.display='none';
  document.getElementById('checkin-bar').style.display='flex';
  document.getElementById('checkin-info').textContent='Check-in: '+checkinAt.toLocaleTimeString('pt-BR');
  if(checkinTimer) clearInterval(checkinTimer);
  checkinTimer=setInterval(()=>{
    const diff=Math.floor((new Date()-checkinAt)/1000);
    const h=String(Math.floor(diff/3600)).padStart(2,'0');
    const m=String(Math.floor((diff%3600)/60)).padStart(2,'0');
    const s=String(diff%60).padStart(2,'0');
    const el=document.getElementById('checkin-timer'); if(el) el.textContent=h+':'+m+':'+s;
  },1000);
  toast('📍 Check-in realizado!');
}

function fazerCheckout(){
  if(!checkinAt){ toast('⚠️ Faça o check-in primeiro'); return; }
  confirmar('Confirmar check-out e marcar OS como concluída?', _fazerCheckoutConfirmado, 'Check-out');
}
let _checkoutEmAndamento=false;
function _fazerCheckoutConfirmado(){
  if(_checkoutEmAndamento) return;
  _checkoutEmAndamento=true;
  const checkout=new Date();
  const duracaoMin=Math.round((checkout-checkinAt)/60000);
  if(checkinTimer){ clearInterval(checkinTimer); checkinTimer=null; }
  document.getElementById('checkin-bar').style.display='none';
  document.getElementById('checkin-form').style.display='flex';
  document.getElementById('checkin-info').textContent=`✅ Duração: ${duracaoMin} min (${checkinAt.toLocaleTimeString('pt-BR')} → ${checkout.toLocaleTimeString('pt-BR')})`;
  // Captura o que o técnico preencheu na OS para salvar JUNTO com o check-out
  const chkOk = (osChecklist||[]).filter(x=>x.checked);
  const dadosPreenchidos = {
    obs_tecnica: gV('os-obs')||'',
    materiais: gV('os-mat')||'',
    fotos: (osFotos||[]).filter(Boolean),
    video_link: gV('os-video-link')||null,
    checklist: chkOk.length?JSON.stringify(chkOk):null,
    tecnico: gV('os-tec-checkin')||gV('os-tec')||''
  };
  if(dbOk&&db&&osCheckinId&&!String(osCheckinId).startsWith('local_')){
    // checkin_time/checkout_time são os nomes reais das colunas no banco
    dbUpdate('ordens_servico', {
      checkin_time:checkinAt.toISOString(),
      checkout_time:checkout.toISOString(),
      duracao_min:duracaoMin,
      status:'concluido',
      ...dadosPreenchidos
    }, 'id', osCheckinId).then(r=>{ if(r.error) console.warn('[checkout OS] sync falhou:', r.error.message); }).catch(e=>console.warn('[checkout OS]', e?.message||e));
  }
  // Atualiza o cache local (calendário/Minhas OS refletem na hora)
  if(osCheckinId){
    try{
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]');
      const i=lista.findIndex(x=>x.id===osCheckinId);
      if(i>=0){ lista[i]={...lista[i],...dadosPreenchidos,status:'concluido',duracao_min:duracaoMin}; lsSet('fluxa_os_hist',JSON.stringify(lista.slice(0,200))); }
      const j=(todosOS||[]).findIndex(x=>x.id===osCheckinId);
      if(j>=0) todosOS[j]={...todosOS[j],...dadosPreenchidos,status:'concluido',duracao_min:duracaoMin};
    }catch(e){ console.warn('[checkout OS local]', e?.message||e); }
  }
  _entregarPelaOS(osCheckinId); // baixa do estoque do orçamento vinculado, se houver
  const _osConcl=(todosOS||[]).find(x=>x.id===osCheckinId);
  logAcao('os_concluida', `OS #${_osConcl?.numero||'?'} ${_osConcl?.cliente||''} · ${duracaoMin} min · ${dadosPreenchidos.tecnico||''}`);
  // Se era OS de agendamento recorrente, gera a próxima ocorrência automaticamente
  if(_osConcl?.agendamento_id) _gerarProximaOSdoAg(_osConcl.agendamento_id, _osConcl.data_servico).catch(e=>console.warn('[nextOS]',e?.message||e));
  checkinAt=null; osCheckinId=null; _checkoutEmAndamento=false;
  toast(`✅ Check-out! OS concluída · ${duracaoMin} min`);
}

// ══════════════════════════════════════════════════
//  MÓDULO 2 — EQUIPAMENTOS + QR CODE
// ══════════════════════════════════════════════════
let todosEq = [], eqFotoB64 = '', eqEditId = null;
let eqBusca = '', eqFiltroTipo = '';
// Etapa 5 do roadmap de CRM (2026-08-12): cliente_id real no equipamento
// (mesmo padrão de orçamento/OS/venda) + piscina específica dentro do
// cliente. Piscina nunca é criada sozinha a partir de nome digitado — só
// via "Salvar piscina" explícito, e só depois de um cliente_id real.
let _eqClienteSelecionado = null;
let todasPiscinas = [];
let _eqPiscinaSelecionadaId = null;
let _eqPiscinaEditId = null; // piscina sendo editada (null = form em modo "nova")
// Mesmo padrão em vistoria — sem isso importarEqDaVistoria() quase nunca
// tinha cliente_id pra herdar (achado da auditoria: 1 vistoria em 7).
let _visClienteSelecionado = null;

function abrirFormEq(id){
  eqEditId = id || null;
  const card = document.getElementById('eq-form-card');
  card.style.display = 'block';
  if(id){
    const eq = todosEq.find(x=>x.id===id); if(!eq) return;
    setV('eq-cli-nome', eq.cliente_nome||'');
    setV('eq-tipo', eq.tipo||'');
    setV('eq-marca', eq.marca||'');
    setV('eq-modelo', eq.modelo||'');
    setV('eq-potencia', eq.potencia||'');
    setV('eq-serie', eq.numero_serie||'');
    setV('eq-instalacao', eq.data_instalacao||'');
    setV('eq-garantia', eq.garantia_meses||12);
    setV('eq-garantia-venc', eq.garantia_vencimento||'');
    setV('eq-obs', eq.obs||'');
    eqFotoB64 = eq.foto_base64||'';
    const prev = document.getElementById('eq-foto-prev');
    if(eqFotoB64){ prev.src=eqFotoB64; prev.style.display='block'; document.getElementById('eq-btn-rm-foto').style.display='block'; }
    _eqClienteSelecionado = eq.cliente_id ? {id:eq.cliente_id, nome:eq.cliente_nome} : null;
    _eqPiscinaSelecionadaId = eq.piscina_id || null;
  } else {
    ['eq-cli-nome','eq-tipo','eq-marca','eq-modelo','eq-potencia','eq-serie','eq-instalacao','eq-obs'].forEach(id=>setV(id,''));
    setV('eq-garantia','12'); setV('eq-garantia-venc','');
    eqFotoB64='';
    const prev=document.getElementById('eq-foto-prev'); prev.style.display='none';
    document.getElementById('eq-btn-rm-foto').style.display='none';
    document.getElementById('eq-foto-lbl').textContent='Tirar foto ou selecionar imagem';
    _eqClienteSelecionado = null;
    _eqPiscinaSelecionadaId = null;
  }
  document.getElementById('eq-piscina-novo').style.display='none';
  _eqRenderPiscinas();
  card.scrollIntoView({behavior:'smooth'});
}
function fecharFormEq(){ document.getElementById('eq-form-card').style.display='none'; eqEditId=null; eqFotoB64=''; }

// Digitar por cima do nome invalida o vínculo — mesma regra de orçamento/OS/venda.
function _eqClienteEditado(){ _eqClienteSelecionado=null; _eqPiscinaSelecionadaId=null; _eqRenderPiscinas(); }

// ══════════════════════════════════════════════════════════════════════════════
//  CONSUMO TEÓRICO DE QUÍMICO — Etapa 4 (parte 2) do roadmap de CRM, 2026-08-13
//  Referência trazida pelo Marcos (pesquisa externa, documento completo em
//  docs/referencia-consumo-quimico-piscinas-2026-08-12.md). T_dias =
//  Q_embalagem / (q × V); q = d/A pros clorados. `d` fixado na referência
//  "verão/externa/uso moderado/estabilizada" (2,0 g Cl₂/m³/dia) — os
//  coeficientes de ajuste por estação/capa térmica/carga de banhistas do
//  documento (seção 2.2) NÃO estão aplicados: a ficha da piscina não
//  captura esses campos hoje. Prior de confiança média-baixa pra cliente
//  sem histórico (±35-50% de erro, segundo o próprio documento) — some da
//  fila assim que houver 2+ compras reais, porque o intervalo OBSERVADO
//  (calculado em analiseClientes) sempre vence um número teórico.
//  Só os tratamentos de confiança "alta" no documento têm cálculo — o
//  resto fica no cadastro (registro correto) mas sem estimativa ainda.
// ══════════════════════════════════════════════════════════════════════════════
const D_REF_CLORO=2.0; // g Cl2/m3/dia — documento, seção 2 (verão/externa/moderado/estabilizada)

const TIPOS_TRATAMENTO=[
  {id:'',                   label:'Não sei / outro'},
  {id:'dicloro_granulado',  label:'Cloro granulado (dicloro)'},
  {id:'hipoclorito_calcio', label:'Hipoclorito de cálcio'},
  {id:'cloro_liquido_10',   label:'Cloro líquido'},
  {id:'pastilha_tricloro',  label:'Pastilha / multiação (tricloro)'},
  {id:'sal_salino',         label:'Gerador de cloro salino'},
  {id:'bromo',              label:'Bromo'},
  {id:'peroxido',           label:'Peróxido de hidrogênio'},
  {id:'phmb',               label:'Biguanida (PHMB)'}
];
function _tratamentoOptionsHTML(){
  return TIPOS_TRATAMENTO.map(t=>`<option value="${t.id}">${esc(t.label)}</option>`).join('');
}

// Estação do ano no Brasil (hemisfério sul) — mesma janela de verão já
// usada em outro lugar do app ("Sazonalidade: obra grande precisa aprovar
// até ~outubro para entregar antes da temporada (verão dez–mar)").
function _estacaoAtual(){
  const mes=new Date().getMonth()+1;
  if([12,1,2,3].includes(mes)) return 'verao';
  if([6,7,8].includes(mes)) return 'inverno';
  return 'meia_estacao';
}
// Demanda diária de cloro ajustada pelos fatores da piscina — documento,
// seções 2.1/2.2. Coeficientes multiplicam (usar o ponto médio de cada
// faixa do documento); banhistas de condomínio SOMA, não multiplica.
// Só entram os fatores que a ficha da piscina já captura hoje — o
// documento lista mais (chuva, ozônio/UV, filtragem ruim) que exigiriam
// campos que ainda não existem no cadastro.
function demandaDiaria(piscina){
  let d=D_REF_CLORO;
  const estacao=_estacaoAtual();
  d *= estacao==='verao' ? 1.0 : estacao==='meia_estacao' ? 0.70 : 0.45;
  if(piscina.capa_termica) d *= 0.50;
  if(piscina.exposicao_solar==='parcial') d *= 0.70;
  if(piscina.aquecida) d *= 1.30;
  if(piscina.estabilizante===false) d *= 2.15;
  if(piscina.tipo_uso==='condominio' && piscina.banhistas_dia && piscina.volume_m3){
    d += (piscina.banhistas_dia*4)/piscina.volume_m3;
  }
  return d;
}

// A = teor ativo (fração). Embalagem de referência = a mais comum no
// documento pra esse tipo — não tenta casar com a embalagem exata que o
// cliente comprou (isso exigiria rastrear produto_id por venda, fora do
// escopo desta primeira versão).
const CONSUMO_QUIMICO_REF={
  dicloro_granulado:  {A:0.58, embalagemG:10000, embalagemLabel:'um balde de 10kg'},
  hipoclorito_calcio: {A:0.65, embalagemG:10000, embalagemLabel:'um balde de 10kg'},
  pastilha_tricloro:  {A:0.90, embalagemG:5000,  embalagemLabel:'um balde de 5kg (25 pastilhas)'}
};
// `d` já vem calculado (demandaDiaria(piscina)) — quem chama decide os
// fatores. Retorna {dias, embalagemLabel} ou null se não tiver cálculo pro
// tipo, ou faltar volume.
function consumoTeoricoDias(tipoTratamento, volumeM3, d, exposicaoSolar){
  if(!volumeM3 || volumeM3<=0) return null;
  d = d==null ? D_REF_CLORO : d;
  if(tipoTratamento==='cloro_liquido_10'){
    // A = 100 g Cl2 por litro de produto (concentração 10%)
    const qLm3dia=d/100;
    const dias=20000/(qLm3dia*1000*volumeM3); // bombona 20L = 20.000mL
    return {dias:Math.round(dias), embalagemLabel:'uma bombona de 20L'};
  }
  if(tipoTratamento==='sal_salino'){
    // Sal não segue a demanda de cloro — usa a taxa de perda de água (r),
    // não `d`. Documento seção 3.5.
    const r=0.0035; // perda residencial default (documento: 0,2–0,5%/dia)
    const dias=25/(3.2*volumeM3*r);
    return {dias:Math.round(dias), embalagemLabel:'um saco de 25kg de sal'};
  }
  if(tipoTratamento==='bromo'){
    // d_Br NÃO deriva do `d` do cloro (que mistura estação/capa/aquecida —
    // usar isso aqui confundiria uma piscina exposta no inverno com uma
    // protegida no verão). Documento dá 2 pontos de referência fixos por
    // contexto (seção 3.6): usa exposicao_solar da piscina diretamente.
    const dBr = exposicaoSolar==='parcial' ? 2.5 : 7.0;
    const dias=3050/(dBr*volumeM3); // balde 5kg, 250un, 3.050g halogênio
    return {dias:Math.round(dias), embalagemLabel:'um balde de 5kg de pastilhas (250 un)'};
  }
  if(tipoTratamento==='peroxido'){
    // Dose fixa de rótulo, não deriva da demanda de cloro (seção 3.7).
    const dias=20000/(7.5*volumeM3); // bombona 20L
    return {dias:Math.round(dias), embalagemLabel:'uma bombona de 20L'};
  }
  const ref=CONSUMO_QUIMICO_REF[tipoTratamento]; if(!ref) return null;
  const q=d/ref.A; // g de produto por m3 por dia
  const dias=ref.embalagemG/(q*volumeM3);
  return {dias:Math.round(dias), embalagemLabel:ref.embalagemLabel};
}

function _eqRenderPiscinas(){
  const sel=document.getElementById('eq-piscina'); if(!sel) return;
  document.getElementById('eq-piscina-novo').style.display='none';
  const btnEd=document.getElementById('eq-piscina-editar-btn');
  if(!_eqClienteSelecionado?.id){
    sel.innerHTML='<option value="">Selecione o cliente pela lupa 🔍 primeiro</option>';
    sel.disabled=true;
    if(btnEd) btnEd.style.display='none';
    return;
  }
  sel.disabled=false;
  const doCliente=(todasPiscinas||[]).filter(p=>p.cliente_id===_eqClienteSelecionado.id && p.ativo!==false);
  sel.innerHTML = '<option value="">Nenhuma / não informado</option>'
    + doCliente.map(p=>`<option value="${esc(p.id)}"${p.id===_eqPiscinaSelecionadaId?' selected':''}>${esc(p.nome||'Piscina')}${p.volume_m3?' — '+p.volume_m3+'m³':''}</option>`).join('')
    + '<option value="__nova__">+ Cadastrar nova piscina…</option>';
  if(_eqPiscinaSelecionadaId && doCliente.some(p=>p.id===_eqPiscinaSelecionadaId)) sel.value=_eqPiscinaSelecionadaId;
  // Editar só faz sentido com uma piscina real escolhida (não '' nem '__nova__').
  if(btnEd) btnEd.style.display = _eqPiscinaSelecionadaId ? '' : 'none';
}
function _eqPiscinaLimparForm(){
  setV('eq-piscina-nome',''); setV('eq-piscina-vol',''); setV('eq-piscina-trat','');
  ['eq-piscina-capa','eq-piscina-aquecida'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=false; });
  const est=document.getElementById('eq-piscina-estabilizante'); if(est) est.checked=true;
  setV('eq-piscina-exposicao','pleno'); setV('eq-piscina-uso','residencial'); setV('eq-piscina-banhistas','');
  _eqPiscinaAtualizarUso();
}
// Campo de banhistas só aparece pra condomínio — divulgação progressiva,
// residência não precisa decidir um número que não existe.
function _eqPiscinaAtualizarUso(){
  const uso=gV('eq-piscina-uso');
  const wrap=document.getElementById('eq-piscina-banhistas-wrap');
  if(wrap) wrap.style.display = uso==='condominio' ? '' : 'none';
}
function _eqPiscinaSelect(val){
  const novoForm=document.getElementById('eq-piscina-novo');
  if(val==='__nova__'){
    _eqPiscinaEditId=null;
    novoForm.style.display='block';
    _eqPiscinaLimparForm();
    _eqPiscinaSelecionadaId=null;
  } else {
    novoForm.style.display='none';
    _eqPiscinaSelecionadaId = val||null;
  }
  _eqRenderPiscinas();
}
// Reabre o form inline pré-preenchido com a piscina já escolhida no select
// — sem isto não existia jeito nenhum de completar depois os campos que o
// import em massa não pergunta (capa, exposição, banhistas, etc.).
function _eqPiscinaEditar(){
  if(!_eqPiscinaSelecionadaId) return;
  const p=(todasPiscinas||[]).find(x=>x.id===_eqPiscinaSelecionadaId); if(!p) return;
  _eqPiscinaEditId=p.id;
  document.getElementById('eq-piscina-novo').style.display='block';
  setV('eq-piscina-nome',p.nome||''); setV('eq-piscina-vol',p.volume_m3!=null?String(p.volume_m3):'');
  setV('eq-piscina-trat',p.tipo_tratamento||'');
  const capa=document.getElementById('eq-piscina-capa'); if(capa) capa.checked=!!p.capa_termica;
  const aquec=document.getElementById('eq-piscina-aquecida'); if(aquec) aquec.checked=!!p.aquecida;
  const est=document.getElementById('eq-piscina-estabilizante'); if(est) est.checked=p.estabilizante!==false;
  setV('eq-piscina-exposicao',p.exposicao_solar||'pleno');
  setV('eq-piscina-uso',p.tipo_uso||'residencial');
  setV('eq-piscina-banhistas',p.banhistas_dia!=null?String(p.banhistas_dia):'');
  _eqPiscinaAtualizarUso();
}
async function _eqPiscinaCriar(){
  if(!_eqClienteSelecionado?.id){ toast('⚠️ Selecione o cliente pela lupa 🔍 antes de cadastrar a piscina'); return; }
  const nome=(gV('eq-piscina-nome')||'').trim()||'Piscina principal';
  const vol=parseFloat((gV('eq-piscina-vol')||'').replace(',','.'))||null;
  const trat=(gV('eq-piscina-trat')||'').trim()||null;
  const uso=gV('eq-piscina-uso')||'residencial';
  const dados={
    cliente_id:_eqClienteSelecionado.id, local_id:null, nome, volume_m3:vol, tipo_tratamento:trat,
    capa_termica:!!document.getElementById('eq-piscina-capa')?.checked,
    exposicao_solar:gV('eq-piscina-exposicao')||'pleno',
    aquecida:!!document.getElementById('eq-piscina-aquecida')?.checked,
    tipo_uso:uso,
    banhistas_dia: uso==='condominio' ? (parseInt(gV('eq-piscina-banhistas'))||null) : null,
    estabilizante: document.getElementById('eq-piscina-estabilizante')?.checked!==false,
    loja_id:lojaAtiva||LOJA_PADRAO_ID, ativo:true
  };
  if(_eqPiscinaEditId){
    const idEd=_eqPiscinaEditId;
    const idx=todasPiscinas.findIndex(x=>x.id===idEd);
    if(idx>=0) todasPiscinas[idx]={...todasPiscinas[idx], ...dados};
    lsPiscinaSalvar(todasPiscinas);
    _eqPiscinaSelecionadaId=idEd; _eqPiscinaEditId=null;
    document.getElementById('eq-piscina-novo').style.display='none';
    _eqRenderPiscinas();
    toast('✅ Piscina atualizada');
    if(dbOk&&db&&!String(idEd).startsWith('pisc_')){
      dbUpdate('piscinas', dados, 'id', idEd).catch(e=>console.warn('[_eqPiscinaCriar update]', e?.message||e));
    }
    return;
  }
  const tempId='pisc_'+Date.now();
  todasPiscinas.unshift({...dados, id:tempId});
  lsPiscinaSalvar(todasPiscinas);
  _eqPiscinaSelecionadaId=tempId;
  _eqRenderPiscinas();
  toast('✅ Piscina cadastrada');
  if(dbOk&&db){
    try{
      const {data:ins}=await dbInsert('piscinas', dados);
      if(ins){
        todasPiscinas=todasPiscinas.filter(x=>x.id!==tempId); todasPiscinas.unshift(ins); lsPiscinaSalvar(todasPiscinas);
        if(_eqPiscinaSelecionadaId===tempId){ _eqPiscinaSelecionadaId=ins.id; _eqRenderPiscinas(); }
      }
    }catch(e){ console.warn('[_eqPiscinaCriar]', e?.message||e); }
  }
}
function lsPiscinaLer(){ try{ return JSON.parse(ls('fluxa_piscinas')||'[]'); }catch(e){ return []; } }
function lsPiscinaSalvar(lista){ lsSet('fluxa_piscinas', JSON.stringify(lista)); }
async function loadPiscinas(){
  todasPiscinas=lsPiscinaLer();
  if(!dbOk||!db) return;
  try{
    const {data}=await db.from('piscinas').select('*').limit(3000);
    if(data){ todasPiscinas=data; lsPiscinaSalvar(todasPiscinas); }
  }catch(e){ console.warn('[loadPiscinas]', e?.message||e); }
}

function calcVencGarantia(){
  const inst=gV('eq-instalacao'), meses=parseInt(gV('eq-garantia'))||12;
  if(!inst) return '';
  const d=new Date(inst+'T12:00:00'); d.setMonth(d.getMonth()+meses);
  return d.toISOString().split('T')[0];
}

// Atualiza vencimento ao mudar instalação ou meses
document.addEventListener('input', e=>{
  if(e.target.id==='eq-instalacao'||e.target.id==='eq-garantia'){
    setV('eq-garantia-venc', calcVencGarantia());
  }
});

function carregarFotoEq(inp){
  const f=inp.files[0]; if(!f) return;
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r=new FileReader();
  r.onload=e=>{ eqFotoB64=e.target.result;
    const prev=document.getElementById('eq-foto-prev'); prev.src=e.target.result; prev.style.display='block';
    document.getElementById('eq-foto-lbl').textContent=f.name;
    document.getElementById('eq-btn-rm-foto').style.display='block';
  };
  r.readAsDataURL(f);
}
function removerFotoEq(){ eqFotoB64=''; document.getElementById('eq-foto-prev').style.display='none'; document.getElementById('eq-foto-lbl').textContent='Tirar foto ou selecionar imagem'; document.getElementById('eq-btn-rm-foto').style.display='none'; document.getElementById('eq-foto-input').value=''; }

function filtrarClientesEq(v){
  const dl=document.getElementById('eq-cli-list'); dl.innerHTML='';
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  clientes.filter(c=>(c.nome||'').toLowerCase().includes(v.toLowerCase())).slice(0,8).forEach(c=>{
    const opt=document.createElement('option'); opt.value=c.nome; dl.appendChild(opt);
  });
}

async function salvarEquipamento(){
  const nome=gV('eq-cli-nome').trim(), tipo=gV('eq-tipo');
  if(!nome||!tipo){ toast('⚠️ Informe o cliente e o tipo'); return; }
  const _btnEq=document.querySelector('button[onclick="salvarEquipamento()"]');
  if(_btnEq){ _btnEq.disabled=true; _btnEq.textContent='Salvando…'; }
  const venc=calcVencGarantia();
  const dados={
    cliente_nome:nome, cliente_id:_eqClienteSelecionado?.id||null, piscina_id:_eqPiscinaSelecionadaId||null,
    tipo, marca:gV('eq-marca'), modelo:gV('eq-modelo'),
    potencia:gV('eq-potencia'), numero_serie:gV('eq-serie'),
    data_instalacao:gV('eq-instalacao'), garantia_meses:parseInt(gV('eq-garantia'))||12,
    garantia_vencimento:venc, obs:gV('eq-obs'), foto_base64:eqFotoB64||null, ativo:true,
    loja_id:lojaAtiva||LOJA_PADRAO_ID
  };
  if(eqEditId){
    const idx=todosEq.findIndex(x=>x.id===eqEditId);
    if(idx>=0) todosEq[idx]={...todosEq[idx],...dados};
    lsEqSalvar(todosEq);
    if(dbOk&&db) dbUpdate('equipamentos', dados, 'id', eqEditId).then(()=>{}).catch(()=>{});
    toast('✅ Equipamento atualizado!');
  } else {
    const tempId='eq_'+Date.now();
    const rec={...dados, id:tempId, data_criacao:new Date().toISOString()};
    todosEq.unshift(rec);
    lsEqSalvar(todosEq);
    if(dbOk&&db){
      (async()=>{
        try{
          const {data:ins}=await dbInsert('equipamentos', dados);
          if(ins){ todosEq=todosEq.filter(x=>x.id!==tempId); todosEq.unshift(ins); lsEqSalvar(todosEq); renderEqGrid(); }
        }catch(e){ console.warn('eq sync falhou:',e.message); }
      })();
    }
    toast('✅ Equipamento salvo!');
  }
  if(_btnEq){ _btnEq.disabled=false; _btnEq.textContent='💾 Salvar Equipamento'; }
  fecharFormEq(); renderEqGrid(); verificarAlertasGarantia();
}

function excluirEq(id){
  confirmar('Excluir este equipamento?', ()=>{
    todosEq=todosEq.filter(x=>x.id!==id); lsEqSalvar(todosEq);
    if(!String(id).startsWith('eq_')){
      _tombAdd('fluxa_eq_tombstones', id); // protege contra ressuscitar se o delete abaixo falhar
      if(dbOk&&db) db.from('equipamentos').delete().eq('id',id).then(()=>{}).catch(()=>{});
    }
    renderEqGrid(); toast('🗑 Equipamento excluído');
  }, 'Excluir Equipamento');
}

// localStorage para equipamentos
// ══════════════════════════════════════════════════════════════════════
//  BASE INSTALADA (fase 4) — popular `equipamentos` a partir das vistorias
//  A tabela estava com 0 registros, mas os equipamentos já existem dentro do
//  jsonb das vistorias (o Infinity Coast Tower sozinho tem 51). Sem base
//  instalada não há manutenção recorrente por equipamento — e é justamente o
//  serviço recorrente que converte a 43%, contra 8% do equipamento avulso.
// ══════════════════════════════════════════════════════════════════════
function _eqChave(cliente, e){
  const n=x=>_identNorm? _identNorm(x) : String(x||'').trim().toLowerCase();
  return [n(cliente), n(e.nome||e.tipo), n(e.marca), n(e.modelo), n(e.ambiente)].join('|');
}
// Varre as vistorias no escopo e devolve o que ainda não virou ficha de equipamento.
function _eqCandidatos(){
  const vis=(typeof lsVisLer==='function'? lsVisLer() : []).filter(v=>
    typeof escopoEmpresaMatch==='function' ? escopoEmpresaMatch(v.loja_id) : true);
  // Lê `ambiente` da coluna dedicada — antes o ambiente era gravado só dentro de
  // `obs`, então esta chave saía com ambiente vazio de um lado e preenchido do
  // outro, e a importação duplicava tudo ao ser rodada de novo.
  const jaTem=new Set((todosEq||[]).map(x=>_eqChave(x.cliente_nome,
    {nome:x.tipo, marca:x.marca, modelo:x.modelo, ambiente:x.ambiente||''})));
  const out=new Map();
  vis.forEach(v=>{
    let eqs=v.equipamentos;
    if(typeof eqs==='string'){ try{ eqs=JSON.parse(eqs||'[]'); }catch(e){ eqs=[]; } }
    (Array.isArray(eqs)?eqs:[]).forEach(e=>{
      if(!e || !(e.nome||e.tipo)) return;
      if(e.status==='na') return;                    // marcado como não se aplica
      const k=_eqChave(v.cliente, e);
      if(jaTem.has(k) || out.has(k)) {
        // guarda o mais recente para o status/observação valerem o último laudo
        const ant=out.get(k);
        if(ant && String(v.data||'')>String(ant.dataVis||'')){ out.set(k, {...ant, status:e.status, obs:e.obs, dataVis:v.data}); }
        return;
      }
      out.set(k, { chave:k, cliente:v.cliente, cliente_id:v.cliente_id||null,
        local:v.local||'', loja_id:v.loja_id||null, dataVis:v.data||'',
        tipo:e.nome||e.tipo, marca:e.marca||'', modelo:e.modelo||'', potencia:e.potencia||'',
        ambiente:e.ambiente||'', status:e.status||'', obs:e.obs||'',
        foto:(Array.isArray(e.fotos)&&e.fotos[0])||'' });
    });
  });
  return [...out.values()].sort((a,b)=>String(a.cliente).localeCompare(String(b.cliente)));
}

// { clienteId: piscinaId } — qual piscina escolher pra cada grupo de cliente
// no import em massa. Persiste entre re-renders da tela (criar piscina nova
// re-renderiza a lista inteira, sem isso a escolha se perderia).
let _eqImportPiscinaEscolhida = {};

function renderEqImport(){
  const card=document.getElementById('eq-import-card'), el=document.getElementById('eq-import-corpo');
  if(!card||!el) return;
  const cands=_eqCandidatos();
  if(!cands.length){ card.style.display='none'; return; }
  card.style.display='';
  const porCliente={};
  cands.forEach(c=>{ (porCliente[c.cliente]=porCliente[c.cliente]||[]).push(c); });
  const criticos=cands.filter(c=>c.status==='critico').length;
  el.innerHTML=
    `<div style="font-size:12.5px;color:var(--gray);margin-bottom:10px">
       ${cands.length} equipamento${cands.length!==1?'s':''} em ${Object.keys(porCliente).length} cliente${Object.keys(porCliente).length!==1?'s':''} apareceram em vistoria e não estão na base instalada.
       ${criticos?`<strong style="color:var(--red)">${criticos} com laudo crítico.</strong>`:''}
     </div>`+
    Object.entries(porCliente).map(([cli,lista])=>{
      const clienteId=lista[0].cliente_id||null;
      // Piscina só faz sentido pra grupo com cliente_id resolvido — vistoria
      // antiga (antes da captura de id) ainda pode não ter.
      const piscinaPicker = clienteId ? (()=>{
        const doCliente=(todasPiscinas||[]).filter(p=>p.cliente_id===clienteId && p.ativo!==false);
        return `<div style="margin-top:6px">
          <select id="eqimp-pisc-${clienteId}" onchange="_eqImportPiscinaSelect('${clienteId}',this.value)" style="font-size:11.5px;padding:5px 6px;width:auto">
            <option value="">Sem piscina / não informar</option>
            ${doCliente.map(p=>`<option value="${esc(p.id)}"${_eqImportPiscinaEscolhida[clienteId]===p.id?' selected':''}>${esc(p.nome||'Piscina')}${p.volume_m3?' — '+p.volume_m3+'m³':''}</option>`).join('')}
            <option value="__nova__">+ Nova piscina…</option>
          </select>
          <div id="eqimp-pisc-novo-${clienteId}" style="display:none;margin-top:4px">
            <input type="text" id="eqimp-pisc-nome-${clienteId}" placeholder="Nome (ex: Piscina Adulto)" style="width:150px;font-size:11px;padding:4px 6px;margin-right:4px">
            <input type="text" inputmode="decimal" id="eqimp-pisc-vol-${clienteId}" placeholder="Vol. m³" style="width:60px;font-size:11px;padding:4px 6px;margin-right:4px">
            <select id="eqimp-pisc-trat-${clienteId}" style="font-size:11px;padding:4px 6px;margin-right:4px">${_tratamentoOptionsHTML()}</select>
            <button type="button" class="tb" style="font-size:11px;padding:4px 8px" onclick="_eqImportPiscinaCriar('${clienteId}')">Criar</button>
          </div>
        </div>`;
      })() : `<div style="font-size:10.5px;color:var(--gray);margin-top:4px">Sem cliente vinculado — sem piscina pra escolher (vistoria antiga)</div>`;
      return `<div style="border-bottom:1px solid var(--gray-light);padding:9px 0">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
          <div style="min-width:170px">
            <div style="font-size:13px;font-weight:700;color:var(--c2)">${esc(cli||'(sem cliente)')}</div>
            <div style="font-size:11px;color:var(--gray)">${lista.length} equipamento${lista.length!==1?'s':''} · ${esc((lista[0].local||'').slice(0,44))}</div>
            <div style="font-size:11px;color:var(--gray);margin-top:2px">${lista.slice(0,4).map(x=>esc(x.tipo)+(x.status==='critico'?' 🔴':x.status==='atencao'?' ⚠️':'')).join(' · ')}${lista.length>4?` +${lista.length-4}`:''}</div>
            ${piscinaPicker}
          </div>
          <button class="tb g" style="font-weight:700" onclick="importarEqDaVistoria('${esc(cli).replace(/'/g,"\\\\'")}')">＋ Cadastrar ${lista.length}</button>
        </div>
      </div>`;
    }).join('')+
    `<button class="btn-primary" style="width:100%;margin-top:12px" onclick="importarEqDaVistoria()">＋ Cadastrar todos os ${cands.length}</button>
     <div style="font-size:10.5px;color:var(--gray);margin-top:4px;text-align:center">"Cadastrar todos" respeita a piscina escolhida em cada cliente acima</div>`;
}
function _eqImportPiscinaSelect(clienteId, val){
  const novoWrap=document.getElementById('eqimp-pisc-novo-'+clienteId);
  if(val==='__nova__'){ if(novoWrap) novoWrap.style.display='block'; return; }
  if(novoWrap) novoWrap.style.display='none';
  _eqImportPiscinaEscolhida[clienteId] = val||null;
}
async function _eqImportPiscinaCriar(clienteId){
  const nome=(gV('eqimp-pisc-nome-'+clienteId)||'').trim()||'Piscina principal';
  const vol=parseFloat((gV('eqimp-pisc-vol-'+clienteId)||'').replace(',','.'))||null;
  const trat=gV('eqimp-pisc-trat-'+clienteId)||null;
  const dados={cliente_id:clienteId, local_id:null, nome, volume_m3:vol, tipo_tratamento:trat, loja_id:lojaAtiva||LOJA_PADRAO_ID, ativo:true};
  const tempId='pisc_'+Date.now();
  todasPiscinas.unshift({...dados, id:tempId}); lsPiscinaSalvar(todasPiscinas);
  _eqImportPiscinaEscolhida[clienteId]=tempId;
  toast('✅ Piscina cadastrada');
  renderEqImport();
  if(dbOk&&db){
    try{
      const {data:ins}=await dbInsert('piscinas', dados);
      if(ins){
        todasPiscinas=todasPiscinas.filter(x=>x.id!==tempId); todasPiscinas.unshift(ins); lsPiscinaSalvar(todasPiscinas);
        if(_eqImportPiscinaEscolhida[clienteId]===tempId){ _eqImportPiscinaEscolhida[clienteId]=ins.id; renderEqImport(); }
      }
    }catch(e){ console.warn('[_eqImportPiscinaCriar]', e?.message||e); }
  }
}

async function importarEqDaVistoria(cliente){
  const cands=_eqCandidatos().filter(c=>!cliente || c.cliente===cliente);
  if(!cands.length){ toast('Nada a cadastrar'); return; }
  let n=0;
  for(const c of cands){
    // dados SEM id: equipamentos.id é uuid, gerado pelo banco. Mandar o id
    // texto local (eq_<ts>) no insert derruba a linha inteira (22P02) — era
    // o que fazia TODO import desta tela falhar em silêncio (confirmado:
    // 0 linhas em produção apesar da feature estar "no ar" há tempo).
    const piscinaId = c.cliente_id ? (_eqImportPiscinaEscolhida[c.cliente_id]||null) : null;
    const dados={
      cliente_nome:c.cliente, cliente_id:c.cliente_id||null, piscina_id:piscinaId,
      tipo:c.tipo, marca:c.marca, modelo:c.modelo, potencia:c.potencia,
      numero_serie:'', data_instalacao:null, garantia_meses:null, garantia_vencimento:null,
      // guarda de onde veio e o último laudo: é o que transforma a ficha em
      // gatilho comercial em vez de cadastro morto
      ambiente:c.ambiente||'', origem:'vistoria',
      obs:c.obs?('Último laudo: '+c.obs):'',
      foto_base64:c.foto||null, ativo:true, loja_id:c.loja_id||lojaAtiva||LOJA_PADRAO_ID,
      data_criacao:new Date().toISOString() };
    const tempId='eq_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    todosEq.unshift({...dados, id:tempId}); n++;
    if(dbOk&&db){
      try{
        const {data:ins}=await dbInsert('equipamentos', dados);
        if(ins){ todosEq=todosEq.filter(x=>x.id!==tempId); todosEq.unshift(ins); }
      }catch(e){ console.warn('[importarEq]', e?.message||e); }
    }
  }
  lsEqSalvar(todosEq);
  logAcao('base_instalada', `${n} equipamento(s) cadastrado(s) a partir de vistoria`);
  renderEqGrid(); renderEqImport();
  toast(`✅ ${n} equipamento${n!==1?'s':''} na base instalada`);
}

function lsEqLer(){ try{ return JSON.parse(ls('fluxa_equipamentos')||'[]'); }catch(e){ return []; } }
function lsEqSalvar(lista){ lsSet('fluxa_equipamentos', JSON.stringify(lista)); }

async function loadEquipamentos(){
  todosEq = lsEqLer();
  renderEqGrid(); verificarAlertasGarantia();
  if(dbOk&&db){
    try{
      let qEq=db.from('equipamentos').select('*').eq('ativo',true).order('data_criacao',{ascending:false});
      if(lojaAtiva) qEq=qEq.eq('loja_id',lojaAtiva);
      const {data,error}=await qEq;
      if(error) throw error;
      let remotoEq=data;
      const _tombEq=new Set(_tombLer('fluxa_eq_tombstones'));
      if(_tombEq.size){
        remotoEq.filter(r=>_tombEq.has(r.id)).forEach(r=>db.from('equipamentos').delete().eq('id',r.id).then(()=>{}).catch(()=>{}));
        remotoEq=remotoEq.filter(r=>!_tombEq.has(r.id));
      }
      // Preserva equipamentos presos só no aparelho (importados/cadastrados
      // offline, id eq_<ts> ainda não sincronizado) — mesmo padrão de
      // loadAgendamentos/loadDespesas.
      const idsEq=new Set(remotoEq.map(x=>x.id));
      const soLocalEq=todosEq.filter(x=>String(x.id).startsWith('eq_')&&!idsEq.has(x.id)&&_idadeIdMs(x.id)<DOIS_DIAS_MS);
      todosEq=[...remotoEq,...soLocalEq]; lsEqSalvar(todosEq); renderEqGrid(); verificarAlertasGarantia();
      for(const eq of soLocalEq){
        try{
          const {id:_velhoId,...eqSemId}=eq;
          const {data:ins}=await dbInsert('equipamentos', eqSemId);
          if(ins){ todosEq=todosEq.filter(x=>x.id!==eq.id); todosEq.unshift(ins); lsEqSalvar(todosEq); renderEqGrid(); }
        }catch(e){ console.warn('[reenvioEq]', e?.message||e); }
      }
    }catch(e){ console.warn('loadEquipamentos falhou:',e.message); }
  }
}

function buscarEq(v){ eqBusca=v.toLowerCase(); renderEqGrid(); }
function filtrarTipoEq(v){ eqFiltroTipo=v; renderEqGrid(); }

function renderEqGrid(){
  let lista=[...todosEq];
  lista=filtrarPorLoja(lista);
  if(eqFiltroTipo) lista=lista.filter(x=>x.tipo===eqFiltroTipo);
  if(eqBusca) lista=lista.filter(x=>(x.cliente_nome||'').toLowerCase().includes(eqBusca)||(x.marca||'').toLowerCase().includes(eqBusca)||(x.modelo||'').toLowerCase().includes(eqBusca)||(x.tipo||'').toLowerCase().includes(eqBusca));
  const el=document.getElementById('eq-grid');
  const count=document.getElementById('eq-count');
  if(count) count.textContent=lista.length+' equipamento'+(lista.length!==1?'s':'');
  if(!lista.length){ el.innerHTML='<div class="empty-st"><div class="ei">🔧</div><p>Nenhum equipamento encontrado.</p><button class="btn-primary" style="margin-top:12px" onclick="abrirFormEq()">＋ Cadastrar Equipamento</button></div>'; return; }
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  el.innerHTML='';
  lista.forEach(eq=>{
    let gClass='garantia-ok', gTxt='';
    if(eq.garantia_vencimento){
      const venc=new Date(eq.garantia_vencimento+'T12:00:00');
      const diff=Math.ceil((venc-hoje)/(1000*60*60*24));
      if(diff<0){ gClass='garantia-vencida'; gTxt='<span class="eq-alerta vencida">⚠️ Garantia vencida</span>'; }
      else if(diff<=30){ gClass='garantia-alerta'; gTxt=`<span class="eq-alerta">⚠️ Garantia vence em ${diff} dias</span>`; }
    }
    const card=document.createElement('div');
    card.className='eq-card '+gClass;
    card.innerHTML=`
      <div class="eq-tipo">${esc(eq.tipo||'')}</div>
      <div class="eq-nome">${esc(eq.marca||'')} ${esc(eq.modelo||'')}</div>
      <div class="eq-cli">👤 ${esc(eq.cliente_nome||'—')}</div>
      ${gTxt}
      <div class="eq-info">
        ${eq.potencia?`<div class="eq-inf"><span>Potência</span><strong>${esc(eq.potencia)}</strong></div>`:''}
        ${eq.numero_serie?`<div class="eq-inf"><span>Série</span><strong>${esc(eq.numero_serie)}</strong></div>`:''}
        ${eq.data_instalacao?`<div class="eq-inf"><span>Instalação</span><strong>${new Date(eq.data_instalacao+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>`:''}
        ${eq.garantia_vencimento?`<div class="eq-inf"><span>Garantia até</span><strong>${new Date(eq.garantia_vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>`:''}
      </div>
      <div class="eq-acts">
        <button class="tb" onclick="verQR('${eq.id}')">🔳 QR Code</button>
        <button class="tb" onclick="abrirFormEq('${eq.id}')">✎ Editar</button>
        <button class="tb" title="Notif. garantia" onclick='copiarNotif(notifGarantia(${JSON.stringify(eq)}))'>⚠️💬</button>
        <button class="tb d" onclick="excluirEq('${eq.id}')">🗑</button>
      </div>`;
    el.appendChild(card);
  });
}

function verificarAlertasGarantia(){
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const alertas=todosEq.filter(eq=>{
    if(!eq.garantia_vencimento) return false;
    const venc=new Date(eq.garantia_vencimento+'T12:00:00');
    return Math.ceil((venc-hoje)/(1000*60*60*24))<=30;
  });
  const el=document.getElementById('eq-alertas'); if(!el) return;
  if(!alertas.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div style="background:var(--yellow-bg);border:1px solid var(--yellow);border-radius:10px;padding:12px 16px;font-size:13px;color:var(--yellow);font-weight:600">
    ⚠️ ${alertas.length} equipamento${alertas.length!==1?'s':''} com garantia vencendo em breve: ${alertas.map(e=>esc(e.marca+' '+e.modelo)).join(', ')}
  </div>`;
}

// QR Code
let qrEqAtual = null;
function verQR(id){
  const eq=todosEq.find(x=>x.id===id); if(!eq) return;
  qrEqAtual=eq;
  const url=window.location.origin+window.location.pathname+'#eq/'+id;
  document.getElementById('qr-eq-nome').textContent=(eq.marca||'')+' '+(eq.modelo||'');
  document.getElementById('qr-eq-info').textContent=(eq.cliente_nome||'')+(eq.tipo?' — '+eq.tipo:'');
  document.getElementById('qr-img').src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url);
  document.getElementById('qr-modal-bg').classList.add('on');
}
function fecharQR(){ document.getElementById('qr-modal-bg').classList.remove('on'); qrEqAtual=null; }
function imprimirQR(){
  if(!qrEqAtual) return;
  const eq=qrEqAtual;
  const url=window.location.origin+window.location.pathname+'#eq/'+eq.id;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>QR Code — ${esc(eq.marca||'')} ${esc(eq.modelo||'')}</title>
  <style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f2f5}
  .box{background:white;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:300px}
  h2{font-size:18px;margin:0 0 4px}p{font-size:13px;color:#6b7280;margin:0 0 16px}
  img{width:200px;height:200px;border:1px solid #e5e7eb;border-radius:8px}
  small{display:block;font-size:10px;color:#9ca3af;margin-top:12px;word-break:break-all}</style></head>
  <body><div class="box"><h2>${esc(eq.marca||'')} ${esc(eq.modelo||'')}</h2><p>${esc(eq.cliente_nome||'')} — ${esc(eq.tipo||'')}</p>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}">
  <small>${url}</small></div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script></body></html>`);
  w.document.close();
}

// Leitura de QR Code ao abrir o app — redireciona para ficha do equipamento
function checkQRHash(){
  const hash=window.location.hash;
  if(hash.startsWith('#eq/')){
    const id=hash.replace('#eq/','');
    window.location.hash='';
    go('equipamentos');
    setTimeout(()=>{
      const eq=todosEq.find(x=>x.id===id);
      if(eq) abrirFormEq(id);
      else toast('⚠️ Equipamento não encontrado');
    },500);
  }
}

// ══════════════════════════════════════════════════
//  GESTÃO DE USUÁRIOS
// ══════════════════════════════════════════════════
async function loadUsuarios(){
  await carregarUsuarios();
  renderUsuarios();
}

function renderUsuarios(){
  const el=document.getElementById('usr-lista'); if(!el) return;
  // Aviso de PIN gestor legado só se não houver usuário master individual
  const temMaster=todosUsuarios.some(u=>u.perfil==='master'&&u.ativo!==false);
  const gestorHtml=temMaster?'':
    `<div class="usr-card" style="border:1.5px dashed var(--gray-mid);opacity:.7">
      <div class="usr-avatar gestor">G</div>
      <div class="usr-info">
        <div class="usr-nome">Gestor (legado)</div>
        <div class="usr-det">Compartilhado · PIN em Segurança</div>
      </div>
      <span class="usr-badge gestor">Gestor</span>
    </div>`;

  const perfilLabel={master:'Master',gestor:'Gestor',vendas:'Vendas',tecnico:'Técnico'};
  const perfilCor={master:'gestor',gestor:'gestor',vendas:'vendas',tecnico:'tecnico'};
  const perfilEmoji={master:'👑',gestor:'🛡️',vendas:'💼',tecnico:'🔧'};
  // Nome da empresa separada por grupo (p/ chips de acesso)
  const _nomeGrupoSep={}; gruposSeparados().forEach(g=>{ _nomeGrupoSep[g.grupo]=g.nome; });
  const tecsHtml=todosUsuarios.filter(u=>u.ativo!==false).map(u=>{
    const acessos=_acessosDoUsuario(u).filter(g=>_nomeGrupoSep[g]);
    const acessosHtml=acessos.map(g=>`<span class="usr-badge" style="background:#dcfce7;color:#16a34a;margin-left:4px" title="Acesso extra">🔓 ${esc(_nomeGrupoSep[g])}</span>`).join('');
    const lojaTxt=u.loja_nome?esc(u.loja_nome):(u.perfil==='master'||u.perfil==='gestor'?'Todas (grupo)':'—');
    return `
    <div class="usr-card">
      <div class="usr-avatar" style="${u.perfil==='vendas'?'background:#f59e0b':u.perfil==='master'?'background:#7c3aed':''}">${u.perfil==='master'?'👑':u.perfil==='vendas'?'💼':u.nome.charAt(0).toUpperCase()}</div>
      <div class="usr-info">
        <div class="usr-nome">${esc(u.nome)}</div>
        <div class="usr-det">🏢 ${lojaTxt} · PIN: ${u.pin?'✅ definido':'⚠️ não definido'}</div>
      </div>
      <span class="usr-badge ${perfilCor[u.perfil]||'tecnico'}">${perfilEmoji[u.perfil]||'🔧'} ${perfilLabel[u.perfil]||'Técnico'}</span>${acessosHtml}
      <div style="display:flex;gap:4px;margin-left:8px;flex-shrink:0">
        <button class="tb" onclick="editarUsuario('${u.id}')">✏️</button>
        <button class="tb d" onclick="excluirUsuario('${u.id}')">🗑</button>
      </div>
    </div>`; }).join('');

  const vazio=todosUsuarios.filter(u=>u.ativo!==false).length===0
    ?'<div class="empty-st" style="padding:20px 0"><div class="ei">👤</div><p>Nenhum técnico cadastrado.<br>Clique em "+ Novo Usuário" para adicionar.</p></div>':'';

  // Legenda: o que cada perfil enxerga (autoexplicativo p/ quem administra)
  const legenda=`<div style="margin-top:14px;padding:12px 14px;background:var(--gray-light,#f3f4f6);border-radius:10px;font-size:12px;line-height:1.7;color:var(--gray)">
    <div style="font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;margin-bottom:6px;color:var(--c2)">Níveis de acesso</div>
    ${['tecnico','vendas','gestor','master'].map(k=>{const p=PERFIL_INFO[k];return `<div>${p.emoji} <strong>${p.nome}:</strong> ${p.desc}</div>`;}).join('')}
    <div style="margin-top:6px">🔓 <strong>Acessos extras:</strong> empresas separadas (ex.: Aquamotor) que o usuário pode acessar além da empresa base — marque no ✏️ Editar.</div>
  </div>`;
  el.innerHTML=gestorHtml+tecsHtml+vazio+legenda;
}

let _usrEditId=null;
// Desenha os checkboxes de acessos extras (um por empresa separada, ex.: Aquamotor)
function _renderUsrAcessos(marcados){
  const row=document.getElementById('usr-acessos-row');
  const wrap=document.getElementById('usr-acessos-wrap');
  if(!row||!wrap) return;
  const grupos=gruposSeparados();
  if(!grupos.length){ row.style.display='none'; return; }
  row.style.display='';
  const sel=new Set(marcados||[]);
  wrap.innerHTML=grupos.map(g=>`
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--c2);cursor:pointer;text-transform:none;letter-spacing:0">
      <input type="checkbox" class="usr-acesso-chk" value="${esc(g.grupo)}" ${sel.has(g.grupo)?'checked':''} style="width:17px;height:17px;accent-color:var(--c1)">
      🔓 ${esc(g.nome)}
    </label>`).join('');
}
function _lerUsrAcessos(){
  return [...document.querySelectorAll('.usr-acesso-chk:checked')].map(c=>c.value);
}
function abrirFormUsuario(){
  _usrEditId=null;
  document.getElementById('usr-form-card').style.display='block';
  ['usr-nome','usr-pin'].forEach(id=>setV(id,''));
  setV('usr-perfil','tecnico');
  setV('usr-loja-id','');
  _renderUsrAcessos([]);
  updUsrForm();
  document.getElementById('usr-form-titulo').textContent='Novo Usuário';
  document.getElementById('usr-pin-label').textContent='PIN (4 dígitos)';
  document.getElementById('usr-form-card').scrollIntoView({behavior:'smooth'});
}
function editarUsuario(id){
  const u=todosUsuarios.find(x=>x.id===id); if(!u){ toast('Usuário não encontrado'); return; }
  _usrEditId=id;
  document.getElementById('usr-form-card').style.display='block';
  setV('usr-nome',u.nome||'');
  setV('usr-perfil',u.perfil||'tecnico');
  setV('usr-loja-id',u.loja_id||'');
  setV('usr-pin','');
  _renderUsrAcessos(_acessosDoUsuario(u));
  updUsrForm();
  document.getElementById('usr-form-titulo').textContent='Editar — '+(u.nome||'');
  document.getElementById('usr-pin-label').textContent='PIN (vazio = manter atual)';
  document.getElementById('usr-form-card').scrollIntoView({behavior:'smooth'});
}
function fecharFormUsuario(){ document.getElementById('usr-form-card').style.display='none'; _usrEditId=null; }

// O que cada perfil enxerga — mostrado sob o select de perfil (autoexplicativo
// p/ quem administra) e na legenda da lista. Manter em sincronia com
// aplicarPermissoesPerfil()/go() se as permissões mudarem.
const PERFIL_INFO={
  tecnico:{emoji:'🔧',nome:'Técnico',desc:'<strong>Vê:</strong> Minhas OS e Vistorias (executa no campo, com check-in/out e fotos). <strong>Não vê:</strong> valores financeiros, orçamentos, estoque, clientes, configurações.'},
  vendas:{emoji:'💼',nome:'Vendas',desc:'<strong>Vê:</strong> Orçamentos, Histórico, Clientes, Agenda e criação de OS. <strong>Não vê:</strong> painel financeiro, estoque, despesas, produtividade, usuários.'},
  gestor:{emoji:'🛡️',nome:'Gestor',desc:'<strong>Vê tudo da(s) sua(s) empresa(s):</strong> financeiro, estoque, despesas, produtividade, usuários e configurações. Com empresa definida, gerencia só ela; sem empresa, o grupo Fortemp todo.'},
  master:{emoji:'👑',nome:'Master',desc:'<strong>Acesso total:</strong> tudo do gestor + Auditoria (quem fez o quê) + promover/rebaixar usuários. Acima de todos os perfis.'}
};
function updUsrForm(){
  const hint=document.getElementById('usr-perfil-hint'); if(!hint) return;
  const p=PERFIL_INFO[gV('usr-perfil')||'tecnico'];
  hint.innerHTML=p?`${p.emoji} ${p.desc}`:'';
}

async function salvarUsuario(){
  const nome=gV('usr-nome').trim();
  if(!nome){ toast('⚠️ Informe o nome'); return; }
  const lojaId=gV('usr-loja-id')||null;
  const loja=getLoja(lojaId);
  const pinRaw=gV('usr-pin').trim();
  if(pinRaw&&(pinRaw.length!==4||!/^\d{4}$/.test(pinRaw))){ toast('⚠️ PIN deve ter exatamente 4 dígitos'); return; }
  const perfil=gV('usr-perfil')||'tecnico';
  if(!lojaId && perfil==='gestor'){ toast('⚠️ Gestor de empresa precisa de uma empresa (deixe vazio só p/ master/gestor geral)'); return; }
  const pinHash = pinRaw ? await hashPIN(pinRaw) : null;

  if(_usrEditId){
    // ── EDITAR (promover/rebaixar, renomear, trocar PIN) ──
    const i=todosUsuarios.findIndex(x=>x.id===_usrEditId); if(i<0){ toast('Usuário não encontrado'); return; }
    const antigo=todosUsuarios[i];
    const upd={ nome, perfil, loja_id:lojaId, loja_nome:loja?.nome||null, acessos:_lerUsrAcessos() };
    if(pinHash) upd.pin=pinHash; // só troca o PIN se foi informado
    todosUsuarios[i]={...antigo,...upd};
    lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
    if(dbOk&&db&&!String(_usrEditId).startsWith('usr_')&&!String(_usrEditId).startsWith('tec_')){
      try{ await dbUpdate('usuarios', upd, 'id', _usrEditId); }catch(e){ console.warn('[editUsr]',e?.message||e); }
    } else if(dbOk&&db){ // id local → tenta upsert pelo registro inteiro
      try{ await dbUpsert('usuarios', todosUsuarios[i]); }catch(e){ console.warn('[editUsr upsert]',e?.message||e); }
    }
    logAcao('usuario_editado', `${nome} → ${perfil}${antigo.perfil!==perfil?' (era '+antigo.perfil+')':''}`);
    fecharFormUsuario(); renderUsuarios(); renderLoginUsers();
    toast('✅ Usuário atualizado!'); return;
  }

  // ── NOVO ──
  const dados={ nome, perfil, loja_id:lojaId, loja_nome:loja?.nome||null, pin:pinHash, ativo:true, acessos:_lerUsrAcessos() };
  const tempId='usr_'+Date.now();
  const rec={...dados,id:tempId,data_criacao:new Date().toISOString()};
  todosUsuarios.push(rec);
  lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
  if(dbOk&&db){
    try{
      const {data:ins}=await dbInsert('usuarios', dados);
      if(ins){
        todosUsuarios=todosUsuarios.filter(x=>x.id!==tempId);
        todosUsuarios.push(ins);
        lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
      }
    }catch(e){ console.warn('salvarUsuario BD falhou:',e.message); }
  }
  logAcao('usuario_criado', `${nome} (${perfil})`);
  fecharFormUsuario();
  renderUsuarios(); renderLoginUsers();
  toast('✅ Usuário salvo!');
}

function excluirUsuario(id){
  confirmar('Desativar este usuário?', ()=>_excluirUsuarioConfirmado(id), 'Desativar Usuário');
}
async function _excluirUsuarioConfirmado(id){
  const alvo=todosUsuarios.find(x=>x.id===id);
  todosUsuarios=todosUsuarios.filter(x=>x.id!==id);
  lsSet('fluxa_usuarios',JSON.stringify(todosUsuarios));
  if(dbOk&&db){
    try{ await dbUpdate('usuarios', {ativo:false}, 'id', id); }catch(e){ console.warn('usr delete sync:',e.message); }
  }
  logAcao('usuario_removido', alvo?.nome||id);
  renderUsuarios(); renderLoginUsers();
  toast('🗑 Usuário removido');
}

// ══════════════════════════════════════════════════
//  MÓDULO 7 — NOTA FISCAL (Focus NFe)
// ══════════════════════════════════════════════════
let nfeOrcAtual = null; // orçamento sendo emitido
let nfeTipoAtual = 'nfse'; // 'nfse' | 'nfe'
let nfePollingTimer = null;

function abrirModalNFe(orcId){
  const o=todosOrc.find(x=>x.id===orcId); if(!o) return;
  nfeOrcAtual=o; nfeTipoAtual='nfse';

  // Preenche dados do orçamento
  document.getElementById('nfe-modal-sub').textContent=`Orçamento #${String(o.numero||0).padStart(3,'0')} — ${o.cliente||'—'}`;
  document.getElementById('nfe-cli').textContent=o.cliente||'—';
  document.getElementById('nfe-cnpj').textContent=o.cnpj||'Não informado';
  document.getElementById('nfe-total').textContent=brl(o.total||0);
  const svcsTexto=(o.servicos||[]).map(s=>s.desc).join(', ')||'—';
  document.getElementById('nfe-svcs').textContent=svcsTexto;

  // Preenche campos com configurações salvas
  const refAuto='ORC-'+new Date().getFullYear()+'-'+String(o.numero||0).padStart(4,'0')+'-'+Date.now().toString().slice(-4);
  setV('nfe-ref', refAuto);
  const token=CFG.nfe_token_prod||CFG.nfe_token_hom||'';
  setV('nfe-token-input', token);
  setV('nfe-ambiente', CFG.nfe_token_prod?'producao':'homologacao');
  setV('nfe-iss-aliq', CFG.nfe_iss||'2.0');
  setV('nfe-cod-servico', CFG.nfe_cod_svc||'7.10');
  setV('nfe-desc-servico', svcsTexto);

  // Verifica se já tem nota emitida
  document.getElementById('nfe-status-wrap').style.display='none';
  document.getElementById('nfe-btn-emitir').disabled=false;
  document.getElementById('nfe-btn-emitir').textContent='⚡ Emitir Nota Fiscal';
  verificarNFExistente(orcId);

  selecionarTipoNF('nfse');
  document.getElementById('nfe-modal-bg').classList.add('on');
}

function fecharModalNFe(){
  document.getElementById('nfe-modal-bg').classList.remove('on');
  if(nfePollingTimer){ clearInterval(nfePollingTimer); nfePollingTimer=null; }
  nfeOrcAtual=null;
}

function selecionarTipoNF(tipo){
  nfeTipoAtual=tipo;
  document.getElementById('nfe-tab-nfse').className='nfe-tab'+(tipo==='nfse'?' on':'');
  document.getElementById('nfe-tab-nfe').className='nfe-tab'+(tipo==='nfe'?' on':'');
  document.getElementById('nfe-nfse-fields').style.display=tipo==='nfse'?'block':'none';
  document.getElementById('nfe-nfe-fields').style.display=tipo==='nfe'?'block':'none';
}

async function verificarNFExistente(orcId){
  if(!dbOk||!db) return;
  try{
    const {data}=await db.from('notas_fiscais').select('*').eq('orcamento_id',orcId).order('data_criacao',{ascending:false}).limit(1);
    if(data&&data.length){
      const nf=data[0];
      mostrarStatusNF(nf.status, nf);
    }
  }catch(e){ console.warn('[verificarNFExistente]',e?.message||e); }
}

function mostrarStatusNF(status, nf){
  const wrap=document.getElementById('nfe-status-wrap');
  const badge=document.getElementById('nfe-status-badge');
  const msg=document.getElementById('nfe-status-msg');
  wrap.style.display='block';
  const mapa={autorizada:'✅ Nota Autorizada',pendente:'⏳ Processando…',rejeitada:'❌ Rejeitada',cancelada:'🚫 Cancelada',processando:'⏳ Processando…'};
  badge.className='nfe-status-badge '+(status||'pendente');
  badge.textContent=mapa[status]||status;
  if(nf?.numero) msg.textContent=`Número: ${nf.numero} · Série: ${nf.serie||'1'} · Ref: ${nf.referencia||'—'}`;
  if(nf?.motivo_rejeicao) msg.textContent+=' · '+nf.motivo_rejeicao;

  // Botões de download se autorizada
  const dlWrap=document.getElementById('nfe-download-wrap');
  if(dlWrap){
    if(status==='autorizada'&&nf){
      dlWrap.style.display='flex';
      dlWrap.innerHTML='';
      if(nf.pdf_danfe_base64) dlWrap.innerHTML+=`<a href="${esc(nf.pdf_danfe_base64)}" target="_blank" class="btn-primary" style="text-decoration:none;font-size:12px;padding:8px 14px">📄 PDF DANFE</a>`;
      if(nf.xml_autorizado) {
        const blob=new Blob([nf.xml_autorizado],{type:'text/xml'});
        const url=URL.createObjectURL(blob);
        dlWrap.innerHTML+=`<a href="${url}" download="nota_${nf.numero||'nf'}.xml" class="btn-sec" style="text-decoration:none;font-size:12px;padding:8px 14px">📋 XML</a>`;
      }
    } else { dlWrap.style.display='none'; }
  }

  if(status==='autorizada'||status==='rejeitada'||status==='cancelada'){
    document.getElementById('nfe-btn-emitir').disabled=true;
    document.getElementById('nfe-btn-emitir').textContent=status==='autorizada'?'✅ Já emitida':'Nota '+status;
  }
}

async function emitirNota(){
  if(!nfeOrcAtual){ toast('⚠️ Nenhum orçamento selecionado'); return; }
  const token=gV('nfe-token-input').trim();
  if(!token){ toast('⚠️ Configure o token Focus NFe (Empresa → Nota Fiscal)'); return; }
  const ref=gV('nfe-ref');
  const ambiente=gV('nfe-ambiente');
  const btn=document.getElementById('nfe-btn-emitir');
  btn.disabled=true; btn.textContent='⏳ Emitindo…';
  document.getElementById('nfe-status-wrap').style.display='block';
  mostrarStatusNF('processando',null);

  const o=nfeOrcAtual;
  const baseUrl=ambiente==='producao'
    ?'https://api.focusnfe.com.br'
    :'https://homologacao.focusnfe.com.br';
  const auth='Basic '+btoa(token+':');

  try{
    let payload, endpoint;
    if(nfeTipoAtual==='nfse'){
      endpoint='/v2/nfsen?ref='+encodeURIComponent(ref);
      payload={
        data_emissao: new Date().toISOString().split('T')[0],
        prestador_codigo_municipio:'4208450', // Itapema padrão; muda via loja futuramente
        tomador_cpf_cnpj: (o.cnpj||'').replace(/\D/g,'') || '00000000000',
        tomador_razao_social: o.cliente||'Cliente',
        tomador_email:'',
        servico_valor_servicos: o.total||0,
        servico_iss_retido: false,
        servico_aliquota: parseFloat(gV('nfe-iss-aliq'))||2.0,
        servico_discriminacao: gV('nfe-desc-servico')||'Serviços de manutenção',
        servico_codigo_cnae:'4322302',
        servico_item_lista_servico: gV('nfe-cod-servico')||'7.10'
      };
    } else {
      endpoint='/v2/nfe?ref='+encodeURIComponent(ref);
      payload={
        natureza_operacao:'Venda de mercadoria',
        data_emissao: new Date().toISOString(),
        tipo_documento:'1',
        finalidade_emissao:'1',
        consumidor_final:'1',
        presenca_comprador:'1',
        cliente:{
          cpf_cnpj:(o.cnpj||'').replace(/\D/g,'')||'00000000000',
          nome:o.cliente||'Consumidor',
          logradouro:o.local_servico||'',
          numero:'S/N', municipio:'Itapema', uf:'SC', cep:'88220000', pais:'1058'
        },
        itens:[{
          numero:'1', codigo:'001', descricao:(o.servicos||[]).map(s=>s.desc).join(', ')||'Serviço',
          ncm:gV('nfe-ncm')||'84218900', cfop:gV('nfe-cfop')||'5102',
          unidade_comercial:'SV', quantidade_comercial:'1',
          valor_unitario_comercial:o.total||0, valor_total_bruto:o.total||0,
          inclui_no_total:'1', icms_situacao_tributaria:'400', pis_situacao_tributaria:'07',
          cofins_situacao_tributaria:'07'
        }],
        forma_pagamento:[{forma_pagamento:'01',valor:o.total||0}]
      };
    }

    // Salva no banco antes de enviar (status processando)
    let nfId=null;
    if(dbOk&&db){
      try{
        const {data:nfRec}=await dbInsert('notas_fiscais', {
          orcamento_id:o.id, tipo:nfeTipoAtual, referencia:ref,
          status:'pendente', dados_envio:payload
        }, 'id');
        if(nfRec) nfId=nfRec.id;
      }catch(e){ console.warn('[emitirNota] falha ao registrar NF pendente:', e?.message||e); }
    }

    // Chama a API Focus NFe
    const resp=await fetch(baseUrl+endpoint,{
      method:'POST',
      headers:{'Authorization':auth,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const result=await resp.json();

    if(resp.status===201||resp.status===200){
      // Síncrono: nota já autorizada
      // pdf_danfe_base64 é o nome real da coluna (guarda uma URL, apesar do
      // nome — legado); pdf_danfe_url nunca existiu no banco e a atualização
      // vinha sendo rejeitada em silêncio (.catch(()=>{}) logo abaixo).
      const nfAtualizada={status:'autorizada',numero:result.numero,serie:result.serie,chave_acesso:result.chave_acesso,pdf_danfe_base64:result.caminho_danfe,xml_autorizado:result.caminho_xml_nota_fiscal,protocolo:result.protocolo_autorizacao};
      if(dbOk&&db&&nfId) dbUpdate('notas_fiscais', nfAtualizada, 'id', nfId).then(()=>{}).catch(()=>{});
      mostrarStatusNF('autorizada',{...nfAtualizada,referencia:ref});
      toast('✅ Nota Fiscal emitida com sucesso!');
    } else if(resp.status===202){
      // Assíncrono: aguardando processamento, iniciar polling
      toast('⏳ Nota em processamento, aguardando autorização…');
      iniciarPollingNF(baseUrl, auth, ref, nfId);
    } else {
      const erroMsg=result.mensagem||result.erros?.[0]?.mensagem||JSON.stringify(result);
      if(dbOk&&db&&nfId) dbUpdate('notas_fiscais', {status:'rejeitada',motivo_rejeicao:erroMsg}, 'id', nfId).then(()=>{}).catch(()=>{});
      mostrarStatusNF('rejeitada',{motivo_rejeicao:erroMsg,referencia:ref});
      btn.disabled=false; btn.textContent='⚡ Tentar novamente';
      toast('❌ Nota rejeitada: '+erroMsg);
    }
  }catch(e){
    console.error('emitirNota erro:',e);
    toast('❌ Erro ao emitir: '+e.message);
    document.getElementById('nfe-status-badge').textContent='❌ Erro de conexão';
    btn.disabled=false; btn.textContent='⚡ Tentar novamente';
  }
}

function iniciarPollingNF(baseUrl, auth, ref, nfId){
  let tentativas=0;
  nfePollingTimer=setInterval(async()=>{
    tentativas++;
    if(tentativas>20){ clearInterval(nfePollingTimer); nfePollingTimer=null; return; }
    try{
      const endpointConsulta=nfeTipoAtual==='nfse'?'/v2/nfse/':'/v2/nfe/';
      const resp=await fetch(baseUrl+endpointConsulta+encodeURIComponent(ref),{headers:{'Authorization':auth}});
      const r=await resp.json();
      if(r.status==='autorizada'){
        clearInterval(nfePollingTimer); nfePollingTimer=null;
        const nfAtualizada={status:'autorizada',numero:r.numero,serie:r.serie,chave_acesso:r.chave_acesso,pdf_danfe_base64:r.caminho_danfe,xml_autorizado:r.caminho_xml_nota_fiscal,protocolo:r.protocolo_autorizacao};
        if(dbOk&&db&&nfId) dbUpdate('notas_fiscais', nfAtualizada, 'id', nfId).then(()=>{}).catch(()=>{});
        mostrarStatusNF('autorizada',{...nfAtualizada,referencia:ref});
        toast('✅ Nota Fiscal autorizada!');
      } else if(r.status==='rejeitada'||r.status==='cancelada'){
        clearInterval(nfePollingTimer); nfePollingTimer=null;
        const erroMsg=r.mensagem_sefaz||r.status;
        if(dbOk&&db&&nfId) dbUpdate('notas_fiscais', {status:r.status,motivo_rejeicao:erroMsg}, 'id', nfId).then(()=>{}).catch(()=>{});
        mostrarStatusNF(r.status,{motivo_rejeicao:erroMsg,referencia:ref});
        toast('❌ Nota '+r.status+': '+erroMsg);
        const btn=document.getElementById('nfe-btn-emitir'); if(btn){btn.disabled=false;btn.textContent='⚡ Tentar novamente';}
      }
    }catch(e){ console.warn('polling NF erro:',e.message); }
  },5000); // verifica a cada 5s
}

// ══════════════════════════════════════════════════
//  VISTORIAS DE MANUTENÇÃO
// ══════════════════════════════════════════════════

const VIS_EQUIPAMENTOS_DEFAULT = [
  { id:'motobomba',     nome:'Motobomba Principal',      emoji:'⚙️'  },
  { id:'mot-aux',       nome:'Motobomba Auxiliar',        emoji:'⚙️'  },
  { id:'filtro',        nome:'Filtro',                    emoji:'🔵'  },
  { id:'bomba-calor',   nome:'Bomba de Calor',            emoji:'🌡️'  },
  { id:'ger-cloro',     nome:'Gerador de Cloro',          emoji:'⚗️'  },
  { id:'ger-ozonio',    nome:'Gerador de Ozônio',         emoji:'🫧'  },
  { id:'iluminacao',    nome:'Iluminação Subaquática',    emoji:'💡'  },
  { id:'spa',           nome:'Spa',                       emoji:'🛁'  },
  { id:'sauna',         nome:'Sauna',                     emoji:'🧖'  },
];

// Estado atual da vistoria em edição
let visEquipSelecionados = []; // ids dos equipamentos ativos
let visEquipDados = {};        // { id: { status, obs, fotos:[] } }
let _visEquipAbertos = new Set(); // ids dos painéis expandidos — preservado entre re-renders
let visAmbienteObs = {};       // { "Nome do ambiente": "observação geral do ambiente" }
                               // p/ problemas que não são de um equipamento (ex.: vazamento na tubulação)
function visUpdAmbObs(amb, val){
  const k=(amb||'').trim(); if(!k) return;
  if(val && val.trim()) visAmbienteObs[k]=val; else delete visAmbienteObs[k];
  _salvarRascunhoVisDeb();
}
// Monta um rascunho das prioridades a partir dos itens críticos/atenção e das
// observações de ambiente — o técnico só refina. Não substitui o que já digitou.
function visPuxarPrioridades(){
  const nomeDe=(id)=>{ const c=(_visEquipsCustom||[]).find(e=>e.id===id); if(c) return c.nome; const d=(typeof VIS_EQUIPAMENTOS_DEFAULT!=='undefined'?VIS_EQUIPAMENTOS_DEFAULT:[]).find(x=>x.id===id); return d?d.nome:id; };
  const naVistoria=(id)=>(_visEquipsCustom||[]).some(e=>e.id===id)||visEquipSelecionados.includes(id);
  const linhas=[];
  ['critico','atencao'].forEach(st=>{
    Object.keys(visEquipDados||{}).forEach(id=>{
      const d=visEquipDados[id]; if(!d||d.status!==st||!naVistoria(id)) return;
      linhas.push(`${st==='critico'?'🔴':'⚠️'} ${nomeDe(id)}${d.obs?': '+d.obs.trim():''}`);
    });
  });
  Object.keys(visAmbienteObs||{}).forEach(amb=>{ if((visAmbienteObs[amb]||'').trim()) linhas.push(`📍 ${amb}: ${visAmbienteObs[amb].trim()}`); });
  if(!linhas.length){ toast('Nenhum item crítico/atenção nem observação de ambiente para puxar'); return; }
  const ta=document.getElementById('vis-recom'); if(!ta) return;
  const atual=(ta.value||'').trim();
  ta.value=(atual?atual+'\n':'')+linhas.join('\n');
  _salvarRascunhoVisDeb();
  toast(`↧ ${linhas.length} item(ns) puxado(s) — ajuste as prioridades`);
}
let visCheckinTime = null;
let visCheckoutTime = null;
let visCheckinInterval = null;
let visEditId = null;          // id da vistoria sendo editada (null = nova)
let _visDraftId = null;        // id da vistoria atual em edição no form (compartilhado entre Salvar e Gerar PDF, evita duplicata)
let visHistStatusFilt = '';    // filtro de status no histórico: ''|'critico'|'atencao'

// Promise com timeout — evita que uma chamada de rede travada (Supabase/EmailJS)
// deixe a UI pendurada para sempre. Rejeita após `ms` se não resolver.
function _comTimeout(promise, ms, rotulo){
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout '+(rotulo||'')+' ('+ms+'ms)')), ms))
  ]);
}

const LS_VIS = 'fluxa_visitas';
const LS_LOCAIS_VIS = 'fluxa_locais_vistoria';
let locaisVistoria = [];
let locaisVisMesRef = '';  // currently viewed month in locais tab, e.g. '2026-05'
// Cache em memória: evita re-parsear o JSON (que pode ter dezenas de vistorias
// com fotos) a cada render. Invalidado sempre que lsVisSalvar grava.
let _visCache=null;
function lsVisLer(){
  if(_visCache) return _visCache;
  try{ _visCache=JSON.parse(localStorage.getItem(LS_VIS)||'[]'); }catch(e){ _visCache=[]; }
  return _visCache;
}
function lsVisSalvar(lista){
  _visCache=Array.isArray(lista)?lista:null; // mantém o cache coerente com o que foi gravado
  try{
    localStorage.setItem(LS_VIS, JSON.stringify(lista));
  }catch(e){
    if(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||(e.message||'').includes('quota')){
      // tenta salvar sem fotos para não perder os dados da vistoria
      try{
        const semFotos = lista.map(v=>({
          ...v,
          equipamentos:(v.equipamentos||[]).map(eq=>({...eq,fotos:[]}))
        }));
        localStorage.setItem(LS_VIS, JSON.stringify(semFotos));
        toast('⚠️ Armazenamento cheio — vistoria salva sem fotos. As fotos ficam na nuvem.');
      }catch(e2){
        console.warn('[lsVisSalvar] localStorage cheio mesmo sem fotos:', e2?.message||e2);
        toast('⚠️ Armazenamento do celular cheio. Libere espaço e tente novamente.');
      }
    }else{ throw e; }
  }
}

// ══ ESCOPO DE EMPRESA (vistorias/locais) ══
// Fonte única de verdade para "este local/vistoria pertence à empresa em foco?".
// Usado por renderLocaisTab E renderVisHistorico para nunca divergirem.
function _normLojaId(lid){ return (!lid||lid==='default')?LOJA_PADRAO_ID:lid; }
function _grupoDaLoja(lid){ const L=LOJAS.find(x=>x.id===_normLojaId(lid)); return L?L.grupo:'forthemp'; }
// Empresa atualmente em foco: técnico → grupo escolhido no login; gestor sem
// loja → grupo forthemp (Aquamotor não mistura); gestor em loja específica → aquela loja.
function _empresaEmFoco(){
  const s=getSessao();
  if(s?.perfil==='tecnico'){
    const emp=visEmpresaTecnico||s?.empresa_tec||sessionStorage.getItem('fluxa_vis_empresa_tec')||'forthemp';
    return {tipo:'grupo', valor:emp};
  }
  if(!lojaAtiva) return {tipo:'grupo', valor:'forthemp'};
  return {tipo:'loja', valor:lojaAtiva};
}
// true se a loja_id (de um local ou vistoria) está dentro da empresa em foco
function escopoEmpresaMatch(lojaId){
  const lid=_normLojaId(lojaId);
  const f=_empresaEmFoco();
  return f.tipo==='grupo' ? _grupoDaLoja(lid)===f.valor : lid===f.valor;
}

/* ══ LOCAIS RECORRENTES ══ */
function loadLocais(){
  // Lê localStorage
  let local=[];
  try{ local=JSON.parse(localStorage.getItem(LS_LOCAIS_VIS)||'[]'); }catch(e){ console.warn('[loadLocais]',e); }
  // Merge com dados do Supabase (vindos via CFG.locais_vistoria)
  const remoto=CFG?.locais_vistoria||[];
  if(remoto.length){
    const merged=[...remoto];
    local.forEach(l=>{ if(!merged.find(r=>r.id===l.id)) merged.push(l); });
    locaisVistoria=merged;
  } else {
    locaisVistoria=local;
  }
  // Deduplicar por ID E por cliente+local (ambas as chaves devem ser únicas).
  // Mantém o primeiro registro encontrado para cada combinação.
  const _vistosId=new Set(); const _vistosNome=new Set();
  locaisVistoria=locaisVistoria.filter(l=>{
    const kId=l.id||''; const kNome=((l.cliente||'').trim()+'|'+(l.local||'').trim()).toLowerCase();
    if(kId && _vistosId.has(kId)) return false;
    if(kNome && _vistosNome.has(kNome)) return false;
    if(kId) _vistosId.add(kId);
    if(kNome) _vistosNome.add(kNome);
    return true;
  });
  lsSet(LS_LOCAIS_VIS, JSON.stringify(locaisVistoria));
}
// null = ainda não sabemos se a tabela dedicada existe; true/false após 1ª tentativa.
let _locaisTabelaOk=null;
function _tabelaAusente(msg){ return /relation .* does not exist|could not find the table|schema cache|does not exist/i.test(msg||''); }

async function saveLocais(){
  lsSet(LS_LOCAIS_VIS, JSON.stringify(locaisVistoria));
  CFG.locais_vistoria=locaisVistoria;
  lsSet('empresa_cfg', JSON.stringify(CFG));
  if(!dbOk||!db) return;
  // ── Caminho primário: tabela dedicada locais_vistoria (1 linha por local) ──
  // Sem clobber entre empresas — Tamara e Elisa salvam linhas independentes.
  if(_locaisTabelaOk!==false){
    try{
      let okTabela=true;
      for(const l of locaisVistoria){
        const r=await dbUpsert('locais_vistoria', {...l, updated_at:new Date().toISOString()});
        if(r&&r.error){
          if(_tabelaAusente(r.error.message)){ _locaisTabelaOk=false; okTabela=false; break; }
          console.warn('[saveLocais:tabela]', r.error.message);
        } else { delete l._pendingSync; } // sincronizou com sucesso
      }
      if(okTabela){ _locaisTabelaOk=true; return; }
    }catch(e){ console.warn('[saveLocais:tabela]', e?.message||e); }
  }
  // ── Fallback legado: empresa_config com READ-MERGE-WRITE (corrige concorrência) ──
  await _saveLocaisLegado();
}

// Grava locais no empresa_config sem sobrescrever o que outro device salvou:
// lê o remoto, mescla por id (versão deste device prevalece) e regrava.
async function _saveLocaisLegado(){
  try{
    const {data}=await db.from('empresa_config').select('dados').eq('id',1).single();
    const dados=(data&&data.dados)?data.dados:CFG;
    const mapa=new Map((dados.locais_vistoria||[]).map(l=>[l.id,l]));
    locaisVistoria.forEach(l=>mapa.set(l.id,l));
    dados.locais_vistoria=[...mapa.values()];
    await dbUpsert('empresa_config', {id:1, dados, updated_at:new Date().toISOString()});
  }catch(e){ console.warn('saveLocais legado sync falhou:', e?.message||e); }
}

// Carrega locais da tabela dedicada (fonte de verdade quando existe). Reenvia ao
// banco os locais presos só no aparelho (migra automaticamente do modo legado).
async function loadLocaisRemoto(){
  if(!dbOk||!db) return;
  try{
    const {data,error}=await db.from('locais_vistoria').select('*');
    if(error){
      if(_tabelaAusente(error.message)) _locaisTabelaOk=false;
      console.warn('[loadLocaisRemoto]', error.message); return;
    }
    _locaisTabelaOk=true;
    let remoto=(data||[]).map(r=>({...r, equipamentos: typeof r.equipamentos==='string'?JSON.parse(r.equipamentos||'[]'):(r.equipamentos||[])}));
    // Respeita tombstones: planos apagados não voltam. Se ainda estiverem na
    // tabela (delete anterior falhou), tenta apagar de novo.
    const _tomb=new Set(_locTombLer());
    if(_tomb.size){
      remoto.filter(r=>_tomb.has(r.id)).forEach(r=>{ try{ db.from('locais_vistoria').delete().eq('id',r.id).then(()=>{}).catch(()=>{}); }catch(e){ console.warn('[locTomb]',e?.message||e); } });
      remoto=remoto.filter(r=>!_tomb.has(r.id));
    }
    let local=[]; try{ local=JSON.parse(localStorage.getItem(LS_LOCAIS_VIS)||'[]'); }catch(e){ console.warn('[loadLocaisRemoto:ls]', e?.message||e); }
    const remotoIds=new Set(remoto.map(r=>r.id));
    // A TABELA é a fonte da verdade. Um plano que está só no aparelho e NÃO está
    // no banco só é mantido/reenviado se foi criado offline e ainda não sincronizou
    // (_pendingSync). Planos locais que sumiram do banco (apagados em qualquer
    // dispositivo) são DESCARTADOS — é isso que impede planos apagados de "voltarem".
    const soLocalPend=local.filter(l=>!remotoIds.has(l.id) && !_tomb.has(l.id) && l._pendingSync===true);
    for(const l of soLocalPend){
      try{ const r=await dbUpsert('locais_vistoria', {...l, updated_at:new Date().toISOString()}); if(r&&r.error){ if(_tabelaAusente(r.error.message)){ _locaisTabelaOk=false; return; } } else { delete l._pendingSync; } }
      catch(e){ console.warn('[loadLocaisRemoto:migra]', e?.message||e); }
    }
    locaisVistoria=[...remoto, ...soLocalPend];
    lsSet(LS_LOCAIS_VIS, JSON.stringify(locaisVistoria));
    CFG.locais_vistoria=locaisVistoria;
    if(document.getElementById('vis-view-locais')?.style.display!=='none') renderLocaisTab();
  }catch(e){ console.warn('[loadLocaisRemoto]', e?.message||e); }
}

// ── LOCAIS: formulário de plano ──────────────────────────────────────────────
function abrirLocForm(id){
  const f=document.getElementById('loc-add-form');
  f.style.display='';
  // técnico select
  const sel=document.getElementById('loc-tec');
  sel.innerHTML='<option value="">Qualquer técnico</option>';
  const tecList=(typeof CFG!=='undefined'&&CFG.tecnicos)?CFG.tecnicos:[];
  tecList.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); });
  // seletor de unidade — visível quando gestor está em "Todas" e há múltiplas unidades no grupo
  const lojaRow=document.getElementById('loc-loja-row');
  const lojaSel=document.getElementById('loc-loja');
  const _unidades=LOJAS.filter(l=>l.grupo===(_grupoDaLoja(lojaAtiva)||'forthemp'));
  if(lojaRow&&lojaSel&&!lojaAtiva&&_unidades.length>1){
    lojaSel.innerHTML=_unidades.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
    lojaRow.style.display='';
  } else if(lojaRow){ lojaRow.style.display='none'; }
  // dia de preferência select (1-28)
  const diaSel=document.getElementById('loc-dia-pref');
  if(diaSel){ diaSel.innerHTML='<option value="">Qualquer dia</option>'; for(let i=1;i<=28;i++){ const o=document.createElement('option'); o.value=i; o.textContent='Dia '+i; diaSel.appendChild(o); } }
  // reset campos
  document.getElementById('loc-edit-id').value='';
  document.getElementById('loc-cli').value='';
  document.getElementById('loc-end').value='';
  document.getElementById('loc-email').value='';
  sel.value='';
  if(diaSel) diaSel.value='';
  const horaPref=document.getElementById('loc-hora-pref'); if(horaPref) horaPref.value='08:00';
  _locEquipCustom=[];
  renderLocEquipList();
  if(id){
    const loc=locaisVistoria.find(x=>x.id===id);
    if(loc){
      document.getElementById('loc-edit-id').value=id;
      document.getElementById('loc-cli').value=loc.cliente||'';
      document.getElementById('loc-end').value=loc.local||'';
      document.getElementById('loc-email').value=loc.email_responsavel||'';
      sel.value=loc.tecnico||'';
      if(diaSel) diaSel.value=loc.dia_pref||'';
      if(horaPref) horaPref.value=loc.hora_pref||'08:00';
      if(lojaSel&&loc.loja_id) lojaSel.value=loc.loja_id;
      _locEquipCustom=normalizeLocEquips(loc.equipamentos||[]);
      renderLocEquipList();
    }
  }
  f.scrollIntoView({behavior:'smooth',block:'start'});
}
function fecharLocForm(){
  document.getElementById('loc-add-form').style.display='none';
  _locEquipCustom=[];
}

// Converte formato antigo (array de IDs string) para novo formato (array de objetos)
// ID de equipamento SEMPRE único — Date.now() sozinho colide em cliques rápidos
// (dois equipamentos com o mesmo id viravam um só na vistoria). Contador + random.
let _eqIdSeq=0;
function _novoEquipId(){ return 'eq_'+Date.now().toString(36)+'_'+(_eqIdSeq++).toString(36)+Math.random().toString(36).slice(2,6); }
function normalizeLocEquips(equips){
  if(!equips||!equips.length) return [];
  let list;
  if(typeof equips[0]==='string'){
    list=equips.map(id=>{ const def=VIS_EQUIPAMENTOS_DEFAULT.find(e=>e.id===id)||{nome:id,emoji:'⚙️'}; return {id:_novoEquipId(),nome:def.nome,marca:'',modelo:'',potencia:'',serie:'',ficha:'',ambiente:''}; });
  } else {
    list=equips.map(e=>({id:e.id||_novoEquipId(),nome:e.nome||'',marca:e.marca||'',modelo:e.modelo||'',potencia:e.potencia||'',serie:e.serie||'',ficha:e.ficha||'',ambiente:e.ambiente||''}));
  }
  // Cura ids duplicados (planos salvos antes do fix): reatribui id único
  const vistos=new Set();
  list.forEach(e=>{ if(vistos.has(e.id)) e.id=_novoEquipId(); vistos.add(e.id); });
  return list;
}

let _locEquipCustom=[]; // [{id, nome, marca, modelo, potencia, serie, ficha, ambiente}]

function adicionarLocEquip(ambiente){
  // Convêniência: se não veio ambiente explícito, herda do último item cadastrado
  const amb=ambiente!==undefined?ambiente:(_locEquipCustom[_locEquipCustom.length-1]?.ambiente||'');
  _locEquipCustom.push({id:_novoEquipId(),nome:'',marca:'',modelo:'',potencia:'',serie:'',ficha:'',ambiente:amb});
  renderLocEquipList();
  // foco no primeiro campo do novo item
  setTimeout(()=>{
    const rows=document.querySelectorAll('.loc-eq-row');
    if(rows.length){ const inp=rows[rows.length-1].querySelector('input'); if(inp) inp.focus(); }
  },60);
}

function removerLocEquip(idx){
  _locEquipCustom.splice(idx,1);
  renderLocEquipList();
}

function renderLocEquipList(){
  const c=document.getElementById('loc-equip-list'); if(!c) return;
  if(!_locEquipCustom.length){
    c.innerHTML=`<div style="font-size:12px;color:var(--gray);padding:8px 0">Nenhum equipamento cadastrado. Clique em "＋ Adicionar" para cadastrar.</div>`;
    return;
  }
  // Agrupa por ambiente (mantém a ordem de primeira aparição); itens sem
  // ambiente caem num grupo "Sem ambiente definido" ao final.
  const grupos=[]; // [{nome, idxs:[i,...]}]
  _locEquipCustom.forEach((eq,i)=>{
    const nomeAmb=(eq.ambiente||'').trim();
    let g=grupos.find(gr=>gr.nome===nomeAmb);
    if(!g){ g={nome:nomeAmb, idxs:[]}; grupos.push(g); }
    g.idxs.push(i);
  });
  grupos.sort((a,b)=> (a.nome===''?1:0)-(b.nome===''?1:0));

  const cardHtml=(eq,i)=>`
    <div class="loc-eq-card" style="border:1.5px solid var(--gray-mid);border-radius:10px;padding:10px 12px;margin-bottom:10px;background:var(--white)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:800;color:var(--c1);background:var(--c1-light);border-radius:50px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
        <strong style="flex:1;font-size:13px;color:var(--c2)">${esc(eq.nome)||'Novo equipamento'}</strong>
        <button class="loc-eq-del" onclick="removerLocEquip(${i})" title="Remover" style="flex-shrink:0">🗑</button>
      </div>
      <div class="loc-eq-row">
        <div><label>Ambiente / Local *</label><input type="text" value="${esc(eq.ambiente||'')}" oninput="_locEquipCustom[${i}].ambiente=this.value" onchange="renderLocEquipList()" placeholder="Ex: Casa de máquinas, Cobertura…" list="loc-amb-list"></div>
        <div><label>Tipo / Nome *</label><input type="text" value="${esc(eq.nome)}" oninput="_locEquipCustom[${i}].nome=this.value;_locEquipCardTitulo(${i},this.value)" placeholder="Ex: Motobomba, Filtro, Aquecedor…"></div>
        <div><label>Marca</label><input type="text" value="${esc(eq.marca||'')}" oninput="_locEquipCustom[${i}].marca=this.value" placeholder="Ex: Dancor, Jacuzzi"></div>
        <div><label>Modelo</label><input type="text" value="${esc(eq.modelo)}" oninput="_locEquipCustom[${i}].modelo=this.value" placeholder="Ex: KOM 15"></div>
        <div><label>Potência / Cap.</label><input type="text" value="${esc(eq.potencia)}" oninput="_locEquipCustom[${i}].potencia=this.value" placeholder="Ex: 1.5 CV"></div>
      </div>
      <div style="margin-top:8px">
        <label style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px">📋 Ficha / histórico do equipamento <span style="font-weight:400;text-transform:none;letter-spacing:0">(fica salvo e aparece na vistoria)</span></label>
        <textarea rows="2" oninput="_locEquipCustom[${i}].ficha=this.value" placeholder="Ex: Última manutenção 03/2026 · Última troca de areia 01/2026 · Nº série 12345 · particularidades…" style="width:100%;margin-top:4px;padding:8px 10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;resize:vertical;outline:none">${esc(eq.ficha||'')}</textarea>
      </div>
    </div>
  `;

  const ambList=[...new Set(_locEquipCustom.map(e=>(e.ambiente||'').trim()).filter(Boolean))];

  c.innerHTML=`<datalist id="loc-amb-list">${ambList.map(a=>`<option value="${esc(a)}">`).join('')}</datalist>`
    + grupos.map(g=>`
      <div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:12px;font-weight:800;color:var(--c1);text-transform:uppercase;letter-spacing:.5px">📍 ${esc(g.nome)||'Sem ambiente definido'}</span>
          <span style="font-size:11px;color:var(--gray)">(${g.idxs.length})</span>
        </div>
        ${g.idxs.map(i=>cardHtml(_locEquipCustom[i],i)).join('')}
        <button type="button" class="tb" onclick="adicionarLocEquip('${esc(g.nome).replace(/'/g,"\\'")}')" style="font-size:12px">＋ Adicionar equipamento em "${esc(g.nome)||'Sem ambiente definido'}"</button>
      </div>
    `).join('');
}
// Atualiza só o título do card ao digitar o nome (sem re-renderizar tudo/perder foco)
function _locEquipCardTitulo(i, val){
  const cards=document.querySelectorAll('#loc-equip-list .loc-eq-card');
  const strong=cards[i]?.querySelector('strong');
  if(strong) strong.textContent=(val||'').trim()||'Novo equipamento';
}

// ── CONCLUIR VISITA — equipamentos no modal ──────────────────────────────────
let _cvEquipData={}; // {idx: {status, obs, fotos:[]}}




// Cria ou atualiza o agendamento mensal vinculado ao plano de acompanhamento
async function criarOuAtualizarAgendamentoPlano(rec, isEdit){
  const hoje=new Date().toISOString().split('T')[0];
  const agDados={
    cliente: rec.cliente,
    local_servico: rec.local,
    tecnico: rec.tecnico||'',
    tipo_servico: 'Vistoria de Manutenção',
    periodicidade: 'mensal',
    dia_semana: parseInt(rec.dia_pref)||null, // sem dia escolhido → não agenda no calendário
    horario: rec.hora_pref||'08:00',
    data_inicio: hoje,
    data_fim: null,
    obs: 'Plano de acompanhamento mensal',
    ativo: true,
    loja_id: rec.loja_id||lojaAtiva||LOJA_PADRAO_ID,
    local_id: rec.id
  };
  if(isEdit && rec.agendamento_id){
    // Atualiza agendamento existente
    const agIdx=todosAg.findIndex(a=>a.id===rec.agendamento_id);
    if(agIdx>=0){ todosAg[agIdx]={...todosAg[agIdx],...agDados}; lsAgSalvar(todosAg); }
    if(dbOk&&db){
      try{ const r=await dbUpdate('agendamentos', agDados, 'id', rec.agendamento_id); if(r.error) console.warn('[atualizarAgPlano]', r.error.message); }
      catch(e){ console.warn('[atualizarAgPlano]',e?.message||e); }
    }
    // Reagenda o calendário conforme o dia escolhido (ou remove se ficou sem dia)
    await _reagendarOSdoPlano({...agDados,id:rec.agendamento_id}, rec.agendamento_id);
    return rec.agendamento_id;
  } else {
    // Cria novo agendamento
    const agId='ag_plano_'+Date.now();
    const agRec={...agDados,id:agId,data_criacao:new Date().toISOString()};
    todosAg.unshift(agRec);
    lsAgSalvar(todosAg);
    // Gera OS dos próximos 6 meses no calendário
    await gerarOSdoAgendamento(agRec,agId);
    if(dbOk&&db){
      (async()=>{
        try{
          const {data:ins,error:agErr}=await dbInsert('agendamentos', agDados);
          if(agErr){ console.warn('[criarAgPlano] sync falhou:', agErr.message); return; }
          if(ins){
            todosAg=todosAg.filter(a=>a.id!==agId); todosAg.unshift(ins); lsAgSalvar(todosAg);
            // Atualiza referência no local com ID real do banco
            const locIdx=locaisVistoria.findIndex(l=>l.id===rec.id);
            if(locIdx>=0){ locaisVistoria[locIdx].agendamento_id=ins.id; await saveLocais(); }
          }
        }catch(e){ console.warn('[criarAgPlano]',e.message); }
      })();
    }
    return agId;
  }
}

let _salvandoLocal=false;
async function salvarLocal(){
  const cli=(document.getElementById('loc-cli').value||'').trim();
  const end=(document.getElementById('loc-end').value||'').trim();
  if(!cli||!end){ toast('⚠️ Preencha cliente e endereço'); return; }
  if(_salvandoLocal) return; // trava contra clique duplo (causava planos duplicados)
  const editId=document.getElementById('loc-edit-id').value;
  // Anti-duplicata: bloqueia cadastrar o mesmo cliente+local já existente na empresa
  if(!editId){
    const _n=s=>(s||'').trim().toLowerCase();
    const jaExiste=locaisVistoria.some(l=>l.ativo!==false && escopoEmpresaMatch(l.loja_id) && _n(l.cliente)===_n(cli) && _n(l.local)===_n(end));
    if(jaExiste){ toast('⚠️ Já existe um plano para esse cliente neste local'); return; }
  }
  _salvandoLocal=true;
  const _btnSalvarLoc=document.querySelector('#loc-add-form button.btn-primary[onclick="salvarLocal()"]');
  if(_btnSalvarLoc){ _btnSalvarLoc.disabled=true; _btnSalvarLoc.textContent='Salvando…'; }
  try{
  const s=getSessao();
  const existingLocal=editId?locaisVistoria.find(x=>x.id===editId):null;
  // Na edição preserva a empresa original do local; só define pela view ao criar.
  const _lojaPrev=existingLocal&&existingLocal.loja_id&&existingLocal.loja_id!=='default'?existingLocal.loja_id:null;
  const _lojaSelVal=(document.getElementById('loc-loja-row')?.style.display!=='none'&&document.getElementById('loc-loja')?.value)||'';
  const lojaId=_lojaPrev||_lojaSelVal||s?.loja_id||lojaAtiva||LOJA_PADRAO_ID;
  // valida ao menos nome de cada equipamento
  const equipsValidos=_locEquipCustom.filter(e=>e.nome.trim());
  const rec={
    id: editId||('loc_'+Date.now()),
    loja_id: lojaId,
    cliente: cli,
    local: end,
    email_responsavel: (document.getElementById('loc-email').value||'').trim(),
    tecnico: document.getElementById('loc-tec').value||'',
    dia_pref: document.getElementById('loc-dia-pref')?.value||'',
    hora_pref: document.getElementById('loc-hora-pref')?.value||'08:00',
    equipamentos: equipsValidos,
    ativo: true,
    agendamento_id: existingLocal?.agendamento_id||'',
    created_at: editId ? (existingLocal||{}).created_at||new Date().toISOString() : new Date().toISOString(),
    _pendingSync: true // limpo pelo saveLocais/loadLocaisRemoto quando sincronizar
  };
  if(editId){
    const idx=locaisVistoria.findIndex(x=>x.id===editId);
    if(idx>=0) locaisVistoria[idx]=rec; else locaisVistoria.push(rec);
  } else {
    locaisVistoria.push(rec);
  }
  // Vincula ao calendário: cria ou atualiza agendamento mensal
  const agId=await criarOuAtualizarAgendamentoPlano(rec, !!editId && !!existingLocal?.agendamento_id);
  if(agId && !rec.agendamento_id){
    const idx=locaisVistoria.findIndex(x=>x.id===rec.id);
    if(idx>=0) locaisVistoria[idx].agendamento_id=agId;
  }
  await saveLocais();
  fecharLocForm();
  renderLocaisTab();
  toast('✅ Local salvo! Visita mensal adicionada ao calendário 📅');
  }finally{
    _salvandoLocal=false;
    if(_btnSalvarLoc){ _btnSalvarLoc.disabled=false; _btnSalvarLoc.textContent='💾 Salvar plano'; }
  }
}

// Tombstones de planos apagados — impede que o loadLocaisRemoto os re-envie
// para a tabela (o que fazia planos excluídos "voltarem" na sincronização).
function _locTombLer(){ try{ return JSON.parse(ls('fluxa_loc_tombstones')||'[]'); }catch(e){ return []; } }
function _locTombAdd(id){ const t=_locTombLer(); if(!t.includes(id)){ t.push(id); lsSet('fluxa_loc_tombstones', JSON.stringify(t.slice(-500))); } }
function excluirLocal(id){
  confirmar('Remover este local da lista de recorrentes?',async ()=>{
    _locTombAdd(id);
    const loc=locaisVistoria.find(x=>x.id===id);
    // Desativa o agendamento vinculado
    if(loc?.agendamento_id){
      const agIdx=todosAg.findIndex(a=>a.id===loc.agendamento_id);
      if(agIdx>=0){ todosAg[agIdx].ativo=false; lsAgSalvar(todosAg); }
      if(dbOk&&db){
        db.from('agendamentos').update({ativo:false}).eq('id',loc.agendamento_id).then(()=>{}).catch(()=>{});
        db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',loc.agendamento_id).eq('status','agendado').then(()=>{}).catch(()=>{});
      }
    }
    locaisVistoria=locaisVistoria.filter(x=>x.id!==id);
    // Remove a linha na tabela dedicada (upsert não apaga). Ignora erro se tabela ausente.
    if(dbOk&&db&&_locaisTabelaOk!==false){
      try{ await db.from('locais_vistoria').delete().eq('id',id); }catch(e){ console.warn('[excluirLocal:tabela]',e?.message||e); }
    }
    await saveLocais();
    renderLocaisTab();
    toast('Local removido');
  });
}

async function toggleLocalAtivo(id){
  const loc=locaisVistoria.find(x=>x.id===id);
  if(!loc) return;
  loc.ativo=!loc.ativo;
  // Sincroniza estado do agendamento vinculado
  if(loc.agendamento_id){
    const agIdx=todosAg.findIndex(a=>a.id===loc.agendamento_id);
    if(agIdx>=0){ todosAg[agIdx].ativo=loc.ativo; lsAgSalvar(todosAg); }
    if(dbOk&&db){
      db.from('agendamentos').update({ativo:loc.ativo}).eq('id',loc.agendamento_id).then(()=>{}).catch(()=>{});
      if(!loc.ativo){
        db.from('ordens_servico').update({status:'cancelado'}).eq('agendamento_id',loc.agendamento_id).eq('status','agendado').then(()=>{}).catch(()=>{});
      }
    }
  }
  await saveLocais();
  renderLocaisTab();
}

function locVisMesAnterior(){
  if(!locaisVisMesRef) return;
  const [y,m]=locaisVisMesRef.split('-').map(Number);
  const d=new Date(y,m-2,1);
  locaisVisMesRef=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderLocaisTab();
}
function locVisMesProximo(){
  if(!locaisVisMesRef) return;
  const [y,m]=locaisVisMesRef.split('-').map(Number);
  const d=new Date(y,m,1);
  locaisVisMesRef=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderLocaisTab();
}

// fecharConcluirVis/salvarConcluirVis removidas — o modal #concluir-vis-bg
// que só elas atendiam ficou órfão desde 807672a (nada mais abre esse modal;
// confirmado via grep antes de remover). window._concluirVisEquips e
// _cvEquipData continuam declarados em outro ponto do arquivo; não são desta
// sessão mexer (escopo é index.html/styles.css), então ficaram como estavam.

// Abre o formulário COMPLETO de vistoria pré-preenchido com os dados do plano
function iniciarVistoriaPlena(locId){
  const loc=locaisVistoria.find(x=>x.id===locId);
  if(!loc) return;

  // Reset estado
  visEquipSelecionados=[];
  visEquipDados={};
  visAmbienteObs={};
  _visEquipsCustom=[];
  visCheckinTime=null;
  visCheckoutTime=null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  visEditId=null;
  _visDraftId=null;
  window._visLocalId=locId;
  _visClienteSelecionado = loc.cliente_id ? {id:loc.cliente_id, nome:loc.cliente} : null;

  // Navega para a aba Nova Vistoria
  visTab('nova');

  // Esconde o banner de pré-carga (não faz sentido junto com o banner do plano)
  const precarga=document.getElementById('vis-precarga-banner');
  if(precarga) precarga.style.display='none';

  // Mostra banner do plano
  const planoBanner=document.getElementById('vis-plano-banner');
  const planoNome=document.getElementById('vis-plano-nome');
  const planoSub=document.getElementById('vis-plano-sub');
  if(planoBanner){ planoBanner.style.display='flex'; }
  if(planoNome) planoNome.textContent=loc.cliente||'';
  if(planoSub){
    const equips=normalizeLocEquips(loc.equipamentos||[]);
    planoSub.textContent=`📍 ${loc.local||''}${equips.length?' · 🔧 '+equips.length+' equipamentos':''}`;
  }

  // Preenche data e mês de referência usando hora LOCAL (não UTC)
  const hoje=new Date();
  const localDate=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const localMes=localDate.slice(0,7);
  const ddEl=document.getElementById('vis-data'); if(ddEl) ddEl.value=localDate;
  const mmEl=document.getElementById('vis-mes-ref'); if(mmEl) mmEl.value=localMes;

  // Preenche cliente e local
  const cliInp=document.getElementById('vis-cli'); if(cliInp) cliInp.value=loc.cliente||'';
  const locInp=document.getElementById('vis-loc'); if(locInp) locInp.value=loc.local||'';

  // Preenche e-mail do responsável
  if(loc.email_responsavel){
    const emEl=document.getElementById('vis-email-resp'); if(emEl) emEl.value=loc.email_responsavel;
    const stEl=document.getElementById('vis-email-status');
    if(stEl) stEl.textContent=`📧 ${loc.email_responsavel} (do plano)`;
  }

  // Preenche horário preferencial
  if(loc.hora_pref){ const hEl=document.getElementById('vis-hora'); if(hEl) hEl.value=loc.hora_pref; }

  // Preenche técnico
  const tecSel=document.getElementById('vis-tec');
  if(tecSel){
    const tNome=loc.tecnico||(getSessao()?.nome||'');
    if(tNome){ for(const o of tecSel.options){ if(o.text===tNome||o.value===tNome){ o.selected=true; break; } } }
  }

  // Carrega equipamentos do plano como _visEquipsCustom (com modelo/potência)
  const equips=normalizeLocEquips(loc.equipamentos||[]);
  if(equips.length){
    _visEquipsCustom=equips.map(e=>({id:e.id,nome:e.nome,emoji:e.emoji||'⚙️',marca:e.marca||'',modelo:e.modelo||'',potencia:e.potencia||'',ficha:e.ficha||'',ambiente:e.ambiente||''}));
    equips.forEach(e=>{ visEquipDados[e.id]={status:'na',obs:'',fotos:[]}; });
  }

  renderVisChips();
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=equips.length?'':'none';

  // Vindo do plano, os dados já estão preenchidos → recolhe o bloco "Dados da
  // Visita" para o técnico ir direto aos equipamentos (menos scroll no campo).
  const _dadosBody=document.getElementById('vis-dados-body');
  const _dadosToggle=document.getElementById('vis-dados-toggle');
  if(_dadosBody) _dadosBody.style.display='none';
  if(_dadosToggle) _dadosToggle.textContent='▼ expandir';

  // Inicia check-in automaticamente
  visCheckin();

  // Scroll para o topo
  window.scrollTo({top:0,behavior:'smooth'});
}
let _tecVerTodos=false;
function toggleTecVerTodos(){ _tecVerTodos=!_tecVerTodos; renderLocaisTab(); }
function renderLocaisTab(){
  loadLocais();
  const s=getSessao();
  // usa a variável global lojaAtiva (controlada pelo header dropdown)
  // NÃO cria shadow local — era o bug que fazia todos os locais aparecerem para qualquer gestor
  const isTecnico=s?.perfil==='tecnico';
  const nomeLogado=s?.nome||'';
  const mesNomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Mês de referência padrão
  if(!locaisVisMesRef){
    const now=new Date();
    locaisVisMesRef=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  }
  const [y,m]=locaisVisMesRef.split('-').map(Number);
  const labelEl=document.getElementById('loc-mes-label');
  if(labelEl) labelEl.textContent=mesNomes[m-1].slice(0,3)+' '+y;

  // Visibilidade do botão "Novo plano" (só gestor)
  const btnNovo=document.getElementById('loc-btn-novo');
  if(btnNovo) btnNovo.style.display=isTecnico?'none':'';

  // Header (só gestor vê o bloco de cabeçalho completo; técnico vê versão simplificada)
  const pgHdr=document.getElementById('loc-page-header');
  if(pgHdr){
    const tecTitle=pgHdr.querySelector('.loc-page-title-row div div:first-child');
    if(isTecnico && tecTitle){ tecTitle.textContent='📍 Minhas visitas do mês'; }
  }

  // Filtro de busca por nome/local
  const buscaTxt=(document.getElementById('loc-busca')?.value||'').toLowerCase().trim();
  const _matchBusca=l=>!buscaTxt||(l.cliente||'').toLowerCase().includes(buscaTxt)||(l.local||'').toLowerCase().includes(buscaTxt);

  // Filtro de empresa unificado (ver escopoEmpresaMatch) — técnico/gestor/loja
  const _lojaMatch=l=>escopoEmpresaMatch(l.loja_id);
  // Técnico vê só os planos atribuídos a ele (+ os "sem técnico"), a menos que
  // ative "ver todos". Deixa a tela dele focada nas visitas que são dele.
  const _nomeTec=nomeLogado.trim().toLowerCase();
  const _tecMatch=l=>!isTecnico || _tecVerTodos || !((l.tecnico||'').trim()) || (l.tecnico||'').trim().toLowerCase()===_nomeTec;
  // Filtra locais ativos da empresa atual
  const locaisFiltrados=locaisVistoria.filter(l=>
    _lojaMatch(l) && l.ativo!==false && _matchBusca(l) && _tecMatch(l)
  );
  // Gestor vê também os inativos
  const todosLoja=isTecnico ? locaisFiltrados : locaisVistoria.filter(l=>_lojaMatch(l) && _matchBusca(l));

  // Vistorias deste mês com o mesmo filtro de empresa
  const vis=lsVisLer().filter(v=> v.mes_ref===locaisVisMesRef && _lojaMatch(v));

  // Build tracking somente dos ativos para stats
  const trackingAtivos=locaisFiltrados.map(loc=>{
    const vistoria=vis.find(v=>(v.local_id&&v.local_id===loc.id)||(v.cliente===loc.cliente&&v.local===loc.local));
    return {loc, vistoria, feita:!!vistoria};
  });
  const nFeitas=trackingAtivos.filter(x=>x.feita).length;
  const nPend=trackingAtivos.filter(x=>!x.feita).length;

  // Stats
  const statsEl=document.getElementById('loc-stats-row');
  if(statsEl) statsEl.innerHTML=`
    <div class="loc-stat"><span class="loc-stat-icon">✅</span><div class="loc-stat-info"><div class="loc-stat-val">${nFeitas}</div><div class="loc-stat-lbl">Realizadas</div></div></div>
    <div class="loc-stat"><span class="loc-stat-icon">⏳</span><div class="loc-stat-info"><div class="loc-stat-val">${nPend}</div><div class="loc-stat-lbl">Pendentes</div></div></div>
    <div class="loc-stat"><span class="loc-stat-icon">📍</span><div class="loc-stat-info"><div class="loc-stat-val">${locaisFiltrados.length}</div><div class="loc-stat-lbl">Ativos</div></div></div>
  `;

  // ── Lista unificada ──
  const listaEl=document.getElementById('loc-lista-unificada');
  if(!listaEl) return;

  if(todosLoja.length===0){
    listaEl.innerHTML=`<div class="loc-empty">
      <div class="loc-empty-icon">📋</div>
      <div class="loc-empty-txt">${isTecnico?'Nenhum local atribuído a você ainda.':'Nenhum plano cadastrado ainda.<br>Clique em <strong>＋ Novo plano</strong> para começar.'}</div>
      ${!isTecnico?`<button class="btn-primary" onclick="abrirLocForm()">＋ Adicionar primeiro plano</button>`:''}
    </div>`;
    return;
  }

  // Ordena: ativos pendentes primeiro, ativos feitos depois, inativos por último
  const sorted=[...todosLoja].sort((a,b)=>{
    const aAtivo=a.ativo!==false, bAtivo=b.ativo!==false;
    if(aAtivo!==bAtivo) return bAtivo-aAtivo; // ativos antes
    const aVis=vis.find(v=>(v.local_id&&v.local_id===a.id)||(v.cliente===a.cliente&&v.local===a.local));
    const bVis=vis.find(v=>(v.local_id&&v.local_id===b.id)||(v.cliente===b.cliente&&v.local===b.local));
    return (!!aVis)-(!!bVis); // pendentes antes dos feitos
  });

  listaEl.innerHTML=sorted.map(loc=>{
    const ativo=loc.ativo!==false;
    const vistoria=vis.find(v=>(v.local_id&&v.local_id===loc.id)||(v.cliente===loc.cliente&&v.local===loc.local));
    const feita=!!vistoria;
    const cls=!ativo?'inativo':feita?'feita':'pendente';
    const icon=!ativo?'⏸':feita?'✅':'⏳';

    // Status do mês
    let statusHtml='';
    if(!ativo){
      statusHtml=`<div class="loc-ucard-status" style="color:var(--gray)">⏸ Inativo</div>`;
    } else if(feita){
      const dataFmt=vistoria.data?vistoria.data.split('-').reverse().join('/'):'?';
      statusHtml=`<div class="loc-ucard-status ok">✅ Realizada em ${dataFmt}${vistoria.tecnico?' — '+vistoria.tecnico:''}</div>`;
    } else {
      statusHtml=`<div class="loc-ucard-status pend">⏳ Pendente — ${mesNomes[m-1]} ${y}</div>`;
    }

    // Ações do mês (coluna direita)
    let acoesHtml='';
    if(ativo && feita){
      acoesHtml=`
        <button class="tb" onclick="abrirVisRelatorio('${vistoria.id}')" title="Ver relatório PDF" style="font-size:12px;padding:5px 10px">📄 Relatório</button>
        <button class="tb" onclick="editarVistoria('${vistoria.id}')" title="Reabre a vistoria preenchida para corrigir/completar — salva no mesmo relatório" style="font-size:12px;padding:5px 10px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">✏️ Refazer</button>
        <button class="tb" onclick="reenviarEmailVistoria('${vistoria.id}')" title="Reenviar e-mail">✉️</button>
        ${!isTecnico?`<button class="tb" onclick="desfazerVistoriaLocal('${vistoria.id}')" title="Apagar esta visita do mês (volta a pendente)" style="font-size:12px;padding:5px 10px;color:var(--red)">🗑️ Desfazer</button>`:''}`;
    } else if(ativo){
      acoesHtml=`<button class="btn-primary" style="padding:7px 14px;font-size:13px;white-space:nowrap" onclick="iniciarVistoriaPlena('${loc.id}')">🔍 Fazer Vistoria</button>`;
    }
    // Botão Google Maps sempre visível quando há endereço
    const mapsUrl='https://maps.google.com/?q='+encodeURIComponent((loc.local||'')+' '+(loc.cliente||''));
    const mapsBtn=loc.local?`<a href="${mapsUrl}" target="_blank" rel="noopener" class="tb" style="font-size:12px;padding:5px 10px;text-decoration:none;display:inline-flex;align-items:center;gap:3px" title="Abrir no Google Maps">📍 Maps</a>`:'';
    if(mapsBtn) acoesHtml = mapsBtn + ' ' + acoesHtml;

    // Rodapé com ações de gestão (só gestor)
    const rodape=!isTecnico?`
      <div class="loc-ucard-footer">
        <button class="tb" onclick="abrirLocForm('${loc.id}')" title="Editar plano" style="font-size:12px">✏️ Editar</button>
        <button class="tb" onclick="toggleLocalAtivo('${loc.id}')" title="${ativo?'Pausar':'Reativar'}" style="font-size:12px">${ativo?'⏸ Pausar':'▶ Reativar'}</button>
        <button class="tb" onclick="excluirLocal('${loc.id}')" title="Excluir" style="font-size:12px;color:var(--red)">🗑️ Excluir</button>
      </div>`:'';

    return `<div class="loc-ucard ${cls}">
      <div class="loc-ucard-top">
        <span class="loc-ucard-icon">${icon}</span>
        <div class="loc-ucard-info">
          <div class="loc-ucard-nome">${esc(loc.cliente)}${(()=>{ if(!lojaAtiva&&loc.loja_id&&loc.loja_id!=='default'){ const _l=getLoja(loc.loja_id); return _l?` <span class="loja-badge ${_l.cor}" style="font-size:9px;vertical-align:middle">${_l.nome.replace('Fortemp ','')}</span>`:'' } return ''; })()}</div>
          <div class="loc-ucard-det">📍 ${esc(loc.local)}${loc.tecnico?' · 👤 '+esc(loc.tecnico):''}${loc.hora_pref?' · 🕐 '+esc(loc.hora_pref):''}${(()=>{const eq=normalizeLocEquips(loc.equipamentos||[]);return eq.length?' · 🔧 '+eq.length+' equip.':'';})()} </div>
          ${statusHtml}
        </div>
        <div class="loc-ucard-acts">${acoesHtml}</div>
      </div>
      ${rodape}
    </div>`;
  }).join('');
  // Toggle "só os meus / todos" — só para técnico
  if(isTecnico){
    const _lbl=_tecVerTodos?'👁 Vendo todos os locais':'👤 Vendo só os meus';
    const _alt=_tecVerTodos?'ver só os meus':'ver todos';
    listaEl.insertAdjacentHTML('afterbegin',
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:8px 12px;background:var(--gray-light);border-radius:10px;font-size:12px">
         <span style="font-weight:700;color:var(--c2)">${_lbl}</span>
         <button class="tb" style="font-size:11px" onclick="toggleTecVerTodos()">${_alt}</button>
       </div>`);
  }
}
/* ══ /LOCAIS RECORRENTES ══ */

function initVisitas(){
  // Preenche técnicos no select
  atualizarTecsPorLoja(null,'vis-tec');
  // Data e mês ref padrão = hoje
  const hoje = new Date();
  const dd = document.getElementById('vis-data');
  const mm = document.getElementById('vis-mes-ref');
  if(dd && !dd.value) dd.value = _hojeLocal();
  if(mm && !mm.value) mm.value = _hojeLocal().slice(0,7);
  // Chips de equipamentos
  renderVisChips();
  // Histórico — default = mês atual
  const hmEl = document.getElementById('vis-hist-mes');
  if(hmEl && !hmEl.value) hmEl.value = _hojeLocal().slice(0,7);
  renderVisHistorico();
  // Popula autocomplete técnico no select
  const sel = document.getElementById('vis-tec');
  if(sel){
    const sess = getSessao();
    if(sess?.perfil==='tecnico' && sess.nome){
      // auto-seleciona técnico logado
      for(let o of sel.options){ if(o.text===sess.nome){ o.selected=true; break; } }
    }
  }
  loadLocais();
}

function visTab(tab){
  ['nova','hist','locais'].forEach(t=>{
    const v=document.getElementById('vis-view-'+t);
    const b=document.getElementById('vis-tab-'+t);
    if(v) v.style.display = t===tab ? '' : 'none';
    if(b){ b.classList.toggle('on', t===tab); }
  });
  if(tab==='nova'){
    // técnico não precisa ver campo de e-mail
    const emailRow=document.getElementById('vis-email-row');
    if(emailRow) emailRow.style.display = eTecnico() ? 'none' : '';
  }
  if(tab!=='nova') window._visPreCargaRec = null;
  if(tab==='hist') renderVisHistorico();
  if(tab==='locais') renderLocaisTab();
}

// ── Chips de seleção de equipamentos ──
function renderVisChips(){
  const el = document.getElementById('vis-equip-chips'); if(!el) return;
  el.innerHTML = VIS_EQUIPAMENTOS_DEFAULT.map(eq=>`
    <div class="vis-chip${visEquipSelecionados.includes(eq.id)?' on':''}"
         onclick="toggleVisEquip('${eq.id}')" data-visid="${eq.id}">
      ${eq.emoji} ${eq.nome}
    </div>`).join('');
  // Popula o select de "adicionar mais de um" (tipos padrão + Outro)
  const sel=document.getElementById('vis-add-tipo');
  if(sel && !sel.options.length){
    sel.innerHTML=VIS_EQUIPAMENTOS_DEFAULT.map(eq=>`<option value="${eq.id}">${eq.emoji} ${esc(eq.nome)}</option>`).join('')
      +'<option value="__outro__">⚙️ Outro (digite o rótulo)</option>';
  }
}

// Adiciona um equipamento AVULSO na vistoria (quantos quiser). Resolve o caso
// de locais com 10-15 motobombas: escolhe o tipo, opcionalmente um rótulo, e
// clica quantas vezes precisar — cada instância é numerada e independente.
function visAddEquipManual(){
  const tipo=document.getElementById('vis-add-tipo')?.value||'';
  const rotulo=(document.getElementById('vis-add-nome')?.value||'').trim();
  const def=VIS_EQUIPAMENTOS_DEFAULT.find(x=>x.id===tipo);
  const base = def?def.nome:(rotulo||'Equipamento');
  const emoji = def?def.emoji:'⚙️';
  const tipoKey = def?def.id:('outro:'+(base.toLowerCase()));
  // numera por tipo (Motobomba Principal 1, 2, 3…)
  const jaDoTipo=(_visEquipsCustom||[]).filter(e=>e._tipoKey===tipoKey).length;
  // Tipo padrão + rótulo → "Base — rótulo"; "Outro" → o rótulo JÁ é o nome (numera se repetir)
  const nome = (def && rotulo) ? `${base} — ${rotulo}` : (jaDoTipo>0 ? `${base} ${jaDoTipo+1}` : (def?`${base} 1`:base));
  const id=_novoEquipId();
  _visEquipsCustom.push({id, nome, emoji, marca:'', modelo:'', potencia:'', ficha:'', _tipoKey:tipoKey, _adhoc:true});
  if(!visEquipDados[id]) visEquipDados[id]={status:'na',obs:'',fotos:[]};
  _visEquipAbertos.add(id);
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card'); if(card) card.style.display='';
  const nomeInp=document.getElementById('vis-add-nome'); if(nomeInp) nomeInp.value=''; // mantém o tipo p/ adicionar vários
  document.getElementById('vis-block-'+id)?.scrollIntoView({behavior:'smooth',block:'center'});
  _salvarRascunhoVis();
  toast(`➕ ${nome} adicionado`);
}

function toggleVisEquip(id){
  if(visEquipSelecionados.includes(id)){
    visEquipSelecionados = visEquipSelecionados.filter(x=>x!==id);
    delete visEquipDados[id];
    _visEquipAbertos.delete(id);
  } else {
    visEquipSelecionados.push(id);
    if(!visEquipDados[id]) visEquipDados[id] = { status:'na', obs:'', fotos:[] };
    _visEquipAbertos.add(id); // recém-selecionado abre para preenchimento imediato
  }
  renderVisChips();
  renderVisEquipGrid();
  const card = document.getElementById('vis-equip-card');
  if(card) card.style.display = visEquipSelecionados.length?'':'none';
  _salvarRascunhoVis();
}

let _visEquipsCustom=[]; // equipamentos vindos de um plano de acompanhamento

// ── Grid de vistoria por equipamento ──
// Sugestões de observação POR TIPO de equipamento (pedido do Bruno): cada
// equipamento tem seus defeitos típicos. Match por palavra-chave no NOME
// (cobre os padrão e os custom dos planos, ex.: "Bomba de Calor 55").
// A ordem importa: "bomba de calor/trocador" antes de "bomba" (motobomba).
function visObsSugestoes(nome){
  const n=(nome||'').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const tem=(...ks)=>ks.some(k=>n.includes(k));
  // Só SINTOMAS observáveis e ações feitas — sem deduzir a causa (o diagnóstico
  // é feito na manutenção; a motobomba, p.ex., é revisada como um todo).
  const OK='OK – equipamento funcionando perfeitamente';
  if(tem('calor','trocador','aquec')) return [OK,'Barulho anormal','Erro no painel','Não aquece','Aquecendo pouco','Vazamento','Desligando sozinho'];
  if(tem('bomba','motor')) return [OK,'Barulho anormal','Vazamento','Não liga','Travada','Perdendo escorva / baixa vazão','Esquentando muito','Recolhida para manutenção'];
  if(tem('filtro')) return [OK,'Vazamento','Pressão alta','Retrolavagem realizada','Água voltando suja p/ piscina','Tampa/visor com desgaste'];
  if(tem('sauna','vapor')) return [OK,'Não aquece','Aquecendo pouco','Vazamento de vapor','Não liga','Desarmando o disjuntor'];
  if(tem('skimmer')) return [OK,'Limpeza realizada','Tampa danificada','Cesto danificado','Vazamento'];
  if(tem('ilumina','refletor','led')) return [OK,'Não acende','Acendendo parcialmente','Infiltração aparente','Não responde ao comando'];
  if(tem('automa','dosador','clorador','ozonio','gerador de cloro','ph')) return [OK,'Dosagem irregular','Erro no painel','Sem produto no reservatório','Não liga'];
  if(tem('spa','hidro')) return [OK,'Hidromassagem fraca','Não liga','Vazamento','Barulho anormal'];
  return [OK,'Limpeza realizada','Vazamento','Barulho anormal','Não liga','Recolhido para manutenção'];
}

function renderVisEquipGrid(){
  const el = document.getElementById('vis-equip-grid'); if(!el) return;
  el.innerHTML = '';
  // Esconde/mostra o bloco de equipamentos
  const card = document.getElementById('vis-equip-card');
  const hasEquips=visEquipSelecionados.length>0||_visEquipsCustom.length>0;
  if(card) card.style.display=hasEquips?'':'none';

  const customIds=_visEquipsCustom.map(e=>e.id);
  const stdIds=visEquipSelecionados.filter(id=>!customIds.includes(id) && VIS_EQUIPAMENTOS_DEFAULT.some(x=>x.id===id));
  const total=_visEquipsCustom.length+stdIds.length;
  // Contador + dica: deixa CLARO quantos equipamentos há. Cada bloco fica
  // recolhido (só o 1º abre) — antes todos abriam e, na tela do celular, o
  // primeiro gigante fazia parecer que só existia um equipamento.
  if(total){
    const hint=document.createElement('div');
    hint.style.cssText='font-size:12px;color:var(--gray);margin-bottom:10px;background:var(--c1-light);border-radius:8px;padding:8px 12px;font-weight:600';
    hint.innerHTML=`📋 <strong style="color:var(--c1)">${total}</strong> equipamento${total>1?'s':''} para vistoriar — toque em cada um para preencher status, observação e fotos.`;
    el.appendChild(hint);
  }
  // Ordem dos equipamentos; poda ids obsoletos (de outra vistoria) e, se nada
  // está expandido, abre o 1º por padrão.
  const ordem=[..._visEquipsCustom.map(e=>e.id), ...stdIds];
  const _idsAtuais=new Set(ordem);
  _visEquipAbertos.forEach(id=>{ if(!_idsAtuais.has(id)) _visEquipAbertos.delete(id); });
  if(!_visEquipAbertos.size && ordem.length) _visEquipAbertos.add(ordem[0]);
  // Renderiza equipamentos customizados do plano, agrupados por ambiente
  // (facilita achar tudo de um mesmo local durante a vistoria)
  if(_visEquipsCustom.length){
    const secTit=document.createElement('div');
    secTit.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:8px';
    secTit.textContent='Equipamentos do plano';
    el.appendChild(secTit);
    const gruposVis=[];
    _visEquipsCustom.forEach(ceq=>{
      const nomeAmb=(ceq.ambiente||'').trim();
      let g=gruposVis.find(gr=>gr.nome===nomeAmb);
      if(!g){ g={nome:nomeAmb, itens:[]}; gruposVis.push(g); }
      g.itens.push(ceq);
    });
    gruposVis.sort((a,b)=>(a.nome===''?1:0)-(b.nome===''?1:0));
    gruposVis.forEach(g=>{
      if(g.nome){
        const ambTit=document.createElement('div');
        ambTit.style.cssText='font-size:12px;font-weight:800;color:var(--c1);margin:12px 0 6px;display:flex;align-items:center;gap:6px';
        ambTit.textContent='📍 '+g.nome;
        el.appendChild(ambTit);
        // Observação GERAL do ambiente (problemas que não são de um equipamento,
        // ex.: vazamento na tubulação). Fica salva por ambiente e vai no relatório.
        const ambObs=document.createElement('div');
        ambObs.style.cssText='margin:0 0 10px';
        const _nAmb=esc(g.nome).replace(/'/g,"\\'");
        ambObs.innerHTML=`<textarea rows="2" placeholder="Observação geral deste ambiente (ex.: vazamento na tubulação, algo fora dos equipamentos…)" oninput="visUpdAmbObs('${_nAmb}',this.value)" style="width:100%;padding:8px 10px;border:1.5px dashed var(--c1);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;resize:vertical;outline:none;background:var(--c1-light)">${esc(visAmbienteObs[g.nome]||'')}</textarea>`;
        el.appendChild(ambObs);
      }
      g.itens.forEach(ceq=>{
        const id=ceq.id;
        if(!visEquipDados[id]) visEquipDados[id]={status:'na',obs:'',fotos:[]};
        const d=visEquipDados[id];
        el.appendChild(buildEquipBlock(id,ceq.emoji||'⚙️',ceq.nome,d,ceq.modelo,ceq.potencia,ceq.marca,ceq.ficha,_visEquipAbertos.has(id)));
      });
    });
  }

  // Renderiza equipamentos padrão selecionados pelos chips
  if(stdIds.length){
    const secTit2=document.createElement('div');
    secTit2.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin:12px 0 8px';
    secTit2.textContent='Outros equipamentos';
    el.appendChild(secTit2);
    stdIds.forEach(id=>{
      const def=VIS_EQUIPAMENTOS_DEFAULT.find(x=>x.id===id);
      if(!def) return;
      const d=visEquipDados[id]||{status:'na',obs:'',fotos:[]};
      el.appendChild(buildEquipBlock(id,def.emoji,def.nome,d,'','','','',_visEquipAbertos.has(id)));
    });
  }
}

function buildEquipBlock(id,emoji,nome,d,modelo,potencia,marca,ficha,aberto){
  const _ceq=(_visEquipsCustom||[]).find(e=>e.id===id);
  const _adhoc=!!(_ceq&&_ceq._adhoc); // equipamento avulso adicionado na vistoria
  const badgeMap={bom:'badge-bom',atencao:'badge-atencao',critico:'badge-critico',na:'badge-na'};
  const badgeTxt={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico',na:'— N/A'};
  const stClass='status-'+(d.status||'na');
  const block=document.createElement('div');
  block.className=`vis-equip-block ${stClass}`;
  block.id=`vis-block-${id}`;
  // Fotos: quantas o técnico quiser (até MAX_FOTOS_EQUIP), câmera OU galeria.
  const _fotos=(d.fotos||[]).filter(Boolean);
  const fotosHtml=_fotos.map((f,i)=>`
    <div class="vis-foto-slot filled">
      <img src="${f}" alt="">
      <button class="vis-foto-rm" onclick="event.stopPropagation();visRemoverFoto('${id}',${i})" title="Remover">✕</button>
    </div>`).join('');
  const subInfo=(marca||modelo||potencia)?`<div style="font-size:11px;color:var(--gray);margin-top:1px">${[marca,modelo,potencia].filter(Boolean).join(' · ')}</div>`:'';
  // Ficha/histórico do equipamento (cadastrado no plano) — referência para o técnico
  const fichaHtml=ficha?`<div style="background:var(--c1-light);border-left:3px solid var(--c1);border-radius:0 8px 8px 0;padding:8px 10px;margin-bottom:10px;font-size:12px;color:var(--c2);line-height:1.5;white-space:pre-wrap"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--c1)">📋 Ficha do equipamento</strong><br>${esc(ficha)}</div>`:'';
  block.innerHTML=`
    <div class="vis-equip-hdr" onclick="toggleVisEquipBody('${id}')">
      <div class="vis-equip-emoji">${emoji}</div>
      <div style="flex:1;min-width:0"><div class="vis-equip-nome">${esc(nome)}</div>${subInfo}</div>
      <div class="vis-equip-badge ${badgeMap[d.status||'na']}">${badgeTxt[d.status||'na']}</div>
      <div class="vis-equip-toggle" id="vis-arr-${id}">${aberto?'▼':'▶'}</div>
    </div>
    <div class="vis-equip-body${aberto?' open':''}" id="vis-body-${id}">
      ${_adhoc?`<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <input type="text" value="${esc(nome)}" oninput="visRenomearEquip('${id}',this.value)" placeholder="Nome do equipamento" style="flex:1;padding:8px 10px;border:1.5px solid var(--c1);border-radius:8px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;outline:none;color:var(--c2)">
        <button type="button" class="tb d" onclick="visRemoverEquipAdhoc('${id}')" title="Remover este equipamento">🗑</button>
      </div>`:''}
      ${fichaHtml}
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Status</div>
      <div class="vis-status-row">
        <button class="vis-status-btn${d.status==='bom'?' sel-bom':''}" onclick="setVisEquipStatus('${id}','bom')">✅ Bom</button>
        <button class="vis-status-btn${d.status==='atencao'?' sel-atencao':''}" onclick="setVisEquipStatus('${id}','atencao')">⚠️ Atenção</button>
        <button class="vis-status-btn${d.status==='critico'?' sel-critico':''}" onclick="setVisEquipStatus('${id}','critico')">🔴 Crítico</button>
        <button class="vis-status-btn${d.status==='na'?' sel-na':''}" onclick="setVisEquipStatus('${id}','na')">— N/A</button>
      </div>
      <div class="fl" style="margin-bottom:8px">
        <label>Observações</label>
        <div class="vis-obs-chips">
          ${visObsSugestoes(nome).map(t=>`<span class="vis-obs-chip" onclick="visAddObs('${id}','${t.replace(/'/g,'\\x27')}',this)">${t}</span>`).join('')}
        </div>
        <textarea id="vis-obs-${id}" rows="2" placeholder="Condições encontradas, medições, pendências…" oninput="visUpdObs('${id}',this.value)"
          style="width:100%;padding:8px 10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;resize:vertical;outline:none">${esc(d.obs||'')}</textarea>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Fotos ${_fotos.length?`<span style="color:var(--c1)">${_fotos.length}/${MAX_FOTOS_EQUIP}</span>`:''}</div>
      <div class="vis-fotos-row">${fotosHtml}</div>
      <input type="file" id="vis-f-${id}-add" accept="image/*" capture="environment" style="display:none" onchange="visAddFotoEquip(this,'${id}')">
      <input type="file" id="vis-f-${id}-add-gal" accept="image/*" style="display:none" onchange="visAddFotoEquip(this,'${id}')">
      ${_fotos.length<MAX_FOTOS_EQUIP?`<div style="display:flex;gap:8px;margin-top:8px">
        <button type="button" class="tb" style="flex:1;justify-content:center;font-weight:700;background:var(--c1-light);color:var(--c1);border-color:var(--c1-light)" onclick="visFotoEquip('${id}','cam')">📷 Tirar foto</button>
        <button type="button" class="tb" style="flex:1;justify-content:center" onclick="visFotoEquip('${id}','gal')">🖼️ Galeria</button>
      </div>`:`<div style="font-size:11px;color:var(--gray);margin-top:8px">Máximo de ${MAX_FOTOS_EQUIP} fotos neste equipamento.</div>`}
    </div>`;
  return block;
}

// Renomeia um equipamento avulso (só atualiza o cabeçalho, sem re-render p/
// não perder o foco do input). O nome é salvo no rascunho via debounce.
function visRenomearEquip(id, val){
  const ceq=(_visEquipsCustom||[]).find(e=>e.id===id); if(!ceq) return;
  ceq.nome=val;
  const nm=document.querySelector(`#vis-block-${id} .vis-equip-nome`);
  if(nm) nm.textContent=val||'Equipamento';
  _salvarRascunhoVisDeb();
}
function visRemoverEquipAdhoc(id){
  _visEquipsCustom=(_visEquipsCustom||[]).filter(e=>e.id!==id);
  delete visEquipDados[id];
  _visEquipAbertos.delete(id);
  renderVisEquipGrid();
  _salvarRascunhoVis();
}

function toggleVisEquipBody(id){
  const b = document.getElementById('vis-body-'+id);
  const a = document.getElementById('vis-arr-'+id);
  if(!b) return;
  const open = b.classList.contains('open');
  b.classList.toggle('open',!open);
  if(a) a.textContent = open?'▶':'▼';
  if(open) _visEquipAbertos.delete(id); else _visEquipAbertos.add(id); // preserva no re-render
}

function setVisEquipStatus(id, status){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  visEquipDados[id].status = status;
  renderVisEquipGrid();
  _salvarRascunhoVis();
}

function visUpdObs(id, val){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  visEquipDados[id].obs = val;
  _salvarRascunhoVisDeb(); // digitação: salva com debounce
}

function visAddObs(id, txt, chipEl){
  if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
  const ta = document.getElementById('vis-obs-'+id);
  const cur = (ta ? ta.value : visEquipDados[id].obs||'').trim();
  if(cur.includes(txt)) return; // já está na observação — não duplica (toque duplo no chip)
  const novo = cur ? cur+'. '+txt : txt;
  visEquipDados[id].obs = novo;
  if(ta) ta.value = novo;
  // Visual feedback: highlight chip briefly
  if(chipEl){ chipEl.style.background='var(--c1-light)'; chipEl.style.borderColor='var(--c1)'; setTimeout(()=>{ chipEl.style.background=''; chipEl.style.borderColor=''; },600); }
  _salvarRascunhoVis();
}

// ══ RASCUNHO AUTOMÁTICO DA VISTORIA ══
// O navegador do celular DESCARTA a página quando a tela apaga/app vai p/
// segundo plano — o técnico perdia a vistoria inteira no meio da visita.
// Todo toque relevante salva o estado no localStorage; ao reabrir, restaura.
const LS_VIS_DRAFT='fluxa_vis_draft';
let _visDraftTimer=null;
let _ultimoAvisoRascunhoCheio=0;
function _salvarRascunhoVis(){
  try{
    const cli=document.getElementById('vis-cli')?.value||'';
    // só salva se há algo em andamento (cliente, equipamento ou check-in)
    if(!cli && !visEquipSelecionados.length && !(_visEquipsCustom||[]).length && !visCheckinTime) return;
    const d={ t:Date.now(), campos:{},
      sel:visEquipSelecionados, custom:_visEquipsCustom, dados:visEquipDados, ambObs:visAmbienteObs,
      checkin:visCheckinTime?visCheckinTime.getTime():null,
      checkout:visCheckoutTime?visCheckoutTime.getTime():null,
      localId:window._visLocalId||null, editId:visEditId||null, draftId:_visDraftId||null };
    ['vis-cli','vis-loc','vis-data','vis-mes-ref','vis-hora','vis-obs','vis-recom','vis-email-resp','vis-tec']
      .forEach(fid=>{ const el=document.getElementById(fid); if(el) d.campos[fid]=el.value; });
    // setItem DIRETO (não lsSet): o lsSet engole o QuotaExceededError e o
    // fallback sem-fotos nunca rodaria — perda silenciosa (pego em teste).
    try{ localStorage.setItem(LS_VIS_DRAFT, JSON.stringify(d)); }
    catch(eq){ // cota do localStorage (fotos) — salva sem as fotos locais, melhor que perder tudo
      const semFotos=JSON.parse(JSON.stringify(d));
      let tinhaFotoPendente=false;
      Object.values(semFotos.dados||{}).forEach(x=>{ if(x&&x.fotos) x.fotos=x.fotos.map(f=>{ if(f&&String(f).startsWith('http')) return f; if(f) tinhaFotoPendente=true; return null; }); });
      localStorage.setItem(LS_VIS_DRAFT, JSON.stringify(semFotos));
      // Avisa o técnico — sem isso ele não sabe que uma foto ainda não enviada
      // pode se perder se o app fechar agora. Limitado a 1x/min p/ não floodar.
      if(tinhaFotoPendente && Date.now()-(_ultimoAvisoRascunhoCheio||0) > 60000){
        _ultimoAvisoRascunhoCheio=Date.now();
        toast('⚠️ Muitas fotos no rascunho local — as que ainda não subiram pro servidor podem se perder se o app fechar. Mantenha a internet ligada até finalizar.');
      }
    }
    _syncRascunhoNuvemDeb(); // backup na nuvem em background (debounce 4s)
  }catch(e){ console.warn('[rascunhoVis]', e?.message||e); }
}
function _salvarRascunhoVisDeb(){ clearTimeout(_visDraftTimer); _visDraftTimer=setTimeout(_salvarRascunhoVis, 700); }
function _limparRascunhoVis(){ try{ lsSet(LS_VIS_DRAFT,''); }catch(e){ console.warn('[limparRascunhoVis]',e?.message||e); } _apagarRascunhoNuvem(); }

// ── BACKUP DO RASCUNHO NA NUVEM (tabela vistoria_rascunhos) ──
// O rascunho local não sobrevive se o celular morrer/perder/limpar dados —
// e a equipe já saiu do local. A cada mudança, o progresso sobe para o
// servidor (debounce 4s); dá até para trocar de aparelho no meio da visita.
// 1 rascunho ativo por usuário (id = draft_<nome>). Tabela ausente → só loga.
let _visDraftCloudTimer=null;
function _draftCloudId(){ const n=_normNome(_nomeUsuarioAtual()); return n?('draft_'+n.replace(/[^a-z0-9]/g,'_')):null; }
function _syncRascunhoNuvemDeb(){ clearTimeout(_visDraftCloudTimer); _visDraftCloudTimer=setTimeout(()=>_syncRascunhoNuvem(), 4000); }
async function _syncRascunhoNuvem(){
  try{
    if(!dbOk||!db) return;
    const id=_draftCloudId(); if(!id) return;
    const raw=ls(LS_VIS_DRAFT); if(!raw) return;
    const r=await dbUpsert('vistoria_rascunhos', {id, usuario:_nomeUsuarioAtual(), dados:JSON.parse(raw), updated_at:new Date().toISOString()});
    if(r&&r.error) console.warn('[rascunhoNuvem]', r.error.message);
  }catch(e){ console.warn('[rascunhoNuvem]', e?.message||e); }
}
function _apagarRascunhoNuvem(){
  try{ const id=_draftCloudId(); if(dbOk&&db&&id) db.from('vistoria_rascunhos').delete().eq('id',id).then(()=>{}).catch(e=>console.warn('[rascunhoNuvem:del]',e?.message||e)); }
  catch(e){ console.warn('[rascunhoNuvem:del]', e?.message||e); }
}
// Restaura da nuvem quando ela é mais nova que o local (ou o local nem existe) —
// ex.: celular quebrou e o técnico logou em outro aparelho.
async function _restaurarRascunhoNuvem(){
  try{
    if(!dbOk||!db) return false;
    const id=_draftCloudId(); if(!id) return false;
    const {data,error}=await db.from('vistoria_rascunhos').select('dados').eq('id',id).limit(1);
    if(error||!data||!data.length||!data[0].dados) return false;
    const nuvem=data[0].dados;
    if(Date.now()-(nuvem.t||0) > 12*60*60*1000) return false; // velho demais
    let local=null; try{ local=JSON.parse(ls(LS_VIS_DRAFT)||'null'); }catch(e){ console.warn('[rascunhoNuvem:parse]',e?.message||e); }
    if(local && (local.t||0) >= (nuvem.t||0)) return false;   // local já é igual/mais novo
    localStorage.setItem(LS_VIS_DRAFT, JSON.stringify(nuvem));
    _visDraftRestaurado=false; // permite o restore rodar com o conteúdo da nuvem
    return _restaurarRascunhoVis();
  }catch(e){ console.warn('[rascunhoNuvem:rest]', e?.message||e); return false; }
}
let _visDraftRestaurado=false;
function _restaurarRascunhoVis(){
  if(_visDraftRestaurado) return false;
  let d=null; try{ d=JSON.parse(ls(LS_VIS_DRAFT)||'null'); }catch(e){ return false; }
  if(!d||!d.t) return false;
  if(Date.now()-d.t > 12*60*60*1000){ _limparRascunhoVis(); return false; } // >12h: descarta
  _visDraftRestaurado=true;
  visEquipSelecionados=d.sel||[];
  _visEquipsCustom=d.custom||[];
  visEquipDados=d.dados||{};
  visAmbienteObs=d.ambObs||{};
  window._visLocalId=d.localId||null; visEditId=d.editId||null; _visDraftId=d.draftId||null;
  visCheckinTime=d.checkin?new Date(d.checkin):null;
  visCheckoutTime=d.checkout?new Date(d.checkout):null;
  Object.entries(d.campos||{}).forEach(([fid,v])=>{ const el=document.getElementById(fid); if(el&&v!==undefined&&v!==null) el.value=v; });
  renderVisChips(); renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=(visEquipSelecionados.length||(_visEquipsCustom||[]).length)?'':'none';
  // Retoma o cronômetro do check-in do ponto certo (não zera o tempo no local)
  if(visCheckinTime && !visCheckoutTime){
    const bar=document.getElementById('vis-checkin-bar');
    const form=document.getElementById('vis-checkin-form');
    const info=document.getElementById('vis-checkin-info');
    if(bar) bar.style.display='flex';
    if(form) form.style.display='none';
    if(info) info.textContent='📍 Check-in: '+visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const timerEl=document.getElementById('vis-checkin-timer');
    if(visCheckinInterval) clearInterval(visCheckinInterval);
    visCheckinInterval=setInterval(()=>{
      const diff=Math.floor((Date.now()-visCheckinTime)/1000);
      const h=Math.floor(diff/3600), m=Math.floor((diff%3600)/60), s=diff%60;
      if(timerEl) timerEl.textContent=(h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s;
    },1000);
  }
  visTab('nova');
  toast('🔄 Vistoria em andamento restaurada — pode continuar de onde parou');
  return true;
}
// A tela apagando / app indo p/ segundo plano é EXATAMENTE o momento de salvar
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ _salvarRascunhoVis(); _syncRascunhoNuvem(); } });
window.addEventListener('pagehide',()=>{
  _salvarRascunhoVis();
  // Última chance antes da página morrer: envia à nuvem com keepalive (o fetch
  // sobrevive ao unload). Limite do keepalive é ~64KB — se o rascunho está
  // maior (fotos), os envios com debounce durante o uso já o carregaram.
  try{
    const id=_draftCloudId(); const raw=ls(LS_VIS_DRAFT);
    if(id && raw && raw.length<60000 && typeof FLUXA_CONFIG!=='undefined'){
      fetch(FLUXA_CONFIG.supabaseUrl+'/rest/v1/vistoria_rascunhos',{
        method:'POST', keepalive:true,
        headers:{apikey:FLUXA_CONFIG.supabaseKey, Authorization:'Bearer '+FLUXA_CONFIG.supabaseKey,
                 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates'},
        body:JSON.stringify({id, usuario:_nomeUsuarioAtual(), dados:JSON.parse(raw), updated_at:new Date().toISOString()})
      }).catch(e=>console.warn('[rascunhoNuvem:pagehide]', e?.message||e));
    }
  }catch(e){ console.warn('[rascunhoNuvem:pagehide]', e?.message||e); }
});

// Cada equipamento aceita várias fotos (até MAX_FOTOS_EQUIP), câmera OU galeria.
const MAX_FOTOS_EQUIP=8;
// "📷 Tirar foto" abre a câmera; "🖼️ Galeria" abre a galeria — ambos ADICIONAM
// (não substituem). O <input> de câmera tem capture; o de galeria não.
function visFotoEquip(id, modo){
  const n=((visEquipDados[id]?.fotos)||[]).filter(Boolean).length;
  if(n>=MAX_FOTOS_EQUIP){ toast(`⚠️ Máximo de ${MAX_FOTOS_EQUIP} fotos — remova uma para adicionar outra`); return; }
  document.getElementById(`vis-f-${id}-add${modo==='gal'?'-gal':''}`)?.click();
}
function visAddFotoEquip(inp, id){
  const f = inp.files[0]; if(!f){ return; }
  if(f.size > FOTO_MAX_BYTES){ toast('⚠️ Foto muito grande (máx 20 MB).'); inp.value=''; return; }
  const r = new FileReader();
  r.onload = async e => {
    try{
      const compressed=await compressImage(e.target.result, 800, 0.55);
      if(!visEquipDados[id]) visEquipDados[id]={ status:'na', obs:'', fotos:[] };
      if(!Array.isArray(visEquipDados[id].fotos)) visEquipDados[id].fotos=[];
      const arr=visEquipDados[id].fotos.filter(Boolean);
      if(arr.length>=MAX_FOTOS_EQUIP){ toast(`⚠️ Máximo de ${MAX_FOTOS_EQUIP} fotos`); return; }
      const slotIdx=arr.length;
      arr.push(compressed);
      visEquipDados[id].fotos=arr;
      renderVisEquipGrid();
      _salvarRascunhoVis();
      // Sobe para o Storage JÁ NA HORA (não só ao salvar a vistoria). Em vistorias
      // grandes o rascunho em base64 estoura a cota do localStorage e o fallback
      // (linha ~7922) descarta as fotos ainda não enviadas — perdendo tudo se o
      // celular recarregar a página no meio da visita. Virando URL cedo, o
      // rascunho fica leve e a foto sobrevive a esse recarregamento.
      if(!_visDraftId && !visEditId) _visDraftId='vis_'+Date.now();
      const _visId=visEditId||_visDraftId;
      if(dbOk && _visId){
        const path=`${_visId}/${id}/${Date.now()}_${slotIdx}.jpg`;
        _uploadFotoStorage(compressed, path).then(url=>{
          if(!url) return; // falhou (offline etc) — mantém base64, sem perder a foto
          const cur=(visEquipDados[id]||{}).fotos||[];
          const pos=cur.indexOf(compressed);
          if(pos>=0){ cur[pos]=url; renderVisEquipGrid(); _salvarRascunhoVis(); }
        }).catch(err=>console.warn('[visAddFotoEquip:upload]', err?.message||err));
      }
    }catch(err){ console.warn('[visAddFotoEquip]', err?.message||err); toast('⚠️ Falha ao processar a foto'); }
  };
  r.readAsDataURL(f);
  inp.value=''; // permite escolher a MESMA foto de novo, ou disparar o onchange sempre
}
// Tenta de novo o upload de fotos que ficaram em base64 na vistoria AINDA EM
// ANDAMENTO (não finalizada). Sem isto, uma foto que falhou por rede instável
// só tentava de novo quando o técnico clicasse Finalizar — podendo ser horas
// depois, numa vistoria longa. Chamada pelo mesmo laço de reenvio global
// (a cada 3min / ao reconectar), então cobre visitas de manhã inteira.
async function _retryFotosVisEmAndamento(){
  if(!dbOk || !db) return;
  const _visId=visEditId||_visDraftId; if(!_visId) return;
  let algumaSubiu=false;
  for(const id of Object.keys(visEquipDados||{})){
    const d=visEquipDados[id]; if(!d||!Array.isArray(d.fotos)) continue;
    for(let i=0;i<d.fotos.length;i++){
      const f=d.fotos[i]; if(!f || String(f).startsWith('http')) continue;
      try{
        const url=await _uploadFotoStorage(f, `${_visId}/${id}/${Date.now()}_${i}.jpg`);
        if(url){ d.fotos[i]=url; algumaSubiu=true; }
      }catch(e){ console.warn('[retryFotosVisEmAndamento]', e?.message||e); }
    }
  }
  if(algumaSubiu){ renderVisEquipGrid(); _salvarRascunhoVis(); }
}
function visRemoverFoto(id, idx){
  const arr=(visEquipDados[id]?.fotos||[]).filter(Boolean);
  arr.splice(idx,1);
  if(visEquipDados[id]) visEquipDados[id].fotos=arr;
  renderVisEquipGrid();
  _salvarRascunhoVis();
}

// Faz upload de uma foto (base64) para o Supabase Storage e retorna a URL pública.
// Retorna null se falhar (a foto base64 original fica preservada localmente).
// Tenta 2x — rede instável dentro de casa de máquinas/subsolo é comum durante a vistoria.
async function _uploadFotoStorage(base64, path, _tentativa=1, bucket='vistorias-fotos'){
  if(!base64 || base64.startsWith('http')) return base64; // já é URL ou vazio
  try{
    const [meta, data] = base64.split(',');
    const mime = (meta.match(/:(.*?);/)||[])[1]||'image/jpeg';
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
    const blob = new Blob([arr], {type:mime});
    const sbUrl = FLUXA_CONFIG.supabaseUrl;
    const sbKey = FLUXA_CONFIG.supabaseKey;
    const res = await fetch(`${sbUrl}/storage/v1/object/${bucket}/${path}`, {
      method:'POST',
      headers:{ 'apikey':sbKey, 'Authorization':'Bearer '+sbKey, 'Content-Type':mime, 'x-upsert':'true' },
      body: blob
    });
    if(!res.ok){
      console.warn('[uploadFoto] HTTP', res.status, await res.text());
      if(_tentativa<2){ await new Promise(r=>setTimeout(r,1500)); return _uploadFotoStorage(base64, path, _tentativa+1, bucket); }
      return null;
    }
    return `${sbUrl}/storage/v1/object/public/${bucket}/${path}`;
  }catch(e){
    console.warn('[uploadFoto]', e?.message||e);
    if(_tentativa<2){ await new Promise(r=>setTimeout(r,1500)); return _uploadFotoStorage(base64, path, _tentativa+1, bucket); }
    return null;
  }
}

// Sobe as fotos de um orçamento (até 6, base64) pro Storage e atualiza o
// registro remoto trocando base64 por URL — em background, depois do
// salvamento normal, sem atrasar nem arriscar o fluxo principal de salvar.
// Motivo: 15 orçamentos antigos com foto embutida chegaram a 3,2 MB no banco
// sozinhos, e isso lota o localStorage de QUALQUER aparelho que sincronize o
// histórico completo (achado durante o incidente de duplicação de clientes —
// o cache de clientes parava de salvar por falta de espaço). Foto que falhar
// no upload mantém o base64 (nunca perde a foto).
async function _fotosOrcParaStorage(orcId, fotosArr){
  if(!orcId || String(orcId).startsWith('local_') || !dbOk || !db) return;
  const lista=(fotosArr||[]).filter(Boolean);
  if(!lista.length) return;
  let mudou=false;
  const resultado=[];
  for(let i=0;i<lista.length;i++){
    const f=lista[i];
    if(!f || f.startsWith('http')){ resultado.push(f); continue; }
    const url=await _uploadFotoStorage(f, `${orcId}/${i}.jpg`, 1, 'orcamentos-fotos');
    if(url && url.startsWith('http')){ resultado.push(url); mudou=true; }
    else resultado.push(f); // upload falhou — mantém base64, não perde a foto
  }
  if(!mudou) return;
  try{
    const r=await dbUpdate('orcamentos', {foto_base64: JSON.stringify(resultado.filter(Boolean))}, 'id', orcId);
    if(r&&r.error) console.warn('[fotosOrcStorage] update falhou:', r.error.message);
  }catch(e){ console.warn('[fotosOrcStorage]', e?.message||e); }
}

// Faz upload de todas as fotos base64 de uma vistoria para o Storage.
// Retorna novo objeto rec com URLs no lugar de base64.
// Fotos que falhar no upload ficam como base64 (sem perder a foto).
async function _uploadFotosVistoria(rec){
  const equipamentos = (rec.equipamentos||[]).map(eq=>({...eq, fotos:[...(eq.fotos||[])]}));
  for(const eq of equipamentos){
    for(let i=0;i<(eq.fotos||[]).length;i++){
      const foto = eq.fotos[i];
      if(!foto || foto.startsWith('http')) continue; // null ou já é URL
      const path = `${rec.id}/${eq.id}/${i}.jpg`;
      const url = await _uploadFotoStorage(foto, path);
      if(url) eq.fotos[i] = url; // substitui base64 por URL
      // se falhar, mantém base64 para não perder a foto
    }
  }
  return {...rec, equipamentos};
}

// ── Check-in / Check-out ──
function autoCheckoutSeNecessario(){
  if(visCheckoutTime) return; // já foi feito manualmente
  visCheckoutTime = new Date();
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  const bar  = document.getElementById('vis-checkin-bar');
  const info = document.getElementById('vis-checkin-info');
  if(bar) bar.style.display='none';
  if(info && visCheckinTime){
    const entradaTxt = visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const saidaTxt   = visCheckoutTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const diff = Math.floor((visCheckoutTime-visCheckinTime)/60000);
    info.textContent = `✅ Check-in: ${entradaTxt}  ·  Check-out: ${saidaTxt}${diff>0?' · '+diff+' min':''}`;
  }
}

function visCheckin(){
  visCheckinTime = new Date();
  const info = document.getElementById('vis-checkin-info');
  const bar  = document.getElementById('vis-checkin-bar');
  const form = document.getElementById('vis-checkin-form');
  if(bar)  bar.style.display='flex';
  if(form) form.style.display='none';
  if(info) info.textContent = '📍 Check-in: '+visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  // Auto-preenche hora no campo
  const hEl = document.getElementById('vis-hora');
  if(hEl) hEl.value = visCheckinTime.toTimeString().slice(0,5);
  // Timer
  const timerEl = document.getElementById('vis-checkin-timer');
  visCheckinInterval = setInterval(()=>{
    const diff = Math.floor((Date.now()-visCheckinTime)/1000);
    const h=Math.floor(diff/3600), m=Math.floor((diff%3600)/60), s=diff%60;
    if(timerEl) timerEl.textContent=(h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s;
  },1000);
  _salvarRascunhoVis(); // check-in marca o início — protege o horário mesmo se a tela apagar
}
function visCheckout(){
  if(visCheckoutTime) return; // já registrado
  visCheckoutTime = new Date();
  setTimeout(_salvarRascunhoVis, 50);
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  const bar  = document.getElementById('vis-checkin-bar');
  const info = document.getElementById('vis-checkin-info');
  if(bar)  bar.style.display='none';
  const entradaTxt = visCheckinTime?visCheckinTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
  const saidaTxt   = visCheckoutTime.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const diff = visCheckinTime ? Math.floor((visCheckoutTime-visCheckinTime)/60000) : null;
  if(info) info.textContent = `✅ Check-in: ${entradaTxt}  ·  Check-out: ${saidaTxt}${diff!==null?' · '+diff+' min':''}`;
  toast('✅ Check-out registrado');
}

// ── Autocomplete cliente no campo vis-cli ──
function mostrarSugestoesCliVis(val){
  const sug = document.getElementById('vis-cli-suggestions'); if(!sug) return;
  if(!val||val.length<2){ sug.style.display='none'; return; }
  const clientes = JSON.parse(ls('fluxa_clientes_full')||'[]');
  const hits = clientes.filter(c=>(c.nome||'').toLowerCase().includes(val.toLowerCase())).slice(0,5);
  if(!hits.length){ sug.style.display='none'; return; }
  sug.innerHTML = hits.map(c=>`<div class="cli-suggestion-item" onmousedown="selecionarCliVis('${esc(c.nome||'')}','${esc(c.local||c.endereco||'')}','${esc(c.id||'')}')"><div class="cli-sug-name">${esc(c.nome)}</div><div class="cli-sug-tel">${esc(c.local||c.endereco||c.tel||'')}</div></div>`).join('');
  sug.style.display='block';
}
function hideSugCliVis(){ const el=document.getElementById('vis-cli-suggestions'); if(el) el.style.display='none'; }
function _visClienteEditado(){ _visClienteSelecionado=null; }
function selecionarCliVis(nome, local, id){
  const inp=document.getElementById('vis-cli'); if(inp) inp.value=nome;
  _visClienteSelecionado = id ? {id, nome} : null;
  const loc=document.getElementById('vis-loc'); if(loc&&local&&!loc.value) loc.value=local;
  // Auto-fill email from client record
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  const cli=clientes.find(c=>(c.nome||'')=== nome);
  if(cli?.email_responsavel){
    const emailInp=document.getElementById('vis-email-resp');
    if(emailInp&&!emailInp.value) emailInp.value=cli.email_responsavel;
    const st=document.getElementById('vis-email-status');
    if(st) st.textContent=`📧 ${cli.email_responsavel} (do cadastro)`;
  }
  hideSugCliVis();
  // ── Pré-carga: checar se há vistoria anterior para este cliente ──
  if(!visEditId && !window._visLocalId){ // não mostrar se veio de um plano
    const todasVis = lsVisLer().filter(v=>(v.cliente||'').toLowerCase()===nome.toLowerCase() && v.equipamentos);
    if(todasVis.length){
      todasVis.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
      const ultima = todasVis[0];
      window._visPreCargaRec = ultima;
      const dataFmt = ultima.data ? new Date(ultima.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '';
      const equips=(typeof ultima.equipamentos==='string'?JSON.parse(ultima.equipamentos||'[]'):ultima.equipamentos)||[];
      const txtEl=document.getElementById('vis-precarga-txt');
      const subEl=document.getElementById('vis-precarga-sub');
      if(txtEl) txtEl.textContent=`Vistoria de ${dataFmt} encontrada (${equips.length} equipamentos)`;
      if(subEl) subEl.textContent='Carregar lista de equipamentos desta visita?';
      const banner=document.getElementById('vis-precarga-banner');
      if(banner) banner.style.display='flex';
    } else {
      dispensarPreCarga();
    }
  }
}

function confirmarPreCarga(){
  const vis = window._visPreCargaRec;
  if(!vis){ dispensarPreCarga(); return; }
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  // Separa custom (não está no VIS_EQUIPAMENTOS_DEFAULT) de padrão
  const stdDefs = VIS_EQUIPAMENTOS_DEFAULT.map(x=>x.id);
  const stdEquips = equips.filter(e=>stdDefs.includes(e.id));
  const customEquips = equips.filter(e=>!stdDefs.includes(e.id));
  // Reset estado
  visEquipSelecionados = stdEquips.map(e=>e.id);
  _visEquipsCustom = customEquips.map(e=>({id:e.id, nome:e.nome, emoji:e.emoji||'⚙️', marca:e.marca||'', modelo:e.modelo||'', potencia:e.potencia||'', ficha:e.ficha||'', ambiente:e.ambiente||''}));
  // Status todos reset para 'na' — técnico preenche de novo
  visEquipDados = {};
  visAmbienteObs={};
  equips.forEach(e=>{ visEquipDados[e.id]={status:'na',obs:'',fotos:[]}; });
  renderVisChips();
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=(visEquipSelecionados.length||_visEquipsCustom.length)?'':'none';
  dispensarPreCarga();
  toast('✅ Equipamentos carregados da última vistoria');
}

function dispensarPreCarga(){
  const banner=document.getElementById('vis-precarga-banner');
  if(banner) banner.style.display='none';
  window._visPreCargaRec = null;
}

// Monta a lista de equipamentos do form (planos custom + chips padrão)
function _montarEquipamentosVistoria(){
  const customIds=(_visEquipsCustom||[]).map(e=>e.id);
  return [
    ...(_visEquipsCustom||[]).map(ceq=>{
      const d=visEquipDados[ceq.id]||{status:'na',obs:'',fotos:[]};
      return {id:ceq.id,nome:ceq.nome,emoji:ceq.emoji||'⚙️',marca:ceq.marca||'',modelo:ceq.modelo||'',potencia:ceq.potencia||'',ficha:ceq.ficha||'',ambiente:ceq.ambiente||'',status:d.status,obs:d.obs||'',fotos:(d.fotos||[]).filter(Boolean)};
    }),
    ...visEquipSelecionados.filter(id=>!customIds.includes(id)).map(id=>{
      const def=VIS_EQUIPAMENTOS_DEFAULT.find(x=>x.id===id)||{id,nome:id,emoji:''};
      const d=visEquipDados[id]||{status:'na',obs:'',fotos:[]};
      return {id,nome:def.nome,emoji:def.emoji,modelo:'',potencia:'',status:d.status,obs:d.obs||'',fotos:(d.fotos||[]).filter(Boolean)};
    })
  ];
}
// Monta o registro da vistoria a partir do formulário. Reusa o mesmo id durante
// toda a edição (visEditId ou _visDraftId) — Salvar e Gerar PDF gravam o MESMO
// registro, sem criar duplicata.
// Idempotência: acha vistoria já existente do mesmo local no mesmo mês, para
// reaproveitar o id em vez de criar duplicata. Usado pelos 3 fluxos de vistoria.
function _vistoriaExistente(localId, mesRef){
  if(!localId||!mesRef) return null;
  return lsVisLer().find(v=> v.local_id===localId && ((v.mes_ref||'')===mesRef || (v.data||'').startsWith(mesRef))) || null;
}
// Empresa de uma vistoria/local: herda do LOCAL/plano; fallback à sessão/loja ativa.
function _lojaDaVistoria(loc){
  const s=getSessao();
  if(loc && loc.loja_id && loc.loja_id!=='default') return loc.loja_id;
  return s?.loja_id||lojaAtiva||LOJA_PADRAO_ID;
}
function _montarRecVistoria(){
  const s=getSessao();
  const _nw=new Date(); const _nm=`${_nw.getFullYear()}-${String(_nw.getMonth()+1).padStart(2,'0')}`;
  const mesRef=document.getElementById('vis-mes-ref')?.value||_nm;
  // Reusa o MESMO registro durante a edição; e, vindo de um plano, reusa a
  // vistoria já existente do local naquele mês (não duplica).
  let id=visEditId||_visDraftId;
  if(!id){
    const exist=window._visLocalId ? _vistoriaExistente(window._visLocalId, mesRef) : null;
    id=exist?exist.id:('vis_'+Date.now());
  }
  const hora=document.getElementById('vis-hora')?.value||'';
  // A vistoria herda a empresa do LOCAL/plano — não da sessão do técnico.
  // Ao EDITAR uma vistoria existente, preserva a empresa original (não recalcula).
  const _loc=window._visLocalId ? (locaisVistoria||[]).find(x=>x.id===window._visLocalId) : null;
  const _editExist=visEditId ? lsVisLer().find(v=>v.id===visEditId) : null;
  const _lojaRec=(_editExist&&_editExist.loja_id&&_editExist.loja_id!=='default') ? _editExist.loja_id : _lojaDaVistoria(_loc);
  // Cliente: usa o campo; se vazio mas veio de um plano, herda o cliente do plano
  // (rede de segurança contra salvar com nome errado/em branco).
  let _cli=(document.getElementById('vis-cli')?.value||'').trim();
  if(!_cli && _loc && _loc.cliente){ _cli=_loc.cliente; const _ci=document.getElementById('vis-cli'); if(_ci) _ci.value=_cli; }
  // Mesma rede de segurança do nome: sem cliente_id escolhido no campo, mas
  // veio de um plano que já tem cliente_id, herda dali.
  const _cliId=_visClienteSelecionado?.id || _loc?.cliente_id || null;
  return {
    id,
    loja_id: _lojaRec,
    local_id: window._visLocalId||'',
    cliente:_cli,
    cliente_id:_cliId,
    local:(document.getElementById('vis-loc')?.value||'').trim(),
    data: document.getElementById('vis-data')?.value||_hojeLocal(),
    hora,
    tecnico: (document.getElementById('vis-tec')?.value||'')||(s?.nome||''),
    mes_ref: mesRef,
    hora_checkin: visCheckinTime?visCheckinTime.toTimeString().slice(0,5):hora,
    hora_checkout: visCheckoutTime?visCheckoutTime.toTimeString().slice(0,5):null,
    obs_geral: document.getElementById('vis-obs')?.value||'',
    recomendacoes: (document.getElementById('vis-recom')?.value||'').trim(),
    obs_ambientes: _montarObsAmbientes(),
    email_responsavel: (document.getElementById('vis-email-resp')?.value||'').trim()||null,
    equipamentos: _montarEquipamentosVistoria(),
    created_at: new Date().toISOString()
  };
}
// Só as observações de ambientes que existem nesta vistoria e têm texto.
function _montarObsAmbientes(){
  const ambsPresentes=new Set((_visEquipsCustom||[]).map(e=>(e.ambiente||'').trim()).filter(Boolean));
  const out={};
  Object.keys(visAmbienteObs||{}).forEach(k=>{ if(ambsPresentes.has(k) && (visAmbienteObs[k]||'').trim()) out[k]=visAmbienteObs[k].trim(); });
  return out;
}
// Salva a vistoria: LOCAL na hora (rápido), nuvem em BACKGROUND com timeout.
// A UI nunca trava esperando rede. Usado por Salvar e por Gerar PDF.
function _persistVistoria(rec){
  const lista=lsVisLer();
  const idx=lista.findIndex(x=>x.id===rec.id);
  rec._pendingSync = true; // marcada para reenvio; limpa após sync com sucesso
  if(idx>=0){ rec.created_at = lista[idx].created_at || rec.created_at; lista[idx]=rec; }
  else lista.unshift(rec);
  lsVisSalvar(lista);
  _visDraftId = rec.id; // marca: este form já tem registro → próximas gravações atualizam o mesmo
  if(dbOk&&db){
    (async()=>{
      try{
        // Faz upload das fotos base64 para o Storage e substitui por URLs públicas.
        // Fotos com upload bem-sucedido ficam acessíveis de qualquer dispositivo.
        // Fotos que falharem (2 tentativas) ficam como base64 MESMO NO SUPABASE —
        // antes esse slot virava null no banco (foto sobrevivia só no aparelho
        // local e sumia do relatório/de outros dispositivos). Base64 no jsonb é
        // mais pesado, mas nunca perde a foto.
        const recComUrls = await _uploadFotosVistoria(rec);
        // Atualiza localStorage com as URLs (substitui base64 pelas URLs que subiram)
        const listaAtual = lsVisLer();
        const idxAtual = listaAtual.findIndex(x=>x.id===rec.id);
        if(idxAtual>=0) listaAtual[idxAtual]=recComUrls;
        else listaAtual.unshift(recComUrls);
        lsVisSalvar(listaAtual);
        const recParaSupabase = recComUrls;
        const r=await _comTimeout(dbUpsert('vistorias', recParaSupabase), 20000, 'sync vistoria');
        if(r&&r.error){ console.warn('Visita Supabase err:', r.error.message); toast('⚠️ Vistoria salva localmente mas não sincronizou: '+r.error.message); }
        else{
          // Sync do registro OK — mas só limpa _pendingSync se TODAS as fotos
          // também subiram pro Storage. Foto que falhou 2x fica em base64 dentro
          // do jsonb (não perde a foto), porém sem essa flag o reenvio automático
          // (loadVistoriasRemoto/_reenviarPendentes) nunca mais tentaria de novo.
          const temFotoPendente = (recComUrls.equipamentos||[]).some(eq=>(eq.fotos||[]).some(f=>f && !String(f).startsWith('http')));
          const _ls=lsVisLer(); const _i=_ls.findIndex(x=>x.id===rec.id);
          if(_i>=0){ if(temFotoPendente) _ls[_i]._pendingSync=true; else delete _ls[_i]._pendingSync; lsVisSalvar(_ls); }
        }
      }catch(e){ console.warn('Visita Supabase sync (bg):', e?.message||e); toast('⚠️ Vistoria salva localmente mas não sincronizou com a nuvem. Será reenviada na próxima conexão.'); }
    })();
  }
}

// ── Salvar vistoria (não-bloqueante: local imediato, rede em background) ──
// Retorna true se salvou com sucesso (para finalizarVistoria poder navegar).
// Cliente vazio ao finalizar: em vez de falhar calado (o campo pode estar
// recolhido), abre "Dados da Visita" e foca o campo para o usuário ver onde é.
function _pedirClienteVis(){
  const body=document.getElementById('vis-dados-body');
  const lbl=document.getElementById('vis-dados-toggle');
  if(body) body.style.display='';
  if(lbl) lbl.textContent='▲ recolher';
  const cli=document.getElementById('vis-cli');
  if(cli){ cli.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>cli.focus(),300); }
  toast('⚠️ Informe o cliente (campo destacado acima)');
}
async function salvarVistoria(){
  autoCheckoutSeNecessario();
  // herda cliente do plano se o campo estiver vazio (rede de segurança)
  { const _loc=window._visLocalId?(locaisVistoria||[]).find(x=>x.id===window._visLocalId):null; const _ci=document.getElementById('vis-cli'); if(_ci && !_ci.value.trim() && _loc?.cliente) _ci.value=_loc.cliente; }
  const cli  = (document.getElementById('vis-cli')?.value||'').trim();
  const emailResp = (document.getElementById('vis-email-resp')?.value||'').trim();
  if(!cli){ _pedirClienteVis(); return false; }
  if(emailResp && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailResp)){ toast('⚠️ E-mail inválido — corrija ou deixe em branco'); return false; }
  const _btnVis=document.querySelector('button[onclick="finalizarVistoria()"]');
  if(_btnVis){ _btnVis.disabled=true; _btnVis.textContent='Salvando…'; }

  try{
    const veioDoPlano = !!(window._visLocalId); // lido ANTES de zerar
    const rec = _montarRecVistoria();
    _persistVistoria(rec);          // local imediato + nuvem em background
    window._visLocalId = null;

    // Feedback IMEDIATO — não espera a rede.
    toast('✅ Vistoria salva!');
    visEditId = null;
    renderVisHistorico();
    const planoBanner = document.getElementById('vis-plano-banner');
    if(planoBanner) planoBanner.style.display='none';
    if(veioDoPlano){ setTimeout(()=>visTab('locais'), 600); }

    // ── Auto-envio de e-mail em BACKGROUND ──
    const stEl = document.getElementById('vis-email-status');
    if(emailResp && emailJSConfigurado()){
      if(stEl) stEl.textContent = '📨 Enviando e-mail…';
      (async()=>{
        try{
          const ok = await _comTimeout(enviarEmailVistoria(rec), 60000, 'email vistoria');
          if(stEl) stEl.textContent = ok ? `✅ E-mail enviado para ${emailResp}` : '❌ Falha no envio do e-mail (ver console)';
          toast(ok ? `📧 Relatório enviado para ${emailResp}` : '⚠️ E-mail não enviado (confira Empresa → E-mail)');
        }catch(e){
          console.warn('[email vistoria]', e?.message||e);
          if(stEl) stEl.textContent = '❌ E-mail demorou demais ou falhou';
          toast('⚠️ E-mail não enviado — verifique a conexão');
        }
      })();
    } else if(emailResp && !emailJSConfigurado()){
      if(stEl) stEl.textContent = '⚠️ Configure o EmailJS em Empresa → E-mail Automático para enviar';
      toast('⚠️ EmailJS não configurado — e-mail não enviado');
    }
    return true;
  }catch(e){
    console.error('[salvarVistoria]', e);
    toast('❌ Erro: '+(e?.message||String(e)));
    return false;
  }finally{
    if(_btnVis){ _btnVis.disabled=false; _btnVis.textContent='✅ Finalizar Vistoria'; }
  }
}

// ── Limpa o estado e os campos do formulário de vistoria (sem mudar de aba) ──
// Restaura a seção de check-in ao estado inicial (botão visível, barra oculta).
// Sem isto, depois de um check-out a próxima vistoria ficava sem o botão de
// check-in (form e barra ambos ocultos) até recarregar a página.
function _resetCheckinVis(){
  const form=document.getElementById('vis-checkin-form');
  const bar =document.getElementById('vis-checkin-bar');
  const info=document.getElementById('vis-checkin-info');
  const timer=document.getElementById('vis-checkin-timer');
  if(form) form.style.display='flex';
  if(bar)  bar.style.display='none';
  if(info) info.textContent='';
  if(timer) timer.textContent='00:00';
}
function _limparFormVistoria(){
  _limparRascunhoVis(); // vistoria finalizada → rascunho não deve ressuscitar
  _visDraftRestaurado=false;
  visEquipSelecionados=[]; // faltava zerar — chips do form anterior ficavam marcados no próximo
  visEquipDados = {};
  visAmbienteObs={};
  _visEquipsCustom = [];
  visCheckinTime = null;
  visCheckoutTime = null;
  visEditId = null;
  _visDraftId = null;
  _visClienteSelecionado = null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval = null; }
  _resetCheckinVis();
  window._visLocalId = null;
  const banner=document.getElementById('vis-plano-banner'); if(banner) banner.style.display='none';
  // Limpa campos do form
  ['vis-cli','vis-loc','vis-hora','vis-obs','vis-recom','vis-email-resp'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const hoje = new Date();
  const _ld=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const dd = document.getElementById('vis-data'); if(dd) dd.value = _ld;
  const mm = document.getElementById('vis-mes-ref'); if(mm) mm.value = _ld.slice(0,7);
  const st = document.getElementById('vis-email-status'); if(st) st.textContent='';
  renderVisChips();
  renderVisEquipGrid();
}

// Cancela a vistoria em andamento (nova ou edição) e descarta o progresso —
// hoje só dava pra "sair" clicando Finalizar; sem opção de desistir mesmo.
// Sempre passa por confirmação (nunca window.confirm — proibido no app).
function descartarVistoriaEmAndamento(){
  const emEdicao = !!visEditId;
  const temAlgo = !!(document.getElementById('vis-cli')?.value||'').trim()
    || visEquipSelecionados.length || (_visEquipsCustom||[]).length || !!visCheckinTime;
  if(!temAlgo){ toast('Nada para descartar.'); return; }
  const msg = emEdicao
    ? 'As alterações feitas nesta edição serão descartadas. A vistoria já salva não será apagada.'
    : 'Tudo que foi preenchido nesta vistoria (equipamentos, status, observações, fotos) será descartado e não poderá ser recuperado.';
  confirmar(msg, ()=>{
    const voltaPra = emEdicao ? 'hist' : 'nova';
    _limparFormVistoria();
    toast(emEdicao ? '↩️ Edição descartada' : '🗑️ Vistoria descartada');
    visTab(voltaPra);
  }, emEdicao?'Descartar edição?':'Descartar vistoria?', null, 'Continuar preenchendo', emEdicao?'Descartar edição':'Descartar tudo');
}

// ── Finalizar vistoria: salva, limpa o form e navega para o histórico ──
let _finalizandoVis=false;
async function finalizarVistoria(){
  if(_finalizandoVis) return; // trava contra múltiplos cliques enquanto processa
  _finalizandoVis=true;
  try{
    const ok = await salvarVistoria();
    if(ok){
      _limparFormVistoria(); // previne re-submit acidental ao voltar para "Nova Vistoria"
      setTimeout(()=>visTab('hist'), 300);
    }
  }finally{ _finalizandoVis=false; }
}

// ── Histórico ──
function renderVisHistorico(){
  const el = document.getElementById('vis-hist-body'); if(!el) return;
  const busca = (document.getElementById('vis-hist-busca')?.value||'').toLowerCase();
  const mes   = document.getElementById('vis-hist-mes')?.value||'';
  const tecFilt = document.getElementById('vis-hist-tec')?.value||'';
  // Botão de backup do arquivo: só gestor
  const _btnBkp=document.getElementById('vis-btn-backup');
  if(_btnBkp) _btnBkp.style.display=eGestor()?'':'none';
  // Escopo de empresa: histórico, stats, ranking e alertas só da empresa em foco
  let listaTotal = lsVisLer().filter(v=>escopoEmpresaMatch(v.loja_id));
  let lista = listaTotal;
  // Filtros textuais + mês + técnico
  if(busca) lista = lista.filter(v=>(v.cliente||'').toLowerCase().includes(busca)||(v.local||'').toLowerCase().includes(busca));
  if(mes)   lista = lista.filter(v=>(v.mes_ref||v.data||'').startsWith(mes));
  if(tecFilt) lista = lista.filter(v=>(v.tecnico||'')=== tecFilt);
  // Filtro por status
  if(visHistStatusFilt){
    lista = lista.filter(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      return equips.some(e=>e.status===visHistStatusFilt);
    });
  }
  // Sort desc
  lista.sort((a,b)=>(b.data||'').localeCompare(a.data||''));

  // ── Stats cards ──
  const statsEl = document.getElementById('vis-stats-row');
  if(statsEl){
    const scope = mes ? listaTotal.filter(v=>(v.mes_ref||v.data||'').startsWith(mes)) : listaTotal;
    const total = scope.length;
    // Conta críticos e atenções
    let comCritico=0, comAtencao=0;
    scope.forEach(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      if(equips.some(e=>e.status==='critico')) comCritico++;
      else if(equips.some(e=>e.status==='atencao')) comAtencao++;
    });
    const statCard=(val,lbl,cor,bg)=>`<div style="background:${bg};border-radius:12px;padding:14px 10px;text-align:center"><div style="font-size:24px;font-weight:800;color:${cor}">${val}</div><div style="font-size:10px;font-weight:600;color:${cor};opacity:.8;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${lbl}</div></div>`;
    statsEl.innerHTML=statCard(total,'Vistorias','var(--c2)','var(--white)')+statCard(comAtencao,'c/ Atenção','var(--yellow)','var(--yellow-bg)')+statCard(comCritico,'c/ Crítico','var(--red)','var(--red-bg)');
  }

  // ── Painel de alertas críticos (clientes com ≥1 item crítico, mês atual se sem filtro) ──
  const alertPanel = document.getElementById('vis-alerta-criticos-panel');
  if(alertPanel){
    const mesAlerta = mes || _hojeLocal().slice(0,7);
    const scopeAlerta = listaTotal.filter(v=>(v.mes_ref||v.data||'').startsWith(mesAlerta));
    const criticos = scopeAlerta.filter(v=>{
      const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
      return equips.some(e=>e.status==='critico');
    });
    if(criticos.length){
      alertPanel.style.display='block';
      const mesNome = new Date(mesAlerta+'-02').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      alertPanel.innerHTML=`<div class="vis-alerta-criticos"><div class="vis-alerta-hdr">🔴 ${criticos.length} cliente${criticos.length>1?'s':''} com itens críticos em ${mesNome}</div>${criticos.map(v=>{
        const equips=(typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
        const criticoItems=equips.filter(e=>e.status==='critico').map(e=>e.nome||e.id);
        return `<div class="vis-alerta-item" onclick="abrirVisRelatorio('${v.id}')">
          <div><div style="font-weight:700;color:var(--c2);font-size:13px">${esc(v.cliente||'')}</div><div style="font-size:11px;color:var(--red);margin-top:2px">${criticoItems.map(esc).join(', ')}</div></div>
          <div style="font-size:11px;color:var(--gray)">${v.data?new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):''} →</div>
        </div>`;
      }).join('')}</div>`;
    } else {
      alertPanel.style.display='none';
    }
  }

  // ── Popula select de técnicos ──
  const tecSel = document.getElementById('vis-hist-tec');
  if(tecSel && tecSel.options.length === 1){
    const tecs=[...new Set(listaTotal.map(v=>v.tecnico).filter(Boolean))].sort();
    tecs.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; tecSel.appendChild(o); });
  }

  // ── Ranking ──
  const rankCard = document.getElementById('vis-ranking-card');
  const rankBody = document.getElementById('vis-ranking-body');
  const rankScope = mes ? listaTotal.filter(v=>(v.mes_ref||v.data||'').startsWith(mes)) : listaTotal;
  if(rankCard && rankBody && rankScope.length){
    const counts={};
    rankScope.forEach(v=>{ if(v.tecnico) counts[v.tecnico]=(counts[v.tecnico]||0)+1; });
    const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const max=sorted[0]?.[1]||1;
    rankCard.style.display='';
    rankBody.innerHTML=sorted.map(([tec,cnt],i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i<sorted.length-1?'border-bottom:1px solid var(--gray-light)':''}">
        <div style="font-size:13px;font-weight:700;color:var(--gray);min-width:22px;text-align:center">${i+1}º</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c2);margin-bottom:4px">${esc(tec)}</div>
          <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden">
            <div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(cnt/max*100)}%"></div>
          </div>
        </div>
        <div style="font-size:18px;font-weight:800;color:var(--c1);min-width:28px;text-align:right">${cnt}</div>
      </div>`).join('');
  } else if(rankCard) rankCard.style.display='none';
  if(!lista.length){
    el.innerHTML='<div style="padding:28px;text-align:center;color:var(--gray);font-size:13px">Nenhuma vistoria encontrada.<br><button class="btn-primary" style="margin-top:12px" onclick="visTab(\'nova\')">＋ Nova Vistoria</button></div>';
    return;
  }
  const statusIcon = { bom:'✅', atencao:'⚠️', critico:'🔴', na:'—' };
  const statusBg   = { bom:'var(--green-bg)', atencao:'var(--yellow-bg)', critico:'var(--red-bg)', na:'var(--gray-light)' };
  const statusClr  = { bom:'var(--green)', atencao:'var(--yellow)', critico:'var(--red)', na:'var(--gray)' };
  el.innerHTML = lista.map(v=>{
    const equips = (typeof v.equipamentos==='string'?JSON.parse(v.equipamentos||'[]'):v.equipamentos)||[];
    const mRef = v.mes_ref?new Date(+v.mes_ref.split('-')[0],+v.mes_ref.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'';
    // Conta status
    const cnt = { bom:0, atencao:0, critico:0 };
    equips.filter(e=>e.status!=='na').forEach(e=>{ if(cnt[e.status]!==undefined) cnt[e.status]++; });
    const dataFmt = v.data?new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'';
    return `<div class="vis-history-item" onclick="abrirVisRelatorio('${v.id}')">
      <div style="flex:1;min-width:0">
        <div class="vis-hist-data">${dataFmt}${mRef?' · '+mRef:''}</div>
        <div class="vis-hist-cli">${esc(v.cliente||'')}${v.local?' · '+esc(v.local):''}${(()=>{ if(!lojaAtiva&&v.loja_id&&v.loja_id!=='default'){ const _lv=getLoja(v.loja_id); return _lv?` <span class="loja-badge ${_lv.cor}" style="font-size:9px;vertical-align:middle">${_lv.nome.replace('Fortemp ','')}</span>`:'' } return ''; })()}</div>
        <div class="vis-hist-cli" style="margin-top:2px">👤 ${esc(v.tecnico||'')} · ${equips.length} equip.${v.email_responsavel?' · 📧 '+esc(v.email_responsavel):''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        <div class="vis-hist-badges">
          ${cnt.critico?`<span class="vis-hist-badge" style="background:var(--red-bg);color:var(--red)">🔴 ${cnt.critico}</span>`:''}
          ${cnt.atencao?`<span class="vis-hist-badge" style="background:var(--yellow-bg);color:var(--yellow)">⚠️ ${cnt.atencao}</span>`:''}
          ${cnt.bom?`<span class="vis-hist-badge" style="background:var(--green-bg);color:var(--green)">✅ ${cnt.bom}</span>`:''}
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
          ${v.email_responsavel?`<button class="tb" title="Reenviar e-mail" onclick="event.stopPropagation();reenviarEmailVistoria('${v.id}')" style="font-size:11px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">📧</button>`:''}
          <button class="tb" title="Enviar resumo via WhatsApp" onclick="event.stopPropagation();enviarWAResumoVistoria('${v.id}')" style="font-size:11px;background:var(--wa-light,#dcfce7);color:var(--wa);border-color:var(--wa-light,#dcfce7)">💬</button>
          <button class="tb" title="Editar / refazer vistoria" onclick="event.stopPropagation();editarVistoria('${v.id}')" style="font-size:11px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">✏️</button>
          ${(!eTecnico() && (cnt.critico||cnt.atencao))?`<button class="tb" title="Gerar orçamento com os itens críticos e de atenção desta vistoria" onclick="event.stopPropagation();orcarDaVistoria('${v.id}')" style="font-size:11px;background:var(--c1);color:white;border-color:var(--c1);font-weight:700">💰 Orçar ${cnt.critico+cnt.atencao}</button>`:''}
          ${(!eTecnico() && cnt.critico)?`<button class="tb" title="Laudo para o síndico apresentar na assembleia" onclick="event.stopPropagation();gerarDossieAssembleia('${v.id}')" style="font-size:11px;background:var(--c2);color:white;border-color:var(--c2);font-weight:700">🗳️ Dossiê</button>`:''}
          <button class="tb" title="Ver relatório" onclick="event.stopPropagation();abrirVisRelatorio('${v.id}')" style="font-size:11px;background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bg)">👁 Ver</button>
          <button class="tb" title="Baixar PDF" onclick="event.stopPropagation();baixarPDFVistoria('${v.id}',this)" style="font-size:11px;background:var(--c1-light);color:var(--c1);border-color:var(--c1-light)">📥 PDF</button>
          ${!eTecnico()?`<button class="tb" title="Excluir (permanente — remove do arquivo!)" onclick="event.stopPropagation();excluirVistoria('${v.id}')" style="background:var(--red-bg);color:var(--red);border-color:var(--red-bg);font-size:11px">✕</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Vistoria → Orçamento ────────────────────────────────────────────────────
// O ciclo natural do negócio é vistoria → orçamento → OS → vistoria seguinte, e
// o elo do meio faltava: em 05/08 a vistoria do Infinity Coast Tower registrou
// 13 itens críticos/atenção e nenhum virou orçamento. Conserto detectado em
// vistoria é SERVIÇO — o trilho que converte 43,5%, contra 8% do equipamento.
function _visItensOrcaveis(v){
  const eq = typeof v.equipamentos==='string' ? JSON.parse(v.equipamentos||'[]') : (v.equipamentos||[]);
  return eq.filter(e=>e.status==='critico'||e.status==='atencao');
}
function orcarDaVistoria(id){
  const v=lsVisLer().find(x=>String(x.id)===String(id));
  if(!v){ toast('Vistoria não encontrada'); return; }
  const itens=_visItensOrcaveis(v);
  if(!itens.length){ toast('Nenhum item crítico ou de atenção nesta vistoria'); return; }

  const criticos=itens.filter(e=>e.status==='critico').length;
  confirmar(
    `Vou criar um orçamento para ${v.cliente||'este cliente'} com ${itens.length} item(ns) apontado(s) na vistoria de ${_fmtDataBR(v.data)}${criticos?` — ${criticos} crítico(s)`:''}. Você revisa os preços antes de salvar.`,
    ()=>_orcarDaVistoriaConfirmado(v, itens),
    'Gerar orçamento da vistoria?', null, 'Cancelar', 'Gerar orçamento'
  );
}
function _orcarDaVistoriaConfirmado(v, itens){
  novoOrc();
  window._skipDraftForm=true; // não deixa rascunho antigo sobrescrever
  setTimeout(()=>{
    setV('cli', v.cliente||'');
    setV('loc', v.local||'');
    // Cliente com vistoria é cliente da casa — não é lead novo.
    setOrigemCli('Já é cliente');
    // Critico primeiro: é a ordem em que o síndico precisa ler.
    const ordenados=[...itens].sort((a,b)=>(a.status==='critico'?0:1)-(b.status==='critico'?0:1));
    svcs=[];
    ordenados.forEach(e=>{
      const nome=e.nome||e.id;
      const amb=(e.ambiente||'').trim();
      const marca=[e.marca,e.modelo].filter(Boolean).join(' ');
      const prob=(e.obs||'').trim();
      // Descrição carrega o laudo: é o argumento de venda, e veio do técnico.
      const d=[
        e.status==='critico'?'[URGENTE]':'[Preventivo]',
        amb?amb+' —':'',
        nome,
        marca?`(${marca})`:'',
        prob?`: ${prob}`:''
      ].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
      addSvc(d, '', 1);
    });
    setV('escopo', `Serviços apontados na vistoria de ${_fmtDataBR(v.data)}${v.tecnico?` (técnico: ${v.tecnico})`:''}.`);
    setV('nota-interna', `Gerado da vistoria ${v.id}`);
    renderSvcs(); upd();
    toast(`📋 ${itens.length} item(ns) importado(s) — revise os preços`);
    logAcao?.('orcamento_da_vistoria', `${v.cliente||''} — ${itens.length} itens`);
  }, 60);
}
function _fmtDataBR(d){
  if(!d) return '—';
  try{ return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); }catch(e){ return d; }
}

// ── DOSSIÊ DE ASSEMBLEIA ────────────────────────────────────────────────────
// Equipamento acima de R$ 50k converte 0%. A hipótese é que o síndico não
// consegue defender esse valor numa assembleia com um PDF de itens e preço:
// ele precisa mostrar o problema, a consequência de não fazer e a urgência.
// Este documento é feito para ser APRESENTADO por ele, não lido por ele.
//
// O texto é determinístico (regra por tipo de equipamento + status), não
// gerado por IA: funciona offline, sem chave de API e sem custo. A camada de
// IA fica para o polimento de redação, se fizer falta — ver docs/.
const _DOSSIE_CONSEQ = [
  { rx:/trocador|aquecedor|bomba de calor|fromtherm|jelly/i, critico:'Piscina sem aquecimento — em pleno uso da temporada, o condomínio perde a área de lazer aquecida e o equipamento parado tende a agravar o dano.', atencao:'Perda de eficiência no aquecimento: consumo de energia maior para entregar a mesma temperatura, e risco de parada no meio da temporada.' },
  { rx:/motobomba|bomba/i, critico:'Sem circulação de água a piscina fica imprópria para banho em poucos dias: a água não passa pelo filtro nem recebe tratamento.', atencao:'Circulação abaixo do ideal: filtragem menos eficiente e desgaste acelerado do conjunto motor.' },
  { rx:/filtro/i, critico:'Sem filtragem, a água perde transparência e a qualidade sanitária cai — risco direto ao banhista.', atencao:'Filtragem comprometida: maior consumo de químicos para manter a água dentro do padrão.' },
  { rx:/sauna/i, critico:'Sauna fora de operação — área de lazer indisponível aos condôminos.', atencao:'Aquecimento irregular da sauna, com risco de parada total.' },
  { rx:/ilumina/i, critico:'Iluminação submersa inoperante representa risco de segurança no uso noturno.', atencao:'Iluminação parcial: conforto e segurança reduzidos no período noturno.' },
  { rx:/automa|dosador|cloro|ozon/i, critico:'Sem dosagem automática, o controle químico passa a depender de ajuste manual, com risco de água fora do padrão.', atencao:'Dosagem irregular: variação na qualidade da água e maior consumo de produto.' }
];
function _dossieConsequencia(nome, status){
  const r=_DOSSIE_CONSEQ.find(x=>x.rx.test(nome||''));
  if(r) return status==='critico' ? r.critico : r.atencao;
  return status==='critico'
    ? 'Equipamento fora de operação, comprometendo o funcionamento normal da área de lazer.'
    : 'Desgaste identificado: sem correção, tende a evoluir para parada do equipamento.';
}
function gerarDossieAssembleia(id){
  const v=lsVisLer().find(x=>String(x.id)===String(id));
  if(!v){ toast('Vistoria não encontrada'); return; }
  const itens=_visItensOrcaveis(v);
  if(!itens.length){ toast('Esta vistoria não tem itens críticos ou de atenção'); return; }

  const LC=getLojaConfig(v.loja_id||lojaAtiva);
  const criticos=itens.filter(e=>e.status==='critico');
  const atencao=itens.filter(e=>e.status==='atencao');
  const _fotoDe=e=>{ const f=(e.fotos||[]).filter(Boolean)[0]; return f||null; };

  const blocoCritico=criticos.map((e,i)=>{
    const foto=_fotoDe(e);
    return `<div class="ds-item ds-crit">
      <div class="ds-item-hd"><span class="ds-num">${i+1}</span>
        <div><div class="ds-item-nm">${esc(e.nome||e.id)}</div>
        ${e.ambiente?`<div class="ds-item-amb">📍 ${esc(e.ambiente)}</div>`:''}</div>
        <span class="ds-tag ds-tag-crit">AÇÃO IMEDIATA</span></div>
      ${e.obs?`<div class="ds-lb">O que foi encontrado</div><div class="ds-tx">${esc(e.obs)}</div>`:''}
      <div class="ds-lb">Se não for feito</div><div class="ds-tx ds-conseq">${esc(_dossieConsequencia(e.nome,'critico'))}</div>
      ${foto?`<img class="ds-foto" src="${esc(foto)}" alt="Registro fotográfico">`:''}
    </div>`;
  }).join('');

  const blocoAtencao=atencao.length?`<div class="ds-sec-t">Itens para programar</div>
    <table class="ds-tb"><thead><tr><th>Equipamento</th><th>Local</th><th>Situação</th></tr></thead><tbody>
    ${atencao.map(e=>`<tr><td><strong>${esc(e.nome||e.id)}</strong></td><td>${esc(e.ambiente||'—')}</td><td>${esc(e.obs||_dossieConsequencia(e.nome,'atencao'))}</td></tr>`).join('')}
    </tbody></table>`:'';

  const css=`
    body{margin:0;padding:80px 20px 40px;background:#f3f4f6;font-family:Inter,-apple-system,sans-serif;color:#111827}
    .ds{max-width:794px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.15);overflow:hidden}
    .ds-hd{background:${LC.cor||'#C45E0A'};color:#fff;padding:26px 32px}
    .ds-hd h1{margin:0 0 4px;font-size:21px;font-weight:800}
    .ds-hd .ds-sub{font-size:13px;opacity:.9}
    .ds-bd{padding:28px 32px}
    .ds-cli{font-size:19px;font-weight:800;margin-bottom:2px}
    .ds-meta{font-size:12px;color:#6b7280;margin-bottom:20px}
    .ds-resumo{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
    .ds-kpi{flex:1;min-width:130px;border-radius:10px;padding:14px 16px;border:1.5px solid #e5e7eb}
    .ds-kpi.c{background:#fee2e2;border-color:#fecaca}
    .ds-kpi.a{background:#fef3c7;border-color:#fde68a}
    .ds-kpi-v{font-size:26px;font-weight:800;line-height:1}
    .ds-kpi.c .ds-kpi-v{color:#b91c1c}.ds-kpi.a .ds-kpi-v{color:#b45309}
    .ds-kpi-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#4b5563;margin-top:5px}
    .ds-sec-t{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${LC.cor||'#C45E0A'};border-bottom:2px solid #f3f4f6;padding-bottom:7px;margin:26px 0 14px}
    .ds-item{border:1.5px solid #e5e7eb;border-radius:10px;padding:16px 18px;margin-bottom:14px;page-break-inside:avoid}
    .ds-crit{border-left:4px solid #ef4444}
    .ds-item-hd{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
    .ds-num{background:#ef4444;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}
    .ds-item-nm{font-size:15px;font-weight:700}
    .ds-item-amb{font-size:11px;color:#6b7280;margin-top:1px}
    .ds-tag{margin-left:auto;font-size:9px;font-weight:800;padding:4px 8px;border-radius:5px;white-space:nowrap}
    .ds-tag-crit{background:#fee2e2;color:#b91c1c}
    .ds-lb{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;margin-top:9px}
    .ds-tx{font-size:13px;line-height:1.5;margin-top:3px}
    .ds-conseq{background:#fef2f2;border-left:3px solid #fca5a5;padding:8px 11px;border-radius:0 6px 6px 0}
    .ds-foto{width:100%;max-height:230px;object-fit:cover;border-radius:7px;margin-top:11px}
    .ds-tb{width:100%;border-collapse:collapse;font-size:12px}
    .ds-tb th{background:#f9fafb;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1.5px solid #e5e7eb}
    .ds-tb td{padding:8px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}
    .ds-ft{background:#f9fafb;padding:18px 32px;font-size:11px;color:#6b7280;border-top:1.5px solid #e5e7eb}
    #dl{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:${LC.cor||'#C45E0A'};color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:99;font-family:Inter,sans-serif}
    @media print{#dl{display:none!important}body{padding:0;background:#fff}.ds{box-shadow:none;border-radius:0;max-width:none}}`;

  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Dossie-${(v.cliente||'assembleia').replace(/\s+/g,'-')}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>${css}</style></head><body>
    <button id="dl" onclick="window.print()">📥 Baixar / Imprimir</button>
    <div class="ds">
      <div class="ds-hd">
        <h1>Laudo Técnico para Assembleia</h1>
        <div class="ds-sub">${esc(LC.nome||'')}${LC.tel?' · '+esc(LC.tel):''}</div>
      </div>
      <div class="ds-bd">
        <div class="ds-cli">${esc(v.cliente||'')}</div>
        <div class="ds-meta">${v.local?esc(v.local)+' · ':''}Vistoria realizada em ${_fmtDataBR(v.data)}${v.tecnico?' por '+esc(v.tecnico):''}</div>
        <div class="ds-resumo">
          <div class="ds-kpi c"><div class="ds-kpi-v">${criticos.length}</div><div class="ds-kpi-l">Exigem ação imediata</div></div>
          <div class="ds-kpi a"><div class="ds-kpi-v">${atencao.length}</div><div class="ds-kpi-l">Para programar</div></div>
          <div class="ds-kpi"><div class="ds-kpi-v">${itens.length}</div><div class="ds-kpi-l">Total apontado</div></div>
        </div>
        ${criticos.length?`<div class="ds-sec-t">Itens que exigem ação imediata</div>${blocoCritico}`:''}
        ${blocoAtencao}
      </div>
      <div class="ds-ft">
        Documento gerado a partir da vistoria técnica de ${_fmtDataBR(v.data)}. As condições descritas
        refletem o estado dos equipamentos na data da visita.
        ${LC.nome?esc(LC.nome):''}${LC.tel?' · '+esc(LC.tel):''}
      </div>
    </div></body></html>`;

  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  const w=window.open(url,'_blank');
  if(w){ toast('📄 Dossiê aberto — toque em "Baixar / Imprimir"'); setTimeout(()=>URL.revokeObjectURL(url),120000); logAcao?.('dossie_assembleia', v.cliente||''); }
  else { URL.revokeObjectURL(url); toast('⚠️ Permita pop-ups para abrir o dossiê'); }
}

// ── Tombstones: ids de vistorias apagadas, para NUNCA ressuscitarem via sync ──
// Antes, o delete no banco era "fire-and-forget": se a rede do celular falhasse,
// o registro sobrevivia no Supabase e voltava na próxima sincronização. Agora,
// o id apagado fica numa lista local que o sync respeita, e o delete no banco é
// tentado de novo até confirmar que sumiu.
function _visTombLer(){ try{ return JSON.parse(ls('fluxa_vis_tombstones')||'[]'); }catch(e){ return []; } }
function _visTombAdd(id){ const t=_visTombLer(); if(!t.includes(id)){ t.push(id); lsSet('fluxa_vis_tombstones', JSON.stringify(t.slice(-500))); } }
async function _excluirVistoriaBanco(id){
  if(!dbOk||!db) return;
  try{
    const r=await _comTimeout(db.from('vistorias').delete().eq('id',id), 15000, 'delete vistoria');
    if(r&&r.error) console.warn('[excluirVistoria banco]', r.error.message);
  }catch(e){ console.warn('[excluirVistoria banco]', e?.message||e); }
}
// Backup/arquivo das vistorias (gestor): baixa um JSON com TODAS as vistorias
// da empresa em foco — comprovação de longo prazo fora do sistema. As fotos
// vão como URLs do Storage (o PDF pode ser regerado a qualquer momento).
async function exportarVistoriasBackup(){
  if(!eGestor()){ toast('⚠️ Apenas gestor pode exportar o arquivo'); return; }
  toast('📦 Preparando backup…');
  let lista=[];
  try{
    if(dbOk&&db){ const {data,error}=await db.from('vistorias').select('*').order('data',{ascending:true}); if(error) console.warn('[backupVis]',error.message); lista=data||[]; }
  }catch(e){ console.warn('[backupVis]', e?.message||e); }
  if(!lista.length) lista=lsVisLer(); // offline: exporta o que há no aparelho
  lista=lista.filter(v=>escopoEmpresaMatch(v.loja_id)); // não mistura empresas no arquivo
  if(!lista.length){ toast('Nenhuma vistoria desta empresa para exportar'); return; }
  const f=_empresaEmFoco();
  const emp=f.tipo==='loja'?(getLoja(f.valor)?.nome||f.valor):(f.valor==='aquamotor'?'Aquamotor':'Fortemp');
  const payload={exportado_em:new Date().toISOString(), empresa:emp, total:lista.length, vistorias:lista};
  const blob=new Blob([JSON.stringify(payload,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`vistorias-backup-${emp.replace(/\s+/g,'_')}-${_hojeLocal()}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  logAcao('vistorias_backup', `${lista.length} vistoria(s) — ${emp}`);
  toast(`📦 Backup baixado: ${lista.length} vistoria(s) de ${emp}`);
}

function excluirVistoria(id){
  confirmar('Excluir esta vistoria?', ()=>{ _visTombAdd(id); lsVisSalvar(lsVisLer().filter(x=>x.id!==id)); _excluirVistoriaBanco(id); renderVisHistorico(); toast('Vistoria excluída'); }, 'Excluir Vistoria');
}

// Desfaz a visita do mês de um plano: apaga a vistoria (aparelho + banco) e o
// card volta a "Pendente". Útil p/ remover relatório de teste sem apagar o plano.
function desfazerVistoriaLocal(vistoriaId){
  confirmar('Desfazer esta visita do mês?\n\nO relatório será apagado e o plano volta a ficar pendente. O cadastro do plano é mantido.', ()=>{
    _visTombAdd(vistoriaId);
    lsVisSalvar(lsVisLer().filter(x=>x.id!==vistoriaId));
    _excluirVistoriaBanco(vistoriaId);
    renderLocaisTab();
    renderVisHistorico();
    toast('🗑️ Visita desfeita — plano voltou a pendente');
  }, 'Desfazer visita', null, 'Cancelar', 'Desfazer');
}

// Serializa TODO o CSS da página (styles.css + <style> inline). Desde a
// refatoração multi-arquivo o CSS vive em styles.css (um <link>), então coletar
// só as tags <style> deixava a nova aba SEM NENHUM estilo → relatório "zuado"
// (logo gigante, texto cru, 12 páginas). document.styleSheets cobre os dois.
function _cssCompletoDaPagina(){
  let css='';
  for(const sheet of document.styleSheets){
    try{ for(const rule of sheet.cssRules) css+=rule.cssText+'\n'; }
    catch(e){ /* folha cross-origin (ex.: Google Fonts) — o <link> da fonte já vai no head */ }
  }
  if(!css.trim()) css=[...document.querySelectorAll('style')].map(s=>s.innerHTML).join('\n');
  return css;
}

// Reduz uma foto base64 para miniatura — relatório com MUITAS fotos (condomínios
// grandes: 15-20 equipamentos × 2-3 fotos) não trava mais. URLs do Storage são
// mantidas (o lazy-load cuida). Só o base64 (pesado) é reduzido.
function _miniaturaFoto(src, maxW=560, q=0.55){
  return new Promise(res=>{
    if(!src || typeof src!=='string' || !src.startsWith('data:')) return res(src);
    const img=new Image();
    img.onload=()=>{ try{
      const w=img.width||maxW; const sc=Math.min(1, maxW/w);
      if(sc>=1) return res(src);
      const cv=document.createElement('canvas'); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      res(cv.toDataURL('image/jpeg',q));
    }catch(e){ res(src); } };
    img.onerror=()=>res(src);
    img.src=src;
  });
}
// Devolve cópia da vistoria com as fotos base64 já miniaturizadas.
async function _prepRelatorioFotos(vis){
  const eqs=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const equipamentos=await Promise.all(eqs.map(async e=>({
    ...e, fotos: await Promise.all((e.fotos||[]).filter(Boolean).map(f=>_miniaturaFoto(f)))
  })));
  return {...vis, equipamentos};
}
// Núcleo único do relatório de vistoria: SEMPRE abre numa aba nova (HTML leve,
// renderização incremental + lazy-load + fotos miniaturizadas). Não usa mais
// window.print() num doc oculto (que travava com muitas fotos). O usuário usa o
// botão "Baixar / Imprimir PDF" na aba (impressão nativa, aguenta muitas fotos).
async function _gerarPDFVistoria(vis, opts={}){
  if(!vis.loja_id || vis.loja_id==='default') vis.loja_id = lojaAtiva || LOJA_PADRAO_ID;
  const visMini = await _prepRelatorioFotos(vis); // miniaturiza fotos base64
  preencherRelatorioVistoria(visMini);
  const el = document.getElementById('pdoc-visita');
  const stylesTxt = _cssCompletoDaPagina();
  const nomeArq = `Vistoria-${(vis.cliente||'relatorio').replace(/\s+/g,'-')}-${vis.data||''}.pdf`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>${nomeArq}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${stylesTxt}</style>
    <style>body{margin:0;padding:80px 24px 24px;background:#f3f4f6}
      .pdoc{display:block!important;max-width:794px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,.15);border-radius:8px;overflow:hidden}
      #btn-baixar-pdf{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#F07820;color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999;font-family:Inter,sans-serif}
      #btn-baixar-pdf:hover{background:#d96010}
      @media print{#btn-baixar-pdf{display:none!important}body{padding:0;background:white}}</style>
    </head><body><button id="btn-baixar-pdf" onclick="window.print()">📥 Baixar / Imprimir PDF</button>${el?el.outerHTML:''}</body></html>`;
  const blobUrl = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
  if(opts.output === 'bloburl') return blobUrl;
  const w = window.open(blobUrl, '_blank');
  if(w){ toast('✅ Relatório aberto — toque em "Baixar / Imprimir PDF"'); setTimeout(()=>URL.revokeObjectURL(blobUrl), 120000); }
  else { URL.revokeObjectURL(blobUrl); toast('⚠️ Permita pop-ups para abrir o relatório'); }
}

async function baixarPDFVistoria(id, btn){
  const vis = lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('Vistoria não encontrada'); return; }
  const origTxt = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='⏳'; }
  try{
    await _gerarPDFVistoria(vis); // usa window.print()
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=origTxt; }
  }
}

function filtVisStatus(st){
  visHistStatusFilt = st;
  ['todos','critico','atencao'].forEach(s=>{
    const btn=document.getElementById('vis-fst-'+s);
    if(btn) btn.classList.toggle('on', s===(st||'todos'));
  });
  renderVisHistorico();
}

function enviarWAResumoVistoria(id){
  const vis = lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const dataFmt = vis.data?new Date(vis.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
  const statusTxt={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico'};
  const linhas = equips.filter(e=>e.status&&e.status!=='na').map(e=>`  • ${e.nome}: ${statusTxt[e.status]||e.status}${e.obs?' – '+e.obs:''}`);
  const temCritico = equips.some(e=>e.status==='critico');
  const temAtencao = equips.some(e=>e.status==='atencao');
  const statusGeral = temCritico ? '🔴 Ação necessária' : temAtencao ? '⚠️ Requer atenção' : '✅ Tudo em ordem';
  const LC = getLojaConfig(vis.loja_id||lojaAtiva);
  const msg = `*Relatório de Vistoria – ${LC.nome||''}*\n📅 ${dataFmt}\n👤 Técnico: ${vis.tecnico||''}\n📍 ${vis.cliente||''}${vis.local?' – '+vis.local:''}\n\n*Status geral: ${statusGeral}*\n\n${linhas.join('\n')||'Nenhum equipamento avaliado'}${vis.recomendacoes?'\n\n*🔧 O que precisa ser feito:*\n'+vis.recomendacoes:''}${vis.obs_geral?'\n\n📝 Obs: '+vis.obs_geral:''}\n\n_${LC.nome||''} · ${LC.tel||''}_`;
  // Tenta abrir WhatsApp com telefone do cliente, senão abre sem destino
  const clientes=JSON.parse(ls('fluxa_clientes_full')||'[]');
  const cli=clientes.find(c=>(c.nome||'').toLowerCase()===(vis.cliente||'').toLowerCase());
  const tel=(cli?.tel||'').replace(/\D/g,'');
  const url=`https://wa.me/${tel?'55'+tel:''}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
}

// ── Ver relatório em nova aba (mesmo núcleo leve, com miniaturas) ──
async function abrirVisRelatorio(id, btn){
  const vis = lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  const _t=btn?btn.textContent:''; if(btn){ btn.disabled=true; btn.textContent='⏳'; }
  try{ await _gerarPDFVistoria(vis); }
  catch(e){ console.warn('[abrirVisRelatorio]', e?.message||e); toast('⚠️ Falha ao abrir o relatório'); }
  finally{ if(btn){ btn.disabled=false; btn.textContent=_t; } }
}

async function gerarRelatorioVistoria(){
  autoCheckoutSeNecessario();
  { const _loc=window._visLocalId?(locaisVistoria||[]).find(x=>x.id===window._visLocalId):null; const _ci=document.getElementById('vis-cli'); if(_ci && !_ci.value.trim() && _loc?.cliente) _ci.value=_loc.cliente; }
  const cli=(document.getElementById('vis-cli')?.value||'').trim();
  if(!cli){ _pedirClienteVis(); return; }

  const veioDoPlano=!!(window._visLocalId);
  const rec=_montarRecVistoria();
  _persistVistoria(rec);
  window._visLocalId=null;
  const planoBanner=document.getElementById('vis-plano-banner');
  if(planoBanner) planoBanner.style.display='none';

  // Relatório sempre em nova aba (leve, aguenta muitas fotos). Sem window.print
  // em doc oculto (travava) nem html2pdf (PDF em branco).
  toast('⏳ Preparando relatório…');
  try{ await _gerarPDFVistoria(rec); }
  catch(e){ console.warn('[gerarRelatorioVistoria]',e?.message||e); toast('⚠️ Vistoria salva — abra o relatório pelo histórico.'); }

  renderVisHistorico();
  if(veioDoPlano) setTimeout(()=>visTab('locais'), 900);
}

function calcDuracao(cin, cout){
  if(!cin||!cout) return null;
  const p=t=>{ const [h,m]=(t||'').split(':').map(Number); return isNaN(h)||isNaN(m)?null:h*60+m; };
  const t1=p(cin),t2=p(cout); if(t1===null||t2===null) return null;
  let d=t2-t1; if(d<0) d+=24*60; if(d===0||d>600) return null;
  const h=Math.floor(d/60),m=d%60;
  return h>0?(m>0?`${h}h ${m}min`:`${h}h`):`${m}min`;
}

function preencherRelatorioVistoria(vis){
  document.querySelectorAll('.pdoc').forEach(d=>d.classList.remove('print-active'));
  const pdoc = document.getElementById('pdoc-visita');
  if(!pdoc) return;
  pdoc.classList.add('print-active');

  const LC = getLojaConfig(vis.loja_id);
  const cor  = LC.cor  || getComputedStyle(document.documentElement).getPropertyValue('--c1').trim()||'#C45E0A';
  const cor2 = LC.cor2 || getComputedStyle(document.documentElement).getPropertyValue('--c2').trim()||'#2B3244';

  // Header branding
  const hdr = document.getElementById('pd-header-vis');
  if(hdr) hdr.style.background=`linear-gradient(135deg,${cor2},${cor2}ee)`;
  const footEl = document.getElementById('pd-foot-vis');

  // Logo / initials
  const logoEl = document.getElementById('pd-hdr-logo-vis');
  const initEl = document.getElementById('pd-hdr-init-vis');
  const nomePDF = LC.nome||'Empresa';
  if(logoEl && initEl){
    if(LC.logoB64){
      logoEl.src=LC.logoB64; logoEl.className='pd-hdr-logo-img has-logo';
      initEl.className='pd-hdr-logo-initials';
    } else {
      logoEl.className='pd-hdr-logo-img';
      initEl.textContent=nomePDF.charAt(0).toUpperCase();
      initEl.className='pd-hdr-logo-initials show-init';
    }
  }

  // Nome empresa
  const nm=document.getElementById('pd-nm-vis'); if(nm) nm.textContent=nomePDF;
  const sb=document.getElementById('pd-sb-vis'); if(sb) sb.textContent=LC.sub||'Serviços';
  const tag=document.getElementById('pd-tag-vis'); if(tag){ tag.textContent=LC.tagline||''; tag.style.display=LC.tagline?'block':'none'; }

  // Doc number = data
  const numEl=document.getElementById('pd-num-vis');
  if(numEl){ const d=vis.data?new Date(vis.data+'T12:00:00'):new Date(); numEl.textContent=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}); }

  // Meta strip
  const cont=document.getElementById('pd-cont-vis');
  if(cont){ const mRef=vis.mes_ref?new Date(+vis.mes_ref.split('-')[0],+vis.mes_ref.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):''; cont.textContent=`Referência: ${mRef}`; }
  const meta=document.getElementById('pd-meta-vis');
  if(meta){ const tel=LC.tel||''; meta.innerHTML=`${LC.nome||''}<br>${tel}`; }

  // Client card
  const cliBar=document.getElementById('pd-cli-bar-vis'); if(cliBar) cliBar.style.background=cor;
  const cliNm=document.getElementById('pd-cli-nm-vis'); if(cliNm) cliNm.textContent=vis.cliente||'—';
  const cliLoc=document.getElementById('pd-cli-loc-vis'); if(cliLoc) cliLoc.textContent=vis.local||'';

  // Equipamentos
  const equips = (typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const statusTxt = { bom:'Bom', atencao:'Atenção', critico:'Crítico', na:'N/A' };
  const statusCls = { bom:'st-bom', atencao:'st-atencao', critico:'st-critico', na:'st-na' };
  const bdCls     = { bom:'bd-bom', atencao:'bd-atencao', critico:'bd-critico', na:'bd-na' };
  const dotCls    = { bom:'bom', atencao:'atencao', critico:'critico', na:'na' };

  // Stats summary row
  const statsRow=document.getElementById('pd-vis-stats-row');
  if(statsRow){
    const nBom    = equips.filter(e=>e.status==='bom').length;
    const nAtencao= equips.filter(e=>e.status==='atencao').length;
    const nCritico= equips.filter(e=>e.status==='critico').length;
    const nTotal  = equips.filter(e=>e.status!=='na').length;
    statsRow.innerHTML=`
      <div class="pd-vis-stat s-total"><div class="pd-vis-stat-n">${nTotal}</div><div class="pd-vis-stat-l">Vistoriados</div></div>
      <div class="pd-vis-stat s-bom"><div class="pd-vis-stat-n">${nBom}</div><div class="pd-vis-stat-l">✅ Bom estado</div></div>
      <div class="pd-vis-stat s-atencao"><div class="pd-vis-stat-n">${nAtencao}</div><div class="pd-vis-stat-l">⚠️ Atenção</div></div>
      <div class="pd-vis-stat s-critico"><div class="pd-vis-stat-n">${nCritico}</div><div class="pd-vis-stat-l">🔴 Crítico</div></div>`;
  }

  // Visit info grid — 4 cells: técnico, data, horário, duração
  const infoGrid=document.getElementById('pd-vis-info-grid');
  if(infoGrid){
    const cin  = vis.hora_checkin||vis.hora||'';
    const cout = vis.hora_checkout||'';
    const dur  = calcDuracao(cin, cout);
    const dataFmt=vis.data?new Date(vis.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'—';
    const horaTxt = cin?(cin+(cout?' → '+cout:'')):'—';
    infoGrid.innerHTML=`
      <div class="pd-g2card"><div class="pd-g2lbl">Técnico Responsável</div><div class="pd-g2val">👤 ${esc(vis.tecnico||'—')}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Data da Vistoria</div><div class="pd-g2val">📅 ${dataFmt}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Entrada → Saída</div><div class="pd-g2val">⏰ ${esc(horaTxt)}</div></div>
      <div class="pd-g2card"><div class="pd-g2lbl">Duração da Visita</div><div class="pd-g2val">⏱ ${esc(dur||'—')}</div></div>`;
  }

  // Summary table
  const sumTable=document.getElementById('pd-vis-sumtable');
  if(sumTable){
    const equipsVistoriados = equips.filter(e=>e.status && e.status!=='na');
    // Agrupa por ambiente (se houver) para manter o relatório organizado como o plano
    const gruposSum=[];
    equipsVistoriados.forEach(e=>{
      const nomeAmb=(e.ambiente||'').trim();
      let g=gruposSum.find(gr=>gr.nome===nomeAmb);
      if(!g){ g={nome:nomeAmb, itens:[]}; gruposSum.push(g); }
      g.itens.push(e);
    });
    gruposSum.sort((a,b)=>(a.nome===''?1:0)-(b.nome===''?1:0));
    const temAmbiente=gruposSum.some(g=>g.nome);
    sumTable.innerHTML=`<thead><tr><th>Equipamento</th><th>Modelo / Pot.</th><th>Status</th><th>Observação</th></tr></thead>
      <tbody>${gruposSum.map(g=>`
        ${temAmbiente&&g.nome?`<tr><td colspan="4" style="background:#f3f4f6;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#374151">📍 ${esc(g.nome)}</td></tr>`:''}
        ${g.itens.map(e=>`<tr>
        <td><strong>${esc(e.nome||e.id)}</strong></td>
        <td style="font-size:11px;color:#6b7280">${[e.marca,e.modelo,e.potencia].filter(Boolean).map(esc).join(' · ')||'—'}</td>
        <td><span class="st-dot ${dotCls[e.status]||'na'}"></span>${statusTxt[e.status]||'—'}</td>
        <td style="color:#6b7280;font-size:11px">${esc((e.obs||'').slice(0,90))}</td>
      </tr>`).join('')}`).join('')}</tbody>`;
  }

  // Detailed list — equipamentos com status definido OU com fotos
  const detList=document.getElementById('pd-vis-equip-list');
  if(detList){
    const _ambObs=vis.obs_ambientes||{};
    const equipsDet=equips.filter(e=>e.status!=='na'||(e.fotos||[]).some(Boolean));
    const gruposDet=[];
    equipsDet.forEach(e=>{
      const nomeAmb=(e.ambiente||'').trim();
      let g=gruposDet.find(gr=>gr.nome===nomeAmb);
      if(!g){ g={nome:nomeAmb, itens:[]}; gruposDet.push(g); }
      g.itens.push(e);
    });
    // Ambiente com SÓ observação (sem equipamento avaliado) também aparece
    Object.keys(_ambObs).forEach(nomeAmb=>{ if(nomeAmb && !gruposDet.find(g=>g.nome===nomeAmb)) gruposDet.push({nome:nomeAmb, itens:[]}); });
    gruposDet.sort((a,b)=>(a.nome===''?1:0)-(b.nome===''?1:0));
    const temAmbienteDet=gruposDet.some(g=>g.nome);
    const itemHtml=e=>{
      const fotosArr=(e.fotos||[]).filter(Boolean);
      const fotosHtml=fotosArr.length
        ?`<div class="pd-vis-equip-fotos">${fotosArr.map((f,i)=>`
            <div class="pd-vis-foto-item">
              <img src="${f}" alt="Foto ${i+1}" loading="lazy" decoding="async">
              <div class="pd-vis-foto-lbl">Foto ${i+1}${e.nome?' — '+e.nome:''}</div>
            </div>`).join('')}</div>`
        :'';
      const obsCls=e.status==='critico'?'obs-critico':e.status==='atencao'?'obs-atencao':e.status==='bom'?'obs-bom':'';
      const obsHtml=e.obs?`<div class="pd-vis-equip-obs ${obsCls}">${esc(e.obs)}</div>`:'';
      const fichaHtml=e.ficha?`<div class="pd-vis-equip-obs" style="border-left-color:#6b7280;background:#f8f9fb"><strong style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">📋 Ficha</strong><br>${esc(e.ficha)}</div>`:'';
      const subInfo=[e.marca,e.modelo,e.potencia].filter(Boolean).map(esc).join(' · ');
      return `<div class="pd-vis-equip-item ${statusCls[e.status]||''}">
        <div class="pd-vis-equip-hdr ${statusCls[e.status]||'st-na'}">
          <div style="flex:1;min-width:0">
            <div class="pd-vis-equip-nm">${e.emoji||'⚙️'} ${esc(e.nome||e.id)}</div>
            ${subInfo?`<div class="pd-vis-equip-sub">${subInfo}${fotosArr.length?' · 📷 '+fotosArr.length+' foto'+(fotosArr.length>1?'s':''):''}</div>`
                     :fotosArr.length?`<div class="pd-vis-equip-sub">📷 ${fotosArr.length} foto${fotosArr.length>1?'s':''}</div>`:''}
          </div>
          <div class="pd-vis-equip-bd ${bdCls[e.status]||'bd-na'}">${statusTxt[e.status]||'N/A'}</div>
        </div>
        ${(obsHtml||fichaHtml||fotosHtml)?`<div class="pd-vis-equip-body">${obsHtml}${fichaHtml}${fotosHtml}</div>`:''}
      </div>`;
    };
    detList.innerHTML=gruposDet.map(g=>`
      ${temAmbienteDet&&g.nome?`<div style="font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px">📍 ${esc(g.nome)}</div>`:''}
      ${g.nome&&_ambObs[g.nome]?`<div class="pd-vis-equip-obs obs-atencao" style="margin-bottom:8px"><strong style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#d97706">📝 Observação do ambiente</strong><br>${esc(_ambObs[g.nome])}</div>`:''}
      ${g.itens.map(itemHtml).join('')}
    `).join('');
  }

  // General obs
  // Recomendações / prioridades (destaque no topo)
  const recomWrap=document.getElementById('pd-vis-recom-wrap');
  const recomTxt=document.getElementById('pd-vis-recom-txt');
  if(recomWrap) recomWrap.style.display=(vis.recomendacoes&&vis.recomendacoes.trim())?'block':'none';
  if(recomTxt)  recomTxt.textContent=vis.recomendacoes||'';

  const obsWrap=document.getElementById('pd-vis-obs-wrap');
  const obsBar=document.getElementById('pd-vis-obs-bar');
  const obsTxt=document.getElementById('pd-vis-obs-txt');
  if(obsWrap){ obsWrap.style.display=vis.obs_geral?'block':'none'; }
  if(obsBar)  obsBar.style.background=cor;
  if(obsTxt)  obsTxt.textContent=vis.obs_geral||'';

  // Technician signature label — nome + empresa
  const signTec=document.getElementById('pd-vis-sign-tec');
  if(signTec){
    const nomeTec = vis.tecnico||'Técnico Responsável';
    const empresaTec = LC.nome||'';
    signTec.innerHTML=`${esc(nomeTec)}<br><span style="font-size:10px;font-weight:400;color:#6b7280">${esc(empresaTec)}</span>`;
  }

  // Footer
  const tel=LC.tel||''; const email=LC.email||'';
  if(footEl){ footEl.style.background=cor2; footEl.textContent=`${LC.nome||''}${tel?' · '+tel:''}${email?' · '+email:''}`; }
  const metaEl=document.getElementById('pd-meta-vis');
  if(metaEl) metaEl.innerHTML=`${LC.nome||''}${tel?'<br>'+tel:''}`;
}

// ── Abrir a aba de visitas já preenchida com agendamento ──
function novaVistoria(cliNome, cliLocal, tecNome){
  visEquipSelecionados=[];
  visEquipDados={};
  visAmbienteObs={};
  _visEquipsCustom=[];
  visCheckinTime=null;
  visCheckoutTime=null;
  visEditId=null;
  _visDraftId=null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  go('visitas');
  visTab('nova');
  const hoje=new Date();
  const _hd=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const dd=document.getElementById('vis-data'); if(dd) dd.value=_hd;
  const mm=document.getElementById('vis-mes-ref'); if(mm) mm.value=_hd.slice(0,7);
  if(cliNome){ const inp=document.getElementById('vis-cli'); if(inp) inp.value=cliNome; }
  if(cliLocal){ const inp=document.getElementById('vis-loc'); if(inp) inp.value=cliLocal; }
  // Auto-seleciona o técnico: prioridade → tecNome passado → nome do usuário logado
  // Se o nome não está na lista (ex: master), adiciona como opção e seleciona
  const _nomeTec = tecNome || getSessao()?.nome || '';
  if(_nomeTec){
    const sel=document.getElementById('vis-tec');
    if(sel){
      let found=false;
      for(let o of sel.options){ if(o.text===_nomeTec||o.value===_nomeTec){ o.selected=true; found=true; break; } }
      if(!found){ const op=new Option(_nomeTec,_nomeTec,true,true); sel.appendChild(op); }
    }
  }
  // Oculta "Dados da Visita" quando vem de um plano (campos já preenchidos)
  // O técnico pode expandir clicando no título se precisar corrigir algo
  const _vdb = document.getElementById('vis-dados-body');
  const _vdt = document.getElementById('vis-dados-toggle');
  if(window._visLocalId && _vdb){ _vdb.style.display='none'; if(_vdt) _vdt.textContent='▼ expandir'; }
  else if(_vdb){ _vdb.style.display=''; if(_vdt) _vdt.textContent='▲ recolher'; }
  renderVisChips();
  renderVisEquipGrid();
}

function toggleVisDados(){
  const body=document.getElementById('vis-dados-body');
  const lbl=document.getElementById('vis-dados-toggle');
  if(!body) return;
  const open = body.style.display!=='none';
  body.style.display = open?'none':'';
  if(lbl) lbl.textContent = open?'▼ expandir':'▲ recolher';
}

// Reabre uma vistoria já feita para EDITAR / REFAZER — mantém status, obs e fotos.
// Grava no MESMO registro (visEditId), então não duplica.
function editarVistoria(id){
  const vis=lsVisLer().find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  // Reset de estado
  visEquipSelecionados=[]; visEquipDados={}; _visEquipsCustom=[];
  visAmbienteObs=(vis.obs_ambientes&&typeof vis.obs_ambientes==='object')?{...vis.obs_ambientes}:{}; // reabre com as obs de ambiente salvas
  visCheckinTime=null; visCheckoutTime=null;
  if(visCheckinInterval){ clearInterval(visCheckinInterval); visCheckinInterval=null; }
  visEditId=id; _visDraftId=id;            // edita o mesmo registro
  window._visLocalId=vis.local_id||null;   // mantém vínculo com o plano (e a empresa)
  _visClienteSelecionado = vis.cliente_id ? {id:vis.cliente_id, nome:vis.cliente} : null;
  go('visitas'); visTab('nova');
  // Esconde banners de plano/pré-carga (estamos editando algo existente)
  const pb=document.getElementById('vis-plano-banner'); if(pb) pb.style.display='none';
  const pc=document.getElementById('vis-precarga-banner'); if(pc) pc.style.display='none';
  const set=(elId,val)=>{ const e=document.getElementById(elId); if(e) e.value=val||''; };
  set('vis-cli',vis.cliente); set('vis-loc',vis.local);
  const _en=new Date(); const _ed=`${_en.getFullYear()}-${String(_en.getMonth()+1).padStart(2,'0')}-${String(_en.getDate()).padStart(2,'0')}`;
  set('vis-data',vis.data||_ed);
  set('vis-mes-ref',vis.mes_ref||_ed.slice(0,7));
  set('vis-hora',vis.hora||vis.hora_checkin||'');
  set('vis-obs',vis.obs_geral);
  set('vis-recom',vis.recomendacoes);
  set('vis-email-resp',vis.email_responsavel);
  const tecSel=document.getElementById('vis-tec');
  if(tecSel&&vis.tecnico){ for(const o of tecSel.options){ if(o.text===vis.tecnico||o.value===vis.tecnico){ o.selected=true; break; } } }
  // Equipamentos: separa padrão de custom e PRESERVA status/obs/fotos
  const stdDefs=VIS_EQUIPAMENTOS_DEFAULT.map(x=>x.id);
  visEquipSelecionados=equips.filter(e=>stdDefs.includes(e.id)).map(e=>e.id);
  _visEquipsCustom=equips.filter(e=>!stdDefs.includes(e.id)).map(e=>({id:e.id,nome:e.nome,emoji:e.emoji||'⚙️',marca:e.marca||'',modelo:e.modelo||'',potencia:e.potencia||'',ficha:e.ficha||'',ambiente:e.ambiente||''}));
  equips.forEach(e=>{ visEquipDados[e.id]={status:e.status||'na',obs:e.obs||'',fotos:(e.fotos||[]).filter(Boolean)}; });
  renderVisChips();
  renderVisEquipGrid();
  const card=document.getElementById('vis-equip-card');
  if(card) card.style.display=(visEquipSelecionados.length||_visEquipsCustom.length)?'':'none';
  window.scrollTo({top:0,behavior:'smooth'});
  toast('✏️ Editando vistoria — ajuste e salve/gere o PDF');
}

// ══════════════════════════════════════════════════
//  EMAILJS — envio de relatório de vistoria
// ══════════════════════════════════════════════════

function emailJSConfigurado(){
  return !!(CFG.emailjs_pubkey && CFG.emailjs_service && CFG.emailjs_template);
}

function initEmailJS(){
  if(CFG.emailjs_pubkey){
    try{ emailjs.init({ publicKey: CFG.emailjs_pubkey }); }catch(e){ console.warn('[initEmailJS] init falhou:',e?.message||e); }
  }
}

// Gera o PDF da vistoria e sobe no Storage; retorna a URL pública (ou null em falha).
// Resiliente: qualquer erro (bucket/policy faltando, html2pdf, rede) → null, e o
// e-mail segue só com o texto. Nunca lança.
let _pdfStorageOk = null; // null=desconhecido, true=bucket ok, false=bucket/policy faltando (não gerar PDF à toa)
async function gerarEUploadPDFVistoria(vis){
  if(typeof html2pdf === 'undefined' || !db) return null;
  if(_pdfStorageOk === false) return null; // já sabemos que o Storage não está pronto — evita gerar PDF em vão
  const element = document.getElementById('pdoc-visita');
  if(!element) return null;
  const prevStyle = element.getAttribute('style') || '';
  try{
    preencherRelatorioVistoria(vis);
    // Torna visível fora da tela — html2canvas não captura display:none (PDF sairia em branco)
    element.setAttribute('style', 'display:block!important;position:absolute;top:0;left:0;width:794px;background:#fff;z-index:-1');
    await new Promise(r=>setTimeout(r,350));
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename: `vistoria-${(vis.cliente||'').replace(/[^a-z0-9]/gi,'-')}-${vis.data||''}.pdf`,
        image: { type:'jpeg', quality:0.85 },
        html2canvas: { scale:2, useCORS:true, allowTaint:true, logging:false, width:794 },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
      })
      .from(element)
      .output('blob');
    element.setAttribute('style', prevStyle || 'display:none');

    const filename = `${vis.loja_id||'fluxa'}/${vis.id||Date.now()}.pdf`;
    const { error } = await db.storage.from('vistorias-pdf').upload(filename, blob, {
      contentType:'application/pdf', upsert:true
    });
    if(error){
      console.warn('[PDF vistoria] upload falhou (bucket/policy?):', error.message);
      if(/not found|bucket|policy|row-level|denied|unauthor/i.test(error.message||'')) _pdfStorageOk=false;
      return null;
    }
    _pdfStorageOk=true;
    const { data } = db.storage.from('vistorias-pdf').getPublicUrl(filename);
    return data?.publicUrl || null;
  }catch(e){
    console.warn('[PDF vistoria] erro ao gerar/subir:', e?.message||e);
    element.setAttribute('style', prevStyle || 'display:none');
    return null;
  }
}

async function enviarEmailVistoria(vis){
  if(!emailJSConfigurado()){
    console.log('EmailJS não configurado, pulando envio automático');
    return false;
  }
  const emailDest = vis.email_responsavel;
  if(!emailDest){ return false; }

  // Monta resumo dos equipamentos em texto
  const equips=(typeof vis.equipamentos==='string'?JSON.parse(vis.equipamentos||'[]'):vis.equipamentos)||[];
  const statusTxt={bom:'✅ Bom',atencao:'⚠️ Atenção',critico:'🔴 Crítico',na:'N/A'};
  const resumoLinhas = equips.filter(e=>e.status!=='na').map(e=>`• ${e.nome}: ${statusTxt[e.status]||e.status}${e.obs?' — '+e.obs:''}`);
  const resumo = resumoLinhas.join('\n') || 'Nenhum equipamento vistoriado com problemas.';
  const mesRef = vis.mes_ref ? new Date(+vis.mes_ref.split('-')[0],+vis.mes_ref.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) : '';
  const dataVisita = vis.data ? new Date(vis.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

  // Conta críticos e atenções para assunto dinâmico
  const temCritico = equips.some(e=>e.status==='critico');
  const temAtencao = equips.some(e=>e.status==='atencao');
  const statusGeral = temCritico ? '🔴 Ação necessária' : temAtencao ? '⚠️ Verificar pontos' : '✅ Tudo em ordem';
  const duracao = calcDuracao(vis.hora_checkin||vis.hora, vis.hora_checkout);

  // Gera o PDF e sobe no Storage para anexar o link no e-mail.
  // Se o bucket/policy ainda não estiver pronto, retorna null e o e-mail vai só com o texto.
  let pdfUrl = '';
  try{ pdfUrl = (await gerarEUploadPDFVistoria(vis)) || ''; }
  catch(e){ console.warn('[email vistoria] PDF não anexado:', e?.message||e); }

  const params = {
    to_email    : emailDest,
    to_name     : vis.cliente || 'Responsável',
    empresa     : CFG.nome || 'Empresa',
    tecnico     : vis.tecnico || '',
    mes_ref     : mesRef,
    data_visita : dataVisita,
    hora_checkin: vis.hora_checkin || vis.hora || '',
    hora_checkout: vis.hora_checkout || '',
    duracao     : duracao || '',
    resumo      : resumo,
    obs_geral   : vis.obs_geral || '',
    status_geral: statusGeral,
    tel_empresa : CFG.tel || '',
    reply_to    : CFG.emailjs_reply_to || '',
    link_relatorio: pdfUrl,
    link_pdf    : pdfUrl ? `📄 Baixar o relatório completo em PDF: ${pdfUrl}` : '',
  };

  try{
    initEmailJS();
    await emailjs.send(CFG.emailjs_service, CFG.emailjs_template, params);
    return true;
  }catch(e){
    console.error('EmailJS send error:', e);
    return false;
  }
}

async function testarEmailJS(){
  const st = document.getElementById('ejs-status');
  if(!CFG.emailjs_pubkey || !CFG.emailjs_service || !CFG.emailjs_template){
    if(st) st.textContent='⚠️ Preencha e salve os 3 campos antes de testar.';
    return;
  }
  if(st) st.textContent='📨 Enviando…';
  const s=getSessao();
  const testVis={
    cliente:'TESTE VISTORIA', local:'Endereço de teste', data:_hojeLocal(),
    hora:'09:00', tecnico: s?.nome||'Técnico', mes_ref:_hojeLocal().slice(0,7),
    hora_checkin:'09:00', hora_checkout:'10:30', obs_geral:'E-mail de teste do sistema Fluxa.',
    email_responsavel: (document.getElementById('ejs-test-email')?.value||'').trim(),
    equipamentos:[
      {id:'motobomba',nome:'Motobomba Principal',emoji:'⚙️',status:'bom',obs:'Funcionando normalmente',fotos:[]},
      {id:'filtro',nome:'Filtro',emoji:'🔵',status:'atencao',obs:'Pressão acima do ideal — verificar na próxima visita',fotos:[]},
    ]
  };
  if(!testVis.email_responsavel){ if(st) st.textContent='Cancelado.'; return; }
  const ok = await enviarEmailVistoria(testVis);
  if(st) st.textContent = ok ? '✅ E-mail enviado com sucesso!' : '❌ Falha no envio — verifique o console e as credenciais.';
}

async function reenviarEmailVistoria(id){
  const lista = lsVisLer();
  const vis = lista.find(x=>x.id===id);
  if(!vis){ toast('⚠️ Vistoria não encontrada'); return; }
  if(!vis.email_responsavel){ toast('⚠️ Nenhum e-mail cadastrado nesta vistoria'); return; }
  if(!emailJSConfigurado()){ toast('⚠️ Configure o EmailJS em Empresa → E-mail Automático'); return; }
  toast('📨 Reenviando e-mail…');
  const ok = await enviarEmailVistoria(vis);
  if(ok) toast(`✅ E-mail reenviado para ${vis.email_responsavel}`);
  else   toast('❌ Falha no envio — verifique o console');
}

// ── Carrega vistorias do Supabase e faz merge com local ──
async function loadVistoriasRemoto(){
  if(!dbOk||!db) return;
  try{
    let q = db.from('vistorias').select('*').order('created_at',{ascending:false}).limit(200);
    const lojaFiltro = getLojaFiltro();
    if(lojaFiltro) q = q.eq('loja_id', lojaFiltro);
    const {data} = await q;
    // Filtra em memória pelo escopo da empresa ativa para não contaminar
    // o localStorage com vistorias de outros grupos (ex: gestor "Todas" receberia Aquamotor)
    let remoto = (data||[]).filter(r=>escopoEmpresaMatch(r.loja_id));
    // Respeita os tombstones: vistorias apagadas não voltam. Se ainda estiverem
    // no banco (delete anterior falhou), tenta apagar de novo.
    const _tomb = new Set(_visTombLer());
    if(_tomb.size){
      remoto.filter(r=>_tomb.has(r.id)).forEach(r=>_excluirVistoriaBanco(r.id));
      remoto = remoto.filter(r=>!_tomb.has(r.id));
    }
    const local = lsVisLer();
    // Reenvia ao banco vistorias com _pendingSync=true — tanto as nunca
    // sincronizadas (id ainda não existe remoto) quanto as que JÁ existem remoto
    // mas ficaram com foto(s) presa(s) em base64 (upload falhou 2x na hora).
    // Tombstone protege contra ressuscitar vistoria deletada remotamente.
    const remotoIds = new Set(remoto.map(r=>r.id));
    const soLocal = local.filter(l=>l._pendingSync===true && !_tomb.has(l.id));
    if(soLocal.length){
      for(const v of soLocal){
        try{
          // Faz upload das fotos e sincroniza com URLs
          const vComUrls = await _uploadFotosVistoria(v);
          // Atualiza localStorage com as URLs obtidas
          const _ls = lsVisLer();
          const _i = _ls.findIndex(x=>x.id===v.id);
          if(_i>=0){ _ls[_i]=vComUrls; lsVisSalvar(_ls); }
          const vParaSupabase = {
            ...vComUrls,
            equipamentos:(vComUrls.equipamentos||[]).map(eq=>({
              ...eq, fotos:(eq.fotos||[]).map(f=>f&&f.startsWith('http')?f:null)
            }))
          };
          const r=await _comTimeout(dbUpsert('vistorias', vParaSupabase), 20000, 'reenvio vistoria');
          if(r&&r.error) console.warn('[reenvioVistoria] '+v.id+':', r.error.message);
          else{ const _ls2=lsVisLer(); const _i2=_ls2.findIndex(x=>x.id===v.id); if(_i2>=0){ delete _ls2[_i2]._pendingSync; lsVisSalvar(_ls2); } }
        }catch(e){ console.warn('[reenvioVistoria]', e?.message||e); }
      }
    }
    if(!remoto.length && !soLocal.length) return;
    // Merge: remoto prevalece nos campos de texto.
    // Para fotos: URLs do Storage têm prioridade; base64 local é usado quando
    // o slot remoto está vazio (ex: upload falhou ou vistoria antiga).
    const merged = remoto.map(r=>{
      const eq = typeof r.equipamentos==='string'?JSON.parse(r.equipamentos||'[]'):r.equipamentos||[];
      const localVer = local.find(l=>l.id===r.id);
      const eqMerged = eq.map((e,i)=>{
        const lEq=(localVer?.equipamentos||[])[i];
        const fotosRemoto = e.fotos||[];
        const fotosLocal  = lEq?.fotos||[];
        const fotosMerged = fotosRemoto.map((fR,fi)=>{
          if(fR && fR.startsWith('http')) return fR; // URL do Storage — usa sempre
          if(fotosLocal[fi] && fotosLocal[fi].startsWith('http')) return fotosLocal[fi];
          if(fotosLocal[fi] && fotosLocal[fi].startsWith('data:')) return fotosLocal[fi]; // base64 local como fallback
          return null;
        });
        // slots locais além do tamanho do remoto (raro, mas garante)
        for(let fi=fotosRemoto.length;fi<fotosLocal.length;fi++){
          if(fotosLocal[fi]) fotosMerged.push(fotosLocal[fi]);
        }
        return {...e, fotos:fotosMerged};
      });
      return {...r, equipamentos:eqMerged};
    });
    // Vistorias só-locais: mantém apenas as pendentes de sync (_pendingSync=true).
    // Sem a flag = foram deletadas remotamente → não ressuscitar.
    local.forEach(l=>{ if(!merged.find(r=>r.id===l.id) && l._pendingSync===true) merged.push(l); });
    lsVisSalvar(merged);
    // Atualiza view se estiver visível
    if(document.getElementById('page-visitas')?.classList.contains('on')) renderVisHistorico();
  }catch(e){ console.warn('loadVistoriasRemoto err:',e.message); }
}

// Init OS page
initOS();

// ══════════════════════════════════════════════════════════════════
//  ESTOQUE — produtos + razão de movimentos (entrada/saída/ajuste)
//  Saldo = soma dos movimentos. Baixa idempotente por 'ref'. Multi-loja.
// ══════════════════════════════════════════════════════════════════
// todosProdutos, todosMovEstoque, estoqueBusca declarados no topo (evita TDZ no boot)

function lsProdLer(){ try{ return JSON.parse(ls('fluxa_produtos')||'[]'); }catch(e){ return []; } }
function lsProdSalvar(l){ lsSet('fluxa_produtos', JSON.stringify(l)); }
function lsMovLer(){ try{ return JSON.parse(ls('fluxa_estoque_mov')||'[]'); }catch(e){ return []; } }
function lsMovSalvar(l){ lsSet('fluxa_estoque_mov', JSON.stringify(l.slice(0,2000))); }

// Carrega produtos e movimentos: local primeiro, depois funde com o banco.
async function loadEstoque(){
  todosFornecedores = lsFornecLer();
  todasOC = lsOCLer();
  todosProdutos = lsProdLer();
  todosMovEstoque = lsMovLer();
  // Migração: remove movimentos do modelo antigo (baixa imediata, ref '...:sync:')
  // para não re-subirem ao banco e bagunçarem a física no modelo reserva/entrega.
  const _antes=todosMovEstoque.length;
  todosMovEstoque=todosMovEstoque.filter(m=>!(m.ref&&m.ref.indexOf(':sync:')>=0));
  if(todosMovEstoque.length!==_antes) lsMovSalvar(todosMovEstoque);
  renderEstoque();
  if(dbOk&&db){
    try{
      const [{data:prods,error:e1},{data:movs,error:e2},{data:fornecs},{data:ocs}] = await Promise.all([
        db.from('produtos').select('*').order('nome',{ascending:true}),
        db.from('estoque_movimentos').select('*').order('data',{ascending:false}).limit(5000),
        db.from('fornecedores').select('*').order('nome',{ascending:true}),
        db.from('ordens_compra').select('*').order('data_criacao',{ascending:false}).limit(200)
      ]);
      if(fornecs){ todosFornecedores=fornecs; lsFornecSalvar(fornecs); }
      if(ocs){ todasOC=ocs.map(_ocNormalizar); lsOCSalvar(todasOC); }
      if(e1) throw e1; if(e2) throw e2;
      // Se o banco está vazio, limpa o cache local (dados de teste/simulação)
      if(prods&&prods.length===0){ todosProdutos=[]; lsProdSalvar([]); }
      if(movs&&movs.length===0){ todosMovEstoque=[]; lsMovSalvar([]); }
      // merge: banco prevalece, mantém locais ainda não sincronizados
      const idP=new Set((prods||[]).map(x=>x.id));
      const soLocalP=todosProdutos.filter(x=>String(x.id).startsWith('prod_')&&!idP.has(x.id));
      todosProdutos=[...(prods||[]),...soLocalP];
      lsProdSalvar(todosProdutos);
      const idM=new Set((movs||[]).map(x=>x.id));
      const soLocalM=todosMovEstoque.filter(x=>String(x.id).startsWith('mov_')&&!idM.has(x.id));
      todosMovEstoque=[...(movs||[]),...soLocalM];
      _estoqueRemotoOk=true; // ledger confirmado pelo banco — libera a reconciliação de órfãs
      _invalidarSaldoCache();
      lsMovSalvar(todosMovEstoque);
      // reenvia ao banco o que ficou preso só no aparelho
      for(const p of soLocalP){ try{ await _comTimeout(dbUpsert('produtos',p),20000,'prod'); }catch(e){ console.warn('[reenvioProd]',e?.message||e); } }
      for(const m of soLocalM){ try{ await _comTimeout(dbUpsert('estoque_movimentos',m),20000,'mov'); }catch(e){ console.warn('[reenvioMov]',e?.message||e); } }
      renderEstoque();
    }catch(e){ console.warn('[loadEstoque]', e?.message||e); }
  }
  // Cura reservas órfãs (precisa de movimentos + orçamentos carregados; a flag
  // interna garante 1x por sessão e o retry cobre a ordem de carregamento)
  setTimeout(_reconciliarReservasOrfas, 1500);
  setTimeout(_reconciliarReservasOrfas, 8000);
}

// 3 números por produto (na loja ativa):
//   FÍSICA   = o que está no depósito (entrada/saída/ajuste/transferências)
//   RESERVADA= comprometida em orçamentos aprovados ainda não entregues
//   DISPONÍVEL = física − reservada  (negativo = encomenda, precisa comprar)
const _TIPOS_FISICOS=['entrada','saida','ajuste','transf_entrada','transf_saida'];
const _TIPOS_RESERVA=['reserva','liberacao_reserva'];
// Cache de saldo — recalculado uma vez por renderEstoque(), evita O(n*p) varreduras
let _saldoCache = null; // { produtoId: { fisico, reservado } }
function _invalidarSaldoCache(){ _saldoCache = null; }
function _getSaldoCache(){
  if(_saldoCache) return _saldoCache;
  const cache = {};
  filtrarPorLoja(todosMovEstoque).forEach(m=>{
    if(!cache[m.produto_id]) cache[m.produto_id]={fisico:0,reservado:0};
    const q=parseFloat(m.quantidade)||0;
    if(_TIPOS_FISICOS.includes(m.tipo)) cache[m.produto_id].fisico+=q;
    else if(_TIPOS_RESERVA.includes(m.tipo)) cache[m.produto_id].reservado+=q;
  });
  _saldoCache=cache;
  return cache;
}
function fisicaProduto(produtoId){ return (_getSaldoCache()[produtoId]||{fisico:0}).fisico; }

function _saldoPorLoja(produtoId){
  const r={};
  (todosMovEstoque||[]).filter(m=>m.produto_id===produtoId&&GRUPO_FORTHEMP&&GRUPO_FORTHEMP.includes(m.loja_id||'')).forEach(m=>{
    const lid=m.loja_id||''; if(!r[lid]) r[lid]={fisico:0,reservado:0};
    const q=parseFloat(m.quantidade)||0;
    if(_TIPOS_FISICOS.includes(m.tipo)) r[lid].fisico+=q;
    else if(_TIPOS_RESERVA.includes(m.tipo)) r[lid].reservado+=q;
  });
  return r;
}
function reservadoProduto(produtoId){ return (_getSaldoCache()[produtoId]||{reservado:0}).reservado; }

// ── Movimentação MANUAL: exige uma unidade definida ──────────────────────────
// fisicaProduto() passa por filtrarPorLoja: em "Todas" ele devolve a soma do GRUPO
// (Camboriú + Itapema), mas registrarMovimento grava numa loja só. No ajuste isso
// é destrutivo, porque o que se lança é a DIFERENÇA: contar 86 na prateleira de
// Camboriú com 188 no grupo lançaria −102 em Camboriú. Por isso toda movimentação
// manual precisa de loja explícita, e o saldo comparado tem que ser o daquela loja.
// ══════════════════════════════════════════════════════════════════════
//  ESTOQUE COMO INDICADOR (fase 5) — tudo derivado do LEDGER
//  Nada de snapshot diário: o razão já contém a história completa, e uma
//  segunda fonte só criaria risco de divergência. Saldo retroativo, ruptura e
//  acuracidade saem de reler os mesmos movimentos.
//
//  ⚠️ A janela é curta: o razão começa em 20/06/2026. Giro "anual" tirado daí
//  seria extrapolação de ~7 semanas, então TODO indicador aqui declara sobre
//  quantos dias foi medido — e a tela mostra isso junto do número.
// ══════════════════════════════════════════════════════════════════════
function _movsDaLoja(loja){
  return (todosMovEstoque||[]).filter(m=>!loja || (m.loja_id||'')===loja);
}
function _ledgerJanela(loja){
  const ds=_movsDaLoja(loja).map(m=>String(m.data||'').slice(0,10)).filter(Boolean).sort();
  if(!ds.length) return null;
  const ini=ds[0], fim=_hojeLocal();
  const dias=Math.max(1, Math.round((new Date(fim+'T12:00:00')-new Date(ini+'T12:00:00'))/86400000));
  return {ini, fim, dias};
}
// Saldo FÍSICO de um produto numa data — reconstruído do razão, sem tabela nova.
function saldoNaData(pid, loja, iso){
  return _movsDaLoja(loja).filter(m=>m.produto_id===pid && _TIPOS_FISICOS.includes(m.tipo) &&
      String(m.data||'').slice(0,10)<=iso)
    .reduce((a,m)=>a+(parseFloat(m.quantidade)||0),0);
}

// ── Ruptura: relê o razão em ordem e marca quando o saldo cruzou para negativo.
// Hoje listaEncomendas() mostra só o estado de AGORA; a série é que vira
// indicador (quantas vezes faltou, por quanto tempo, quanto deixou de entregar).
function historicoRuptura(loja){
  const porProd={};
  _movsDaLoja(loja).filter(m=>_TIPOS_FISICOS.includes(m.tipo))
    .slice().sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')))
    .forEach(m=>{
      const p=porProd[m.produto_id]=porProd[m.produto_id]||{saldo:0, eventos:[], aberto:null};
      const antes=p.saldo;
      p.saldo+=parseFloat(m.quantidade)||0;
      const dia=String(m.data||'').slice(0,10);
      if(antes>=0 && p.saldo<0) p.aberto={inicio:dia, pior:p.saldo};
      else if(p.aberto && p.saldo<0) p.aberto.pior=Math.min(p.aberto.pior, p.saldo);
      else if(p.aberto && p.saldo>=0){
        p.eventos.push({...p.aberto, fim:dia,
          dias:Math.max(1,Math.round((new Date(dia+'T12:00:00')-new Date(p.aberto.inicio+'T12:00:00'))/86400000))});
        p.aberto=null;
      }
    });
  const hoje=_hojeLocal();
  const out=[];
  Object.entries(porProd).forEach(([pid,p])=>{
    p.eventos.forEach(e=>out.push({produto_id:pid, ...e, aberta:false}));
    if(p.aberto) out.push({produto_id:pid, ...p.aberto, fim:null, aberta:true,
      dias:Math.max(1,Math.round((new Date(hoje+'T12:00:00')-new Date(p.aberto.inicio+'T12:00:00'))/86400000))});
  });
  return out.sort((a,b)=>String(b.inicio).localeCompare(String(a.inicio)));
}

// ── Acuracidade do inventário: o ajuste de balanço JÁ guarda a diferença, e o
// saldo do sistema naquele dia é reconstruível. Erro = |diferença| ÷ saldo que o
// sistema achava que tinha. Não precisou de tabela nova.
function acuraciaInventario(loja){
  const ajustes=_movsDaLoja(loja).filter(m=>m.tipo==='ajuste' &&
    (m.motivo_cod==='inventario' || /invent/i.test(m.motivo||'')));
  if(!ajustes.length) return null;
  let somaErro=0, comBase=0, itens=0, unidades=0;
  ajustes.forEach(m=>{
    const dia=String(m.data||'').slice(0,10);
    const diff=parseFloat(m.quantidade)||0;
    const sistema=saldoNaData(m.produto_id, loja, dia)-diff; // antes do ajuste
    itens++; unidades+=Math.abs(diff);
    if(sistema>0){ somaErro+=Math.abs(diff)/sistema; comBase++; }
  });
  return {itens, unidades, contagens:ajustes.length,
          acuracia: comBase? Math.max(0, 100-(somaErro/comBase*100)) : null};
}

function renderIndicadoresEstoque(){
  const el=document.getElementById('est-indicadores'); if(!el) return;
  const loja=lojaAtiva||'';
  const jan=_ledgerJanela(loja);
  if(!jan){ el.innerHTML=''; return; }
  const prods=(typeof produtosVisiveis==='function'?produtosVisiveis():todosProdutos)||[];
  const rup=historicoRuptura(loja);
  const abertas=rup.filter(r=>r.aberta);
  const ac=acuraciaInventario(loja);

  // capital parado: sem NENHUMA saída na janela
  const parados=prods.filter(p=>{
    const saiu=_movsDaLoja(loja).some(m=>m.produto_id===p.id && m.tipo==='saida');
    return !saiu && _fisicaProdutoNaLoja(p.id, loja||LOJA_PADRAO_ID)>0;
  });
  const capitalParado=parados.reduce((a,p)=>a+_fisicaProdutoNaLoja(p.id, loja||LOJA_PADRAO_ID)*(parseFloat(p.custo)||0),0);

  el.innerHTML=
   `<div class="dash">
      <div class="dc b"><div class="dl">Janela medida</div><div class="dv">${jan.dias}d</div>
        <div class="ds">desde ${_dataBR(jan.ini)}</div></div>
      <div class="dc ${abertas.length?'r':'g'}"><div class="dl">Faltando agora</div>
        <div class="dv"${abertas.length?' style="color:var(--red)"':''}>${abertas.length}</div>
        <div class="ds">${rup.length} ruptura${rup.length!==1?'s':''} na janela</div></div>
      <div class="dc y"><div class="dl">Capital parado</div><div class="dv">${brl(capitalParado)}</div>
        <div class="ds">${parados.length} sem saída na janela</div></div>
      <div class="dc ${ac&&ac.acuracia!=null?(ac.acuracia>=95?'g':'y'):'b'}"><div class="dl">Acuracidade</div>
        <div class="dv">${ac&&ac.acuracia!=null?ac.acuracia.toFixed(0)+'%':'—'}</div>
        <div class="ds">${ac?`${ac.itens} item${ac.itens!==1?'s':''} contado${ac.itens!==1?'s':''}`:'nenhum balanço ainda'}</div></div>
    </div>`+
   (rup.length? `<div style="font-size:12.5px;color:var(--c2);font-weight:700;margin:4px 0 6px">Rupturas na janela</div>`+
     rup.slice(0,8).map(r=>{
       const p=produtoById(r.produto_id);
       return `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--gray-light);font-size:12.5px">
         <div style="min-width:0"><div style="font-weight:600;color:var(--c2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p?p.nome:r.produto_id)}</div>
           <div style="font-size:11px;color:var(--gray)">${_dataBR(r.inicio)}${r.fim?' → '+_dataBR(r.fim):' → em aberto'} · ${r.dias} dia${r.dias!==1?'s':''}</div></div>
         <div style="text-align:right;white-space:nowrap;color:${r.aberta?'var(--red)':'var(--gray)'};font-weight:700">${fmtQtd(Math.abs(r.pior))} em falta</div>
       </div>`;}).join('')
     +(rup.length>8?`<div style="font-size:11px;color:var(--gray);padding:6px 0">+${rup.length-8} outras</div>`:'')
    : '')+
   `<div style="font-size:11px;color:var(--gray);margin-top:9px;line-height:1.5">
      Tudo calculado relendo o razão de estoque, sem tabela paralela. A janela é
      curta (${jan.dias} dias): giro e cobertura valem para esse período, não
      para o ano.</div>`;
}

function _lojaParaMovimento(){ return lojaAtiva || (Array.isArray(LOJAS)&&LOJAS.length===1 ? LOJAS[0].id : ''); }
function _fisicaProdutoNaLoja(produtoId, loja){
  return (todosMovEstoque||[])
    .filter(m=>m.produto_id===produtoId && (m.loja_id||'')===loja && _TIPOS_FISICOS.includes(m.tipo))
    .reduce((a,m)=>a+(parseFloat(m.quantidade)||0),0);
}
function disponivelProduto(produtoId){ const s=_getSaldoCache()[produtoId]||{}; return (s.fisico||0)-(s.reservado||0); }
function saldoProduto(produtoId){ return fisicaProduto(produtoId); } // compat
function produtoById(id){ return todosProdutos.find(p=>p.id===id)||null; }

// Registra um movimento (local imediato + sync em background, resiliente).
function registrarMovimento({produto_id, tipo, quantidade, custo_unit, motivo, motivoCod, ref, lojaId}){
  if(!produto_id){ console.warn('[mov] produto_id ausente — movimento ignorado', {tipo,ref}); return null; }
  const _TIPOS_VALIDOS=[..._TIPOS_FISICOS,..._TIPOS_RESERVA];
  if(!_TIPOS_VALIDOS.includes(tipo)){ console.warn('[mov] tipo inválido:', tipo, '— esperado:', _TIPOS_VALIDOS.join('|')); return null; }
  const s=getSessao();
  const mov={
    id:'mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
    loja_id: lojaId || lojaAtiva || produtoById(produto_id)?.loja_id || LOJA_PADRAO_ID,
    produto_id, tipo,
    quantidade: parseFloat(quantidade)||0,
    custo_unit: custo_unit!=null?parseFloat(custo_unit)||0:null,
    motivo: motivo||'', motivo_cod: motivoCod||null, ref: ref||null,
    usuario: s?.nome||'', data: new Date().toISOString()
  };
  todosMovEstoque.unshift(mov);
  _invalidarSaldoCache();
  lsMovSalvar(todosMovEstoque);
  if(dbOk&&db){
    (async()=>{ try{ const r=await _comTimeout(dbInsert('estoque_movimentos',mov),20000,'mov'); if(r&&r.error) console.warn('[mov sync]', r.error.message); }catch(e){ console.warn('[mov sync bg]', e?.message||e); } })();
  }
  // Auditoria: só movimentos físicos relevantes (reserva/liberação são internos, não loga)
  if(['entrada','saida','ajuste','transf_entrada','transf_saida'].includes(tipo)){
    const p=produtoById(produto_id);
    logAcao('estoque_mov', `${tipo} ${Math.abs(mov.quantidade)} ${p?.unidade||'un'} · ${p?.nome||produto_id}${motivo?' ('+motivo+')':''}`);
  }
  return mov;
}

// Um produto de um orçamento já foi TRATADO na entrega (baixado ou marcado como não-levado)?
function _entregueProdutoOrc(orcId, pid){
  return todosMovEstoque.some(m=> m.ref==='baixa:orc:'+orcId+':'+pid || m.ref==='libres:orc:'+orcId+':'+pid);
}
// Orçamento aprovado com produtos ainda não entregues?
function orcTemEntregaPendente(orc){
  if(!orc||orc.status!=='aprovado') return false;
  return (orc.servicos||[]).some(s=>s.produto_id && !_entregueProdutoOrc(orc.id,s.produto_id));
}

// ── Reconciliação da RESERVA de um orçamento (aprovar/reverter/editar/excluir) ──
// Aprovado e não entregue → reserva os produtos. Reverteu/excluiu/entregou → libera.
// Idempotente: lança só a diferença entre o que deveria estar reservado e o que já está.
function sincronizarReservaOrcamento(orc){
  if(!orc||!orc.id) return;
  const aprovado = orc.status==='aprovado';
  const desejado={};
  if(aprovado){
    (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
      if(_entregueProdutoOrc(orc.id,s.produto_id)) return; // já entregue → não reserva
      desejado[s.produto_id]=(desejado[s.produto_id]||0)+(parseInt(s.qty)||1);
    });
  }
  // já reservado por este orçamento (net dos movimentos de reserva/liberação deste orc)
  // lojaDaReserva: a liberação TEM que cair na mesma loja em que a reserva entrou.
  // Antes usava orc.loja_id, que é null no caminho de órfã — aí registrarMovimento
  // caía no fallback `lojaAtiva`, ou seja, a loja que o usuário estava vendo na hora.
  // Resultado real em produção: reserva lançada em Camboriú e liberada em Aquamotor,
  // deixando as duas lojas com saldo errado de um produto que uma nunca reservou.
  const jaReservado={}, lojaDaReserva={};
  todosMovEstoque.filter(m=>_TIPOS_RESERVA.includes(m.tipo) && m.ref && m.ref.indexOf('orc:'+orc.id)>=0).forEach(m=>{
    jaReservado[m.produto_id]=(jaReservado[m.produto_id]||0)+(parseFloat(m.quantidade)||0);
    if(!lojaDaReserva[m.produto_id] && m.tipo==='reserva') lojaDaReserva[m.produto_id]=m.loja_id||null;
  });
  const ids=new Set([...Object.keys(desejado),...Object.keys(jaReservado)]);
  let mudou=false;
  ids.forEach(pid=>{
    let delta=(desejado[pid]||0)-(jaReservado[pid]||0);
    if(Math.abs(delta)<0.0001) return;
    const lojaMov=lojaDaReserva[pid]||orc.loja_id;
    // Trava de segurança: liberar nunca pode empurrar o reservado do produto abaixo
    // de zero (reservado negativo INFLA o disponível e o app passa a oferecer
    // estoque que não existe). Se o cálculo pedir mais do que há reservado, libera
    // só o que existe. Rede contra qualquer visão defasada do ledger.
    if(delta<0){
      const reservadoAtual=todosMovEstoque
        .filter(m=>_TIPOS_RESERVA.includes(m.tipo) && m.produto_id===pid && (!lojaMov||m.loja_id===lojaMov))
        .reduce((a,m)=>a+(parseFloat(m.quantidade)||0),0);
      if(reservadoAtual+delta < -0.0001){
        console.warn('[reserva] liberação limitada — reservado atual',reservadoAtual,'pedido',delta,'produto',pid);
        delta=-Math.max(0,reservadoAtual);
        if(Math.abs(delta)<0.0001) return;
      }
    }
    const numStr=String(orc.numero||'').padStart(3,'0');
    registrarMovimento({
      produto_id:pid, tipo: delta>0?'reserva':'liberacao_reserva', quantidade:delta,
      custo_unit:null,
      motivo:(delta>0?'Reserva orçamento #':'Libera reserva #')+numStr,
      ref:'res:orc:'+orc.id+':'+pid+':'+Date.now()+Math.random().toString(36).slice(2,5),
      lojaId:lojaMov
    });
    mudou=true;
  });
  if(mudou && document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
}

// ── Entrega: converte reserva em baixa física (OS concluída, botão manual ou validação de itens) ──
// qtyMap (opcional): { produto_id: quantidade realmente levada }. Item ausente = leva a qtd do
// orçamento; item com 0 = não foi levado (não baixa física, mas libera a reserva).
function entregarOrcamento(orc, origem, qtyMap){
  if(!orc||!orc.id) return;
  if(orc.status!=='aprovado'){ if(origem==='manual'||origem==='validar') toast('⚠️ Só dá baixa de orçamento aprovado'); return; }
  let baixou=false;
  (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
    const pid=s.produto_id;
    if(_entregueProdutoOrc(orc.id,pid)) return; // já tratado
    const reservado=Math.abs(parseInt(s.qty)||1);
    const levado = qtyMap && (pid in qtyMap) ? Math.max(0,Math.abs(parseFloat(qtyMap[pid])||0)) : reservado;
    const p=produtoById(pid);
    const numStr=String(orc.numero||'').padStart(3,'0');
    if(levado>0){
      registrarMovimento({produto_id:pid, tipo:'saida', quantidade:-levado, custo_unit:p?p.custo:null, motivo:'Entrega orçamento #'+numStr, ref:'baixa:orc:'+orc.id+':'+pid, lojaId:orc.loja_id});
    }
    // libera SEMPRE a reserva (item resolvido na entrega, levando tudo, parte ou nada)
    registrarMovimento({produto_id:pid, tipo:'liberacao_reserva', quantidade:-reservado, custo_unit:null, motivo:(levado>0?'Baixa entrega #':'Item não levado #')+numStr, ref:'libres:orc:'+orc.id+':'+pid, lojaId:orc.loja_id});
    baixou=true;
  });
  if(baixou){
    if(typeof renderTabela==='function') renderTabela();
    if(document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
    atualizarDash&&atualizarDash();
    if(origem==='manual'||origem==='validar') toast('✅ Itens confirmados e baixa realizada');
  } else if(origem==='manual'||origem==='validar'){ toast('Nada a baixar (sem produtos ou já confirmado)'); }
}
// Compat: chamadas antigas de baixa agora gerenciam a RESERVA
// ══════════════════════════════════════════════════════════════════════════════
//  APROVOU → SAI DO ESTOQUE  (substitui o antigo reserva → entrega)
//  O desenho de duas etapas exigia confirmar a entrega depois, e isso não
//  acontecia: 95% dos aprovados reservavam, só 7% davam baixa — porque a baixa
//  dependia de concluir a OS, e só 1 de 12 OS era concluída. O material saía do
//  depósito na vida real e o sistema continuava contando como se estivesse lá.
//
//  Aqui a baixa acontece no momento da venda, que é quando a decisão realmente
//  ocorre. Se não houver saldo, fica negativo de propósito: é assim que o item
//  entra na lista de compras — o modelo da casa é vender primeiro e comprar
//  depois. Reserva deixa de existir: só protege quem tem estoque para proteger.
//
//  Reconciliação idempotente (mesma ideia da antiga): compara o que DEVERIA ter
//  saído com o que JÁ saiu e lança só a diferença. Então reverter um orçamento
//  aprovado devolve o material sozinho, e rodar duas vezes não duplica nada.
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
//  CUSTO CONGELADO NO ITEM (fase 2.1)
//  `produtos.custo` é o CMP e é REESCRITO a cada entrada (recomputarCMP). Então
//  calcular a margem de um orçamento de abril com o custo de hoje dá um número
//  errado — e ninguém percebe, porque ele continua "fazendo sentido".
//  Na aprovação, cada item vinculado guarda o custo daquele momento.
//
//  A saída no razão já carimbava o custo (é de lá que o DRE tira o CMV); isto é
//  a outra metade: permite margem POR ORÇAMENTO, inclusive depois de o item ser
//  estornado ou o produto mudar de preço.
//  Só marca item com produto_id — item de texto livre não tem de onde tirar
//  custo, e inventar um seria pior do que deixar em branco.
// ══════════════════════════════════════════════════════════════════════
function _congelarCustoOrc(orc){
  if(!orc || !Array.isArray(orc.servicos)) return false;
  let mudou=false;
  orc.servicos.forEach(s=>{
    if(!s || !s.produto_id) return;
    if(s.custo_unit!=null) return;          // já congelado: não reescreve
    const p=produtoById(s.produto_id);
    if(!p || p.custo==null || p.custo==='') return;
    const cu=parseFloat(p.custo)||0;
    if(!cu) return;
    s.custo_unit=cu;
    s.custo_total=cu*Math.abs(parseInt(s.qty)||1);
    s.custo_em=_hojeLocal();
    mudou=true;
  });
  return mudou;
}
// Margem de um orçamento a partir do custo congelado. Devolve `cobertura` = % do
// valor cujo custo é conhecido — sem isso a margem parece precisa quando é
// parcial. É o mesmo cuidado da análise de clientes.
function margemOrcamento(orc){
  let svcs=orc&&orc.servicos;
  if(typeof svcs==='string'){ try{ svcs=JSON.parse(svcs||'[]'); }catch(e){ svcs=[]; } }
  svcs=Array.isArray(svcs)?svcs:[];
  let receita=0, custo=0, receitaComCusto=0;
  svcs.forEach(s=>{
    const q=Math.abs(parseInt(s.qty)||1);
    const v=(parseFloat(s.p)||0)*q;
    receita+=v;
    if(s.custo_total!=null){ custo+=parseFloat(s.custo_total)||0; receitaComCusto+=v; }
  });
  if(!receita) return null;
  return {receita, custo, margem:receita-custo,
          pct:(receita-custo)/receita*100,
          cobertura: receitaComCusto/receita*100};
}

function sincronizarSaidaOrcamento(orc){
  if(!orc||!orc.id) return;
  const aprovado = orc.status==='aprovado';
  const desejado={};
  if(aprovado){
    (orc.servicos||[]).filter(s=>s.produto_id).forEach(s=>{
      desejado[s.produto_id]=(desejado[s.produto_id]||0)+Math.abs(parseInt(s.qty)||1);
    });
  }
  // Quanto já saiu por este orçamento (saida negativa, estorno positivo).
  const jaSaiu={}, lojaDaSaida={};
  (todosMovEstoque||[]).forEach(m=>{
    if(!m.ref||m.ref.indexOf('baixa:orc:'+orc.id)!==0) return;
    const q=parseFloat(m.quantidade)||0;
    jaSaiu[m.produto_id]=(jaSaiu[m.produto_id]||0)+(-q); // guarda como positivo
    if(!lojaDaSaida[m.produto_id] && m.tipo==='saida') lojaDaSaida[m.produto_id]=m.loja_id||null;
  });
  // ── Legado: orçamento do modelo antigo ainda tem RESERVA em aberto ──────────
  // Se deixássemos a reserva de pé e ainda lançássemos a saída, o disponível
  // levaria o golpe duas vezes (reservado + baixado). Ao tocar num orçamento
  // assim, converte: solta a reserva e deixa só a saída, que é a verdade agora.
  // Acontece item a item, conforme o orçamento é mexido — nunca em massa, para
  // não baixar os 179 legados sem a conferência da equipe.
  const reservaAberta={}, lojaDaReservaLegado={};
  (todosMovEstoque||[]).forEach(m=>{
    if(!m.ref||m.ref.indexOf('res:orc:'+orc.id)!==0) return;
    if(!_TIPOS_RESERVA.includes(m.tipo)) return;
    reservaAberta[m.produto_id]=(reservaAberta[m.produto_id]||0)+(parseFloat(m.quantidade)||0);
    if(!lojaDaReservaLegado[m.produto_id] && m.tipo==='reserva') lojaDaReservaLegado[m.produto_id]=m.loja_id||null;
  });
  Object.keys(reservaAberta).forEach(pid=>{
    const resta=reservaAberta[pid];
    if(resta<=0.0001) return;
    registrarMovimento({
      produto_id:pid, tipo:'liberacao_reserva', quantidade:-resta, custo_unit:null,
      motivo:'Libera reserva #'+String(orc.numero||'').padStart(3,'0')+' — agora a baixa é na aprovação',
      ref:'libres:orc:'+orc.id+':'+pid+':migra',
      lojaId:lojaDaReservaLegado[pid]||orc.loja_id||_lojaParaMovimento()
    });
  });

  const ids=new Set([...Object.keys(desejado),...Object.keys(jaSaiu)]);
  let mudou=false;
  ids.forEach(pid=>{
    const delta=(desejado[pid]||0)-(jaSaiu[pid]||0);
    if(Math.abs(delta)<0.0001) return;
    const p=produtoById(pid);
    const numStr=String(orc.numero||'').padStart(3,'0');
    // O estorno TEM que voltar para a mesma loja de onde saiu — usar a loja da
    // sessão aqui foi o que espalhou saldo errado entre as unidades antes.
    const loja=lojaDaSaida[pid]||orc.loja_id||_lojaParaMovimento();
    registrarMovimento({
      produto_id:pid,
      tipo: delta>0?'saida':'entrada',
      quantidade: delta>0?-delta:Math.abs(delta),
      custo_unit:p?p.custo:null,
      motivo:(delta>0?'Venda — orçamento #':'Estorno — orçamento #')+numStr+(delta>0?'':' deixou de estar aprovado'),
      ref:'baixa:orc:'+orc.id+':'+pid,
      lojaId:loja
    });
    mudou=true;
  });
  if(mudou){
    if(typeof renderTabela==='function') renderTabela();
    if(document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
    atualizarDash&&atualizarDash();
  }
  return mudou;
}
// Ponto de entrada usado em toda mudança de status (aprovar, reverter, excluir,
// aprovação pelo portal). Mantém o nome antigo para não espalhar a troca.
// ⚠️ NÃO reprocessa os orçamentos aprovados ANTES desta mudança: aqueles ainda
// têm reserva do modelo antigo e estão em conferência com a equipe. Reprocessar
// baixaria tudo de uma vez, sem ninguém checar se já foi entregue.
function sincronizarBaixaOrcamento(orc){ return sincronizarSaidaOrcamento(orc); }

// ── Reconciliação de reservas órfãs (1x por sessão de gestor) ──
// Reserva só é legítima com orçamento APROVADO aguardando entrega. Se o orc
// venceu/foi recusado/apagado (ou era teste antigo), a reserva ficava presa
// para sempre, roubando o "disponível" e distorcendo a lista de compras.
// (Auditoria 23/07: 7 reservas presas — 4 de orcs vencidos, 3 de testes.)
let _reservasReconciliadas=false;
function _reconciliarReservasOrfas(){
  if(_reservasReconciliadas) return;
  if(!Array.isArray(todosMovEstoque)||!todosMovEstoque.length) return; // estoque ainda não carregou
  if(!Array.isArray(todosOrc)||!todosOrc.length) return;               // orçamentos ainda não carregaram
  // ⚠️ Esta função ESCREVE no ledger — só pode rodar sobre dados confirmados pelo
  // banco, nunca sobre o cache local. Rodando com cache defasado, um orçamento
  // APROVADO que ainda não está no cache é lido como "órfão" e tem a reserva
  // liberada; como a sessão seguinte continua sem enxergar essa liberação, o erro
  // se repete e empurra o reservado para NEGATIVO (inflando o disponível).
  // Foi exatamente isso que aconteceu em produção: 17 pares loja/produto afetados,
  // o orçamento #260 (aprovado) liberado 6 vezes. Só roda com as duas listas vindas
  // do banco nesta sessão.
  if(!dbOk||!db) return;
  if(!_estoqueRemotoOk||!_orcRemotoOk) return;
  _reservasReconciliadas=true;
  try{
    const porOrc={};
    todosMovEstoque.forEach(m=>{
      if(!_TIPOS_RESERVA.includes(m.tipo)||!m.ref) return;
      const i=m.ref.indexOf('orc:'); if(i<0) return;
      const resto=m.ref.slice(i+4);
      const j=m.produto_id?resto.indexOf(':'+m.produto_id):-1;
      const orcId=j>0?resto.slice(0,j):resto.split(':')[0];
      porOrc[orcId]=(porOrc[orcId]||0)+(parseFloat(m.quantidade)||0);
    });
    let liberadas=0;
    Object.entries(porOrc).forEach(([orcId,net])=>{
      if(net<=0.001) return;                       // sem reserva em aberto
      const o=todosOrc.find(x=>x.id===orcId);
      if(o && o.status==='aprovado') return;       // legítima: aguardando entrega
      // Não-aprovado ou orçamento inexistente (teste apagado) → libera tudo dele
      sincronizarReservaOrcamento(o||{id:orcId, numero:'?', status:'vencido', servicos:[], loja_id:null});
      liberadas++;
    });
    if(liberadas){
      console.warn(`[reconciliarReservas] ${liberadas} reserva(s) órfã(s) liberada(s)`);
      logAcao('estoque_reconciliacao', `${liberadas} reserva(s) órfã(s) liberada(s) automaticamente`);
    }
  }catch(e){ console.warn('[reconciliarReservas]', e?.message||e); }
}
// Quando uma OS é concluída, dá baixa do orçamento vinculado (se houver)
function _entregarPelaOS(osId){
  if(!osId) return;
  let os=(todosOS||[]).find(x=>String(x.id)===String(osId));
  if(!os){ try{ os=(JSON.parse(ls('fluxa_os_hist')||'[]')||[]).find(x=>String(x.id)===String(osId)); }catch(e){ console.warn('[entregarPelaOS]',e?.message||e); } }
  const orcId=os?.orcamento_id;
  if(!orcId) return;
  const orc=todosOrc.find(o=>String(o.id)===String(orcId));
  if(orc && orc.status==='aprovado') entregarOrcamento(orc,'os');
}
function concluirOSHistorico(osId){
  confirmar('Marcar OS como concluída?\n\nIsso registrará a baixa de estoque automaticamente se houver orçamento vinculado.', ()=>{
    // Atualiza status local
    const idx=todosOS.findIndex(x=>x.id===osId);
    if(idx>=0) todosOS[idx].status='concluido';
    try{
      const lista=JSON.parse(ls('fluxa_os_hist')||'[]');
      const i=lista.findIndex(x=>x.id===osId);
      if(i>=0){ lista[i].status='concluido'; lsSet('fluxa_os_hist',JSON.stringify(lista.slice(0,200))); }
    }catch(e){ console.warn('[concluirOSHistorico local]',e?.message||e); }
    // Sync banco
    if(dbOk&&db&&!String(osId).startsWith('local_'))
      dbUpdate('ordens_servico',{status:'concluido'},'id',osId).catch(e=>console.warn('[concluirOS sync]',e?.message||e));
    // Baixa de estoque automática
    _entregarPelaOS(osId);
    const os=_acharOS(osId);
    logAcao('os_concluida',`OS #${String(os?.numero||'').padStart(3,'0')} ${os?.cliente||''}`);
    // Se era OS de agendamento recorrente, gera a próxima ocorrência
    if(os?.agendamento_id) _gerarProximaOSdoAg(os.agendamento_id, os.data_servico).catch(e=>console.warn('[nextOS]',e?.message||e));
    renderOSTabela();
    // Atualiza também a lista do técnico (Minhas OS) quando concluído pelo campo
    if(document.getElementById('page-minhas-os')?.classList.contains('on')) loadMinhasOS();
    toast('✅ OS concluída · estoque baixado automaticamente');
  }, 'Concluir OS');
}
// Física total do produto (todas as lojas) — base para o custo médio ponderado
function fisicaProdutoTotal(produtoId){
  return todosMovEstoque
    .filter(m=>m.produto_id===produtoId && _TIPOS_FISICOS.includes(m.tipo))
    .reduce((a,m)=>a+(parseFloat(m.quantidade)||0),0);
}
// Produtos visíveis no contexto de loja atual.
// Lojas do grupo Forthemp compartilham o mesmo catálogo de produtos;
// o estoque (movimentos) é individualizado por loja_id no movimento.
// Lojas fora do grupo (ex: Acquamotor) têm catálogo próprio.
function produtosVisiveis(){
  const ativos=todosProdutos.filter(p=>p.ativo!==false);
  if(!lojaAtiva) return filtrarPorLoja(ativos); // "Todas" → grupo
  const comMov=new Set(todosMovEstoque.filter(m=>(m.loja_id||'')===lojaAtiva).map(m=>m.produto_id));
  if(GRUPO_FORTHEMP&&GRUPO_FORTHEMP.includes(lojaAtiva)){
    // Catálogo compartilhado: mostra produtos de qualquer loja do grupo Forthemp
    return ativos.filter(p=>GRUPO_FORTHEMP.includes(p.loja_id||'')||comMov.has(p.id));
  }
  // Loja isolada (Acquamotor etc.): só produtos próprios
  return ativos.filter(p=>(p.loja_id||'')===lojaAtiva||comMov.has(p.id));
}
// Produtos com disponível negativo = encomendas (vendido/comprometido sem estoque)
function listaEncomendas(){
  return produtosVisiveis()
    .map(p=>({p, falta: -disponivelProduto(p.id)}))
    .filter(x=>x.falta>0.0001)
    .sort((a,b)=>b.falta-a.falta);
}

// ── Custo médio ponderado (CMP): recalcula o custo do produto a cada entrada ──
function recomputarCMP(produtoId, qtdEntrada, custoEntrada, fisAntes){
  if(!(parseFloat(custoEntrada)>0)) return; // sem custo informado → mantém
  const p=produtoById(produtoId); if(!p) return;
  const qe=Math.abs(parseFloat(qtdEntrada)||0);
  const base=Math.max(0,fisAntes); // estoque negativo não entra no rateio
  const custoAtual=parseFloat(p.custo)||0;
  const novo=(base+qe)>0 ? (base*custoAtual + qe*parseFloat(custoEntrada))/(base+qe) : parseFloat(custoEntrada);
  p.custo=Math.round(novo*100)/100;
  const idx=todosProdutos.findIndex(x=>x.id===produtoId);
  if(idx>=0) todosProdutos[idx]=p;
  lsProdSalvar(todosProdutos);
  if(dbOk&&db){ (async()=>{ try{ const r=await _comTimeout(dbUpsert('produtos',p),20000,'cmp'); if(r&&r.error) console.warn('[cmp sync]',r.error.message); }catch(e){ console.warn('[cmp bg]',e?.message||e); } })(); }
}

// ── Transferência entre unidades (dois movimentos ligados, carregando o custo) ──
function transferirProduto(produtoId, qtd, lojaDestino, motivo){
  const p=produtoById(produtoId); if(!p) return false;
  const q=Math.abs(parseFloat(qtd)||0);
  if(q<=0) return false;
  const origem=lojaAtiva||p.loja_id||LOJA_PADRAO_ID;
  if(lojaDestino===origem) return false;
  const ref='transf:'+produtoId+':'+Date.now();
  registrarMovimento({produto_id:produtoId, tipo:'transf_saida', quantidade:-q, custo_unit:p.custo, motivo:'Transferência → '+getLojaNome(lojaDestino)+(motivo?' · '+motivo:''), ref:ref+':out', lojaId:origem});
  registrarMovimento({produto_id:produtoId, tipo:'transf_entrada', quantidade:q, custo_unit:p.custo, motivo:'Transferência ← '+getLojaNome(origem)+(motivo?' · '+motivo:''), ref:ref+':in', lojaId:lojaDestino});
  renderEstoque();
  return true;
}

// ── UI do estoque ──
function buscaEstoque(v){ estoqueBusca=(v||'').toLowerCase(); renderEstoque(); }
let estoqueFiltro='todos';
let estoqueCategoria='';
function filtEstoque(f){ estoqueFiltro=f; renderEstoque(); }
function filtCategoria(v){ estoqueCategoria=v; renderEstoque(); }
function toggleCategOutro(){
  const v=gV('prod-categoria');
  const wrap=document.getElementById('prod-catoutra-wrap');
  if(wrap) wrap.style.display=(v==='Outro')?'':'none';
}

// ── Analíticos de estoque ──
function giroProduto(pid, dias){ // total de SAÍDA (consumo) nos últimos N dias
  const lim=Date.now()-(dias||90)*86400000;
  return filtrarPorLoja(todosMovEstoque)
    .filter(m=>m.produto_id===pid && m.tipo==='saida' && new Date(m.data).getTime()>=lim)
    .reduce((a,m)=>a+Math.abs(parseFloat(m.quantidade)||0),0);
}
function consumoDia(pid){ return giroProduto(pid,90)/90; }
function diasParaRuptura(pid){ const c=consumoDia(pid); if(c<=0) return Infinity; const d=disponivelProduto(pid); return d<=0?0:d/c; }
// Saldos físicos negativos no escopo atual. Negativo é INCONSISTÊNCIA (saiu mais
// do que entrou), não uma situação de operação — vale tanto para item de estoque
// próprio quanto para venda sob encomenda. Sem este alerta o caso só aparecia
// para quem abrisse produto a produto: 3 saldos ficaram meses assim.
// Percorre por LOJA porque o erro costuma ser de lançamento na loja errada
// (baixa feita em Itapema de um produto que só existia em Camboriú).
// Inclui INATIVOS de propósito: desativar o produto não zera o saldo, então um
// item negativo pode ter sido "resolvido" apenas sumindo da lista — o furo
// contábil continua lá. Medido: dos 3 negativos em ago/2026, 2 estavam assim.
function _estoqueNegativos(){
  const out=[];
  const _push=(p,saldo,lojaNome)=>out.push({p, saldo, lojaNome, inativo:p.ativo===false});
  [...produtosVisiveis(), ...produtosVisiveisInativos()].forEach(p=>{
    if(lojaAtiva){
      const s=fisicaProduto(p.id);
      if(s<-0.0001) _push(p,s,'');
      return;
    }
    // Visão consolidada: aponta a loja específica onde o saldo furou.
    const porLoja=_saldoPorLoja(p.id);
    Object.keys(porLoja).forEach(lid=>{
      if(porLoja[lid].fisico < -0.0001) _push(p, porLoja[lid].fisico, getLojaNome(lid));
    });
  });
  // Ativos primeiro (acionáveis), depois os inativos; dentro de cada, pior saldo.
  return out.sort((a,b)=>(a.inativo?1:0)-(b.inativo?1:0) || a.saldo-b.saldo);
}
function produtoParado(pid){
  if(fisicaProduto(pid)<=0) return false;
  if(giroProduto(pid,90)>0) return false;
  // Não marca como parado se o produto foi cadastrado/movimentado há menos de 90 dias
  const lim90=Date.now()-90*86400000;
  const movs=filtrarPorLoja(todosMovEstoque).filter(m=>m.produto_id===pid);
  if(!movs.length) return false; // sem nenhuma movimentação ainda
  const primeiraMov=Math.min(...movs.map(m=>new Date(m.data).getTime()));
  return primeiraMov<lim90; // só é "parado" se existe há mais de 90 dias sem girar
}
function ultimaMovData(pid){
  const ms=filtrarPorLoja(todosMovEstoque).filter(m=>m.produto_id===pid).map(m=>new Date(m.data).getTime());
  return ms.length?Math.max(...ms):0;
}
// Curva ABC por valor de consumo (saída × custo) nos últimos 180 dias
function curvaABC(){
  const prods=produtosVisiveis();
  const valor={};
  prods.forEach(p=>{ valor[p.id]=giroProduto(p.id,180)*(parseFloat(p.custo)||0); });
  const ordenados=prods.slice().sort((a,b)=>(valor[b.id]||0)-(valor[a.id]||0));
  const total=ordenados.reduce((a,p)=>a+(valor[p.id]||0),0)||1;
  // Classifica pelo acumulado ANTES do item (o que cruza os 80% e' A). Antes
  // usava o acumulado DEPOIS, entao um produto que sozinho vale 85% do consumo
  // caia em B e a curva ficava sem nenhum A.
  let acc=0; const classe={};
  ordenados.forEach(p=>{ const antes=acc/total; acc+=(valor[p.id]||0);
    classe[p.id]= (valor[p.id]||0)<=0 ? 'C' : (antes<0.8?'A':antes<0.95?'B':'C'); });
  return {valor, classe, ordenados, total};
}

// Status de validade de um produto (para químicos como cloro).
// Retorna null se não tem validade; senão {txt, cor, bg, vencido, dias}.
function _validadeInfo(dateStr){
  if(!dateStr) return null;
  const val=new Date(dateStr+'T00:00:00'); if(isNaN(val)) return null;
  const hoje=new Date((typeof _hojeLocal==='function'?_hojeLocal():new Date().toISOString().slice(0,10))+'T00:00:00');
  const dias=Math.round((val-hoje)/86400000);
  if(dias<0)  return {txt:'⛔ Vencido', cor:'#b91c1c', bg:'#fee2e2', vencido:true, dias};
  if(dias<=30) return {txt:`⏳ Vence em ${dias}d`, cor:'#92400e', bg:'#fef3c7', vencido:false, dias};
  return {txt:`📅 Val ${val.toLocaleDateString('pt-BR')}`, cor:'#475569', bg:'#f1f5f9', vencido:false, dias};
}
// Produto com validade vencida ou vencendo em ≤30 dias
function produtoVencendo(p){ const i=_validadeInfo(p&&p.validade); return !!i && i.dias<=30; }

function renderEstoque(){
  setTimeout(()=>{ try{ renderIndicadoresEstoque(); }catch(e){ console.warn('[indEstoque]',e?.message||e); } },0);
  const body=document.getElementById('estoque-body'); if(!body) return;
  const todos=produtosVisiveis(); // ativos da loja
  const inativos=produtosVisiveisInativos();
  const enc=listaEncomendas();
  const repor=todos.filter(p=>{ const m=parseFloat(p.estoque_minimo)||0; const d=disponivelProduto(p.id); return m>0 && d>=0 && d<=m; });
  const parados=todos.filter(p=>produtoParado(p.id));
  const vencendo=todos.filter(produtoVencendo);
  // Sem custo = sem margem e sem valor de estoque confiável. Prioriza quem TEM
  // saldo (esses distorcem o "Valor em estoque" contando como zero); os demais
  // vêm depois. Medido em ago/2026: 236 de 419 sem custo, 30 deles com saldo.
  const semCusto=todos.filter(p=>!(parseFloat(p.custo)>0))
    .sort((a,b)=>(fisicaProduto(b.id)>0?1:0)-(fisicaProduto(a.id)>0?1:0));
  const semCustoComSaldo=semCusto.filter(p=>fisicaProduto(p.id)>0).length;
  const abc=curvaABC();

  // ── KPIs ──
  const valorEstoque=todos.reduce((a,p)=>a+(Math.max(0,fisicaProduto(p.id))*(parseFloat(p.custo)||0)),0);
  const valorReservado=todos.reduce((a,p)=>a+(Math.max(0,reservadoProduto(p.id))*(parseFloat(p.custo)||0)),0);
  const valorEncomenda=enc.reduce((a,x)=>a+(x.falta*(parseFloat(x.p.custo)||0)),0);
  const valorParado=parados.reduce((a,p)=>a+(Math.max(0,fisicaProduto(p.id))*(parseFloat(p.custo)||0)),0);
  const kpis=document.getElementById('estoque-kpis');
  if(kpis) kpis.innerHTML=`
    <div class="dc o" ${semCustoComSaldo?`style="cursor:pointer" onclick="filtEstoque('semcusto')"`:''}><div class="dl">Valor em estoque</div><div class="dv">${brl(valorEstoque)}</div><div class="ds"${semCustoComSaldo?' style="color:var(--yellow);font-weight:700" title="Estes produtos têm saldo mas custo zerado, então entram como R$ 0 e o valor real é maior"':''}>${todos.length} produto${todos.length!==1?'s':''}${semCustoComSaldo?` · ⚠️ ${semCustoComSaldo} sem custo`:''}</div></div>
    <div class="dc ${enc.length?'r':'g'}" style="cursor:pointer" onclick="filtEstoque('comprar')"><div class="dl">A comprar (encomenda)</div><div class="dv">${enc.length}</div><div class="ds">${brl(valorEncomenda)}</div></div>
    <div class="dc y" style="cursor:pointer" onclick="filtEstoque('repor')"><div class="dl">Repor (mínimo)</div><div class="dv">${repor.length}</div><div class="ds">abaixo do mínimo</div></div>
    <div class="dc b" style="cursor:pointer" onclick="filtEstoque('parados')"><div class="dl">Capital parado</div><div class="dv">${brl(valorParado)}</div><div class="ds">${parados.length} sem giro (90d)</div></div>
    ${vencendo.length?`<div class="dc r" style="cursor:pointer" onclick="filtEstoque('validade')"><div class="dl">Validade</div><div class="dv">${vencendo.length}</div><div class="ds">vencendo/vencido</div></div>`:''}`;

  // ── Abas de filtro ──
  const tabs=[
    ['todos','Todos',todos.length],
    ['comprar','📥 A comprar',enc.length],
    ['repor','🔄 Repor',repor.length],
    ['parados','💤 Parados',parados.length],
    ['validade','⏳ Validade',vencendo.length],
    ['semcusto','💲 Sem custo',semCusto.length],
    ['inativos','🚫 Inativos',inativos.length],
  ];
  const tabsEl=document.getElementById('estoque-tabs');
  if(tabsEl) tabsEl.innerHTML=tabs.map(([k,lbl,n])=>`<button class="fb ${estoqueFiltro===k?'on':''}" onclick="filtEstoque('${k}')">${lbl}${n?` <span style="opacity:.7">${n}</span>`:''}</button>`).join('');

  // ── Lista filtrada + ordenada ──
  let lista = estoqueFiltro==='inativos' ? inativos.slice()
    : estoqueFiltro==='comprar' ? enc.map(x=>x.p)
    : estoqueFiltro==='repor' ? repor.slice()
    : estoqueFiltro==='parados' ? parados.slice()
    : estoqueFiltro==='validade' ? vencendo.slice()
    : estoqueFiltro==='semcusto' ? semCusto.slice()
    : todos.slice();
  if(estoqueBusca) lista=lista.filter(p=>(p.nome||'').toLowerCase().includes(estoqueBusca)||(p.codigo||'').toLowerCase().includes(estoqueBusca));
  if(estoqueCategoria) lista=lista.filter(p=>(p.categoria||'')===estoqueCategoria);
  const sort=document.getElementById('estoque-sort')?.value||'nome';
  lista.sort((a,b)=>{
    if(sort==='valor') return (Math.max(0,fisicaProduto(b.id))*(parseFloat(b.custo)||0))-(Math.max(0,fisicaProduto(a.id))*(parseFloat(a.custo)||0));
    if(sort==='disp') return disponivelProduto(a.id)-disponivelProduto(b.id);
    if(sort==='giro') return giroProduto(b.id,90)-giroProduto(a.id,90);
    return (a.nome||'').localeCompare(b.nome||'');
  });

  if(!lista.length){
    body.innerHTML=`<div class="empty-st"><div class="ei">📦</div><p>${estoqueBusca?'Nenhum produto encontrado.':estoqueFiltro==='todos'?'Nenhum produto cadastrado ainda.':'Nada neste filtro. 🎉'}</p>${estoqueFiltro==='todos'?'<button class="btn-primary" style="margin-top:12px" onclick="abrirProdutoModal()">＋ Cadastrar produto</button>':''}</div>`;
  } else {
    const ehInativo=estoqueFiltro==='inativos';
    let h=`<div class="est-list">`;
    lista.forEach(p=>{
      const fis=fisicaProduto(p.id), res=reservadoProduto(p.id), disp=disponivelProduto(p.id);
      const min=parseFloat(p.estoque_minimo)||0;
      const preco=parseFloat(p.preco_venda)||0, custo=parseFloat(p.custo)||0;
      const encomenda=disp<0;
      const baixo=!encomenda && min>0 && disp<=min;
      const forn=todosFornecedores.find(f=>f.id===p.fornecedor_id);
      const pp=pontoDePedido(p.id);
      const precisaRepor=!encomenda && pp>0 && disp<=pp;

      // Ponto colorido + badge status
      let dotCor='#22c55e', badge='';
      if(!ehInativo){
        if(encomenda){         dotCor='#ef4444'; badge=`<span class="est-badge" style="background:#fee2e2;color:#b91c1c">📥 Pedir</span>`; }
        else if(baixo){        dotCor='#f59e0b'; badge=`<span class="est-badge" style="background:#fef3c7;color:#92400e">⚠️ Baixo</span>`; }
        else if(precisaRepor){ dotCor='#eab308'; badge=`<span class="est-badge" style="background:#fef9c3;color:#713f12">🔄 Repor</span>`; }
        else if(produtoParado(p.id)){ dotCor='#94a3b8'; badge=`<span class="est-badge" style="background:#f1f5f9;color:#475569">💤 Parado</span>`; }
        else { badge=`<span class="est-badge" style="background:#dcfce7;color:#15803d">✅ OK</span>`; }
      }

      // Meta: código, fornecedor, badge
      const categBadge=p.categoria?`<span style="background:#e0f2fe;color:#0369a1;padding:1px 7px;border-radius:50px;font-size:10px;font-weight:700;white-space:nowrap">${esc(p.categoria)}</span>`:'';
      const valInfo=_validadeInfo(p.validade);
      const validadeBadge=valInfo?`<span class="est-badge" style="background:${valInfo.bg};color:${valInfo.cor}"${p.lote?` title="Lote: ${esc(p.lote)}"`:''}>${valInfo.txt}${p.lote?' · '+esc(p.lote):''}</span>`:'';
      const metaParts=[
        p.codigo?`<span>Cód: ${esc(p.codigo)}</span>`:'',
        forn?`<span>🏭 ${esc(forn.nome)}</span>`:'',
        categBadge,
        badge,
        validadeBadge,
      ].filter(Boolean).join('');

      // Insight de valores
      const capitalEstoque=Math.max(0,fis)*custo;
      const priceParts=[];
      if(preco>0) priceParts.push(`Venda: <strong>${brl(preco)}</strong>`);
      if(custo>0) priceParts.push(`Custo: <strong>${brl(custo)}</strong>`);
      if(capitalEstoque>0) priceParts.push(`Capital: <strong>${brl(capitalEstoque)}</strong>`);
      // Sem custo com saldo em mãos: este produto entra como R$ 0 no "Valor em
      // estoque", puxando o número para baixo sem ninguém perceber.
      if(!(custo>0)) priceParts.push(`<span style="color:var(--yellow);font-weight:700" title="Sem custo cadastrado — não entra no valor de estoque nem permite calcular margem">⚠️ sem custo</span>`);
      const pricesHtml=priceParts.length?`<div class="est-prices">${priceParts.join(' · ')}</div>`:'';

      // Por loja — sempre visível para lojas do grupo Forthemp
      let porLoja='';
      if(GRUPO_FORTHEMP&&GRUPO_FORTHEMP.length>1&&(!lojaAtiva||GRUPO_FORTHEMP.includes(lojaAtiva))){
        const spl=_saldoPorLoja(p.id);
        porLoja=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`+LOJAS.filter(l=>GRUPO_FORTHEMP.includes(l.id)).map(l=>{
          const s=spl[l.id]||{fisico:0,reservado:0}; const d=s.fisico-s.reservado;
          const isAtiva=l.id===lojaAtiva;
          return `<span class="loja-badge ${l.cor}" style="font-size:10px${isAtiva?';outline:2px solid currentColor;outline-offset:1px':''}">${esc(l.nome)}: <strong style="color:${d<0?'#b91c1c':d===0?'var(--gray)':'inherit'}">${fmtQtd(d)}</strong></span>`;
        }).join('')+`</div>`;
      }

      // Qtd
      const qtdCor=encomenda?'#ef4444':baixo?'#d97706':'var(--c2)';
      const detQtd=res>0?`<div class="est-qty-d">Fís:${fmtQtd(fis)} Res:${fmtQtd(res)}</div>`:'';

      // Botões — todos visíveis, sem menu ⋮
      const btns=ehInativo
        ? `<div class="est-acts-row"><button class="eb ein" onclick="reativarProduto('${p.id}')">↺ Reativar</button></div>`
        : `<div class="est-acts-row">
             <button class="eb ein" onclick="abrirMovModal('${p.id}','entrada')" title="Registrar entrada de mercadoria">＋ Entrada</button>
             <button class="eb eout" onclick="abrirMovModal('${p.id}','saida')" title="Registrar saída">− Saída</button>
           </div>
           <div class="est-acts-row">
             <button class="eb eico edit" onclick="abrirProdutoModal('${p.id}')" title="Editar produto">✏️ Editar</button>
             <button class="eb eico fix" onclick="abrirMovModal('${p.id}','ajuste')" title="Corrigir saldo / Inventário">⚖️ Corrigir</button>
             <button class="eb eico fix" onclick="abrirResvModal('${p.id}')" title="Conferir/corrigir a quantidade reservada em orçamentos"${res<-0.001?' style="border-color:var(--red);color:var(--red)"':''}>🔒 Reserva</button>
             ${LOJAS.length>1?`<button class="eb eico trf" onclick="abrirTransfModal('${p.id}')" title="Transferir para outra unidade">🔄 Transf.</button>`:''}
             <button class="eb ehist" onclick="abrirHistProduto('${p.id}')" title="Ver histórico de movimentos">📜</button>
           </div>`;

      h+=`<div class="est-item"${ehInativo?' style="opacity:.5"':''}>
        <div class="est-dot" style="background:${dotCor}"></div>
        <div class="est-main">
          <div class="est-nome">${esc(p.nome)}</div>
          <div class="est-meta">${metaParts}</div>
          ${pricesHtml}${porLoja}
        </div>
        <div class="est-qty-col">
          <div class="est-qty-n" style="color:${qtdCor}">${fmtQtd(disp)}</div>
          <div class="est-qty-u">${esc(p.unidade||'un')}</div>
          ${detQtd}
        </div>
        <div class="est-acts">${btns}</div>
      </div>`;
    });
    h+=`</div>`;
    body.innerHTML=h;
  }

  // ── Alerta resumido (inconsistências + encomendas + repor) ──
  const al=document.getElementById('estoque-alerta');
  if(al){
    let aviso='';
    // Saldo NEGATIVO vem primeiro: é inconsistência, não operação. Saiu mais do
    // que entrou — algo foi lançado errado. Em qualquer modelo (estoque próprio
    // ou venda sob encomenda) isso é erro. Ficava invisível porque só aparecia
    // para quem fosse procurar produto a produto: 3 casos passaram meses assim.
    const negativos=_estoqueNegativos();
    if(negativos.length){
      aviso+=`<div style="color:#991b1b;background:#fee2e2;border-radius:8px;padding:8px 10px;margin-bottom:8px">
        <strong>⚠️ ${negativos.length} saldo(s) negativo(s)</strong> — saiu mais do que entrou, algum lançamento está errado:
        ${negativos.slice(0,4).map(x=>`<button class="tb" style="font-size:11px;padding:3px 8px;margin:4px 4px 0 0${x.inativo?';opacity:.7':''}" onclick="abrirMovModal('${x.p.id}','ajuste')" title="${x.inativo?'Produto inativado, mas o saldo negativo continua no ledger. ':''}Corrigir pelo inventário">${esc(x.p.nome)} (${fmtQtd(x.saldo)}${x.lojaNome?' · '+esc(x.lojaNome):''})${x.inativo?' 🚫':''}</button>`).join('')}
        ${negativos.length>4?`<span style="font-size:11px"> +${negativos.length-4} outro(s)</span>`:''}</div>`;
    }
    if(enc.length) aviso+=`<div style="color:#b91c1c"><strong>📥 ${enc.length} para comprar:</strong> `+enc.slice(0,5).map(x=>`${esc(x.p.nome)} (faltam ${fmtQtd(x.falta)})`).join(' · ')+(enc.length>5?' …':'')+`</div>`;
    if(repor.length) aviso+=`<div style="margin-top:${enc.length?'6px':'0'}"><strong>🔄 ${repor.length} para repor:</strong> `+repor.slice(0,5).map(p=>`${esc(p.nome)} (${fmtQtd(disponivelProduto(p.id))})`).join(' · ')+(repor.length>5?' …':'')+`</div>`;
    al.style.display=aviso?'':'none'; al.innerHTML=aviso;
  }
  renderInsightsEstoque(abc, parados);
  renderGiroEstoque();
  renderMovEstoque();
}
function fmtQtd(n){ const v=parseFloat(n)||0; return Number.isInteger(v)?String(v):v.toFixed(2).replace('.',','); }

// Giro: produtos que mais SAÍRAM nos últimos 90 dias (curva ABC simplificada)
function renderGiroEstoque(){
  const card=document.getElementById('estoque-giro-card');
  const body=document.getElementById('estoque-giro-body');
  if(!card||!body) return;
  const lim=Date.now()-90*24*3600*1000;
  const saidas={};
  filtrarPorLoja(todosMovEstoque).forEach(m=>{
    if(m.tipo!=='saida') return;
    if(new Date(m.data).getTime()<lim) return;
    saidas[m.produto_id]=(saidas[m.produto_id]||0)+Math.abs(parseFloat(m.quantidade)||0);
  });
  const rank=Object.entries(saidas).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!rank.length){ card.style.display='none'; return; }
  card.style.display='';
  const max=rank[0][1]||1;
  body.innerHTML=rank.map(([pid,q])=>{
    const p=produtoById(pid);
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--c2);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p?p.nome:'(produto removido)')}</div>
        <div style="height:6px;background:var(--gray-light);border-radius:50px;overflow:hidden"><div style="height:100%;background:var(--c1);border-radius:50px;width:${Math.round(q/max*100)}%"></div></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--c2);min-width:48px;text-align:right">${fmtQtd(q)} ${esc(p?.unidade||'')}</div>
    </div>`;
  }).join('');
}

// Produtos inativos visíveis na loja
function produtosVisiveisInativos(){
  const inativos=todosProdutos.filter(p=>p.ativo===false);
  if(!lojaAtiva) return filtrarPorLoja(inativos);
  const comMov=new Set(todosMovEstoque.filter(m=>(m.loja_id||'')===lojaAtiva).map(m=>m.produto_id));
  return inativos.filter(p=>(p.loja_id||'')===lojaAtiva || comMov.has(p.id));
}

// Insights: curva ABC, previsão de ruptura e capital parado
function _metricsLoja(lojaId){
  const ativos=(todosProdutos||[]).filter(p=>p.ativo!==false);
  // Forthemp: catálogo compartilhado entre as lojas do grupo
  const ehGrupo=GRUPO_FORTHEMP&&GRUPO_FORTHEMP.includes(lojaId);
  const prods=ehGrupo
    ? ativos.filter(p=>GRUPO_FORTHEMP.includes(p.loja_id||''))
    : ativos.filter(p=>(p.loja_id||'')===lojaId);
  const movs=(todosMovEstoque||[]).filter(m=>(m.loja_id||'')===lojaId);
  const lim90=Date.now()-90*86400000;
  let encomendar=0,repor=0,parad=0,valorTotal=0;
  prods.forEach(p=>{
    const mvProd=movs.filter(m=>m.produto_id===p.id);
    const fis=mvProd.reduce((a,m)=>a+parseFloat(m.quantidade||0),0);
    const disp=fis; // simplificado (sem reservas neste resumo)
    const min=parseFloat(p.estoque_minimo)||0;
    valorTotal+=Math.max(0,fis)*(parseFloat(p.custo)||0);
    if(disp<0) encomendar++;
    else if(min>0&&disp<=min) repor++;
    const saidas90=mvProd.filter(m=>m.tipo==='saida'&&new Date(m.data).getTime()>=lim90).length;
    const prim=mvProd.length?Math.min(...mvProd.map(m=>new Date(m.data).getTime())):Infinity;
    if(fis>0&&saidas90===0&&prim<lim90) parad++;
  });
  return {count:prods.length,valor:valorTotal,encomendar,repor,parad};
}

function renderInsightsEstoque(abc, parados){
  const el=document.getElementById('estoque-insights'); if(!el) return;
  const prods=produtosVisiveis();
  const cnt={A:0,B:0,C:0}; prods.forEach(p=>{ cnt[abc.classe[p.id]||'C']++; });
  const ruptura=prods.filter(p=>{ const d=diasParaRuptura(p.id); return d!==Infinity && d<=14; })
    .map(p=>({p,d:diasParaRuptura(p.id)})).sort((a,b)=>a.d-b.d).slice(0,6);
  let h='';

  // ── Comparativo entre lojas (só quando gestor vê todas as lojas) ──
  if(isMainGestor()&&!lojaAtiva&&GRUPO_FORTHEMP&&GRUPO_FORTHEMP.length>1){
    const lojasGrupo=LOJAS.filter(l=>GRUPO_FORTHEMP.includes(l.id));
    if(lojasGrupo.length>1){
      const dados=lojasGrupo.map(l=>({l,m:_metricsLoja(l.id)}));
      const row=(label,vals,fn)=>`<tr><td style="font-size:12px;color:var(--gray);padding:6px 0 6px 0;border-bottom:1px solid var(--gray-light);white-space:nowrap">${label}</td>${vals.map(({l,m})=>`<td style="text-align:right;font-size:13px;font-weight:600;padding:6px 0 6px 12px;border-bottom:1px solid var(--gray-light)">${fn(m,l)}</td>`).join('')}</tr>`;
      h+=`<div class="card" style="border:2px solid var(--c1-light)">
        <div class="ct">🏪 Comparativo entre lojas</div>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:11px;color:var(--gray);font-weight:600;padding-bottom:8px;border-bottom:2px solid var(--c1-light)">Indicador</th>
            ${dados.map(({l})=>`<th style="text-align:right;font-size:12px;font-weight:700;color:var(--c1);padding-bottom:8px;border-bottom:2px solid var(--c1-light);padding-left:12px">${esc(l.nome)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${row('Produtos ativos',dados,m=>m.count)}
            ${row('Capital em estoque',dados,m=>brl(m.valor))}
            ${row('📥 Precisam ser comprados',dados,m=>m.encomendar>0?`<span style="color:var(--red);font-weight:700">${m.encomendar}</span>`:'<span style="color:var(--green)">0</span>')}
            ${row('🔄 Abaixo do mínimo',dados,m=>m.repor>0?`<span style="color:#92400e;font-weight:700">${m.repor}</span>`:'<span style="color:var(--green)">0</span>')}
            ${row('💤 Sem giro (90d)',dados,m=>m.parad>0?`<span style="color:#1d4ed8">${m.parad}</span>`:'<span style="color:var(--green)">0</span>')}
          </tbody>
        </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${dados.map(({l})=>`<button onclick="trocarLojaAtiva('${l.id}')" class="btn-sec" style="font-size:12px;padding:6px 14px;flex:1">Ver estoque: ${esc(l.nome)} →</button>`).join('')}
        </div>
      </div>`;
    }
  }
  h+=`<div class="card"><div class="ct">📈 Curva ABC (por consumo)</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[['A','#16a34a','vital — não deixe faltar'],['B','#d97706','intermediário'],['C','#6b7280','baixo giro']].map(([c,cor,desc])=>`<div style="flex:1;min-width:130px;border:1.5px solid ${cor}55;border-radius:10px;padding:10px 12px"><div style="font-size:13px;font-weight:800;color:${cor}">Classe ${c}<span style="float:right">${cnt[c]}</span></div><div style="font-size:11px;color:var(--gray);margin-top:2px">${desc}</div></div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--gray);margin-top:8px">A classe A concentra ~80% do consumo — priorize compra e nunca deixe faltar.</div>
  </div>`;
  h+=_insightsPontoDePedido(prods);
  h+=_insightsMargem(prods);
  if(ruptura.length){
    h+=`<div class="card"><div class="ct">⏳ Vão acabar em breve</div>${ruptura.map(x=>{
      const d=x.d, dtxt=d<=0?'esgotado':Math.round(d)+' dias';
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(x.p.nome)}</div><div style="font-size:11px;color:var(--gray)">disp. ${fmtQtd(disponivelProduto(x.p.id))} · consumo ~${fmtQtd(Math.round(consumoDia(x.p.id)*30))}/mês</div></div><div style="font-size:12px;font-weight:700;color:${d<7?'var(--red)':'var(--yellow)'};white-space:nowrap;text-align:right">${dtxt}<br><button class="tb g" style="font-size:10px;margin-top:2px" onclick="abrirMovModal('${x.p.id}','entrada')">comprar</button></div></div>`;
    }).join('')}</div>`;
  }
  if(parados.length){
    const ord=parados.slice().sort((a,b)=>(Math.max(0,fisicaProduto(b.id))*(parseFloat(b.custo)||0))-(Math.max(0,fisicaProduto(a.id))*(parseFloat(a.custo)||0))).slice(0,6);
    h+=`<div class="card"><div class="ct">💤 Capital parado (sem giro 90d)</div>${ord.map(p=>{
      const ult=ultimaMovData(p.id); const dias=ult?Math.round((Date.now()-ult)/86400000):null;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p.nome)}</div><div style="font-size:11px;color:var(--gray)">${fmtQtd(fisicaProduto(p.id))} em estoque${dias!=null?' · última mov. há '+dias+'d':''}</div></div><div style="font-size:12px;font-weight:700;color:var(--c2);white-space:nowrap">${brl(Math.max(0,fisicaProduto(p.id))*(parseFloat(p.custo)||0))}</div></div>`;
    }).join('')}<div style="font-size:11px;color:var(--gray);padding-top:8px">Dinheiro parado — avalie promoção, uso interno ou não recomprar.</div></div>`;
  }
  el.innerHTML=h;
}

// Feed de movimentações recentes (toda a loja)
let _movFiltroTipo='todos';
let _movPagina=0;
const _MOV_POR_PAG=30;
function renderMovEstoque(){
  const card=document.getElementById('estoque-mov-card'), body=document.getElementById('estoque-mov-body');
  if(!card||!body) return;
  const tT={entrada:'＋ Entrada',saida:'− Saída',ajuste:'⚖ Ajuste',reserva:'🔒 Reserva',liberacao_reserva:'🔓 Libera',transf_entrada:'🔄 Transf.+',transf_saida:'🔄 Transf.−'};
  const tC={entrada:'var(--green)',saida:'#b45309',ajuste:'var(--gray)',reserva:'#7c3aed',liberacao_reserva:'#7c3aed',transf_entrada:'#0369a1',transf_saida:'#0369a1'};
  let todos=filtrarPorLoja(todosMovEstoque).slice().sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(_movFiltroTipo!=='todos') todos=todos.filter(m=>m.tipo===_movFiltroTipo);
  if(!todos.length){ card.style.display='none'; return; }
  card.style.display='';
  const inicio=_movPagina*_MOV_POR_PAG;
  const pagina=todos.slice(inicio, inicio+_MOV_POR_PAG);
  const temAntes=inicio>0, temDepois=inicio+_MOV_POR_PAG<todos.length;
  // Filtro de tipo
  const filtros=[['todos','Todos'],['entrada','＋ Entradas'],['saida','− Saídas'],['ajuste','⚖ Ajustes']];
  const filtrosHTML=filtros.map(([k,l])=>`<button onclick="_movFiltroTipo='${k}';_movPagina=0;renderMovEstoque()" style="font-size:11px;padding:3px 8px;border-radius:50px;border:1px solid ${_movFiltroTipo===k?'var(--c1)':'var(--gray-light)'};background:${_movFiltroTipo===k?'var(--c1)':'transparent'};color:${_movFiltroTipo===k?'white':'var(--gray)'};cursor:pointer">${l}</button>`).join('');
  const navHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:12px;color:var(--gray)"><span>${inicio+1}–${Math.min(inicio+_MOV_POR_PAG,todos.length)} de ${todos.length}</span><div style="display:flex;gap:6px">${temAntes?`<button onclick="_movPagina--;renderMovEstoque()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">←</button>`:''} ${temDepois?`<button onclick="_movPagina++;renderMovEstoque()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">→</button>`:''}</div></div>`;
  body.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--gray-light);margin-bottom:4px">${filtrosHTML}</div>`
    +pagina.map(m=>{
      const p=produtoById(m.produto_id), d=new Date(m.data), q=parseFloat(m.quantidade)||0;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:12.5px;font-weight:600;color:${tC[m.tipo]||'var(--c2)'}">${tT[m.tipo]||m.tipo} ${fmtQtd(q)} · ${esc(p?p.nome:'—')}</div><div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.motivo||'')}${m.usuario?' · '+esc(m.usuario):''}</div></div><div style="font-size:11px;color:var(--gray);white-space:nowrap;text-align:right">${d.toLocaleDateString('pt-BR')}<br>${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    }).join('')+navHTML;
}

// Ativar/desativar produto
function _setProdutoAtivo(id, ativo){
  const i=todosProdutos.findIndex(p=>p.id===id); if(i<0) return;
  todosProdutos[i]={...todosProdutos[i],ativo};
  lsProdSalvar(todosProdutos);
  if(dbOk&&db){ (async()=>{ try{ const r=await _comTimeout(dbUpsert('produtos',todosProdutos[i]),20000,'prodAtivo'); if(r&&r.error) console.warn('[prodAtivo]',r.error.message); }catch(e){ console.warn('[prodAtivo bg]',e?.message||e); } })(); }
  renderEstoque();
}
function reativarProduto(id){ _setProdutoAtivo(id,true); toast('↺ Produto reativado'); }
function desativarProduto(id){ confirmar('Desativar este produto? Some da lista ativa (o histórico é mantido e pode reativar depois).', ()=>{ _setProdutoAtivo(id,false); fecharProdutoModal(); toast('🚫 Produto desativado'); }, 'Desativar produto'); }

// ── Lista de compras consolidada ──
function _calcListaCompras(){
  const itens=[];
  produtosVisiveis().forEach(p=>{
    const disp=disponivelProduto(p.id), min=parseFloat(p.estoque_minimo)||0;
    const lote=parseFloat(p.lote_minimo)||1;
    if(disp<0){
      const base=Math.ceil(-disp); const qtd=Math.ceil(base/lote)*lote;
      itens.push({p, qtd, motivo:'encomenda'});
    } else if(min>0 && disp<=min){
      const base=Math.max(1,Math.ceil(min*2-disp)); const qtd=Math.ceil(base/lote)*lote;
      itens.push({p, qtd, motivo:'repor'});
    } else {
      // verificar ponto de pedido
      const pp=pontoDePedido(p.id);
      if(pp>0 && disp<=pp){
        const base=Math.max(1,Math.ceil(pp*2-disp)); const qtd=Math.ceil(base/lote)*lote;
        itens.push({p, qtd, motivo:'ponto de pedido'});
      }
    }
  });
  return itens.sort((a,b)=>{
    const ordem={encomenda:0,'ponto de pedido':1,repor:2};
    return (ordem[a.motivo]??3)-(ordem[b.motivo]??3);
  });
}
function abrirListaCompras(){
  const itens=_calcListaCompras();
  const body=document.getElementById('compras-body');
  if(!itens.length){ body.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nada para comprar agora. 🎉</div>'; document.getElementById('compras-modal').style.display='flex'; return; }
  // Agrupar por fornecedor
  const grupos={};
  itens.forEach(x=>{
    const fid=x.p.fornecedor_id||'__sem_fornecedor__';
    if(!grupos[fid]) grupos[fid]=[];
    grupos[fid].push(x);
  });
  let html='', totalGeral=0;
  Object.entries(grupos).forEach(([fid,grp])=>{
    const forn=todosFornecedores.find(f=>f.id===fid);
    const nomeGrupo=forn?forn.nome:'Sem fornecedor definido';
    const totalGrupo=grp.reduce((a,x)=>a+(parseFloat(x.p.custo)||0)*x.qtd,0);
    totalGeral+=totalGrupo;
    const wpp=forn?.whatsapp?`<button onclick="enviarListaComprasWhatsApp('${fid}')" style="font-size:11px;background:var(--green);color:white;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:'Inter',sans-serif">📲 WhatsApp</button>`:'';
    const ocBtn=`<button onclick="criarOCDoGrupo('${fid}')" style="font-size:11px;background:var(--c1);color:white;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:'Inter',sans-serif">📄 Criar OC</button>`;
    html+=`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px"><div style="font-size:12px;font-weight:700;color:var(--c1)">${esc(nomeGrupo)}</div><div style="display:flex;gap:6px">${wpp}${ocBtn}</div></div>`;
    grp.forEach(x=>{ const custo=(parseFloat(x.p.custo)||0)*x.qtd;
      html+=`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--gray-light)"><div style="min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--c2)">${esc(x.p.nome)} <span style="font-size:10px;background:${x.motivo==='encomenda'?'var(--red-bg)':'var(--yellow-bg)'};color:${x.motivo==='encomenda'?'var(--red)':'var(--yellow)'};padding:1px 5px;border-radius:50px;font-weight:700">${x.motivo}</span></div><div style="font-size:11px;color:var(--gray)">${esc(x.p.codigo||'')}</div></div><div style="text-align:right;white-space:nowrap"><div style="font-size:13px;font-weight:700;color:var(--c2)">${fmtQtd(x.qtd)} ${esc(x.p.unidade||'')}</div><div style="font-size:11px;color:var(--gray)">~${brl(custo)}</div></div></div>`;
    });
    html+=`<div style="text-align:right;font-size:12px;color:var(--gray);padding-top:4px">Subtotal: ${brl(totalGrupo)}</div></div>`;
  });
  html+=`<div style="text-align:right;font-size:13px;font-weight:800;color:var(--c2);padding-top:8px;border-top:2px solid var(--gray-light)">Total geral estimado: ${brl(totalGeral)}</div>`;
  body.innerHTML=html;
  document.getElementById('compras-modal').style.display='flex';
}
function fecharListaCompras(){ document.getElementById('compras-modal').style.display='none'; }
function copiarListaCompras(){
  const itens=_calcListaCompras();
  if(!itens.length){ toast('Nada para comprar'); return; }
  const LC=getLojaConfig(lojaAtiva);
  let txt='🛒 *Lista de compras* — '+(LC.nome||'Estoque')+'\n'+new Date().toLocaleDateString('pt-BR')+'\n\n';
  txt+=itens.map(x=>`• ${x.p.nome}: ${fmtQtd(x.qtd)} ${x.p.unidade||''}${x.motivo==='encomenda'?' (encomenda)':''}`).join('\n');
  const total=itens.reduce((a,x)=>a+(parseFloat(x.p.custo)||0)*x.qtd,0);
  txt+=`\n\n💰 Total estimado: ${brl(total)}`;
  navigator.clipboard.writeText(txt).then(()=>toast('📋 Lista copiada!')).catch(()=>toast('📋 Copiado'));
}

// ══════════════════════════════════════════
//  IMPORTADOR DE PRODUTOS (planilha Excel/CSV)
// ══════════════════════════════════════════
let _impLinhas=[], _impCabecalho=[];

// Mapa de detecção automática de colunas
const _IMP_MAP={
  nome:   ['descri','nome','produto','product','item','name'],
  codigo: ['codigo','cód','cod ','cod.','sku','ref','code'],
  gtin_ean:['ean','gtin','barras','barra','bar code'],
  ncm:    ['ncm'],
  preco_venda:['preco venda','preço venda','venda','unitario','unit','price','valor vend'],
  custo:  ['custo','cost','compra','entrada'],
  unidade:['unidade','unit','un'],
};

function _impDetectarCol(header){
  const h=(header||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  for(const [campo, pads] of Object.entries(_IMP_MAP)){
    if(pads.some(p=>h.includes(p))) return campo;
  }
  return '';
}

async function _loadSheetJS(){
  if(window.XLSX) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=res; s.onerror=()=>rej(new Error('Falha ao carregar biblioteca Excel'));
    document.head.appendChild(s);
  });
}

function abrirImportProdutos(){
  _impLinhas=[]; _impCabecalho=[];
  document.getElementById('imp-step-upload').style.display='';
  document.getElementById('imp-step-map').style.display='none';
  document.getElementById('imp-step-result').style.display='none';
  document.getElementById('imp-file-input').value='';
  document.getElementById('import-prod-modal').style.display='flex';
}
function fecharImportProdutos(){
  document.getElementById('import-prod-modal').style.display='none';
}

function _impDrop(ev){
  ev.preventDefault();
  document.getElementById('imp-drop-zone').style.borderColor='var(--gray-mid)';
  const f=ev.dataTransfer.files[0]; if(f) _impProcessarArquivo(f);
}
function _impArquivoSelecionado(inp){
  const f=inp.files[0]; if(f) _impProcessarArquivo(f);
}

async function _impProcessarArquivo(file){
  const zone=document.getElementById('imp-drop-zone');
  zone.innerHTML='<span style="font-size:24px">⏳</span><span style="font-size:13px;color:var(--gray)">Lendo arquivo…</span>';
  try{
    await _loadSheetJS();
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(!rows.length) throw new Error('Planilha vazia');
    // Primeira linha não vazia = cabeçalho
    let hiCab=0;
    while(hiCab<rows.length && rows[hiCab].every(c=>!String(c).trim())) hiCab++;
    _impCabecalho=rows[hiCab].map(c=>String(c).trim());
    _impLinhas=rows.slice(hiCab+1).filter(r=>r.some(c=>String(c).trim()));
    _impMostrarMapa();
  }catch(e){
    zone.innerHTML=`<span style="font-size:24px">❌</span><span style="font-size:13px;color:var(--red)">${esc(e.message||'Erro ao ler arquivo')}</span><label style="margin-top:8px;cursor:pointer;font-size:12px;color:var(--c1)">Tentar novamente<input type="file" accept=".xlsx,.csv,.xls" style="display:none" onchange="_impArquivoSelecionado(this)"></label>`;
  }
}

function _impMostrarMapa(){
  document.getElementById('imp-step-upload').style.display='none';
  document.getElementById('imp-step-map').style.display='';

  // Campos do sistema que o usuário pode mapear
  const campos=[
    {k:'nome',      lbl:'Nome do produto',      req:true},
    {k:'codigo',    lbl:'Código / SKU',          req:false},
    {k:'gtin_ean',  lbl:'Código EAN / GTIN',     req:false},
    {k:'ncm',       lbl:'Código NCM',            req:false},
    {k:'preco_venda',lbl:'Preço de venda (R$)',  req:false},
    {k:'custo',     lbl:'Custo (R$)',            req:false},
    {k:'unidade',   lbl:'Unidade (un, kg, L…)',  req:false},
  ];

  const optsBase='<option value="">— não usar —</option>'+_impCabecalho.map((c,i)=>`<option value="${i}">${esc(c)}</option>`).join('');
  let html='';
  campos.forEach(({k,lbl,req})=>{
    const auto=_impCabecalho.findIndex(c=>_impDetectarCol(c)===k);
    html+=`<div><label style="font-size:11px;font-weight:700;color:var(--gray);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">${esc(lbl)}${req?' <span style="color:var(--red)">*</span>':''}</label>
      <select id="imp-col-${k}" style="width:100%;padding:8px 10px;border:1.5px solid var(--gray-mid);border-radius:8px;font-size:13px;font-family:inherit">
        ${optsBase.replace(`value="${auto}"`,`value="${auto}" selected`)}
      </select></div>`;
  });
  document.getElementById('imp-map-fields').innerHTML=html;

  // Preview
  const thead='<thead><tr style="background:var(--gray-light)">'+_impCabecalho.map(c=>`<th style="padding:6px 10px;text-align:left;font-size:11px;white-space:nowrap">${esc(c)}</th>`).join('')+'</tr></thead>';
  const tbody='<tbody>'+_impLinhas.slice(0,5).map(r=>'<tr>'+_impCabecalho.map((_,i)=>`<td style="padding:5px 10px;border-top:1px solid var(--gray-light);font-size:12px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(String(r[i]||''))}</td>`).join('')+'</tr>').join('')+'</tbody>';
  document.getElementById('imp-preview-table').innerHTML=thead+tbody;
  document.getElementById('imp-btn-confirmar').textContent=`📥 Importar ${_impLinhas.length} produto${_impLinhas.length!==1?'s':''}`;
}

function _impValorNum(v){ return parseFloat(String(v||'').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }
function _impNorm(v){ return String(v||'').trim(); }

async function _impConfirmar(){
  const getCol=k=>{ const s=document.getElementById('imp-col-'+k); return s&&s.value!==''?parseInt(s.value):-1; };
  const iNome=getCol('nome');
  if(iNome<0){ toast('⚠️ Selecione a coluna do nome do produto'); return; }

  const btn=document.getElementById('imp-btn-confirmar');
  btn.disabled=true; btn.textContent='Importando…';

  const s=getSessao();
  let ok=0, skip=0, erros=[];
  const lojaId=s?.loja_id||lojaAtiva||LOJA_PADRAO_ID;

  for(const row of _impLinhas){
    const nome=_impNorm(row[iNome]);
    if(!nome){ skip++; continue; }

    const iCod=getCol('codigo'), iGtin=getCol('gtin_ean'), iNcm=getCol('ncm');
    const iPreco=getCol('preco_venda'), iCusto=getCol('custo'), iUn=getCol('unidade');

    const id='prod_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    const rec={
      id, nome,
      loja_id: lojaId,
      codigo:  iCod>=0  ? _impNorm(row[iCod])   : '',
      gtin_ean:iGtin>=0 ? _impNorm(row[iGtin])  : '',
      ncm:     iNcm>=0  ? _impNorm(row[iNcm])   : '',
      preco_venda: iPreco>=0 ? _impValorNum(row[iPreco]) : 0,
      custo:   iCusto>=0 ? _impValorNum(row[iCusto]) : 0,
      unidade: iUn>=0   ? (_impNorm(row[iUn])||'un') : 'un',
      estoque_minimo:0, ativo:true,
      data_criacao: new Date().toISOString()
    };

    // Checa duplicata por nome (mesmo nome + mesma loja)
    const existe=todosProdutos.find(p=>(p.nome||'').toLowerCase()===nome.toLowerCase()&&(p.loja_id||'')===(lojaId||''));
    if(existe){ skip++; continue; }

    todosProdutos.unshift(rec);
    lsProdSalvar(todosProdutos);
    try{
      await dbUpsert('produtos',rec);
      ok++;
    }catch(e){
      erros.push(nome);
      console.warn('[imp-prod]',e?.message||e);
    }
  }

  // Resultado
  document.getElementById('imp-step-map').style.display='none';
  document.getElementById('imp-step-result').style.display='';
  document.getElementById('imp-result-icon').textContent= erros.length?'⚠️':'✅';
  document.getElementById('imp-result-text').textContent= `${ok} produto${ok!==1?'s':''} importado${ok!==1?'s':''}`;
  document.getElementById('imp-result-sub').innerHTML=
    (skip?`<span style="color:var(--gray)">${skip} ignorado${skip!==1?'s':''} (duplicata ou sem nome)</span><br>`:'') +
    (erros.length?`<span style="color:var(--red)">${erros.length} com erro de sync: ${erros.slice(0,3).map(n=>esc(n)).join(', ')}${erros.length>3?'…':''}</span>`:'');

  logAcao('estoque_mov',`Importação em lote: ${ok} produtos adicionados`);
  renderEstoque();
}

// ── Modal de cadastro/edição de produto ──
let _prodEditId=null;
function abrirProdutoModal(id){
  _prodEditId=id||null;
  _prodConfirmouSemCusto=false; // cada produto pede a confirmação de novo
  const p=id?produtoById(id):null;
  const cat=p?.categoria||'';
  setV('prod-categoria', cat);
  const catOutraWrap=document.getElementById('prod-catoutra-wrap');
  if(catOutraWrap) catOutraWrap.style.display=(cat==='Outro')?'':'none';
  setV('prod-catoutra', cat==='Outro'?'':'');
  setV('prod-nome',p?.nome||''); setV('prod-codigo',p?.codigo||'');
  setV('prod-unidade',p?.unidade||'un'); setV('prod-preco',p?.preco_venda?String(p.preco_venda):'');
  setV('prod-custo',p?.custo?String(p.custo):''); setV('prod-min',p?.estoque_minimo?String(p.estoque_minimo):'');
  setV('prod-leadtime',p?.lead_time_dias?String(p.lead_time_dias):''); setV('prod-seguranca',p?.estoque_seguranca?String(p.estoque_seguranca):'');
  setV('prod-lote',p?.lote_minimo?String(p.lote_minimo):'');
  setV('prod-lote-cod',p?.lote||''); setV('prod-validade',p?.validade||'');
  setV('prod-ncm',p?.ncm||''); setV('prod-cest',p?.cest||''); setV('prod-cfop',p?.cfop_padrao||'');
  setV('prod-origem',p?.origem||''); setV('prod-gtin',p?.gtin_ean||'');
  // Preencher select de fornecedor
  const selForn=document.getElementById('prod-fornecedor');
  if(selForn){ selForn.innerHTML='<option value="">— nenhum —</option>'+todosFornecedores.filter(f=>f.ativo!==false).map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join(''); selForn.value=p?.fornecedor_id||''; }
  const inicialWrap=document.getElementById('prod-inicial-wrap');
  if(inicialWrap) inicialWrap.style.display=id?'none':''; // saldo inicial só ao criar
  setV('prod-inicial','');
  document.getElementById('prod-modal-titulo').textContent=id?'Editar produto':'Novo produto';
  const desBtn=document.getElementById('prod-desativar-btn'); if(desBtn) desBtn.style.display=id?'block':'none';
  // ── Indicador / seletor de unidade ──
  const wrap=document.getElementById('prod-loja-wrap');
  if(wrap){
    const s=getSessao();
    const lojaFixa=p?.loja_id||s?.loja_id||lojaAtiva||'';
    if(lojaFixa){
      // Loja já definida (gestor com loja própria, master em loja específica, ou produto existente)
      const loja=getLoja(lojaFixa);
      const rotulo=id?'Unidade deste produto:':'Será cadastrado em:';
      wrap.innerHTML=`<div style="display:flex;align-items:center;gap:8px;background:var(--gray-light);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--gray)">🏪 ${rotulo} ${getLojaBadge(lojaFixa)}</div>`;
    } else {
      // Master no painel geral → precisa escolher a unidade
      const opcs=LOJAS.filter(l=>GRUPO_FORTHEMP.includes(l.id)).map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('');
      wrap.innerHTML=`<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:700;color:var(--c1);text-transform:uppercase;letter-spacing:.5px">🏪 Em qual unidade cadastrar?</label><select id="prod-loja-select" style="width:100%;margin-top:4px;padding:9px 12px;border:2px solid var(--c1);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;outline:none;color:var(--c2)">${opcs}</select></div>`;
    }
  }
  document.getElementById('prod-modal').style.display='flex';
}
function fecharProdutoModal(){ document.getElementById('prod-modal').style.display='none'; }
let _prodConfirmouSemCusto=false;
async function salvarProduto(){
  const nome=(gV('prod-nome')||'').trim();
  if(!nome){ toast('⚠️ Informe o nome do produto'); return; }
  const _cat=(gV('prod-categoria')==='Outro'?(gV('prod-catoutra')||'').trim():gV('prod-categoria')||'');
  if(!_cat){ toast('⚠️ Selecione a categoria do produto'); document.getElementById('prod-categoria')?.focus(); return; }
  // Custo em 0 é o dado que mais silenciosamente estraga margem: medido em
  // ago/2026, 6 dos 7 modelos de trocador Pooltec — o equipamento mais caro
  // da empresa — estavam com custo zero. Não trava de vez (às vezes o preço
  // de compra ainda não chegou), mas exige confirmar que é intencional.
  const _custoInformado=parseFloat((gV('prod-custo')||'').replace(',','.'))||0;
  if(_custoInformado<=0 && !_prodConfirmouSemCusto){
    confirmar(
      'Sem custo cadastrado, este produto não tem margem calculável em nenhum relatório — entra sempre como se desse 100% de lucro. Salvar assim mesmo?',
      ()=>{ _prodConfirmouSemCusto=true; salvarProduto(); },
      'Salvar sem custo?'
    );
    return;
  }
  _prodConfirmouSemCusto=false;
  const s=getSessao();
  const id=_prodEditId||'prod_'+Date.now();
  const existente=_prodEditId?produtoById(_prodEditId):null;
  const rec={
    id,
    loja_id: existente?.loja_id || s?.loja_id || document.getElementById('prod-loja-select')?.value || lojaAtiva || LOJA_PADRAO_ID,
    nome, codigo:(gV('prod-codigo')||'').trim(),
    unidade:gV('prod-unidade')||'un',
    preco_venda:parseFloat((gV('prod-preco')||'').replace(',','.'))||0,
    custo:parseFloat((gV('prod-custo')||'').replace(',','.'))||0,
    estoque_minimo:parseFloat((gV('prod-min')||'').replace(',','.'))||0,
    fornecedor_id:(gV('prod-fornecedor')||'')||null,
    lead_time_dias:parseFloat((gV('prod-leadtime')||'').replace(',','.'))||null,
    estoque_seguranca:parseFloat((gV('prod-seguranca')||'').replace(',','.'))||0,
    lote_minimo:parseFloat((gV('prod-lote')||'').replace(',','.'))||1,
    lote:(gV('prod-lote-cod')||'').trim()||null, validade:gV('prod-validade')||null,
    ncm:(gV('prod-ncm')||'').trim(), cest:(gV('prod-cest')||'').trim(),
    cfop_padrao:(gV('prod-cfop')||'').trim(), origem:(gV('prod-origem')||'').trim(),
    gtin_ean:(gV('prod-gtin')||'').trim(),
    categoria:_cat,
    ativo:true, data_criacao: existente?.data_criacao || new Date().toISOString()
  };
  const idx=todosProdutos.findIndex(x=>x.id===id);
  if(idx>=0) todosProdutos[idx]=rec; else todosProdutos.unshift(rec);
  lsProdSalvar(todosProdutos);
  if(dbOk&&db){ (async()=>{ try{ const r=await _comTimeout(dbUpsert('produtos',rec),20000,'produto'); if(r&&r.error) console.warn('[produto sync]',r.error.message); }catch(e){ console.warn('[produto sync bg]',e?.message||e); } })(); }
  // saldo inicial (só ao criar): vira um movimento de entrada
  if(!_prodEditId){
    const ini=parseFloat((gV('prod-inicial')||'').replace(',','.'))||0;
    if(ini!==0) registrarMovimento({produto_id:id, tipo:'entrada', quantidade:Math.abs(ini), custo_unit:rec.custo, motivo:'Saldo inicial', lojaId:rec.loja_id});
  }
  fecharProdutoModal();
  renderEstoque();
  toast(_prodEditId?'✅ Produto atualizado':'✅ Produto cadastrado');
}

// ── Modal de movimento (entrada / saída / ajuste) ──
let _movProdId=null, _movTipo='entrada';

function abrirMovModal(produtoId, tipo){
  _movProdId=produtoId; _movTipo=tipo;
  const p=produtoById(produtoId); if(!p) return;
  const config={
    entrada:{ titulo:'📦 Entrada de estoque', dica:'Use quando receber mercadoria, compra ou devolução de material.' },
    saida:{   titulo:'📤 Saída de estoque',   dica:'Use quando material sair sem estar vinculado a uma OS (perda, empréstimo, consumo interno).' },
    ajuste:{  titulo:'⚖️ Inventário / Corrigir saldo', dica:'Use para corrigir a quantidade real após contar o estoque fisicamente.' }
  };
  const cfg=config[tipo]||config.entrada;
  document.getElementById('mov-modal-titulo').innerHTML=
    `<span>${cfg.titulo}</span><button onclick="fecharMovModal()" aria-label="Fechar" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;line-height:1;margin-left:auto;padding:0 4px">×</button>`;
  // Deixa explícito em QUAL unidade o movimento vai cair e qual saldo está sendo
  // comparado — no ajuste, contar contra o saldo de outra loja lança diferença errada.
  const _lm=_lojaParaMovimento();
  const _saldoTxt = _lm
    ? `${fmtQtd(tipo==='ajuste'?_fisicaProdutoNaLoja(produtoId,_lm):disponivelProduto(produtoId))} ${esc(p.unidade||'un')} em ${esc(getLojaNome(_lm)||_lm)}`
    : '<span style="color:var(--red)">selecione a unidade no topo</span>';
  document.getElementById('mov-saldo-atual').innerHTML=
    `<strong style="color:var(--c2)">${esc(p.nome)}</strong><br>`+
    `<span style="color:var(--gray)">${tipo==='ajuste'?'Saldo registrado':'Em estoque agora'}: <strong>${_saldoTxt}</strong></span><br>`+
    `<span style="font-size:11px;color:var(--gray);font-style:italic;margin-top:3px;display:block">${cfg.dica}</span>`;
  setV('mov-qtd',''); setV('mov-motivo','');
  // Motivo padronizado só faz sentido no ajuste (entrada/saída já têm tipo próprio).
  // Texto livre gerou 15 grafias diferentes para 21 ajustes — sem código não dá
  // para separar perda real de erro de contagem.
  const _mcw=document.getElementById('mov-motivo-cod-wrap');
  if(_mcw) _mcw.style.display = tipo==='ajuste' ? '' : 'none';
  setV('mov-motivo-cod','');
  document.getElementById('mov-qtd-label').textContent = tipo==='ajuste' ? 'Quantidade real contada agora' : 'Quantidade';
  const cw=document.getElementById('mov-custo-wrap'); if(cw) cw.style.display = tipo==='entrada' ? '' : 'none';
  setV('mov-custo', p.custo?String(p.custo):'');
  document.getElementById('mov-modal').style.display='flex';
  setTimeout(()=>document.getElementById('mov-qtd')?.focus(),80);
}
function fecharMovModal(){ document.getElementById('mov-modal').style.display='none'; }

// ══════════════════════════════════════════════════════════════════════════════
//  BAIXA RÁPIDA DE MATERIAL
//  O consumo real não estava sendo capturado: a baixa só acontecia por
//  orçamento aprovado → OS concluída, e das 118 OS apenas 1 foi concluída no
//  sistema. Deu 303 entradas contra 40 saídas — o estoque só sabia o que
//  entrava. Aqui o material sai em 3 toques, de qualquer lugar, sem depender de
//  orçamento nem de OS.
//
//  O MOTIVO é obrigatório porque as saídas não são todas iguais:
//   • venda        → saiu E gerou receita. É resultado, não perda. Para o modelo
//                    "vende primeiro, compra depois" é o gatilho de reposição.
//   • uso_servico  → consumido na manutenção; é custo do serviço.
//   • perda        → quebra/vencimento; é prejuízo e precisa aparecer como tal.
//   • uso_interno  → consumo da própria empresa (amostra, demonstração).
//  Sem essa distinção, "saiu 3 cloros" não diz se a empresa ganhou ou perdeu.
// ══════════════════════════════════════════════════════════════════════════════
const BAIXA_MOTIVOS=[
  {id:'venda',       nome:'💰 Venda',        cor:'var(--green)', pedeValor:true,  desc:'Vendido ao cliente — gera receita e entra na lista de compras'},
  {id:'uso_servico', nome:'🔧 Uso em serviço',cor:'var(--c1)',   pedeValor:false, desc:'Consumido numa manutenção/OS'},
  {id:'perda',       nome:'🗑️ Perda / avaria',cor:'var(--red)',  pedeValor:false, desc:'Quebra, vencimento ou extravio'},
  {id:'uso_interno', nome:'🏠 Uso interno',   cor:'var(--gray)',  pedeValor:false, desc:'Consumo da própria empresa'}
];
let _baixaProdId=null, _baixaMotivo='venda';

function abrirBaixaRapida(produtoId){
  _baixaProdId=produtoId||null; _baixaMotivo='venda';
  setV('baixa-busca',''); setV('baixa-qtd',''); setV('baixa-valor',''); setV('baixa-ref','');
  document.getElementById('baixa-sugestoes').innerHTML='';
  document.getElementById('baixa-form').style.display=_baixaProdId?'':'none';
  _baixaRenderMotivos();
  if(_baixaProdId) _baixaSelecionar(_baixaProdId);
  document.getElementById('baixa-modal').style.display='flex';
  if(!_baixaProdId) setTimeout(()=>document.getElementById('baixa-busca')?.focus(), 80);
}
function fecharBaixaRapida(){ document.getElementById('baixa-modal').style.display='none'; }

function baixaBuscar(termo){
  const el=document.getElementById('baixa-sugestoes'); if(!el) return;
  const t=(termo||'').trim().toLowerCase();
  if(t.length<2){ el.innerHTML=''; return; }
  const achados=produtosVisiveis().filter(p=>
    (p.nome||'').toLowerCase().includes(t) || (p.codigo||'').toLowerCase().includes(t)
  ).slice(0,8);
  if(!achados.length){ el.innerHTML='<div style="font-size:12px;color:var(--gray);padding:8px">Nenhum produto encontrado.</div>'; return; }
  el.innerHTML=achados.map(p=>{
    const disp=disponivelProduto(p.id);
    return `<button class="tb" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:9px 11px" onclick="_baixaSelecionar('${p.id}')">
      <div style="font-weight:700;color:var(--c2);font-size:12.5px">${esc(p.nome)}</div>
      <div style="font-size:11px;color:var(--gray)">${p.codigo?esc(p.codigo)+' · ':''}tem ${fmtQtd(disp)} ${esc(p.unidade||'un')}</div>
    </button>`;
  }).join('');
}
function _baixaSelecionar(pid){
  const p=produtoById(pid); if(!p) return;
  _baixaProdId=pid;
  const disp=disponivelProduto(pid);
  document.getElementById('baixa-selecionado').innerHTML=
    `<strong style="color:var(--c2)">${esc(p.nome)}</strong><br>
     <span style="color:var(--gray)">Disponível agora: <strong>${fmtQtd(disp)} ${esc(p.unidade||'un')}</strong>${p.custo>0?` · custo ${brl(parseFloat(p.custo))}`:''}</span>`;
  document.getElementById('baixa-sugestoes').innerHTML='';
  setV('baixa-busca', p.nome);
  document.getElementById('baixa-form').style.display='';
  // Pré-preenche o valor com o preço de venda — é o caso mais comum e evita digitação.
  _baixaAplicarMotivo();
  baixaAtualizarResumo();
  setTimeout(()=>document.getElementById('baixa-qtd')?.focus(), 60);
}
function _baixaRenderMotivos(){
  const el=document.getElementById('baixa-motivos'); if(!el) return;
  el.innerHTML=BAIXA_MOTIVOS.map(m=>{
    const on=_baixaMotivo===m.id;
    return `<button class="tb" title="${esc(m.desc)}" onclick="baixaSetMotivo('${m.id}')"
      style="font-size:11.5px;padding:8px 10px;${on?`background:${m.cor};color:#fff;border-color:${m.cor};font-weight:700`:''}">${m.nome}</button>`;
  }).join('');
}
// Visibilidade do campo de valor. Extraída porque precisa rodar TAMBÉM ao abrir
// o modal: o motivo inicial é "venda" (que pede valor), e sem isto o campo só
// aparecia se o usuário trocasse de motivo e voltasse.
function _baixaAplicarMotivo(){
  const cfg=BAIXA_MOTIVOS.find(m=>m.id===_baixaMotivo);
  const wrap=document.getElementById('baixa-valor-wrap');
  if(wrap) wrap.style.display=cfg?.pedeValor?'':'none';
  if(cfg?.pedeValor && !gV('baixa-valor')){
    const p=produtoById(_baixaProdId);
    if(p && parseFloat(p.preco_venda)>0) setV('baixa-valor', String(parseFloat(p.preco_venda)).replace('.',','));
  }
}
function baixaSetMotivo(id){
  _baixaMotivo=id;
  _baixaRenderMotivos();
  _baixaAplicarMotivo();
  baixaAtualizarResumo();
}
function baixaAtualizarResumo(){
  const el=document.getElementById('baixa-resumo'); if(!el) return;
  const p=produtoById(_baixaProdId); if(!p){ el.textContent=''; return; }
  const qtd=parseFloat((gV('baixa-qtd')||'').replace(',','.'))||0;
  const disp=disponivelProduto(_baixaProdId);
  const cfg=BAIXA_MOTIVOS.find(m=>m.id===_baixaMotivo);
  let txt='';
  if(qtd>0){
    txt=`Vai sair <strong>${fmtQtd(qtd)} ${esc(p.unidade||'un')}</strong> · saldo depois: <strong>${fmtQtd(disp-qtd)}</strong>`;
    // Negativo NÃO bloqueia: no modelo "vende e depois compra" é justamente o
    // que joga o item na lista de compras. Mas avisa, para não passar batido.
    if(disp-qtd<0) txt+=` <span style="color:var(--yellow);font-weight:700">— fica negativo e entra na lista de compras</span>`;
    if(cfg?.pedeValor){
      const v=parseFloat((gV('baixa-valor')||'').replace(',','.'))||0;
      if(v>0){
        const total=v*qtd, custo=(parseFloat(p.custo)||0)*qtd;
        txt+=`<br>Venda: <strong>${brl(total)}</strong>`+(custo>0?` · margem: <strong style="color:${total-custo>=0?'var(--green)':'var(--red)'}">${brl(total-custo)}</strong>`:'');
      }
    }
  }
  el.innerHTML=txt;
}
function confirmarBaixaRapida(){
  const p=produtoById(_baixaProdId);
  if(!p){ toast('⚠️ Escolha o produto'); return; }
  const qtd=parseFloat((gV('baixa-qtd')||'').replace(',','.'))||0;
  if(qtd<=0){ toast('⚠️ Informe a quantidade'); document.getElementById('baixa-qtd')?.focus(); return; }
  const loja=_lojaParaMovimento();
  if(!loja){ toast('⚠️ Selecione a unidade no topo da tela'); return; }
  const cfg=BAIXA_MOTIVOS.find(m=>m.id===_baixaMotivo)||BAIXA_MOTIVOS[0];
  const ref=(gV('baixa-ref')||'').trim();
  const valor=cfg.pedeValor?(parseFloat((gV('baixa-valor')||'').replace(',','.'))||0):0;

  const motivoTxt=[cfg.nome.replace(/^\S+\s/,''), ref?('— '+ref):'', valor>0?`(${brl(valor*qtd)})`:'']
    .filter(Boolean).join(' ');
  const btn=document.getElementById('baixa-btn');
  if(btn){ btn.disabled=true; btn.textContent='Registrando…'; }
  registrarMovimento({
    produto_id:_baixaProdId, tipo:'saida', quantidade:-Math.abs(qtd),
    custo_unit:parseFloat(p.custo)||0,
    motivo:motivoTxt,
    ref:'baixa:'+cfg.id,   // permite filtrar por tipo de saída depois
    lojaId:loja
  });
  if(btn){ btn.disabled=false; btn.textContent='✅ Confirmar baixa'; }
  fecharBaixaRapida();
  if(typeof renderEstoque==='function' && document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
  toast(`✅ Baixa de ${fmtQtd(qtd)} ${p.unidade||'un'} — ${cfg.nome.replace(/^\S+\s/,'')}`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  VENDA DE BALCÃO — Etapa 1 do roadmap de CRM (2026-08-12)
//  Diferente de "Dar baixa" (que é 1 produto, 1 motivo, sem cliente),
//  isto é um carrinho: N itens, vira UMA transação em `vendas_balcao` com
//  cliente (opcional — balcão pode ser anônimo) e alimenta o histórico do
//  cliente. É a peça que faltava pra venda avulsa não evaporar todo dia
//  (ver docs/crm-insights-plano-etapa1.md se existir, ou o recado no
//  CLAUDE.md sobre o roadmap de 8 etapas).
// ══════════════════════════════════════════════════════════════════════════════
let _vendaCarrinho=[];          // [{produto_id, nome, unidade, qtd, preco_unit, custo_unit}]
let _vendaClienteSelecionado=null; // {id, nome} quando veio da busca — null se digitado à mão ou anônimo
let _vendaAnonimo=false;

function abrirVendaBalcao(){
  _vendaCarrinho=[]; _vendaClienteSelecionado=null; _vendaAnonimo=false;
  setV('venda-cli',''); setV('venda-busca',''); setV('venda-forma-pgto','');
  document.getElementById('venda-sugestoes').innerHTML='';
  _vendaRenderCarrinho();
  document.getElementById('venda-modal').style.display='flex';
  setTimeout(()=>document.getElementById('venda-busca')?.focus(), 80);
}
function fecharVendaBalcao(){ document.getElementById('venda-modal').style.display='none'; }

// Qualquer edição manual no campo de cliente invalida o id que veio da busca
// (não dá pra garantir que o texto editado ainda corresponde ao cadastro) —
// mas o nome digitado continua sendo salvo como texto, igual orçamento faz.
function _vendaClienteEditado(){ _vendaClienteSelecionado=null; _vendaAnonimo=false; }
function _vendaSemCliente(){
  setV('venda-cli','Balcão (sem cliente identificado)');
  _vendaClienteSelecionado=null; _vendaAnonimo=true;
}

function vendaBuscarProduto(termo){
  const el=document.getElementById('venda-sugestoes'); if(!el) return;
  const t=(termo||'').trim().toLowerCase();
  if(t.length<2){ el.innerHTML=''; return; }
  const achados=produtosVisiveis().filter(p=>
    (p.nome||'').toLowerCase().includes(t) || (p.codigo||'').toLowerCase().includes(t)
  ).slice(0,8);
  if(!achados.length){ el.innerHTML='<div style="font-size:12px;color:var(--gray);padding:8px">Nenhum produto encontrado.</div>'; return; }
  el.innerHTML=achados.map(p=>{
    const disp=disponivelProduto(p.id);
    return `<button class="tb" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:9px 11px" onclick="_vendaAddItem('${p.id}')">
      <div style="font-weight:700;color:var(--c2);font-size:12.5px">${esc(p.nome)}</div>
      <div style="font-size:11px;color:var(--gray)">${p.codigo?esc(p.codigo)+' · ':''}tem ${fmtQtd(disp)} ${esc(p.unidade||'un')}${p.preco_venda?' · '+brl(p.preco_venda):''}</div>
    </button>`;
  }).join('');
}
function _vendaAddItem(pid){
  const p=produtoById(pid); if(!p) return;
  const ja=_vendaCarrinho.find(i=>i.produto_id===pid);
  if(ja){ ja.qtd=(parseFloat(ja.qtd)||0)+1; }
  else{
    _vendaCarrinho.push({
      produto_id:pid, nome:p.nome, unidade:p.unidade||'un',
      qtd:1, preco_unit:parseFloat(p.preco_venda)||0, custo_unit:parseFloat(p.custo)||0
    });
  }
  setV('venda-busca',''); document.getElementById('venda-sugestoes').innerHTML='';
  _vendaRenderCarrinho();
  document.getElementById('venda-busca')?.focus();
}
function vendaRemoverItem(idx){ _vendaCarrinho.splice(idx,1); _vendaRenderCarrinho(); }
function vendaAtualizarItem(idx, campo, val){
  const it=_vendaCarrinho[idx]; if(!it) return;
  it[campo]=parseFloat(String(val).replace(',','.'))||0;
  _vendaRenderCarrinho(true); // true: não perde o foco do campo que está sendo digitado
}
function _vendaTotais(){
  return _vendaCarrinho.reduce((a,i)=>({
    total: a.total+(i.qtd*i.preco_unit),
    custo: a.custo+(i.qtd*i.custo_unit)
  }), {total:0, custo:0});
}
function _vendaRenderCarrinho(soTotais){
  const totEl=document.getElementById('venda-total');
  const {total}=_vendaTotais();
  if(totEl) totEl.textContent = _vendaCarrinho.length ? `Total: ${brl(total)}` : '';
  if(soTotais) return; // evita re-renderizar as linhas e perder o foco do input enquanto digita
  const el=document.getElementById('venda-carrinho'); if(!el) return;
  if(!_vendaCarrinho.length){ el.innerHTML=''; return; }
  el.innerHTML = _vendaCarrinho.map((i,idx)=>`
    <div style="display:flex;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line,#e5e7eb)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--c2);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.nome)}</div>
        <div style="font-size:11px;color:var(--gray)">${brl(i.preco_unit)} / ${esc(i.unidade)}</div>
      </div>
      <input type="text" inputmode="decimal" value="${i.qtd}" style="width:52px;text-align:center;padding:6px 4px" onchange="vendaAtualizarItem(${idx},'qtd',this.value)">
      <div style="width:70px;text-align:right;font-weight:700;font-size:12.5px">${brl(i.qtd*i.preco_unit)}</div>
      <button onclick="vendaRemoverItem(${idx})" aria-label="Remover" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;font-weight:700;padding:0 4px">×</button>
    </div>`).join('');
}

async function confirmarVendaBalcao(){
  if(!_vendaCarrinho.length){ toast('⚠️ Adicione ao menos um produto'); return; }
  const loja=_lojaParaMovimento();
  if(!loja){ toast('⚠️ Selecione a unidade no topo da tela'); return; }
  const {total, custo}=_vendaTotais();
  const clienteNome=(gV('venda-cli')||'').trim();
  const s=getSessao();
  // dados SEM id: vendas_balcao.id é uuid gerado pelo banco — mesmo cuidado
  // de despesas/equipamentos (mandar id texto local derruba o insert inteiro,
  // 22P02, sem coluna pra reportar).
  const dados={
    loja_id:loja,
    cliente_id:_vendaClienteSelecionado?.id||null,
    cliente_nome:clienteNome||(_vendaAnonimo?'Balcão (sem cliente identificado)':null),
    itens:_vendaCarrinho.map(i=>({produto_id:i.produto_id,nome:i.nome,qtd:i.qtd,preco_unit:i.preco_unit,custo_unit:i.custo_unit})),
    valor_total:total, custo_total:custo,
    forma_pagamento:gV('venda-forma-pgto')||null,
    vendedor:s?.nome||'',
    observacao:null,
    data_criacao:new Date().toISOString()
  };
  const btn=document.getElementById('venda-btn');
  if(btn){ btn.disabled=true; btn.textContent='Registrando…'; }
  const vendaIdRef='venda_'+Date.now(); // só pra referenciar nos movimentos de estoque — não é o id real da venda
  _vendaCarrinho.forEach(i=>{
    registrarMovimento({
      produto_id:i.produto_id, tipo:'saida', quantidade:-Math.abs(i.qtd),
      custo_unit:i.custo_unit,
      motivo:'Venda balcão'+(clienteNome?' — '+clienteNome:''),
      ref:'venda:'+vendaIdRef+':'+i.produto_id,
      lojaId:loja
    });
  });
  todasVendasBalcao.unshift({...dados, id:vendaIdRef});
  lsVendaSalvar(todasVendasBalcao);
  if(dbOk&&db){
    try{
      const {data:ins}=await dbInsert('vendas_balcao', dados);
      if(ins){ todasVendasBalcao=todasVendasBalcao.filter(x=>x.id!==vendaIdRef); todasVendasBalcao.unshift(ins); lsVendaSalvar(todasVendasBalcao); }
    }catch(e){ console.warn('[confirmarVendaBalcao]', e?.message||e); toast('⚠️ Venda registrada aqui, mas não sincronizou ainda'); }
  }
  if(btn){ btn.disabled=false; btn.textContent='✅ Fechar Venda'; }
  fecharVendaBalcao();
  if(typeof renderEstoque==='function' && document.getElementById('page-estoque')?.classList.contains('on')) renderEstoque();
  toast(`✅ Venda de ${brl(total)} registrada${clienteNome&&!_vendaAnonimo?' — '+clienteNome:''}`);
}

let todasVendasBalcao=[];
function lsVendaLer(){ try{ return JSON.parse(ls('fluxa_vendas_balcao')||'[]'); }catch(e){ return []; } }
function lsVendaSalvar(lista){ lsSet('fluxa_vendas_balcao', JSON.stringify(lista)); }
async function loadVendasBalcao(){
  todasVendasBalcao=lsVendaLer();
  if(!dbOk||!db) return;
  try{
    const {data}=await db.from('vendas_balcao').select('*').order('data_criacao',{ascending:false}).limit(3000);
    if(data){ todasVendasBalcao=data; lsVendaSalvar(todasVendasBalcao); }
  }catch(e){ console.warn('[loadVendasBalcao]', e?.message||e); }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CORREÇÃO MANUAL DA RESERVA
//  A reserva é DERIVADA dos orçamentos aprovados (movimentos `res:orc:*`), então
//  não existe — de propósito — um campo editável para ela. O problema é que,
//  quando ela sai do lugar, o "disponível" mente (disp = física − reservada) e a
//  tela de inventário não resolve, porque aquela só mexe no saldo FÍSICO. Foi
//  exatamente esse buraco que deixou 17 produtos com reserva negativa em 2026-08.
//  Aqui o gestor vê de onde vem a reserva atual e corrige — de preferência
//  recalculando pelos orçamentos, que é determinístico.
// ══════════════════════════════════════════════════════════════════════════════
let _resvProdId=null, _resvLoja='';
function _reservaBreakdown(pid, loja){
  const movs=(todosMovEstoque||[]).filter(m=>m.produto_id===pid && (m.loja_id||'')===loja && _TIPOS_RESERVA.includes(m.tipo));
  const atual=movs.reduce((a,m)=>a+(parseFloat(m.quantidade)||0),0);
  let manual=0; const porOrc={};
  movs.forEach(m=>{
    const q=parseFloat(m.quantidade)||0;
    const i=m.ref?m.ref.indexOf('orc:'):-1;
    if(i<0){ manual+=q; return; }                 // correção manual / ref sem orçamento
    const resto=m.ref.slice(i+4);
    const j=resto.indexOf(':'+pid);
    porOrc[j>0?resto.slice(0,j):resto.split(':')[0]]=(porOrc[j>0?resto.slice(0,j):resto.split(':')[0]]||0)+q;
  });
  // Esperado = mesma regra do sincronizarReservaOrcamento: aprovado e não entregue.
  let esperado=0; const abertos=[];
  (todosOrc||[]).forEach(o=>{
    if(o.status!=='aprovado' || (o.loja_id||'')!==loja) return;
    let svcs=o.servicos;
    if(typeof svcs==='string'){ try{ svcs=JSON.parse(svcs||'[]'); }catch(e){ console.warn('[resv svcs]',e?.message||e); svcs=[]; } }
    (svcs||[]).forEach(s=>{
      if(!s || s.produto_id!==pid) return;
      if(_entregueProdutoOrc(o.id,pid)) return;   // já entregue → não deveria estar reservado
      const q=parseInt(s.qty)||1; esperado+=q;
      abertos.push({numero:o.numero, cliente:o.cliente||'—', qtd:q});
    });
  });
  return {atual, esperado, manual, porOrc, abertos};
}

function abrirResvModal(produtoId){
  if(!eGestor()){ toast('Acesso não permitido.'); return; }
  const loja=_lojaParaMovimento();
  if(!loja){ toast('⚠️ Selecione a unidade no topo para corrigir a reserva'); return; }
  const p=produtoById(produtoId); if(!p) return;
  _resvProdId=produtoId; _resvLoja=loja;
  const b=_reservaBreakdown(produtoId, loja);
  const un=esc(p.unidade||'un');
  const bate=Math.abs(b.atual-b.esperado)<0.001;
  document.getElementById('resv-info').innerHTML=
    `<strong style="color:var(--c2)">${esc(p.nome)}</strong><br>`+
    `<span style="color:var(--gray)">Unidade: <strong>${esc(getLojaNome(loja)||loja)}</strong></span>`;
  let det=`<div style="border:1px solid var(--line,#e5e7eb);border-radius:8px;padding:10px;font-size:12px">`+
    `<div style="display:flex;justify-content:space-between;margin-bottom:4px">`+
      `<span>Reservado registrado hoje</span>`+
      `<strong style="color:${b.atual<0?'var(--red)':'var(--c2)'}">${fmtQtd(b.atual)} ${un}</strong></div>`+
    `<div style="display:flex;justify-content:space-between">`+
      `<span>Pelos orçamentos aprovados</span><strong style="color:var(--c2)">${fmtQtd(b.esperado)} ${un}</strong></div>`;
  if(b.abertos.length){
    det+=`<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line,#e5e7eb)">`+
      b.abertos.map(o=>`<div style="display:flex;justify-content:space-between;color:var(--gray)">`+
        `<span>#${esc(String(o.numero||'?'))} · ${esc(String(o.cliente).slice(0,26))}</span>`+
        `<span>${fmtQtd(o.qtd)} ${un}</span></div>`).join('')+`</div>`;
  } else {
    det+=`<div style="margin-top:6px;color:var(--gray)">Nenhum orçamento aprovado pendente com este produto.</div>`;
  }
  if(Math.abs(b.manual)>0.001)
    det+=`<div style="margin-top:6px;color:var(--gray)">Inclui ${fmtQtd(b.manual)} ${un} de correção manual anterior.</div>`;
  if(b.atual<-0.001)
    det+=`<div style="margin-top:8px;color:var(--red);font-weight:600">⚠️ Reserva negativa — o disponível está sendo mostrado maior do que existe.</div>`;
  else if(!bate)
    det+=`<div style="margin-top:8px;color:var(--orange,#b45309)">Diferença de ${fmtQtd(b.atual-b.esperado)} ${un} em relação aos orçamentos.</div>`;
  else
    det+=`<div style="margin-top:8px;color:var(--green,#15803d)">✅ Bate com os orçamentos — nada a corrigir.</div>`;
  det+=`</div>`;
  document.getElementById('resv-detalhe').innerHTML=det;
  document.getElementById('resv-btn-recalc').innerHTML=
    `↻ Usar o valor dos orçamentos (${fmtQtd(b.esperado)} ${un})`;
  setV('resv-qtd', String(b.esperado)); setV('resv-motivo','');
  document.getElementById('resv-modal').style.display='flex';
  setTimeout(()=>document.getElementById('resv-motivo')?.focus(),80);
}
function fecharResvModal(){ document.getElementById('resv-modal').style.display='none'; }
function resvUsarEsperado(){
  if(!_resvProdId) return;
  setV('resv-qtd', String(_reservaBreakdown(_resvProdId,_resvLoja).esperado));
}
function confirmarResv(){
  if(!eGestor()){ toast('Acesso não permitido.'); return; }
  if(!_resvProdId||!_resvLoja) return;
  const p=produtoById(_resvProdId); if(!p) return;
  const alvo=parseFloat((gV('resv-qtd')||'').replace(',','.'));
  if(isNaN(alvo)){ toast('⚠️ Informe a quantidade reservada correta'); return; }
  if(alvo<0){ toast('⚠️ A reserva não pode ser negativa'); return; }
  const motivo=(gV('resv-motivo')||'').trim();
  if(!motivo){ toast('⚠️ Informe o motivo da correção'); document.getElementById('resv-motivo')?.focus(); return; }
  const atual=_reservaBreakdown(_resvProdId,_resvLoja).atual;
  const diff=alvo-atual;
  if(Math.abs(diff)<0.001){ toast('Reserva já está correta'); fecharResvModal(); return; }
  // ref SEM 'orc:' de propósito — a reconciliação de órfãs varre por 'orc:' e não
  // pode confundir uma correção manual com reserva de um orçamento inexistente.
  registrarMovimento({
    produto_id:_resvProdId,
    tipo: diff>0?'reserva':'liberacao_reserva',
    quantidade: diff, custo_unit:null,
    motivo:'Correção de reserva: '+motivo,
    ref:'fix:reserva-manual:'+_resvLoja+':'+_resvProdId+':'+Date.now(),
    lojaId:_resvLoja
  });
  logAcao('estoque_reserva_corrigida', `${p.nome} · ${fmtQtd(atual)} → ${fmtQtd(alvo)} em ${getLojaNome(_resvLoja)||_resvLoja} (${motivo})`);
  fecharResvModal(); renderEstoque();
  toast(`✅ Reserva corrigida para ${fmtQtd(alvo)} ${p.unidade||'un'}`);
}
function confirmarMovimento(){
  const p=produtoById(_movProdId); if(!p) return;
  const val=parseFloat((gV('mov-qtd')||'').replace(',','.'));
  if(isNaN(val)){ toast('⚠️ Informe a quantidade'); return; }
  const motivo=(gV('mov-motivo')||'').trim();
  // Unidade explícita: sem isso o movimento cai na loja de CADASTRO do produto,
  // que pode não ser a loja onde a pessoa contou/recebeu (ver _lojaParaMovimento).
  const lojaAlvo=_lojaParaMovimento();
  if(!lojaAlvo){ toast('⚠️ Selecione a unidade no topo antes de movimentar o estoque'); return; }
  if(_movTipo==='entrada'){
    const custo=parseFloat((gV('mov-custo')||'').replace(',','.'));
    const fisAntes=fisicaProdutoTotal(_movProdId); // ANTES de registrar, p/ o CMP
    registrarMovimento({produto_id:_movProdId, tipo:'entrada', quantidade:Math.abs(val), custo_unit:isNaN(custo)?p.custo:custo, motivo:motivo||'Entrada manual', lojaId:lojaAlvo});
    if(!isNaN(custo)) recomputarCMP(_movProdId, Math.abs(val), custo, fisAntes); // custo médio ponderado
  } else if(_movTipo==='saida'){
    registrarMovimento({produto_id:_movProdId, tipo:'saida', quantidade:-Math.abs(val), custo_unit:p.custo, motivo:motivo||'Saída manual', lojaId:lojaAlvo});
  } else { // ajuste: diferença entre saldo físico contado e atual
    const motivoCod=(gV('mov-motivo-cod')||'').trim();
    if(!motivoCod){ toast('⚠️ Escolha o que aconteceu'); document.getElementById('mov-motivo-cod')?.focus(); return; }
    if(!motivo){ toast('⚠️ Informe o motivo do ajuste'); document.getElementById('mov-motivo')?.focus(); return; }
    // saldo DA LOJA ALVO — nunca o total do grupo, senão a diferença sai errada
    const atual=_fisicaProdutoNaLoja(_movProdId, lojaAlvo);
    const diff=val-atual;
    if(diff===0){ toast('Saldo já está correto'); fecharMovModal(); return; }
    registrarMovimento({produto_id:_movProdId, tipo:'ajuste', quantidade:diff, custo_unit:p.custo, motivo:motivo, motivoCod:motivoCod, lojaId:lojaAlvo});
  }
  fecharMovModal();
  renderEstoque();
  toast('✅ Movimento registrado');
}

// ── Transferência entre unidades ──
let _transfProdId=null;
function abrirTransfModal(produtoId){
  _transfProdId=produtoId;
  const p=produtoById(produtoId); if(!p) return;
  const origem=lojaAtiva||p.loja_id||LOJA_PADRAO_ID;
  document.getElementById('transf-modal-titulo').textContent='Transferir — '+p.nome;
  document.getElementById('transf-origem').textContent='De: '+getLojaNome(origem)+' (disponível: '+fmtQtd(disponivelProduto(produtoId))+')';
  const sel=document.getElementById('transf-destino');
  sel.innerHTML=LOJAS.filter(l=>l.id!==origem).map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('');
  setV('transf-qtd',''); setV('transf-motivo','');
  document.getElementById('transf-modal').style.display='flex';
  setTimeout(()=>document.getElementById('transf-qtd')?.focus(),80);
}
function fecharTransfModal(){ document.getElementById('transf-modal').style.display='none'; }
function confirmarTransferencia(){
  const q=parseFloat((gV('transf-qtd')||'').replace(',','.'));
  if(isNaN(q)||q<=0){ toast('⚠️ Informe a quantidade'); return; }
  const dest=gV('transf-destino');
  if(!dest){ toast('⚠️ Escolha a unidade de destino'); return; }
  const ok=transferirProduto(_transfProdId, q, dest, (gV('transf-motivo')||'').trim());
  if(ok){ fecharTransfModal(); toast('✅ Transferência registrada'); }
  else toast('⚠️ Não foi possível transferir');
}

// ── Histórico de um produto ──
let _histProdId=null, _histProdPag=0, _histProdFiltro='todos';
const _HIST_POR_PAG=25;
function abrirHistProduto(produtoId){
  _histProdId=produtoId; _histProdPag=0; _histProdFiltro='todos';
  _renderHistProduto();
  document.getElementById('hist-prod-modal').style.display='flex';
}
function _renderHistProduto(){
  const produtoId=_histProdId;
  const p=produtoById(produtoId); if(!p) return;
  const tT={entrada:'＋ Entrada',saida:'− Saída',ajuste:'⚖ Ajuste',reserva:'🔒 Reserva',liberacao_reserva:'🔓 Libera',transf_entrada:'🔄 Transf.+',transf_saida:'🔄 Transf.−'};
  const tC={entrada:'var(--green)',saida:'#b45309',ajuste:'var(--gray)',reserva:'#7c3aed',liberacao_reserva:'#7c3aed',transf_entrada:'#0369a1',transf_saida:'#0369a1'};
  document.getElementById('hist-prod-titulo').innerHTML=`Histórico — ${esc(p.nome)} <button onclick="fecharHistProduto()" aria-label="Fechar" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;float:right;line-height:1">×</button>`;
  let todos=todosMovEstoque.filter(m=>m.produto_id===produtoId).sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(_histProdFiltro!=='todos') todos=todos.filter(m=>m.tipo===_histProdFiltro);
  const body=document.getElementById('hist-prod-body');
  if(!todos.length){
    body.innerHTML='<div style="padding:20px;text-align:center;color:var(--gray);font-size:13px">Nenhum movimento ainda.</div>';
    return;
  }
  const inicio=_histProdPag*_HIST_POR_PAG;
  const pagina=todos.slice(inicio,inicio+_HIST_POR_PAG);
  const temAntes=inicio>0, temDepois=inicio+_HIST_POR_PAG<todos.length;
  const filtros=[['todos','Todos'],['entrada','＋ Ent.'],['saida','− Saída'],['ajuste','⚖ Ajuste'],['reserva','🔒']];
  const filtrosHTML=filtros.map(([k,l])=>`<button onclick="_histProdFiltro='${k}';_histProdPag=0;_renderHistProduto()" style="font-size:11px;padding:3px 8px;border-radius:50px;border:1px solid ${_histProdFiltro===k?'var(--c1)':'var(--gray-light)'};background:${_histProdFiltro===k?'var(--c1)':'transparent'};color:${_histProdFiltro===k?'white':'var(--gray)'};cursor:pointer">${l}</button>`).join('');
  const navHTML=temAntes||temDepois?`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:12px;color:var(--gray)"><span>${inicio+1}–${Math.min(inicio+_HIST_POR_PAG,todos.length)} de ${todos.length}</span><div style="display:flex;gap:6px">${temAntes?`<button onclick="_histProdPag--;_renderHistProduto()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">←</button>`:''} ${temDepois?`<button onclick="_histProdPag++;_renderHistProduto()" style="padding:2px 8px;border:1px solid var(--gray-light);border-radius:4px;cursor:pointer;background:none">→</button>`:''}</div></div>`:'';
  body.innerHTML=renderHistoricoPreco(produtoId)+`<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--gray-light);margin-bottom:4px;margin-top:8px">${filtrosHTML}</div>`
    +pagina.map(m=>{
      const d=new Date(m.data).toLocaleDateString('pt-BR')+' '+new Date(m.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const q=parseFloat(m.quantidade)||0;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:${tC[m.tipo]||'var(--c2)'}">${tT[m.tipo]||m.tipo} ${fmtQtd(q)}</div>
          <div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.motivo||'')}${m.usuario?' · '+esc(m.usuario):''}</div>
        </div>
        <div style="font-size:11px;color:var(--gray);white-space:nowrap;text-align:right">${d}</div>
      </div>`;
    }).join('')+navHTML;
}
function fecharHistProduto(){ document.getElementById('hist-prod-modal').style.display='none'; }

// ══════════════════════════════════════════════════
//  FORNECEDORES
// ══════════════════════════════════════════════════
// todosFornecedores declarado no topo do arquivo (evita TDZ no boot)
function lsFornecLer(){ try{ return JSON.parse(ls('fluxa_fornecedores')||'[]'); }catch(e){ return []; } }
function lsFornecSalvar(l){ lsSet('fluxa_fornecedores', JSON.stringify(l)); }

async function loadFornecedores(){
  todosFornecedores = lsFornecLer();
  if(dbOk&&db){
    try{
      const {data}=await db.from('fornecedores').select('*').order('nome',{ascending:true});
      if(data){
        let remotoF=data;
        const _tombF=new Set(_tombLer('fluxa_fornec_tombstones'));
        if(_tombF.size){
          remotoF.filter(r=>_tombF.has(r.id)).forEach(r=>db.from('fornecedores').delete().eq('id',r.id).then(()=>{}).catch(()=>{}));
          remotoF=remotoF.filter(r=>!_tombF.has(r.id));
        }
        todosFornecedores=remotoF; lsFornecSalvar(remotoF);
      }
    }catch(e){ console.warn('[fornecedores]',e?.message||e); }
  }
}

function abrirFornecModal(){ loadFornecedores().then(()=>renderFornecList()); document.getElementById('fornec-modal').style.display='flex'; cancelarFornecedorForm(); }
function fecharFornecModal(){ document.getElementById('fornec-modal').style.display='none'; }

function renderFornecList(){
  const el=document.getElementById('fornec-lista'); if(!el) return;
  // Atualizar select de produto
  const selProd=document.getElementById('prod-fornecedor');
  if(selProd){ selProd.innerHTML='<option value="">— nenhum —</option>'+todosFornecedores.filter(f=>f.ativo!==false).map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join(''); }
  if(!todosFornecedores.filter(f=>f.ativo!==false).length){ el.innerHTML='<div style="padding:12px;text-align:center;color:var(--gray);font-size:13px">Nenhum fornecedor cadastrado.</div>'; return; }
  el.innerHTML=todosFornecedores.filter(f=>f.ativo!==false).map(f=>`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-light)">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(f.nome)}</div>
        <div style="font-size:11px;color:var(--gray)">${[f.contato,f.whatsapp,f.email].filter(Boolean).map(esc).join(' · ')}</div>
        ${f.obs?`<div style="font-size:11px;color:var(--gray)">${esc(f.obs)}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${f.whatsapp?`<button onclick="window.open('https://wa.me/55${f.whatsapp.replace(/\D/g,'')}','_blank')" style="background:var(--green);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">📲</button>`:''}
        <button onclick="editarFornecedor('${f.id}')" style="background:var(--gray-light);color:var(--c2);border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">✎</button>
        <button onclick="deletarFornecedor('${f.id}')" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">✕</button>
      </div>
    </div>`).join('');
}

function cancelarFornecedorForm(){
  ['fnome','fcontato','fwhatsapp','femail','fobs'].forEach(id=>setV(id,''));
  setV('fornec-edit-id','');
  const t=document.getElementById('fornec-form-titulo'); if(t) t.textContent='＋ Novo fornecedor';
  const cb=document.getElementById('fornec-cancelar-btn'); if(cb) cb.style.display='none';
}
function editarFornecedor(id){
  const f=todosFornecedores.find(x=>x.id===id); if(!f) return;
  setV('fnome',f.nome||''); setV('fcontato',f.contato||''); setV('fwhatsapp',f.whatsapp||''); setV('femail',f.email||''); setV('fobs',f.obs||''); setV('fornec-edit-id',id);
  const t=document.getElementById('fornec-form-titulo'); if(t) t.textContent='✎ Editar fornecedor';
  const cb=document.getElementById('fornec-cancelar-btn'); if(cb) cb.style.display='';
}
async function salvarFornecedor(){
  const nome=(gV('fnome')||'').trim(); if(!nome){ toast('⚠️ Informe o nome do fornecedor'); return; }
  const editId=gV('fornec-edit-id')||'';
  const id=editId||'forn_'+Date.now();
  const s=getSessao();
  const rec={id, loja_id:lojaAtiva||LOJA_PADRAO_ID, nome, contato:(gV('fcontato')||'').trim(), whatsapp:(gV('fwhatsapp')||'').replace(/\D/g,''), email:(gV('femail')||'').trim(), obs:(gV('fobs')||'').trim(), ativo:true};
  const idx=todosFornecedores.findIndex(x=>x.id===id);
  if(idx>=0) todosFornecedores[idx]=rec; else todosFornecedores.unshift(rec);
  lsFornecSalvar(todosFornecedores);
  if(dbOk&&db){ (async()=>{ try{ await dbUpsert('fornecedores',rec); }catch(e){ console.warn('[fornecSave]',e?.message||e); } })(); }
  cancelarFornecedorForm(); renderFornecList(); toast(editId?'✅ Fornecedor atualizado':'✅ Fornecedor cadastrado');
}
async function deletarFornecedor(id){
  confirmar('Remover este fornecedor?', async ()=>{
    todosFornecedores=todosFornecedores.filter(f=>f.id!==id);
    lsFornecSalvar(todosFornecedores);
    _tombAdd('fluxa_fornec_tombstones', id); // protege contra ressuscitar se o delete abaixo falhar
    if(dbOk&&db){ try{ await db.from('fornecedores').delete().eq('id',id); }catch(e){ console.warn('[fornecDel]',e?.message||e); } }
    renderFornecList(); toast('Fornecedor removido');
  }, 'Remover fornecedor');
}

function enviarListaComprasWhatsApp(fornecId){
  const itens=_calcListaCompras().filter(x=>x.p.fornecedor_id===fornecId);
  const forn=todosFornecedores.find(f=>f.id===fornecId);
  if(!forn?.whatsapp){ toast('Fornecedor sem WhatsApp cadastrado'); return; }
  const LC=getLojaConfig(lojaAtiva);
  let txt='🛒 *Pedido de compra* — '+(LC.nome||'Forthemp')+'\n'+new Date().toLocaleDateString('pt-BR')+'\n\n';
  txt+=itens.map(x=>`• ${x.p.nome}: *${fmtQtd(x.qtd)} ${x.p.unidade||''}*${x.motivo==='encomenda'?' ⚠️ urgente':''}`).join('\n');
  const total=itens.reduce((a,x)=>a+(parseFloat(x.p.custo)||0)*x.qtd,0);
  txt+=`\n\n💰 Total estimado: ${brl(total)}`;
  window.open(`https://wa.me/55${forn.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(txt)}`,'_blank');
}

// ══════════════════════════════════════════════════
//  PONTO DE PEDIDO
// ══════════════════════════════════════════════════
function pontoDePedido(pid){
  const p=produtoById(pid); if(!p) return 0;
  const lt=parseFloat(p.lead_time_dias)||0;
  const seg=parseFloat(p.estoque_seguranca)||0;
  const cdias=consumoDia(pid);
  return lt*cdias + seg;
}

// ══════════════════════════════════════════════════
//  ORDENS DE COMPRA (OC)
// ══════════════════════════════════════════════════
// todasOC declarado no topo do arquivo (evita TDZ no boot)
let _ocEditItens = []; // [{produto_id, nome, unidade, qtd, custo_unit}]

function lsOCLer(){ try{ return JSON.parse(ls('fluxa_oc')||'[]'); }catch(e){ return []; } }
function lsOCSalvar(l){ lsSet('fluxa_oc', JSON.stringify(l)); }
// Rede de segurança na leitura: garante que `itens` seja SEMPRE array. Cobre
// registros gravados antes da correção (quando ia como string JSON no jsonb) e
// qualquer origem futura. Sem isto, Array.isArray() falha e a OC perde os
// itens na tela, na edição e — pior — ao dar entrada no estoque.
function _ocNormalizar(o){
  if(!o) return o;
  let itens=o.itens;
  if(typeof itens==='string'){ try{ itens=JSON.parse(itens||'[]'); }catch(e){ console.warn('[OC itens]',e?.message||e); itens=[]; } }
  return {...o, itens: Array.isArray(itens)?itens:[]};
}

async function loadOC(){
  todasOC = lsOCLer();
  if(dbOk&&db){
    try{
      const {data}=await db.from('ordens_compra').select('*').order('data_criacao',{ascending:false}).limit(200);
      if(data){ todasOC=data.map(_ocNormalizar); lsOCSalvar(todasOC); }
    }catch(e){ console.warn('[OC load]',e?.message||e); }
  }
}

function abrirOCListModal(){ loadFornecedores(); loadOC().then(()=>renderOCList()); document.getElementById('oc-list-modal').style.display='flex'; }
function fecharOCListModal(){ document.getElementById('oc-list-modal').style.display='none'; }

function renderOCList(){
  const el=document.getElementById('oc-list-body'); if(!el) return;
  const statusLabel={rascunho:'Rascunho',enviada:'Enviada',recebida:'✅ Recebida',cancelada:'Cancelada'};
  const statusCor={rascunho:'var(--gray)',enviada:'var(--c1)',recebida:'var(--green)',cancelada:'var(--red)'};
  const lista=filtrarPorLoja(todasOC,'loja_id').sort((a,b)=>new Date(b.data_criacao)-new Date(a.data_criacao));
  if(!lista.length){ el.innerHTML='<div style="padding:18px;text-align:center;color:var(--gray);font-size:13px">Nenhuma OC criada.</div>'; return; }
  el.innerHTML=lista.map(oc=>{
    const forn=todosFornecedores.find(f=>f.id===oc.fornecedor_id);
    const itens=Array.isArray(oc.itens)?oc.itens:[];
    return `<div style="padding:10px 0;border-bottom:1px solid var(--gray-light)">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c2)">OC #${oc.numero||'—'} · ${esc(forn?.nome||'Sem fornecedor')}</div>
          <div style="font-size:11px;color:var(--gray)">${new Date(oc.data_criacao).toLocaleDateString('pt-BR')} · ${itens.length} iten${itens.length!==1?'s':''} · ${brl(oc.total||0)}</div>
          ${oc.obs?`<div style="font-size:11px;color:var(--gray)">${esc(oc.obs)}</div>`:''}
        </div>
        <div style="flex-shrink:0;text-align:right">
          <div style="font-size:11px;font-weight:700;color:${statusCor[oc.status]||'var(--gray)'}">${statusLabel[oc.status]||oc.status}</div>
          <div style="display:flex;gap:4px;margin-top:4px;justify-content:flex-end">
            <button onclick="abrirOCForm('${oc.id}')" style="font-size:11px;background:var(--gray-light);color:var(--c2);border:none;border-radius:6px;padding:3px 8px;cursor:pointer">✎ Ver</button>
            ${oc.status!=='recebida'&&oc.status!=='cancelada'?`<button onclick="receberOC('${oc.id}')" style="font-size:11px;background:var(--green);color:white;border:none;border-radius:6px;padding:3px 8px;cursor:pointer">📦 Receber</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function criarOCManual(){ _ocEditItens=[]; _abrirOCFormModal(null); }

function criarOCDaListaCompras(){
  const itens=_calcListaCompras();
  if(!itens.length){ toast('Nada para comprar'); return; }
  _ocEditItens=itens.map(x=>({produto_id:x.p.id, nome:x.p.nome, unidade:x.p.unidade||'un', qtd:x.qtd, custo_unit:parseFloat(x.p.custo)||0}));
  _abrirOCFormModal(null);
  fecharListaCompras();
  document.getElementById('oc-list-modal').style.display='none';
}

function criarOCDoGrupo(fornecId){
  const itens=_calcListaCompras().filter(x=>x.p.fornecedor_id===fornecId);
  _ocEditItens=itens.map(x=>({produto_id:x.p.id, nome:x.p.nome, unidade:x.p.unidade||'un', qtd:x.qtd, custo_unit:parseFloat(x.p.custo)||0}));
  _abrirOCFormModal(null);
  // pré-selecionar fornecedor
  setTimeout(()=>{ const sel=document.getElementById('oc-fornecedor'); if(sel) sel.value=fornecId; },50);
  fecharListaCompras();
}

function abrirOCForm(id){ const oc=todasOC.find(o=>o.id===id); if(!oc) return; _ocEditItens=Array.isArray(oc.itens)?oc.itens.map(x=>({...x})):[]; _abrirOCFormModal(oc); }

function _abrirOCFormModal(oc){
  loadFornecedores().then(()=>{
    const sel=document.getElementById('oc-fornecedor');
    if(sel) sel.innerHTML='<option value="">— selecionar —</option>'+todosFornecedores.filter(f=>f.ativo!==false).map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('');
    const addSel=document.getElementById('oc-add-prod');
    if(addSel){ addSel.innerHTML='<option value="">＋ Adicionar produto…</option>'+produtosVisiveis().map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join(''); addSel.onchange=function(){ if(this.value) adicionarItemOC(this.value); this.value=''; }; }
    if(oc){
      setV('oc-edit-id',oc.id); setV('oc-obs',oc.obs||''); setV('oc-data',oc.data||'');
      setTimeout(()=>{ const s=document.getElementById('oc-fornecedor'); if(s) s.value=oc.fornecedor_id||''; },30);
      document.getElementById('oc-form-titulo').innerHTML=`OC #${oc.numero} <button onclick="fecharOCFormModal()" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;line-height:1;margin-left:auto;padding:0 4px">×</button>`;
    } else {
      setV('oc-edit-id',''); setV('oc-obs',''); setV('oc-data',_hojeLocal());
      document.getElementById('oc-form-titulo').innerHTML=`Nova Ordem de Compra <button onclick="fecharOCFormModal()" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:18px;font-weight:700;line-height:1;margin-left:auto;padding:0 4px">×</button>`;
    }
    renderOCItens();
    document.getElementById('oc-form-modal').style.display='flex';
  });
}
function fecharOCFormModal(){ document.getElementById('oc-form-modal').style.display='none'; }

function adicionarItemOC(produtoId){
  const p=produtoById(produtoId); if(!p) return;
  const ja=_ocEditItens.find(x=>x.produto_id===produtoId);
  if(ja){ ja.qtd++; } else { _ocEditItens.push({produto_id:produtoId, nome:p.nome, unidade:p.unidade||'un', qtd:1, custo_unit:parseFloat(p.custo)||0}); }
  renderOCItens();
}
function removeItemOC(i){ _ocEditItens.splice(i,1); renderOCItens(); }
function renderOCItens(){
  const el=document.getElementById('oc-itens-body'); if(!el) return;
  if(!_ocEditItens.length){ el.innerHTML='<div style="padding:12px;text-align:center;color:var(--gray);font-size:13px">Nenhum item. Adicione produtos abaixo.</div>'; document.getElementById('oc-total-row').textContent=''; return; }
  el.innerHTML=_ocEditItens.map((x,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c2)">${esc(x.nome)}</div>
      <input type="text" inputmode="decimal" value="${x.qtd}" oninput="_ocEditItens[${i}].qtd=parseFloat(this.value.replace(',','.'))||0;renderOCItens()" style="width:52px;padding:4px 6px;border:1.5px solid var(--gray-mid);border-radius:6px;font-size:12px;text-align:center;font-family:'Inter',sans-serif">
      <span style="font-size:11px;color:var(--gray)">${esc(x.unidade)}</span>
      <input type="text" inputmode="decimal" value="${x.custo_unit}" oninput="_ocEditItens[${i}].custo_unit=parseFloat(this.value.replace(',','.'))||0;renderOCItens()" style="width:70px;padding:4px 6px;border:1.5px solid var(--gray-mid);border-radius:6px;font-size:12px;text-align:right;font-family:'Inter',sans-serif" placeholder="R$">
      <button onclick="removeItemOC(${i})" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:3px 7px;font-size:12px;cursor:pointer">✕</button>
    </div>`).join('');
  const total=_ocEditItens.reduce((a,x)=>a+x.qtd*x.custo_unit,0);
  document.getElementById('oc-total-row').innerHTML=`Total: <strong>${brl(total)}</strong>`;
}

async function salvarOC(status){
  const fornId=(document.getElementById('oc-fornecedor')?.value||'').trim();
  if(!fornId){ toast('⚠️ Selecione o fornecedor'); return; }
  if(!_ocEditItens.length){ toast('⚠️ Adicione pelo menos um item'); return; }
  // Rascunho pode não ter data combinada ainda — mas enviar ao fornecedor sem
  // isso significa nunca ter lead time real nem saber se ele atrasou (OTIF).
  if(status==='enviada' && !gV('oc-data-prevista')){
    avisarCampoObrigatorio('oc-data-prevista','Informe a data prevista de entrega antes de enviar ao fornecedor — sem ela não dá para saber depois se ele atrasou.');
    return;
  }
  const editId=gV('oc-edit-id')||'';
  const id=editId||'oc_'+Date.now();
  const total=_ocEditItens.reduce((a,x)=>a+x.qtd*x.custo_unit,0);
  let numero;
  if(!editId){ const max=todasOC.reduce((a,o)=>Math.max(a,o.numero||0),0); numero=max+1; }
  const existente=todasOC.find(o=>o.id===editId);
  const rec={id, loja_id:lojaAtiva||LOJA_PADRAO_ID, numero:numero||existente?.numero||1, fornecedor_id:fornId, data:gV('oc-data')||_hojeLocal(), data_prevista:gV('oc-data-prevista')||null, status: existente?.status==='recebida'?'recebida':(status||'rascunho'), itens:_ocEditItens, total, obs:(gV('oc-obs')||'').trim(), data_criacao:existente?.data_criacao||new Date().toISOString()};
  const idx=todasOC.findIndex(o=>o.id===id);
  if(idx>=0) todasOC[idx]=rec; else todasOC.unshift(rec);
  lsOCSalvar(todasOC);
  // `itens` vai como ARRAY, não string: a coluna é jsonb e aceita a estrutura
  // nativa. Com JSON.stringify o valor virava uma *string* JSON dentro do
  // jsonb, e aí Array.isArray(oc.itens) dava false na volta — a OC abria sem
  // itens (e salvar por cima os apagava) e receber não dava entrada no estoque.
  if(dbOk&&db){ (async()=>{ try{ await dbUpsert('ordens_compra', rec); }catch(e){ console.warn('[OC save]',e?.message||e); } })(); }
  fecharOCFormModal(); renderOCList(); toast(`✅ OC #${rec.numero} salva`);
}

async function receberOC(id){
  const oc=todasOC.find(o=>o.id===id); if(!oc) return;
  confirmar(`Confirmar recebimento da OC #${oc.numero}? Isso dará entrada automática no estoque para cada item.`, async()=>{
    const itens=Array.isArray(oc.itens)?oc.itens:[];
    itens.forEach(item=>{
      registrarMovimento({produto_id:item.produto_id, tipo:'entrada', quantidade:item.qtd, custo_unit:item.custo_unit, motivo:`Recebimento OC #${oc.numero}`, ref:`oc_${oc.id}_${item.produto_id}`});
    });
    const idx=todasOC.findIndex(o=>o.id===id);
    if(idx>=0){ todasOC[idx]={...oc,status:'recebida',data_recebimento:new Date().toISOString()}; lsOCSalvar(todasOC); if(dbOk&&db){ try{ await dbUpdate('ordens_compra', {status:'recebida',data_recebimento:new Date().toISOString()}, 'id', id); }catch(e){ console.warn('[OC receber]',e?.message||e); } } }
    renderOCList(); renderEstoque(); toast(`✅ OC #${oc.numero} recebida — estoque atualizado`);
  }, 'Confirmar recebimento');
}

async function enviarOCWhatsApp(){
  const fornId=(document.getElementById('oc-fornecedor')?.value||'').trim();
  const forn=todosFornecedores.find(f=>f.id===fornId);
  await salvarOC('enviada');
  if(!forn?.whatsapp){ toast('OC salva. Fornecedor sem WhatsApp cadastrado.'); return; }
  const LC=getLojaConfig(lojaAtiva);
  const oc=todasOC.find(o=>o.id===(gV('oc-edit-id')||todasOC[0]?.id));
  let txt=`📄 *Ordem de Compra #${oc?.numero||'?'}*\n${LC.nome||'Forthemp'} · ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  txt+=_ocEditItens.map(x=>`• ${x.nome}: *${fmtQtd(x.qtd)} ${x.unidade}* — ${brl(x.custo_unit)}/un`).join('\n');
  txt+=`\n\n💰 *Total: ${brl(_ocEditItens.reduce((a,x)=>a+x.qtd*x.custo_unit,0))}*`;
  if(oc?.obs) txt+=`\n📝 ${oc.obs}`;
  window.open(`https://wa.me/55${forn.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(txt)}`,'_blank');
}

// ══════════════════════════════════════════════════
//  BALANÇO DE INVENTÁRIO
// ══════════════════════════════════════════════════
let _balancoContagem = {}; // { produtoId: qtd_contada }

function abrirBalancoModal(){
  _balancoContagem = {};
  document.getElementById('balanco-busca').value='';
  renderBalancoLista();
  document.getElementById('balanco-modal').style.display='flex';
}
function fecharBalancoModal(){ document.getElementById('balanco-modal').style.display='none'; }

function renderBalancoLista(){
  const busca=(gV('balanco-busca')||'').toLowerCase().trim();
  const el=document.getElementById('balanco-body'); if(!el) return;
  const prods=produtosVisiveis().filter(p=>!busca||(p.nome||'').toLowerCase().includes(busca)||(p.codigo||'').toLowerCase().includes(busca));
  if(!prods.length){ el.innerHTML='<div style="padding:12px;text-align:center;color:var(--gray)">Nenhum produto encontrado.</div>'; _atualizarResumoBalanco(); return; }
  el.innerHTML=prods.map(p=>{
    const fis=fisicaProduto(p.id);
    const contado=_balancoContagem[p.id]!=null?_balancoContagem[p.id]:'';
    const diff=contado!==''?contado-fis:null;
    const diffStr=diff===null?'':(diff>0?`<span style="color:var(--green);font-weight:700">+${fmtQtd(diff)}</span>`:diff<0?`<span style="color:var(--red);font-weight:700">${fmtQtd(diff)}</span>`:`<span style="color:var(--gray)">ok</span>`);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-light)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--c2)">${esc(p.nome)}</div>
        <div style="font-size:11px;color:var(--gray)">Sistema: ${fmtQtd(fis)} ${esc(p.unidade||'un')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="text" inputmode="decimal" placeholder="contado" value="${contado}" oninput="(function(v){_balancoContagem['${p.id}']=v===''?undefined:parseFloat(v.replace(',','.'))||0;_atualizarResumoBalanco();document.getElementById('bal-diff-${p.id}').innerHTML=v===''?'':(parseFloat(v.replace(',','.'))||0)-${fis}>=0&&v!==''?'<span style=&quot;color:var(--green);font-weight:700&quot;>+'+(parseFloat(v.replace(',','.'))||0-${fis})+'</span>':'<span style=&quot;color:var(--red);font-weight:700&quot;>'+(parseFloat(v.replace(',','.'))||0-${fis})+'</span>'})(this.value)" style="width:70px;padding:5px 8px;border:1.5px solid var(--gray-mid);border-radius:7px;font-size:12px;text-align:center;font-family:'Inter',sans-serif">
        <div id="bal-diff-${p.id}" style="font-size:12px;min-width:30px;text-align:center">${diffStr}</div>
      </div>
    </div>`;
  }).join('');
  _atualizarResumoBalanco();
}

function _atualizarResumoBalanco(){
  const res=document.getElementById('balanco-resumo'); if(!res) return;
  const contados=Object.entries(_balancoContagem).filter(([,v])=>v!=null);
  // usa o MESMO saldo que o confirmarBalanco vai usar (da loja alvo), senão a
  // prévia mostra um número e a gravação lança outro
  const _lb=_lojaParaMovimento();
  const _fis=id=>_lb?_fisicaProdutoNaLoja(id,_lb):fisicaProduto(id);
  const comDiff=contados.filter(([id,v])=>{ const fis=_fis(id); return Math.abs((v||0)-fis)>0.001; });
  if(!contados.length){ res.innerHTML='<span style="color:var(--gray)">Preencha os campos acima com a contagem física.</span>'; return; }
  if(!_lb){ res.innerHTML='<span style="color:var(--red)">⚠️ Selecione a unidade no topo — a contagem é sempre de uma prateleira física.</span>'; return; }
  const positivos=comDiff.filter(([id,v])=>(v||0)>_fis(id)).length;
  const negativos=comDiff.filter(([id,v])=>(v||0)<_fis(id)).length;
  res.innerHTML=`<strong>${contados.length}</strong> produto${contados.length!==1?'s':''} contado${contados.length!==1?'s':''} · <span style="color:var(--green)">${positivos} sobra${positivos!==1?'s':''}</span> · <span style="color:var(--red)">${negativos} falta${negativos!==1?'s':''}</span> · ${comDiff.length} ajuste${comDiff.length!==1?'s':''} a registrar`;
}

function confirmarBalanco(){
  // Mesma regra do ajuste avulso: contagem é sempre de uma prateleira física.
  const lojaAlvo=_lojaParaMovimento();
  if(!lojaAlvo){ toast('⚠️ Selecione a unidade no topo antes de fechar o balanço'); return; }
  const comDiff=Object.entries(_balancoContagem).filter(([id,v])=>{ if(v==null) return false; const fis=_fisicaProdutoNaLoja(id,lojaAlvo); return Math.abs((v||0)-fis)>0.001; });
  if(!comDiff.length){ toast('Nenhuma diferença encontrada.'); fecharBalancoModal(); return; }
  confirmar(`Registrar ${comDiff.length} ajuste${comDiff.length!==1?'s':''} de inventário em ${esc(getLojaNome(lojaAlvo)||lojaAlvo)}? Esta ação não pode ser desfeita.`, ()=>{
    comDiff.forEach(([id,v])=>{
      const fis=_fisicaProdutoNaLoja(id,lojaAlvo); const diff=(v||0)-fis;
      registrarMovimento({produto_id:id, tipo:'ajuste', quantidade:diff, custo_unit:produtoById(id)?.custo||0, motivo:'Balanço de inventário '+new Date().toLocaleDateString('pt-BR'), motivoCod:'inventario', lojaId:lojaAlvo});
    });
    fecharBalancoModal(); renderEstoque(); toast(`✅ ${comDiff.length} ajuste${comDiff.length!==1?'s':''} registrado${comDiff.length!==1?'s':''}`);
  }, 'Confirmar balanço');
}

// ══════════════════════════════════════════════════
//  HISTÓRICO DE PREÇO (custo ao longo do tempo)
// ══════════════════════════════════════════════════
function renderHistoricoPreco(produtoId){
  const entradas=todosMovEstoque.filter(m=>m.produto_id===produtoId&&m.tipo==='entrada'&&m.custo_unit!=null).sort((a,b)=>new Date(a.data)-new Date(b.data));
  if(entradas.length<2) return '';
  const max=Math.max(...entradas.map(e=>e.custo_unit||0))||1;
  const min=Math.min(...entradas.map(e=>e.custo_unit||0));
  const pts=entradas.slice(-12); // últimas 12 entradas
  const bars=pts.map(e=>{
    const pct=Math.max(8,Math.round(((e.custo_unit||0)-min)/(max-min||1)*64)+8);
    return `<div title="${new Date(e.data).toLocaleDateString('pt-BR')}: ${brl(e.custo_unit)}" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:default">
      <div style="font-size:9px;color:var(--gray);writing-mode:vertical-rl;transform:rotate(180deg);max-height:36px;overflow:hidden">${brl(e.custo_unit)}</div>
      <div style="width:18px;background:var(--c1);border-radius:3px 3px 0 0;height:${pct}px;opacity:.8"></div>
      <div style="font-size:9px;color:var(--gray);white-space:nowrap">${new Date(e.data).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>
    </div>`;
  }).join('');
  const variacao=entradas.length>=2?((entradas[entradas.length-1].custo_unit-entradas[0].custo_unit)/entradas[0].custo_unit*100):0;
  return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--gray-light)">
    <div style="font-size:11px;font-weight:700;color:var(--c1);margin-bottom:6px">📈 Histórico de custo (${entradas.length} entradas)</div>
    <div style="display:flex;gap:4px;align-items:flex-end;overflow-x:auto;padding-bottom:4px">${bars}</div>
    <div style="font-size:11px;color:var(--gray);margin-top:6px">Variação total: <strong style="color:${variacao>0?'var(--red)':variacao<0?'var(--green)':'var(--gray)'}">${variacao>0?'+':''}${variacao.toFixed(1)}%</strong> · Custo atual (CMP): <strong>${brl(produtoById(produtoId)?.custo||0)}</strong></div>
  </div>`;
}

// ══════════════════════════════════════════════════
//  INSIGHTS: PONTO DE PEDIDO
// ══════════════════════════════════════════════════
function _insightsPontoDePedido(prods){
  const alertas=prods.filter(p=>{
    const pp=pontoDePedido(p.id); if(pp<=0) return false;
    const disp=disponivelProduto(p.id);
    return disp<=pp && disp>=0; // abaixo do ponto de pedido mas ainda não em encomenda
  }).sort((a,b)=>disponivelProduto(a.id)/pontoDePedido(a.id)-disponivelProduto(b.id)/pontoDePedido(b.id));
  if(!alertas.length) return '';
  return `<div class="card"><div class="ct">🔔 Ponto de pedido atingido</div>
    <div style="font-size:11px;color:var(--gray);margin-bottom:8px">Produtos que precisam ser pedidos agora para não faltar durante o lead time do fornecedor.</div>
    ${alertas.slice(0,8).map(p=>{
      const pp=pontoDePedido(p.id), disp=disponivelProduto(p.id), lt=parseFloat(p.lead_time_dias)||0;
      const forn=todosFornecedores.find(f=>f.id===p.fornecedor_id);
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gray-light)">
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--c2)">${esc(p.nome)}</div>
          <div style="font-size:11px;color:var(--gray)">Disp.: ${fmtQtd(disp)} · PP: ${fmtQtd(pp)} · Lead: ${lt}d${forn?' · '+esc(forn.nome):''}</div>
        </div>
        <button class="tb g" style="font-size:10px;flex-shrink:0" onclick="abrirMovModal('${p.id}','entrada')">pedir</button>
      </div>`;
    }).join('')}
  </div>`;
}

// ══════════════════════════════════════════════════
//  ANÁLISE DE MARGENS
// ══════════════════════════════════════════════════
function _insightsMargem(prods){
  const comPreco=prods.filter(p=>(parseFloat(p.preco_venda)||0)>0&&(parseFloat(p.custo)||0)>0);
  if(!comPreco.length) return '';
  const comMargem=comPreco.map(p=>{ const pr=parseFloat(p.preco_venda), cu=parseFloat(p.custo); return {...p, margem:(pr-cu)/pr*100}; }).sort((a,b)=>a.margem-b.margem);
  const baixa=comMargem.filter(p=>p.margem<20);
  const media=comMargem.filter(p=>p.margem>=20&&p.margem<40);
  const alta=comMargem.filter(p=>p.margem>=40);
  const mediaGeral=comMargem.reduce((a,p)=>a+p.margem,0)/comMargem.length;
  return `<div class="card"><div class="ct">💰 Análise de margens</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div style="flex:1;min-width:100px;border:1.5px solid var(--red);border-radius:10px;padding:8px 10px"><div style="font-size:12px;font-weight:700;color:var(--red)">Baixa &lt;20%<span style="float:right">${baixa.length}</span></div></div>
      <div style="flex:1;min-width:100px;border:1.5px solid var(--yellow);border-radius:10px;padding:8px 10px"><div style="font-size:12px;font-weight:700;color:var(--yellow)">Média 20–40%<span style="float:right">${media.length}</span></div></div>
      <div style="flex:1;min-width:100px;border:1.5px solid var(--green);border-radius:10px;padding:8px 10px"><div style="font-size:12px;font-weight:700;color:var(--green)">Alta ≥40%<span style="float:right">${alta.length}</span></div></div>
    </div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:8px">Margem média do catálogo: <strong style="color:var(--c2)">${mediaGeral.toFixed(1)}%</strong></div>
    ${baixa.length?`<div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ Margens críticas (revisar precificação)</div>`+baixa.slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gray-light);font-size:12px"><span style="color:var(--c2)">${esc(p.nome)}</span><span style="color:var(--red);font-weight:700">${p.margem.toFixed(1)}%</span></div>`).join(''):''}
  </div>`;
}

// ──────────────────────────────────────────────────
//  SERVICE WORKER (PWA — funciona quando hospedado)
// ──────────────────────────────────────────────────
let _swRefreshing=false;
function _forcarAtualizacao(){
  if(_swRefreshing) return;
  _swRefreshing=true;
  toast('🔄 Nova versão disponível. Atualizando...');
  setTimeout(()=>location.reload(),1500);
}

// ── FILA OFFLINE: reenvio automático ao reconectar ──────────────
// Os saves são local-first: gravam no localStorage na hora e tentam subir ao
// banco em background. Se estava sem internet, os loaders de cada tela já
// reenviam os pendentes ao abrir a tela. Aqui garantimos o reenvio também
// assim que a conexão volta (sem precisar navegar) e num intervalo suave.
let _reenvioEmAndamento=false;
// Há algo salvo localmente que ainda não subiu ao banco?
function _temPendentes(){
  try{
    if((typeof lsOrcLer==='function'?lsOrcLer():[]).some(o=>String(o.id).startsWith('local_'))) return true;
    if((typeof lsVisLer==='function'?lsVisLer():[]).some(v=>v&&v._pendingSync===true)) return true;
    if((typeof lsAgLer==='function'?lsAgLer():[]).some(a=>String(a.id).startsWith('ag_'))) return true;
    if((()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]'); }catch(e){ return []; } })().some(o=>String(o.id).startsWith('local_os_')||o._pendingSync===true)) return true;
    if((typeof lsDespLer==='function'?lsDespLer():[]).some(d=>String(d.id).startsWith('desp_'))) return true;
    if((typeof lsEqLer==='function'?lsEqLer():[]).some(eq=>String(eq.id).startsWith('eq_'))) return true;
  }catch(e){ console.warn('[temPendentes]', e?.message||e); }
  return false;
}
async function _reenviarPendentes(silencioso=true){
  if(!dbOk||!db||_reenvioEmAndamento||!navigator.onLine) return;
  // Foto presa em base64 na vistoria EM ANDAMENTO (ainda não salva/finalizada)
  // não aparece em _temPendentes() — checa à parte p/ não pular essa varredura.
  const temFotoVisAtual = Object.values(visEquipDados||{}).some(d=>(d?.fotos||[]).some(f=>f&&!String(f).startsWith('http')));
  if(silencioso && !_temPendentes() && !temFotoVisAtual) return; // nada preso → não gasta rede à toa
  _reenvioEmAndamento=true;
  try{
    // Orçamentos presos só no aparelho (id local_*)
    try{ const soLocal=(typeof lsOrcLer==='function'?lsOrcLer():[]).filter(o=>String(o.id).startsWith('local_')); if(soLocal.length) await _reenviarOrcamentosLocais(soLocal); }catch(e){ console.warn('[reenvio orc]',e?.message||e); }
    // Vistorias pendentes (loadVistoriasRemoto reenvia as _pendingSync + sobe fotos)
    try{ await loadVistoriasRemoto?.(); }catch(e){ console.warn('[reenvio vis]',e?.message||e); }
    // Fotos da vistoria em andamento (ainda não finalizada) que ficaram presas em base64
    try{ await _retryFotosVisEmAndamento?.(); }catch(e){ console.warn('[reenvio foto vis atual]',e?.message||e); }
    // Agendamentos presos (loadAgendamentos agora faz merge + reenvio)
    try{ await loadAgendamentos?.(); }catch(e){ console.warn('[reenvio ag]',e?.message||e); }
    // OS presas (criadas offline ou editadas offline sobre OS já existente)
    try{
      const soLocalOS=(()=>{ try{ return JSON.parse(ls('fluxa_os_hist')||'[]'); }catch(e){ return []; } })()
        .filter(o=>o._pendingSync===true||(String(o.id).startsWith('local_os_')&&_idadeIdMs(o.id)<DOIS_DIAS_MS));
      if(soLocalOS.length) await _reenviarOSLocais(soLocalOS);
    }catch(e){ console.warn('[reenvio os]',e?.message||e); }
    // Despesas/equipamentos presos (loadDespesas/loadEquipamentos agora fazem merge + reenvio)
    try{ await loadDespesas?.(); }catch(e){ console.warn('[reenvio desp]',e?.message||e); }
    try{ await loadEquipamentos?.(); }catch(e){ console.warn('[reenvio eq]',e?.message||e); }
    if(!silencioso) toast('✅ Dados pendentes sincronizados');
  }finally{ _reenvioEmAndamento=false; }
}
window.addEventListener('online', ()=>{ toast('🌐 Conexão restaurada — sincronizando…'); _reenviarPendentes(false); });
// Rede de segurança: a cada 3 min, se online, empurra pendentes silenciosamente
setInterval(()=>{ if(navigator.onLine) _reenviarPendentes(true); }, 180000);

if('serviceWorker' in navigator){
  // Reload automático quando um novo SW assume o controle (nova versão deployada)
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!_swRefreshing){ _swRefreshing=true; location.reload(); }
  });
  navigator.serviceWorker.addEventListener('message',e=>{
    if(e.data?.type==='NEW_VERSION') _forcarAtualizacao();
  });
  navigator.serviceWorker.register('sw.js').then(reg=>{
    console.log('Service Worker registrado');
    setInterval(()=>reg.update(),60*1000);
  }).catch(()=>{});
}

// ── Detector de nova versão por ETag/Last-Modified ──
// Não depende de bumpar o sw.js: pergunta ao servidor se o index.html mudou.
// Assim, qualquer deploy aparece sozinho nas abas abertas (mobile e desktop).
let _appTag=null;
async function _verificarVersaoApp(){
  if(_swRefreshing) return;
  try{
    const res=await fetch(location.pathname+'?_v='+Date.now(),{method:'HEAD',cache:'no-store'});
    if(!res.ok) return;
    const tag=res.headers.get('ETag')||res.headers.get('Last-Modified');
    if(!tag) return;
    if(_appTag===null){ _appTag=tag; return; } // primeira leitura: só guarda
    if(tag!==_appTag){ _appTag=tag; _forcarAtualizacao(); }
  }catch(e){ /* offline — ignora silenciosamente */ }
}
// Primeira checagem após 5s e depois a cada 60s
setTimeout(_verificarVersaoApp,5*1000);
setInterval(_verificarVersaoApp,60*1000);
// Verifica também quando a aba volta ao foco (técnico reabre o app no celular)
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') _verificarVersaoApp(); });
