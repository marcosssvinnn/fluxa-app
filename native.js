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
// banner de instalar (se ainda não instalado) — as fases seguintes (push,
// biometria) acrescentam outros estados aqui, nunca mais de um ao mesmo tempo.
function _fluxaAvaliarBannerInstalar(){
  const el = document.getElementById('pwa-install-banner');
  if (!el) return;

  if (!fluxaModoStandalone()){
    if (_pwaDismissAtivo()){ el.classList.remove('on'); return; }
    const plataforma = fluxaPlataforma();
    if (plataforma === 'desktop'){ el.classList.remove('on'); return; }
    if (plataforma === 'android' && !_fluxaInstallEvent){ el.classList.remove('on'); return; }
    const corpo = document.getElementById('pwa-install-body');
    const btn = document.getElementById('pwa-install-btn');
    if (plataforma === 'ios'){
      corpo.innerHTML = 'Toque em <b>⬆️ Compartilhar</b> e depois em <b>"Adicionar à Tela de Início"</b> pra abrir o Fluxa como app, com tela cheia.';
      btn.style.display = 'none';
      btn.onclick = null;
    } else {
      corpo.innerHTML = 'Instale o Fluxa como app pra abrir mais rápido, com tela cheia.';
      btn.style.display = '';
      btn.textContent = 'Instalar';
      btn.onclick = fluxaInstalarAgora;
    }
    el.classList.add('on');
    return;
  }

  el.classList.remove('on');
}
