/**
 * LAIFT · Anatomia 3D
 * timeline/processes/peristaltismo.js
 *
 * Processo completo de peristaltismo intestinal com tipologia de movimentos,
 * segmentação, ondas migratórias e correlações clínicas.
 *
 * Referência: Guyton & Hall, Cap. 63-64 (Motilidade Gastrointestinal).
 */

export const PERISTALTISMO = {
  processo_id: 'peristaltismo_intestinal',
  nome: 'Peristaltismo Intestinal',
  nome_cientifico: 'Motilitas peristaltica intestinalis',
  sistema_relacionado: 'digestorio',
  camera_preset: 'abdome',
  duracao_total_ms: 6000,
  resumo: 'Movimentos coordenados da musculatura lisa intestinal que propulsionam o quimo/quilo ao longo do TGI. Composto por peristaltismo (propulsão) e segmentação (mistura), ambos modulados pelo sistema nervoso entérico (plexo de Auerbach e Meissner).',

  // ---------------------------------------------------------------
  // ETAPAS
  // ---------------------------------------------------------------
  etapas: [
    {
      ordem: 1,
      nome: 'Distensão da Parede Intestinal',
      duracao_ms: 800,
      descricao: 'A chegada do quimo distende a parede intestinal, ativando mecanorreceptores na camada submucosa e muscular. Estímulo inicial para o reflexo peristáltico.',
      estruturas_envolvidas: [
        'muscular_mucosa',
        'submucosa',
        'muscular_circular',
        'muscular_longitudinal',
        'mecanorreceptores'
      ],
      celulas_envolvidas: [
        { nome: 'Células de Cajal', funcao: 'Marcapasso entérico (geram ondas lentas)' },
        { nome: 'Neurônios sensitivos entéricos', funcao: 'Detectam distensão' }
      ],
      estimulo: 'Distensão por conteúdo intraluminal',
      acoes_3d: {
        camera_preset: 'abdome',
        mover_malha: 'mesh_small_intestine',
        animacao: 'distensao_parede',
        focus_mesh: 'mesh_duodenum'
      }
    },
    {
      ordem: 2,
      nome: 'Ativação do Reflexo Mioentérico',
      duracao_ms: 1200,
      descricao: 'Ativação do plexo de Auerbach (mioentérico) gera resposta coordenada: contração da musculatura circular ACIMA do bolo e relaxamento ABAIXO (lei do intestino). Este padrão garante propulsão unidirecional aboral.',
      plexos_envolvidos: [
        {
          nome: 'Plexo de Auerbach (mioentérico)',
          localizacao: 'Entre as camadas circular e longitudinal',
          funcao: 'Controle da motilidade'
        },
        {
          nome: 'Plexo de Meissner (submucoso)',
          localizacao: 'Na submucosa',
          funcao: 'Controle da secreção e fluxo sanguíneo local'
        }
      ],
      neurotransmissores: [
        { nome: 'Acetilcolina', efeito: 'Excitatório (contração acima do bolo)' },
        { nome: 'Substância P', efeito: 'Excitatório' },
        { nome: 'VIP', efeito: 'Inibitório (relaxamento abaixo do bolo)' },
        { nome: 'Óxido Nítrico (NO)', efeito: 'Inibitório (relaxamento)' },
        { nome: 'Serotonina (5-HT)', efeito: 'Modulador (ativa reflexos peristálticos)' }
      ],
      acoes_3d: {
        animacao: 'reflexo_peristaltico',
        focus_mesh: 'mesh_duodenum'
      },
      particulas: {
        tipo: 'bolus',
        waypoints: [
          { x: 0.0, y: 0.95, z: 0.0 },
          { x: 0.03, y: 0.92, z: 0.02 },
          { x: 0.02, y: 0.89, z: 0.01 }
        ]
      }
    },
    {
      ordem: 3,
      nome: 'Propagação da Onda Peristáltica',
      duracao_ms: 1500,
      descricao: 'A onda peristáltica se propaga no sentido aboral a ~5 cm/s, com contração circular de 2-3 cm de extensão. O conteúdo é impulsionado ~10 cm por onda.',
      velocidade_propagacao: '5 cm/s',
      extensao_contracao: '2-3 cm',
      deslocamento_por_onda: '10 cm',
      acoes_3d: {
        animacao: 'onda_peristaltica_intestinal',
        focus_mesh: 'mesh_small_intestine'
      },
      particulas: {
        tipo: 'bolus',
        waypoints: [
          { x: 0.02, y: 0.89, z: 0.01 },
          { x: 0.03, y: 0.86, z: -0.02 },
          { x: 0.0, y: 0.83, z: -0.01 },
          { x: -0.03, y: 0.80, z: 0.02 }
        ]
      }
    },
    {
      ordem: 4,
      nome: 'Segmentação (Mistura)',
      duracao_ms: 1000,
      descricao: 'Contrações localizadas e não-propulsivas da musculatura circular dividem o quimo em segmentos, misturando-o com enzimas e aumentando o contato com a mucosa para absorção.',
      caracteristica: 'Não-propulsivo (mistura)',
      frequencia: '8-12 contrações/min (intestino delgado)',
      funcao_principal: 'Mistura com sucos digestivos e contato com vilosidades',
      acoes_3d: {
        animacao: 'segmentacao_intestinal',
        focus_mesh: 'mesh_jejunum'
      }
    },
    {
      ordem: 5,
      nome: 'Complexo Motor Migratório (CMM)',
      duracao_ms: 1000,
      descricao: 'Durante o jejum, ondas peristálticas intensas (CMM) varrem o intestino a cada 90-120 minutos, removendo resíduos e prevenindo proliferação bacteriana. Dividido em 4 fases (I-IV).',
      fases: [
        { fase: 'I', nome: 'Quiescência', duracao_min: '40-60' },
        { fase: 'II', nome: 'Contrações irregulares', duracao_min: '20-30' },
        { fase: 'III', nome: 'Contrações intensas', duracao_min: '5-10' },
        { fase: 'IV', nome: 'Transição', duracao_min: '0-5' }
      ],
      hormonio_ativador: 'Motilina',
      acoes_3d: {
        animacao: 'CMM_peristaltismo',
        focus_mesh: 'mesh_small_intestine'
      }
    },
    {
      ordem: 6,
      nome: 'Chegada ao Cólon',
      duracao_ms: 500,
      descricao: 'O quilo entra no ceco via válvula ileocecal, prevenindo refluxo. No cólon, o peristaltismo é mais lento (1-3/min) e inclui movimentos de massa (3-4×/dia) que propulsionam fezes ao reto.',
      valvulas: ['Válvula ileocecal (prevenção de refluxo)'],
      movimentos_colon: [
        { nome: 'Haustrações', funcao: 'Mistura e absorção de água' },
        { nome: 'Movimentos de massa', funcao: 'Propulsão ao reto (3-4×/dia)' },
        { nome: 'Peristaltismo antiperistáltico', funcao: 'Retém conteúdo no cólon ascendente' }
      ],
      acoes_3d: {
        animacao: 'chegada_colon',
        focus_mesh: 'mesh_cecum'
      }
    }
  ],

  // ---------------------------------------------------------------
  // TIPOS DE MOVIMENTO
  // ---------------------------------------------------------------
  tipos_movimento: [
    {
      nome: 'Peristaltismo',
      funcao: 'Propulsão',
      mecanismo: 'Contração acima + relaxamento abaixo do bolo',
      frequencia_por_segmento: {
        esofago: '3-5/min',
        estomago_antral: '3/min',
        intestino_delgado: '8-12/min',
        colon: '1-3/min'
      }
    },
    {
      nome: 'Segmentação',
      funcao: 'Mistura',
      mecanismo: 'Contrações circulares localizadas e não-propulsivas',
      frequencia: '8-12/min (intestino delgado)'
    },
    {
      nome: 'Movimentos de massa',
      funcao: 'Propulsão em massa',
      mecanismo: 'Contrações intensas e prolongadas do cólon',
      frequencia: '3-4×/dia (após refeições)'
    },
    {
      nome: 'Complexo Motor Migratório (CMM)',
      funcao: 'Limpeza (jejum)',
      mecanismo: 'Ondas peristálticas intensas que varrem o intestino',
      frequencia: 'A cada 90-120 min no jejum'
    }
  ],

  // ---------------------------------------------------------------
  // CONTROLE NEURO-HORMONAL
  // ---------------------------------------------------------------
  controle: {
    sistema_nervoso_enterico: {
      plexo_mioenterico_auerbach: 'Controle motor (peristaltismo)',
      plexo_submucoso_meissner: 'Controle secretor e vascular'
    },
    modulacao_autonomica: {
      parassimpatico: { efeito: 'Excitatório (aumenta motilidade)', nervo: 'Vago e pélvicos' },
      simpatico: { efeito: 'Inibitório (reduz motilidade)', nervos: 'Esplâncnicos' }
    },
    hormonios_gi: [
      { nome: 'Motilina', efeito: 'Inicia CMM no jejum', origem: 'Células M (duodeno)' },
      { nome: 'Gastrina', efeito: 'Aumenta motilidade gástrica e colônica', origem: 'Células G (antro)' },
      { nome: 'CCK', efeito: 'Retarda esvaziamento gástrico, aumenta motilidade intestinal', origem: 'Células I (duodeno)' },
      { nome: 'Secretina', efeito: 'Reduz motilidade gástrica', origem: 'Células S (duodeno)' },
      { nome: 'Grelina', efeito: 'Aumenta motilidade (estimula fome)', origem: 'Estômago' },
      { nome: 'Peptídeo YY (PYY)', efeito: 'Reduz motilidade (saciedade)', origem: 'Íleo e cólon' }
    ],
    reflexos_envolvidos: [
      { nome: 'Reflexo gastrocólico', estimulo: 'Distensão gástrica → aumento do peristaltismo colônico' },
      { nome: 'Reflexo enterogástrico', estimulo: 'Distensão intestinal → redução do esvaziamento gástrico' },
      { nome: 'Reflexo peritoneointestinal', estimulo: 'Irritação peritoneal → inibição do peristaltismo (íleo paralítico)' }
    ]
  },

  // ---------------------------------------------------------------
  // ENZIMAS E SUCO DIGESTIVO
  // ---------------------------------------------------------------
  enzimas_envolvidas: [
    { nome: 'Amilase pancreática', pdb_id: '1PIF', substrato: 'Amido', produto: 'Maltose' },
    { nome: 'Tripsina', pdb_id: '1TRN', substrato: 'Proteínas', produto: 'Peptídeos' },
    { nome: 'Quimotripsina', pdb_id: '1CHG', substrato: 'Proteínas', produto: 'Peptídeos' },
    { nome: 'Lipase pancreática', pdb_id: '1LPA', substrato: 'Triglicerídeos', produto: 'Ácidos graxos + monoglicerídeos' },
    { nome: 'Carboxipeptidase A', pdb_id: '1CPB', substrato: 'Peptídeos', produto: 'Aminoácidos' }
  ],

  // ---------------------------------------------------------------
  // PARÂMETROS FISIOLÓGICOS
  // ---------------------------------------------------------------
  parametros: {
    tempo_transito_total: '24-72h (normal)',
    tempo_esofago: '5-10 s',
    tempo_estomago: '2-4 h',
    tempo_intestino_delgado: '4-6 h',
    tempo_colon: '12-48 h',
    velocidade_peristalse: '5 cm/s (intestino delgado)',
    conteudo_transitado_diario: '~9 L (ingestão + secreções)',
    volume_absorvido_intestino_delgado: '~7 L',
    volume_absorvido_colon: '~1.4 L',
    volume_fezes: '~100-200 mL'
  },

  // ---------------------------------------------------------------
  // PATOLOGIAS ASSOCIADAS
  // ---------------------------------------------------------------
  patologias_associadas: [
    {
      nome: 'Íleo Paralítico',
      cid: 'K56.0',
      descricao: 'Ausência de peristaltismo, com distensão abdominal e ausência de ruídos',
      causas: ['Pós-operatório', 'Desequilíbrio eletrolítico (hipocalemia)', 'Peritonite', 'Fármacos (opioides)']
    },
    {
      nome: 'Íleo Mecânico (Obstrução)',
      cid: 'K56.6',
      descricao: 'Bloqueio mecânico com peristaltismo intenso (cólica), vômitos e distensão',
      causas: ['Aderências', 'Hérnias', 'Tumores', 'Volvo']
    },
    {
      nome: 'Síndrome do Intestino Irritável (SII)',
      cid: 'K58',
      descricao: 'Alteração da motilidade com dor abdominal, diarreia ou constipação',
      mecanismos: ['Hipersensibilidade visceral', 'Disbiose', 'Alteração do eixo cérebro-intestino']
    },
    {
      nome: 'Doença de Hirschsprung',
      cid: 'Q43.1',
      descricao: 'Ausência congênita de células ganglionares (plexo mioentérico) em segmento do cólon',
      consequencia: 'Ausência de peristaltismo no segmento afetado (megacólon)'
    },
    {
      nome: 'Gastroparesia',
      cid: 'K31.84',
      descricao: 'Esvaziamento gástrico retardado sem obstrução mecânica',
      causas: ['Diabetes (neuropatia autonômica)', 'Idiopática', 'Pós-viral']
    },
    {
      nome: 'Constipação crônica',
      cid: 'K59.0',
      descricao: 'Menos de 3 evacuações/semana, com esforço e fezes endurecidas',
      subtipos: ['Trânsito lento', 'Disquezia (obstrução funcional)', 'SII-constipação']
    }
  ],

  // ---------------------------------------------------------------
  // FÁRMACOS RELACIONADOS
  // ---------------------------------------------------------------
  farmacos_relacionados: [
    {
      nome: 'Metoclopramida',
      classe: 'Procinético / Anti-emético',
      mecanismo: 'Antagonista dopaminérgico D2 + agonista 5-HT4',
      efeito: 'Acelera esvaziamento gástrico e trânsito intestinal'
    },
    {
      nome: 'Domperidona',
      classe: 'Procinético',
      mecanismo: 'Antagonista dopaminérgico periférico D2',
      efeito: 'Acelera esvaziamento gástrico sem efeitos centrais'
    },
    {
      nome: 'Loperamida',
      classe: 'Antidiarreico',
      mecanismo: 'Agonista opioide periférico (μ)',
      efeito: 'Reduz motilidade intestinal (aumenta tempo de trânsito)'
    },
    {
      nome: 'Ondansetrona',
      classe: 'Anti-emético',
      mecanismo: 'Antagonista 5-HT3',
      efeito: 'Reduz náusea/vômito (bloqueia reflexo vagal)'
    },
    {
      nome: 'Prucaloprida',
      classe: 'Procinético',
      mecanismo: 'Agonista seletivo 5-HT4',
      efeito: 'Acelera trânsito colônico (constipação crônica)'
    },
    {
      nome: 'Lubiprostona',
      classe: 'Secretagogo / Procinético',
      mecanismo: 'Ativa canais de cloreto tipo 2 (ClC-2)',
      efeito: 'Aumenta secreção intestinal e motilidade'
    }
  ],

  // ---------------------------------------------------------------
  // REFERÊNCIAS
  // ---------------------------------------------------------------
  referencias: [
    'Guyton & Hall — Tratado de Fisiologia Médica, Caps. 63-64',
    'Silverthorn — Fisiologia Humana, Cap. 21',
    'Rome Foundation — Rome IV Criteria for Functional GI Disorders'
  ]
};

export default PERISTALTISMO;
