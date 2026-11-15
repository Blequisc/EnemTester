// Busca as provas na API pública api.enem.dev e normaliza o formato.
import type { Alternative, Exam, Letter, Question } from "../shared/types.ts";

const BASE = (process.env.ENEM_API_URL ?? "https://api.enem.dev/v1").replace(/\/$/, "");
const LETTERS: Letter[] = ["A", "B", "C", "D", "E"];
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

async function getJson<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = (async () => {
    const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new EnemApiError(res.status, `api.enem.dev respondeu ${res.status} em ${path}`);
    return res.json();
  })();
  cache.set(path, { at: Date.now(), value });
  value.catch(() => cache.delete(path));
  return value as Promise<T>;
}

export class EnemApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function normalizeQuestion(raw: any): Question {
  const year = Number(raw.year);
  const index = Number(raw.index);
  const language = raw.language ? String(raw.language) : null;
  const alternatives: Alternative[] = (Array.isArray(raw.alternatives) ? raw.alternatives : [])
    .map((a: any, i: number) => ({
      letter: (LETTERS.includes(a?.letter) ? a.letter : LETTERS[i]) as Letter,
      text: str(a?.text),
      file: typeof a?.file === "string" && a.file ? a.file : null,
    }))
    .slice(0, 5);
  const fromFlag = (raw.alternatives ?? []).find((a: any) => a?.isCorrect)?.letter;
  const correct = (LETTERS.includes(raw.correctAlternative) ? raw.correctAlternative : fromFlag) as Letter;
  return {
    id: `${year}-${index}${language ? `-${language}` : ""}`,
    year,
    index,
    title: str(raw.title) || `Questão ${index}`,
    discipline: str(raw.discipline),
    language,
    context: str(raw.context),
    files: Array.isArray(raw.files) ? raw.files.filter((f: unknown) => typeof f === "string") : [],
    alternativesIntroduction: str(raw.alternativesIntroduction),
    alternatives,
    correctAlternative: correct,
  };
}

export async function listExams(): Promise<Exam[]> {
  const raw = await getJson<any[]>("/exams");
  return raw
    .map((e) => ({
      year: Number(e.year),
      title: str(e.title) || `ENEM ${e.year}`,
      disciplines: Array.isArray(e.disciplines) ? e.disciplines : [],
      languages: Array.isArray(e.languages) ? e.languages : [],
    }))
    .sort((a, b) => b.year - a.year);
}

/** Todas as questões de um ano (a API pagina de 50 em 50). */
export async function listQuestions(year: number, language: string): Promise<Question[]> {
  const out: Question[] = [];
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const data = await getJson<any>(
      `/exams/${year}/questions?limit=50&offset=${offset}&language=${encodeURIComponent(language)}`,
    );
    const qs: any[] = Array.isArray(data?.questions) ? data.questions : [];
    out.push(...qs.map(normalizeQuestion));
    if (!data?.metadata?.hasMore || qs.length === 0) break;
    offset += qs.length;
  }
  return out.filter((q) => q.alternatives.length > 0 && q.correctAlternative);
}

export async function getQuestion(year: number, index: number, language: string | null): Promise<Question> {
  const qs = language ? `?language=${encodeURIComponent(language)}` : "";
  return normalizeQuestion(await getJson<any>(`/exams/${year}/questions/${index}${qs}`));
}
