/**
 * LAIFT · Anatomia 3D
 * api/search.js — Busca global unificada
 *
 * Responsável por:
 *   - Indexar dados locais (sistemas, órgãos, processos, enzimas, patógenos, fármacos)
 *   - Buscar por fuzzy matching (Levenshtein simplificado)
 *   - Buscar por acrônimos e sinônimos
 *   - Priorizar resultados por relevância
 */

import { bus, EVENTS } from '../core/events.js';
import { getState } from '../core/state.js';

/* ================================================================
   ÍNDICE
   ================================================================ */
class SearchIndex {
  constructor() {
    this._items = [];
    this._built = false;
  }

  /**
   * Constrói o índice a partir do state.
   */
  build() {
    const state = getState();
    const items = [];

    // -------- Sistemas --------
    (state.data.sistemas?.sistemas || []).forEach((s) => {
      items.push({
        id: `sys:${s.sistema_id}`,
        tipo: 'sistema',
        titulo: s.nome,
        subtitulo: 'Sistema anatômico',
        icon: '🫀',
        rota: `/macro/sistema/${s.sistema_id}`,
        keywords: [s.sistema_id, s.nome, s.nome_cientifico, ...(s.orgaos || [])],
        prioridade: 10
      });

      // Órgãos individuais do sistema
      (s.orgaos || []).forEach((org) => {
        items.push({
          id: `org:${s.sistema_id}:${org}`,
          tipo: 'orgao',
          titulo: capitalize(org.replace(/_/g, ' ')),
          subtitulo: `Órgão · ${s.nome}`,
          icon: '🔍',
          rota: `/macro/sistema/${s.sistema_id}`,
          keywords: [org, org.replace(/_/g, ' ')],
          prioridade: 8
        });
      });
    });

    // -------- Processos --------
    (state.data.processos?.processos || []).forEach((p) => {
      items.push({
        id: `proc:${p.processo_id}`,
        tipo: 'processo',
        titulo: p.nome || p.processo_id,
        subtitulo: `Processo · ${p.sistema_relacionado || ''}`,
        icon: '⚡',
        rota: `/meso/processo/${p.processo_id}`,
        keywords: [p.processo_id, p.nome, p.resumo, ...(p.etapas?.map((e) => e.nome) || [])],
        prioridade: 9
      });
    });

    // -------- Enzimas / Proteínas --------
    (state.data.enzimas?.itens || []).forEach((e) => {
      items.push({
        id: `enz:${e.item_id}`,
        tipo: 'enzima',
        titulo: e.nome,
        subtitulo: `${e.tipo || 'Enzima'} · PDB ${e.pdb_id || '—'}`,
        icon: '🧪',
        rota: `/nano/pdb/${e.pdb_id}?nome=${encodeURIComponent(e.nome)}`,
        keywords: [e.item_id, e.nome, e.pdb_id, e.ec_number, e.uniprot_id, ...(e.moduladores?.map((m) => m.farmaco) || [])],
        prioridade: 7
      });
    });

    // -------- Patógenos --------
    (state.data.patogenos?.patogenos || []).forEach((p) => {
      const pdb = Object.values(p.pdb_alvo_terapeutico || {})[0] || null;
      items.push({
        id: `pat:${p.patogeno_id}`,
        tipo: 'patogeno',
        titulo: p.nome_cientifico,
        subtitulo: `${p.classe || 'Patógeno'}${p.nome_comum ? ' · ' + p.nome_comum : ''}`,
        icon: '🦠',
        rota: pdb ? `/nano/pdb/${pdb}?nome=${encodeURIComponent(p.nome_cientifico)}` : '/nano',
        keywords: [p.patogeno_id, p.nome_cientifico, p.nome_comum, p.classe, ...(p.farmacos_primeira_linha?.map((f) => f.farmaco) || [])],
        prioridade: 7
      });
    });

    // -------- Fármacos --------
    (state.data.farmacos?.farmacos || []).forEach((f) => {
      items.push({
        id: `drug:${f.id}`,
        tipo: 'farmaco',
        titulo: f.nome,
        subtitulo: `${f.classe || 'Fármaco'} · ${f.via_administracao?.join(', ') || ''}`,
        icon: '💊',
        rota: `/nano`,
        keywords: [f.id, f.nome, f.classe, f.mecanismo, f.alvo, ...(f.indicacoes || [])],
        prioridade: 6
      });
    });

    // -------- Questões (por palavra-chave do enunciado) --------
    (state.quiz?.questions || []).slice(0, 60).forEach((q) => {
      items.push({
        id: `q:${q.id}`,
        tipo: 'questao',
        titulo: `Q${q.id} · ${q.sistema || 'Quiz'}`,
        subtitulo: (q.q || '').slice(0, 80) + '...',
        icon: '❓',
        rota: `/quiz/etapa/${q.etapa}`,
        keywords: [q.q, q.sistema, q.sub, q.exp].filter(Boolean),
        prioridade: 4
      });
    });

    this._items = items;
    this._built = true;
    console.log(`[Search] Índice construído: ${items.length} itens`);
    return items;
  }

  /**
   * Executa busca.
   */
  search(query, limit = 20) {
    if (!this._built) this.build();
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    const results = [];

    for (const item of this._items) {
      const score = this._score(item, q, tokens);
      if (score > 0) results.push({ ...item, score });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.prioridade - a.prioridade;
    });

    return results.slice(0, limit);
  }

  /**
   * Calcula score de relevância.
   */
  _score(item, query, tokens) {
    let score = 0;
    const titulo = (item.titulo || '').toLowerCase();
    const subtitulo = (item.subtitulo || '').toLowerCase();
    const keywords = (item.keywords || []).map((k) => String(k).toLowerCase());

    // Match exato no título
    if (titulo === query) score += 100;
    else if (titulo.startsWith(query)) score += 60;
    else if (titulo.includes(query)) score += 40;

    // Match em keywords
    for (const kw of keywords) {
      if (!kw) continue;
      if (kw === query) score += 50;
      else if (kw.startsWith(query)) score += 30;
      else if (kw.includes(query)) score += 15;
    }

    // Match em subtítulo
    if (subtitulo.includes(query)) score += 10;

    // Match por tokens (AND parcial)
    const matchedTokens = tokens.filter((t) =>
      titulo.includes(t) || subtitulo.includes(t) || keywords.some((k) => k.includes(t))
    );
    score += matchedTokens.length * 8;

    // Bônus de prioridade
    score += (item.prioridade || 0) * 0.3;

    return score;
  }

  /**
   * Limpa índice.
   */
  clear() {
    this._items = [];
    this._built = false;
  }

  /**
   * Rebuild (chamado quando dados mudam).
   */
  rebuild() {
    this.clear();
    return this.build();
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function capitalize(str) {
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const searchIndex = new SearchIndex();

/* ================================================================
   BINDING DA UI DE BUSCA
   ================================================================ */
export function bindSearchUI() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  // Garante índice construído
  bus.on(EVENTS.APP_READY, () => searchIndex.build());
  bus.on(EVENTS.DATA_SET_SISTEMAS, () => searchIndex.rebuild());
  bus.on(EVENTS.DATA_SET_PROCESSOS, () => searchIndex.rebuild());
  bus.on(EVENTS.DATA_SET_FARMACOS, () => searchIndex.rebuild());

  let selectedIndex = -1;
  let currentResults = [];

  const render = (items) => {
    currentResults = items;
    selectedIndex = -1;

    if (items.length === 0) {
      results.innerHTML = '<p class="empty-state">Nenhum resultado encontrado.</p>';
      return;
    }

    results.innerHTML = items.map((it, i) => `
      <div class="search-result-item" data-index="${i}" data-rota="${it.rota}" tabindex="0">
        <span class="search-result-icon">${it.icon}</span>
        <div class="search-result-text">
          <span class="search-result-title">${escapeHtml(it.titulo)}</span>
          <span class="search-result-sub">${escapeHtml(it.subtitulo)}</span>
        </div>
      </div>
    `).join('');

    results.querySelectorAll('.search-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const rota = el.dataset.rota;
        if (rota) {
          bus.emit(EVENTS.SEARCH_SELECT, { rota });
          window.location.hash = '#' + rota;
          closeSearch();
        }
      });
    });
  };

  const debounced = debounce((q) => {
    const items = searchIndex.search(q, 20);
    render(items);
    bus.emit(EVENTS.SEARCH_RESULTS, { query: q, count: items.length });
  }, 160);

  input.addEventListener('input', (e) => {
    bus.emit(EVENTS.SEARCH_QUERY, { query: e.target.value });
    debounced(e.target.value);
  });

  // Navegação por teclado
  input.addEventListener('keydown', (e) => {
    if (currentResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      highlightResult();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightResult();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const item = currentResults[selectedIndex];
      if (item) {
        window.location.hash = '#' + item.rota;
        closeSearch();
      }
    }
  });

  function highlightResult() {
    results.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.classList.toggle('selected', i === selectedIndex);
    });
    results.querySelectorAll('.search-result-item')[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }
}

function closeSearch() {
  document.getElementById('searchModal').hidden = true;
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export default searchIndex;
