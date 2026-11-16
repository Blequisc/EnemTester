import { DISCIPLINES, type Letter, type Question } from "../../shared/types";
import { Markdown } from "./Markdown";

interface Props {
  question: Question;
  selected: Letter | null;
  /** Quando true, mostra o gabarito e trava a escolha. */
  revealed: boolean;
  onSelect?: (letter: Letter) => void;
}

export function QuestionCard({ question: q, selected, revealed, onSelect }: Props) {
  const area = DISCIPLINES[q.discipline];
  // Imagens que já aparecem no texto não precisam ser repetidas.
  const extraFiles = q.files.filter((f) => !q.context.includes(f));

  return (
    <article className="question">
      <header className="question-meta">
        {area && (
          <span className="tag" style={{ "--tag": area.color } as React.CSSProperties}>
            {area.label}
          </span>
        )}
        <span className="muted">
          {q.year ? `ENEM ${q.year} · Questão ${q.index}` : q.title}
          {q.language ? ` · ${q.language === "ingles" ? "Inglês" : "Espanhol"}` : ""}
        </span>
      </header>

      {q.notices?.map((n) => (
        <p key={n} className="notice small" role="note">
          ⚠️ {n}
        </p>
      ))}

      <div className="question-body">
        <Markdown>{q.context}</Markdown>
        {extraFiles.map((f) => (
          <img key={f} src={f} alt="Figura da questão" className="question-img" loading="lazy" />
        ))}
        {q.alternativesIntroduction && (
          <p className="alt-intro">
            <strong>{q.alternativesIntroduction}</strong>
          </p>
        )}
      </div>

      <ol className="alternatives" role="radiogroup" aria-label="Alternativas">
        {q.alternatives.map((a) => {
          const isSelected = selected === a.letter;
          const isCorrect = a.letter === q.correctAlternative;
          let state = "";
          if (revealed && isCorrect) state = "correct";
          else if (revealed && isSelected) state = "wrong";
          else if (isSelected) state = "selected";
          return (
            <li key={a.letter}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`alt ${state}`}
                disabled={revealed || !onSelect}
                onClick={() => onSelect?.(a.letter)}
              >
                <span className="alt-letter">{a.letter}</span>
                <span className="alt-text">
                  {a.text && <Markdown>{a.text}</Markdown>}
                  {a.file && <img src={a.file} alt={`Alternativa ${a.letter}`} loading="lazy" />}
                </span>
                {revealed && isCorrect && <span className="alt-badge">Gabarito</span>}
                {revealed && isSelected && !isCorrect && <span className="alt-badge">Sua resposta</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
