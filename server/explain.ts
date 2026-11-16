// Explicações das questões: prompt, armazenamento em arquivos e geração ao vivo com o Claude.
import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DISCIPLINES, type Question } from "../shared/types.ts";

export const DEFAULT_MODEL = "claude-opus-5-5";
export function currentModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

/** Pasta com as explicações prontas (geradas em lote ou ao vivo). Vai junto no repositório. */
export const STORE_DIR = path.resolve("data/explanations");
const ID_RE = /^(\d{4})-\d{1,3}(?:-(?:ingles|espanhol))?$/;

let client: Anthropic | null = null;
export function explanationsEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

// Prompt fixo (não muda entre requisições) para aproveitar o cache de prompt.
export const SYSTEM = `Você é um professor experiente de cursinho pré-vestibular, especialista no ENEM.
Sua tarefa é explicar uma questão de uma prova antiga do ENEM para um estudante que acabou de resolvê-la.

Escreva em português do Brasil, com linguagem clara, acolhedora e direta, como numa boa aula particular.
Use Markdown com exatamente estas seções, nesta ordem:

## ✅ Resposta: letra X
Uma frase dizendo o que a questão pede.

### Por que a alternativa X está correta
O raciocínio passo a passo até a resposta. Em questões de cálculo, mostre as contas.

### Por que as outras estão erradas
Uma linha curta para cada alternativa incorreta, no formato "**A)** motivo". Aponte o erro de raciocínio típico que leva o aluno a marcá-la.

### 📚 O conteúdo por trás da questão
Uma mini-aula (1 a 3 parágrafos curtos ou uma lista) sobre o assunto cobrado: conceitos, fórmulas, contexto histórico ou regras gramaticais que o aluno precisa dominar para acertar questões parecidas.

### 💡 Dica para a prova
Uma dica prática e curta (estratégia de leitura, pegadinha recorrente, atalho de cálculo).

Regras:
- Não use LaTeX. Escreva fórmulas em texto simples com símbolos Unicode (ex.: v = Δs/Δt, x², √2, π).
- Seja conciso: entre 250 e 500 palavras no total.
- O gabarito oficial informado está correto; nunca o contradiga. Se não conseguir ver uma imagem necessária, diga isso de forma breve e explique com base no texto e no gabarito.
- Não invente dados que não estão na questão.`;

export function buildContent(q: Question): Anthropic.ContentBlockParam[] {
  const area = DISCIPLINES[q.discipline]?.label ?? q.discipline;
  const alts = q.alternatives
    .map((a) => `${a.letter}) ${a.text || (a.file ? "[alternativa em imagem]" : "")}`)
    .join("\n");
  const text = [
    `ENEM ${q.year} — ${q.title} — ${area}${q.language ? ` (${q.language})` : ""}`,
    "",
    "Enunciado:",
    q.context || "(sem texto)",
    "",
    q.alternativesIntroduction,
    "",
    "Alternativas:",
    alts,
    "",
    `Gabarito oficial: ${q.correctAlternative}`,
  ].join("\n");

  // Imagens do enunciado e das alternativas (o Claude busca pela URL).
  const images = [...q.files, ...q.alternatives.map((a) => a.file)]
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
    .slice(0, 8)
    .map((url): Anthropic.ContentBlockParam => ({ type: "image", source: { type: "url", url } }));

  return [...images, { type: "text", text }];
}

/** Parâmetros da requisição, usados tanto ao vivo quanto na geração em lote. */
export function buildParams(q: Question, model: string): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: 8000,
    output_config: { effort: "medium" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildContent(q) }],
  };
}

function storePath(id: string): string | null {
  const m = id.match(ID_RE);
  return m ? path.join(STORE_DIR, m[1], `${id}.md`) : null;
}

export async function readStoredExplanation(id: string): Promise<string | null> {
  const file = storePath(id);
  if (!file) return null;
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

export async function saveExplanation(id: string, text: string): Promise<void> {
  const file = storePath(id);
  if (!file || !text.trim()) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text.trim() + "\n", "utf8");
}

/** Gera ao vivo em streaming, chamando onText a cada pedaço, e salva o resultado. */
export async function streamExplanation(
  q: Question,
  onText: (chunk: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const stream = getClient().beta.messages.stream(
    {
      ...buildParams(q, currentModel()),
      // Se o modelo recusar por engano, a API tenta de novo num modelo alternativo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal },
  );

  let full = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      full += event.delta.text;
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    throw new Error("Não foi possível gerar a explicação desta questão.");
  }
  await saveExplanation(q.id, full);
  return full;
}
