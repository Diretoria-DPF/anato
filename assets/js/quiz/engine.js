/**
 * LAIFT · Anatomia 3D
 * quiz/engine.js — Motor do Quiz
 *
 * Responsável por:
 *   - Carregar questões do state ou backend
 *   - Filtrar por etapa/submódulo
 *   - Renderizar pergunta + opções
 *   - Validar resposta e feedback visual
 *   - Persistir progresso
 *   - Estatísticas (score, streak, precisão)
 */

import { bus, EVENTS } from '../core/events.js';
import { dispatch, ACTIONS, getState, store } from '../core/state.js';

/* ================================================================
   CONFIGURAÇÃO
   ================================================================ */
const QUIZ_CONFIG = {
  maxQuestionsPerSession: 40,
  allowSkip: true,
  showExplanationImmediately: true,
  pointsPerCorrect: 10,
  bonusForStreak: true,
  streakBonusMultiplier: 0.5
};

/* ================================================================
   CLASSE PRINCIPAL
   ================================================================ */
export class QuizEngine {
  constructor() {
    this._initialized = false;
    this._currentQuestion = null;
    this._answered = false;
    this._sessionStart = null;
  }

  init() {
    if (this._initialized) return this;
    this._bindEvents();
    this._initialized = true;
    console.log('[Quiz] Inicializado');
    return this;
  }

  /* --------------------------------------------------------------
     CARREGAMENTO E FILTRO
     -------------------------------------------------------------- */

  /**
   * Carrega questões (do state já povoado via JSON/GAS).
   */
  loadQuestions() {
    const state = getState();
    const questions = state.quiz.questions || [];
    if (questions.length === 0) {
      console.warn('[Quiz] Nenhuma questão carregada');
      return [];
    }
    this._applyFilter();
    dispatch({ type: ACTIONS.QUIZ_SET_LOADED, payload: true });
    bus.emit(EVENTS.QUIZ_LOADED, { total: questions.length });
    return questions;
  }

  /**
   * Aplica filtro de etapa/submódulo.
   */
  _applyFilter() {
    const state = getState();
    const { questions, filter } = state.quiz;

    let filtered = questions.filter((q) => q.etapa === filter.etapa);
    if (filter.submodulo && filter.submodulo !== 'todos') {
      filtered = filtered.filter((q) => q.sub === filter.submodulo);
    }

    const ids = filtered.map((q) => q.id);
    dispatch({ type: ACTIONS.QUIZ_SET_FILTERED, payload: ids });
    return filtered;
  }

  /**
   * Muda filtro.
   */
  setFilter({ etapa, submodulo }) {
    dispatch({
      type: ACTIONS.QUIZ_SET_FILTER,
      payload: { ...(etapa !== undefined && { etapa }), ...(submodulo !== undefined && { submodulo }) }
    });
    this._applyFilter();
    dispatch({ type: ACTIONS.QUIZ_SET_INDEX, payload: 0 });
    this._renderCurrent();
    bus.emit(EVENTS.QUIZ_FILTER_CHANGED, getState().quiz.filter);
  }

  /* --------------------------------------------------------------
     NAVEGAÇÃO
     -------------------------------------------------------------- */
  getCurrentQuestion() {
    const state = getState();
    const { questions, filteredIds, currentIndex } = state.quiz;
    const id = filteredIds[currentIndex];
    return questions.find((q) => q.id === id) || null;
  }

  next() {
    const state = getState();
    const total = state.quiz.filteredIds.length;
    if (state.quiz.currentIndex < total - 1) {
      dispatch({ type: ACTIONS.QUIZ_SET_INDEX, payload: state.quiz.currentIndex + 1 });
      this._renderCurrent();
      return true;
    }
    // Fim da sessão
    this._completeSession();
    return false;
  }

  prev() {
    const state = getState();
    if (state.quiz.currentIndex > 0) {
      dispatch({ type: ACTIONS.QUIZ_SET_INDEX, payload: state.quiz.currentIndex - 1 });
      this._renderCurrent();
      return true;
    }
    return false;
  }

  goto(index) {
    const state = getState();
    const total = state.quiz.filteredIds.length;
    if (index >= 0 && index < total) {
      dispatch({ type: ACTIONS.QUIZ_SET_INDEX, payload: index });
      this._renderCurrent();
    }
  }

  /* --------------------------------------------------------------
     RESPOSTAS
     -------------------------------------------------------------- */
  answer(optionIndex) {
    const state = getState();
    if (state.quiz.answered) return;

    const q = this.getCurrentQuestion();
    if (!q) return;

    const isCorrect = optionIndex === q.ans;
    const newScore = isCorrect ? state.quiz.score + QUIZ_CONFIG.pointsPerCorrect : state.quiz.score;
    const newStreak = isCorrect ? state.quiz.streak + 1 : 0;
    const newBestStreak = Math.max(newStreak, state.quiz.bestStreak);

    // Aplica bônus de streak
    let bonus = 0;
    if (isCorrect && QUIZ_CONFIG.bonusForStreak && newStreak >= 3) {
      bonus = Math.round(QUIZ_CONFIG.pointsPerCorrect * QUIZ_CONFIG.streakBonusMultiplier * Math.floor(newStreak / 3));
    }

    store.batch(() => {
      dispatch({ type: ACTIONS.QUIZ_SET_ANSWER, payload: { id: q.id, optionIndex } });
      dispatch({ type: ACTIONS.QUIZ_SET_SCORE, payload: newScore + bonus });
      dispatch({ type: ACTIONS.QUIZ_SET_STREAK, payload: newStreak });
      dispatch({ type: ACTIONS.QUIZ_SET_BEST_STREAK, payload: newBestStreak });
      dispatch({ type: ACTIONS.QUIZ_SET_ANSWERED, payload: true });
    });

    this._renderFeedback(optionIndex, q.ans, isCorrect, bonus);

    bus.emit(EVENTS.QUIZ_ANSWERED, {
      questionId: q.id,
      selected: optionIndex,
      correct: q.ans,
      isCorrect,
      bonus,
      streak: newStreak
    });
    return isCorrect;
  }

  /* --------------------------------------------------------------
     RENDERIZAÇÃO
     -------------------------------------------------------------- */
  _renderCurrent() {
    const q = this.getCurrentQuestion();
    if (!q) {
      this._renderEmpty();
      return;
    }
    this._currentQuestion = q;
    this._answered = getState().quiz.answers[q.id] !== undefined;

    // Badges
    const badgeEtapa = document.getElementById('quizProgress');
    const state = getState();
    if (badgeEtapa) badgeEtapa.textContent = `${state.quiz.currentIndex + 1} / ${state.quiz.filteredIds.length}`;

    // Pergunta
    const qEl = document.getElementById('quizQuestion');
    if (qEl) {
      qEl.innerHTML = `
        <div class="quiz-meta">
          <span class="quiz-badge">Etapa ${q.etapa}</span>
          <span class="quiz-badge">${q.sistema || ''}</span>
          <span class="quiz-badge difficulty">${'⭐'.repeat(q.diff || 1)}</span>
        </div>
        <p class="quiz-text">${escapeHtml(q.q)}</p>
      `;
    }

    // Opções
    const optsEl = document.getElementById('quizOptions');
    if (optsEl) {
      const letters = ['A', 'B', 'C', 'D'];
      optsEl.innerHTML = q.opts.map((opt, i) => `
        <button class="quiz-option" data-index="${i}" role="radio" aria-checked="false">
          <span class="quiz-letter">${letters[i]}</span>
          <span class="quiz-option-text">${escapeHtml(opt)}</span>
        </button>
      `).join('');

      // Bind
      optsEl.querySelectorAll('.quiz-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          this.answer(idx);
        });
      });

      // Se já foi respondida nesta sessão, mostra feedback
      const prevAnswer = getState().quiz.answers[q.id];
      if (prevAnswer !== undefined) {
        this._renderFeedback(prevAnswer, q.ans, prevAnswer === q.ans, 0, true);
      }
    }

    // Explicação (esconde)
    const expBox = document.getElementById('quizExplanation');
    if (expBox && !this._answered) expBox.hidden = true;

    // Navegação
    this._updateNavButtons();

    bus.emit(EVENTS.QUIZ_QUESTION_CHANGED, {
      question: q,
      index: getState().quiz.currentIndex,
      total: getState().quiz.filteredIds.length
    });
  }

  _renderFeedback(selectedIdx, correctIdx, isCorrect, bonus, silent = false) {
    const optsEl = document.getElementById('quizOptions');
    if (!optsEl) return;

    const btns = optsEl.querySelectorAll('.quiz-option');
    btns.forEach((btn, i) => {
      btn.disabled = true;
      if (i === correctIdx) btn.classList.add('correct');
      else if (i === selectedIdx && !isCorrect) btn.classList.add('incorrect');
      if (i === selectedIdx) btn.classList.add('selected');
    });

    // Explicação
    const q = this._currentQuestion;
    if (q && QUIZ_CONFIG.showExplanationImmediately) {
      const expBox = document.getElementById('quizExplanation');
      const expText = document.getElementById('quizExplanationText');
      if (expBox && expText) {
        expBox.hidden = false;
        expText.innerHTML = escapeHtml(q.exp || 'Sem explicação disponível.') +
          (bonus > 0 ? ` <strong class="bonus">+${bonus} pts (streak bônus!)</strong>` : '');
      }
    }

    if (!silent) {
      this._updateNavButtons();
    }
  }

  _renderEmpty() {
    const qEl = document.getElementById('quizQuestion');
    if (qEl) qEl.innerHTML = '<p class="empty-state">Nenhuma questão disponível. Ajuste o filtro.</p>';
    const optsEl = document.getElementById('quizOptions');
    if (optsEl) optsEl.innerHTML = '';
  }

  _updateNavButtons() {
    const state = getState();
    const prev = document.getElementById('quizPrev');
    const next = document.getElementById('quizNext');

    if (prev) prev.disabled = state.quiz.currentIndex === 0;
    if (next) {
      const total = state.quiz.filteredIds.length;
      next.disabled = state.quiz.currentIndex >= total - 1;
      next.textContent = (state.quiz.currentIndex === total - 1) ? 'Finalizar' : 'Próxima →';
    }
  }

  /* --------------------------------------------------------------
     SESSÃO
     -------------------------------------------------------------- */
  startSession() {
    this._sessionStart = Date.now();
    dispatch({ type: ACTIONS.QUIZ_RESET });
    this._applyFilter();
    this._renderCurrent();
  }

  _completeSession() {
    const state = getState();
    const total = state.quiz.filteredIds.length;
    const answered = Object.keys(state.quiz.answers).length;
    const accuracy = answered > 0 ? Math.round((state.quiz.score / (answered * QUIZ_CONFIG.pointsPerCorrect)) * 100) : 0;

    bus.emit(EVENTS.QUIZ_COMPLETED, {
      score: state.quiz.score,
      answered,
      total,
      accuracy,
      bestStreak: state.quiz.bestStreak,
      durationMs: Date.now() - (this._sessionStart || Date.now())
    });

    console.log(`[Quiz] Sessão completa: ${state.quiz.score} pts, ${answered}/${total} respondidas`);
  }

  getStats() {
    const state = getState();
    const answered = Object.keys(state.quiz.answers).length;
    return {
      score: state.quiz.score,
      streak: state.quiz.streak,
      bestStreak: state.quiz.bestStreak,
      answered,
      total: state.quiz.filteredIds.length,
      accuracy: answered > 0 ? Math.round((state.quiz.score / (answered * QUIZ_CONFIG.pointsPerCorrect)) * 100) : 0
    };
  }

  /* --------------------------------------------------------------
     EVENTOS
     -------------------------------------------------------------- */
  _bindEvents() {
    bus.on(EVENTS.QUIZ_FILTER_CHANGED, () => {
      this._applyFilter();
      this._renderCurrent();
    });
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ================================================================
   SINGLETON
   ================================================================ */
export const quizEngine = new QuizEngine();

/* ================================================================
   BINDING DOS BOTÕES
   ================================================================ */
export function bindQuizControls() {
  const prev = document.getElementById('quizPrev');
  const next = document.getElementById('quizNext');
  const chips = document.querySelectorAll('[data-quiz-filter]');

  prev?.addEventListener('click', () => quizEngine.prev());
  next?.addEventListener('click', () => quizEngine.next());

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const etapa = parseInt(chip.dataset.quizFilter, 10);
      if (!isNaN(etapa)) quizEngine.setFilter({ etapa, submodulo: 'todos' });
    });
  });

  // Atalhos de teclado no painel
  document.addEventListener('keydown', (e) => {
    const state = getState();
    if (state.ui.activePanel !== 'quiz') return;
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (!document.getElementById('quizNext')?.disabled) quizEngine.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      quizEngine.prev();
    } else if (/^[1-4]$/.test(e.key)) {
      e.preventDefault();
      quizEngine.answer(parseInt(e.key, 10) - 1);
    }
  });
}

export default quizEngine;
