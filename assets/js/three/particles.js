/**
 * LAIFT · Anatomia 3D
 * three/particles.js — Sistema de partículas
 *
 * Responsável por:
 *   - Criar e gerenciar fluxos de partículas (bolo alimentar, sangue, íons)
 *   - Simular movimento ao longo de curvas (CatmullRom)
 *   - Suportar múltiplos emissores simultâneos
 *   - Estilização configurável (cor, tamanho, blur)
 */

import * as THREE from 'three';
import { bus, EVENTS } from '../core/events.js';
import { scene3D } from './scene.js';

/* ================================================================
   PRESETS
   ================================================================ */
export const PARTICLE_PRESETS = Object.freeze({
  blood: {
    color: 0xc0392b,
    size: 0.025,
    speed: 0.55,
    count: 24,
    glow: true
  },
  bolus: {                       // bolo alimentar
    color: 0x8bc34a,
    size: 0.055,
    speed: 0.30,
    count: 1,
    glow: false
  },
  saliva: {
    color: 0xa8dadc,
    size: 0.015,
    speed: 0.40,
    count: 12,
    glow: true
  },
  ions: {
    color: 0x00e5ff,
    size: 0.012,
    speed: 0.85,
    count: 30,
    glow: true
  },
  impulse: {                     // impulso nervoso
    color: 0x7c5cff,
    size: 0.020,
    speed: 1.20,
    count: 8,
    glow: true
  },
  drug: {
    color: 0xffb020,
    size: 0.022,
    speed: 0.45,
    count: 16,
    glow: true
  },
  nano: {
    color: 0x00ffa3,
    size: 0.030,
    speed: 0.35,
    count: 8,
    glow: true
  }
});

/* ================================================================
   EMISSOR
   ================================================================ */
class ParticleEmitter {
  /**
   * @param {Object} opts
   * @param {THREE.Vector3[]} opts.waypoints - pontos da trajetória
   * @param {Object} opts.preset - configuração visual
   * @param {number} [opts.duration=0] - 0 = looping infinito
   */
  constructor(opts) {
    this.id = 'emit_' + Math.random().toString(36).slice(2, 9);
    this.waypoints = opts.waypoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this.preset = { ...opts.preset };
    this.duration = opts.duration || 0;
    this.loop = opts.loop ?? true;

    this._curve = new THREE.CatmullRomCurve3(this.waypoints, false, 'catmullrom', 0.5);
    this._length = this._curve.getLength();

    this._points = null;
    this._geometry = null;
    this._material = null;
    this._offsets = new Float32Array(this.preset.count);
    this._elapsed = 0;
    this._active = true;
    this._spawnedAt = performance.now();

    this._build();
  }

  _build() {
    const count = this.preset.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this._offsets[i] = i / count;
      sizes[i] = this.preset.size * (0.85 + Math.random() * 0.3);
    }

    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this._material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(this.preset.color) },
        uGlow: { value: this.preset.glow ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute float size;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 300.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uGlow;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.15, d);
          vec3 col = mix(uColor, vec3(1.0), uGlow * (1.0 - d) * 0.4);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this._points = new THREE.Points(this._geometry, this._material);
    this._points.frustumCulled = false;
    this._points.userData.emitterId = this.id;
  }

  get object3D() { return this._points; }

  update(dt) {
    if (!this._active) return;
    this._elapsed += dt;

    const count = this.preset.count;
    const positions = this._geometry.attributes.position.array;
    const speed = this.preset.speed;

    for (let i = 0; i < count; i++) {
      let t = (this._offsets[i] + this._elapsed * speed) % 1;
      const p = this._curve.getPointAt(t);
      const idx = i * 3;
      positions[idx]     = p.x;
      positions[idx + 1] = p.y;
      positions[idx + 2] = p.z;
    }

    this._geometry.attributes.position.needsUpdate = true;

    // Fim (se não-loop)
    if (!this.loop && this.duration > 0 && this._elapsed >= this.duration) {
      this._active = false;
      bus.emit('particles:ended', { id: this.id });
    }
  }

  dispose() {
    this._active = false;
    this._geometry?.dispose();
    this._material?.dispose();
    if (this._points?.parent) this._points.parent.remove(this._points);
  }
}

/* ================================================================
   GERENCIADOR
   ================================================================ */
export class ParticleSystem {
  constructor() {
    this._emitters = new Map();
    this._initialized = false;
    this._group = new THREE.Group();
    this._group.name = 'ParticleSystem';
  }

  init() {
    if (this._initialized) return this;
    scene3D.add(this._group);
    scene3D.registerUpdatable({ update: (dt) => this._update(dt) });
    this._initialized = true;
    return this;
  }

  /**
   * Cria um emissor de partículas.
   * @param {Object} opts
   * @param {THREE.Vector3[]|{x,y,z}[]} opts.waypoints
   * @param {string|Object} opts.preset - nome do preset ou objeto
   * @returns {string} emitterId
   */
  emit(opts) {
    if (!this._initialized) this.init();
    if (!opts.waypoints || opts.waypoints.length < 2) {
      throw new Error('[Particles] Requer pelo menos 2 waypoints');
    }

    const preset = typeof opts.preset === 'string'
      ? PARTICLE_PRESETS[opts.preset]
      : opts.preset;
    if (!preset) throw new Error(`[Particles] Preset inválido: ${opts.preset}`);

    const emitter = new ParticleEmitter({
      waypoints: opts.waypoints,
      preset,
      duration: opts.duration,
      loop: opts.loop ?? true
    });

    this._emitters.set(emitter.id, emitter);
    this._group.add(emitter.object3D);
    bus.emit('particles:started', { id: emitter.id, preset: opts.preset });
    return emitter.id;
  }

  /**
   * Remove um emissor.
   */
  stop(emitterId) {
    const emitter = this._emitters.get(emitterId);
    if (!emitter) return false;
    emitter.dispose();
    this._emitters.delete(emitterId);
    return true;
  }

  stopAll() {
    for (const [id, emitter] of this._emitters) {
      emitter.dispose();
    }
    this._emitters.clear();
  }

  stopByPreset(presetName) {
    const preset = PARTICLE_PRESETS[presetName];
    if (!preset) return 0;
    let n = 0;
    for (const [id, emitter] of [...this._emitters]) {
      if (emitter.preset === preset) {
        emitter.dispose();
        this._emitters.delete(id);
        n++;
      }
    }
    return n;
  }

  _update(dt) {
    for (const [id, emitter] of [...this._emitters]) {
      emitter.update(dt);
      if (!emitter._active) {
        emitter.dispose();
        this._emitters.delete(id);
      }
    }
  }

  /* --------------------------------------------------------------
     Atalhos
     -------------------------------------------------------------- */
  emitBloodFlow(waypoints) {
    return this.emit({ waypoints, preset: 'blood' });
  }

  emitBolus(waypoints) {
    return this.emit({ waypoints, preset: 'bolus' });
  }

  emitNerveImpulse(waypoints) {
    return this.emit({ waypoints, preset: 'impulse' });
  }

  emitDrug(waypoints) {
    return this.emit({ waypoints, preset: 'drug' });
  }

  emitNano(waypoints) {
    return this.emit({ waypoints, preset: 'nano' });
  }

  dispose() {
    this.stopAll();
    if (this._group.parent) this._group.parent.remove(this._group);
    this._initialized = false;
  }
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const particleSystem = new ParticleSystem();

export default particleSystem;
