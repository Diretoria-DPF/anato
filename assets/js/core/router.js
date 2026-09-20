/**
 * LAIFT · Anatomia 3D
 * router.js — SPA Hash Router
 *
 * Sistema de roteamento baseado em hash (#/) que:
 *   - Sincroniza URL ↔ state global
 *   - Suporta params dinâmicos (:id)
 *   - Aplica guards (beforeEach)
 *   - Intercepta cliques em <a href="#/...">
 *   - Emite eventos para outros módulos
 *
 * Rotas registradas:
 *   #/                             → macro (padrão)
 *   #/macro                        → nível 1
 *   #/macro/sistema/:sistemaId     → sistema selecionado
 *   #/macro/estrutura/:meshName    → mesh específica
 *   #/meso                         → nível 2
 *   #/meso/processo/:processoId    → processo selecionado
 *   #/micro                        → nível 3
 *   #/micro/celula/:celulaId       → célula específica
 *   #/nano                         → nível 4
 *   #/nano/pdb/:pdbId              → estrutura molecular
 *   #/quiz                         → quiz
 *   #/quiz/etapa/:etapa            → quiz por etapa
 *   #/perfil                       → perfil
 */

import { bus, EVENTS } from './events.js';
import { store, ACTIONS, getState, dispatch } from './state.js';

/* ================================================================
   ROUTER
   ================================================================ */
class Router {
  constructor() {
    this._routes = [];
    this._guards = [];
    this._current = null;
    this._notFoundHandler = null;
    this._started = false;
    this._suppressNext = false;

    // Bind
    this._onHashChange = this._onHashChange.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  /* --------------------------------------------------------------
     Registro de rotas
     -------------------------------------------------------------- */
  /**
   * @param {string} pattern - ex.: '/macro/sistema/:sistemaId'
   * @param {Function} handler - ({ params, query }) => void
   * @param {Object} [options]
   * @param {string} [options.name] - nome da rota
   * @param {number} [options.priority=0]
   */
  add(pattern, handler, options = {}) {
    const { regex, keys } = compilePattern(pattern);
    this._routes.push({
      pattern,
      regex,
      keys,
      handler,
      name: options.name || pattern,
      priority: options.priority ?? 0
    });
    // Ordena por prioridade (maior primeiro) e depois por especificidade
    this._routes.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.keys.length - a.keys.length;
    });
    return this;
  }

  /**
   * Handler global de rota não encontrada.
   */
  notFound(handler) {
    this._notFoundHandler = handler;
    return this;
  }

  /**
   * Guard executado antes de cada navegação.
   * Se retornar string, redireciona para ela.
   */
  beforeEach(guard) {
    this._guards.push(guard);
    return this;
  }

  /* --------------------------------------------------------------
     Navegação
     -------------------------------------------------------------- */
  /**
   * Navega para um caminho.
   * @param {string} path - ex.: '/macro/sistema/digestorio'
   * @param {Object} [options]
   * @param {boolean} [options.replace=false]
   */
  go(path, options = {}) {
    const hash = '#' + normalizePath(path);
    if (location.hash === hash) {
      // Força re-render
      this._onHashChange();
      return;
    }
    this._suppressNext = true;
    if (options.replace) {
      history.replaceState(null, '', hash);
      this._onHashChange();
    } else {
      location.hash = hash;
    }
  }

  back() {
    history.back();
  }

  forward() {
    history.forward();
  }

  /**
   * Retorna rota atual.
   */
  getCurrent() {
    return this._current;
  }

  /**
   * URL atual como string.
   */
  currentPath() {
    return normalizePath(location.hash.replace(/^#/, ''));
  }

  /* --------------------------------------------------------------
     Ciclo de vida
     -------------------------------------------------------------- */
  start() {
    if (this._started) return;
    this._started = true;

    window.addEventListener('hashchange', this._onHashChange);
    document.addEventListener('click', this._onClick, true);

    // Navega para rota inicial se hash vazio
    if (!location.hash) {
      this.go('/', { replace: true });
    } else {
      this._onHashChange();
    }
  }

  stop() {
    window.removeEventListener('hashchange', this._onHashChange);
    document.removeEventListener('click', this._onClick, true);
    this._started = false;
  }

  /* --------------------------------------------------------------
     Handlers internos
     -------------------------------------------------------------- */
  _onHashChange() {
    if (this._suppressNext) {
      this._suppressNext = false;
    }

    const rawHash = location.hash.replace(/^#/, '') || '/';
    const [path, queryStr] = rawHash.split('?');
    const normalized = normalizePath(path);
    const query = parseQuery(queryStr);

    // Aplica guards
    for (const guard of this._guards) {
      const result = guard({ path: normalized, query, current: this._current });
      if (typeof result === 'string') {
        this.go(result, { replace: true });
        return;
      }
      if (result === false) {
        return; // Cancela navegação
      }
    }

    // Encontra rota
    const matched = this._match(normalized);
    if (!matched) {
      if (this._notFoundHandler) {
        this._notFoundHandler({ path: normalized, query });
        bus.emit(EVENTS.ROUTE_NOT_FOUND, { path: normalized, query });
      } else {
        console.warn(`[Router] Rota não encontrada: ${normalized}`);
      }
      return;
    }

    this._current = {
      path: normalized,
      query,
      pattern: matched.route.pattern,
      name: matched.route.name,
      params: matched.params,
      at: Date.now()
    };

    // Executa handler com isolamento de erro
    try {
      matched.route.handler({
        params: matched.params,
        query,
        path: normalized
      });
    } catch (err) {
      console.error(`[Router] Erro no handler de "${matched.route.pattern}":`, err);
      bus.emit(EVENTS.APP_ERROR, { source: 'router', error: err });
    }

    bus.emit(EVENTS.ROUTE_CHANGED, this._current);
  }

  _onClick(event) {
    // Ignora cliques modificados
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('#/')) return;

    // Ignora links externos
    if (anchor.target && anchor.target !== '_self') return;

    event.preventDefault();
    const path = href.slice(1); // remove '#'
    this.go(path);
  }

  _match(path) {
    for (const route of this._routes) {
      const m = route.regex.exec(path);
      if (!m) continue;
      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(m[i + 1]);
      });
      return { route, params };
    }
    return null;
  }
}

/* ================================================================
   HELPERS
   ================================================================ */

/**
 * Compila padrão de rota em regex + lista de keys.
 */
function compilePattern(pattern) {
  const keys = [];
  const regexStr = pattern
    .replace(/\/$/, '')
    .replace(/\/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => {
      keys.push(key);
      return '/([^/]+)';
    })
    .replace(/\//g, '\\/');
  return {
    regex: new RegExp('^' + regexStr + '\\/?$'),
    keys
  };
}

/**
 * Normaliza path: remove barras duplicadas, garante início com '/'.
 */
function normalizePath(path) {
  if (!path) return '/';
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function parseQuery(str) {
  const query = {};
  if (!str) return query;
  for (const pair of str.split('&')) {
    const [k, v = ''] = pair.split('=');
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return query;
}

/* ================================================================
   ROTAS DO SISTEMA
   ================================================================ */
export const router = new Router();

router
  // ---------------------------------------------------------------
  // MACRO (Nível 1)
  // ---------------------------------------------------------------
  .add('/', ({ }) => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'macro' });
    dispatch({ type: ACTIONS.ANATOMY_SET_SYSTEM, payload: null });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'info' });
  }, { name: 'home', priority: -10 })

  .add('/macro', () => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'macro' });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'info' });
  }, { name: 'macro' })

  .add('/macro/sistema/:sistemaId', ({ params }) => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'macro' });
    dispatch({ type: ACTIONS.ANATOMY_SET_SYSTEM, payload: params.sistemaId });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'info' });
    bus.emit(EVENTS.ANATOMY_SYSTEM_SELECTED, { sistemaId: params.sistemaId });
  }, { name: 'macro-sistema' })

  .add('/macro/estrutura/:meshName', ({ params }) => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'macro' });
    dispatch({ type: ACTIONS.ANATOMY_SET_SELECTED_MESH, payload: params.meshName });
    bus.emit(EVENTS.ANATOMY_MESH_CLICKED, { mesh: params.meshName });
  }, { name: 'macro-estrutura' })

  // ---------------------------------------------------------------
  // MESO (Nível 2)
  // ---------------------------------------------------------------
  .add('/meso', () => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'meso' });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'timeline' });
  }, { name: 'meso' })

  .add('/meso/processo/:processoId', ({ params, query }) => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'meso' });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'timeline' });
    dispatch({ type: ACTIONS.PHYSIO_SET_PROCESS, payload: params.processoId });
    const step = query.etapa ? parseInt(query.etapa, 10) : 0;
    dispatch({ type: ACTIONS.PHYSIO_SET_STEP, payload: step });
    bus.emit(EVENTS.PHYSIO_PROCESS_SELECTED, { processoId: params.processoId, step });
  }, { name: 'meso-processo' })

  // ---------------------------------------------------------------
  // MICRO (Nível 3)
  // ---------------------------------------------------------------
  .add('/micro', () => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'micro' });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'info' });
  }, { name: 'micro' })

  .add('/micro/celula/:celulaId', ({ params }) => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'micro' });
    dispatch({ type: ACTIONS.MICRO_SET_CELL, payload: params.celulaId });
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'info' });
    bus.emit(EVENTS.MICRO_CELL_SELECTED, { celulaId: params.celulaId });
  }, { name: 'micro-celula' })

  // ---------------------------------------------------------------
  // NANO (Nível 4)
  // ---------------------------------------------------------------
  .add('/nano', () => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'nano' });
    dispatch({ type: ACTIONS.UI_SET_VIEWPORT, payload: 'mol' });
  }, { name: 'nano' })

  .add('/nano/pdb/:pdbId', ({ params, query }) => {
    dispatch({ type: ACTIONS.UI_SET_LEVEL, payload: 'nano' });
    dispatch({ type: ACTIONS.UI_SET_VIEWPORT, payload: 'mol' });
    dispatch({ type: ACTIONS.MOL_SET_PDB, payload: params.pdbId.toUpperCase() });
    if (query.nome) {
      dispatch({ type: ACTIONS.MOL_SET_NAME, payload: query.nome });
    }
    bus.emit(EVENTS.MOL_LOADED, { pdbId: params.pdbId });
  }, { name: 'nano-pdb', priority: 5 })

  // ---------------------------------------------------------------
  // QUIZ
  // ---------------------------------------------------------------
  .add('/quiz', ({ query }) => {
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'quiz' });
    if (query.etapa) {
      dispatch({
        type: ACTIONS.QUIZ_SET_FILTER,
        payload: { etapa: parseInt(query.etapa, 10) }
      });
    }
  }, { name: 'quiz' })

  .add('/quiz/etapa/:etapa', ({ params }) => {
    dispatch({ type: ACTIONS.UI_SET_PANEL, payload: 'quiz' });
    dispatch({
      type: ACTIONS.QUIZ_SET_FILTER,
      payload: { etapa: parseInt(params.etapa, 10) }
    });
    bus.emit(EVENTS.QUIZ_FILTER_CHANGED, { etapa: params.etapa });
  }, { name: 'quiz-etapa' })

  // ---------------------------------------------------------------
  // FALLBACK
  // ---------------------------------------------------------------
  .notFound(({ path }) => {
    console.warn(`[Router] Rota desconhecida: ${path}. Redirecionando para home.`);
    router.go('/', { replace: true });
  });

/* ================================================================
   NAVEGAÇÃO PROGRAMÁTICA
   ================================================================ */
export const navigate = {
  toHome: () => router.go('/'),
  toMacro: (sistemaId) =>
    router.go(sistemaId ? `/macro/sistema/${sistemaId}` : '/macro'),
  toMeso: (processoId, step = 0) =>
    router.go(processoId ? `/meso/processo/${processoId}?etapa=${step}` : '/meso'),
  toMicro: (celulaId) =>
    router.go(celulaId ? `/micro/celula/${celulaId}` : '/micro'),
  toNano: (pdbId, nome) =>
    router.go(pdbId ? `/nano/pdb/${pdbId}${nome ? `?nome=${encodeURIComponent(nome)}` : ''}` : '/nano'),
  toQuiz: (etapa) =>
    router.go(etapa ? `/quiz/etapa/${etapa}` : '/quiz'),
  back: () => router.back()
};

export default router;
