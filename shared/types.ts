export type Letter = "A" | "B" | "C" | "D" | "E";

export interface Alternative {
  letter: Letter;
  text: string;
  file: string | null;
}

export interface Question {
  /** Identificador estável, ex: "2023-12-ingles" ou "demo-3". */
  id: string;
  year: number;
  index: number;
  title: string;
  /** "ciencias-humanas" | "ciencias-natureza" | "linguagens" | "matematica" */
  discipline: string;
  language: string | null;
  context: string;
  files: string[];
  alternativesIntroduction: string;
  alternatives: Alternative[];
  correctAlternative: Letter;
  /** Avisos sobre partes da questão que não estão disponíveis na base de dados. */
  notices?: string[];
  /** Só existe nas questões de demonstração, que já vêm com explicação pronta. */
  explanation?: string;
}

export interface Exam {
  year: number;
  title: string;
  disciplines: { label: string; value: string }[];
  languages: { label: string; value: string }[];
}

export const DISCIPLINES: Record<string, { label: string; short: string; color: string }> = {
  "ciencias-humanas": { label: "Ciências Humanas", short: "Humanas", color: "var(--c-humanas)" },
  "ciencias-natureza": { label: "Ciências da Natureza", short: "Natureza", color: "var(--c-natureza)" },
  linguagens: { label: "Linguagens e Códigos", short: "Linguagens", color: "var(--c-linguagens)" },
  matematica: { label: "Matemática", short: "Matemática", color: "var(--c-matematica)" },
};

/** Mesmo formato de id usado no site, no servidor e nos arquivos de explicação. */
export function questionId(year: number, index: number, language: string | null): string {
  return `${year}-${index}${language ? `-${language}` : ""}`;
}
