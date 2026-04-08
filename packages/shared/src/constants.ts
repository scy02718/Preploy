export const SUPPORTED_LANGUAGES = [
  { id: "python", label: "Python", judge0Id: 71 },
  { id: "javascript", label: "JavaScript", judge0Id: 63 },
  { id: "java", label: "Java", judge0Id: 62 },
  { id: "cpp", label: "C++", judge0Id: 54 },
  { id: "go", label: "Go", judge0Id: 60 },
] as const;

export const FOCUS_AREAS = [
  "arrays",
  "strings",
  "linked_lists",
  "trees",
  "graphs",
  "dynamic_programming",
  "sliding_window",
  "two_pointers",
  "binary_search",
  "backtracking",
  "greedy",
  "stack_queue",
  "heap",
  "hash_map",
  "sorting",
  "recursion",
] as const;

export const MAX_CODE_EXECUTION_TIME_MS = 10_000;
export const MAX_CODE_MEMORY_KB = 256_000;
export const MAX_EXECUTIONS_PER_MINUTE = 10;

export const BEHAVIORAL_SESSION_DURATION_MIN = 30;
export const TECHNICAL_SESSION_DURATION_MIN = 45;
