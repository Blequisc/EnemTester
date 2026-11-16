// Gera de uma vez as explicações das provas e salva em data/explanations/<ano>/<id>.md.
// Depois disso o site mostra as explicações na hora, sem precisar de chave da API.
//
// Uso:
//   npm run gerar -- --anos 2023 --modelo claude-haiku-5-5 --agora --limite 5   (teste rápido)
//   npm run gerar -- --anos 2019-2023 --modelo claude-haiku-5-5                (lote, metade do preço)
//   npm run gerar                                                              (todas as provas)
//
// Opções:
//   --anos 2023 | 2019-2023 | 2018,2020   Quais provas (padrão: todas)
//   --modelo <id>                          Modelo do Claude (padrão: CLAUDE_MODEL do .env ou claude-opus-5-5)
//   --agora                                Gera na hora, uma a uma (preço cheio). Sem isso, usa o modo em lote
//   --limite <n>                           Gera no máximo n explicações
//   --sim                                  Não pede confirmação antes de gastar
//   --refazer                              Gera de novo mesmo as que já existem
//
// Questões que já têm explicação são puladas, então dá para rodar várias vezes sem pagar duas vezes.
// No modo em lote, se você fechar o terminal, é só rodar `npm run gerar` de novo para continuar.
import "../server/env.ts";
import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { listExams, listQuestions } from "../server/enem.ts";
import { buildParams, currentModel, readStoredExplanation, saveExplanation, STORE_DIR } from "../server/explain.ts";
import type { Question } from "../shared/types.ts";

const PENDING = path.join(STORE_DIR, ".lote-pendente.json");

// Preço por milhão de tokens (entrada, saída). O lote custa metade.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
// Média aproximada por explicação (enunciado + imagens na entrada; raciocínio + texto na saída).
const AVG_IN = 4500;
const AVG_OUT = 2500;

interface Pending {
  batchId: string;
  model: string;
  count: number;
  createdAt: string;
}

function parseArgs(argv: string[]) {
  const opts = { years: null as number[] | null, model: currentModel(), now: false, limit: 0, yes: false, redo: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v) throw new Error(`Faltou o valor de ${a}`);
      return v;
    };
    if (a === "--anos") opts.years = parseYears(next());
    else if (a === "--modelo") opts.model = next();
    else if (a === "--agora") opts.now = true;
    else if (a === "--limite") opts.limit = Number(next());
    else if (a === "--sim") opts.yes = true;
    else if (a === "--refazer") opts.redo = true;
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  return opts;
}

function parseYears(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(",")) {
    const [a, b] = part.split("-").map(Number);
    if (!a) throw new Error(`Ano inválido: ${part}`);
    for (let y = a; y <= (b || a); y++) out.push(y);
  }
  return out;
}

function money(n: number) {
  if (n < 0.01) return "menos de US$ 0,01";
  return `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function ask(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^s(im)?$/i.test(answer.trim());
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function collectQuestions(years: number[] | null): Promise<Question[]> {
  const exams = await listExams();
  const wanted = years ? exams.filter((e) => years.includes(e.year)) : exams;
  if (!wanted.length) throw new Error(`Nenhuma prova encontrada para: ${years?.join(", ")}`);
  const byId = new Map<string, Question>();
  for (const exam of wanted) {
    process.stdout.write(`Buscando ENEM ${exam.year}… `);
    // Inglês e espanhol: as 5 primeiras questões mudam conforme a língua escolhida.
    for (const lang of ["ingles", "espanhol"]) {
      for (const q of await listQuestions(exam.year, lang)) byId.set(q.id, q);
    }
    console.log("ok");
  }
  return [...byId.values()];
}

async function generateNow(client: Anthropic, questions: Question[], model: string) {
  let done = 0;
  const failed: string[] = [];
  const queue = [...questions];
  async function worker() {
    for (let q = queue.shift(); q; q = queue.shift()) {
      try {
        const msg = await client.messages.create(buildParams(q, model));
        const text = textOf(msg);
        if (msg.stop_reason === "end_turn" && text) await saveExplanation(q.id, text);
        else failed.push(`${q.id} (${msg.stop_reason})`);
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) throw err;
        failed.push(`${q.id} (${err instanceof Error ? err.message : err})`);
      }
      done++;
      process.stdout.write(`\rGerando: ${done}/${questions.length}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log();
  return failed;
}

async function submitBatch(client: Anthropic, questions: Question[], model: string): Promise<Pending> {
  const batch = await client.messages.batches.create({
    requests: questions.map((q) => ({ custom_id: q.id, params: buildParams(q, model) })),
  });
  const pending: Pending = { batchId: batch.id, model, count: questions.length, createdAt: new Date().toISOString() };
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(PENDING, JSON.stringify(pending, null, 2));
  console.log(`Lote enviado (${batch.id}).`);
  return pending;
}

async function waitAndCollect(client: Anthropic, pending: Pending) {
  console.log("Aguardando o lote terminar. Costuma levar menos de 1 hora (máximo de 24 horas).");
  console.log("Pode fechar o terminal se quiser: depois é só rodar `npm run gerar` de novo para continuar.\n");
  for (;;) {
    const b = await client.messages.batches.retrieve(pending.batchId);
    const c = b.request_counts;
    const finished = c.succeeded + c.errored + c.canceled + c.expired;
    process.stdout.write(`\r[${new Date().toLocaleTimeString("pt-BR")}] ${finished}/${pending.count} prontas   `);
    if (b.processing_status === "ended") break;
    await new Promise((r) => setTimeout(r, 60_000));
  }
  console.log("\nSalvando explicações…");

  let saved = 0;
  const failed: string[] = [];
  for await (const r of await client.messages.batches.results(pending.batchId)) {
    if (r.result.type === "succeeded") {
      const msg = r.result.message;
      const text = textOf(msg);
      if (msg.stop_reason === "end_turn" && text) {
        await saveExplanation(r.custom_id, text);
        saved++;
      } else failed.push(`${r.custom_id} (${msg.stop_reason})`);
    } else {
      failed.push(`${r.custom_id} (${r.result.type})`);
    }
  }
  await rm(PENDING, { force: true });
  console.log(`${saved} explicações salvas.`);
  return failed;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("Configure ANTHROPIC_API_KEY no arquivo .env antes de gerar as explicações.");
  }
  const client = new Anthropic();
  let failed: string[];

  if (existsSync(PENDING)) {
    const pending: Pending = JSON.parse(await readFile(PENDING, "utf8"));
    console.log(`Continuando o lote enviado em ${new Date(pending.createdAt).toLocaleString("pt-BR")} (${pending.count} questões).`);
    failed = await waitAndCollect(client, pending);
  } else {
    let questions = await collectQuestions(opts.years);
    const total = questions.length;
    if (!opts.redo) {
      const missing: Question[] = [];
      for (const q of questions) if (!(await readStoredExplanation(q.id))) missing.push(q);
      questions = missing;
    }
    if (opts.limit > 0) questions = questions.slice(0, opts.limit);

    console.log(`\n${total} questões encontradas, ${questions.length} para gerar.`);
    if (!questions.length) return console.log("Nada a fazer: todas já têm explicação. 🎉");

    const price = PRICES[opts.model];
    const mode = opts.now ? "agora (preço cheio)" : "lote (metade do preço)";
    console.log(`Modelo: ${opts.model} · Modo: ${mode}`);
    if (price) {
      const each = ((AVG_IN * price[0] + AVG_OUT * price[1]) / 1e6) * (opts.now ? 1 : 0.5);
      console.log(`Custo estimado: entre ${money(each * questions.length * 0.7)} e ${money(each * questions.length * 1.3)}`);
    }
    if (!opts.yes && !(await ask("Continuar? [s/N] "))) return console.log("Cancelado.");

    failed = opts.now
      ? await generateNow(client, questions, opts.model)
      : await waitAndCollect(client, await submitBatch(client, questions, opts.model));
  }

  if (failed.length) {
    console.log(`\n⚠️  ${failed.length} não foram geradas:`);
    for (const f of failed.slice(0, 20)) console.log(`   - ${f}`);
    if (failed.length > 20) console.log(`   … e mais ${failed.length - 20}`);
    console.log("Rode o mesmo comando de novo para tentar só essas.");
  } else {
    console.log("\nTudo pronto! ✅");
  }
}

main().catch((err) => {
  if (err instanceof Anthropic.AuthenticationError) console.error("\n❌ Chave da API inválida. Confira o ANTHROPIC_API_KEY no .env.");
  else if (err instanceof Anthropic.APIError) console.error(`\n❌ Erro da API do Claude (${err.status}): ${err.message}`);
  else console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
