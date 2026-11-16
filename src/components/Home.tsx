import { useEffect, useMemo, useState } from "react";
import { DISCIPLINES, type Exam, type Question } from "../../shared/types";
import { DEMO_QUESTIONS } from "../data/demo";
import { fetchExams, fetchQuestions, type Health } from "../lib/api";
import { loadProgress, resetProgress, statsByDiscipline } from "../lib/progress";

export type Mode = "estudo" | "simulado";

export interface QuizStart {
  title: string;
  mode: Mode;
  questions: Question[];
}

interface Props {
  health: Health;
  onStart: (quiz: QuizStart) => void;
}

const COUNTS = [10, 20, 45, 0] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Home({ health, onStart }: Props) {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [area, setArea] = useState("all");
  const [language, setLanguage] = useState("ingles");
  const [count, setCount] = useState<number>(20);
  const [random, setRandom] = useState(false);
  const [mode, setMode] = useState<Mode>("estudo");
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [progress, setProgress] = useState(loadProgress);

  useEffect(() => {
    fetchExams()
      .then((list) => {
        setExams(list);
        if (list.length) setYear(list[0].year);
      })
      .catch((e: Error) => setExamsError(e.message));
  }, []);

  const stats = useMemo(() => statsByDiscipline(progress), [progress]);
  const totalAnswered = Object.keys(progress.answers).length;
  const totalCorrect = Object.values(progress.answers).filter((a) => a.correct).length;
  const mistakes = Object.values(progress.mistakes);
  const exam = exams?.find((e) => e.year === year);
  const areas = exam?.disciplines.length ? exam.disciplines : Object.entries(DISCIPLINES).map(([value, d]) => ({ value, label: d.label }));

  async function start() {
    if (!year) return;
    setLoading(true);
    setStartError(null);
    try {
      let qs = await fetchQuestions(year, language);
      if (area !== "all") qs = qs.filter((q) => q.discipline === area);
      if (!qs.length) throw new Error("Nenhuma questão encontrada para essa combinação.");
      if (random) qs = shuffle(qs);
      if (count) qs = qs.slice(0, count);
      const areaLabel = area === "all" ? "Todas as áreas" : DISCIPLINES[area]?.label ?? area;
      onStart({ title: `ENEM ${year} · ${areaLabel}`, mode, questions: qs });
    } catch (e) {
      setStartError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home">
      <section className="hero">
        <h1>Treine com as provas antigas do ENEM</h1>
        <p>
          Escolha uma prova, responda as questões e, a cada resposta, veja <strong>por que</strong> a alternativa certa é a
          certa, onde estava a pegadinha e uma revisão rápida do conteúdo cobrado.
        </p>
        {health.loaded && !health.live && health.stored === 0 && (
          <p className="notice">
            Ainda não há explicações das provas oficiais neste servidor. As questões de demonstração continuam com explicação
            completa.
          </p>
        )}
      </section>

      <div className="grid">
        <section className="card setup">
          <h2>Nova prova</h2>
          {examsError && (
            <div className="notice error">
              Não consegui carregar a lista de provas ({examsError}). Verifique a conexão ou experimente as questões de
              demonstração ao lado.
            </div>
          )}
          {!exams && !examsError && <p className="muted">Carregando provas…</p>}
          {exams && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
            >
              <label>
                Ano
                <select value={year ?? ""} onChange={(e) => setYear(Number(e.target.value))}>
                  {exams.map((e) => (
                    <option key={e.year} value={e.year}>
                      {e.title}
                      {e.unofficial ? " (demo, não oficial)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {exam?.unofficial && (
                <p className="notice small">⚠️ {exam.note ?? "Prova montada a partir de fontes não oficiais. Pode conter erros."}</p>
              )}

              <fieldset>
                <legend>Área</legend>
                <div className="chips">
                  <button type="button" className={`chip ${area === "all" ? "on" : ""}`} onClick={() => setArea("all")}>
                    Todas
                  </button>
                  {areas.map((d) => (
                    <button
                      type="button"
                      key={d.value}
                      className={`chip ${area === d.value ? "on" : ""}`}
                      onClick={() => setArea(d.value)}
                    >
                      {DISCIPLINES[d.value]?.short ?? d.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {(area === "all" || area === "linguagens") && (
                <fieldset>
                  <legend>Língua estrangeira</legend>
                  <div className="chips">
                    {[
                      ["ingles", "Inglês"],
                      ["espanhol", "Espanhol"],
                    ].map(([v, l]) => (
                      <button type="button" key={v} className={`chip ${language === v ? "on" : ""}`} onClick={() => setLanguage(v)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset>
                <legend>Quantidade de questões</legend>
                <div className="chips">
                  {COUNTS.map((c) => (
                    <button type="button" key={c} className={`chip ${count === c ? "on" : ""}`} onClick={() => setCount(c)}>
                      {c || "Todas"}
                    </button>
                  ))}
                </div>
                <label className="check">
                  <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />
                  Embaralhar a ordem
                </label>
              </fieldset>

              <fieldset>
                <legend>Modo</legend>
                <div className="modes">
                  <button type="button" className={`mode ${mode === "estudo" ? "on" : ""}`} onClick={() => setMode("estudo")}>
                    <strong>📖 Estudo</strong>
                    <span>Correção e explicação logo após cada questão.</span>
                  </button>
                  <button type="button" className={`mode ${mode === "simulado" ? "on" : ""}`} onClick={() => setMode("simulado")}>
                    <strong>⏱️ Simulado</strong>
                    <span>Cronômetro e correção só no final, como no dia da prova.</span>
                  </button>
                </div>
              </fieldset>

              {startError && <div className="notice error">{startError}</div>}
              <button className="btn primary big" disabled={loading || !year}>
                {loading ? "Carregando questões…" : "Começar"}
              </button>
            </form>
          )}
        </section>

        <div className="side">
          <section className="card">
            <h2>Seu desempenho</h2>
            {totalAnswered === 0 ? (
              <p className="muted">Responda algumas questões para ver seu aproveitamento por área.</p>
            ) : (
              <>
                <p className="big-number">
                  {Math.round((totalCorrect / totalAnswered) * 100)}%
                  <small>
                    {totalCorrect} de {totalAnswered} questões
                  </small>
                </p>
                <ul className="bars">
                  {Object.entries(DISCIPLINES).map(([key, d]) => {
                    const s = stats[key];
                    const pct = s ? Math.round((s.correct / s.total) * 100) : 0;
                    return (
                      <li key={key}>
                        <span>{d.short}</span>
                        <span className="bar">
                          <span style={{ width: `${pct}%`, background: d.color }} />
                        </span>
                        <span className="muted">{s ? `${pct}%` : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  className="link small"
                  onClick={() => {
                    if (confirm("Apagar todo o seu histórico de respostas?")) {
                      resetProgress();
                      setProgress(loadProgress());
                    }
                  }}
                >
                  Zerar histórico
                </button>
              </>
            )}
          </section>

          <section className="card">
            <h2>Caderno de erros</h2>
            <p className="muted">
              {mistakes.length
                ? `${mistakes.length} ${mistakes.length === 1 ? "questão" : "questões"} para revisar. Ao acertar, ela sai da lista.`
                : "As questões que você errar ficam guardadas aqui para revisar depois."}
            </p>
            <button
              className="btn"
              disabled={!mistakes.length}
              onClick={() => onStart({ title: "Revisão dos erros", mode: "estudo", questions: shuffle(mistakes) })}
            >
              Revisar erros
            </button>
          </section>

          <section className="card">
            <h2>Experimente</h2>
            <p className="muted">5 questões de demonstração no estilo ENEM, com explicação pronta. Funciona offline.</p>
            <button className="btn" onClick={() => onStart({ title: "Questões de demonstração", mode: "estudo", questions: DEMO_QUESTIONS })}>
              Fazer demonstração
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
