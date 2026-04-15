/**
 * Build prompts for STAR story analysis.
 * Pure function, no side effects.
 *
 * The model constant is the single source of truth — change it here to upgrade.
 */

export const STAR_ANALYSIS_MODEL = "gpt-5.4-mini";

export interface StarStoryInput {
  title: string;
  role: string;
  expectedQuestions: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
}

export const STAR_ANALYSIS_SYSTEM_PROMPT = `You are an expert behavioral interview coach. Analyze STAR stories (Situation, Task, Action, Result) and provide structured feedback.

Always respond with valid JSON matching this exact schema:
{
  "persuasiveness_score": number (0-100),
  "persuasiveness_justification": string (one line, ≤ 120 chars),
  "star_alignment_score": number (0-100),
  "star_breakdown": {
    "situation": number (0-100),
    "task": number (0-100),
    "action": number (0-100),
    "result": number (0-100)
  },
  "role_fit_score": number (0-100),
  "role_fit_justification": string (one line, ≤ 120 chars),
  "question_fit_score": number (0-100),
  "question_fit_justification": string (one line, ≤ 120 chars),
  "suggestions": string[] (3-5 concrete, actionable suggestions)
}`;

export function buildStarAnalysisPrompt(story: StarStoryInput): string {
  const sections: string[] = [];

  sections.push(`Analyze this STAR behavioral interview story.`);

  sections.push(`Role being interviewed for: ${story.role}`);

  if (story.expectedQuestions.length > 0) {
    sections.push(
      `Expected interview questions this story should answer:\n${story.expectedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    );
  }

  sections.push(`--- STAR STORY: "${story.title}" ---`);
  sections.push(`SITUATION:\n${story.situation}`);
  sections.push(`TASK:\n${story.task}`);
  sections.push(`ACTION:\n${story.action}`);
  sections.push(`RESULT:\n${story.result}`);
  sections.push(`--- END STORY ---`);

  sections.push(
    `Evaluate this story on:
1. Persuasiveness (0-100): How compelling and memorable is the story overall?
2. STAR Alignment (0-100): How well does each section follow the STAR format? Score each section individually.
3. Role Fit (0-100): How well does the story demonstrate skills relevant to the role?
4. Question Fit (0-100): How well does this story answer the expected interview questions?
5. Suggestions: Provide 3-5 concrete, specific suggestions to improve the story.

Be direct and actionable. Focus on concrete improvements rather than generic advice.`
  );

  sections.push(`Return ONLY the JSON response, no markdown or explanation.`);

  return sections.join("\n\n");
}
