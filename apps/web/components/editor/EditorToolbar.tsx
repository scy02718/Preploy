"use client";

import { SUPPORTED_LANGUAGES } from "@interview-assistant/shared";
import { RotateCcw } from "lucide-react";

interface EditorToolbarProps {
  language: string;
  onLanguageChange: (language: string) => void;
  onReset: () => void;
}

export function EditorToolbar({
  language,
  onLanguageChange,
  onReset,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.label}
          </option>
        ))}
      </select>

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>
    </div>
  );
}
