// ─────────────────────────────────────────────────────────────────────────
// native.js — camada de detecção de "modo app" (PWA instalada na Tela de
// Início) e do prompt de instalação. Sem dependências externas; tudo aqui é
// feature-detection com fallback silencioso — mesmo princípio que o app.js
// já usa pra dbOk/offline. Nenhuma função aqui é obrigatória pro resto do
// app funcionar; se este arquivo não carregar, o Fluxa continua normal.
//
// Fase A do plano de "app de celular" (porte do FluxaSaas-/v2, ver
// CLAUDE.md). Push e biometria entram nas fases seguintes, neste mesmo
// arquivo.
// ─────────────────────────────────────────────────────────────────────────

// Achado ao vivo (24/08, testando a tela de Vistoria em campo — o técnico
// preenche fotos/avaliação por equipamento e finaliza): o banner fixo no
// rodapé ("Instalar o Fluxa") cobria o botão "✅ Finalizar Vistoria" quando
// a pessoa rolava até o fim do formulário — o próprio botão que fecha o
// trabalho de campo ficava por baixo, inclicável.
//
// Tentativa descartada: somar padding-bottom ao `.wrap` da página ativa.
// Não funciona de forma confiável — cada tela tem uma estrutura interna
// diferente (na de Vistoria, por exemplo, o container das abas ainda
// ocupa espaço de layout mesmo com a aba inativa em `display:none` em
// outro ponto da árvore), então "quanto padding extra é suficiente" varia
// por tela de um jeito que não dá pra calcular de fora sem depender da
// estrutura interna de cada uma — exatamente o acoplamento frágil que
// este arquivo tenta evitar (native.js não deve conhecer detalhes de tela
// nenhuma do app.js).
//
// Solução robusta: o banner **se esconde sozinho** (fade, sem remover do
// layout) sempre que a rolagem estiver perto do fim da página, e volta
// quando a pessoa rola pra cima de novo. Não precisa saber nada sobre o
// que tem no fim de cada tela — se tem alguma coisa lá embaixo, o banner
// simplesmente sai da frente enquanto a pessoa está vendo aquele trecho.
const _FLUXA_BANNER_SCROLL_MARGEM = 160; // px do fim da página onde o banner já se esconde
function _fluxaBannerPertoDoFim(){
  const doc = document.documentElement;
  return (window.scrollY + window.innerHeight) >= (doc.scrollHeight - _FLUXA_BANNER_SCROLL_MARGEM);
}
function _fluxaSincronizarBannerComScroll(){
  const el = document.getElementById('pwa-install-banner');
  if (!el || !el.classList.contains('on')) return;
  el.classList.toggle('pwa-banner-escondido-scroll', _fluxaBannerPertoDoFim());
}
window.addEventListener('scroll', _fluxaSincronizarBannerComScroll, { passive: true });
(function _fluxaObservarBannerInstalar(){
  const el = document.getElementById('pwa-install-banner');
  if (!el || !window.MutationObserver) return;
  new MutationObserver(_fluxaSincronizarBannerComScroll).observe(el, { attributes: true, attributeFilter: ['class'] });
  _fluxaSincronizarBannerComScroll();
})();

function fluxaModoStandalone(){
  try{
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // Safari iOS legado
  }catch(e){ return false; }
}

function fluxaPlataforma(){
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// Chave GLOBAL (não por loja) — é preferência do aparelho, não da empresa.
const LS_PWA_DISMISS = 'fluxa_pwa_prompt_dismiss';
const PWA_SNOOZE_DIAS = 7;

function _pwaDismissAtivo(){
  const t = parseInt(localStorage.getItem(LS_PWA_DISMISS) || '0');
  return t > 0 && (Date.now() - t) < PWA_SNOOZE_DIAS * 24 * 60 * 60 * 1000;
}
function fluxaDispensarInstalar(){
  localStorage.setItem(LS_PWA_DISMISS, String(Date.now()));
  const el = document.getElementById('pwa-install-banner');
  if (el) el.classList.remove('on');
}

// Android/Chrome dispara este evento quando o app é instalável — guardamos
// pra poder abrir o prompt nativo de instalação a partir do nosso próprio botão.
let _fluxaInstallEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _fluxaInstallEvent = e;
  _fluxaAvaliarBannerInstalar();
});
window.addEventListener('appinstalled', () => {
  _fluxaInstallEvent = null;
  const el = document.getElementById('pwa-install-banner');
  if (el) el.classList.remove('on');
});

async function fluxaInstalarAgora(){
  if (!_fluxaInstallEvent) return;
  _fluxaInstallEvent.prompt();
  try{ await _fluxaInstallEvent.userChoice; }catch(e){}
  _fluxaInstallEvent = null;
}

// Chamado de dentro de aplicarPermissoesPerfil() — o único ponto por onde
// todo login bem-sucedido (novo ou restaurado) passa. Decide o que mostrar:
// banner de instalar (se ainda não instalado) OU banner de ativar biometria
// (Fase B, se já instalado) — nunca mais de um ao mesmo tempo.
async function _fluxaAvaliarBannerInstalar(){
  const el = document.getElementById('pwa-install-banner');
  if (!el) return;

  if (!fluxaModoStandalone()){
    if (_pwaDismissAtivo()){ el.classList.remove('on'); return; }
    const plataforma = fluxaPlataforma();
    if (plataforma === 'desktop'){ el.classList.remove('on'); return; }
    if (plataforma === 'android' && !_fluxaInstallEvent){ el.classList.remove('on'); return; }
    const corpo = document.getElementById('pwa-install-body');
    const btn = document.getElementById('pwa-install-btn');
    const nomeApp = (typeof esc === 'function' && typeof CFG !== 'undefined' && CFG.nome) ? esc(CFG.nome) : 'Fluxa';
    if (plataforma === 'ios'){
      corpo.innerHTML = `Toque em <b>⬆️ Compartilhar</b> e depois em <b>"Adicionar à Tela de Início"</b> pra abrir o ${nomeApp} como app, com tela cheia.`;
      btn.style.display = 'none';
      btn.onclick = null;
    } else {
      corpo.innerHTML = `Instale o ${nomeApp} como app pra abrir mais rápido, com tela cheia.`;
      btn.style.display = '';
      btn.textContent = 'Instalar';
      btn.onclick = fluxaInstalarAgora;
    }
    el.classList.add('on');
    return;
  }

  // Já instalado — até 3 estados possíveis, nunca dois ao mesmo tempo:
  // 1) notificação nunca pedida (Fase C)  2) biometria disponível e não
  // ativada (Fase B)  3) nada a oferecer.
  if ('Notification' in window){
    if (Notification.permission === 'granted'){ if (typeof fluxaInscreverPush === 'function') fluxaInscreverPush(); }
    else if (Notification.permission !== 'denied' && !_pwaDismissAtivo()){
      const corpo = document.getElementById('pwa-install-body');
      const btn = document.getElementById('pwa-install-btn');
      corpo.innerHTML = 'Ative as notificações pra saber na hora quando um cliente aprovar um orçamento, sem precisar abrir o app.';
      btn.style.display = '';
      btn.textContent = 'Ativar';
      btn.onclick = fluxaAtivarNotificacoes;
      el.classList.add('on');
      return;
    }
  }

  const _sessAtual = typeof getSessao === 'function' ? getSessao() : null;
  if (_sessAtual && _sessAtual.nome && typeof fluxaTemCredencialBiometrica === 'function'
      && !fluxaTemCredencialBiometrica(_sessAtual.nome) && !_pwaDismissAtivo()){
    const disponivel = await fluxaBiometriaDisponivel();
    if (disponivel){
      const corpo = document.getElementById('pwa-install-body');
      const btn = document.getElementById('pwa-install-btn');
      const nomeApp2 = (typeof esc === 'function' && typeof CFG !== 'undefined' && CFG.nome) ? esc(CFG.nome) : 'Fluxa';
      corpo.innerHTML = `Ative o desbloqueio por Face ID/digital pra abrir o ${nomeApp2} mais rápido — e mais seguro se alguém pegar seu aparelho.`;
      btn.style.display = '';
      btn.textContent = 'Ativar';
      btn.onclick = async () => {
        const ok = await fluxaAtivarBiometria();
        if (ok){ const b = document.getElementById('pwa-install-banner'); if (b) b.classList.remove('on'); }
      };
      el.classList.add('on');
      return;
    }
  }

  el.classList.remove('on');
}

function _urlBase64ParaUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

// Chave pública VAPID — segura pra ficar no cliente (é a metade pública do
// par; a privada mora só na Edge Function, nunca sai do servidor).
const FLUXA_VAPID_PUBLIC_KEY = 'BAnQvDYnMkgO4GNitkktuivbK42z_sKlBGIIA7YRez3UvuXi55_gtClv3vgaCQ_rbJb0K2oNzkvUhP75ytSijk4';

async function fluxaAtivarNotificacoes(){
  try{
    const perm = await Notification.requestPermission();
    const el = document.getElementById('pwa-install-banner');
    if (el) el.classList.remove('on');
    if (perm === 'granted') await fluxaInscreverPush();
  }catch(e){ console.warn('[push] permissão', e?.message||e); }
}

// Registra (ou reaproveita) a inscrição de push do navegador e salva no
// banco. Idempotente: se já existe uma linha com esse endpoint, só reativa
// e atualiza nome/perfil/loja (podem ter mudado desde a última inscrição);
// nunca duplica.
async function fluxaInscreverPush(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const sess = typeof getSessao === 'function' ? getSessao() : null;
  if (!sess || !sess.nome || typeof db === 'undefined' || !db) return false;
  try{
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ParaUint8Array(FLUXA_VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON();
    const dadosSessao = { usuario_nome: sess.nome, perfil: sess.perfil||null, loja_id: sess.loja_id||null, ativo: true };
    const { data: existente } = await db.from('push_subscriptions').select('id').eq('endpoint', json.endpoint).maybeSingle();
    if (existente){
      await db.from('push_subscriptions').update(dadosSessao).eq('id', existente.id);
    } else if (typeof dbInsert === 'function'){
      await dbInsert('push_subscriptions', {
        id: 'push_' + Date.now(),
        ...dadosSessao,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        user_agent: navigator.userAgent,
      });
    }
    return true;
  }catch(e){ console.warn('[push] inscrever', e?.message||e); return false; }
}

// ─────────────────────────────────────────────────────────────────────────
// Histórico de push recebido (Fase D) — o Service Worker grava no IndexedDB
// 'fluxa-notificacoes' (não tem window lá, é o único armazenamento
// confiável sem nenhuma aba aberta). O v1 JÁ TEM seu próprio sino de
// notificações (getNotificacoes()/#notif-panel, app.js — alertas
// derivados: recebíveis, estoque, follow-up) — Fase D não cria um painel
// novo, só alimenta ESSE com o que chegou por push. Estas funções aqui são
// só a camada de acesso ao IndexedDB; a integração na lista/render vive em
// app.js.
// ─────────────────────────────────────────────────────────────────────────

const FLUXA_NOTIF_DB = 'fluxa-notificacoes';
function _abrirNotifDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FLUXA_NOTIF_DB, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('notificacoes')){
        idb.createObjectStore('notificacoes', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fluxaListarNotificacoesPush(limite){
  limite = limite || 30;
  try{
    const idb = await _abrirNotifDB();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction('notificacoes', 'readonly');
      const req = tx.objectStore('notificacoes').getAll();
      req.onsuccess = () => {
        const todas = (req.result || []).sort((a, b) => b.recebidaEm - a.recebidaEm);
        resolve(todas.slice(0, limite));
      };
      req.onerror = () => reject(req.error);
    });
  }catch(e){ console.warn('[push] listar', e?.message||e); return []; }
}

async function fluxaMarcarNotifPushLida(id){
  try{
    const idb = await _abrirNotifDB();
    await new Promise((resolve) => {
      const tx = idb.transaction('notificacoes', 'readwrite');
      const store = tx.objectStore('notificacoes');
      const r = store.get(id);
      r.onsuccess = () => {
        const v = r.result;
        if (v && !v.lida){ v.lida = true; store.put(v); }
        resolve();
      };
      r.onerror = () => resolve();
    });
  }catch(e){ console.warn('[push] marcar lida', e?.message||e); }
}

// Recebe o aviso do Service Worker (postMessage) de que uma notificação nova
// chegou — atualiza o sino na hora, sem esperar o próximo boot/foco de aba.
if (typeof navigator !== 'undefined' && navigator.serviceWorker){
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'FLUXA_NOTIF_NOVA' && typeof renderNotificacoes === 'function') renderNotificacoes();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Desbloqueio biométrico (Fase B, porte do FluxaSaas-/v2) — WebAuthn (Face
// ID/Touch ID/impressão digital via autenticador de plataforma do próprio
// aparelho).
//
// O que isso NÃO é: não é uma segunda camada de autenticação server-side —
// o v1 nem tem Supabase Auth (sessão é só nome+PIN em sessionStorage/
// "manter conectado" em localStorage, ver getSessao()/getSessaoLembrada()
// em app.js). Isso é só um GATE de conveniência/segurança física: sem ele,
// "manter conectado" reabre o app direto pra qualquer um que pegue o
// aparelho destravado. A credencial fica só no localStorage do aparelho, a
// verificação nunca sai do navegador. Chave usada pra identificar de quem é
// a credencial: sessaoExistente.nome — é o único identificador estável que
// a sessão do v1 tem (não existe id de usuário na sessão, só perfil/loja_id/
// nome; confirmado em app.js, os 4 pontos que chamam setSessao()).
// ─────────────────────────────────────────────────────────────────────────

function _bufParaB64url(buf){
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _b64urlParaBuf(str){
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function fluxaBiometriaDisponivel(){
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  try{ return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch(e){ return false; }
}
function fluxaTemCredencialBiometrica(nomeSessao){
  return !!nomeSessao && localStorage.getItem('fluxa_webauthn_user') === nomeSessao && !!localStorage.getItem('fluxa_webauthn_cred');
}

// Registro — chamado a partir do banner (2º estado, "já instalado").
async function fluxaAtivarBiometria(){
  const sess = typeof getSessao === 'function' ? getSessao() : null;
  if (!sess || !sess.nome) return false;
  try{
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Fluxa' },
        user: {
          id: new TextEncoder().encode(sess.nome),
          name: sess.nome,
          displayName: sess.nome,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'required' },
        timeout: 60000,
      },
    });
    if (!cred) return false;
    localStorage.setItem('fluxa_webauthn_cred', _bufParaB64url(cred.rawId));
    localStorage.setItem('fluxa_webauthn_user', sess.nome);
    return true;
  }catch(e){ console.warn('[webauthn] ativar', e?.message||e); return false; }
}

// Verificação — usada na tela de bloqueio, antes do boot continuar.
async function fluxaVerificarBiometria(){
  const credId = localStorage.getItem('fluxa_webauthn_cred');
  if (!credId) return true; // sem credencial registrada: sem gate, nada a verificar
  try{
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: _b64urlParaBuf(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  }catch(e){ console.warn('[webauthn] verificar', e?.message||e); return false; }
}

function mostrarTelaBloqueioBiometrico(){
  const el = document.getElementById('biometric-lock-overlay');
  if (el) el.style.display = 'flex';
  const titulo = document.getElementById('biometric-lock-titulo');
  if (titulo){
    const nomeApp = (typeof esc === 'function' && typeof CFG !== 'undefined' && CFG.nome) ? esc(CFG.nome) : 'Fluxa';
    titulo.textContent = `${nomeApp} bloqueado`;
  }
}
function esconderTelaBloqueioBiometrico(){
  const el = document.getElementById('biometric-lock-overlay');
  if (el) el.style.display = 'none';
}
async function fluxaDesbloquearBiometria(){
  const status = document.getElementById('biometric-lock-status');
  if (status) status.textContent = 'Verificando…';
  const ok = await fluxaVerificarBiometria();
  if (ok){
    sessionStorage.setItem('fluxa_webauthn_ok', '1');
    location.reload();
  } else if (status){
    status.textContent = 'Não foi possível verificar. Tente de novo.';
  }
}
// Escape hatch: biometria falhando/indisponível — sai da conta e volta pra
// tela de login normal (nome+PIN), sem meio-termo confuso. Precisa esconder
// a própria tela de bloqueio (z-index mais alto que o login-overlay) —
// senão fazerLogout() mostra o login por baixo, mas o cadeado continua
// cobrindo a tela por cima, travando quem clicou aqui sem saída visível.
function fluxaUsarOutroLogin(){
  localStorage.removeItem('fluxa_webauthn_cred');
  localStorage.removeItem('fluxa_webauthn_user');
  esconderTelaBloqueioBiometrico();
  if (typeof fazerLogout === 'function') fazerLogout();
  else location.reload();
}

// ─────────────────────────────────────────────────────────────────────────
// Atualização do app Android nativo (Capacitor) — 25/08
//
// O .apk leva o código "congelado" dentro dele desde a hora que foi
// compilado — diferente do site normal, que sempre busca a versão mais
// nova sozinho ao abrir (rede-primeiro, ver sw.js). Sem isso, toda
// correção no sistema exigiria a pessoa caçar o link no GitHub de novo e
// reinstalar. Aqui: só DENTRO do app instalado (nunca no site), confere
// um arquivo pequeno publicado junto do .apk (mesmo Release de sempre,
// endereço fixo) com o identificador do build mais recente; se for
// diferente do que está rodando agora, mostra um banner (mesmo shell
// visual do banner de instalar) com um botão que abre o download do .apk
// novo — a pessoa só confirma "Instalar" quando o Android perguntar, sem
// precisar ir atrás de link nenhum.
function fluxaEhAppNativo(){
  try{ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch(e){ return false; }
}
// Achado testando no emulador: publicar android-version.json como asset do
// Release não funciona pro app conferir sozinho — a CDN de assets do GitHub
// (release-assets.githubusercontent.com) não manda cabeçalho
// Access-Control-Allow-Origin, e fetch() de dentro do WebView é bloqueado
// por CORS (silencioso — só aparece no console, "Failed to fetch"). O
// workflow agora commita esse arquivo direto na branch `android-apk`, e
// raw.githubusercontent.com manda o cabeçalho certo — funciona.
const FORTHEMP_ANDROID_VERSION_URL = 'https://raw.githubusercontent.com/marcosssvinnn/fluxa-app/android-apk/android-version.json';
const FORTHEMP_ANDROID_APK_URL = 'https://github.com/marcosssvinnn/fluxa-app/releases/download/forthemp-android-latest/Forthemp.apk';
async function fluxaChecarAtualizacaoApp(){
  const _nativo = fluxaEhAppNativo();
  console.log('[fluxaChecarAtualizacaoApp] DIAG nativo='+_nativo+' build='+window.FORTHEMP_ANDROID_BUILD+' Capacitor='+(typeof window.Capacitor));
  if (!_nativo) return; // só faz sentido dentro do app instalado
  const buildAtual = window.FORTHEMP_ANDROID_BUILD || null;
  if (!buildAtual) return; // build sem o carimbo (ex.: instalado antes desta feature) — não sabe comparar, não incomoda
  try{
    const r = await fetch(FORTHEMP_ANDROID_VERSION_URL, { cache: 'no-store' });
    console.log('[fluxaChecarAtualizacaoApp] DIAG fetch ok='+r.ok+' status='+r.status);
    if (!r.ok) return;
    const info = await r.json();
    console.log('[fluxaChecarAtualizacaoApp] DIAG info='+JSON.stringify(info)+' buildAtual='+buildAtual);
    if (!info || !info.build || info.build === buildAtual) return; // já está na versão mais nova
    _fluxaMostrarBannerAtualizacao(info.apk_url || FORTHEMP_ANDROID_APK_URL);
    console.log('[fluxaChecarAtualizacaoApp] DIAG banner mostrado');
  }catch(e){ console.warn('[fluxaChecarAtualizacaoApp]', e?.message||e); }
}
function _fluxaMostrarBannerAtualizacao(apkUrl){
  const el = document.getElementById('android-update-banner');
  if (!el) return;
  const btn = document.getElementById('android-update-btn');
  if (btn) btn.onclick = () => window.open(apkUrl, '_system');
  el.classList.add('on');
}
function fluxaDispensarAtualizacao(){
  const el = document.getElementById('android-update-banner');
  if (el) el.classList.remove('on');
}
// Checa ao abrir e depois a cada 6h — o técnico pode deixar o app aberto
// o dia inteiro em campo; não precisa checar com mais frequência que isso.
fluxaChecarAtualizacaoApp();
setInterval(fluxaChecarAtualizacaoApp, 6*60*60*1000);
