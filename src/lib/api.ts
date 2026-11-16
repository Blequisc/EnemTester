import type { Exam, Question } from "../../shared/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

export interface Health {
  /** O servidor consegue gerar explicações novas na hora (tem chave da API). */
  live: boolean;
  /** Quantas explicações já estão prontas no servidor. */
  stored: number;
}

export async function fetchHealth(): Promise<Health> {
  try {
    return await json(await fetch("/api/health"));
  } catch {
    return { live: false, stored: 0 };
  }
}

export async function fetchExams(): Promise<Exam[]> {
  return json(await fetch("/api/exams"));
}

export async function fetchQuestions(year: number, language: string): Promise<Question[]> {
  return json(await fetch(`/api/exams/${year}/questions?language=${encodeURIComponent(language)}`));
}

const EXPLAIN_CACHE = "enemtester:explanations";

function readExplainCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(EXPLAIN_CACHE) ?? "{}");
  } catch {
    return {};
  }
}

export function cachedExplanation(id: string): string | null {
  return readExplainCache()[id] ?? null;
}

function saveExplanation(id: string, text: string) {
  try {
    const all = readExplainCache();
    all[id] = text;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 150))) delete all[k];
    localStorage.setItem(EXPLAIN_CACHE, JSON.stringify(all));
  } catch {
    /* armazenamento cheio ou bloqueado: tudo bem */
  }
}

export class ExplainError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Busca a explicação em streaming, chamando onText com o texto acumulado. */
export async function streamExplanation(
  q: Question,
  onText: (full: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ year: q.year, index: q.index, language: q.language }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new ExplainError(res.status, body?.error ?? "Não foi possível carregar a explicação.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  full += decoder.decode();
  if (full.trim() && !full.includes("> ⚠️")) saveExplanation(q.id, full);
  onText(full);
  return full;
}
