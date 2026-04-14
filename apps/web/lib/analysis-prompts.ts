/**
 * Analysis prompts: builds the GPT user-message strings for behavioral and
 * technical interview analysis.
 *
 * Ported byte-for-byte from:
 *   - apps/api/app/services/feedback_generator.py::_build_analysis_prompt
 *   - apps/api/app/services/code_analyzer.py::build_technical_analysis_prompt
 *
 * Pure functions. No I/O, no async, no auth. The exact string output is
 * load-bearing — `analysis-prompts.test.ts` snapshots the result against an
 * expected.txt fixture generated from the Python source so any drift fails CI.
 */

import type {
  CodeSnapshotInput,
  TranscriptEntryInput,
} from "./validations";

// ---- System prompts (string-equal to Python module-level constants) ----

export const BEHAVIORAL_SYSTEM_PROMPT = `You are an expert interview coach analyzing a behavioral interview transcript.

Your task is to evaluate the candidate's performance and provide structured, actionable feedback.

For each question-answer pair you identify in the transcript:
1. Extract the interviewer's question
2. Summarize the candidate's answer in 1-2 sentences
3. Score the answer from 0-10 based on:
   - Use of STAR method (Situation, Task, Action, Result)
   - Specificity and concrete examples
   - Relevance to the question
   - Communication clarity
   - Depth and thoughtfulness
4. Provide specific feedback on what was good and what could improve
5. Give 1-3 actionable suggestions

Then provide an overall assessment:
- Overall score (weighted average of individual answers)
- 2-3 sentence summary
- Top 3 strengths
- Top 3 areas for improvement

Respond ONLY with valid JSON matching this exact structure:
{
  "overall_score": <float 0-10>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "answer_analyses": [
    {
      "question": "<the interviewer's question>",
      "answer_summary": "<1-2 sentence summary of candidate's answer>",
      "score": <float 0-10>,
      "feedback": "<specific feedback on this answer>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    }
  ]
}`;

export const TECHNICAL_SYSTEM_PROMPT = `You are an expert technical interview coach analyzing a coding interview session.

You will receive:
- A full transcript of the candidate's verbal explanations
- The candidate's code evolution (all snapshots from start to final submission)
- Session configuration (problem type, focus areas, difficulty)

Evaluate the candidate on two dimensions:

1. **Code Quality (0-10)**: correctness, efficiency, readability,
   edge case handling, time/space complexity awareness
2. **Explanation Quality (0-10)**: clarity of thought process,
   problem decomposition, trade-off discussion, communication

Analyze distinct aspects of the candidate's performance.
Use these categories for the answer_analyses array:
- **Approach & Problem Decomposition**: How the candidate broke
  down the problem and chose their strategy
- **Implementation**: Code correctness, structure, and style —
  reference specific lines or functions from the code snapshots
- **Complexity Analysis**: Whether the candidate discussed
  time/space complexity and if their analysis was correct
- **Edge Cases & Testing**: Whether edge cases were considered in code or discussion
- **Communication**: How well the candidate explained their thinking throughout

For each analysis, reference specific code from the snapshots
(e.g., "The loop on line 3 could use enumerate instead") and
specific quotes from the transcript when relevant.

Respond ONLY with valid JSON matching this exact structure:
{
  "overall_score": <float 0-10>,
  "summary": "<2-3 sentence overall assessment referencing specific parts of the code>",
  "strengths": ["<strength — cite code or transcript>", "<strength>", "<strength>"],
  "weaknesses": ["<weakness — cite code or transcript>", "<weakness>", "<weakness>"],
  "code_quality_score": <float 0-10>,
  "explanation_quality_score": <float 0-10>,
  "answer_analyses": [
    {
      "question": "<aspect being evaluated, e.g. 'Approach & Problem Decomposition'>",
      "answer_summary": "<1-2 sentence summary of what the candidate did, referencing code>",
      "score": <float 0-10>,
      "feedback": "<specific feedback citing code lines and transcript quotes>",
      "suggestions": ["<actionable suggestion>", "<actionable suggestion>"]
    }
  ]
}`;

// ---- Behavioral prompt config ----

export interface BehavioralPromptConfig {
  company_name?: string | null;
  job_description?: string | null;
  expected_questions?: string[] | null;
  interview_style?: number;
  difficulty?: number;
}

/**
 * Build the user-message string for behavioral analysis. Ported line-for-line
 * from `_build_analysis_prompt` in feedback_generator.py — every `parts.append`
 * here corresponds to a Python `parts.append`, and the final `parts.join("\n")`
 * mirrors Python's `"\n".join(parts)`.
 */
export function buildBehavioralPrompt(
  transcript: TranscriptEntryInput[],
  config: BehavioralPromptConfig,
): string {
  const parts: string[] = [];

  // Context
  if (config.company_name) {
    parts.push(`Company: ${config.company_name}`);
  }
  if (config.job_description) {
    parts.push(`Job Description:\n${config.job_description}`);
  }

  // Difficulty context — Python defaults difficulty to 0.5 on BehavioralConfig,
  // so a missing field falls into the mid-level branch.
  const difficulty = config.difficulty ?? 0.5;
  if (difficulty <= 0.3) {
    parts.push("Interview level: Entry-level");
  } else if (difficulty >= 0.7) {
    parts.push("Interview level: Senior/Staff");
  } else {
    parts.push("Interview level: Mid-level");
  }

  parts.push("\n--- TRANSCRIPT ---\n");

  for (const entry of transcript) {
    const speaker = entry.speaker === "ai" ? "Interviewer" : "Candidate";
    parts.push(`${speaker}: ${entry.text}`);
  }

  parts.push("\n--- END TRANSCRIPT ---");
  parts.push("\nAnalyze this interview and provide structured feedback as JSON.");

  return parts.join("\n");
}

// ---- Technical prompt config ----

export interface TechnicalPromptConfig {
  interview_type?: string;
  focus_areas?: string[];
  difficulty?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * Format `timestamp_ms` as `mm:ss` matching Python's
 * `f"{minutes:02d}:{seconds:02d}"` where
 *   minutes = timestamp_ms // 60000
 *   seconds = (timestamp_ms % 60000) // 1000
 */
function formatMmSs(timestampMs: number): string {
  const minutes = Math.floor(timestampMs / 60000);
  const seconds = Math.floor((timestampMs % 60000) / 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Capitalize first character only — mirrors Python's `str.capitalize()` for
 * the difficulty label in the technical prompt. Note Python's full
 * `capitalize()` lowercases the rest, but in the source code the only inputs
 * used here are "easy"/"medium"/"hard" (all lowercase already).
 */
function pyCapitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Mirror Python's `str(a).replace("_", " ").title()` for focus-area labels.
 * Python `str.title()` uppercases the first letter of each "word" (split on
 * any non-alphabetic boundary), lowercasing the rest. For the focus_area
 * inputs in this codebase ("arrays", "sliding_window", "scalability", etc.)
 * the simple word-by-word capitalization matches byte-for-byte.
 */
function pyTitleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Build the user-message string for technical analysis. Ported line-for-line
 * from `build_technical_analysis_prompt` in code_analyzer.py.
 */
export function buildTechnicalPrompt(
  transcript: TranscriptEntryInput[],
  codeSnapshots: CodeSnapshotInput[],
  config: TechnicalPromptConfig,
): string {
  const parts: string[] = [];

  // Session config context — Python uses dict.get with defaults.
  const interviewType = (config.interview_type as string | undefined) ?? "leetcode";
  const focusAreas = (config.focus_areas as string[] | undefined) ?? [];
  const difficulty = (config.difficulty as string | undefined) ?? "medium";
  const language = (config.language as string | undefined) ?? "python";

  parts.push(`Interview Type: ${interviewType}`);
  parts.push(`Difficulty: ${pyCapitalize(difficulty)}`);
  parts.push(`Language: ${language}`);
  if (focusAreas.length > 0) {
    const areasStr = focusAreas.map((a) => pyTitleCase(String(a))).join(", ");
    parts.push(`Focus Areas: ${areasStr}`);
  }

  // Code evolution — include all snapshots so GPT can reference the progression
  parts.push("\n--- CODE EVOLUTION ---");
  if (codeSnapshots.length > 0) {
    const sortedSnapshots = [...codeSnapshots].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms,
    );
    parts.push(`Language used: ${sortedSnapshots[sortedSnapshots.length - 1].language}`);
    parts.push(`Total snapshots: ${sortedSnapshots.length}`);

    sortedSnapshots.forEach((snap, idx) => {
      const isLast = idx === sortedSnapshots.length - 1;
      const label = isLast ? "FINAL SUBMISSION" : `Snapshot ${idx + 1}`;
      const ts = formatMmSs(snap.timestamp_ms);
      parts.push(
        `\n[${label} at ${ts} — ${snap.event_type}, ${snap.language}]` +
          `\n\`\`\`${snap.language}\n${snap.code}\n\`\`\``,
      );
    });
  } else {
    parts.push("No code was written.");
  }
  parts.push("--- END CODE ---");

  // Transcript
  parts.push("\n--- TRANSCRIPT ---");
  for (const entry of transcript) {
    const speaker = entry.speaker === "user" ? "Candidate" : "Interviewer";
    parts.push(`${speaker}: ${entry.text}`);
  }
  parts.push("--- END TRANSCRIPT ---");

  parts.push("\nAnalyze this technical interview and provide structured feedback as JSON.");

  return parts.join("\n");
}
