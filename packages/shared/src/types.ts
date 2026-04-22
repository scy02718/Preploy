// ---- Enums ----

export const InterviewType = {
  BEHAVIORAL: "behavioral",
  TECHNICAL: "technical",
} as const;
export type InterviewType = (typeof InterviewType)[keyof typeof InterviewType];

export const SessionStatus = {
  CONFIGURING: "configuring",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const TechnicalInterviewType = {
  LEETCODE: "leetcode",
  SYSTEM_DESIGN: "system_design",
  FRONTEND: "frontend",
  BACKEND: "backend",
} as const;
export type TechnicalInterviewType =
  (typeof TechnicalInterviewType)[keyof typeof TechnicalInterviewType];

export const CodeEventType = {
  EDIT: "edit",
  RUN: "run",
  SUBMIT: "submit",
} as const;
export type CodeEventType = (typeof CodeEventType)[keyof typeof CodeEventType];

export const Difficulty = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

// ---- Session Config ----

export interface BehavioralSessionConfig {
  company_name?: string;
  job_description?: string;
  expected_questions?: string[];
  interview_style: number; // 0.0 = strict, 1.0 = casual
  difficulty: number; // 0.0 = easy, 1.0 = hard
  resume_id?: string;
  resume_text?: string; // populated at session start, not stored in DB
  gaze_enabled?: boolean; // per-session opt-in (only shown when user has gaze_tracking_enabled)
  // Pro-only. Number of interviewer follow-up layers per question during the
  // behavioral session. 0 = no probing (Free default). 2 = Pro default
  // (Standard). 3 = Intense. See #178.
  probe_depth?: 0 | 1 | 2 | 3;
  // Pro-only. Selects an interviewer persona ("amazon-lp", "google-star",
  // "warm-peer", "hostile-panel", or "default"). See #179.
  persona?: string;
}

export interface TechnicalSessionConfig {
  interview_type: TechnicalInterviewType;
  focus_areas: string[];
  language: string;
  difficulty: Difficulty;
  additional_instructions?: string;
  resume_id?: string;
  resume_text?: string;
}

export type SessionConfig = BehavioralSessionConfig | TechnicalSessionConfig;

// ---- Transcript ----

export interface TranscriptEntry {
  speaker: "user" | "ai";
  text: string;
  timestamp_ms: number;
}

// ---- Code Snapshot ----

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  time_ms: number;
  memory_kb: number;
}

// ---- Feedback ----

export interface FeedbackItem {
  category: string;
  detail: string;
}

export interface AnswerAnalysis {
  question: string;
  answer_summary: string;
  score: number;
  feedback: string;
  suggestions: string[];
}
