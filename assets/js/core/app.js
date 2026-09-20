/**
 * LAIFT · Anatomia 3D
 * app.js — Bootstrap da aplicação
 *
 * Responsabilidades:
 *   - Registrar Service Worker
 *   - Detectar capacidades do dispositivo
 *   - Carregar dados iniciais (JSONs)
 *   - Inicializar módulos (Three, Quiz, Timeline, etc.)
 *   - Configurar atalhos de teclado globais
 *   - Gerenciar conexão online/offline
 *   - Conectar UI ↔ state ↔ router
 */

import { bus, EVENTS } from './events.js';
import { store, ACTIONS, getState, dispatch } from './state.js';
import { router, navigate } from './router.js';

/* ================================================================
   CONFIGURAÇÃO GLOBAL
   ================================================================ */
const CONFIG = Object.freeze({
  APP_NAME: 'LAIFT Anatomia 3D',
  VERSION: '1.0.0',
  DATA_PATHS: {
    sistemas: 'assets/data/sistemas_anatomicos.json',
    processos: 'assets/data/processos_fisiologicos.json',
    enzimas: 'assets/data/citologia_e_enzimas.json',
    patogenos: 'assets/data/patogenos_microbiologia.json',
    farmacos: 'assets/data/farmacos.json',
    questions: 'assets/data/questions.json'
  },
  MOBILE_BREAKPOINT: 768,
  DEBUG: false
});

/* ================================================================
   LOGGER
   ================================================================ */
const log = {
  info: (...args) => console.log('%c[LAIFT]', 'color:#00e5ff;font-weight:bold', ...args),
  warn: (...args) => console.warn('%c[LAIFT]', 'color:#ffb020;font-weight:bold', ...args),
  error: (...args) => console.error('%c[LAIFT]', 'color:#ff4757;font-weight:bold', ...args),
  debug: (...args) => CONFIG.DEBUG && console.log('%c[LAIFT·debug]', 'color:#7c5cff', ...args)
};

/* ================================================================
   CAPABILITY DETECTION
   ================================================================ */
function detectCapabilities() {
  const caps = {
    isMobile: window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`).matches,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    webgl: detectWebGL(),
    webgl2: detectWebGL2(),
    pwa: 'serviceWorker' in navigator,
    localStorage: (() => {
      try {
        localStorage.setItem('__test', '1');
        localStorage.removeItem('__test');
        return true;
      } catch {
        return false;
      }
    })(),
    online: navigator.onLine
  };
  log.debug('Capacidades:', caps);
  return caps;
}

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function detectWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/* ================================================================
   SERVICE WORKER
   ================================================================ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    log.warn('Service Worker não suportado');
    return null;
  }
  if (location.protocol === 'file:') {
    log.warn('Service Worker requer HTTPS ou localhost');
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './'
    });
    log.info('Service Worker registrado:', reg.scope);

    // Detecta atualizações
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('Nova versão disponível. Recarregue para atualizar.', 'info', 8000);
        }
      });
    });

    return reg;
  } catch (err) {
    log.warn('Falha ao registrar SW:', err);
    return null;
  }
}

/* ================================================================
   DATA LOADING
   ================================================================ */
async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`);
  return res.json();
}

async function loadAllData() {
  log.info('Carregando base de dados...');
  const results = await Promise.allSettled([
    loadJSON(CONFIG.DATA_PATHS.sistemas).then((d) => {
      dispatch({ type: ACTIONS.DATA_SET_SISTEMAS, payload: d });
      return ['sistemas', d];
    }),
    loadJSON(CONFIG.DATA_PATHS.processos).then((d) => {
      dispatch({ type: ACTIONS.DATA_SET_PROCESSOS, payload: d });
      return ['processos', d];
    }),
    loadJSON(CONFIG.DATA_PATHS.enzimas).then((d) => {
      dispatch({ type: ACTIONS.DATA_SET_ENZIMAS, payload: d });
      return ['enzimas', d];
    }),
    loadJSON(CONFIG.DATA_PATHS.patogenos).then((d) => {
      dispatch({ type: ACTIONS.DATA_SET_PATOGENOS, payload: d });
      return ['patogenos', d];
    }),
    loadJSON(CONFIG.DATA_PATHS.farmacos).then((d) => {
      dispatch({ type: ACTIONS.DATA_SET_FARMACOS, payload: d });
      return ['farmacos', d];
    }),
    loadJSON(CONFIG.DATA_PATHS.questions).then((d) => {
      const questions = Array.isArray(d) ? d : d.questions || [];
      dispatch({ type: ACTIONS.QUIZ_SET_QUESTIONS, payload: questions });
      dispatch({ type: ACTIONS.QUIZ_SET_LOADED, payload: true });
      return ['questions', questions];
    })
  ]);

  const summary = { success: 0, failed: 0 };
  for (const r of results) {
    if (r.status === 'fulfilled') {
      summary.success++;
      log.debug('Carregado:', r.value[0], Array.isArray(r.value[1]) ? `(${r.value[1].length} itens)` : '');
    } else {
      summary.failed++;
      log.warn('Falha ao carregar:', r.reason?.message);
    }
  }

  log.info(`Dados: ${summary.success} OK, ${summary.failed} falha(s)`);
  return summary;
}

/* ================================================================
   TOASTS
   ================================================================ */
let toastIdCounter = 0;
function showToast(message, type = 'info', durationMs = 3500) {
  const id = ++toastIdCounter;
  const toast = { id, message, type, createdAt: Date.now() };
  dispatch({ type: ACTIONS.TOASTS_ADD, payload: toast });

  // Auto-remove
  if (durationMs > 0) {
    setTimeout(() => {
      dispatch({ type: ACTIONS.TOASTS_REMOVE, payload: id });
    }, durationMs);
  }
  return id;
}

function mountToastContainer() {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const render = () => {
    const toasts = getState().toasts;
    // Diff mínimo: só re-renderiza se mudou
    if (container.children.length === toasts.length &&
        container.dataset.sig === toasts.map((t) => t.id).join(',')) {
      return;
    }
    container.dataset.sig = toasts.map((t) => t.id).join(',');
    container.innerHTML = toasts
      .map((t) => `<div class="toast ${t.type}" data-id="${t.id}">${escapeHtml(t.message)}</div>`)
      .join('');
  };

  store.subscribe((s) => s.toasts, render, { fireImmediately: true });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================================================================
   KEYBOARD SHORTCUTS
   ================================================================ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isInput = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);

    // Ctrl/Cmd + K → busca
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleSearch();
      return;
    }

    // Escape → fecha modal
    if (e.key === 'Escape') {
      const modal = getState().ui.modal;
      if (modal) {
        dispatch({ type: ACTIONS.UI_CLOSE_MODAL });
        return;
      }
    }

    // Ignora atalhos de tecla única em inputs
    if (isInput) return;

    // 1/2/3/4 → níveis de zoom
    if (['1', '2', '3', '4'].includes(e.key)) {
      const levels = ['macro', 'meso', 'micro', 'nano'];
      const idx = parseInt(e.key, 10) - 1;
      const level = levels[idx];
      if (level) {
        e.preventDefault();
        switch (level) {
          case 'macro': navigate.toMacro(); break;
          case 'meso': navigate.toMeso(); break;
          case 'micro': navigate.toMicro(); break;
          case 'nano': navigate.toNano(); break;
        }
      }
      return;
    }

    // R → reset câmera
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      bus.emit(EVENTS.ANATOMY_CAMERA_RESET);
      return;
    }

    // Espaço → play/pause do processo
    if (e.code === 'Space') {
      const { isPlaying, activeProcess } = getState().physiology;
      if (activeProcess) {
        e.preventDefault();
        bus.emit(isPlaying ? EVENTS.PHYSIO_PAUSE : EVENTS.PHYSIO_PLAY);
      }
    }
  });
}

/* ================================================================
   SEARCH MODAL
   ================================================================ */
function toggleSearch() {
  const modal = getState().ui.modal;
  if (modal === 'search') {
    closeSearch();
  } else {
    openSearch();
  }
}

function openSearch() {
  dispatch({ type: ACTIONS.UI_OPEN_MODAL, payload: 'search' });
  bus.emit(EVENTS.SEARCH_OPEN);
  // Focus no input
  requestAnimationFrame(() => {
    const input = document.getElementById('searchInput');
    input?.focus();
  });
}

function closeSearch() {
  dispatch({ type: ACTIONS.UI_CLOSE_MODAL });
  bus.emit(EVENTS.SEARCH_CLOSE);
}

function mountSearchModal() {
  const modal = document.getElementById('searchModal');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  const btnSearch = document.getElementById('btnSearch');

  if (!modal) return;

  btnSearch?.addEventListener('click', toggleSearch);

  // Fecha ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSearch();
  });

  // Fecha ao clicar no fundo
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn?.addEventListener('click', closeSearch);

  // Filtragem em tempo real (mock — será expandido em módulo próprio)
  input?.addEventListener('input', debounce((e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 2) {
      results.innerHTML = '<p class="empty-state">Digite pelo menos 2 caracteres...</p>';
      return;
    }
    performSearch(q, results);
  }, 180));

  // Estado do modal
  store.subscribe(
    (s) => s.ui.modal,
    (modalName) => {
      if (modalName === 'search') {
        modal.hidden = false;
      } else {
        modal.hidden = true;
      }
    },
    { fireImmediately: true }
  );
}

function performSearch(query, container) {
  // Busca simples em dados carregados (será enriquecida)
  const state = getState();
  const items = [];

  // Sistemas
  state.data.sistemas?.sistemas?.forEach((s) => {
    if (s.nome?.toLowerCase().includes(query) || s.sistema_id?.includes(query)) {
      items.push({ icon: '🫀', title: s.nome, sub: 'Sistema', route: `/macro/sistema/${s.sistema_id}` });
    }
    s.orgaos?.forEach((o) => {
      if (o.toLowerCase().includes(query)) {
        items.push({ icon: '🔍', title: capitalize(o), sub: `Órgão · ${s.nome}`, route: `/macro/sistema/${s.sistema_id}` });
      }
    });
  });

  // Processos
  state.data.processos?.processos?.forEach((p) => {
    if (p.processo_id?.includes(query)) {
      items.push({ icon: '⚡', title: p.processo_id, sub: 'Processo', route: `/meso/processo/${p.processo_id}` });
    }
  });

  // Enzimas
  state.data.enzimas?.itens?.forEach((e) => {
    if (e.nome?.toLowerCase().includes(query) || e.pdb_id?.toLowerCase().includes(query)) {
      items.push({ icon: '🧪', title: e.nome, sub: `PDB ${e.pdb_id}`, route: `/nano/pdb/${e.pdb_id}?nome=${encodeURIComponent(e.nome)}` });
    }
  });

  // Patógenos
  state.data.patogenos?.patogenos?.forEach((p) => {
    if (p.nome_cientifico?.toLowerCase().includes(query)) {
      items.push({ icon: '🦠', title: p.nome_cientifico, sub: p.classe, route: `/nano/pdb/${Object.values(p.pdb_alvo_terapeutico || {})[0] || '1CX2'}` });
    }
  });

  // Renderiza
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum resultado encontrado.</p>';
    return;
  }

  container.innerHTML = items
    .slice(0, 20)
    .map((it, i) => `
      <div class="search-result-item" data-route="${it.route}" tabindex="0">
        <span class="search-result-icon">${it.icon}</span>
        <div class="search-result-text">
          <span class="search-result-title">${escapeHtml(it.title)}</span>
          <span class="search-result-sub">${escapeHtml(it.sub)}</span>
        </div>
      </div>
    `)
    .join('');

  // Click handler
  container.querySelectorAll('.search-result-item').forEach((el) => {
    el.addEventListener('click', () => {
      const route = el.dataset.route;
      if (route) {
        closeSearch();
        router.go(route);
      }
    });
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ================================================================
   UI BINDINGS GERAIS
   ================================================================ */
function mountLevelBar() {
  const btns = document.querySelectorAll('.level-btn');
  if (!btns.length) return;

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      switch (level) {
        case 'macro': navigate.toMacro(); break;
        case 'meso': navigate.toMeso(); break;
        case 'micro': navigate.toMicro(); break;
        case 'nano': navigate.toNano(); break;
      }
    });
  });

  // Sincroniza visual com estado
  store.subscribe(
    (s) => s.ui.activeLevel,
    (level) => {
      btns.forEach((b) => {
        const active = b.dataset.level === level;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    },
    { fireImmediately: true }
  );
}

function mountPanelTabs() {
  const tabs = document.querySelectorAll('.panel-tab');
  const contents = document.querySelectorAll('.panel-content');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      dispatch({ type: ACTIONS.UI_SET_PANEL, payload: panel });
      bus.emit(EVENTS.UI_PANEL_CHANGED, { panel });
    });
  });

  store.subscribe(
    (s) => s.ui.activePanel,
    (panel) => {
      tabs.forEach((t) => {
        const active = t.dataset.panel === panel;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      contents.forEach((c) => {
        const active = c.dataset.panel === panel;
        c.classList.toggle('active', active);
        c.hidden = !active;
      });
    },
    { fireImmediately: true }
  );
}

function mountViewportToggle() {
  const btn = document.getElementById('btnToggleViewport');
  if (!btn) return;

  const threeVp = document.getElementById('threeViewport');
  const molVp = document.getElementById('molViewport');

  btn.addEventListener('click', () => {
    const current = getState().ui.activeViewport;
    const next = current === 'three' ? 'mol' : 'three';
    dispatch({ type: ACTIONS.UI_SET_VIEWPORT, payload: next });
    bus.emit(EVENTS.UI_VIEWPORT_TOGGLED, { viewport: next });
  });

  store.subscribe(
    (s) => s.ui.activeViewport,
    (vp) => {
      threeVp.dataset.active = vp === 'three' ? 'true' : 'false';
      molVp.dataset.active = vp === 'mol' ? 'true' : 'false';
      threeVp.setAttribute('aria-hidden', vp !== 'three');
      molVp.setAttribute('aria-hidden', vp !== 'mol');
    },
    { fireImmediately: true }
  );
}

function mountResetCamera() {
  const btn = document.getElementById('btnResetCamera');
  btn?.addEventListener('click', () => {
    bus.emit(EVENTS.ANATOMY_CAMERA_RESET);
    showToast('Câmera resetada', 'success', 1500);
  });
}

function mountOnlineStatus() {
  const update = (online) => {
    dispatch({ type: ACTIONS.UI_SET_ONLINE, payload: online });
    bus.emit(online ? EVENTS.APP_ONLINE : EVENTS.APP_OFFLINE);
    if (!online) showToast('Você está offline — usando cache local', 'warning', 4000);
  };
  window.addEventListener('online', () => update(true));
  window.addEventListener('offline', () => update(false));
  update(navigator.onLine);
}

function mountResponsiveDetection() {
  const mq = window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`);
  const update = () => {
    dispatch({ type: ACTIONS.UI_SET_MOBILE, payload: mq.matches });
  };
  mq.addEventListener('change', update);
  update();

  // Reduz motion
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateRM = () => dispatch({ type: ACTIONS.UI_SET_REDUCED_MOTION, payload: rmq.matches });
  rmq.addEventListener('change', updateRM);
  updateRM();
}

function mountMobileNav() {
  const btns = document.querySelectorAll('.mobile-nav-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      btns.forEach((b) => b.classList.toggle('active', b === btn));
      switch (target) {
        case 'viewer':
          navigate.toMacro();
          break;
        case 'processes':
          navigate.toMeso();
          break;
        case 'quiz':
          navigate.toQuiz();
          break;
        case 'search':
          openSearch();
          break;
      }
    });
  });
}

/* ================================================================
   UTILS
   ================================================================ */
function debounce(fn, waitMs = 150) {
  let t = null;
  return function (...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), waitMs);
  };
}

/* ================================================================
   BOOTSTRAP
   ================================================================ */
async function bootstrap() {
  log.info(`Iniciando ${CONFIG.APP_NAME} v${CONFIG.VERSION}`);

  try {
    // 1) Detecta capacidades
    const caps = detectCapabilities();
    if (caps.isMobile) dispatch({ type: ACTIONS.UI_SET_MOBILE, payload: true });
    if (caps.reducedMotion) dispatch({ type: ACTIONS.UI_SET_REDUCED_MOTION, payload: true });

    // 2) Monta componentes de UI sempre presentes
    mountLevelBar();
    mountPanelTabs();
    mountViewportToggle();
    mountResetCamera();
    mountToastContainer();
    mountSearchModal();
    mountMobileNav();
    mountOnlineStatus();
    mountResponsiveDetection();

    // 3) Setup atalhos de teclado
    setupKeyboardShortcuts();

    // 4) Service Worker (assíncrono, não bloqueia)
    registerServiceWorker().catch((err) => log.warn('SW:', err));

    // 5) Carrega dados (paralelo)
    await loadAllData();

    // 6) Inicia router (último)
    router.start();

    // 7) Marca store como inicializado (habilita persistência)
    store.init();

    // 8) Sinaliza app pronto
    bus.emit(EVENTS.APP_READY, {
      version: CONFIG.VERSION,
      capabilities: caps
    });

    log.info('✅ Aplicação pronta');
    showToast('Bem-vindo à LAIFT Anatomia 3D', 'success', 3000);

  } catch (err) {
    log.error('Falha no bootstrap:', err);
    bus.emit(EVENTS.APP_ERROR, { phase: 'bootstrap', error: err });

    // Fallback visual
    const main = document.getElementById('threeCanvasWrapper');
    if (main) {
      main.innerHTML = `
        <div style="padding:2rem;text-align:center;color:#ff4757;">
          <h2>Erro ao iniciar</h2>
          <p>${escapeHtml(err.message || String(err))}</p>
          <button onclick="location.reload()" style="margin-top:1rem;padding:0.75rem 1.5rem;background:#00e5ff;color:#0b0e14;border:none;border-radius:8px;font-weight:600;cursor:pointer;">
            Recarregar
          </button>
        </div>
      `;
    }
  }
}

/* ================================================================
   INICIALIZAÇÃO
   ================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

/* ================================================================
   EXPORTS (dev / testes)
   ================================================================ */
export { CONFIG, showToast, log };
