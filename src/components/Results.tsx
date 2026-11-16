import { useState } from "react";
import { DISCIPLINES } from "../../shared/types";
import { Explanation } from "./Explanation";
import { QuestionCard } from "./QuestionCard";
import type { QuizResult } from "./Quiz";

interface Props {
  result: QuizResult;
  onHome: () => void;
  onRetryWrong: () => void;
}

function minutes(ms: number) {
  const m = Math.round(ms / 60000);
  return m < 1 ? "menos de 1 min" : `${m} min`;
}

export function Results({ result, onHome, onRetryWrong }: Props) {
  const { questions, answers } = result;
  const [reviewing, setReviewing] = useState<number | null>(null);

  const correct = questions.filter((q) => answers[q.id] === q.correctAlternative).length;
  const pct = Math.round((correct / questions.length) * 100);
  const wrong = questions.length - correct;

  const byArea: Record<string, { total: number; correct: number }> = {};
  for (const q of questions) {
    const s = (byArea[q.discipline] ??= { total: 0, correct: 0 });
    s.total++;
    if (answers[q.id] === q.correctAlternative) s.correct++;
  }

  if (reviewing !== null) {
    const q = questions[reviewing];
    return (
      <div className="quiz">
        <div className="quiz-bar">
          <button className="link" onClick={() => setReviewing(null)}>
            ← Voltar ao resultado
          </button>
          <div className="quiz-title">
            <strong>Revisão</strong>
            <span className="muted">
              Questão {reviewing + 1} de {questions.length}
            </span>
          </div>
          <span />
        </div>
        <QuestionCard question={q} selected={answers[q.id] ?? null} revealed />
        <Explanation question={q} chosen={answers[q.id] ?? null} />
        <div className="quiz-actions">
          <button className="btn" disabled={reviewing === 0} onClick={() => setReviewing(reviewing - 1)}>
            ← Anterior
          </button>
          <span className="spacer" />
          <button className="btn primary" disabled={reviewing === questions.length - 1} onClick={() => setReviewing(reviewing + 1)}>
            Próxima →
          </button>
        </div>
      </div>
    );
  }

  const message =
    pct >= 80 ? "Excelente! Você está mandando muito bem." : pct >= 60 ? "Bom trabalho! Revise os erros para subir ainda mais." : pct >= 40 ? "Está no caminho. As explicações dos erros são o seu melhor material agora." : "Todo começo é assim. Revise cada erro com calma: é aí que se aprende.";

  return (
    <div className="results">
      <section className="card score">
        <p className="muted">{result.title}</p>
        <p className="big-number">
          {correct}/{questions.length}
          <small>
            {pct}% de acertos · {minutes(result.durationMs)}
          </small>
        </p>
        <p>{message}</p>
        <div className="row">
          <button className="btn primary" onClick={onHome}>
            Voltar ao início
          </button>
          {wrong > 0 && (
            <button className="btn" onClick={onRetryWrong}>
              Refazer as {wrong} que errei
            </button>
          )}
        </div>
      </section>

      {Object.keys(byArea).length > 1 && (
        <section className="card">
          <h2>Por área</h2>
          <ul className="bars">
            {Object.entries(byArea).map(([key, s]) => {
              const d = DISCIPLINES[key];
              const p = Math.round((s.correct / s.total) * 100);
              return (
                <li key={key}>
                  <span>{d?.short ?? key}</span>
                  <span className="bar">
                    <span style={{ width: `${p}%`, background: d?.color }} />
                  </span>
                  <span className="muted">
                    {s.correct}/{s.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Questões</h2>
        <p className="muted">Toque em uma questão para ver a correção e a explicação.</p>
        <ul className="review-list">
          {questions.map((q, i) => {
            const a = answers[q.id];
            const ok = a === q.correctAlternative;
            return (
              <li key={q.id}>
                <button onClick={() => setReviewing(i)}>
                  <span className={`dot ${a ? (ok ? "ok" : "bad") : "skip"}`}>{ok ? "✓" : a ? "✗" : "–"}</span>
                  <span className="grow">
                    {q.year ? `Questão ${q.index}` : q.title}
                    <span className="muted"> · {DISCIPLINES[q.discipline]?.short ?? q.discipline}</span>
                  </span>
                  <span className="muted">
                    {a ? `Marcou ${a}` : "Em branco"} · Gabarito {q.correctAlternative}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
