/**
 * LAIFT · Anatomia 3D
 * drug/simulator.js — Simulador Farmacocinético
 *
 * Responsável por:
 *   - Modelo PK compartimental simplificado (1 ou 2 compartimentos)
 *   - Cálculo de curva concentração-tempo
 *   - Efeitos por via de administração
 *   - Simulação de nanotecnologia
 *   - Geração de waypoints para partículas 3D
 */

import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState } from '../core/state.js';
import { particleSystem } from '../three/particles.js';
import { focusOn } from '../three/camera-tween.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const PK_CONFIG = {
  timeStep_h: 0.25,
  maxTime_h: 24,
  defaultDose_mg: 100
};

/**
 * Parâmetros por via de administração.
 * ka = constante de absorção (1/h)
 * F = biodisponibilidade (default do fármaco)
 */
const ROUTE_PARAMS = Object.freeze({
  oral:     { ka: 1.5, delay_h: 0.25, F_mult: 1.0, absorptionSite: 'TGI' },
  iv:       { ka: 999, delay_h: 0,    F_mult: 1.0, absorptionSite: null },
  sc:       { ka: 0.8, delay_h: 0.1,  F_mult: 0.9, absorptionSite: 'subcutâneo' },
  im:       { ka: 1.2, delay_h: 0.15, F_mult: 0.95, absorptionSite: 'muscular' },
  topical:  { ka: 0.3, delay_h: 0.5,  F_mult: 0.15, absorptionSite: 'pele' },
  inhaled:  { ka: 3.0, delay_h: 0.05, F_mult: 0.6, absorptionSite: 'pulmão' }
});

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class DrugSimulator {
  constructor() {
    this._initialized = false;
    this._activeEmitters = [];
  }

  init() {
    if (this._initialized) return this;
    this._initialized = true;
    console.log('[DrugSim] Inicializado');
    return this;
  }

  /* --------------------------------------------------------------
     API pública
     -------------------------------------------------------------- */

  /**
   * Executa a simulação com o fármaco ativo.
   */
  simulate() {
    const state = getState();
    const drugState = state.drug;

    if (!drugState.activeDrugId) {
      console.warn('[DrugSim] Nenhum fármaco selecionado');
      return null;
    }

    const drug = this._findDrug(drugState.activeDrugId);
    if (!drug) {
      console.warn(`[DrugSim] Fármaco "${drugState.activeDrugId}" não encontrado`);
      return null;
    }

    dispatch({ type: ACTIONS.DRUG_SET_RUNNING, payload: true });
    bus.emit(EVENTS.DRUG_SIMULATION_START, { drugId: drug.id, route: drugState.route });

    // 1) Curva PK
    const curve = this._computeCurve(drug, drugState);
    dispatch({ type: ACTIONS.DRUG_SET_CURVE, payload: curve });

    // 2) Resultados agregados
    const results = this._computeResults(curve, drug, drugState);
    dispatch({ type: ACTIONS.DRUG_SET_RESULTS, payload: results });

    // 3) Animação 3D
    this._animateInBody(drug, drugState);

    dispatch({ type: ACTIONS.DRUG_SET_RUNNING, payload: false });
    bus.emit(EVENTS.DRUG_SIMULATION_END, { results });

    return { curve, results };
  }

  /**
   * Modelo PK 1-compartimento com absorção de 1ª ordem:
   *   C(t) = (F × Dose × ka) / (Vd × (ka - ke)) × (e^(-ke·t) - e^(-ka·t))
   * Para IV: ka → ∞, reduzindo para C(t) = C0 × e^(-ke·t)
   */
  _computeCurve(drug, drugState) {
    const route = ROUTE_PARAMS[drugState.route] || ROUTE_PARAMS.oral;
    const dose = drugState.doseMg || drug.dose_usual_mg || PK_CONFIG.defaultDose_mg;
    const F = (drug.biodisponibilidade ?? 0.8) * route.F_mult;
    const Vd = (drug.volume_distribuicao_l_kg ?? 0.5) * 70; // assume 70 kg
    const halfLife = drug.meia_vida_h ?? 4;
    const ke = Math.log(2) / halfLife;
    const ka = route.ka;
    const delay = route.delay_h;

    const points = [];
    for (let t = 0; t <= PK_CONFIG.maxTime_h; t += PK_CONFIG.timeStep_h) {
      const tAbs = Math.max(0, t - delay);
      let conc;

      if (ka > 100) {
        // IV bolus
        const C0 = (F * dose) / Vd;
        conc = C0 * Math.exp(-ke * tAbs);
      } else {
        // 1ª ordem com absorção
        const C0 = (F * dose * ka) / (Vd * (ka - ke));
        conc = C0 * (Math.exp(-ke * tAbs) - Math.exp(-ka * tAbs));
      }

      // Nanotecnologia: altera perfil (liberação prolongada)
      if (drugState.nanotechnology) {
        conc = this._applyNanoModulation(conc, t, drugState);
      }

      points.push({ t: parseFloat(t.toFixed(2)), c: Math.max(0, conc) });
    }

    return points;
  }

  /**
   * Modulação por nanotecnologia:
   * - Aumenta meia-vida efetiva
   * - Reduz pico (Cmax) e mantém platô (steady state prolongado)
   * - Direcionamento: aumenta concentração no alvo
   */
  _applyNanoModulation(conc, t, drugState) {
    const nanoType = drugState.nanoType || 'liposome';
    const multiplierByType = {
      liposome: { peak: 0.6, tail: 1.8 },
      polymeric: { peak: 0.5, tail: 2.2 },
      micelle: { peak: 0.7, tail: 1.5 },
      dendrimer: { peak: 0.55, tail: 2.0 },
      metallic: { peak: 0.65, tail: 1.7 }
    };
    const m = multiplierByType[nanoType] || multiplierByType.liposome;

    // Peak reduz, tail aumenta (simula liberação sustentada)
    const peakingFactor = m.peak + (1 - m.peak) * Math.exp(-t / 2);
    const tailFactor = 1 + (m.tail - 1) * (t / PK_CONFIG.maxTime_h);

    return conc * peakingFactor * tailFactor;
  }

  /**
   * Métricas agregadas da simulação.
   */
  _computeResults(curve, drug, drugState) {
    const cmax = Math.max(...curve.map((p) => p.c));
    const tmax = curve.find((p) => p.c === cmax)?.t ?? 0;
    const auc = this._trapezoid(curve);
    const halfLife = drug.meia_vida_h ?? 4;
    const therapeuticIndex = drug.janela_terapeutica ? 'estreita' : 'ampla';

    // Direcionamento
    const targeting = drugState.targetLigand
      ? { ligand: drugState.targetLigand, affinityGain: 3.5 }
      : null;

    return {
      cmax: parseFloat(cmax.toFixed(2)),
      tmax: parseFloat(tmax.toFixed(2)),
      auc: parseFloat(auc.toFixed(2)),
      halfLife,
      tHalf: parseFloat((halfLife * 5).toFixed(2)),
      therapeuticIndex,
      targeting,
      nanotech: drugState.nanotechnology,
      nanoType: drugState.nanoType,
      route: drugState.route,
      dose: drugState.doseMg
    };
  }

  _trapezoid(curve) {
    let sum = 0;
    for (let i = 1; i < curve.length; i++) {
      const dt = curve[i].t - curve[i - 1].t;
      sum += ((curve[i].c + curve[i - 1].c) / 2) * dt;
    }
    return sum;
  }

  /* --------------------------------------------------------------
     ANIMAÇÃO NO CORPO 3D
     -------------------------------------------------------------- */
  _animateInBody(drug, drugState) {
    // Para emissores anteriores
    this._stopEmitters();

    const waypoints = this._getWaypointsForRoute(drugState.route, drugState.nanotechnology);

    // Câmera
    focusOn(this._getCameraForRoute(drugState.route), 900);

    // Emissor principal
    const preset = drugState.nanotechnology ? 'nano' : 'drug';
    const id = particleSystem.emit({
      waypoints,
      preset,
      duration: 6,
      loop: true
    });
    this._activeEmitters.push(id);

    // Anexa fármaco no viewer molecular
    if (drug.chembl_id || drug.pdb_alvo || drug.pubchem_cid) {
      bus.emit(EVENTS.MOL_SET_DRUG, {
        nome: drug.nome,
        smiles: drug.smiles,
        pdb_id: drug.pdb_alvo
      });
    }

    console.log(`[DrugSim] Animação iniciada: ${drug.nome} via ${drugState.route}`);
  }

  _getWaypointsForRoute(route, nano) {
    // Waypoints genéricos por via
    const routeWaypoints = {
      oral: [
        { x: -0.05, y: 1.68, z: 0.05 },
        { x: 0.0, y: 1.55, z: 0.0 },
        { x: -0.05, y: 1.15, z: 0.0 },
        { x: -0.08, y: 0.95, z: 0.02 },
        { x: 0.05, y: 0.90, z: 0.0 },
        { x: 0.10, y: 1.10, z: -0.05 },
        { x: 0.15, y: 1.25, z: 0.05 }
      ],
      iv: [
        { x: 0.18, y: 1.30, z: 0.10 },
        { x: 0.10, y: 1.28, z: 0.05 },
        { x: 0.08, y: 1.25, z: 0.0 },
        { x: 0.15, y: 1.25, z: 0.05 }
      ],
      sc: [
        { x: 0.05, y: 1.00, z: 0.10 },
        { x: 0.05, y: 1.05, z: 0.05 },
        { x: 0.10, y: 1.15, z: 0.02 },
        { x: 0.15, y: 1.25, z: 0.05 }
      ],
      im: [
        { x: -0.10, y: 1.05, z: 0.12 },
        { x: -0.05, y: 1.10, z: 0.08 },
        { x: 0.05, y: 1.20, z: 0.03 },
        { x: 0.15, y: 1.25, z: 0.05 }
      ],
      topical: [
        { x: 0.20, y: 1.45, z: 0.15 },
        { x: 0.15, y: 1.35, z: 0.10 },
        { x: 0.10, y: 1.25, z: 0.05 }
      ],
      inhaled: [
        { x: 0.02, y: 1.60, z: -0.02 },
        { x: -0.05, y: 1.45, z: -0.05 },
        { x: -0.10, y: 1.42, z: -0.02 },
        { x: 0.02, y: 1.40, z: 0.02 },
        { x: 0.15, y: 1.30, z: 0.05 }
      ]
    };

    let wp = routeWaypoints[route] || routeWaypoints.oral;

    // Nano: adiciona waypoint de acúmulo no alvo (simula EPR)
    if (nano) {
      wp = wp.concat([
        { x: 0.12, y: 0.95, z: 0.05 },
        { x: 0.10, y: 0.90, z: 0.02 },
        { x: 0.08, y: 0.88, z: 0.0 }
      ]);
    }

    return wp;
  }

  _getCameraForRoute(route) {
    const map = {
      oral: 'estomago',
      iv: 'coracao',
      sc: 'abdome',
      im: 'pernas',
      topical: 'bracos',
      inhaled: 'pulmoes'
    };
    return map[route] || 'home';
  }

  _stopEmitters() {
    for (const id of this._activeEmitters) {
      particleSystem.stop(id);
    }
    this._activeEmitters = [];
  }

  /* --------------------------------------------------------------
     UTILITÁRIOS
     -------------------------------------------------------------- */
  _findDrug(drugId) {
    const state = getState();
    const farmacos = state.data.farmacos?.farmacos || [];
    return farmacos.find((f) => f.id === drugId);
  }

  listDrugs() {
    return getState().data.farmacos?.farmacos || [];
  }

  /**
   * Sugere dose a partir do fármaco.
   */
  suggestDose(drugId) {
    const drug = this._findDrug(drugId);
    return drug?.dose_usual_mg ?? PK_CONFIG.defaultDose_mg;
  }

  /**
   * Compara duas configurações (ex: com vs sem nano).
   */
  compare(configA, configB) {
    const drugA = this._findDrug(configA.drugId);
    const drugB = this._findDrug(configB.drugId);
    if (!drugA || !drugB) return null;

    const curveA = this._computeCurve(drugA, configA);
    const curveB = this._computeCurve(drugB, configB);

    return {
      A: { curve: curveA, results: this._computeResults(curveA, drugA, configA) },
      B: { curve: curveB, results: this._computeResults(curveB, drugB, configB) }
    };
  }
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const drugSimulator = new DrugSimulator();

export default drugSimulator;
