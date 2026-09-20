/**
 * LAIFT · Anatomia 3D
 * events.js — EventBus Pub/Sub
 *
 * Sistema de comunicação desacoplado entre módulos.
 * Suporta:
 *   - Listeners persistentes (on/off)
 *   - Listeners one-shot (once)
 *   - Wildcard namespacing (ex.: 'anatomy:*' captura 'anatomy:selected')
 *   - Prioridade numérica
 *   - Erro isolado (um listener falho não quebra os demais)
 *
 * @example
 *   import { bus, EVENTS } from './events.js';
 *   const off = bus.on(EVENTS.ANATOMY_SELECTED, (payload) => { ... });
 *   bus.emit(EVENTS.ANATOMY_SELECTED, { mesh: 'coracao' });
 *   off(); // unsubscribe
 */

/* ================================================================
   CONSTANTES — Todos os eventos do sistema
   ================================================================ */
export const EVENTS = Object.freeze({
  // ---------------------------------------------------------------
  // Ciclo de vida da aplicação
  // ---------------------------------------------------------------
  APP_READY: 'app:ready',
  APP_ERROR: 'app:error',
  APP_OFFLINE: 'app:offline',
  APP_ONLINE: 'app:online',

  // ---------------------------------------------------------------
  // Estado global (disparado pelo state.js)
  // ---------------------------------------------------------------
  STATE_CHANGED: 'state:changed',

  // ---------------------------------------------------------------
  // Navegação e roteamento
  // ---------------------------------------------------------------
  ROUTE_CHANGED: 'route:changed',
  ROUTE_NOT_FOUND: 'route:notFound',

  // ---------------------------------------------------------------
  // UI geral
  // ---------------------------------------------------------------
  UI_PANEL_CHANGED: 'ui:panelChanged',
  UI_LEVEL_CHANGED: 'ui:levelChanged',
  UI_VIEWPORT_TOGGLED: 'ui:viewportToggled',
  UI_MODAL_OPEN: 'ui:modalOpen',
  UI_MODAL_CLOSE: 'ui:modalClose',
  UI_TOAST: 'ui:toast',
  UI_RESIZE: 'ui:resize',

  // ---------------------------------------------------------------
  // Anatomia (Nível 1 - MACRO)
  // ---------------------------------------------------------------
  ANATOMY_LOADED: 'anatomy:loaded',
  ANATOMY_LOADING: 'anatomy:loading',
  ANATOMY_LOAD_ERROR: 'anatomy:loadError',
  ANATOMY_SYSTEM_SELECTED: 'anatomy:systemSelected',
  ANATOMY_MESH_CLICKED: 'anatomy:meshClicked',
  ANATOMY_MESH_HOVER: 'anatomy:meshHover',
  ANATOMY_CAMERA_RESET: 'anatomy:cameraReset',
  ANATOMY_LAYERS_CHANGED: 'anatomy:layersChanged',

  // ---------------------------------------------------------------
  // Fisiologia (Nível 2 - MESO)
  // ---------------------------------------------------------------
  PHYSIO_PROCESS_SELECTED: 'physio:processSelected',
  PHYSIO_STEP_CHANGED: 'physio:stepChanged',
  PHYSIO_PLAY: 'physio:play',
  PHYSIO_PAUSE: 'physio:pause',
  PHYSIO_RESET: 'physio:reset',
  PHYSIO_COMPLETED: 'physio:completed',

  // ---------------------------------------------------------------
  // Citologia (Nível 3 - MICRO)
  // ---------------------------------------------------------------
  MICRO_CELL_SELECTED: 'micro:cellSelected',
  MICRO_ORGANELLE_CLICKED: 'micro:organelleClicked',

  // ---------------------------------------------------------------
  // Molecular (Nível 4 - NANO)
  // ---------------------------------------------------------------
  MOL_LOADING: 'mol:loading',
  MOL_LOADED: 'mol:loaded',
  MOL_LOAD_ERROR: 'mol:loadError',
  MOL_STYLE_CHANGED: 'mol:styleChanged',
  MOL_RESIDUE_CLICKED: 'mol:residueClicked',

  // ---------------------------------------------------------------
  // Agentes (enzimas, fármacos, patógenos)
  // ---------------------------------------------------------------
  AGENT_SELECTED: 'agent:selected',
  AGENT_LIST_CHANGED: 'agent:listChanged',
  AGENT_DRUG_SELECTED: 'agent:drugSelected',

  // ---------------------------------------------------------------
  // Simulação farmacológica
  // ---------------------------------------------------------------
  DRUG_SIMULATION_START: 'drug:simulationStart',
  DRUG_SIMULATION_UPDATE: 'drug:simulationUpdate',
  DRUG_SIMULATION_END: 'drug:simulationEnd',
  DRUG_NANO_TOGGLED: 'drug:nanoToggled',
  DRUG_ROUTE_CHANGED: 'drug:routeChanged',

  // ---------------------------------------------------------------
  // Quiz
  // ---------------------------------------------------------------
  QUIZ_LOADED: 'quiz:loaded',
  QUIZ_FILTER_CHANGED: 'quiz:filterChanged',
  QUIZ_QUESTION_CHANGED: 'quiz:questionChanged',
  QUIZ_ANSWERED: 'quiz:answered',
  QUIZ_COMPLETED: 'quiz:completed',

  // ---------------------------------------------------------------
  // Busca
  // ---------------------------------------------------------------
  SEARCH_OPEN: 'search:open',
  SEARCH_CLOSE: 'search:close',
  SEARCH_QUERY: 'search:query',
  SEARCH_RESULTS: 'search:results',
  SEARCH_SELECT: 'search:select',

  // ---------------------------------------------------------------
  // Persistência / Backend
  // ---------------------------------------------------------------
  BACKEND_REQUEST: 'backend:request',
  BACKEND_RESPONSE: 'backend:response',
  BACKEND_ERROR: 'backend:error',
  SYNC_START: 'sync:start',
  SYNC_COMPLETE: 'sync:complete',
  SYNC_ERROR: 'sync:error'
});

/* ================================================================
   EventBus
   ================================================================ */
class EventBus {
  constructor() {
    /** @type {Map<string, Listener[]>} */
    this._listeners = new Map();
    /** @type {Map<string, Set<Function>>} Cache de wildcards ativos */
    this._wildcardCache = new Map();
    /** @type {boolean} Flag de debug */
    this.debug = false;
    /** @type {number} Contador de IDs para listeners */
    this._idCounter = 0;
  }

  /**
   * Registra um listener.
   * @param {string} eventName - Nome do evento (suporta '*' no final)
   * @param {Function} handler - Callback
   * @param {Object} [options]
   * @param {number} [options.priority=0] - Maior = chamado antes
   * @param {Object} [options.context] - `this` do handler
   * @returns {Function} Função de unsubscribe
   */
  on(eventName, handler, options = {}) {
    if (typeof eventName !== 'string' || !eventName) {
      throw new TypeError('[EventBus] eventName deve ser string não vazia');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('[EventBus] handler deve ser função');
    }

    const listener = {
      id: ++this._idCounter,
      handler,
      priority: options.priority ?? 0,
      context: options.context ?? null,
      once: false
    };

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }
    const list = this._listeners.get(eventName);
    list.push(listener);
    // Ordena por prioridade descendente (estável)
    list.sort((a, b) => b.priority - a.priority);

    // Invalida cache de wildcard
    this._wildcardCache.clear();

    if (this.debug) {
      console.log(`[EventBus] + ${eventName} (id=${listener.id})`);
    }

    return () => this.off(eventName, handler);
  }

  /**
   * Registra listener que se auto-remove após primeira execução.
   * @returns {Function} unsubscribe
   */
  once(eventName, handler, options = {}) {
    const wrapped = (payload) => {
      this.off(eventName, wrapped);
      handler(payload);
    };
    // Preserva referência para permitir off manual
    wrapped._original = handler;
    return this.on(eventName, wrapped, options);
  }

  /**
   * Remove um listener específico.
   */
  off(eventName, handler) {
    const list = this._listeners.get(eventName);
    if (!list) return false;

    const idx = list.findIndex(
      (l) => l.handler === handler || l.handler._original === handler
    );
    if (idx === -1) return false;

    list.splice(idx, 1);
    if (list.length === 0) {
      this._listeners.delete(eventName);
    }
    this._wildcardCache.clear();
    return true;
  }

  /**
   * Remove todos os listeners de um evento ou de todos.
   */
  clear(eventName) {
    if (eventName) {
      this._listeners.delete(eventName);
    } else {
      this._listeners.clear();
    }
    this._wildcardCache.clear();
  }

  /**
   * Emite um evento.
   * @param {string} eventName
   * @param {*} [payload]
   */
  emit(eventName, payload) {
    if (this.debug) {
      console.log(`[EventBus] → ${eventName}`, payload);
    }

    // 1) Listeners exatos
    const exact = this._listeners.get(eventName);
    if (exact) this._invoke(exact, eventName, payload);

    // 2) Listeners wildcard (ex.: 'anatomy:*')
    for (const [key, listeners] of this._listeners.entries()) {
      if (key === eventName) continue;
      if (key.endsWith('*')) {
        const prefix = key.slice(0, -1); // remove '*'
        if (eventName.startsWith(prefix)) {
          this._invoke(listeners, eventName, payload);
        }
      }
    }
  }

  /**
   * Executa listeners com isolamento de erro.
   * @private
   */
  _invoke(listeners, eventName, payload) {
    // Copia para permitir mutações durante iteração
    const snapshot = listeners.slice();
    for (const listener of snapshot) {
      try {
        listener.handler.call(listener.context, payload, eventName);
      } catch (err) {
        console.error(
          `[EventBus] Erro em listener de "${eventName}" (id=${listener.id}):`,
          err
        );
        // Não propaga — isola falha
      }
    }
  }

  /**
   * Aguarda um evento (Promise).
   * @param {string} eventName
   * @param {number} [timeoutMs=0] - 0 = sem timeout
   * @returns {Promise<*>}
   */
  waitFor(eventName, timeoutMs = 0) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const off = this.once(eventName, (payload) => {
        if (timer) clearTimeout(timer);
        resolve(payload);
      });
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          off();
          reject(new Error(`[EventBus] Timeout aguardando "${eventName}"`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Conta listeners de um evento.
   */
  count(eventName) {
    return (this._listeners.get(eventName) || []).length;
  }

  /**
   * Lista todos os eventos com listeners ativos.
   */
  activeEvents() {
    return Array.from(this._listeners.keys());
  }
}

/* ================================================================
   Singleton
   ================================================================ */
export const bus = new EventBus();

// Atalho opcional em dev
if (typeof window !== 'undefined') {
  window.__laiftBus = bus;
  window.__laiftEvents = EVENTS;
}

export default bus;
