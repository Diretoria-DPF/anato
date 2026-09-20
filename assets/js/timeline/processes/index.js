/**
 * LAIFT · Anatomia 3D
 * timeline/processes/index.js
 *
 * Registro central de todos os processos fisiológicos built-in.
 * Prioriza o JSON do backend; usa estes como fallback offline.
 */

import { DEGLUTICAO } from './degluticao.js';
import { CICLO_CARDIACO } from './ciclo-cardiaco.js';
import { FILTRACAO_GLOMERULAR } from './filtracao-glomerular.js';
import { PERISTALTISMO } from './peristaltismo.js';
import { HEMATOSE } from './hematose.js';

export const BUILTIN_PROCESSES = [
  DEGLUTICAO,
  CICLO_CARDIACO,
  FILTRACAO_GLOMERULAR,
  PERISTALTISMO,
  HEMATOSE
];

export const PROCESS_INDEX = {
  degluticao_humana: DEGLUTICAO,
  ciclo_cardiaco: CICLO_CARDIACO,
  filtracao_glomerular: FILTRACAO_GLOMERULAR,
  peristaltismo_intestinal: PERISTALTISMO,
  hematose_alveolar: HEMATOSE
};

export function getProcess(id) {
  return PROCESS_INDEX[id] || null;
}

export default BUILTIN_PROCESSES;
