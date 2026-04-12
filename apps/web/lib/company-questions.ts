/**
 * Pure functions for building company-specific question generation prompts.
 */

/** Well-known company interview culture hints */
const COMPANY_HINTS: Record<string, string> = {
  amazon:
    "Amazon interviews focus heavily on their 16 Leadership Principles (Customer Obsession, Ownership, Invent and Simplify, etc.). Questions are almost always framed around these principles.",
  google:
    "Google emphasizes Googleyness — intellectual humility, collaborative problem-solving, comfort with ambiguity, and a bias toward action. They value structured thinking and data-driven decisions.",
  meta:
    "Meta (Facebook) values move fast, be bold, focus on impact, build social value, and be open. They look for candidates who can operate at scale and ship quickly.",
  facebook:
    "Meta (Facebook) values move fast, be bold, focus on impact, build social value, and be open. They look for candidates who can operate at scale and ship quickly.",
  apple:
    "Apple interviews focus on attention to detail, passion for products, cross-functional collaboration, and the ability to simplify complex problems. Design thinking is valued.",
  microsoft:
    "Microsoft emphasizes growth mindset, collaboration, customer empathy, and inclusiveness. They look for people who can learn from failure and drive impact.",
  netflix:
    "Netflix prizes freedom and responsibility, radical candor, high performance culture, and independent decision-making. Questions often explore judgment and accountability.",
  stripe:
    "Stripe looks for rigorous thinking, user empathy, attention to craft, and the ability to work across disciplines. They value people who think deeply about developer experience.",
  uber:
    "Uber values big bold bets, customer obsession, and celebrating differences. Questions often probe resilience, fast-paced decision-making, and stakeholder management.",
  airbnb:
    "Airbnb focuses on belonging, championing the mission, being a host, and embracing the adventure. Cultural alignment is heavily weighted in interviews.",
  salesforce:
    "Salesforce emphasizes trust, customer success, innovation, equality, and sustainability (Ohana culture). Behavioral questions often tie back to these values.",
  spotify:
    "Spotify values autonomy, agility, and a strong sense of squad ownership. They look for collaborative mindset and user-centric thinking.",
};

/**
 * Look up company-specific interview culture hints.
 * Matches case-insensitively on company name.
 */
export function getCompanyHint(company: string): string | null {
  const key = company.trim().toLowerCase();
  return COMPANY_HINTS[key] ?? null;
}

/**
 * Build a GPT prompt that generates company-specific behavioral interview questions.
 *
 * @param company - The target company name
 * @param role - Optional role/position title
 * @param count - Number of questions to generate (default 8)
 * @returns The prompt string to send to GPT
 */
export function buildCompanyQuestionsPrompt(
  company: string,
  role?: string,
  count: number = 8
): string {
  const sections: string[] = [];

  sections.push(
    `Generate ${count} likely behavioral interview questions that ${company.trim()} would ask in a real interview.`
  );

  // Add company-specific culture hints if available
  const hint = getCompanyHint(company);
  if (hint) {
    sections.push(`Company context: ${hint}`);
  }

  // Add role context
  if (role?.trim()) {
    sections.push(
      `The candidate is interviewing for a ${role.trim()} position. Tailor questions to this role level and responsibilities.`
    );
  }

  sections.push(
    `For each question, provide:
- "question": The full behavioral question text
- "category": One of: leadership, teamwork, conflict, problem-solving, failure, communication, adaptability, customer-focus, innovation, time-management
- "tip": A short 1-sentence tip for answering this specific question well`
  );

  sections.push(
    `Return valid JSON in this exact format:
{
  "questions": [
    { "question": "...", "category": "...", "tip": "..." }
  ]
}`
  );

  sections.push(
    "Make questions specific to the company's known values and interview style. Avoid generic questions that could apply to any company."
  );

  return sections.join("\n\n");
}
