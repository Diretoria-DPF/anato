/**
 * LAIFT · Anatomia 3D
 * api/gas-client.js — Cliente Google Apps Script
 *
 * Responsável por:
 *   - Comunicação com o backend Google Apps Script
 *   - Fallback para dados locais em caso de falha
 *   - Retry com backoff exponencial
 *   - Cache local (localStorage)
 */

import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS } from '../core/state.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const GAS_CONFIG = {
  // ⚠️ AJUSTE AQUI: substituir pelo ID do seu deploy
  URL: 'https://script.google.com/macros/s/AKfycbyXvBYrHBIXNjHYItuq2LXKt1vkmh2m_CME-5aZqkxUJhl7ktJjemuasbvdEweH95k/exec',
  timeoutMs: 12000,
  maxRetries: 3,
  retryDelayMs: 800,
  cacheTtlMs: 3600_000,
  cacheKey: 'laift:gas-cache'
};

/* ================================================================
   CLIENTE
   ================================================================ */
class GasClient {
  constructor() {
    this._cache = new Map();
    this._pending = new Map(); // dedupe requests
    this._loadDiskCache();
  }

  /* --------------------------------------------------------------
     API pública
     -------------------------------------------------------------- */

  /**
   * Verifica se o backend está configurado.
   */
  isConfigured() {
    return GAS_CONFIG.URL && !GAS_CONFIG.URL.includes('SEU_DEPLOY_ID');
  }

  /**
   * GET genérico.
   */
  async get(action, params = {}, options = {}) {
    if (!this.isConfigured()) {
      console.info('[GAS] Backend não configurado — usando fallback local');
      return null;
    }

    const cacheKey = `${action}:${JSON.stringify(params)}`;
    const cached = options.skipCache ? null : this._getCached(cacheKey);
    if (cached) return cached;

    if (this._pending.has(cacheKey)) {
      return this._pending.get(cacheKey);
    }

    const query = new URLSearchParams({ action, ...params }).toString();
    const url = `${GAS_CONFIG.URL}?${query}`;

    const promise = this._fetchWithRetry(url, { method: 'GET', ...options })
      .then((data) => {
        if (data) this._setCached(cacheKey, data);
        return data;
      })
      .finally(() => this._pending.delete(cacheKey));

    this._pending.set(cacheKey, promise);
    return promise;
  }

  /**
   * POST genérico.
   */
  async post(action, payload = {}, options = {}) {
    if (!this.isConfigured()) {
      console.info('[GAS] Backend não configurado — operação POST ignorada');
      return { success: false, offline: true };
    }

    const body = JSON.stringify({ action, ...payload });
    // GAS não permite header Content-Type application/json no modo no-cors.
    // Usamos text/plain e o backend faz JSON.parse.
    const promise = this._fetchWithRetry(GAS_CONFIG.URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      ...options
    });

    return promise;
  }

  /* --------------------------------------------------------------
     Endpoints específicos
     -------------------------------------------------------------- */

  async fetchQuestions() {
    bus.emit(EVENTS.BACKEND_REQUEST, { action: 'getQuestions' });
    try {
      const data = await this.get('getQuestions');
      if (data?.questions) {
        dispatch({ type: ACTIONS.QUIZ_SET_QUESTIONS, payload: data.questions });
        bus.emit(EVENTS.BACKEND_RESPONSE, { action: 'getQuestions', count: data.questions.length });
        return data.questions;
      }
    } catch (err) {
      bus.emit(EVENTS.BACKEND_ERROR, { action: 'getQuestions', error: err });
    }
    return null;
  }

  async fetchDrugs() {
    bus.emit(EVENTS.BACKEND_REQUEST, { action: 'getDrugs' });
    try {
      const data = await this.get('getDrugs');
      if (data?.drugs) {
        dispatch({ type: ACTIONS.DATA_SET_FARMACOS, payload: { farmacos: data.drugs } });
        bus.emit(EVENTS.BACKEND_RESPONSE, { action: 'getDrugs', count: data.drugs.length });
        return data.drugs;
      }
    } catch (err) {
      bus.emit(EVENTS.BACKEND_ERROR, { action: 'getDrugs', error: err });
    }
    return null;
  }

  async saveSimulation(simData) {
    bus.emit(EVENTS.BACKEND_REQUEST, { action: 'saveSimulation' });
    try {
      const result = await this.post('saveSimulation', { data: simData });
      bus.emit(EVENTS.BACKEND_RESPONSE, { action: 'saveSimulation', result });
      return result;
    } catch (err) {
      bus.emit(EVENTS.BACKEND_ERROR, { action: 'saveSimulation', error: err });
      return { success: false, error: err.message };
    }
  }

  async registerUser(userData) {
    return this.post('registerUser', { data: userData });
  }

  async fetchStats() {
    return this.get('getStats');
  }

  /**
   * Busca no RCSB PDB via proxy do GAS (contorna CORS).
   */
  async fetchPdbMetadata(pdbId) {
    return this.get('fetchPDB', { pdbId });
  }

  async fetchChembl(name) {
    return this.get('fetchChEMBL', { nome: name });
  }

  async fetchAlphaFold(uniprotId) {
    return this.get('fetchAlphaFold', { uniprotId });
  }

  /* --------------------------------------------------------------
     Fetch com timeout + retry
     -------------------------------------------------------------- */
  async _fetchWithRetry(url, options, attempt = 0) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GAS_CONFIG.timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        console.warn('[GAS] Resposta não-JSON:', text.slice(0, 200));
        return { raw: text };
      }
    } catch (err) {
      clearTimeout(timeout);

      if (attempt < GAS_CONFIG.maxRetries) {
        const delay = GAS_CONFIG.retryDelayMs * Math.pow(2, attempt);
        console.warn(`[GAS] Tentativa ${attempt + 1} falhou — retry em ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        return this._fetchWithRetry(url, options, attempt + 1);
      }
      throw err;
    }
  }

  /* --------------------------------------------------------------
     Cache
     -------------------------------------------------------------- */
  _getCached(key) {
    const mem = this._cache.get(key);
    if (mem && Date.now() - mem.at < GAS_CONFIG.cacheTtlMs) return mem.value;

    const disk = this._diskCache?.[key];
    if (disk && Date.now() - disk.at < GAS_CONFIG.cacheTtlMs) {
      this._cache.set(key, disk);
      return disk.value;
    }
    return null;
  }

  _setCached(key, value) {
    const entry = { value, at: Date.now() };
    this._cache.set(key, entry);
    this._diskCache = this._diskCache || {};
    this._diskCache[key] = entry;
    this._scheduleSaveDisk();
  }

  _loadDiskCache() {
    try {
      const raw = localStorage.getItem(GAS_CONFIG.cacheKey);
      this._diskCache = raw ? JSON.parse(raw) : {};
    } catch {
      this._diskCache = {};
    }
  }

  _scheduleSaveDisk() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      try {
        // Limita a 50 entradas
        const keys = Object.keys(this._diskCache);
        if (keys.length > 50) {
          const sorted = keys.sort((a, b) => this._diskCache[a].at - this._diskCache[b].at);
          for (let i = 0; i < keys.length - 50; i++) delete this._diskCache[sorted[i]];
        }
        localStorage.setItem(GAS_CONFIG.cacheKey, JSON.stringify(this._diskCache));
      } catch (e) {
        console.warn('[GAS] Falha ao salvar cache:', e);
      }
      this._saveTimer = null;
    }, 500);
  }

  clearCache() {
    this._cache.clear();
    this._diskCache = {};
    try { localStorage.removeItem(GAS_CONFIG.cacheKey); } catch {}
  }
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const gasClient = new GasClient();

export { GAS_CONFIG };
export default gasClient;
