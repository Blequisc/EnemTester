// Busca as provas na API pública api.enem.dev e normaliza o formato.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { questionId, type Alternative, type Exam, type Letter, type Question } from "../shared/types.ts";

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

/**
 * Área oficial pela posição da questão na prova (a base enem.dev erra a área de algumas questões).
 * 2009–2016: Humanas (1–45), Natureza (46–90), Linguagens (91–135), Matemática (136–180).
 * 2017 em diante: Linguagens (1–45), Humanas (46–90), Natureza (91–135), Matemática (136–180).
 */
export function officialDiscipline(year: number, index: number, fallback: string): string {
  if (!Number.isInteger(index) || index < 1 || index > 180) return fallback;
  const order =
    year >= 2017
      ? ["linguagens", "ciencias-humanas", "ciencias-natureza", "matematica"]
      : ["ciencias-humanas", "ciencias-natureza", "linguagens", "matematica"];
  return order[Math.floor((index - 1) / 45)];
}

/**
 * Em algumas questões da base, o texto inteiro veio no campo da pergunta (e o enunciado ficou vazio).
 * Separa: tudo antes da última linha vira enunciado; a última linha continua sendo a pergunta.
 */
function splitIntro(context: string, intro: string): { context: string; intro: string } {
  if (context.trim() || !intro.includes("\n")) return { context, intro };
  const lines = intro.trimEnd().split("\n");
  const last = lines.pop() ?? "";
  return { context: lines.join("\n").trim(), intro: last.trim() };
}

/**
 * Correções manuais feitas a partir da prova oficial do INEP (data/corrections/<ano>.json).
 * As imagens recortadas da prova ficam em public/enem-assets/<ano>/.
 */
interface Correction {
  /** Trocas de texto no enunciado: [de, para]. */
  replace?: [string, string][];
  /** Enunciado completo (quando a base perdeu o texto). */
  context?: string;
  /** Texto que falta antes do enunciado da base. */
  prependContext?: string;
  /** Pergunta (quando a base perdeu a frase final). */
  intro?: string;
  /** Imagens das alternativas que faltam: letra → caminho. */
  alternativeFiles?: Partial<Record<string, string>>;
  notice?: string;
}

const corrections = new Map<number, Record<string, Correction>>();
function correctionFor(year: number, id: string): Correction | undefined {
  if (!corrections.has(year)) {
    const file = path.resolve(`data/corrections/${year}.json`);
    corrections.set(year, existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
  }
  return corrections.get(year)?.[id];
}

const BROKEN = /!\[[^\]]*\]\([^)]*broken-image[^)]*\)/g;

/** Aplica correções manuais e troca imagens quebradas da base por avisos claros. */
function fixQuestion(q: Question): Question {
  const fix = correctionFor(q.year, q.id);
  let context = fix?.context ?? q.context;
  for (const [from, to] of fix?.replace ?? []) context = context.split(from).join(to);
  if (fix?.prependContext) context = `${fix.prependContext}\n\n${context}`;
  const alternativesIntroduction = fix?.intro ?? q.alternativesIntroduction;
  // Se a pergunta foi corrigida e o texto da base estava todo no campo da pergunta, ele vira o enunciado.
  if (fix?.intro && !context.trim()) context = q.alternativesIntroduction;
  const alternatives = q.alternatives.map((a) =>
    fix?.alternativeFiles?.[a.letter] ? { ...a, file: fix.alternativeFiles[a.letter] ?? null } : a,
  );

  const notices: string[] = [];
  // Quando há um aviso específico (data/corrections), ele substitui o aviso genérico de imagem.
  if (!fix?.notice && (context.match(BROKEN) || q.files.some((f) => f.includes("broken-image")))) {
    notices.push("Uma imagem desta questão não está disponível na base de dados. A explicação descreve o que é preciso saber sobre ela.");
  }
  context = context.replace(BROKEN, "").trim();
  const files = q.files.filter((f) => !f.includes("broken-image"));
  // Sem enunciado e com uma pergunta curta: o texto de apoio realmente se perdeu.
  if (!context && files.length === 0 && alternativesIntroduction.length < 200) {
    notices.push("O texto de apoio desta questão não está disponível na base de dados. Use a explicação para entender o problema.");
  }
  if (alternatives.some((a) => !a.text.trim() && !a.file)) {
    notices.push("Algumas alternativas desta questão são imagens que não estão disponíveis na base de dados. A explicação descreve a alternativa correta.");
  }
  if (fix?.notice) notices.push(fix.notice);
  return { ...q, context, files, alternativesIntroduction, alternatives, ...(notices.length ? { notices } : {}) };
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
  const text = splitIntro(str(raw.context), str(raw.alternativesIntroduction));
  return fixQuestion({
    id: questionId(year, index, language),
    year,
    index,
    title: str(raw.title) || `Questão ${index}`,
    discipline: officialDiscipline(year, index, str(raw.discipline)),
    language,
    context: text.context,
    files: Array.isArray(raw.files) ? raw.files.filter((f: unknown) => typeof f === "string") : [],
    alternativesIntroduction: text.intro,
    alternatives,
    correctAlternative: correct,
  });
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
  // A API às vezes repete questões entre uma página e outra: remove duplicadas.
  const unique = new Map(out.map((q) => [q.id, q]));
  return [...unique.values()].filter((q) => q.alternatives.length > 0 && q.correctAlternative);
}

export async function getQuestion(year: number, index: number, language: string | null): Promise<Question> {
  const qs = language ? `?language=${encodeURIComponent(language)}` : "";
  return normalizeQuestion(await getJson<any>(`/exams/${year}/questions/${index}${qs}`));
}
