import { create } from "zustand";
import type {
  BehavioralSessionConfig,
  SessionStatus,
  TranscriptEntry,
} from "@interview-assistant/shared";

interface InterviewState {
  // Session data
  sessionId: string | null;
  config: BehavioralSessionConfig;
  status: SessionStatus;
  transcript: TranscriptEntry[];
  error: string | null;

  // Timing
  startedAt: Date | null;

  // Actions
  setConfig: (partial: Partial<BehavioralSessionConfig>) => void;
  createSession: () => Promise<string | null>;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  reset: () => void;
}

const DEFAULT_CONFIG: BehavioralSessionConfig = {
  interview_style: 0.5,
  difficulty: 0.5,
};

export const useInterviewStore = create<InterviewState>((set, get) => ({
  sessionId: null,
  config: { ...DEFAULT_CONFIG },
  status: "configuring",
  transcript: [],
  error: null,
  startedAt: null,

  setConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
    })),

  createSession: async () => {
    const { config } = get();
    set({ error: null });

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "behavioral", config }),
      });

      if (!res.ok) {
        const data = await res.json();
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
      config: { ...DEFAULT_CONFIG },
      status: "configuring",
      transcript: [],
      error: null,
      startedAt: null,
    }),
}));
