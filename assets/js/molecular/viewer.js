/**
 * LAIFT · Anatomia 3D
 * molecular/viewer.js — Wrapper 3Dmol.js
 *
 * Responsável por:
 *   - Inicializar e controlar viewport 3Dmol.js
 *   - Aplicar estilos (cartoon, stick, sphere, surface)
 *   - Adicionar fármacos acoplados
 *   - Destacar resíduos específicos
 *   - Sincronizar com state global
 */

import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState } from '../core/state.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const VIEWER_CONFIG = {
  backgroundColor: '#0b0e14',
  defaultStyle: 'cartoon',
  antialias: true,
  cartoonQuality: 8
};

const STYLE_MAP = {
  cartoon: (viewer) => viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.95 } }),
  stick:   (viewer) => viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: 'Jmol' } }),
  sphere:  (viewer) => viewer.setStyle({}, { sphere: { scale: 0.5, colorscheme: 'Jmol' } }),
  surface: (viewer) => {
    viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.4 } });
    viewer.addSurface($3Dmol.SurfaceType.VDW, {
      opacity: 0.7,
      color: 'white'
    });
  }
};

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class MolecularViewer {
  constructor() {
    this.containerId = 'molCanvasWrapper';
    this.container = null;
    this.viewer = null;
    this._initialized = false;
    this._currentPdb = null;
    this._currentStyle = VIEWER_CONFIG.defaultStyle;
    this._drugModels = [];
    this._resizeHandler = null;
  }

  init() {
    if (this._initialized) return this;

    if (typeof $3Dmol === 'undefined') {
      console.warn('[MolecularViewer] 3Dmol.js não carregado');
      return this;
    }

    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.warn('[MolecularViewer] Container não encontrado');
      return this;
    }

    // Limpa o container (removendo loading)
    const loading = document.getElementById('molLoading');
    if (loading) loading.style.display = 'none';

    this.viewer = $3Dmol.createViewer(this.container, {
      backgroundColor: VIEWER_CONFIG.backgroundColor,
      antialias: VIEWER_CONFIG.antialias
    });

    // Resize
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);

    // Aplica estado atual
    this._syncFromState();

    this._initialized = true;
    console.log('[MolecularViewer] Inicializado');
    return this;
  }

  /* --------------------------------------------------------------
     API pública
     -------------------------------------------------------------- */

  /**
   * Carrega uma estrutura por PDB ID.
   * @param {string} pdbId
   * @param {Object} [opts]
   * @param {string} [opts.name] - nome legível
   * @param {Function} [opts.onReady]
   */
  async loadPdb(pdbId, opts = {}) {
    if (!this._initialized) this.init();
    if (!this.viewer) throw new Error('[MolecularViewer] Viewer não inicializado');

    pdbId = String(pdbId || '').toUpperCase();
    if (!pdbId) throw new Error('[MolecularViewer] pdbId obrigatório');

    this._showLoading(true);
    dispatch({ type: ACTIONS.MOL_SET_LOADING, payload: true });
    dispatch({ type: ACTIONS.MOL_SET_ERROR, payload: null });
    dispatch({ type: ACTIONS.MOL_SET_PDB, payload: pdbId });
    if (opts.name) dispatch({ type: ACTIONS.MOL_SET_NAME, payload: opts.name });
    dispatch({ type: ACTIONS.MOL_SET_SOURCE, payload: 'rcsb' });

    bus.emit(EVENTS.MOL_LOADING, { pdbId });

    return new Promise((resolve, reject) => {
      try {
        this.viewer.clear();
        this.viewer.removeAllSurfaces();
        this._drugModels = [];

        this.viewer.addModel(
          `https://files.rcsb.org/download/${pdbId}.pdb`,
          'pdb',
          {
            success: () => {
              this._currentPdb = pdbId;
              this._applyStyle(this._currentStyle);
              this.viewer.zoomTo();
              this.viewer.render();
              this._updateMolInfo(pdbId, opts.name);

              dispatch({ type: ACTIONS.MOL_SET_LOADING, payload: false });
              dispatch({ type: ACTIONS.MOL_SET_LOADED, payload: true });

              this._showLoading(false);
              bus.emit(EVENTS.MOL_LOADED, { pdbId, name: opts.name });
              console.log(`[MolecularViewer] PDB ${pdbId} carregado`);
              opts.onReady?.();
              resolve({ pdbId });
            },
            error: (err) => {
              const error = new Error(`Falha ao carregar PDB ${pdbId}`);
              dispatch({ type: ACTIONS.MOL_SET_LOADING, payload: false });
              dispatch({ type: ACTIONS.MOL_SET_ERROR, payload: error.message });
              this._showLoading(false);
              bus.emit(EVENTS.MOL_LOAD_ERROR, { pdbId, error });
              reject(error);
            }
          }
        );
      } catch (err) {
        dispatch({ type: ACTIONS.MOL_SET_LOADING, payload: false });
        dispatch({ type: ACTIONS.MOL_SET_ERROR, payload: err.message });
        this._showLoading(false);
        reject(err);
      }
    });
  }

  /**
   * Aplica estilo de renderização.
   */
  setStyle(styleName) {
    if (!STYLE_MAP[styleName]) {
      console.warn(`[MolecularViewer] Estilo inválido: ${styleName}`);
      return;
    }
    this._currentStyle = styleName;
    dispatch({ type: ACTIONS.MOL_SET_STYLE, payload: styleName });

    if (!this.viewer || !this._currentPdb) return;

    this.viewer.removeAllSurfaces();
    this.viewer.setStyle({}, {});
    STYLE_MAP[styleName](this.viewer);
    this.viewer.render();

    bus.emit(EVENTS.MOL_STYLE_CHANGED, { style: styleName });
  }

  /**
   * Destaca um resíduo específico.
   */
  highlightResidue(chain, resi) {
    if (!this.viewer) return;
    this.viewer.addStyle(
      { chain, resi },
      { stick: { colorscheme: 'greenCarbon', radius: 0.2 } }
    );
    this.viewer.render();
    bus.emit(EVENTS.MOL_RESIDUE_CLICKED, { chain, resi });
  }

  /**
   * Adiciona um fármaco acoplado (a partir de SMILES ou PDB ID).
   */
  async attachDrug(drug) {
    if (!this.viewer) return;

    try {
      // Se tem SMILES, adiciona como modelo
      if (drug.smiles) {
        const model = this.viewer.addModel(drug.smiles, 'sdf');
        model.setStyle({}, { stick: { colorscheme: 'orangeCarbon', radius: 0.18 } });
        this._drugModels.push(model);
      }
      // Se tem PDB ID (complexo proteína-ligante), adiciona como modelo separado
      else if (drug.pdb_id) {
        this.viewer.addModel(
          `https://files.rcsb.org/download/${drug.pdb_id}.pdb`,
          'pdb',
          {
            success: () => {
              this.viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.7 } });
              this.viewer.addStyle(
                { hetflag: true },
                { stick: { colorscheme: 'orangeCarbon', radius: 0.2 } }
              );
              this.viewer.render();
            }
          }
        );
      }

      dispatch({ type: ACTIONS.MOL_SET_DRUG, payload: drug });
      this.viewer.render();
      console.log(`[MolecularViewer] Fármaco acoplado: ${drug.nome || drug.name}`);
    } catch (err) {
      console.error('[MolecularViewer] Erro ao acoplar fármaco:', err);
    }
  }

  /**
   * Remove o fármaco acoplado.
   */
  detachDrug() {
    if (!this.viewer) return;
    for (const m of this._drugModels) {
      try { this.viewer.removeModel(m); } catch {}
    }
    this._drugModels = [];
    dispatch({ type: ACTIONS.MOL_SET_DRUG, payload: null });
    this.viewer.render();
  }

  /**
   * Limpa o viewer.
   */
  clear() {
    if (!this.viewer) return;
    this.viewer.clear();
    this.viewer.removeAllSurfaces();
    this._currentPdb = null;
    this._drugModels = [];
    this._updateMolInfo(null, null);
    dispatch({ type: ACTIONS.MOL_RESET });
  }

  resize() {
    if (this.viewer) {
      try { this.viewer.resize(); } catch {}
      try { this.viewer.render(); } catch {}
    }
  }

  /* --------------------------------------------------------------
     Internos
     -------------------------------------------------------------- */
  _applyStyle(styleName) {
    if (!this.viewer) return;
    STYLE_MAP[styleName]?.(this.viewer);
  }

  _showLoading(show) {
    const loading = document.getElementById('molLoading');
    if (loading) loading.style.display = show ? 'grid' : 'none';
  }

  _updateMolInfo(pdbId, name) {
    const elPdb = document.getElementById('molPdbId');
    const elName = document.getElementById('molName');
    if (elPdb) elPdb.textContent = pdbId ? `PDB: ${pdbId}` : '—';
    if (elName) elName.textContent = name || (pdbId ? 'Estrutura carregada' : 'Nenhuma estrutura carregada');
  }

  _syncFromState() {
    const mol = getState().molecular;
    if (mol.viewerStyle) this._currentStyle = mol.viewerStyle;
  }

  dispose() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this.viewer?.clear();
    this.viewer = null;
    this._initialized = false;
  }
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const molecularViewer = new MolecularViewer();

/* ================================================================
   BINDING DOS BOTÕES DE ESTILO
   ================================================================ */
export function bindMolecularStyleButtons() {
  const btns = document.querySelectorAll('#molViewport [data-style]');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      molecularViewer.setStyle(btn.dataset.style);
    });
  });
}

export default molecularViewer;
