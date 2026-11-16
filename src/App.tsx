import { useEffect, useState } from "react";
import { Home, type QuizStart } from "./components/Home";
import { Quiz, type QuizResult } from "./components/Quiz";
import { Results } from "./components/Results";
import { fetchHealth, type Health } from "./lib/api";

type Screen = { name: "home" } | { name: "quiz"; quiz: QuizStart; key: number } | { name: "results"; result: QuizResult };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [health, setHealth] = useState<Health>({ live: false, stored: 0 });

  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);

  const startQuiz = (quiz: QuizStart) => setScreen({ name: "quiz", quiz, key: Date.now() });
  const goHome = () => setScreen({ name: "home" });

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={goHome}>
          <span aria-hidden>📚</span> EnemTester
        </button>
      </header>
      <main>
        {screen.name === "home" && <Home health={health} onStart={startQuiz} />}
        {screen.name === "quiz" && (
          <Quiz
            key={screen.key}
            quiz={screen.quiz}
            onExit={goHome}
            onFinish={(result) => {
              setScreen({ name: "results", result });
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {screen.name === "results" && (
          <Results
            result={screen.result}
            onHome={goHome}
            onRetryWrong={() => {
              const r = screen.result;
              startQuiz({
                title: `${r.title} · refazendo erros`,
                mode: "estudo",
                questions: r.questions.filter((q) => r.answers[q.id] !== q.correctAlternative),
              });
            }}
          />
        )}
      </main>
      <footer className="footer muted">
        Questões das provas oficiais do ENEM (INEP) obtidas pela API pública{" "}
        <a href="https://enem.dev" target="_blank" rel="noreferrer">
          enem.dev
        </a>
        . Explicações geradas por IA (Claude): confira sempre com seu material de estudo.
      </footer>
    </>
  );
}
