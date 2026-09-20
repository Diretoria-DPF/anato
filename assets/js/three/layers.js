/**
 * LAIFT · Anatomia 3D
 * three/layers.js — Sistema de camadas e opacidade
 *
 * Responsável por:
 *   - Mapear sistemas anatômicos → meshes
 *   - Aplicar fade (opacidade) por sistema
 *   - Isolar sistemas (esconder os demais)
 *   - Restaurar visibilidade
 *   - Animar transições
 */

import * as THREE from 'three';
import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState } from '../core/state.js';
import { scene3D } from './scene.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const LAYER_CONFIG = {
  defaultOpacity: 1.0,
  dimmedOpacity: 0.06,
  hiddenOpacity: 0.0,
  fadeDuration: 500,           // ms
  excludeFromFade: []          // nomes de meshes que nunca esmaecem
};

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class LayerManager {
  constructor() {
    this._meshes = [];                    // referência a todos os meshes
    this._systemsMap = new Map();         // sistemaId → Set<Mesh>
    this._originalOpacity = new WeakMap();// mesh → opacidade original
    this._originalVisible = new WeakMap();// mesh → visível original
    this._activeSystem = null;
    this._tweens = new Map();             // mesh → { startOpacity, endOpacity, startTime }
    this._initialized = false;
  }

  init() {
    if (this._initialized) return this;
    scene3D.registerUpdatable({ update: (dt) => this._update(dt) });
    this._initialized = true;
    return this;
  }

  /**
   * Registra meshes e classifica por sistema.
   * @param {THREE.Mesh[]} meshes
   */
  registerMeshes(meshes) {
    this._meshes = meshes;
    this._systemsMap.clear();

    for (const mesh of meshes) {
      // Guarda estado original
      if (!this._originalOpacity.has(mesh)) {
        const op = Array.isArray(mesh.material)
          ? mesh.material[0]?.opacity ?? 1
          : mesh.material?.opacity ?? 1;
        this._originalOpacity.set(mesh, op);
        this._originalVisible.set(mesh, mesh.visible);
      }

      // Sistema
      const system = mesh.userData.system || inferSystem(mesh.name);
      mesh.userData.system = system;

      if (!this._systemsMap.has(system)) {
        this._systemsMap.set(system, new Set());
      }
      this._systemsMap.get(system).add(mesh);
    }

    console.log(`[Layers] ${meshes.length} meshes em ${this._systemsMap.size} sistemas`);
    return this;
  }

  /**
   * Lista sistemas disponíveis.
   */
  listSystems() {
    return Array.from(this._systemsMap.keys()).sort();
  }

  /**
   * Retorna meshes de um sistema.
   */
  getMeshesOfSystem(sistemaId) {
    return Array.from(this._systemsMap.get(sistemaId) || []);
  }

  /* --------------------------------------------------------------
     ISOLAMENTO / FOCO
     -------------------------------------------------------------- */
  /**
   * Foca em um sistema: esmaece todos os outros.
   * @param {string} sistemaId - ID do sistema em foco (ou null para reset)
   */
  focusSystem(sistemaId) {
    if (!sistemaId) {
      this._activeSystem = null;
      this._resetAll();
      dispatch({ type: ACTIONS.ANATOMY_SET_SYSTEM, payload: null });
      return;
    }

    if (!this._systemsMap.has(sistemaId)) {
      console.warn(`[Layers] Sistema "${sistemaId}" não encontrado`);
      return;
    }

    this._activeSystem = sistemaId;
    const focusMeshes = this._systemsMap.get(sistemaId);

    for (const mesh of this._meshes) {
      if (focusMeshes.has(mesh)) {
        this._tweenMesh(mesh, LAYER_CONFIG.defaultOpacity, true);
      } else {
        this._tweenMesh(mesh, LAYER_CONFIG.dimmedOpacity, true);
      }
    }

    dispatch({ type: ACTIONS.ANATOMY_SET_SYSTEM, payload: sistemaId });
    bus.emit(EVENTS.ANATOMY_SYSTEM_SELECTED, { sistemaId });
  }

  /**
   * Mostra apenas os sistemas listados, esconde os demais.
   */
  setVisibleSystems(systemIds = []) {
    if (!systemIds.length) {
      this._resetAll();
      return;
    }
    const set = new Set(systemIds);
    for (const mesh of this._meshes) {
      const sys = mesh.userData.system;
      if (set.has(sys)) {
        this._tweenMesh(mesh, LAYER_CONFIG.defaultOpacity, true);
      } else {
        this._tweenMesh(mesh, LAYER_CONFIG.hiddenOpacity, false);
      }
    }
    dispatch({ type: ACTIONS.ANATOMY_SET_VISIBLE_SYSTEMS, payload: systemIds });
  }

  /**
   * Esmaece por nome de sistema (múltiplos).
   */
  dimSystems(systemIds = []) {
    const set = new Set(systemIds);
    for (const mesh of this._meshes) {
      if (set.has(mesh.userData.system)) {
        this._tweenMesh(mesh, LAYER_CONFIG.dimmedOpacity, true);
      } else if (mesh.userData.system === this._activeSystem) {
        this._tweenMesh(mesh, LAYER_CONFIG.defaultOpacity, true);
      }
    }
  }

  /* --------------------------------------------------------------
     OPACIDADE DIRETA
     -------------------------------------------------------------- */
  setMeshOpacity(mesh, opacity) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.transparent = true;
      mat.opacity = opacity;
      mat.depthWrite = opacity > 0.5;
      mat.needsUpdate = true;
    }
  }

  setSystemOpacity(sistemaId, opacity) {
    const meshes = this._systemsMap.get(sistemaId);
    if (!meshes) return;
    for (const mesh of meshes) {
      this.setMeshOpacity(mesh, opacity);
      mesh.visible = opacity > 0;
    }
  }

  /* --------------------------------------------------------------
     RESET
     -------------------------------------------------------------- */
  _resetAll() {
    for (const mesh of this._meshes) {
      const op = this._originalOpacity.get(mesh) ?? 1;
      const vis = this._originalVisible.get(mesh) ?? true;
      this._tweenMesh(mesh, op, vis);
    }
    this._activeSystem = null;
  }

  reset() {
    this._resetAll();
    dispatch({ type: ACTIONS.ANATOMY_RESET });
  }

  /* --------------------------------------------------------------
     TWEEN
     -------------------------------------------------------------- */
  _tweenMesh(mesh, targetOpacity, targetVisible = true) {
    mesh.visible = targetVisible || targetOpacity > 0.01;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const current = mats[0]?.opacity ?? 1;

    if (Math.abs(current - targetOpacity) < 0.01) {
      this.setMeshOpacity(mesh, targetOpacity);
      return;
    }

    this._tweens.set(mesh, {
      from: current,
      to: targetOpacity,
      start: performance.now(),
      duration: LAYER_CONFIG.fadeDuration
    });
  }

  _update() {
    if (this._tweens.size === 0) return;
    const now = performance.now();
    const done = [];

    for (const [mesh, tween] of this._tweens) {
      const t = Math.min((now - tween.start) / tween.duration, 1);
      const eased = easeOutCubic(t);
      const opacity = tween.from + (tween.to - tween.from) * eased;
      this.setMeshOpacity(mesh, opacity);
      if (t >= 1) done.push(mesh);
    }

    for (const m of done) this._tweens.delete(m);
  }

  /* --------------------------------------------------------------
     HELPERS
     -------------------------------------------------------------- */
  highlightMesh(mesh, highlight = true) {
    if (!mesh) return;
    mesh.traverse?.((node) => {
      if (node.isMesh) {
        if (highlight) {
          node.userData.__origEmissive = node.material?.emissive?.getHex?.() ?? 0;
          if (node.material?.emissive) {
            node.material.emissive.setHex(0x00e5ff);
            node.material.emissiveIntensity = 0.5;
          }
        } else {
          if (node.material?.emissive) {
            node.material.emissive.setHex(node.userData.__origEmissive ?? 0x000000);
            node.material.emissiveIntensity = 1;
          }
        }
      }
    });
  }

  dispose() {
    this._tweens.clear();
    this._systemsMap.clear();
    this._meshes = [];
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function inferSystem(name = '') {
  const n = name.toLowerCase();
  if (/heart|coronary|aorta|vein|artery|ventricle|atrium/.test(n)) return 'cardiovascular';
  if (/lung|bronch|trachea|alveol|pleura/.test(n)) return 'respiratorio';
  if (/stomach|intestin|liver|pancrea|esophag|colon|rectum|bile/.test(n)) return 'digestorio';
  if (/brain|cerebr|cerebell|nerve|neuron|spinal|gangli/.test(n)) return 'nervoso';
  if (/muscle|muscul|tendon|fascia/.test(n)) return 'muscular';
  if (/bone|skull|vertebra|femur|tibia|humerus|rib|cranium/.test(n)) return 'esqueletico';
  if (/kidney|bladder|ureter|urethra/.test(n)) return 'urinario';
  if (/thyroid|adrenal|pituitar|pineal/.test(n)) return 'endocrino';
  if (/lymph|spleen|thymus|tonsil/.test(n)) return 'linfatico';
  if (/uterus|ovary|testis|prostate|vagina|penis/.test(n)) return 'reprodutor';
  return 'other';
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const layerManager = new LayerManager();

export default layerManager;
