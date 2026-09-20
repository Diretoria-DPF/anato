/**
 * LAIFT · Anatomia 3D
 * molecular/pdb-loader.js — Cliente RCSB PDB
 *
 * Responsável por:
 *   - Buscar metadados de estruturas via RCSB PDB API
 *   - Cachear respostas
 *   - Resolver nomes → PDB IDs
 *   - Buscar ligantes e cadeias
 */

import { bus, EVENTS } from '../core/events.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const PDB_CONFIG = {
  apiBase: 'https://data.rcsb.org/rest/v1/core',
  filesBase: 'https://files.rcsb.org/download',
  cacheTtlMs: 3600_000, // 1h
  cacheKey: 'laift:pdb-cache'
};

/* ================================================================
   CLIENTE
   ================================================================ */
class PdbLoader {
  constructor() {
    this._memCache = new Map();
    this._loadDiskCache();
  }

  /**
   * Busca metadados de uma entrada.
   * @param {string} pdbId
   * @returns {Promise<Object>}
   */
  async getEntry(pdbId) {
    pdbId = String(pdbId).toUpperCase();
    const cached = this._getCached(`entry:${pdbId}`);
    if (cached) return cached;

    const url = `${PDB_CONFIG.apiBase}/entry/${pdbId}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._setCached(`entry:${pdbId}`, data);
      return data;
    } catch (err) {
      console.warn(`[PDB] Falha em ${pdbId}:`, err.message);
      throw err;
    }
  }

  /**
   * Retorna URL direta do arquivo PDB.
   */
  getPdbUrl(pdbId) {
    return `${PDB_CONFIG.filesBase}/${pdbId.toUpperCase()}.pdb`;
  }

  /**
   * Retorna URL direta do arquivo mmCIF.
   */
  getCifUrl(pdbId) {
    return `${PDB_CONFIG.filesBase}/${pdbId.toUpperCase()}.cif`;
  }

  /**
   * Busca por palavra-chave (via RCSB Search API - simplificado).
   */
  async searchByKeyword(query, opts = {}) {
    const limit = opts.limit ?? 10;
    const url = 'https://search.rcsb.org/rcsbsearch/v2/query';
    const body = {
      query: {
        type: 'terminal',
        service: 'full_text',
        parameters: { value: query }
      },
      return_type: 'entry',
      request_options: {
        paginate: { start: 0, rows: limit },
        results_content_type: ['experimental']
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.result_set || [];
    } catch (err) {
      console.warn('[PDB] Search falhou:', err.message);
      return [];
    }
  }

  /**
   * Extrai informações resumidas de uma entrada.
   */
  async getSummary(pdbId) {
    try {
      const entry = await this.getEntry(pdbId);
      return {
        pdbId: String(pdbId).toUpperCase(),
        title: entry?.struct?.title || 'Sem título',
        method: entry?.exptl?.[0]?.method || 'Desconhecido',
        resolution: entry?.rcsb_entry_info?.resolution_combined?.[0] ?? null,
        organism: entry?.rcsb_entity_source_organism?.[0]?.scientific_name || null,
        releaseDate: entry?.rcsb_accession_info?.initial_release_date || null,
        chains: entry?.rcsb_entry_info?.polymer_entity_count_protein || 0,
        ligands: entry?.rcsb_entry_info?.nonpolymer_entity_count || 0
      };
    } catch {
      return { pdbId, title: 'Indisponível', error: true };
    }
  }

  /* --------------------------------------------------------------
     CACHE (memória + localStorage)
     -------------------------------------------------------------- */
  _getCached(key) {
    // Memória
    const mem = this._memCache.get(key);
    if (mem && Date.now() - mem.at < PDB_CONFIG.cacheTtlMs) {
      return mem.value;
    }
    // Disk
    const disk = this._diskCache?.[key];
    if (disk && Date.now() - disk.at < PDB_CONFIG.cacheTtlMs) {
      this._memCache.set(key, disk);
      return disk.value;
    }
    return null;
  }

  _setCached(key, value) {
    const entry = { value, at: Date.now() };
    this._memCache.set(key, entry);
    this._diskCache = this._diskCache || {};
    this._diskCache[key] = entry;
    this._scheduleSaveDisk();
  }

  _loadDiskCache() {
    try {
      const raw = localStorage.getItem(PDB_CONFIG.cacheKey);
      this._diskCache = raw ? JSON.parse(raw) : {};
    } catch {
      this._diskCache = {};
    }
  }

  _scheduleSaveDisk() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      try {
        const keys = Object.keys(this._diskCache);
        // Limita a 100 entradas
        if (keys.length > 100) {
          const sorted = keys.sort((a, b) => this._diskCache[a].at - this._diskCache[b].at);
          for (let i = 0; i < keys.length - 100; i++) delete this._diskCache[sorted[i]];
        }
        localStorage.setItem(PDB_CONFIG.cacheKey, JSON.stringify(this._diskCache));
      } catch (e) {
        console.warn('[PDB] Falha ao salvar cache:', e);
      }
      this._saveTimer = null;
    }, 500);
  }

  clearCache() {
    this._memCache.clear();
    this._diskCache = {};
    try { localStorage.removeItem(PDB_CONFIG.cacheKey); } catch {}
  }
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const pdbLoader = new PdbLoader();

/* ================================================================
   PDB IDs PRÉ-CONHECIDOS (fallback offline)
   ================================================================ */
export const KNOWN_PDB = Object.freeze({
  // Enzimas humanas
  'COX1': '1EQG',
  'COX2': '1CX2',
  'ACHE': '1B41',
  'NAK_ATPASE': '3B8E',
  'SERCA': '1SU4',
  'ACE': '1O86',
  'RENIN': '2REN',
  'CYP3A4': '1TQN',
  'HMGCR': '1HWK',
  'ATP_SYNTHASE': '1BMF',
  'SOD': '1SOS',
  'CATALASE': '1DGB',
  'LYSOZYME': '1LYZ',
  'DHFR': '1DHF',
  'CA': '1CA2',
  'AMYLASE': '1SMD',
  'PEPSIN': '1PSO',
  'TRYPSIN': '1TRN',
  'CHYMOTRYPSIN': '1CHG',
  'LIPASE': '1LPA',

  // Patógenos
  'SARS_COV2_SPIKE': '6M0J',
  'SARS_COV2_MPRO': '6LU7',
  'SARS_COV2_RDRP': '7BV2',
  'H_PYLORI_UREASE': '1E9Z',
  'H_PYLORI_VACA': '2WQU',
  'TB_INHA': '1P44',
  'TB_RDRP': '5UHB',
  'HIV_RT': '1DLO',
  'HIV_PROTEASE': '1HXB',
  'HIV_INTEGRASE': '1BL3',
  'INFLUENZA_NA': '1NNC',
  'CANDIDA_CYP51': '5V5Z',
  'PLASMODIUM_DHFR': '1J3K',

  // Fármacos complexados
  'ASPIRIN_COX1': '1EQG',
  'CELEBREX_COX2': '6COX',
  'OMEPRAZOLE': '5YLV'
});

export default pdbLoader;
