/**
 * LAIFT · Anatomia 3D
 * state.js — State Manager
 *
 * Gerenciador de estado global imutável com:
 *   - dispatch(action) → novo state
 *   - subscribe(selector, callback) → observa fatias específicas
 *   - Middleware opcional (logger, persistence)
 *   - Persistência seletiva em localStorage
 *   - Batching para evitar re-renders
 *   - Snapshot / restore para undo
 */

import { bus, EVENTS } from './events.js';

/* ================================================================
   STATE INICIAL
   ================================================================ */
const INITIAL_STATE = {
  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  ui: {
    activePanel: 'info',       // info | timeline | agents | quiz
    activeLevel: 'macro',      // macro | meso | micro | nano
    activeViewport: 'three',   // three | mol
    modal: null,               // null | 'search'
    isMobile: false,
    isOnline: true,
    reducedMotion: false
  },

  // ---------------------------------------------------------------
  // Anatomia (Nível 1)
  // ---------------------------------------------------------------
  anatomy: {
    activeSystem: null,        // 'digestorio' | 'cardiovascular' | ...
    selectedMesh: null,
    hoveredMesh: null,
    visibleSystems: [],        // vazio = todos visíveis
    cameraTarget: null,        // { x, y, z }
    cameraTweening: false,
    loading: false,
    loaded: false,
    error: null,
    progress: 0                // 0..1 carregamento do modelo
  },

  // ---------------------------------------------------------------
  // Fisiologia (Nível 2)
  // ---------------------------------------------------------------
  physiology: {
    activeProcess: null,
    currentStep: 0,
    totalSteps: 0,
    isPlaying: false,
    playSpeed: 1,
    stepStartedAt: null,
    completed: false
  },

  // ---------------------------------------------------------------
  // Citologia (Nível 3)
  // ---------------------------------------------------------------
  micro: {
    activeCell: null,
    selectedOrganelle: null
  },

  // ---------------------------------------------------------------
  // Molecular (Nível 4)
  // ---------------------------------------------------------------
  molecular: {
    activePdbId: null,
    activeMoleculeName: null,
    activeSource: null,        // 'rcsb' | 'alphafold'
    viewerStyle: 'cartoon',    // cartoon | stick | sphere | surface
    loading: false,
    loaded: false,
    error: null,
    attachedDrug: null
  },

  // ---------------------------------------------------------------
  // Agentes (enzimas, fármacos, patógenos)
  // ---------------------------------------------------------------
  agents: {
    list: [],
    selectedId: null
  },

  // ---------------------------------------------------------------
  // Simulação farmacológica
  // ---------------------------------------------------------------
  drug: {
    activeDrugId: null,
    route: 'oral',             // oral | iv | sc | im | topical | inhaled
    doseMg: 0,
    nanotechnology: false,
    nanoType: null,            // liposome | polymeric | micelle | dendrimer | metallic
    targetLigand: null,        // folate | transferrin | antibody | none
    simulationRunning: false,
    results: null,
    curve: []                  // [{ t, concentration }]
  },

  // ---------------------------------------------------------------
  // Quiz
  // ---------------------------------------------------------------
  quiz: {
    questions: [],
    filteredIds: [],
    currentIndex: 0,
    answers: {},               // { questionId: optionIndex }
    score: 0,
    streak: 0,
    bestStreak: 0,
    answered: false,
    filter: { etapa: 1, submodulo: 'todos' },
    loaded: false
  },

  // ---------------------------------------------------------------
  // Dados carregados (JSON)
  // ---------------------------------------------------------------
  data: {
    sistemas: null,
    processos: null,
    enzimas: null,
    patogenos: null,
    farmacos: null
  },

  // ---------------------------------------------------------------
  // Usuário
  // ---------------------------------------------------------------
  user: {
    name: null,
    email: null,
    progress: {},
    lastSyncAt: null
  },

  // ---------------------------------------------------------------
  // Toasts (notificações)
  // ---------------------------------------------------------------
  toasts: []
};

/* ================================================================
   AÇÕES
   ================================================================ */
export const ACTIONS = Object.freeze({
  // UI
  UI_SET_PANEL: 'UI_SET_PANEL',
  UI_SET_LEVEL: 'UI_SET_LEVEL',
  UI_SET_VIEWPORT: 'UI_SET_VIEWPORT',
  UI_OPEN_MODAL: 'UI_OPEN_MODAL',
  UI_CLOSE_MODAL: 'UI_CLOSE_MODAL',
  UI_SET_MOBILE: 'UI_SET_MOBILE',
  UI_SET_ONLINE: 'UI_SET_ONLINE',
  UI_SET_REDUCED_MOTION: 'UI_SET_REDUCED_MOTION',

  // Anatomy
  ANATOMY_SET_SYSTEM: 'ANATOMY_SET_SYSTEM',
  ANATOMY_SET_SELECTED_MESH: 'ANATOMY_SET_SELECTED_MESH',
  ANATOMY_SET_HOVERED_MESH: 'ANATOMY_SET_HOVERED_MESH',
  ANATOMY_SET_VISIBLE_SYSTEMS: 'ANATOMY_SET_VISIBLE_SYSTEMS',
  ANATOMY_SET_CAMERA_TARGET: 'ANATOMY_SET_CAMERA_TARGET',
  ANATOMY_SET_CAMERA_TWEENING: 'ANATOMY_SET_CAMERA_TWEENING',
  ANATOMY_SET_LOADING: 'ANATOMY_SET_LOADING',
  ANATOMY_SET_LOADED: 'ANATOMY_SET_LOADED',
  ANATOMY_SET_ERROR: 'ANATOMY_SET_ERROR',
  ANATOMY_SET_PROGRESS: 'ANATOMY_SET_PROGRESS',
  ANATOMY_RESET: 'ANATOMY_RESET',

  // Physiology
  PHYSIO_SET_PROCESS: 'PHYSIO_SET_PROCESS',
  PHYSIO_SET_STEP: 'PHYSIO_SET_STEP',
  PHYSIO_SET_TOTAL: 'PHYSIO_SET_TOTAL',
  PHYSIO_SET_PLAYING: 'PHYSIO_SET_PLAYING',
  PHYSIO_SET_SPEED: 'PHYSIO_SET_SPEED',
  PHYSIO_SET_COMPLETED: 'PHYSIO_SET_COMPLETED',
  PHYSIO_RESET: 'PHYSIO_RESET',

  // Micro
  MICRO_SET_CELL: 'MICRO_SET_CELL',
  MICRO_SET_ORGANELLE: 'MICRO_SET_ORGANELLE',

  // Molecular
  MOL_SET_PDB: 'MOL_SET_PDB',
  MOL_SET_NAME: 'MOL_SET_NAME',
  MOL_SET_SOURCE: 'MOL_SET_SOURCE',
  MOL_SET_STYLE: 'MOL_SET_STYLE',
  MOL_SET_LOADING: 'MOL_SET_LOADING',
  MOL_SET_LOADED: 'MOL_SET_LOADED',
  MOL_SET_ERROR: 'MOL_SET_ERROR',
  MOL_SET_DRUG: 'MOL_SET_DRUG',
  MOL_RESET: 'MOL_RESET',

  // Agents
  AGENTS_SET_LIST: 'AGENTS_SET_LIST',
  AGENTS_SET_SELECTED: 'AGENTS_SET_SELECTED',

  // Drug
  DRUG_SET_ACTIVE: 'DRUG_SET_ACTIVE',
  DRUG_SET_ROUTE: 'DRUG_SET_ROUTE',
  DRUG_SET_DOSE: 'DRUG_SET_DOSE',
  DRUG_SET_NANO: 'DRUG_SET_NANO',
  DRUG_SET_NANO_TYPE: 'DRUG_SET_NANO_TYPE',
  DRUG_SET_LIGAND: 'DRUG_SET_LIGAND',
  DRUG_SET_RUNNING: 'DRUG_SET_RUNNING',
  DRUG_SET_RESULTS: 'DRUG_SET_RESULTS',
  DRUG_SET_CURVE: 'DRUG_SET_CURVE',
  DRUG_RESET: 'DRUG_RESET',

  // Quiz
  QUIZ_SET_QUESTIONS: 'QUIZ_SET_QUESTIONS',
  QUIZ_SET_FILTERED: 'QUIZ_SET_FILTERED',
  QUIZ_SET_INDEX: 'QUIZ_SET_INDEX',
  QUIZ_SET_ANSWER: 'QUIZ_SET_ANSWER',
  QUIZ_SET_SCORE: 'QUIZ_SET_SCORE',
  QUIZ_SET_STREAK: 'QUIZ_SET_STREAK',
  QUIZ_SET_BEST_STREAK: 'QUIZ_SET_BEST_STREAK',
  QUIZ_SET_ANSWERED: 'QUIZ_SET_ANSWERED',
  QUIZ_SET_FILTER: 'QUIZ_SET_FILTER',
  QUIZ_SET_LOADED: 'QUIZ_SET_LOADED',
  QUIZ_RESET: 'QUIZ_RESET',

  // Data
  DATA_SET_SISTEMAS: 'DATA_SET_SISTEMAS',
  DATA_SET_PROCESSOS: 'DATA_SET_PROCESSOS',
  DATA_SET_ENZIMAS: 'DATA_SET_ENZIMAS',
  DATA_SET_PATOGENOS: 'DATA_SET_PATOGENOS',
  DATA_SET_FARMACOS: 'DATA_SET_FARMACOS',

  // User
  USER_SET: 'USER_SET',
  USER_SET_PROGRESS: 'USER_SET_PROGRESS',
  USER_SET_LAST_SYNC: 'USER_SET_LAST_SYNC',

  // Toasts
  TOASTS_ADD: 'TOASTS_ADD',
  TOASTS_REMOVE: 'TOASTS_REMOVE',
  TOASTS_CLEAR: 'TOASTS_CLEAR'
});

/* ================================================================
   REDUCERS
   Cada reducer é puro: (state, action) → novoState
   ================================================================ */

function uiReducer(state = INITIAL_STATE.ui, action) {
  switch (action.type) {
    case ACTIONS.UI_SET_PANEL:
      return { ...state, activePanel: action.payload };
    case ACTIONS.UI_SET_LEVEL:
      return { ...state, activeLevel: action.payload };
    case ACTIONS.UI_SET_VIEWPORT:
      return { ...state, activeViewport: action.payload };
    case ACTIONS.UI_OPEN_MODAL:
      return { ...state, modal: action.payload };
    case ACTIONS.UI_CLOSE_MODAL:
      return { ...state, modal: null };
    case ACTIONS.UI_SET_MOBILE:
      return { ...state, isMobile: action.payload };
    case ACTIONS.UI_SET_ONLINE:
      return { ...state, isOnline: action.payload };
    case ACTIONS.UI_SET_REDUCED_MOTION:
      return { ...state, reducedMotion: action.payload };
    default:
      return state;
  }
}

function anatomyReducer(state = INITIAL_STATE.anatomy, action) {
  switch (action.type) {
    case ACTIONS.ANATOMY_SET_SYSTEM:
      return { ...state, activeSystem: action.payload };
    case ACTIONS.ANATOMY_SET_SELECTED_MESH:
      return { ...state, selectedMesh: action.payload };
    case ACTIONS.ANATOMY_SET_HOVERED_MESH:
      return { ...state, hoveredMesh: action.payload };
    case ACTIONS.ANATOMY_SET_VISIBLE_SYSTEMS:
      return { ...state, visibleSystems: action.payload };
    case ACTIONS.ANATOMY_SET_CAMERA_TARGET:
      return { ...state, cameraTarget: action.payload };
    case ACTIONS.ANATOMY_SET_CAMERA_TWEENING:
      return { ...state, cameraTweening: action.payload };
    case ACTIONS.ANATOMY_SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.ANATOMY_SET_LOADED:
      return { ...state, loaded: action.payload };
    case ACTIONS.ANATOMY_SET_ERROR:
      return { ...state, error: action.payload };
    case ACTIONS.ANATOMY_SET_PROGRESS:
      return { ...state, progress: action.payload };
    case ACTIONS.ANATOMY_RESET:
      return { ...INITIAL_STATE.anatomy };
    default:
      return state;
  }
}

function physiologyReducer(state = INITIAL_STATE.physiology, action) {
  switch (action.type) {
    case ACTIONS.PHYSIO_SET_PROCESS:
      return { ...state, activeProcess: action.payload, currentStep: 0, completed: false };
    case ACTIONS.PHYSIO_SET_STEP:
      return { ...state, currentStep: action.payload, stepStartedAt: Date.now() };
    case ACTIONS.PHYSIO_SET_TOTAL:
      return { ...state, totalSteps: action.payload };
    case ACTIONS.PHYSIO_SET_PLAYING:
      return { ...state, isPlaying: action.payload };
    case ACTIONS.PHYSIO_SET_SPEED:
      return { ...state, playSpeed: action.payload };
    case ACTIONS.PHYSIO_SET_COMPLETED:
      return { ...state, completed: action.payload, isPlaying: false };
    case ACTIONS.PHYSIO_RESET:
      return { ...INITIAL_STATE.physiology };
    default:
      return state;
  }
}

function microReducer(state = INITIAL_STATE.micro, action) {
  switch (action.type) {
    case ACTIONS.MICRO_SET_CELL:
      return { ...state, activeCell: action.payload };
    case ACTIONS.MICRO_SET_ORGANELLE:
      return { ...state, selectedOrganelle: action.payload };
    default:
      return state;
  }
}

function molecularReducer(state = INITIAL_STATE.molecular, action) {
  switch (action.type) {
    case ACTIONS.MOL_SET_PDB:
      return { ...state, activePdbId: action.payload };
    case ACTIONS.MOL_SET_NAME:
      return { ...state, activeMoleculeName: action.payload };
    case ACTIONS.MOL_SET_SOURCE:
      return { ...state, activeSource: action.payload };
    case ACTIONS.MOL_SET_STYLE:
      return { ...state, viewerStyle: action.payload };
    case ACTIONS.MOL_SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.MOL_SET_LOADED:
      return { ...state, loaded: action.payload };
    case ACTIONS.MOL_SET_ERROR:
      return { ...state, error: action.payload };
    case ACTIONS.MOL_SET_DRUG:
      return { ...state, attachedDrug: action.payload };
    case ACTIONS.MOL_RESET:
      return { ...INITIAL_STATE.molecular };
    default:
      return state;
  }
}

function agentsReducer(state = INITIAL_STATE.agents, action) {
  switch (action.type) {
    case ACTIONS.AGENTS_SET_LIST:
      return { ...state, list: action.payload };
    case ACTIONS.AGENTS_SET_SELECTED:
      return { ...state, selectedId: action.payload };
    default:
      return state;
  }
}

function drugReducer(state = INITIAL_STATE.drug, action) {
  switch (action.type) {
    case ACTIONS.DRUG_SET_ACTIVE:
      return { ...state, activeDrugId: action.payload };
    case ACTIONS.DRUG_SET_ROUTE:
      return { ...state, route: action.payload };
    case ACTIONS.DRUG_SET_DOSE:
      return { ...state, doseMg: action.payload };
    case ACTIONS.DRUG_SET_NANO:
      return { ...state, nanotechnology: action.payload };
    case ACTIONS.DRUG_SET_NANO_TYPE:
      return { ...state, nanoType: action.payload };
    case ACTIONS.DRUG_SET_LIGAND:
      return { ...state, targetLigand: action.payload };
    case ACTIONS.DRUG_SET_RUNNING:
      return { ...state, simulationRunning: action.payload };
    case ACTIONS.DRUG_SET_RESULTS:
      return { ...state, results: action.payload };
    case ACTIONS.DRUG_SET_CURVE:
      return { ...state, curve: action.payload };
    case ACTIONS.DRUG_RESET:
      return { ...INITIAL_STATE.drug };
    default:
      return state;
  }
}

function quizReducer(state = INITIAL_STATE.quiz, action) {
  switch (action.type) {
    case ACTIONS.QUIZ_SET_QUESTIONS:
      return { ...state, questions: action.payload };
    case ACTIONS.QUIZ_SET_FILTERED:
      return { ...state, filteredIds: action.payload, currentIndex: 0 };
    case ACTIONS.QUIZ_SET_INDEX:
      return { ...state, currentIndex: action.payload, answered: false };
    case ACTIONS.QUIZ_SET_ANSWER:
      return { ...state, answers: { ...state.answers, [action.payload.id]: action.payload.optionIndex } };
    case ACTIONS.QUIZ_SET_SCORE:
      return { ...state, score: action.payload };
    case ACTIONS.QUIZ_SET_STREAK:
      return { ...state, streak: action.payload };
    case ACTIONS.QUIZ_SET_BEST_STREAK:
      return { ...state, bestStreak: action.payload };
    case ACTIONS.QUIZ_SET_ANSWERED:
      return { ...state, answered: action.payload };
    case ACTIONS.QUIZ_SET_FILTER:
      return { ...state, filter: { ...state.filter, ...action.payload } };
    case ACTIONS.QUIZ_SET_LOADED:
      return { ...state, loaded: action.payload };
    case ACTIONS.QUIZ_RESET:
      return { ...INITIAL_STATE.quiz };
    default:
      return state;
  }
}

function dataReducer(state = INITIAL_STATE.data, action) {
  switch (action.type) {
    case ACTIONS.DATA_SET_SISTEMAS:   return { ...state, sistemas: action.payload };
    case ACTIONS.DATA_SET_PROCESSOS:  return { ...state, processos: action.payload };
    case ACTIONS.DATA_SET_ENZIMAS:    return { ...state, enzimas: action.payload };
    case ACTIONS.DATA_SET_PATOGENOS:  return { ...state, patogenos: action.payload };
    case ACTIONS.DATA_SET_FARMACOS:   return { ...state, farmacos: action.payload };
    default:
      return state;
  }
}

function userReducer(state = INITIAL_STATE.user, action) {
  switch (action.type) {
    case ACTIONS.USER_SET:
      return { ...state, ...action.payload };
    case ACTIONS.USER_SET_PROGRESS:
      return { ...state, progress: { ...state.progress, ...action.payload } };
    case ACTIONS.USER_SET_LAST_SYNC:
      return { ...state, lastSyncAt: action.payload };
    default:
      return state;
  }
}

function toastsReducer(state = INITIAL_STATE.toasts, action) {
  switch (action.type) {
    case ACTIONS.TOASTS_ADD:
      return [...state, action.payload];
    case ACTIONS.TOASTS_REMOVE:
      return state.filter((t) => t.id !== action.payload);
    case ACTIONS.TOASTS_CLEAR:
      return [];
    default:
      return state;
  }
}

/* ================================================================
   ROOT REDUCER
   ================================================================ */
function rootReducer(state = INITIAL_STATE, action) {
  return {
    ui: uiReducer(state.ui, action),
    anatomy: anatomyReducer(state.anatomy, action),
    physiology: physiologyReducer(state.physiology, action),
    micro: microReducer(state.micro, action),
    molecular: molecularReducer(state.molecular, action),
    agents: agentsReducer(state.agents, action),
    drug: drugReducer(state.drug, action),
    quiz: quizReducer(state.quiz, action),
    data: dataReducer(state.data, action),
    user: userReducer(state.user, action),
    toasts: toastsReducer(state.toasts, action)
  };
}

/* ================================================================
   STORE
   ================================================================ */
class Store {
  constructor(reducer, initialState, options = {}) {
    this._reducer = reducer;
    this._state = initialState;
    this._subscribers = new Map(); // id → { selector, callback, prevValue }
    this._idCounter = 0;
    this._batching = false;
    this._pendingActions = [];
    this._middleware = options.middleware || [];
    this._history = [];
    this._historyLimit = options.historyLimit ?? 30;
    this._persist = options.persist ?? null; // { key, paths: string[] }
    this._initialized = false;
  }

  getState() {
    return this._state;
  }

  /**
   * Dispatch síncrono. Ações em batch são enfileiradas.
   */
  dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new TypeError('[Store] action deve ter campo "type" string');
    }

    if (this._batching) {
      this._pendingActions.push(action);
      return this._state;
    }

    return this._applyAction(action);
  }

  /**
   * Inicia batch — múltiplos dispatches geram uma única notificação.
   */
  batch(fn) {
    this._batching = true;
    try {
      fn();
    } finally {
      this._batching = false;
      if (this._pendingActions.length > 0) {
        const actions = this._pendingActions.splice(0);
        // Aplica todas, notifica uma vez
        let nextState = this._state;
        for (const a of actions) {
          nextState = this._reducer(nextState, a);
        }
        this._setState(nextState, actions);
      }
    }
  }

  /**
   * Assina mudanças baseadas em um selector.
   * @param {Function} selector - (state) => slice
   * @param {Function} callback - (newVal, oldVal, state) => void
   * @param {Object} [options]
   * @param {boolean} [options.fireImmediately=false]
   * @returns {Function} unsubscribe
   */
  subscribe(selector, callback, options = {}) {
    if (typeof selector !== 'function' || typeof callback !== 'function') {
      throw new TypeError('[Store] subscribe requer selector e callback funções');
    }
    const id = ++this._idCounter;
    const entry = {
      selector,
      callback,
      prevValue: selector(this._state),
      isEqual: options.isEqual || defaultIsEqual
    };
    this._subscribers.set(id, entry);

    if (options.fireImmediately) {
      callback(entry.prevValue, entry.prevValue, this._state);
    }

    return () => this._subscribers.delete(id);
  }

  /**
   * Retorna função de conveniência para dispatch de ações tipadas.
   */
  action(type) {
    return (payload) => this.dispatch({ type, payload });
  }

  /**
   * Snapshot do estado (para undo/histórico).
   */
  snapshot() {
    this._history.push(deepClone(this._state));
    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }
  }

  /**
   * Restaura último snapshot.
   */
  restore() {
    const prev = this._history.pop();
    if (prev) {
      this._setState(prev, [{ type: '@@RESTORE' }]);
    }
    return prev;
  }

  /* --------------------------------------------------------------
     Internos
     -------------------------------------------------------------- */
  _applyAction(action) {
    // Aplica middleware
    let processed = action;
    for (const mw of this._middleware) {
      processed = mw(this, processed) || processed;
    }

    const prevState = this._state;
    const nextState = this._reducer(prevState, processed);

    if (nextState === prevState) {
      return prevState; // Sem mudança
    }

    this._setState(nextState, [processed]);
    return nextState;
  }

  _setState(newState, actions) {
    this._state = newState;

    // Notifica subscribers
    for (const [id, entry] of this._subscribers.entries()) {
      try {
        const newValue = entry.selector(this._state);
        if (!entry.isEqual(newValue, entry.prevValue)) {
          const oldValue = entry.prevValue;
          entry.prevValue = newValue;
          entry.callback(newValue, oldValue, this._state);
        }
      } catch (err) {
        console.error(`[Store] Erro em subscriber id=${id}:`, err);
      }
    }

    // Persiste
    if (this._persist && this._initialized) {
      this._persistState();
    }

    // Emite evento global
    bus.emit(EVENTS.STATE_CHANGED, {
      state: this._state,
      actions
    });
  }

  _persistState() {
    try {
      const { key, paths } = this._persist;
      const toSave = {};
      for (const path of paths) {
        const val = getPath(this._state, path);
        if (val !== undefined) setPath(toSave, path, val);
      }
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (err) {
      console.warn('[Store] Falha ao persistir:', err);
    }
  }

  _loadPersisted() {
    if (!this._persist) return;
    try {
      const raw = localStorage.getItem(this._persist.key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Aplica como merge suave
      this._state = deepMerge(this._state, parsed);
    } catch (err) {
      console.warn('[Store] Falha ao carregar persistência:', err);
    }
  }

  /**
   * Marca como inicializado (habilita persistência).
   */
  init() {
    this._loadPersisted();
    this._initialized = true;
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function defaultIsEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  // Shallow compare para objetos planos (performance)
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const k in obj) out[k] = deepClone(obj[k]);
  return out;
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const k in source) {
    if (
      source[k] &&
      typeof source[k] === 'object' &&
      !Array.isArray(source[k]) &&
      target[k] &&
      typeof target[k] === 'object'
    ) {
      out[k] = deepMerge(target[k], source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/* ================================================================
   MIDDLEWARES PRONTOS
   ================================================================ */

/**
 * Logger: imprime ações e diferenças no console.
 */
export function loggerMiddleware(store, action) {
  if (action.type.startsWith('@@')) return action;
  console.groupCollapsed(`%c[Action] ${action.type}`, 'color:#00e5ff;font-weight:bold');
  if (action.payload !== undefined) console.log('payload:', action.payload);
  console.log('prev:', store.getState());
  console.groupEnd();
  return action;
}

/**
 * Persistência automática: salva fatias específicas em localStorage.
 */
export function createPersistMiddleware(paths, storageKey = 'laift:state') {
  let scheduled = false;
  return (store, action) => {
    if (action.type.startsWith('@@')) return action;
    if (scheduled) return action;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      try {
        const data = {};
        for (const p of paths) {
          const v = getPath(store.getState(), p);
          if (v !== undefined) setPath(data, p, v);
        }
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (e) {
        console.warn('[Persist MW] Falha:', e);
      }
    });
    return action;
  };
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const store = new Store(rootReducer, INITIAL_STATE, {
  middleware: [
    // Descomentar em dev:
    // loggerMiddleware
  ],
  historyLimit: 30,
  persist: {
    key: 'laift:state:v1',
    paths: [
      'user',
      'quiz.filter',
      'ui.activeLevel'
    ]
  }
});

// Shortcuts
export const getState = () => store.getState();
export const dispatch = (action) => store.dispatch(action);

// Dev helpers
if (typeof window !== 'undefined') {
  window.__laiftStore = store;
  window.__laiftActions = ACTIONS;
}

export default store;
