/**
 * LAIFT · Service Worker
 * Estratégia:
 *   - Assets locais: cache-first (funciona offline)
 *   - APIs externas: network-first com fallback para cache
 *   - Modelos 3D pesados: cache sob demanda
 */

const CACHE_NAME = 'laift-v1.0.0';
const RUNTIME_CACHE = 'laift-runtime-v1.0.0';

/* ----------------------------------------------------------------
   Assets críticos pré-cacheados na instalação
   ---------------------------------------------------------------- */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',

  // CSS
  './assets/css/main.css',
  './assets/css/sistema-selector.css',
  './assets/css/three-viewport.css',
  './assets/css/mol-viewport.css',
  './assets/css/timeline.css',
  './assets/css/quiz.css',
  './assets/css/mobile-nav.css',

  // JS Core
  './assets/js/core/app.js',
  './assets/js/core/state.js',
  './assets/js/core/events.js',
  './assets/js/core/router.js',

  // JS Módulos
  './assets/js/three/scene.js',
  './assets/js/three/mesh-loader.js',
  './assets/js/three/layers.js',
  './assets/js/three/camera-tween.js',
  './assets/js/three/raycasting.js',
  './assets/js/three/particles.js',
  './assets/js/molecular/viewer.js',
  './assets/js/molecular/pdb-loader.js',
  './assets/js/timeline/engine.js',
  './assets/js/timeline/processes/degluticao.js',
  './assets/js/quiz/engine.js',
  './assets/js/drug/simulator.js',
  './assets/js/api/gas-client.js',
  './assets/js/api/pdb-client.js',

  // Dados
  './assets/data/sistemas_anatomicos.json',
  './assets/data/processos_fisiologicos.json',
  './assets/data/citologia_e_enzimas.json',
  './assets/data/patogenos_microbiologia.json',
  './assets/data/questions.json',

  // Ícones
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon.ico'
];

/* ----------------------------------------------------------------
   Install — pré-cacheia assets críticos
   ---------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cacheando assets críticos');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Falha parcial no pré-cache:', err);
      });
    })
  );
  self.skipWaiting();
});

/* ----------------------------------------------------------------
   Activate — limpa caches antigos
   ---------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

/* ----------------------------------------------------------------
   Fetch — estratégias por tipo de recurso
   ---------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET e extensões de browser
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // 1) APIs externas: network-first
  if (isExternalAPI(url)) {
    event.respondWith(networkFirstWithCache(request, RUNTIME_CACHE));
    return;
  }

  // 2) Modelos 3D pesados (.glb): cache sob demanda
  if (url.pathname.endsWith('.glb') || url.pathname.endsWith('.gltf')) {
    event.respondWith(cacheFirstWithRuntime(request, RUNTIME_CACHE));
    return;
  }

  // 3) Assets locais: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // 4) Fallback padrão
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

/* ----------------------------------------------------------------
   Estratégias
   ---------------------------------------------------------------- */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Falha no fetch (offline):', request.url);
    return caches.match('./index.html');
  }
}

async function cacheFirstWithRuntime(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Recurso pesado offline:', request.url);
    throw err;
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */
function isExternalAPI(url) {
  const apiHosts = [
    'script.google.com',
    'data.rcsb.org',
    'www.ebi.ac.uk',
    'pubchem.ncbi.nlm.nih.gov',
    'api.fda.gov',
    'dgidb.org',
    'reactome.org',
    'eutils.ncbi.nlm.nih.gov',
    'alphafold.ebi.ac.uk'
  ];
  return apiHosts.some((host) => url.hostname.includes(host));
}

/* ----------------------------------------------------------------
   Message handler (para o app pedir skipWaiting)
   ---------------------------------------------------------------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
