/**
 * LAIFT · Anatomia 3D
 * timeline/processes/filtracao-glomerular.js
 *
 * Processo completo de filtração glomerular com metadata detalhada,
 * waypoints precisos, parâmetros fisiológicos e correlações clínicas.
 *
 * Referência: Guyton & Hall, Cap. 26-28 (Formação da Urina).
 */

export const FILTRACAO_GLOMERULAR = {
  processo_id: 'filtracao_glomerular',
  nome: 'Filtração Glomerular',
  nome_cientifico: 'Filtratio glomerularis',
  sistema_relacionado: 'urinario',
  camera_preset: 'abdome',
  duracao_total_ms: 2400,
  resumo: 'Primeira etapa da formação da urina, ocorrendo no corpúsculo renal (glomérulo + cápsula de Bowman). Ocorre ultrafiltração do plasma através da barreira de filtração, com taxa de filtração glomerular (TFG) de ~125 mL/min.',

  // ---------------------------------------------------------------
  // ETAPAS
  // ---------------------------------------------------------------
  etapas: [
    {
      ordem: 1,
      nome: 'Chegada do Sangue pela Arteríola Aferente',
      duracao_ms: 400,
      descricao: 'Sangue arterial chega ao glomérulo através da arteríola aferente, cujo diâmetro maior que a eferente gera alta pressão hidrostática capilar (~60 mmHg) — essencial para a filtração.',
      estruturas_envolvidas: [
        'arteriola_aferente',
        'arteriola_eferente',
        'capilares_glomerulares',
        'corpusculo_renal'
      ],
      pressao_hidrostatica_mmHg: 60,
      acoes_3d: {
        camera_preset: 'abdome',
        mover_malha: 'mesh_kidney_right',
        animacao: 'fluxo_sanguineo_glomerular',
        focus_mesh: 'mesh_renal_corpuscle'
      },
      particulas: {
        tipo: 'blood',
        waypoints: [
          { x: 0.15, y: 1.00, z: 0.05 },
          { x: 0.12, y: 0.97, z: 0.03 },
          { x: 0.08, y: 0.95, z: 0.02 },
          { x: 0.05, y: 0.93, z: 0.01 }
        ]
      }
    },
    {
      ordem: 2,
      nome: 'Barreira de Filtração',
      duracao_ms: 700,
      descricao: 'O plasma atravessa 3 camadas: (1) endotélio fenestrado (poros 70-90 nm), (2) membrana basal glomerular (colágeno IV, laminina, carga negativa), (3) fendas de filtração entre podócitos (diafragma de nefrina). Moléculas < 5 kDa passam livremente; > 70 kDa são retidas.',
      estruturas_envolvidas: [
        'endotelio_fenestrado',
        'membrana_basal_glomerular',
        'podocitos',
        'diafragma_fenda_filtracao'
      ],
      proteinas_chave: [
        { nome: 'Nefrina', funcao: 'Forma o diafragma da fenda de filtração', gene: 'NPHS1' },
        { nome: 'Podocina', funcao: 'Ancoragem do diafragma ao citoesqueleto', gene: 'NPHS2' },
        { nome: 'Colágeno IV (α3α4α5)', funcao: 'Estrutura da MBG', gene: 'COL4A3/A4/A5' }
      ],
      tamanho_poro_nm: 8,
      carga_barreira: 'negativa (repulsão de proteínas aniônicas)',
      acoes_3d: {
        animacao: 'ultrafiltracao_3_camadas',
        focus_mesh: 'mesh_glomerular_barrier'
      },
      particulas: {
        tipo: 'ions',
        waypoints: [
          { x: 0.05, y: 0.93, z: 0.01 },
          { x: 0.03, y: 0.91, z: 0.0 },
          { x: 0.0, y: 0.89, z: -0.01 }
        ]
      }
    },
    {
      ordem: 3,
      nome: 'Formação do Ultrafiltrado',
      duracao_ms: 600,
      descricao: 'O ultrafiltrado (filtrado primário) acumula-se no espaço de Bowman. Composição: água, glicose, aminoácidos, eletrólitos, ureia, creatinina, ácido úrico — sem proteínas nem células. Volume: 180 L/dia (99% reabsorvido).',
      estruturas_envolvidas: [
        'espaco_bowman',
        'tubulo_contorcido_proximal'
      ],
      composicao_ultrafiltrado: {
        agua: '99%',
        glicose_mg_dL: 100,
        sodio_mEq_L: 140,
        potassio_mEq_L: 4,
        ureia_mg_dL: 15,
        creatinina_mg_dL: 1.0,
        proteinas: 'praticamente ausentes (< 0.03 g/dL)'
      },
      acoes_3d: {
        animacao: 'formacao_ultrafiltrado',
        focus_mesh: 'mesh_bowman_capsule'
      },
      particulas: {
        tipo: 'ions',
        waypoints: [
          { x: 0.0, y: 0.89, z: -0.01 },
          { x: -0.02, y: 0.88, z: -0.02 },
          { x: -0.03, y: 0.87, z: -0.03 }
        ]
      }
    },
    {
      ordem: 4,
      nome: 'Determinantes da TFG',
      duracao_ms: 400,
      descricao: 'A TFG depende de: (1) Pressão hidrostática glomerular (favorece, +60 mmHg), (2) Pressão oncótica capilar (opõe, -32 mmHg), (3) Pressão hidrostática capsular (opõe, -18 mmHg). Pressão de filtração efetiva = 10 mmHg. Kf (coeficiente de filtração) modula a taxa.',
      fatores_determinantes: {
        pressao_hidrostatica_glomerular: { valor: '+60 mmHg', efeito: 'favorece' },
        pressao_oncotica_capilar: { valor: '-32 mmHg', efeito: 'opõe' },
        pressao_hidrostatica_capsular: { valor: '-18 mmHg', efeito: 'opõe' },
        pressao_filtracao_efetiva: { valor: '10 mmHg', calculo: '60 - 32 - 18' },
        coeficiente_filtracao_Kf: { valor: '12.5 mL/min/mmHg', observacao: 'alto devido à permeabilidade' }
      },
      acoes_3d: {
        animacao: 'regulacao_TFG',
        focus_mesh: 'mesh_renal_corpuscle'
      }
    },
    {
      ordem: 5,
      nome: 'Autorregulação Renal',
      duracao_ms: 300,
      descricao: 'Mecanismos mantêm a TFG estável apesar de variações de PA (80-180 mmHg): (1) Resposta miogênica — arteríola aferente contrai com aumento de pressão; (2) Feedback tubuloglomerular — mácula densa detecta NaCl e ajusta calibre arteriolar via adenosina; (3) Sistema renina-angiotensina (regulação de médio prazo).',
      mecanismos: [
        { nome: 'Resposta miogênica', tipo: 'autorregulação_intrínseca', latencia_ms: 100 },
        { nome: 'Feedback tubuloglomerular', tipo: 'autorregulação_intrínseca', latencia_ms: 300 },
        { nome: 'Sistema renina-angiotensina', tipo: 'hormonal', latencia_ms: 5000 }
      ],
      acoes_3d: {
        animacao: 'autorregulacao_renal',
        focus_mesh: 'mesh_arteriole_afferent'
      }
    }
  ],

  // ---------------------------------------------------------------
  // ENZIMAS E PROTEÍNAS ENVOLVIDAS
  // ---------------------------------------------------------------
  enzimas_envolvidas: [
    {
      nome: 'Renina',
      pdb_id: '2REN',
      uniprot_id: 'P00797',
      localizacao: 'Células justaglomerulares (arteríola aferente)',
      funcao: 'Cliva angiotensinogênio → angiotensina I (etapa limitante do SRAA)',
      substrato: 'Angiotensinogênio',
      produto: 'Angiotensina I'
    },
    {
      nome: 'Enzima Conversora de Angiotensina (ECA)',
      pdb_id: '1O86',
      uniprot_id: 'P12821',
      localizacao: 'Endotélio pulmonar',
      funcao: 'Converte angiotensina I → angiotensina II (vasoconstritor potente)',
      substrato: 'Angiotensina I',
      produto: 'Angiotensina II'
    },
    {
      nome: 'Adenosina',
      tipo: 'nucleosídeo_sinalizador',
      localizacao: 'Mácula densa',
      funcao: 'Vasoconstrição da arteríola aferente no feedback tubuloglomerular'
    }
  ],

  // ---------------------------------------------------------------
  // PARÂMETROS FISIOLÓGICOS
  // ---------------------------------------------------------------
  parametros: {
    TFG_normal: '125 mL/min (homem); 110 mL/min (mulher)',
    filtrado_diario: '180 L/dia',
    urina_final: '1.5 L/dia',
    reabsorcao_percentual: '99.2%',
    fracao_filtracao: '20% do plasma renal',
    fluxo_plasma_renal: '625 mL/min',
    fluxo_sanguineo_renal: '1100-1200 mL/min',
    pressao_hidrostatica_glomerular: '60 mmHg',
    clearance_inulina: '125 mL/min (= TFG)',
    clearance_creatinina: '125 mL/min'
  },

  // ---------------------------------------------------------------
  // PATOLOGIAS ASSOCIADAS
  // ---------------------------------------------------------------
  patologias_associadas: [
    {
      nome: 'Insuficiência Renal Aguda',
      cid: 'N17',
      descricao: 'Queda abrupta da TFG (< 30 mL/min) com acúmulo de escórias nitrogenadas',
      mecanismo: 'Pré-renal (hipoperfusão), renal (NTA, glomerulonefrite) ou pós-renal (obstrução)'
    },
    {
      nome: 'Doença Renal Crônica',
      cid: 'N18',
      descricao: 'Perda progressiva e irreversível da função renal por > 3 meses',
      estagios: ['G1 (≥90)', 'G2 (60-89)', 'G3a (45-59)', 'G3b (30-44)', 'G4 (15-29)', 'G5 (<15)']
    },
    {
      nome: 'Síndrome Nefrótica',
      cid: 'N04',
      descricao: 'Proteinúria > 3.5 g/dia, hipoalbuminemia, edema, hiperlipidemia',
      mecanismo: 'Perda da barreira de carga (podocitopatias, lesão mínima, FSGS)'
    },
    {
      nome: 'Glomerulonefrite',
      cid: 'N05',
      descricao: 'Inflamação dos glomérulos com hematúria, proteinúria e hipertensão',
      variantes: ['Pós-estreptocócica', 'IgA (Berger)', 'Membranosa', 'Rapidamente progressiva']
    }
  ],

  // ---------------------------------------------------------------
  // CORRELAÇÕES CLÍNICAS
  // ---------------------------------------------------------------
  correlacoes_clinicas: [
    {
      exame: 'Clearance de creatinina',
      uso: 'Estimar TFG (fórmula de Cockcroft-Gault ou CKD-EPI)',
      valores_normais: '125 mL/min (adulto jovem)'
    },
    {
      exame: 'Fração de excreção de Na⁺ (FENa)',
      uso: 'Diferenciar NTA (FENa > 2%) de pré-renal (FENa < 1%)',
      formula: 'FENa = (UNa × PCr) / (PNa × UCr) × 100'
    },
    {
      exame: 'Proteinúria de 24h',
      uso: 'Detectar síndrome nefrótica (> 3.5 g/24h)',
      valores_normais: '< 150 mg/24h'
    }
  ],

  // ---------------------------------------------------------------
  // FÁRMACOS RELACIONADOS
  // ---------------------------------------------------------------
  farmacos_relacionados: [
    {
      nome: 'Furosemida',
      classe: 'Diurético de alça',
      mecanismo: 'Inibe NKCC2 no ramo ascendente espesso, aumentando excreção de Na⁺ e água',
      efeito_TFG: 'Transitório (aumenta por vasodilatação das prostaglandinas)'
    },
    {
      nome: 'AINEs',
      classe: 'Anti-inflamatórios',
      mecanismo: 'Inibem prostaglandinas vasodilatadoras, reduzindo TFG em estados de hipoperfusão',
      efeito_TFG: 'Reduz significativamente em pacientes desidratados ou com IC'
    },
    {
      nome: 'IECA / BRA',
      classe: 'Anti-hipertensivos',
      mecanismo: 'Dilatam arteríola eferente, reduzindo pressão intraglomerular',
      efeito_TFG: 'Reduz TFG 10-20% (efeito protetor renal a longo prazo)'
    }
  ],

  // ---------------------------------------------------------------
  // REFERÊNCIAS
  // ---------------------------------------------------------------
  referencias: [
    'Guyton & Hall — Tratado de Fisiologia Médica, Caps. 26-28',
    'Silverthorn — Fisiologia Humana, Cap. 19',
    'KDIGO 2024 Clinical Practice Guideline for CKD'
  ]
};

export default FILTRACAO_GLOMERULAR;
