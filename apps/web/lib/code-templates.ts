const BOILERPLATE: Record<string, string> = {
  python: 'def solution():\n    pass\n',
  javascript: 'function solution() {\n  \n}\n',
  java: 'class Solution {\n    public void solution() {\n        \n    }\n}\n',
  cpp: '#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solution() {\n        \n    }\n};\n',
  go: 'package main\n\nfunc solution() {\n    \n}\n',
};

/**
 * Returns language-specific boilerplate code for the code editor.
 * Returns empty string for unsupported languages.
 */
export function getBoilerplate(language: string): string {
  return BOILERPLATE[language] ?? "";
}
