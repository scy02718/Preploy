"use client";

interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  examples: Example[];
  constraints: string[];
}

interface ProblemDescriptionProps {
  problem: Problem;
}

const DIFFICULTY_COLORS = {
  Easy: "text-green-500 bg-green-500/10",
  Medium: "text-yellow-500 bg-yellow-500/10",
  Hard: "text-red-500 bg-red-500/10",
};

export function ProblemDescription({ problem }: ProblemDescriptionProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-bold">{problem.title}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[problem.difficulty]}`}
        >
          {problem.difficulty}
        </span>
      </div>

      <div className="mb-6 text-sm leading-relaxed text-foreground/90">
        {problem.description}
      </div>

      <div className="space-y-4">
        {problem.examples.map((example, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Example {i + 1}
            </p>
            <div className="space-y-1 font-mono text-sm">
              <p>
                <span className="text-muted-foreground">Input: </span>
                {example.input}
              </p>
              <p>
                <span className="text-muted-foreground">Output: </span>
                {example.output}
              </p>
              {example.explanation && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Explanation: </span>
                  {example.explanation}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium">Constraints:</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {problem.constraints.map((c, i) => (
            <li key={i} className="font-mono text-xs">
              • {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
