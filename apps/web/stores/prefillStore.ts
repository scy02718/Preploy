import { create } from "zustand";

interface PrefillState {
  /** Pre-fill data for behavioral setup */
  behavioralPrefill: {
    company_name?: string;
    expected_questions?: string[];
    resume_id?: string;
  } | null;

  /** Pre-fill data for technical setup */
  technicalPrefill: {
    focus_areas?: string[];
    additional_instructions?: string;
    resume_id?: string;
  } | null;

  setBehavioralPrefill: (data: PrefillState["behavioralPrefill"]) => void;
  setTechnicalPrefill: (data: PrefillState["technicalPrefill"]) => void;
  clearPrefill: () => void;
}

export const usePrefillStore = create<PrefillState>((set) => ({
  behavioralPrefill: null,
  technicalPrefill: null,

  setBehavioralPrefill: (data) => set({ behavioralPrefill: data }),
  setTechnicalPrefill: (data) => set({ technicalPrefill: data }),
  clearPrefill: () => set({ behavioralPrefill: null, technicalPrefill: null }),
}));
