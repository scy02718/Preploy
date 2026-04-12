/**
 * Build prompts for Smart Setup — company + resume combined question generation.
 * Pure function, no side effects.
 */

export interface SmartQuestionsOptions {
  company: string;
  role?: string;
  resumeText?: string;
  questionType: "behavioral" | "technical";
}

export function buildSmartQuestionsPrompt(options: SmartQuestionsOptions): string {
  const { company, role, resumeText, questionType } = options;
  const sections: string[] = [];

  if (questionType === "behavioral") {
    sections.push(
      `Generate 8-10 behavioral interview questions that a ${company} interviewer would ask.`
    );

    if (role) {
      sections.push(`The candidate is interviewing for the role of: ${role}`);
    }

    if (resumeText) {
      sections.push(
        `The candidate's resume is below. Generate questions that reference their SPECIFIC experience — projects, metrics, roles, and technologies mentioned in the resume. Make the questions feel like a real ${company} interview where the interviewer has read the resume.`
      );
      sections.push(`--- RESUME ---\n${resumeText.slice(0, 3000)}\n--- END RESUME ---`);
    }

    sections.push(
      `Each question should be tagged with a category (leadership, conflict, teamwork, failure, initiative, adaptability) and include a brief tip for answering well.`
    );
  } else {
    sections.push(
      `Generate 8-10 technical interview questions that ${company} would ask.`
    );

    if (role) {
      sections.push(`The candidate is interviewing for: ${role}`);
    }

    if (resumeText) {
      sections.push(
        `The candidate's resume is below. Generate questions relevant to their technical background — their languages, frameworks, systems, and scale of experience.`
      );
      sections.push(`--- RESUME ---\n${resumeText.slice(0, 3000)}\n--- END RESUME ---`);
    }

    sections.push(
      `Include a mix of coding, system design, and domain-specific questions. Each should have a category and a tip.`
    );
  }

  sections.push(
    `Return a JSON array: [{ "question": string, "category": string, "tip": string, "resume_reference"?: string }]. Return ONLY the JSON array.`
  );

  return sections.join("\n\n");
}
