/**
 * LAIFT · Anatomia 3D
 * three/raycasting.js — Seleção de meshes por clique/hover
 *
 * Responsável por:
 *   - Detectar cliques e hover em meshes
 *   - Emitir eventos com payload rico
 *   - Highlight visual (hover) e seleção
 *   - Throttle de hover para performance
 *   - Ignorar cliques em UI
 */

import * as THREE from 'three';
import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState } from '../core/state.js';
import { scene3D } from './scene.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const RC_CONFIG = {
  hoverThrottleMs: 45,
  clickThreshold: 5,          // px — abaixo disto é clique, acima é drag
  clickTimeThreshold: 250,    // ms
  highlightColor: 0x00e5ff,
  highlightIntensity: 0.35
};

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class Raycaster3D {
  constructor() {
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._hovered = null;
    this._selected = null;
    this._lastHoverAt = 0;
    this._pointerDownAt = null;
    this._pointerDownPos = null;
    this._initialized = false;
    this._enabled = true;
    this._interactiveMeshes = [];
  }

  /**
   * @param {THREE.Mesh[]} meshes
   */
  init(meshes = []) {
    if (this._initialized) {
      this._interactiveMeshes = meshes;
      return this;
    }

    this._interactiveMeshes = meshes;

    const canvas = scene3D.renderer?.domElement;
    if (!canvas) {
      console.warn('[Raycaster] Canvas não disponível');
      return this;
    }

    canvas.addEventListener('pointermove', this._onPointerMove.bind(this), { passive: true });
    canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
    canvas.addEventListener('pointerup', this._onPointerUp.bind(this));
    canvas.addEventListener('pointerleave', this._onPointerLeave.bind(this));

    this._initialized = true;
    console.log('[Raycaster] Inicializado');
    return this;
  }

  setMeshes(meshes) {
    this._interactiveMeshes = meshes;
    return this;
  }

  enable() { this._enabled = true; }
  disable() { this._enabled = false; this._clearHover(); }

  /* --------------------------------------------------------------
     Eventos de ponteiro
     -------------------------------------------------------------- */
  _onPointerMove(event) {
    if (!this._enabled) return;

    const now = performance.now();
    if (now - this._lastHoverAt < RC_CONFIG.hoverThrottleMs) return;
    this._lastHoverAt = now;

    const hit = this._castFromEvent(event);
    this._updateHover(hit);
  }

  _onPointerDown(event) {
    this._pointerDownAt = performance.now();
    this._pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  _onPointerUp(event) {
    if (!this._enabled || !this._pointerDownAt) return;

    const dt = performance.now() - this._pointerDownAt;
    const dx = event.clientX - this._pointerDownPos.x;
    const dy = event.clientY - this._pointerDownPos.y;
    const dist = Math.hypot(dx, dy);

    this._pointerDownAt = null;
    this._pointerDownPos = null;

    // Foi drag, não clique
    if (dist > RC_CONFIG.clickThreshold || dt > RC_CONFIG.clickTimeThreshold * 3) {
      return;
    }

    const hit = this._castFromEvent(event);
    if (hit) this._handleClick(hit);
    else this._handleEmptyClick();
  }

  _onPointerLeave() {
    this._clearHover();
  }

  /* --------------------------------------------------------------
     Casting
     -------------------------------------------------------------- */
  _castFromEvent(event) {
    if (!scene3D.camera || !scene3D.renderer) return null;

    const rect = scene3D.renderer.domElement.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._pointer, scene3D.camera);

    const candidates = this._interactiveMeshes.filter(
      (m) => m && m.visible && !isFullyTransparent(m)
    );

    const intersects = this._raycaster.intersectObjects(candidates, false);
    if (intersects.length === 0) return null;

    // Retorna a primeira com material visível
    return intersects.find((i) => i.object.material) || intersects[0];
  }

  /* --------------------------------------------------------------
     Hover
     -------------------------------------------------------------- */
  _updateHover(hit) {
    const newMesh = hit?.object || null;
    if (newMesh === this._hovered) return;

    // Remove highlight anterior
    if (this._hovered && this._hovered !== this._selected) {
      this._setHighlight(this._hovered, false);
    }

    // Aplica novo
    if (newMesh) {
      this._setHighlight(newMesh, true);
      bus.emit(EVENTS.ANATOMY_MESH_HOVER, {
        mesh: newMesh,
        name: newMesh.name,
        system: newMesh.userData.system,
        point: hit.point
      });
      dispatch({ type: ACTIONS.ANATOMY_SET_HOVERED_MESH, payload: newMesh.name });
      scene3D.renderer.domElement.style.cursor = 'pointer';
    } else {
      dispatch({ type: ACTIONS.ANATOMY_SET_HOVERED_MESH, payload: null });
      scene3D.renderer.domElement.style.cursor = 'grab';
    }

    this._hovered = newMesh;
  }

  _clearHover() {
    if (this._hovered && this._hovered !== this._selected) {
      this._setHighlight(this._hovered, false);
    }
    this._hovered = null;
    dispatch({ type: ACTIONS.ANATOMY_SET_HOVERED_MESH, payload: null });
    if (scene3D.renderer) scene3D.renderer.domElement.style.cursor = 'grab';
  }

  /* --------------------------------------------------------------
     Seleção
     -------------------------------------------------------------- */
  _handleClick(hit) {
    const mesh = hit.object;
    if (!mesh) return;

    // Desmarca anterior
    if (this._selected && this._selected !== mesh) {
      this._setHighlight(this._selected, false, true);
    }

    this._selected = mesh;
    this._setHighlight(mesh, true, true);
    dispatch({ type: ACTIONS.ANATOMY_SET_SELECTED_MESH, payload: mesh.name });

    const info = {
      mesh,
      name: mesh.name,
      system: mesh.userData.system,
      type: mesh.userData.type,
      wikiLink: mesh.userData.wikiLink,
      point: hit.point,
      distance: hit.distance
    };

    bus.emit(EVENTS.ANATOMY_MESH_CLICKED, info);
    console.log('[Raycaster] Mesh clicada:', info.name);
  }

  _handleEmptyClick() {
    if (this._selected) {
      this._setHighlight(this._selected, false, true);
      this._selected = null;
      dispatch({ type: ACTIONS.ANATOMY_SET_SELECTED_MESH, payload: null });
      bus.emit(EVENTS.ANATOMY_MESH_CLICKED, { mesh: null });
    }
  }

  /* --------------------------------------------------------------
     Highlight
     -------------------------------------------------------------- */
  _setHighlight(mesh, on, isSelection = false) {
    if (!mesh) return;
    const intensity = isSelection
      ? RC_CONFIG.highlightIntensity * 1.5
      : RC_CONFIG.highlightIntensity;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (!mat.emissive) continue;

      if (on) {
        if (mat.userData.__origEmissive === undefined) {
          mat.userData.__origEmissive = mat.emissive.getHex();
          mat.userData.__origIntensity = mat.emissiveIntensity ?? 1;
        }
        mat.emissive.setHex(RC_CONFIG.highlightColor);
        mat.emissiveIntensity = intensity;
      } else {
        if (mat.userData.__origEmissive !== undefined) {
          mat.emissive.setHex(mat.userData.__origEmissive);
          mat.emissiveIntensity = mat.userData.__origIntensity;
        }
      }
    }
  }

  /* --------------------------------------------------------------
     Consultas
     -------------------------------------------------------------- */
  getSelected() { return this._selected; }
  getHovered() { return this._hovered; }

  clearSelection() {
    if (this._selected) {
      this._setHighlight(this._selected, false, true);
      this._selected = null;
    }
  }

  dispose() {
    const canvas = scene3D.renderer?.domElement;
    if (canvas) {
      // Os handlers estão bound, mas remover é opcional pois canvas é destruído
    }
    this._interactiveMeshes = [];
    this._initialized = false;
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function isFullyTransparent(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.every((m) => m && m.opacity !== undefined && m.opacity < 0.02);
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const raycaster3D = new Raycaster3D();

export default raycaster3D;
