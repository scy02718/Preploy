import type { TechnicalSessionConfig } from "@interview-assistant/shared";

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  leetcode: "LeetCode-style coding problem",
  system_design: "system design question",
  frontend: "frontend engineering problem",
  backend: "backend engineering problem",
};

const DIFFICULTY_MAP: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function buildProblemGenerationPrompt(
  config: TechnicalSessionConfig
): string {
  const typeLabel =
    INTERVIEW_TYPE_LABELS[config.interview_type] ?? "coding problem";
  const difficulty = DIFFICULTY_MAP[config.difficulty] ?? "Medium";
  const focusAreas = config.focus_areas.join(", ");
  const language = config.language;

  const sections: string[] = [];

  sections.push(
    `Generate a single ${difficulty}-difficulty ${typeLabel}.`
  );

  sections.push(
    `The problem should focus on the following topics: ${focusAreas}.`
  );

  sections.push(
    `The target programming language is ${language}. Use this language for any code snippets in examples.`
  );

  if (config.interview_type === "system_design") {
    sections.push(
      "This is a system design question. Provide a detailed description of the system to design. " +
        "Do NOT include input/output examples — instead describe the requirements, scale expectations, and key components to address. " +
        'Set examples to an empty array [] and include design constraints in the "constraints" field.'
    );
  } else {
    sections.push(
      "Include 2-3 examples with input, output, and a brief explanation. " +
        "Include 3-5 constraints (e.g., input size limits, value ranges, time complexity expectations)."
    );
  }

  if (config.additional_instructions) {
    sections.push(
      `Additional instructions from the user: ${config.additional_instructions}`
    );
  }

  sections.push(
    "Respond ONLY with valid JSON matching this exact schema:\n" +
      '{ "title": string, "difficulty": "Easy" | "Medium" | "Hard", "description": string, ' +
      '"examples": [{ "input": string, "output": string, "explanation"?: string }], ' +
      '"constraints": string[] }\n' +
      "Do not include any text outside the JSON object."
  );

  return sections.join("\n\n");
}
