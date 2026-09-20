/**
 * LAIFT · Anatomia 3D
 * three/scene.js — Cena base Three.js
 *
 * Responsável por:
 *   - Criar renderer WebGL, cena, câmera e luzes
 *   - Loop de renderização com requestAnimationFrame
 *   - Resize automático (com ResizeObserver)
 *   - Dispose completo de recursos
 *   - Suporte a WebGL2 com fallback
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState } from '../core/state.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const SCENE_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  initialCameraPos: { x: 0, y: 1.2, z: 4.5 },
  targetPos: { x: 0, y: 1.2, z: 0 },
  controls: {
    minDistance: 1.5,
    maxDistance: 15,
    enableDamping: true,
    dampingFactor: 0.08,
    rotateSpeed: 0.8,
    zoomSpeed: 0.9,
    panSpeed: 0.6,
    autoRotateSpeed: 0.5
  },
  lights: {
    ambient: { color: 0xffffff, intensity: 0.7 },
    key: { color: 0xffffff, intensity: 1.2, pos: [5, 10, 7] },
    fill: { color: 0xaaccff, intensity: 0.4, pos: [-5, 5, -5] },
    rim: { color: 0x00e5ff, intensity: 0.35, pos: [0, 3, -8] }
  },
  background: 0x0b0e14
};

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class Scene3D {
  constructor(containerId = 'threeCanvasWrapper') {
    this.containerId = containerId;
    this.container = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    this._rafId = null;
    this._running = false;
    this._resizeObserver = null;
    this._sceneRoot = null;      // nó onde o modelo é adicionado
    this._helpers = new THREE.Group();
    this._updatables = new Set(); // objetos com update(dt)
    this._initialized = false;

    this._onResize = this._onResize.bind(this);
    this._render = this._render.bind(this);
  }

  /* --------------------------------------------------------------
     Init
     -------------------------------------------------------------- */
  init() {
    if (this._initialized) return this;

    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`[Scene3D] Container "${this.containerId}" não encontrado`);
    }

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    this.renderer.setClearColor(SCENE_CONFIG.background, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    // Cena
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(SCENE_CONFIG.background, 8, 22);

    // Câmera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(SCENE_CONFIG.fov, aspect, SCENE_CONFIG.near, SCENE_CONFIG.far);
    this.camera.position.set(
      SCENE_CONFIG.initialCameraPos.x,
      SCENE_CONFIG.initialCameraPos.y,
      SCENE_CONFIG.initialCameraPos.z
    );

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, SCENE_CONFIG.controls);
    this.controls.target.set(
      SCENE_CONFIG.targetPos.x,
      SCENE_CONFIG.targetPos.y,
      SCENE_CONFIG.targetPos.z
    );
    this.controls.update();

    // Lights
    this._setupLights();

    // Root do modelo
    this._sceneRoot = new THREE.Group();
    this._sceneRoot.name = 'SceneRoot';
    this.scene.add(this._sceneRoot);

    // Helpers (opcional)
    this.scene.add(this._helpers);

    // Anexa canvas
    this.container.appendChild(this.renderer.domElement);

    // Resize
    window.addEventListener('resize', this._onResize);
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.container);
    }

    this._initialized = true;
    bus.emit(EVENTS.ANATOMY_LOADED, { scene: this.scene, camera: this.camera });
    return this;
  }

  /* --------------------------------------------------------------
     Luzes
     -------------------------------------------------------------- */
  _setupLights() {
    const L = SCENE_CONFIG.lights;

    const ambient = new THREE.AmbientLight(L.ambient.color, L.ambient.intensity);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(L.key.color, L.key.intensity);
    key.position.set(...L.key.pos);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(L.fill.color, L.fill.intensity);
    fill.position.set(...L.fill.pos);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
    rim.position.set(...L.rim.pos);
    this.scene.add(rim);

    // Luz hemisférica suave para profundidade
    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.35);
    this.scene.add(hemi);
  }

  /* --------------------------------------------------------------
     Loop de renderização
     -------------------------------------------------------------- */
  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this._rafId = requestAnimationFrame(this._render);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _render() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._render);

    const dt = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    // Atualiza controls
    if (this.controls && this.controls.enabled) {
      this.controls.update();
    }

    // Atualiza "updatables" (partículas, tweens, animações)
    for (const u of this._updatables) {
      try {
        u.update(dt, elapsed);
      } catch (err) {
        console.warn('[Scene3D] Erro em updatable:', err);
      }
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  /* --------------------------------------------------------------
     Registro de atualizáveis
     -------------------------------------------------------------- */
  registerUpdatable(obj) {
    if (obj && typeof obj.update === 'function') {
      this._updatables.add(obj);
    }
    return () => this._updatables.delete(obj);
  }

  unregisterUpdatable(obj) {
    this._updatables.delete(obj);
  }

  /* --------------------------------------------------------------
     Acesso a nós
     -------------------------------------------------------------- */
  get root() {
    return this._sceneRoot;
  }

  add(object3D) {
    if (!this._sceneRoot) return;
    this._sceneRoot.add(object3D);
  }

  remove(object3D) {
    if (!this._sceneRoot) return;
    this._sceneRoot.remove(object3D);
  }

  /* --------------------------------------------------------------
     Reset da câmera (instantâneo)
     -------------------------------------------------------------- */
  resetCamera(immediate = false) {
    const pos = SCENE_CONFIG.initialCameraPos;
    const target = SCENE_CONFIG.targetPos;

    if (immediate) {
      this.camera.position.set(pos.x, pos.y, pos.z);
      this.controls.target.set(target.x, target.y, target.z);
      this.controls.update();
      bus.emit(EVENTS.ANATOMY_CAMERA_RESET);
      return;
    }

    // Animação simples via tween interno (caso não use camera-tween.js)
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const endTarget = new THREE.Vector3(target.x, target.y, target.z);
    const duration = 700;
    const startTime = performance.now();

    const animate = () => {
      const t = Math.min((performance.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(startPos, endPos, eased);
      this.controls.target.lerpVectors(startTarget, endTarget, eased);
      this.controls.update();
      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  /* --------------------------------------------------------------
     Resize
     -------------------------------------------------------------- */
  _onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);

    bus.emit(EVENTS.UI_RESIZE, { width: w, height: h });
  }

  /* --------------------------------------------------------------
     Dispose
     -------------------------------------------------------------- */
  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this._resizeObserver?.disconnect();

    // Recursos do scene root
    this._sceneRoot?.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.controls?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this._updatables.clear();
    this._initialized = false;
    console.log('[Scene3D] disposed');
  }
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const scene3D = new Scene3D();
export default scene3D;
