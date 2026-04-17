export const SUPPORTED_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "go", label: "Go" },
] as const;

export const FOCUS_AREAS_BY_TYPE = {
  leetcode: [
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
    "other",
  ],
  system_design: [
    "scalability",
    "databases",
    "caching",
    "load_balancing",
    "microservices",
    "message_queues",
    "api_design",
    "consistency_availability",
    "storage",
    "networking",
    "monitoring",
    "security",
    "other",
  ],
  frontend: [
    "react",
    "state_management",
    "css_layout",
    "accessibility",
    "performance",
    "dom_manipulation",
    "responsive_design",
    "testing",
    "browser_apis",
    "typescript",
    "other",
  ],
  backend: [
    "api_design",
    "databases",
    "authentication",
    "caching",
    "concurrency",
    "error_handling",
    "testing",
    "security",
    "deployment",
    "logging",
    "other",
  ],
} as const;

/** @deprecated Use FOCUS_AREAS_BY_TYPE instead */
export const FOCUS_AREAS = FOCUS_AREAS_BY_TYPE.leetcode;

export const BEHAVIORAL_SESSION_DURATION_MIN = 30;
export const TECHNICAL_SESSION_DURATION_MIN = 45;
