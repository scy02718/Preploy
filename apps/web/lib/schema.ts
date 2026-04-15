import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  real,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---- Enums ----

export const interviewTypeEnum = pgEnum("interview_type", [
  "behavioral",
  "technical",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "configuring",
  "in_progress",
  "completed",
  "cancelled",
]);

export const codeEventTypeEnum = pgEnum("code_event_type", [
  "edit",
  "run",
  "submit",
]);

export const userPlanEnum = pgEnum("user_plan", [
  "free",
  "pro",
  "max",
]);

// ---- Tables ----

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  plan: userPlanEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planPeriodStart: timestamp("plan_period_start", { withTimezone: true }),
  planPeriodEnd: timestamp("plan_period_end", { withTimezone: true }),
  pastDueAt: timestamp("past_due_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

export const starStories = pgTable("star_stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  role: text("role").notNull(),
  expectedQuestions: jsonb("expected_questions").notNull().default([]),
  situation: text("situation").notNull(),
  task: text("task").notNull(),
  action: text("action").notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const starStoryAnalyses = pgTable("star_story_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => starStories.id, { onDelete: "cascade" }),
  scores: jsonb("scores").notNull().default({}),
  suggestions: jsonb("suggestions").notNull().default([]),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: interviewTypeEnum("type").notNull(),
  status: sessionStatusEnum("status").notNull().default("configuring"),
  config: jsonb("config").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  sourceStarStoryId: uuid("source_star_story_id").references(
    (): AnyPgColumn => starStories.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  entries: jsonb("entries").notNull().default([]),
});

export const codeSnapshots = pgTable("code_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  language: text("language").notNull(),
  timestampMs: integer("timestamp_ms").notNull(),
  eventType: codeEventTypeEnum("event_type").notNull(),
  executionResult: jsonb("execution_result"),
});

export const sessionFeedback = pgTable("session_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  overallScore: real("overall_score"),
  summary: text("summary"),
  strengths: jsonb("strengths").default([]),
  weaknesses: jsonb("weaknesses").default([]),
  answerAnalyses: jsonb("answer_analyses").default([]),
  codeQualityScore: real("code_quality_score"),
  explanationQualityScore: real("explanation_quality_score"),
  timelineAnalysis: jsonb("timeline_analysis"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: text("badge_id").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_badge_unique").on(table.userId, table.badgeId),
  ]
);

export const companyQuestions = pgTable("company_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role"),
  questions: jsonb("questions").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userResumes = pgTable("user_resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const interviewPlans = pgTable("interview_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  interviewDate: timestamp("interview_date", { withTimezone: true }).notNull(),
  planData: jsonb("plan_data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const interviewUsage = pgTable(
  "interview_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("interview_usage_user_period_unique").on(
      table.userId,
      table.periodStart
    ),
  ]
);

export const sessionTemplates = pgTable("session_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: interviewTypeEnum("type").notNull(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Relations ----

export const usersRelations = relations(users, ({ many }) => ({
  templates: many(sessionTemplates),
  accounts: many(accounts),
  sessions: many(interviewSessions),
  achievements: many(userAchievements),
  companyQuestions: many(companyQuestions),
  resumes: many(userResumes),
  interviewPlans: many(interviewPlans),
  interviewUsage: many(interviewUsage),
  starStories: many(starStories),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const interviewSessionsRelations = relations(
  interviewSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [interviewSessions.userId],
      references: [users.id],
    }),
    transcript: one(transcripts, {
      fields: [interviewSessions.id],
      references: [transcripts.sessionId],
    }),
    feedback: one(sessionFeedback, {
      fields: [interviewSessions.id],
      references: [sessionFeedback.sessionId],
    }),
    codeSnapshots: many(codeSnapshots),
    sourceStarStory: one(starStories, {
      fields: [interviewSessions.sourceStarStoryId],
      references: [starStories.id],
    }),
  })
);

export const starStoriesRelations = relations(starStories, ({ one, many }) => ({
  user: one(users, {
    fields: [starStories.userId],
    references: [users.id],
  }),
  analyses: many(starStoryAnalyses),
  sessions: many(interviewSessions),
}));

export const starStoryAnalysesRelations = relations(
  starStoryAnalyses,
  ({ one }) => ({
    story: one(starStories, {
      fields: [starStoryAnalyses.storyId],
      references: [starStories.id],
    }),
  })
);

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  session: one(interviewSessions, {
    fields: [transcripts.sessionId],
    references: [interviewSessions.id],
  }),
}));

export const codeSnapshotsRelations = relations(codeSnapshots, ({ one }) => ({
  session: one(interviewSessions, {
    fields: [codeSnapshots.sessionId],
    references: [interviewSessions.id],
  }),
}));

export const sessionFeedbackRelations = relations(
  sessionFeedback,
  ({ one }) => ({
    session: one(interviewSessions, {
      fields: [sessionFeedback.sessionId],
      references: [interviewSessions.id],
    }),
  })
);

export const userAchievementsRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(users, {
      fields: [userAchievements.userId],
      references: [users.id],
    }),
  })
);

export const companyQuestionsRelations = relations(
  companyQuestions,
  ({ one }) => ({
    user: one(users, {
      fields: [companyQuestions.userId],
      references: [users.id],
    }),
  })
);

export const userResumesRelations = relations(
  userResumes,
  ({ one }) => ({
    user: one(users, {
      fields: [userResumes.userId],
      references: [users.id],
    }),
  })
);

export const interviewPlansRelations = relations(
  interviewPlans,
  ({ one }) => ({
    user: one(users, {
      fields: [interviewPlans.userId],
      references: [users.id],
    }),
  })
);

export const sessionTemplatesRelations = relations(
  sessionTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [sessionTemplates.userId],
      references: [users.id],
    }),
  })
);

export const interviewUsageRelations = relations(
  interviewUsage,
  ({ one }) => ({
    user: one(users, {
      fields: [interviewUsage.userId],
      references: [users.id],
    }),
  })
);
