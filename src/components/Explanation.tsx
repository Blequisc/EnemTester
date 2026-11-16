import { useEffect, useState } from "react";
import type { Letter, Question } from "../../shared/types";
import { cachedExplanation, ExplainError, streamExplanation } from "../lib/api";
import { Markdown } from "./Markdown";

interface Props {
  question: Question;
  chosen: Letter | null;
}

export function Explanation({ question: q, chosen }: Props) {
  const initial = q.explanation ?? cachedExplanation(q.id);
  const [text, setText] = useState<string>(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; missing: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ready = q.explanation ?? cachedExplanation(q.id);
    setError(null);
    if (ready) {
      setText(ready);
      return;
    }
    setText("");
    const ctrl = new AbortController();
    setLoading(true);
    streamExplanation(q, setText, ctrl.signal)
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError({ message: e.message, missing: e instanceof ExplainError && e.status === 404 });
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [q, attempt]);

  const correct = chosen === q.correctAlternative;

  return (
    <section className="explanation" aria-live="polite">
      <div className={`verdict ${chosen ? (correct ? "ok" : "bad") : "skip"}`}>
        {!chosen && <>Você deixou em branco. A resposta correta é a letra <strong>{q.correctAlternative}</strong>.</>}
        {chosen && correct && <>🎉 Você acertou! A resposta é a letra <strong>{q.correctAlternative}</strong>.</>}
        {chosen && !correct && (
          <>
            Você marcou <strong>{chosen}</strong>, mas a resposta correta é a letra <strong>{q.correctAlternative}</strong>.
            Veja abaixo onde está o pulo do gato.
          </>
        )}
      </div>

      {text && <Markdown>{text}</Markdown>}
      {loading && !text && (
        <div className="skeleton" aria-label="Carregando explicação">
          <span />
          <span />
          <span />
          <p className="muted">O professor está preparando a explicação…</p>
        </div>
      )}
      {loading && text && <span className="cursor" aria-hidden />}
      {error?.missing && (
        <div className="notice">
          A explicação desta questão ainda não foi gerada. Por enquanto, confira o gabarito acima.
        </div>
      )}
      {error && !error.missing && (
        <div className="notice error">
          {error.message}{" "}
          <button className="link" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </div>
      )}
    </section>
  );
}
