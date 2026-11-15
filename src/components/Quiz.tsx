import { useCallback, useEffect, useState } from "react";
import type { Letter } from "../../shared/types";
import { recordAnswer } from "../lib/progress";
import { Explanation } from "./Explanation";
import type { QuizStart } from "./Home";
import { QuestionCard } from "./QuestionCard";

export interface QuizResult extends QuizStart {
  answers: Record<string, Letter>;
  durationMs: number;
}

interface Props {
  quiz: QuizStart;
  aiEnabled: boolean;
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

const LETTERS: Letter[] = ["A", "B", "C", "D", "E"];

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h ? `${h}:` : ""}${pad(m)}:${pad(s % 60)}`;
}

export function Quiz({ quiz, aiEnabled, onFinish, onExit }: Props) {
  const { questions, mode } = quiz;
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Letter>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [startedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now());

  const q = questions[current];
  const selected = answers[q.id] ?? null;
  const revealed = mode === "estudo" && Boolean(confirmed[q.id]);
  const answeredCount = Object.keys(answers).length;
  const isLast = current === questions.length - 1;

  useEffect(() => {
    if (mode !== "simulado") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [current]);

  const finish = useCallback(() => {
    if (mode === "simulado") {
      const blank = questions.length - Object.keys(answers).length;
      if (blank > 0 && !confirm(`Você deixou ${blank} ${blank === 1 ? "questão" : "questões"} em branco. Finalizar mesmo assim?`)) return;
      for (const question of questions) {
        const a = answers[question.id];
        if (a) recordAnswer(question, a);
      }
    }
    onFinish({ ...quiz, answers, durationMs: Date.now() - startedAt });
  }, [mode, questions, answers, onFinish, quiz, startedAt]);

  const select = useCallback(
    (letter: Letter) => {
      if (revealed) return;
      setAnswers((a) => ({ ...a, [q.id]: letter }));
    },
    [q.id, revealed],
  );

  const confirmAnswer = useCallback(() => {
    if (!selected || revealed) return;
    setConfirmed((c) => ({ ...c, [q.id]: true }));
    recordAnswer(q, selected);
  }, [q, selected, revealed]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setCurrent((c) => c + 1);
  }, [isLast, finish]);

  // Atalhos: A–E para marcar, Enter para confirmar/avançar, setas para navegar no simulado.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const idx = LETTERS.indexOf(k as Letter);
      if (idx >= 0 && idx < q.alternatives.length) select(LETTERS[idx]);
      else if (e.key === "Enter") {
        if (mode === "estudo") revealed ? next() : confirmAnswer();
        else next();
      } else if (mode === "simulado" && e.key === "ArrowRight" && !isLast) setCurrent((c) => c + 1);
      else if (mode === "simulado" && e.key === "ArrowLeft" && current > 0) setCurrent((c) => c - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, select, confirmAnswer, next, mode, revealed, isLast, current]);

  return (
    <div className="quiz">
      <div className="quiz-bar">
        <button className="link" onClick={() => confirm("Sair da prova? O que você respondeu no modo estudo fica salvo.") && onExit()}>
          ← Sair
        </button>
        <div className="quiz-title">
          <strong>{quiz.title}</strong>
          <span className="muted">
            Questão {current + 1} de {questions.length}
            {mode === "simulado" && ` · ${answeredCount} respondidas`}
          </span>
        </div>
        {mode === "simulado" ? <span className="timer">⏱ {formatTime(now - startedAt)}</span> : <span />}
      </div>
      <div className="progress" aria-hidden>
        <span style={{ width: `${((current + (revealed ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <QuestionCard question={q} selected={selected} revealed={revealed} onSelect={select} />

      {revealed && <Explanation question={q} chosen={selected} aiEnabled={aiEnabled} />}

      <div className="quiz-actions">
        {mode === "simulado" && (
          <button className="btn" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            ← Anterior
          </button>
        )}
        <span className="spacer" />
        {mode === "estudo" && !revealed && (
          <button className="btn primary" disabled={!selected} onClick={confirmAnswer}>
            Confirmar resposta
          </button>
        )}
        {mode === "estudo" && revealed && (
          <button className="btn primary" onClick={next}>
            {isLast ? "Ver resultado" : "Próxima questão →"}
          </button>
        )}
        {mode === "simulado" && !isLast && (
          <button className="btn primary" onClick={() => setCurrent((c) => c + 1)}>
            Próxima →
          </button>
        )}
        {mode === "simulado" && (
          <button className={`btn ${isLast ? "primary" : ""}`} onClick={finish}>
            Finalizar simulado
          </button>
        )}
      </div>

      {mode === "simulado" && (
        <nav className="qgrid" aria-label="Ir para questão">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              className={`${i === current ? "current" : ""} ${answers[qq.id] ? "done" : ""}`}
              onClick={() => setCurrent(i)}
              aria-label={`Questão ${i + 1}${answers[qq.id] ? `, marcada ${answers[qq.id]}` : ""}`}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      )}
      <p className="muted small center">Atalhos: teclas A–E para marcar, Enter para {mode === "estudo" ? "confirmar/avançar" : "avançar"}.</p>
    </div>
  );
}
