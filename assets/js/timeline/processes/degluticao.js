/**
 * LAIFT · Anatomia 3D
 * timeline/processes/degluticao.js
 *
 * Definição detalhada da deglutição humana com hooks de animação 3D.
 * Substitui dados do JSON quando o backend não estiver disponível (offline-first).
 */

export const DEGLUTICAO = {
  processo_id: 'degluticao_humana',
  nome: 'Deglutição Humana',
  sistema_relacionado: 'digestorio',
  camera_preset: 'cabeca',
  duracao_total_ms: 3000,
  resumo: 'Processo neuromuscular que transfere o bolo alimentar da cavidade oral ao estômago.',

  etapas: [
    {
      ordem: 1,
      nome: 'Fase Oral (Voluntária)',
      duracao_ms: 1000,
      descricao: 'Mastigação e propulsão do bolo alimentar pela língua contra o palato duro.',
      musculos_envolvidos: ['masseter', 'temporal', 'pterigóideos', 'linguais'],
      nervos: ['V3', 'XII', 'VII'],
      enzimas_atuantes: ['amilase_salivar', 'lipase_lingual'],
      acoes_3d: {
        camera_preset: 'cabeca',
        mover_malha: 'mesh_tongue',
        animacao: 'elevacao_palato'
      },
      particulas: {
        tipo: 'saliva',
        waypoints: [
          { x: -0.05, y: 1.68, z: 0.05 },
          { x: 0.0,  y: 1.65, z: 0.0 },
          { x: 0.02, y: 1.60, z: -0.03 }
        ]
      }
    },
    {
      ordem: 2,
      nome: 'Fase Faríngea (Involuntária)',
      duracao_ms: 1000,
      descricao: 'Fechamento da nasofaringe, abaixamento da epiglote e apneia de deglutição.',
      musculos_envolvidos: ['constritor_superior_faringe', 'palatofaríngeo'],
      nervos: ['IX', 'X'],
      apneia_ms: 600,
      acoes_3d: {
        camera_preset: 'cabeca',
        mover_malha: 'mesh_epiglottis',
        animacao: 'fechamento_laringe'
      },
      particulas: {
        tipo: 'bolus',
        waypoints: [
          { x: 0.02, y: 1.60, z: -0.03 },
          { x: 0.02, y: 1.48, z: -0.05 },
          { x: 0.01, y: 1.38, z: -0.04 }
        ]
      }
    },
    {
      ordem: 3,
      nome: 'Fase Esofágica',
      duracao_ms: 800,
      descricao: 'Peristaltismo primário e secundário conduz o bolo até o esfíncter esofágico inferior.',
      plexos: ['Auerbach', 'Meissner'],
      neurotransmissores: ['acetilcolina', 'VIP', 'NO'],
      acoes_3d: {
        camera_preset: 'torax',
        animacao: 'onda_peristaltica'
      },
      particulas: {
        tipo: 'bolus',
        waypoints: [
          { x: 0.01, y: 1.38, z: -0.04 },
          { x: 0.0,  y: 1.20, z: -0.02 },
          { x: -0.05, y: 1.05, z: 0.0 }
        ]
      }
    },
    {
      ordem: 4,
      nome: 'Relaxamento Receptivo Gástrico',
      duracao_ms: 200,
      descricao: 'Abertura do EEI mediada por VIP e NO, com relaxamento do fundo gástrico.',
      neurotransmissores: ['VIP', 'oxido_nitrico'],
      nervos: ['X (vago)'],
      acoes_3d: {
        camera_preset: 'estomago',
        animacao: 'abertura_EEI'
      },
      particulas: {
        tipo: 'bolus',
        waypoints: [
          { x: -0.05, y: 1.05, z: 0.0 },
          { x: -0.08, y: 1.02, z: 0.02 },
          { x: -0.10, y: 0.98, z: 0.03 }
        ]
      }
    }
  ],

  enzimas_envolvidas: [
    { nome: 'Amilase salivar', pdb_id: '1SMD', substrato: 'Amido', produto: 'Maltose' },
    { nome: 'Lipase lingual', pdb_id: '1LPA', substrato: 'Triglicerídeos', produto: 'Ácidos graxos' }
  ],

  patologias_associadas: [
    { nome: 'Disfagia', cid: 'R13' },
    { nome: 'Acalásia', cid: 'K22.0' },
    { nome: 'DRGE', cid: 'K21' }
  ]
};

export default DEGLUTICAO;
