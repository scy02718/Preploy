import { create } from "zustand";
import type {
  BehavioralSessionConfig,
  TechnicalSessionConfig,
  SessionConfig,
  InterviewType,
  SessionStatus,
  TranscriptEntry,
} from "@preploy/shared";

/** Set on the store when POST /api/sessions returns 402 free_tier_limit_reached. */
export interface QuotaError {
  used: number;
  limit: number;
}

interface InterviewState {
  // Session data
  sessionId: string | null;
  type: InterviewType | null;
  config: SessionConfig;
  status: SessionStatus;
  transcript: TranscriptEntry[];
  error: string | null;
  /**
   * Captures the body of a 402 free_tier_limit_reached response from
   * `POST /api/sessions` so the setup form can render the
   * `<UpgradePromptDialog>`. Cleared on the next successful createSession()
   * or via clearQuotaError().
   */
  quotaError: QuotaError | null;

  // Timing
  startedAt: Date | null;

  // Actions
  setType: (type: InterviewType) => void;
  setConfig: (partial: Partial<SessionConfig>) => void;
  createSession: () => Promise<string | null>;
  clearQuotaError: () => void;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  reset: () => void;
}

const DEFAULT_BEHAVIORAL_CONFIG: BehavioralSessionConfig = {
  interview_style: 0.5,
  difficulty: 0.5,
};

const DEFAULT_TECHNICAL_CONFIG: TechnicalSessionConfig = {
  interview_type: "leetcode",
  focus_areas: [],
  language: "python",
  difficulty: "medium",
};

export const useInterviewStore = create<InterviewState>((set, get) => ({
  sessionId: null,
  type: null,
  config: { ...DEFAULT_BEHAVIORAL_CONFIG },
  status: "configuring",
  transcript: [],
  error: null,
  quotaError: null,
  startedAt: null,

  setType: (type) => {
    const config =
      type === "behavioral"
        ? { ...DEFAULT_BEHAVIORAL_CONFIG }
        : { ...DEFAULT_TECHNICAL_CONFIG };
    set({ type, config });
  },

  setConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial } as SessionConfig,
    })),

  createSession: async () => {
    const { config, type } = get();
    const sessionType = type ?? "behavioral";
    set({ error: null, quotaError: null });

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: sessionType, config }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Capture the 402 free_tier_limit_reached body so the setup form
        // can render the upgrade dialog with the exact used/limit numbers.
        if (
          res.status === 402 &&
          data?.error === "free_tier_limit_reached" &&
          typeof data.used === "number" &&
          typeof data.limit === "number"
        ) {
          set({
            error: data.error,
            quotaError: { used: data.used, limit: data.limit },
          });
          return null;
        }
        set({ error: data.error || "Failed to create session" });
        return null;
      }

      const session = await res.json();
      set({ sessionId: session.id, status: "configuring" });
      return session.id;
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to create session",
      });
      return null;
    }
  },

  clearQuotaError: () => set({ quotaError: null, error: null }),

  startSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;

    const now = new Date();
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
          startedAt: now.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || "Failed to start session" });
        return;
      }

      set({ status: "in_progress", startedAt: now });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to start session",
      });
    }
  },

  endSession: async () => {
    const { sessionId, startedAt } = get();
    if (!sessionId) return;

    const now = new Date();
    const durationSeconds = startedAt
      ? Math.round((now.getTime() - startedAt.getTime()) / 1000)
      : 0;

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          endedAt: now.toISOString(),
          durationSeconds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || "Failed to end session" });
        return;
      }

      set({ status: "completed" });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to end session",
      });
    }
  },

  addTranscriptEntry: (entry) =>
    set((state) => ({
      transcript: [...state.transcript, entry],
    })),

  reset: () =>
    set({
      sessionId: null,
      type: null,
      config: { ...DEFAULT_BEHAVIORAL_CONFIG },
      status: "configuring",
      transcript: [],
      error: null,
      quotaError: null,
      startedAt: null,
    }),
}));
