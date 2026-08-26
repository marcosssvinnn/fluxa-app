// Altere este número a cada novo deploy para forçar atualização em todos os dispositivos
// (não é mais obrigatório: o index.html detecta novas versões sozinho via ETag/Last-Modified)
const CACHE = 'fluxa-v239';

const URLS = [
  'libs/supabase.min.js',
  'libs/emailjs.min.js',
  'libs/html2pdf.bundle.min.js',
  'libs/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap',
  // App de celular (Fase A, porte do FluxaSaas-/v2)
  'manifest.json',
  'native.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/favicon-16.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS).catch(() => {}))
  );
  self.skipWaiting(); // assume controle imediatamente
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => {
        // Avisa todas as abas abertas que há nova versão
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => {
            clients.forEach(c => c.postMessage({ type: 'NEW_VERSION' }));
          });
      })
  );
  self.clients.claim(); // assume controle de todas as abas
});

self.addEventListener('fetch', e => {
  // Supabase API: sempre usa a rede, nunca cacheia
  if (e.request.url.includes('supabase.co')) return;

  // Checagem de versão do app Android (native.js, fluxaChecarAtualizacaoApp):
  // sempre precisa da resposta mais recente pra saber se existe build novo —
  // cache-first aqui faria o aviso de atualização nunca aparecer (achado
  // testando de verdade: a 1ª resposta ficava presa pra sempre).
  if (e.request.url.includes('githubusercontent.com')) return;

  const url = new URL(e.request.url);

  // index.html, app.js e styles.css: network-first para garantir a versão mais
  // recente a cada deploy (o app é único e precisa estar sempre em sincronia).
  // Se offline, usa o cache como fallback.
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')
      || url.pathname.endsWith('/app.js') || url.pathname.endsWith('/styles.css')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(res => {
          // Cache API só aceita request GET — o detector de versão nova
          // (_verificarVersaoApp, a cada 60s) faz HEAD nesse mesmo caminho
          // pra checar ETag sem baixar o arquivo inteiro, e caía aqui: c.put
          // lançava "Request method 'HEAD' is unsupported", sem catch, toda
          // vez que rodava — silencioso pro usuário, mas martelando o console.
          if (res.ok && e.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais recursos: cache-first com atualização em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ── Web Push (App de celular, Fase C/D) ──
// Payload enviado pela Edge Function enviar-push: { title, body, url }.

// Grava no IndexedDB — é a única forma confiável de persistir isto aqui: o
// Service Worker pode rodar sem nenhuma aba do Fluxa aberta (localStorage/
// página não servem). O sino de notificações (getNotificacoes(), app.js)
// lê daqui pra mostrar avisos de push junto com os alertas de sistema já
// existentes — Fase D não cria um painel separado, integra no que já tinha.
function _swSalvarNotificacao(data){
  return new Promise(resolve => {
    const req = indexedDB.open('fluxa-notificacoes', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('notificacoes')) db.createObjectStore('notificacoes', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('notificacoes', 'readwrite');
      tx.objectStore('notificacoes').add({ title: data.title, body: data.body, url: data.url, recebidaEm: Date.now(), lida: false });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

self.addEventListener('push', e => {
  let data = { title: 'Fluxa', body: 'Você tem uma notificação nova.', url: '/' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { url: data.url || '/' },
      }),
      _swSalvarNotificacao(data),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
        clientsArr.forEach(c => c.postMessage({ type: 'FLUXA_NOTIF_NOVA' }));
      }),
    ])
  );
});

// Clique na notificação: foca uma aba já aberta do Fluxa, ou abre uma nova.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      const existente = clientsArr.find(c => 'focus' in c);
      if (existente) { existente.navigate(url).catch(() => {}); return existente.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
