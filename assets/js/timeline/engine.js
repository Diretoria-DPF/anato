/**
 * LAIFT · Anatomia 3D
 * timeline/engine.js — Motor de timelines fisiológicas
 *
 * Responsável por:
 *   - Orquestrar etapas de processos fisiológicos
 *   - Emitir eventos por etapa
 *   - Play/Pause/Step/Reset
 *   - Sincronizar partículas + câmera + UI
 */

import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState } from '../core/state.js';
import { scene3D } from '../three/scene.js';
import { cameraTween, focusOn, CAMERA_PRESETS } from '../three/camera-tween.js';
import { particleSystem } from '../three/particles.js';
import { layerManager } from '../three/layers.js';

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class TimelineEngine {
  constructor() {
    this._initialized = false;
    this._process = null;
    this._stepIndex = 0;
    this._playTimer = null;
    this._activeEmitters = new Set();
    this._onStepEnter = null;
  }

  init() {
    if (this._initialized) return this;
    this._bindEvents();
    this._initialized = true;
    console.log('[Timeline] Inicializado');
    return this;
  }

  /* --------------------------------------------------------------
     API pública
     -------------------------------------------------------------- */

  /**
   * Carrega um processo do banco de dados.
   * @param {string} processoId
   * @param {Object} [dados] - se não passado, busca do state
   */
  async loadProcess(processoId, dados) {
    const state = getState();
    const processos = state.data.processos?.processos || [];
    const processo = processos.find((p) => p.processo_id === processoId);

    if (!processo && !dados) {
      console.warn(`[Timeline] Processo "${processoId}" não encontrado`);
      return;
    }

    this._process = dados || processo;
    this._stepIndex = 0;
    this._clearEmitters();

    dispatch({ type: ACTIONS.PHYSIO_SET_PROCESS, payload: processoId });
    dispatch({ type: ACTIONS.PHYSIO_SET_TOTAL, payload: this._process.etapas.length });
    dispatch({ type: ACTIONS.PHYSIO_SET_STEP, payload: 0 });
    dispatch({ type: ACTIONS.PHYSIO_SET_PLAYING, payload: false });
    dispatch({ type: ACTIONS.PHYSIO_SET_COMPLETED, payload: false });

    this._renderStepsList();
    this._enterStep(0);

    bus.emit(EVENTS.PHYSIO_PROCESS_SELECTED, {
      processoId,
      processo: this._process
    });

    console.log(`[Timeline] Processo carregado: ${this._process.nome}`);
    return this._process;
  }

  /**
   * Avança para próxima etapa.
   */
  next() {
    if (!this._process) return;
    if (this._stepIndex >= this._process.etapas.length - 1) {
      this.complete();
      return;
    }
    this._enterStep(this._stepIndex + 1);
  }

  /**
   * Volta para etapa anterior.
   */
  prev() {
    if (!this._process) return;
    if (this._stepIndex <= 0) return;
    this._enterStep(this._stepIndex - 1);
  }

  /**
   * Vai para etapa específica.
   */
  goto(index) {
    if (!this._process) return;
    if (index < 0 || index >= this._process.etapas.length) return;
    this._enterStep(index);
  }

  /**
   * Inicia/reinicia reprodução automática.
   */
  play() {
    if (!this._process) return;
    dispatch({ type: ACTIONS.PHYSIO_SET_PLAYING, payload: true });
    bus.emit(EVENTS.PHYSIO_PLAY);
    this._scheduleNext();
  }

  /**
   * Pausa a reprodução.
   */
  pause() {
    dispatch({ type: ACTIONS.PHYSIO_SET_PLAYING, payload: false });
    bus.emit(EVENTS.PHYSIO_PAUSE);
    if (this._playTimer) {
      clearTimeout(this._playTimer);
      this._playTimer = null;
    }
  }

  /**
   * Alterna play/pause.
   */
  toggle() {
    const { isPlaying } = getState().physiology;
    isPlaying ? this.pause() : this.play();
  }

  /**
   * Reseta para o início.
   */
  reset() {
    this.pause();
    this._clearEmitters();
    this._stepIndex = 0;
    dispatch({ type: ACTIONS.PHYSIO_RESET });
    if (this._process) {
      dispatch({ type: ACTIONS.PHYSIO_SET_PROCESS, payload: this._process.processo_id });
      dispatch({ type: ACTIONS.PHYSIO_SET_TOTAL, payload: this._process.etapas.length });
      this._renderStepsList();
      this._enterStep(0);
    }
    bus.emit(EVENTS.PHYSIO_RESET);
  }

  /**
   * Completa o processo.
   */
  complete() {
    this.pause();
    this._clearEmitters();
    dispatch({ type: ACTIONS.PHYSIO_SET_COMPLETED, payload: true });
    bus.emit(EVENTS.PHYSIO_COMPLETED, { processoId: this._process?.processo_id });
    console.log('[Timeline] Processo completado');
  }

  /* --------------------------------------------------------------
     Internos
     -------------------------------------------------------------- */
  _bindEvents() {
    bus.on(EVENTS.PHYSIO_PLAY, () => this.play());
    bus.on(EVENTS.PHYSIO_PAUSE, () => this.pause());
    bus.on(EVENTS.PHYSIO_RESET, () => this.reset());
  }

  _enterStep(index) {
    if (!this._process) return;
    const etapa = this._process.etapas[index];
    if (!etapa) return;

    this._stepIndex = index;

    // Atualiza state
    dispatch({ type: ACTIONS.PHYSIO_SET_STEP, payload: index });

    // Câmera
    const cameraKey = etapa.acoes_3d?.camera_preset
      || this._process.camera_preset
      || this._inferCameraPreset();
    if (cameraKey && CAMERA_PRESETS[cameraKey]) {
      focusOn(cameraKey, 850, 'easeInOutCubic');
    }

    // Partículas
    this._spawnParticlesForStep(etapa);

    // Atualiza UI
    this._updateUIForStep(etapa, index);

    // Emite evento
    bus.emit(EVENTS.PHYSIO_STEP_CHANGED, {
      processoId: this._process.processo_id,
      stepIndex: index,
      step: etapa,
      totalSteps: this._process.etapas.length
    });

    // Reagenda se estiver tocando
    if (getState().physiology.isPlaying) {
      this._scheduleNext();
    }
  }

  _scheduleNext() {
    if (this._playTimer) clearTimeout(this._playTimer);
    const etapa = this._process?.etapas[this._stepIndex];
    const dur = etapa?.duracao_ms ?? 1500;
    this._playTimer = setTimeout(() => {
      this._playTimer = null;
      if (getState().physiology.isPlaying) {
        if (this._stepIndex >= this._process.etapas.length - 1) {
          this.complete();
        } else {
          this.next();
        }
      }
    }, dur);
  }

  _spawnParticlesForStep(etapa) {
    const p = etapa.particulas;
    if (!p || !p.waypoints || p.waypoints.length < 2) return;

    // Para o emissor anterior deste tipo
    this._stopEmittersByPreset(p.tipo);

    const emitterId = particleSystem.emit({
      waypoints: p.waypoints,
      preset: p.tipo,
      duration: (etapa.duracao_ms ?? 1500) / 1000,
      loop: false
    });

    this._activeEmitters.add(emitterId);
  }

  _stopEmittersByPreset(preset) {
    for (const id of [...this._activeEmitters]) {
      // particleSystem mantém referência interna; simplesmente pede stopAll de tipo
      // (implementação simplificada — usamos preset matching)
    }
    particleSystem.stopByPreset(preset);
    this._activeEmitters.clear();
  }

  _clearEmitters() {
    particleSystem.stopAll();
    this._activeEmitters.clear();
  }

  _inferCameraPreset() {
    const sys = this._process?.sistema_relacionado;
    const map = {
      digestorio: 'abdome',
      cardiovascular: 'coracao',
      respiratorio: 'pulmoes',
      nervoso: 'cabeca',
      urinario: 'abdome'
    };
    return map[sys] || 'home';
  }

  /* --------------------------------------------------------------
     UI
     -------------------------------------------------------------- */
  _renderStepsList() {
    const container = document.getElementById('timelineSteps');
    const nameEl = document.getElementById('timelineProcessName');
    const sysEl = document.getElementById('timelineSystem');

    if (!container || !this._process) return;

    if (nameEl) nameEl.textContent = this._process.nome;
    if (sysEl) sysEl.textContent = this._process.sistema_relacionado?.toUpperCase() || '—';

    container.innerHTML = this._process.etapas.map((etapa, i) => `
      <button class="timeline-step" data-step-index="${i}" role="listitem">
        <span class="step-bullet">${i + 1}</span>
        <div class="step-body">
          <span class="step-name">${escapeHtml(etapa.nome)}</span>
          <span class="step-dur">${etapa.duracao_ms} ms</span>
        </div>
      </button>
    `).join('');

    container.querySelectorAll('.timeline-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.stepIndex, 10);
        this.goto(idx);
      });
    });
  }

  _updateUIForStep(etapa, index) {
    // Destaca item da lista
    document.querySelectorAll('.timeline-step').forEach((el) => {
      el.classList.toggle('active', parseInt(el.dataset.stepIndex, 10) === index);
    });

    // Descrição
    const descEl = document.getElementById('timelineDesc');
    if (descEl) descEl.textContent = etapa.descricao || '—';

    // Progresso
    const total = this._process.etapas.length;
    const fill = document.getElementById('tlProgressFill');
    const label = document.getElementById('tlProgressLabel');
    if (fill) fill.style.width = `${((index + 1) / total) * 100}%`;
    if (label) label.textContent = `${index + 1} / ${total}`;

    // Habilita/desabilita botões
    const prev = document.getElementById('tlPrev');
    const next = document.getElementById('tlNext');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index >= total - 1;
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const timelineEngine = new TimelineEngine();

/* ================================================================
   BINDING DOS BOTÕES
   ================================================================ */
export function bindTimelineControls() {
  const playPause = document.getElementById('tlPlayPause');
  const prev = document.getElementById('tlPrev');
  const next = document.getElementById('tlNext');

  playPause?.addEventListener('click', () => {
    timelineEngine.toggle();
    playPause.textContent = getState().physiology.isPlaying ? '❚❚' : '▶';
  });

  prev?.addEventListener('click', () => timelineEngine.prev());
  next?.addEventListener('click', () => timelineEngine.next());

  // Sincroniza ícone com state
  bus.on(EVENTS.PHYSIO_PLAY, () => { if (playPause) playPause.textContent = '❚❚'; });
  bus.on(EVENTS.PHYSIO_PAUSE, () => { if (playPause) playPause.textContent = '▶'; });
}

export default timelineEngine;
