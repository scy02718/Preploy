"use client";

import Editor from "@monaco-editor/react";
// Monaco language identifiers for our supported languages
const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  java: "java",
  cpp: "cpp",
  go: "go",
};

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  theme?: "vs-dark" | "light";
}

export function CodeEditor({ language, value, onChange, theme = "vs-dark" }: CodeEditorProps) {

  return (
    <Editor
      height="100%"
      language={LANGUAGE_MAP[language] ?? language}
      theme={theme}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        lineNumbers: "on",
        wordWrap: "off",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        padding: { top: 12 },
      }}
    />
  );
}
