/**
 * LAIFT · Anatomia 3D
 * timeline/processes/ciclo-cardiaco.js
 */
export const CICLO_CARDIACO = {
  processo_id: 'ciclo_cardiaco',
  nome: 'Ciclo Cardíaco',
  sistema_relacionado: 'cardiovascular',
  camera_preset: 'coracao',
  duracao_total_ms: 800,
  resumo: 'Sequência de eventos elétricos e mecânicos de um batimento.',
  etapas: [
    { ordem: 1, nome: 'Diástole Ventricular', duracao_ms: 400,
      descricao: 'Relaxamento ventricular, abertura das valvas AV, enchimento passivo (70%) e ativo (30%).',
      acoes_3d: { camera_preset: 'coracao', animacao: 'relaxamento_ventricular' },
      particulas: { tipo: 'blood', waypoints: [
        { x: 0.15, y: 1.25, z: 0.05 },
        { x: 0.10, y: 1.22, z: 0.02 },
        { x: 0.05, y: 1.20, z: 0.0 }
      ]}},
    { ordem: 2, nome: 'Sístole Atrial', duracao_ms: 100,
      descricao: 'Contração atrial completa o enchimento ventricular.',
      acoes_3d: { animacao: 'contracao_atrial' },
      particulas: { tipo: 'blood', waypoints: [
        { x: 0.10, y: 1.22, z: 0.02 },
        { x: 0.05, y: 1.20, z: 0.0 }
      ]}},
    { ordem: 3, nome: 'Sístole - Isovolumétrica', duracao_ms: 50,
      descricao: 'Valvas fechadas; pressão sobe sem mudança de volume (1ª bulha).',
      acoes_3d: { animacao: 'contracao_isovolumetrica' } },
    { ordem: 4, nome: 'Sístole - Ejeção', duracao_ms: 200,
      descricao: 'Valvas semilunares abrem; ~70 mL ejetados na aorta e tronco pulmonar.',
      acoes_3d: { animacao: 'ejecao_ventricular' },
      particulas: { tipo: 'blood', waypoints: [
        { x: 0.05, y: 1.20, z: 0.0 },
        { x: 0.08, y: 1.30, z: -0.03 },
        { x: 0.05, y: 1.40, z: -0.05 }
      ]}},
    { ordem: 5, nome: 'Relaxamento Isovolumétrico', duracao_ms: 50,
      descricao: 'Fechamento das valvas semilunares (2ª bulha); início da diástole.',
      acoes_3d: { animacao: 'relaxamento_isovolumetrico' } }
  ],
  bulhas_cardiacas: [
    { nome: 'B1', origem: 'Fechamento das valvas AV' },
    { nome: 'B2', origem: 'Fechamento das valvas semilunares' }
  ]
};
export default CICLO_CARDIACO;
