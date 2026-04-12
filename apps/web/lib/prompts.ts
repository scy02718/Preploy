import type { BehavioralSessionConfig } from "@interview-assistant/shared";

export function buildBehavioralSystemPrompt(
  config: BehavioralSessionConfig
): string {
  const sections: string[] = [];

  // Base persona
  sections.push(
    "You are an experienced hiring manager conducting a behavioral interview."
  );

  // Company context
  if (config.company_name?.trim()) {
    sections.push(
      `You are interviewing the candidate for a role at ${config.company_name.trim()}.`
    );
  }

  // Job description
  if (config.job_description?.trim()) {
    sections.push(
      `Here is the job description:\n${config.job_description.trim()}\nTailor your questions to assess fitness for this role.`
    );
  }

  // Expected questions
  if (config.expected_questions && config.expected_questions.length > 0) {
    const list = config.expected_questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join("\n");
    sections.push(
      `The candidate expects questions like:\n${list}\nYou may use some of these but also add your own follow-up questions.`
    );
  }

  // Interview style
  const style = config.interview_style;
  if (style <= 0.3) {
    sections.push(
      "Maintain a formal, structured tone throughout the interview. Address the candidate professionally. Stay focused on the questions without small talk."
    );
  } else if (style >= 0.7) {
    sections.push(
      "Be warm, casual, and conversational. Use the candidate's first name. It's okay to share brief anecdotes or react naturally to their answers."
    );
  } else {
    sections.push(
      "Strike a balanced tone — professional but approachable. Be friendly without being overly casual."
    );
  }

  // Difficulty
  const difficulty = config.difficulty;
  if (difficulty <= 0.3) {
    sections.push(
      "Ask entry-level behavioral questions. Keep follow-ups straightforward. Focus on basic teamwork, communication, and problem-solving scenarios."
    );
  } else if (difficulty >= 0.7) {
    sections.push(
      "Ask senior/staff-level behavioral questions. Probe deeply with follow-ups about leadership, ambiguity, cross-functional influence, and high-stakes decisions. Challenge vague answers."
    );
  } else {
    sections.push(
      "Ask mid-level behavioral questions. Include follow-ups that probe for specifics using the STAR method (Situation, Task, Action, Result)."
    );
  }

  // Resume context
  if (config.resume_text?.trim()) {
    sections.push(
      `The candidate's resume is provided below. Reference their specific experience, projects, and achievements when asking follow-up questions. This makes the interview feel more realistic and personalized.\n\n--- RESUME ---\n${config.resume_text.trim().slice(0, 3000)}\n--- END RESUME ---`
    );
  }

  // Interview flow
  sections.push(
    `Interview flow:
1. Start with a brief, friendly introduction of yourself and the interview format.
2. Ask 4-6 behavioral questions, one at a time.
3. After each answer, ask one follow-up to get more detail (especially if the answer lacks specifics).
4. Wrap up by asking "Do you have any questions for me?" and answer briefly if they do.
5. End with a polite closing.`
  );

  // Voice constraint
  sections.push(
    "IMPORTANT: Keep each of your responses concise — 2-3 sentences maximum. This is a voice conversation, so long monologues feel unnatural. Be direct and move the conversation forward."
  );

  return sections.join("\n\n");
}
