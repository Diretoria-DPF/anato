/**
 * LAIFT · Anatomia 3D
 * timeline/processes/hematose.js
 *
 * Processo completo de hematose alveolar com cinética de difusão,
 * relação V/Q, curva de dissociação da hemoglobina e correlações clínicas.
 *
 * Referência: Guyton & Hall, Cap. 39-41 (Fisiologia Respiratória).
 */

export const HEMATOSE = {
  processo_id: 'hematose_alveolar',
  nome: 'Hematose Alveolar',
  nome_cientifico: 'Hematosis alveolaris',
  sistema_relacionado: 'respiratorio',
  camera_preset: 'pulmoes',
  duracao_total_ms: 3200,
  resumo: 'Troca gasosa entre o ar alveolar e o sangue capilar pulmonar através da membrana alvéolo-capilar (0.5 µm de espessura). Ocorre difusão passiva de O₂ e CO₂ seguindo gradientes de pressão parcial, com papel fundamental da hemoglobina no transporte.',

  // ---------------------------------------------------------------
  // ETAPAS
  // ---------------------------------------------------------------
  etapas: [
    {
      ordem: 1,
      nome: 'Ventilação Alveolar',
      duracao_ms: 700,
      descricao: 'Renovação do ar alveolar (~350 mL por ciclo) mantendo PO₂ ~104 mmHg e PCO₂ ~40 mmHg no alvéolo. A ventilação é distribuída de forma heterogênea (maior na base pulmonar).',
      estruturas_envolvidas: [
        'alveolos',
        'bronquiolos_respiratorios',
        'ductos_alveolares',
        'sacos_alveolares',
        'diafragma',
        'musculos_intercostais'
      ],
      volumes_envolvidos: {
        volume_corrente: '500 mL',
        ventilacao_alveolar: '350 mL (após espaço morto)',
        espaco_morto_anatomico: '150 mL',
        frequencia_respiratoria: '12-16/min',
        ventilacao_minuto: '6-8 L/min'
      },
      pressoes_parciais_alveolares: {
        PO2: '104 mmHg',
        PCO2: '40 mmHg',
        PH2O: '47 mmHg',
        PN2: '573 mmHg'
      },
      acoes_3d: {
        camera_preset: 'pulmoes',
        mover_malha: 'mesh_diaphragm',
        animacao: 'ventilacao_alveolar',
        focus_mesh: 'mesh_alveoli'
      }
    },
    {
      ordem: 2,
      nome: 'Membrana Alvéolo-Capilar',
      duracao_ms: 500,
      descricao: 'Barreira delgada (~0.5 µm) composta por: (1) líquido surfactante, (2) epitélio alveolar (pneumócitos tipo I), (3) membrana basal, (4) endotélio capilar, (5) plasma, (6) membrana da hemácia. Área total: 70 m².',
      estruturas_envolvidas: [
        'pneumocitos_tipo_I',
        'pneumocitos_tipo_II',
        'endotelio_capilar',
        'surfactante',
        'eritrocitos'
      ],
      propriedades: {
        espessura_total: '0.2-0.6 µm',
        area_superficie: '70 m² (adulto)',
        volume_sanguineo_capilar: '70-140 mL',
        tempo_transito_hemacia: '0.75 s (repouso)',
        tempo_necessario_equilibrio: '0.25 s'
      },
      surfactante: {
        composicao: 'DPPC (dipalmitoilfosfatidilcolina) ~50% + outras proteínas (SP-A, SP-B, SP-C, SP-D)',
        funcao: 'Reduz tensão superficial, previne colapso alveolar',
        producao: 'Pneumócitos tipo II',
        importancia_clinica: 'Deficiência causa SARA e doença da membrana hialina neonatal'
      },
      acoes_3d: {
        animacao: 'membrana_alveolo_capilar',
        focus_mesh: 'mesh_alveolar_membrane'
      }
    },
    {
      ordem: 3,
      nome: 'Difusão de O₂',
      duracao_ms: 500,
      descricao: 'O₂ difunde do alvéolo (PO₂ ~104 mmHg) para o capilar (PO₂ ~40 mmHg). A difusão é tão eficiente que o sangue atinge equilíbrio em ~0.25 s (1/3 do tempo de trânsito). Capacidade de difusão de O₂: 21 mL/min/mmHg.',
      gradiente_pressao: {
        alveolar_PO2: '104 mmHg',
        capilar_venoso_PO2: '40 mmHg',
        capilar_arterial_PO2: '100 mmHg',
        gradiente_inicial: '64 mmHg'
      },
      coeficiente_difusao: {
        capacidade_difusao_O2: '21 mL/min/mmHg',
        tempo_equilibrio: '0.25 s',
        observacao: 'O₂ é 20× menos solúvel que CO₂, mas gradiente maior compensa'
      },
      fatores_limitantes: [
        'Espessura da membrana',
        'Área de superfície',
        'Gradiente de pressão parcial',
        'Tempo de trânsito capilar'
      ],
      acoes_3d: {
        animacao: 'difusao_oxigenio',
        focus_mesh: 'mesh_alveolar_capillary'
      },
      particulas: {
        tipo: 'ions',
        waypoints: [
          { x: -0.15, y: 1.42, z: 0.0 },
          { x: -0.08, y: 1.41, z: 0.02 },
          { x: -0.02, y: 1.40, z: 0.01 },
          { x: 0.03, y: 1.39, z: 0.0 }
        ]
      }
    },
    {
      ordem: 4,
      nome: 'Difusão de CO₂',
      duracao_ms: 400,
      descricao: 'CO₂ difunde do capilar (PCO₂ ~45 mmHg) para o alvéolo (PCO₂ ~40 mmHg). Apesar do gradiente pequeno, o CO₂ difunde 20× mais rápido que o O₂ (alta solubilidade), atingindo equilíbrio praticamente instantaneamente. Capacidade de difusão: 400 mL/min/mmHg.',
      gradiente_pressao: {
        capilar_venoso_PCO2: '45 mmHg',
        alveolar_PCO2: '40 mmHg',
        capilar_arterial_PCO2: '40 mmHg',
        gradiente_inicial: '5 mmHg'
      },
      coeficiente_difusao: {
        capacidade_difusao_CO2: '400 mL/min/mmHg',
        tempo_equilibrio: '< 0.1 s',
        observacao: 'CO₂ é 20× mais solúvel que O₂ — gradiente pequeno é suficiente'
      },
      formas_transporte_co2: {
        bicarbonato_HCO3: '70% (via anidrase carbônica na hemácia)',
        carbaminohemoglobina: '23% (ligado à globina)',
        dissolvido_no_plasma: '7%'
      },
      acoes_3d: {
        animacao: 'difusao_dioxido_carbono',
        focus_mesh: 'mesh_alveolar_capillary'
      },
      particulas: {
        tipo: 'ions',
        waypoints: [
          { x: 0.03, y: 1.39, z: 0.0 },
          { x: -0.02, y: 1.40, z: 0.01 },
          { x: -0.08, y: 1.41, z: 0.02 },
          { x: -0.15, y: 1.42, z: 0.0 }
        ]
      }
    },
    {
      ordem: 5,
      nome: 'Transporte de O₂ pela Hemoglobina',
      duracao_ms: 600,
      descricao: 'O O₂ liga-se reversivelmente à hemoglobina (Hb) formando oxihemoglobina. Saturação arterial normal: 97-98%. A curva de dissociação é sigmoide (cooperatividade positiva entre as 4 subunidades).',
      moleculas: [
        { nome: 'Hemoglobina A', estrutura: 'α2β2 (tetrâmero)', peso_molecular: '64.500 Da' },
        { nome: 'Oxihemoglobina (HbO₂)', ligacao: '4 O₂ por tetrâmero' },
        { nome: '2,3-BPG', funcao: 'Reduz afinidade da Hb pelo O₂ (facilita liberação tecidual)' },
        { nome: 'CO₂', funcao: 'Efeito Bohr — reduz afinidade pelo O₂' },
        { nome: 'H⁺ (pH)', funcao: 'Efeito Bohr — acidose reduz afinidade pelo O₂' }
      ],
      curva_dissociacao: {
        forma: 'Sigmoide (cooperatividade)',
        P50_normal: '26-27 mmHg (PO₂ para 50% de saturação)',
        saturacao_arterial: '97-98% (PO₂ 100)',
        saturacao_venosa: '75% (PO₂ 40)',
        saturacao_tecidual: '30-40% (PO₂ 20-30)'
      },
      efeitos_moduladores: {
        efeito_Bohr: 'Redução de pH → desvio da curva para direita (menor afinidade pelo O₂, maior liberação tecidual)',
        efeito_Haldane: 'Redução da HbO₂ → maior captação de CO₂',
        efeito_2_3_BPG: 'Aumento de BPG → desvio para direita (adaptação à hipóxia crônica)',
        efeito_temperatura: 'Aumento de temperatura → desvio para direita'
      },
      acoes_3d: {
        animacao: 'ligacao_hemoglobina_oxigenio',
        focus_mesh: 'mesh_erythrocyte'
      }
    },
    {
      ordem: 6,
      nome: 'Relação Ventilação/Perfusão (V/Q)',
      duracao_ms: 500,
      descricao: 'A eficiência da hematose depende da distribuição adequada entre ventilação (V) e perfusão (Q). V/Q global = 0.8 (4 L/min ÷ 5 L/min). Variações regionais são fundamentais: ápice tem V/Q > 3; base tem V/Q ~0.6.',
      valores_VQ: {
        global_normal: 0.8,
        apice_pulmonar: 3.3,
        base_pulmonar: 0.6,
        venoso_misto: 0,
        espaco_morto: 'infinito'
      },
      mecanismos_compensatorios: [
        {
          nome: 'Vasoconstrição pulmonar hipóxica',
          funcao: 'Desvia sangue de áreas mal ventiladas para áreas bem ventiladas',
          mecanismo: 'Inibição de canais K⁺ → despolarização → entrada de Ca²⁺ → vasoconstrição'
        },
        {
          nome: 'Broncoconstrição em áreas mal perfundidas',
          funcao: 'Desvia ar de áreas mal perfundidas',
          mecanismo: 'Redução de PCO₂ alveolar local'
        }
      ],
      acoes_3d: {
        animacao: 'relacao_ventilacao_perfusao',
        focus_mesh: 'mesh_lung_right'
      }
    }
  ],

  // ---------------------------------------------------------------
  // ENZIMAS E PROTEÍNAS ENVOLVIDAS
  // ---------------------------------------------------------------
  enzimas_envolvidas: [
    {
      nome: 'Anidrase Carbônica II',
      pdb_id: '1CA2',
      uniprot_id: 'P00918',
      localizacao: 'Eritrócitos (citosol) e endotélio capilar',
      funcao: 'CO₂ + H₂O ↔ H₂CO₃ ↔ H⁺ + HCO₃⁻ (interconversão para transporte)',
      cinetica: {
        cofatores: ['Zn²⁺'],
        turnover: '1×10⁶ reações/s (uma das enzimas mais rápidas)'
      },
      moduladores: [
        { farmaco: 'Acetazolamida', tipo: 'inibidor_competitivo', uso: 'Glaucoma, alcalose metabólica' },
        { farmaco: 'Dorzolamida', tipo: 'inibidor_competitivo', uso: 'Glaucoma tópico' }
      ]
    },
    {
      nome: 'Hemoglobina',
      pdb_id: '2HHB',
      uniprot_id: 'P69905 (α) + P68871 (β)',
      localizacao: 'Eritrócitos',
      funcao: 'Transporte de O₂ (4 sítios) e CO₂ (via globina e efeito Bohr)',
      formas: [
        { forma: 'HbA (α2β2)', porcentagem: '96-98% adulto' },
        { forma: 'HbA2 (α2δ2)', porcentagem: '2-3%' },
        { forma: 'HbF (α2γ2)', porcentagem: '< 1% adulto; principal no feto' }
      ],
      variantes: [
        { nome: 'HbS', efeito: 'Anemia falciforme (Glu→Val na β6)' },
        { nome: 'HbC', efeito: 'Anemia hemolítica leve (Glu→Lys na β6)' },
        { nome: 'Metemoglobina', efeito: 'Fe³⁺ não liga O₂ (oxidantes, cianeto)' }
      ]
    },
    {
      nome: 'Surfactante Pulmonar',
      tipo: 'lipoproteína_complexa',
      pdb_id: '1SP-B',
      composicao: 'DPPC (~50%), outras fosfolipídios, SP-A/B/C/D',
      funcao: 'Reduz tensão superficial, previne colapso alveolar',
      producao: 'Pneumócitos tipo II (a partir de 24-28 semanas de gestação)'
    }
  ],

  // ---------------------------------------------------------------
  // PARÂMETROS FISIOLÓGICOS
  // ---------------------------------------------------------------
  parametros: {
    // Gasometria arterial normal
    gasometria_arterial: {
      pH: '7.35-7.45',
      PaO2: '80-100 mmHg',
      PaCO2: '35-45 mmHg',
      HCO3: '22-26 mEq/L',
      SaO2: '95-98%',
      BE: '-2 a +2'
    },
    // Gasometria venosa normal
    gasometria_venosa: {
      pH: '7.31-7.41',
      PvO2: '35-45 mmHg',
      PvCO2: '41-51 mmHg',
      SvO2: '70-75%'
    },
    // Volumes e capacidades
    volumes_pulmonares: {
      volume_corrente_VC: '500 mL',
      volume_reserva_inspiratoria_VRI: '3000 mL',
      volume_reserva_expiratoria_VRE: '1100 mL',
      volume_residual_VR: '1200 mL'
    },
    capacidades_pulmonares: {
      capacidade_inspiratoria_CI: '3500 mL (VC + VRI)',
      capacidade_residual_funcional_CRF: '2300 mL (VRE + VR)',
      capacidade_vital_CV: '4600 mL (VC + VRI + VRE)',
      capacidade_pulmonar_total_CPT: '5800 mL'
    },
    // Parâmetros de troca gasosa
    troca_gasosa: {
      consumo_O2: '250 mL/min',
      producao_CO2: '200 mL/min',
      quociente_respiratorio_RQ: '0.8 (CO₂ produzido / O₂ consumido)',
      ventilacao_alveolar: '4 L/min',
      perfusao_pulmonar: '5 L/min',
      relacao_VQ: 0.8
    }
  },

  // ---------------------------------------------------------------
  // PATOLOGIAS ASSOCIADAS
  // ---------------------------------------------------------------
  patologias_associadas: [
    {
      nome: 'Síndrome do Desconforto Respiratório Agudo (SDRA/SARA)',
      cid: 'J80',
      descricao: 'Lesão difusa da membrana alvéolo-capilar com edema pulmonar não-cardiogênico',
      mecanismos: ['Aumento da permeabilidade capilar', 'Perda de surfactante', 'Atelectasia'],
      criterios_berlim: 'Início < 7d, opacidades bilaterais, P/F < 300 com PEEP ≥ 5'
    },
    {
      nome: 'Doença Pulmonar Obstrutiva Crônica (DPOC)',
      cid: 'J44',
      descricao: 'Limitação crônica do fluxo aéreo por bronquite crônica + enfisema',
      mecanismos: ['Destruição alveolar (enfisema)', 'Hipersecreção de muco', 'Perda de recolhimento elástico'],
      efeitos_VQ: 'Desequilíbrio V/Q com áreas de shunt e espaço morto'
    },
    {
      nome: 'Asma Brônquica',
      cid: 'J45',
      descricao: 'Inflamação crônica das vias aéreas com hiperreatividade brônquica',
      mecanismos: ['Broncoconstrição', 'Edema mucoso', 'Hipersecreção de muco'],
      efeitos_VQ: 'Distúrbio V/Q com hipoxemia leve-moderada'
    },
    {
      nome: 'Embolia Pulmonar',
      cid: 'I26',
      descricao: 'Obstrução da artéria pulmonar por trombo (geralmente de TVP)',
      efeitos_VQ: 'Aumento do espaço morto (áreas ventiladas não perfundidas)',
      consequencias: 'Hipoxemia, hipercapnia, sobrecarga de VD'
    },
    {
      nome: 'Fibrose Pulmonar Idiopática',
      cid: 'J84.1',
      descricao: 'Fibrose progressiva do interstício pulmonar',
      efeitos_VQ: 'Aumento da espessura da membrana → redução da difusão'
    },
    {
      nome: 'Doença da Membrana Hialina (Neonatal)',
      cid: 'P22.0',
      descricao: 'Deficiência de surfactante em prematuros',
      mecanismos: ['Colapso alveolar', 'Atelectasia', 'Shunt intrapulmonar'],
      tratamento: 'Surfactante exógeno + CPAP'
    },
    {
      nome: 'Intoxicação por Monóxido de Carbono',
      cid: 'T58',
      descricao: 'CO liga-se à Hb com afinidade 250× maior que o O₂',
      efeitos: 'Redução da capacidade de transporte de O₂, desvio da curva para esquerda',
      tratamento: 'O₂ 100% hiperbárico'
    },
    {
      nome: 'Metahemoglobinemia',
      cid: 'D74',
      descricao: 'Oxidação do Fe²⁺ a Fe³⁺ (não liga O₂)',
      causas: ['Dapsona', 'Nitritos', 'Benzocaína', 'Deficiência de NADH-metemoglobina redutase'],
      tratamento: 'Azul de metileno'
    }
  ],

  // ---------------------------------------------------------------
  // FÁRMACOS RELACIONADOS
  // ---------------------------------------------------------------
  farmacos_relacionados: [
    {
      nome: 'Salbutamol (Albuterol)',
      classe: 'β2-agonista de curta ação',
      mecanismo: 'Broncodilatação via receptores β2',
      uso: 'Crise asmática, DPOC'
    },
    {
      nome: 'Ipratrópio',
      classe: 'Anticolinérgico inalatório',
      mecanismo: 'Bloqueio muscarínico M3 (broncodilatação)',
      uso: 'DPOC, asma grave'
    },
    {
      nome: 'Corticosteroides inalatórios (Budesonida, Fluticasona)',
      classe: 'Anti-inflamatório',
      mecanismo: 'Reduz inflamação das vias aéreas',
      uso: 'Controle de asma e DPOC'
    },
    {
      nome: 'Acetazolamida',
      classe: 'Inibidor da anidrase carbônica',
      mecanismo: 'Reduz reabsorção de HCO₃⁻ renal, causando acidose metabólica',
      uso: 'Alcalose metabólica, mal da montanha, glaucoma'
    },
    {
      nome: 'N-acetilcisteína',
      classe: 'Mucolítico / Antioxidante',
      mecanismo: 'Cliva pontes dissulfeto do muco; precursor de glutationa',
      uso: 'Doenças com hipersecreção mucosa, intoxicação por paracetamol'
    },
    {
      nome: 'Surfactante exógeno (Beractanto, Poractanto)',
      classe: 'Agente surfactante',
      mecanismo: 'Substitui surfactante endógeno deficiente',
      uso: 'Doença da membrana hialina neonatal'
    },
    {
      nome: 'Sildenafil',
      classe: 'Inibidor da PDE5',
      mecanismo: 'Aumenta cGMP → vasodilatação pulmonar seletiva',
      uso: 'Hipertensão arterial pulmonar'
    }
  ],

  // ---------------------------------------------------------------
  // EQUAÇÕES E CÁLCULOS
  // ---------------------------------------------------------------
  equacoes: [
    {
      nome: 'Equação do gás alveolar (ideal)',
      formula: 'PAO₂ = PiO₂ - (PaCO₂ / RQ)',
      descricao: 'Calcula a pressão parcial de O₂ alveolar',
      variaveis: {
        PiO₂: 'Pressão inspirada de O₂ = FiO₂ × (Patm - PH₂O)',
        PaCO₂: 'Pressão arterial de CO₂',
        RQ: 'Quociente respiratório (~0.8)'
      }
    },
    {
      nome: 'Gradiente alvéolo-arterial (A-a)',
      formula: 'P(A-a)O₂ = PAO₂ - PaO₂',
      descricao: 'Avalia eficiência da troca gasosa',
      valor_normal: '< 15 mmHg (jovem); < 30 mmHg (idoso)',
      interpretacao: 'Aumentado em distúrbios V/Q, shunt ou distúrbios de difusão'
    },
    {
      nome: 'Relação PaO₂/FiO₂ (P/F)',
      formula: 'P/F = PaO₂ / FiO₂',
      descricao: 'Avalia gravidade da hipoxemia',
      valores: {
        normal: '> 400',
        leve: '300-400',
        moderado: '200-300 (SDRA moderada)',
        grave: '< 200 (SDRA grave)'
      }
    },
    {
      nome: 'Conteúdo arterial de O₂ (CaO₂)',
      formula: 'CaO₂ = (1.34 × Hb × SaO₂) + (0.003 × PaO₂)',
      descricao: 'Calcula o O₂ total transportado no sangue',
      valor_normal: '18-20 mL O₂/dL sangue',
      observacao: '99% do O₂ é transportado ligado à Hb'
    }
  ],

  // ---------------------------------------------------------------
  // REFERÊNCIAS
  // ---------------------------------------------------------------
  referencias: [
    'Guyton & Hall — Tratado de Fisiologia Médica, Caps. 39-41',
    'West — Fisiologia Respiratória (9ª edição)',
    'ARDS Definition Task Force — Berlin Criteria (2012)',
    'GOLD Report 2024 — Global Strategy for Prevention, Diagnosis and Management of COPD'
  ]
};

export default HEMATOSE;
