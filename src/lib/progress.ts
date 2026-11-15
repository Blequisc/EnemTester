// Progresso do estudante, salvo no navegador (localStorage).
import type { Letter, Question } from "../../shared/types";

const KEY = "enemtester:progress:v1";

export interface AnswerRecord {
  chosen: Letter;
  correct: boolean;
  at: number;
  discipline: string;
  year: number;
}

export interface Progress {
  answers: Record<string, AnswerRecord>;
  /** Questões erradas guardadas para revisão (removidas quando acertadas depois). */
  mistakes: Record<string, Question>;
}

function empty(): Progress {
  return { answers: {}, mistakes: {} };
}

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return p && typeof p === "object" ? { ...empty(), ...p } : empty();
  } catch {
    return empty();
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function recordAnswer(q: Question, chosen: Letter): Progress {
  const p = loadProgress();
  const correct = chosen === q.correctAlternative;
  p.answers[q.id] = { chosen, correct, at: Date.now(), discipline: q.discipline, year: q.year };
  if (correct) delete p.mistakes[q.id];
  else {
    const { explanation: _omit, ...rest } = q;
    p.mistakes[q.id] = q.explanation ? q : (rest as Question);
  }
  // Limita o banco de erros para não lotar o armazenamento.
  const ids = Object.keys(p.mistakes);
  for (const id of ids.slice(0, Math.max(0, ids.length - 300))) delete p.mistakes[id];
  save(p);
  return p;
}

export function resetProgress() {
  save(empty());
}

export interface AreaStats {
  total: number;
  correct: number;
}

export function statsByDiscipline(p: Progress): Record<string, AreaStats> {
  const out: Record<string, AreaStats> = {};
  for (const a of Object.values(p.answers)) {
    const s = (out[a.discipline] ??= { total: 0, correct: 0 });
    s.total++;
    if (a.correct) s.correct++;
  }
  return out;
}
