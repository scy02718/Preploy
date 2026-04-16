/**
 * Badge definitions — single source of truth.
 * The DB only stores earned badge IDs; display info lives here.
 */

export type BadgeTier = "starter" | "growth" | "mastery" | "fun";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  tier: BadgeTier;
  /** Human-readable hint shown on the /achievements page for locked badges. */
  hint: string;
  /** Numeric target for progress-bar badges (e.g. 10 for "sessions_10"). null = no progress bar. */
  target: number | null;
}

// ---------------------------------------------------------------------------
// Starter tier — unlock in first week
// ---------------------------------------------------------------------------
const STARTER_BADGES: BadgeDefinition[] = [
  {
    id: "first_interview",
    name: "First Steps",
    description: "Complete your first interview session",
    icon: "🎯",
    tier: "starter",
    hint: "Complete any interview session",
    target: 1,
  },
  {
    id: "first_behavioral",
    name: "Tell Me About Yourself",
    description: "Complete your first behavioral interview",
    icon: "💬",
    tier: "starter",
    hint: "Run a behavioral interview session",
    target: 1,
  },
  {
    id: "first_technical",
    name: "Code It Up",
    description: "Complete your first technical interview",
    icon: "💻",
    tier: "starter",
    hint: "Run a technical interview session",
    target: 1,
  },
  {
    id: "both_types",
    name: "Well-Rounded",
    description: "Complete both behavioral and technical interviews",
    icon: "🎭",
    tier: "starter",
    hint: "Try both interview types",
    target: null,
  },
  {
    id: "first_resume",
    name: "Resume Ready",
    description: "Upload your first resume",
    icon: "📄",
    tier: "starter",
    hint: "Upload a resume on the Resume page",
    target: 1,
  },
  {
    id: "first_star",
    name: "Storyteller",
    description: "Create your first STAR story",
    icon: "⭐",
    tier: "starter",
    hint: "Write a STAR story on the STAR Prep page",
    target: 1,
  },
  {
    id: "first_plan",
    name: "Strategist",
    description: "Create your first interview plan",
    icon: "📋",
    tier: "starter",
    hint: "Use the Planner to schedule an interview prep plan",
    target: 1,
  },
  {
    id: "score_5",
    name: "Solid Start",
    description: "Score 5.0 or higher on any session",
    icon: "👍",
    tier: "starter",
    hint: "Get a score of 5.0+ on any interview",
    target: null,
  },
];

// ---------------------------------------------------------------------------
// Growth tier — unlock over 2-4 weeks of active use
// ---------------------------------------------------------------------------
const GROWTH_BADGES: BadgeDefinition[] = [
  {
    id: "sessions_5",
    name: "Getting Warmed Up",
    description: "Complete 5 interview sessions",
    icon: "🏃",
    tier: "growth",
    hint: "Complete 5 sessions total",
    target: 5,
  },
  {
    id: "sessions_10",
    name: "Dedicated",
    description: "Complete 10 interview sessions",
    icon: "💪",
    tier: "growth",
    hint: "Complete 10 sessions total",
    target: 10,
  },
  {
    id: "sessions_25",
    name: "Interview Pro",
    description: "Complete 25 interview sessions",
    icon: "🏆",
    tier: "growth",
    hint: "Complete 25 sessions total",
    target: 25,
  },
  {
    id: "streak_3",
    name: "On a Roll",
    description: "Practice 3 days in a row",
    icon: "🔥",
    tier: "growth",
    hint: "Practice on 3 consecutive days",
    target: 3,
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Practice 7 days in a row",
    icon: "⚡",
    tier: "growth",
    hint: "Practice on 7 consecutive days",
    target: 7,
  },
  {
    id: "streak_14",
    name: "Fortnight Fighter",
    description: "Practice 14 days in a row",
    icon: "🗓️",
    tier: "growth",
    hint: "Practice on 14 consecutive days",
    target: 14,
  },
  {
    id: "score_7",
    name: "Strong Performer",
    description: "Score 7.0 or higher on any session",
    icon: "🌟",
    tier: "growth",
    hint: "Get a score of 7.0+ on any interview",
    target: null,
  },
  {
    id: "score_8",
    name: "High Achiever",
    description: "Score 8.0 or higher on any session",
    icon: "🏅",
    tier: "growth",
    hint: "Get a score of 8.0+ on any interview",
    target: null,
  },
  {
    id: "score_9",
    name: "Perfect Score",
    description: "Score 9.0 or higher on any session",
    icon: "💎",
    tier: "growth",
    hint: "Get a score of 9.0+ on any interview",
    target: null,
  },
  {
    id: "comeback_kid",
    name: "Comeback Kid",
    description: "Improve your score by 2+ points between sessions",
    icon: "📈",
    tier: "growth",
    hint: "Improve by at least 2 points in consecutive sessions",
    target: null,
  },
  {
    id: "well_rounded_10",
    name: "Balanced Practitioner",
    description: "Complete 5 behavioral + 5 technical sessions",
    icon: "⚖️",
    tier: "growth",
    hint: "Do at least 5 of each interview type",
    target: null,
  },
];

// ---------------------------------------------------------------------------
// Mastery tier — long-term engagement
// ---------------------------------------------------------------------------
const MASTERY_BADGES: BadgeDefinition[] = [
  {
    id: "sessions_50",
    name: "Dedicated Practitioner",
    description: "Complete 50 interview sessions",
    icon: "🎖️",
    tier: "mastery",
    hint: "Complete 50 sessions total",
    target: 50,
  },
  {
    id: "sessions_100",
    name: "Interview Machine",
    description: "Complete 100 interview sessions",
    icon: "🤖",
    tier: "mastery",
    hint: "Complete 100 sessions total",
    target: 100,
  },
  {
    id: "streak_30",
    name: "Month of Commitment",
    description: "Practice 30 days in a row",
    icon: "📅",
    tier: "mastery",
    hint: "Practice on 30 consecutive days",
    target: 30,
  },
  {
    id: "avg_score_7",
    name: "Consistently Strong",
    description: "All-time average score above 7.0 (min 5 sessions)",
    icon: "📊",
    tier: "mastery",
    hint: "Maintain an average score above 7.0 over at least 5 sessions",
    target: null,
  },
  {
    id: "star_collector",
    name: "Story Collector",
    description: "Save 10 or more STAR stories",
    icon: "📚",
    tier: "mastery",
    hint: "Create 10 STAR stories",
    target: 10,
  },
  {
    id: "star_perfectionist",
    name: "Story Perfectionist",
    description: "Analyze 10 STAR stories with AI",
    icon: "🔬",
    tier: "mastery",
    hint: "Run AI analysis on 10 different STAR stories",
    target: 10,
  },
];

// ---------------------------------------------------------------------------
// Fun / Easter egg tier
// ---------------------------------------------------------------------------
const FUN_BADGES: BadgeDefinition[] = [
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Complete a session between midnight and 5am",
    icon: "🦉",
    tier: "fun",
    hint: "Practice late at night (midnight–5am)",
    target: null,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Complete a session before 7am",
    icon: "🐦",
    tier: "fun",
    hint: "Practice before 7am",
    target: null,
  },
  {
    id: "marathon_runner",
    name: "Marathon Runner",
    description: "Complete 5 sessions in a single day",
    icon: "🏅",
    tier: "fun",
    hint: "Do 5 sessions in one day",
    target: 5,
  },
  {
    id: "going_pro",
    name: "Going Pro",
    description: "Complete your first session after upgrading to Pro",
    icon: "👑",
    tier: "fun",
    hint: "Upgrade to Pro and complete a session",
    target: null,
  },
];

export const BADGES: BadgeDefinition[] = [
  ...STARTER_BADGES,
  ...GROWTH_BADGES,
  ...MASTERY_BADGES,
  ...FUN_BADGES,
];

export const BADGE_MAP = new Map(BADGES.map((b) => [b.id, b]));

/** Tier display metadata for the UI. */
export const TIER_META: Record<
  BadgeTier,
  { label: string; color: string; border: string; glow: string }
> = {
  starter: {
    label: "Starter",
    color: "text-muted-foreground",
    border: "border-muted-foreground/30",
    glow: "",
  },
  growth: {
    label: "Growth",
    color: "text-blue-500",
    border: "border-blue-500/40",
    glow: "shadow-blue-500/20 shadow-md",
  },
  mastery: {
    label: "Mastery",
    color: "text-purple-500",
    border: "border-purple-500/40",
    glow: "shadow-purple-500/20 shadow-md",
  },
  fun: {
    label: "Legendary",
    color: "text-amber-500",
    border: "border-amber-500/40",
    glow: "shadow-amber-500/30 shadow-lg",
  },
};

export function getBadge(badgeId: string): BadgeDefinition | undefined {
  return BADGE_MAP.get(badgeId);
}
