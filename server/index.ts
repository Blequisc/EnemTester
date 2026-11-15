import "./env.ts";
import Anthropic from "@anthropic-ai/sdk";
import express, { type Request, type Response } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { EnemApiError, getQuestion, listExams, listQuestions } from "./enem.ts";
import { explanationsEnabled, getCachedExplanation, streamExplanation } from "./explain.ts";

const app = express();
app.use(express.json({ limit: "10kb" }));

function sendError(res: Response, err: unknown) {
  if (err instanceof EnemApiError) {
    res.status(err.status === 404 ? 404 : 502).json({ error: "Não foi possível buscar a prova agora." });
  } else {
    console.error(err);
    res.status(500).json({ error: "Erro inesperado no servidor." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, explanations: explanationsEnabled() });
});

app.get("/api/exams", async (_req, res) => {
  try {
    res.json(await listExams());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/exams/:year/questions", async (req, res) => {
  const year = Number(req.params.year);
  const language = req.query.language === "espanhol" ? "espanhol" : "ingles";
  if (!Number.isInteger(year)) return void res.status(400).json({ error: "Ano inválido." });
  try {
    res.json(await listQuestions(year, language));
  } catch (err) {
    sendError(res, err);
  }
});

// Limite simples por IP para não estourar a conta da API.
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > Number(process.env.EXPLAIN_LIMIT_PER_HOUR ?? 60);
}

// A explicação é gerada a partir da questão buscada pelo próprio servidor
// (o cliente só informa ano/número/idioma), então o endpoint não vira um proxy aberto do Claude.
app.post("/api/explain", async (req: Request, res: Response) => {
  const year = Number(req.body?.year);
  const index = Number(req.body?.index);
  const language = req.body?.language === "espanhol" ? "espanhol" : req.body?.language === "ingles" ? "ingles" : null;
  if (!Number.isInteger(year) || !Number.isInteger(index) || index < 1 || index > 200) {
    return void res.status(400).json({ error: "Questão inválida." });
  }

  let question;
  try {
    question = await getQuestion(year, index, language);
  } catch (err) {
    return void sendError(res, err);
  }

  const cached = await getCachedExplanation(question);
  if (cached) return void res.type("text/plain").end(cached);

  if (!explanationsEnabled()) {
    return void res.status(503).json({ error: "Explicações desativadas: configure ANTHROPIC_API_KEY no servidor." });
  }
  if (rateLimited(req.ip ?? "?")) {
    return void res.status(429).json({ error: "Muitas explicações pedidas em pouco tempo. Tente de novo daqui a pouco." });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });

  try {
    await streamExplanation(question, (chunk) => res.write(chunk), abort.signal);
    res.end();
  } catch (err) {
    if (abort.signal.aborted) return;
    let msg = "Não foi possível gerar a explicação agora.";
    if (err instanceof Anthropic.AuthenticationError) msg = "Chave da API do Claude inválida no servidor.";
    else if (err instanceof Anthropic.RateLimitError) msg = "O serviço de explicações está ocupado. Tente de novo em instantes.";
    else if (err instanceof Anthropic.APIError) console.error(`Claude API ${err.status}:`, err.message);
    else console.error(err);
    if (!res.headersSent) res.removeHeader("Content-Type"), res.status(502).json({ error: msg });
    else res.end(`\n\n> ⚠️ ${msg}`);
  }
});

// Em produção, serve o front-end compilado.
const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`EnemTester rodando em http://localhost:${port}`);
  if (!explanationsEnabled()) console.log("⚠️  ANTHROPIC_API_KEY não configurada: explicações das provas desativadas.");
});
