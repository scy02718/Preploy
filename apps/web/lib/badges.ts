/**
 * Badge definitions — single source of truth.
 * The DB only stores earned badge IDs; display info lives here.
 */

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "first_interview",
    name: "First Steps",
    description: "Complete your first interview session",
    icon: "🎯",
  },
  {
    id: "streak_3",
    name: "On a Roll",
    description: "Practice 3 days in a row",
    icon: "🔥",
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Practice 7 days in a row",
    icon: "⚡",
  },
  {
    id: "score_8",
    name: "High Achiever",
    description: "Score 8.0 or higher on any session",
    icon: "⭐",
  },
  {
    id: "sessions_10",
    name: "Dedicated",
    description: "Complete 10 interview sessions",
    icon: "💪",
  },
  {
    id: "both_types",
    name: "Well-Rounded",
    description: "Complete both behavioral and technical interviews",
    icon: "🎭",
  },
  {
    id: "sessions_25",
    name: "Interview Pro",
    description: "Complete 25 interview sessions",
    icon: "🏆",
  },
];

export const BADGE_MAP = new Map(BADGES.map((b) => [b.id, b]));

/**
 * Get the display info for a badge ID.
 */
export function getBadge(badgeId: string): BadgeDefinition | undefined {
  return BADGE_MAP.get(badgeId);
}
