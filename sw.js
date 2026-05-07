// Altere este número a cada novo deploy para forçar atualização em todos os dispositivos
const CACHE = 'fluxa-v3';

const URLS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
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

  const url = new URL(e.request.url);

  // index.html: sempre busca da rede (network-first) para garantir versão mais recente
  // Se offline, usa cache como fallback
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
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
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
