// Gera a explicação de uma questão com o Claude, em streaming, e guarda em cache no disco.
import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DISCIPLINES, type Question } from "../shared/types.ts";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const CACHE_DIR = path.resolve(".cache/explanations");

let client: Anthropic | null = null;
export function explanationsEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

// Prompt fixo (não muda entre requisições) para aproveitar o cache de prompt.
const SYSTEM = `Você é um professor experiente de cursinho pré-vestibular, especialista no ENEM.
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

function buildContent(q: Question): Anthropic.Beta.BetaContentBlockParam[] {
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
    .map((url): Anthropic.Beta.BetaContentBlockParam => ({ type: "image", source: { type: "url", url } }));

  return [...images, { type: "text", text }];
}

function cacheFile(q: Question) {
  return path.join(CACHE_DIR, `${q.id.replace(/[^a-z0-9-]/gi, "_")}.md`);
}

export async function getCachedExplanation(q: Question): Promise<string | null> {
  try {
    return await readFile(cacheFile(q), "utf8");
  } catch {
    return null;
  }
}

/** Faz o streaming da explicação, chamando onText a cada pedaço. Retorna o texto completo. */
export async function streamExplanation(
  q: Question,
  onText: (chunk: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const stream = getClient().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium" },
      // Se o modelo recusar por engano, a API tenta de novo num modelo alternativo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildContent(q) }],
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

  if (full.trim()) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile(q), full, "utf8");
  }
  return full;
}
