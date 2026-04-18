import { create } from "zustand";
import type { TechnicalInterviewType } from "@preploy/shared";

interface PrefillState {
  /** Pre-fill data for behavioral setup */
  behavioralPrefill: {
    company_name?: string;
    expected_questions?: string[];
    resume_id?: string;
    source_star_story_id?: string;
  } | null;

  /** Pre-fill data for technical setup */
  technicalPrefill: {
    interview_type?: TechnicalInterviewType;
    focus_areas?: string[];
    additional_instructions?: string;
    resume_id?: string;
  } | null;

  /** Pre-fill data for STAR prep — populated when navigating from a planner star-prep day. */
  starPrepPrefill: {
    focus_topics?: string[];
  } | null;

  setBehavioralPrefill: (data: PrefillState["behavioralPrefill"]) => void;
  setTechnicalPrefill: (data: PrefillState["technicalPrefill"]) => void;
  setStarPrepPrefill: (data: PrefillState["starPrepPrefill"]) => void;
  clearPrefill: () => void;
  /**
   * Strip the `resume_id` field from any prefill entry that references the
   * given resumeId. If the prefill object has no remaining fields after
   * stripping, it is set to null.
   */
  clearResumeReference: (resumeId: string) => void;
}

export const usePrefillStore = create<PrefillState>((set) => ({
  behavioralPrefill: null,
  technicalPrefill: null,
  starPrepPrefill: null,

  setBehavioralPrefill: (data) => set({ behavioralPrefill: data }),
  setTechnicalPrefill: (data) => set({ technicalPrefill: data }),
  setStarPrepPrefill: (data) => set({ starPrepPrefill: data }),
  clearPrefill: () =>
    set({ behavioralPrefill: null, technicalPrefill: null, starPrepPrefill: null }),

  clearResumeReference: (resumeId: string) =>
    set((state) => {
      let { behavioralPrefill, technicalPrefill } = state;

      if (behavioralPrefill?.resume_id === resumeId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { resume_id: _removed, ...rest } = behavioralPrefill;
        behavioralPrefill =
          Object.keys(rest).length > 0
            ? (rest as PrefillState["behavioralPrefill"])
            : null;
      }

      if (technicalPrefill?.resume_id === resumeId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { resume_id: _removed, ...rest } = technicalPrefill;
        technicalPrefill =
          Object.keys(rest).length > 0
            ? (rest as PrefillState["technicalPrefill"])
            : null;
      }

      return { behavioralPrefill, technicalPrefill };
    }),
}));
