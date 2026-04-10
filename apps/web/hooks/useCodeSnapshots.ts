"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CodeEventType } from "@interview-assistant/shared";
import { getBoilerplate } from "@/lib/code-templates";

interface CodeSnapshot {
  code: string;
  language: string;
  timestamp_ms: number;
  event_type: CodeEventType;
}

interface UseCodeSnapshotsParams {
  sessionStartTime: number; // epoch ms
  initialLanguage?: string;
}

interface UseCodeSnapshotsReturn {
  code: string;
  setCode: (code: string) => void;
  language: string;
  setLanguage: (language: string) => void;
  resetCode: () => void;
  captureSnapshot: (eventType: CodeEventType) => void;
  getSnapshots: () => CodeSnapshot[];
}

export function useCodeSnapshots({
  sessionStartTime,
  initialLanguage = "python",
}: UseCodeSnapshotsParams): UseCodeSnapshotsReturn {
  const [code, setCodeState] = useState(() => getBoilerplate(initialLanguage));
  const [language, setLanguageState] = useState(initialLanguage);

  const snapshotsRef = useRef<CodeSnapshot[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  const languageRef = useRef(language);

  // Keep refs in sync with state
  codeRef.current = code;
  languageRef.current = language;

  const captureSnapshot = useCallback(
    (eventType: CodeEventType) => {
      const timestamp_ms = Date.now() - sessionStartTime;
      snapshotsRef.current.push({
        code: codeRef.current,
        language: languageRef.current,
        timestamp_ms,
        event_type: eventType,
      });
    },
    [sessionStartTime]
  );

  const setCode = useCallback(
    (newCode: string) => {
      setCodeState(newCode);

      // Debounced auto-capture on edit
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Update ref immediately so the debounced capture gets the latest code
      codeRef.current = newCode;
      debounceTimerRef.current = setTimeout(() => {
        captureSnapshot("edit");
        debounceTimerRef.current = null;
      }, 2000);
    },
    [captureSnapshot]
  );

  const setLanguage = useCallback(
    (newLanguage: string) => {
      setLanguageState(newLanguage);
      languageRef.current = newLanguage;

      const boilerplate = getBoilerplate(newLanguage);
      setCodeState(boilerplate);
      codeRef.current = boilerplate;

      // Cancel any pending debounce and capture immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      captureSnapshot("edit");
    },
    [captureSnapshot]
  );

  const resetCode = useCallback(() => {
    const boilerplate = getBoilerplate(languageRef.current);
    setCodeState(boilerplate);
    codeRef.current = boilerplate;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    captureSnapshot("edit");
  }, [captureSnapshot]);

  const getSnapshots = useCallback(() => {
    return [...snapshotsRef.current];
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    code,
    setCode,
    language,
    setLanguage,
    resetCode,
    captureSnapshot,
    getSnapshots,
  };
}
