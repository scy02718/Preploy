/**
 * Pure functions for building GPT prompts that generate interview prep plans.
 * All functions are side-effect free and unit-testable.
 */

export interface PlanDay {
  date: string; // ISO date string (YYYY-MM-DD)
  focus: "behavioral" | "technical";
  topics: string[];
  session_type: string;
  completed: boolean;
}

export interface PlanData {
  days: PlanDay[];
}

export interface PlanGenerationInput {
  company: string;
  role: string;
  interview_date: string; // ISO date string
  weak_areas?: string[];
}

/**
 * Calculate the number of prep days between now and the interview date.
 * Returns at least 1 day and at most 30 days.
 */
export function calculatePrepDays(interviewDate: string, now?: Date): number {
  const interview = new Date(interviewDate);
  const today = now ?? new Date();
  // Normalize both to start of day in local time
  today.setHours(0, 0, 0, 0);
  interview.setHours(0, 0, 0, 0);

  const diffMs = interview.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Clamp between 1 and 30
  return Math.min(30, Math.max(1, diffDays));
}

/**
 * Build the GPT prompt for generating a day-by-day interview prep plan.
 */
export function buildPlanGenerationPrompt(input: PlanGenerationInput): string {
  const sections: string[] = [];

  const prepDays = calculatePrepDays(input.interview_date);

  sections.push(
    `Generate a day-by-day interview preparation plan for a candidate preparing for an interview at ${input.company} for the role of ${input.role}.`
  );

  sections.push(`The interview is in ${prepDays} day${prepDays === 1 ? "" : "s"}. Generate a plan with exactly ${prepDays} day${prepDays === 1 ? "" : "s"} of preparation.`);

  if (input.weak_areas && input.weak_areas.length > 0) {
    sections.push(
      `The candidate has the following weak areas based on past practice sessions:\n${input.weak_areas.map((w) => `- ${w}`).join("\n")}\nEmphasize these areas in the plan — allocate extra days to practice these topics.`
    );
  }

  sections.push(
    `Guidelines:
- Alternate between behavioral and technical prep days for balance
- Start with fundamentals and build up to harder topics
- Include specific, actionable topics for each day (e.g., "Two pointers + sliding window", "STAR method for leadership questions")
- For behavioral days, include relevant question categories (leadership, conflict, teamwork, failure)
- For technical days, include specific algorithm patterns or system design topics
- The last day should be a light review day, not heavy practice`
  );

  sections.push(
    `Return a JSON object with this exact structure:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "focus": "behavioral" | "technical",
      "topics": ["topic1", "topic2"],
      "session_type": "behavioral" | "technical",
      "completed": false
    }
  ]
}

Start from tomorrow's date and generate one entry per day until the interview date. Each day must have 2-4 specific topics. Return ONLY the JSON object.`
  );

  return sections.join("\n\n");
}

/**
 * Format weak areas from feedback data into human-readable strings.
 */
export function extractWeakAreas(
  feedbackItems: Array<{ weaknesses?: string[] | unknown }>
): string[] {
  const weaknessCount = new Map<string, number>();

  for (const item of feedbackItems) {
    const weaknesses = item.weaknesses;
    if (!Array.isArray(weaknesses)) continue;

    for (const w of weaknesses) {
      if (typeof w !== "string") continue;
      const normalized = w.toLowerCase().trim();
      if (normalized) {
        weaknessCount.set(normalized, (weaknessCount.get(normalized) || 0) + 1);
      }
    }
  }

  // Return weaknesses mentioned in 2+ sessions, sorted by frequency
  return Array.from(weaknessCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([weakness]) => weakness);
}

/**
 * Calculate the progress percentage of a plan.
 */
export function calculateProgress(planData: PlanData): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = planData.days.length;
  const completed = planData.days.filter((d) => d.completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percentage };
}
