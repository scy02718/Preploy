export const SUPPORTED_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "go", label: "Go" },
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

export const BEHAVIORAL_SESSION_DURATION_MIN = 30;
export const TECHNICAL_SESSION_DURATION_MIN = 45;
