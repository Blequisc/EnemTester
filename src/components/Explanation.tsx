import { useEffect, useState } from "react";
import type { Letter, Question } from "../../shared/types";
import { cachedExplanation, streamExplanation } from "../lib/api";
import { Markdown } from "./Markdown";

interface Props {
  question: Question;
  chosen: Letter | null;
  aiEnabled: boolean;
}

export function Explanation({ question: q, chosen, aiEnabled }: Props) {
  const initial = q.explanation ?? cachedExplanation(q.id);
  const [text, setText] = useState<string>(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ready = q.explanation ?? cachedExplanation(q.id);
    setError(null);
    if (ready) {
      setText(ready);
      return;
    }
    setText("");
    if (!aiEnabled) return;
    const ctrl = new AbortController();
    setLoading(true);
    streamExplanation(q, setText, ctrl.signal)
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [q, aiEnabled, attempt]);

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
      {error && (
        <div className="notice error">
          {error}{" "}
          <button className="link" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </div>
      )}
      {!aiEnabled && !text && (
        <div className="notice">
          As explicações automáticas não estão ativadas neste servidor (falta configurar a chave da API do Claude).
          Você ainda pode conferir o gabarito acima.
        </div>
      )}
    </section>
  );
}
