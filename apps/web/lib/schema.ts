import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  real,
} from "drizzle-orm/pg-core";
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

// ---- Tables ----

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
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

// ---- Relations ----

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(interviewSessions),
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
