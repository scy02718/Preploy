/**
 * OpenAI spend tracking and per-user/global daily caps.
 *
 * Every OpenAI call should:
 *   1. Call `checkOpenAICap(userId)` BEFORE the call — throws `OpenAICapError`
 *      if the per-user or global daily cap is already hit.
 *   2. Call `recordOpenAIUsage(userId, model, inputTokens, outputTokens)` AFTER
 *      a successful call — fire-and-forget (don't block the response on it).
 *
 * The `openai_usage` table stores one row per (user_id, date, model) with
 * a UNIQUE index so concurrent UPSERTs are serialised by Postgres. Costs
 * are stored in integer **millidollars** (3 decimal places of USD) to avoid
 * floating-point drift.
 */

import { sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { openaiUsage } from "@/lib/schema";

// ---------------------------------------------------------------------------
// Model pricing (update when OpenAI publishes new model prices)
// ---------------------------------------------------------------------------

interface ModelPrice {
  inputPer1MTokens: number;
  outputPer1MTokens: number;
}

export const OPENAI_MODEL_PRICING: Record<string, ModelPrice> = {
  "gpt-5.4-mini": { inputPer1MTokens: 0.75, outputPer1MTokens: 4.5 },
  "gpt-4o-mini": { inputPer1MTokens: 0.15, outputPer1MTokens: 0.6 },
  "gpt-4o": { inputPer1MTokens: 2.5, outputPer1MTokens: 10.0 },
  // TODO: replace with official gpt-5 prices when OpenAI publishes.
  "gpt-5": { inputPer1MTokens: 5.0, outputPer1MTokens: 30.0 },
  // Whisper is priced per minute, not per token — tracked separately.
  // Add new models here as they're adopted in the codebase.
};

// ---------------------------------------------------------------------------
// Cost computation
// ---------------------------------------------------------------------------

export function computeCostMillis(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = OPENAI_MODEL_PRICING[model];
  if (!pricing) {
    throw new Error(
      `Unknown model "${model}" — add it to OPENAI_MODEL_PRICING in lib/openai-usage.ts`
    );
  }
  // Compute in USD then convert to millidollars, rounding up to avoid
  // accumulating tiny negative drift (we'd rather overcount than undercount).
  const costUsd =
    (inputTokens / 1_000_000) * pricing.inputPer1MTokens +
    (outputTokens / 1_000_000) * pricing.outputPer1MTokens;
  return Math.ceil(costUsd * 1000);
}

// ---------------------------------------------------------------------------
// Cap constants
// ---------------------------------------------------------------------------

function parseEnvFloat(name: string, defaultVal: number): number {
  const raw = process.env[name];
  if (!raw) return defaultVal;
  const n = parseFloat(raw);
  return isNaN(n) ? defaultVal : n;
}

export function getPerUserDailyCapMillis(): number {
  return Math.round(parseEnvFloat("OPENAI_PER_USER_DAILY_CAP_USD", 2) * 1000);
}

export function getGlobalDailyCapMillis(): number {
  return Math.round(
    parseEnvFloat("OPENAI_GLOBAL_DAILY_CAP_USD", 50) * 1000
  );
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export type OpenAICapReason = "per_user" | "global";

export class OpenAICapError extends Error {
  reason: OpenAICapReason;
  constructor(reason: OpenAICapReason) {
    super(`OpenAI daily cap reached: ${reason}`);
    this.name = "OpenAICapError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function todayUtcString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function getUserDailySpendMillis(
  userId: string
): Promise<number> {
  const today = todayUtcString();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${openaiUsage.costUsdMillis}), 0)`,
    })
    .from(openaiUsage)
    .where(
      and(eq(openaiUsage.userId, userId), eq(openaiUsage.date, today))
    );
  return Number(row?.total ?? 0);
}

export async function getGlobalDailySpendMillis(): Promise<number> {
  const today = todayUtcString();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${openaiUsage.costUsdMillis}), 0)`,
    })
    .from(openaiUsage)
    .where(eq(openaiUsage.date, today));
  return Number(row?.total ?? 0);
}

export async function recordOpenAIUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  if (!OPENAI_MODEL_PRICING[model]) {
    console.warn("recordOpenAIUsage: unknown model, skipping", { model });
    return;
  }
  const cost = computeCostMillis(model, inputTokens, outputTokens);
  const today = todayUtcString();
  await db
    .insert(openaiUsage)
    .values({
      userId,
      date: today,
      model,
      inputTokens,
      outputTokens,
      costUsdMillis: cost,
    })
    .onConflictDoUpdate({
      target: [openaiUsage.userId, openaiUsage.date, openaiUsage.model],
      set: {
        inputTokens: sql`${openaiUsage.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${openaiUsage.outputTokens} + ${outputTokens}`,
        costUsdMillis: sql`${openaiUsage.costUsdMillis} + ${cost}`,
      },
    });
}

// ---------------------------------------------------------------------------
// Pre-call cap check
// ---------------------------------------------------------------------------

/**
 * Throws `OpenAICapError` if the user or global daily spend cap is already
 * exceeded. Call this BEFORE every OpenAI request.
 *
 * Runs two parallel DB reads (user spend + global spend). On Vercel this
 * adds ~20ms of latency per OpenAI call — acceptable given each call costs
 * real money.
 */
export async function checkOpenAICap(userId: string): Promise<void> {
  const [userSpend, globalSpend] = await Promise.all([
    getUserDailySpendMillis(userId),
    getGlobalDailySpendMillis(),
  ]);

  if (userSpend >= getPerUserDailyCapMillis()) {
    throw new OpenAICapError("per_user");
  }
  if (globalSpend >= getGlobalDailyCapMillis()) {
    throw new OpenAICapError("global");
  }
}
