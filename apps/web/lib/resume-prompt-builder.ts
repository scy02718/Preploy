import type { StructuredResume } from "@/lib/resume-parser";

export interface ResumeQuestionOptions {
  resumeText: string;
  questionType: "behavioral" | "technical";
  company?: string;
  role?: string;
  structuredData?: StructuredResume | null;
}

/**
 * Builds a GPT prompt that generates interview questions tailored to the
 * candidate's resume content.  Different prompts for behavioral vs technical.
 */
export function buildResumeQuestionsPrompt(options: ResumeQuestionOptions): string {
  const { resumeText, questionType, company, role, structuredData } = options;

  const sections: string[] = [];

  // System instruction
  sections.push(
    "You are an expert interviewer who generates highly specific interview questions based on a candidate's resume."
  );

  // Context about the target company/role
  if (company?.trim()) {
    sections.push(`The candidate is interviewing at ${company.trim()}.`);
  }
  if (role?.trim()) {
    sections.push(`The target role is: ${role.trim()}.`);
  }

  // Structured background block (only when available)
  if (structuredData) {
    const roleLines = structuredData.roles.map((r, i) => {
      const highImpactBullets = r.bullets.filter((b) => b.impact_score >= 6);
      const bulletLines = highImpactBullets
        .map((b) => `     - ${b.text}   [impact: ${b.impact_score}]`)
        .join("\n");
      return `  ${i + 1}. ${r.title} at ${r.company} (${r.dates})${bulletLines ? `\n     Key achievements:\n${bulletLines}` : ""}`;
    });

    const topSkills = structuredData.skills.slice(0, 10).join(", ");

    sections.push(
      [
        "--- Candidate background (structured) ---",
        "Roles:",
        roleLines.join("\n"),
        `Top skills: ${topSkills}`,
        "--- End structured background ---",
      ].join("\n")
    );
  }

  // Resume content
  sections.push(
    `Here is the candidate's resume:\n---\n${resumeText.trim()}\n---`
  );

  // Type-specific instructions
  if (questionType === "behavioral") {
    sections.push(
      `Generate 8-10 behavioral interview questions that reference specific projects, achievements, and metrics from the resume. Each question should:
- Reference a specific experience, project, or accomplishment mentioned in the resume
- Use the STAR format expectation (ask about Situation, Task, Action, or Result)
- Cover different competencies: leadership, teamwork, conflict resolution, problem-solving, and adaptability
- Be phrased naturally, as a real interviewer would ask them`
    );
  } else {
    sections.push(
      `Generate 8-10 technical interview questions that reference specific technologies, systems, and projects from the resume. Each question should:
- Reference specific technologies, architectures, or systems mentioned in the resume
- Range from system design questions to deep-dive technical questions
- Cover different areas: architecture decisions, scalability, debugging, performance optimization, and trade-offs
- Be phrased naturally, as a real interviewer would ask them`
    );
  }

  // Output format
  sections.push(
    `Respond with a JSON array of objects, each with:
- "question": the interview question text
- "resume_reference": which part of the resume this question references (1 sentence)
- "category": the competency or technical area this question tests

Respond ONLY with the JSON array, no other text.`
  );

  return sections.join("\n\n");
}
