/**
 * LAIFT · Anatomia 3D
 * three/camera-tween.js — Transições suaves de câmera
 *
 * Responsável por:
 *   - Tween de posição e target da câmera
 *   - Easing configurável
 *   - Fila de tweens (não sobrepõe animações)
 *   - Cancelamento
 */

import * as THREE from 'three';
import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS } from '../core/state.js';
import { scene3D } from './scene.js';

/* ================================================================
   EASING
   ================================================================ */
export const Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) =>
    t === 0 ? 0 :
    t === 1 ? 1 :
    t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 :
    (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }
};

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class CameraTween {
  constructor() {
    this._current = null;
    this._queue = [];
    this._running = false;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return this;
    scene3D.registerUpdatable({ update: (dt) => this._update(dt) });
    this._initialized = true;
    return this;
  }

  /**
   * Executa tween da câmera.
   * @param {Object} opts
   * @param {{x,y,z}} opts.position - destino da posição
   * @param {{x,y,z}} [opts.target] - destino do target (lookAt)
   * @param {number} [opts.duration=1000]
   * @param {string|Function} [opts.easing='easeInOutCubic']
   * @param {Function} [opts.onComplete]
   * @param {boolean} [opts.chain=false] - se true, aguarda fila
   */
  tween(opts) {
    const task = {
      position: opts.position ? new THREE.Vector3(opts.position.x, opts.position.y, opts.position.z) : null,
      target: opts.target ? new THREE.Vector3(opts.target.x, opts.target.y, opts.target.z) : null,
      duration: opts.duration ?? 1000,
      easing: typeof opts.easing === 'function' ? opts.easing : (Easing[opts.easing] || Easing.easeInOutCubic),
      onComplete: opts.onComplete,
      elapsed: 0,
      // Estado inicial (capturado ao iniciar)
      fromPos: null,
      fromTarget: null
    };

    if (opts.chain) {
      this._queue.push(task);
      if (!this._running) this._next();
    } else {
      // Substitui o atual
      this._current = task;
      this._running = true;
      this._prepare(task);
    }
    return this;
  }

  /**
   * Atalho para focar em uma posição específica.
   */
  lookAt(position, target, duration = 1000, easing = 'easeInOutCubic') {
    return this.tween({ position, target, duration, easing });
  }

  /**
   * Cancela tween atual e limpa fila.
   */
  cancel() {
    this._current = null;
    this._queue = [];
    this._running = false;
    dispatch({ type: ACTIONS.ANATOMY_SET_CAMERA_TWEENING, payload: false });
  }

  /* --------------------------------------------------------------
     Internos
     -------------------------------------------------------------- */
  _prepare(task) {
    if (!scene3D.camera || !scene3D.controls) return;
    task.fromPos = scene3D.camera.position.clone();
    task.fromTarget = scene3D.controls.target.clone();
    task.elapsed = 0;
    task.startedAt = performance.now();
    dispatch({ type: ACTIONS.ANATOMY_SET_CAMERA_TWEENING, payload: true });
  }

  _next() {
    if (this._queue.length === 0) {
      this._running = false;
      return;
    }
    const task = this._queue.shift();
    this._current = task;
    this._running = true;
    this._prepare(task);
  }

  _update() {
    const task = this._current;
    if (!task || !scene3D.camera || !scene3D.controls) return;

    const now = performance.now();
    const t = Math.min((now - task.startedAt) / task.duration, 1);
    const eased = task.easing(t);

    if (task.position && task.fromPos) {
      scene3D.camera.position.lerpVectors(task.fromPos, task.position, eased);
    }
    if (task.target && task.fromTarget) {
      scene3D.controls.target.lerpVectors(task.fromTarget, task.target, eased);
    }
    scene3D.controls.update();

    if (t >= 1) {
      task.onComplete?.();
      this._current = null;
      dispatch({ type: ACTIONS.ANATOMY_SET_CAMERA_TWEENING, payload: false });
      if (this._queue.length > 0) {
        this._next();
      } else {
        this._running = false;
      }
    }
  }
}

/* ================================================================
   SINGLETON + ATALHOS
   ================================================================ */
export const cameraTween = new CameraTween();

/**
 * Presets de posições de câmera por sistema anatômico.
 */
export const CAMERA_PRESETS = {
  home:        { position: { x: 0, y: 1.2, z: 4.5 }, target: { x: 0, y: 1.2, z: 0 } },
  cabeca:      { position: { x: 0, y: 1.65, z: 1.6 }, target: { x: 0, y: 1.65, z: 0 } },
  torax:       { position: { x: 0, y: 1.30, z: 1.8 }, target: { x: 0, y: 1.30, z: 0 } },
  coracao:     { position: { x: 0.3, y: 1.30, z: 1.4 }, target: { x: 0.1, y: 1.25, z: 0 } },
  pulmoes:     { position: { x: 0, y: 1.40, z: 2.0 }, target: { x: 0, y: 1.40, z: 0 } },
  abdome:      { position: { x: 0, y: 1.00, z: 2.0 }, target: { x: 0, y: 1.00, z: 0 } },
  estomago:    { position: { x: -0.2, y: 1.05, z: 1.5 }, target: { x: -0.1, y: 1.00, z: 0 } },
  figado:      { position: { x: 0.2, y: 1.00, z: 1.5 }, target: { x: 0.15, y: 0.95, z: 0 } },
  intestino:   { position: { x: 0, y: 0.85, z: 1.8 }, target: { x: 0, y: 0.85, z: 0 } },
  pelve:       { position: { x: 0, y: 0.65, z: 1.6 }, target: { x: 0, y: 0.65, z: 0 } },
  bracos:      { position: { x: 0, y: 1.20, z: 2.6 }, target: { x: 0, y: 1.20, z: 0 } },
  pernas:      { position: { x: 0, y: 0.55, z: 2.4 }, target: { x: 0, y: 0.55, z: 0 } }
};

/**
 * Aplica preset com tween.
 */
export function focusOn(presetKey, duration = 900, easing = 'easeInOutCubic') {
  const preset = CAMERA_PRESETS[presetKey];
  if (!preset) {
    console.warn(`[CameraTween] Preset "${presetKey}" não encontrado`);
    return;
  }
  return cameraTween.tween({
    position: preset.position,
    target: preset.target,
    duration,
    easing
  });
}

export default cameraTween;
