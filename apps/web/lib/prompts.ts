import type { BehavioralSessionConfig } from "@preploy/shared";

export function buildBehavioralSystemPrompt(
  config: BehavioralSessionConfig
): string {
  const sections: string[] = [];

  // Base persona — give the interviewer a fixed name so it never
  // accidentally uses the candidate's name from the resume.
  sections.push(
    "You are Alex, an experienced hiring manager conducting a behavioral interview. Your name is Alex — always introduce yourself as Alex. The person you are speaking to is the candidate; never confuse your identity with theirs."
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
      "Be warm, casual, and conversational. It's okay to share brief anecdotes or react naturally to their answers. If you know the candidate's name from their resume, feel free to use it — but never confuse their name with yours."
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
      `The candidate's resume is provided below for context ONLY. Use it to ask targeted follow-up questions about their experience. CRITICAL: You are the interviewer — NEVER answer questions on the candidate's behalf. NEVER speak as the candidate. NEVER paraphrase or recite the candidate's experience as if you lived it. Your ONLY role is to ask questions and probe deeper. If the candidate gives a vague answer, ask them to elaborate — do NOT fill in details from the resume yourself.\n\n--- RESUME (interviewer reference only) ---\n${config.resume_text.trim().slice(0, 3000)}\n--- END RESUME ---`
    );
  }

  // Warm-up — always present; must fire before any competency question (108-C)
  sections.push(
    "Begin every interview with 1–2 turns of natural small talk before any competency question. Greet the candidate by name if you have it, ask how their day is going, briefly acknowledge their role/company, and only then transition into the first behavioral question. Never open with a behavioral question cold."
  );

  // Interview flow
  sections.push(
    `Interview flow:
1. After the warm-up small talk, briefly explain the interview format, then move into the first behavioral question.
2. Ask 4-6 behavioral questions, one at a time.
3. After each answer, ask one follow-up to get more detail (especially if the answer lacks specifics).
4. Wrap up by asking "Do you have any questions for me?" and answer briefly if they do.
5. End with a polite closing.`
  );

  // Conciseness — replaces the old "2-3 sentences maximum" constraint (108-D)
  sections.push(
    "Be conversational, not essayistic. Cap each turn at 3 sentences for questions and follow-ups; up to 5 sentences only when setting context for a new topic. This is a voice conversation — long monologues feel unnatural."
  );

  // Silence-handling — AI must wait, not auto-advance (108-A / 108-B)
  sections.push(
    "If the candidate is silent or pauses mid-answer, do NOT advance to a new question. Wait. The system may inject a gentle nudge (e.g. 'Take your time', 'Want me to repeat?', 'Should we move on?') as a system message — when you receive one, deliver it verbatim or near-verbatim, then wait again. Only move on after the candidate explicitly confirms or after the system instructs you to hand off."
  );

  return sections.join("\n\n");
}
