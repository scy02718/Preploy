import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyQuestions } from "@/lib/schema";
import { buildCompanyQuestionsPrompt } from "@/lib/company-questions";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import { eq, and, gte } from "drizzle-orm";

const generateSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  count: z.number().int().min(1).max(20).optional(),
});

const companyQuestionSchema = z.object({
  question: z.string(),
  category: z.string(),
  tip: z.string(),
});

const questionsResponseSchema = z.object({
  questions: z.array(companyQuestionSchema).min(1),
});

// POST /api/questions/generate — generate company-specific behavioral questions
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({ route: "POST /api/questions/generate", userId });

  // Question generation calls OpenAI — "openai" tier (5/min).
  const rateLimited = await checkRateLimit(userId, "openai");
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = generateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parseResult.error.issues },
      { status: 400 }
    );
  }

  const { company, role, count } = parseResult.data;
  const normalizedCompany = company.trim().toLowerCase();
  const normalizedRole = role?.trim().toLowerCase() || null;

  // Check cache: same company+role within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const cached = await db
    .select()
    .from(companyQuestions)
    .where(
      and(
        eq(companyQuestions.userId, userId),
        eq(companyQuestions.company, normalizedCompany),
        normalizedRole
          ? eq(companyQuestions.role, normalizedRole)
          : undefined,
        gte(companyQuestions.createdAt, sevenDaysAgo)
      )
    )
    .limit(1);

  // For cached results with null role, filter manually since eq(col, null) won't match
  const cacheHit = cached.find((c) =>
    normalizedRole ? c.role === normalizedRole : c.role === null
  );

  if (cacheHit) {
    log.info({ company: normalizedCompany, role: normalizedRole }, "Returning cached questions");
    return NextResponse.json({
      company,
      role: role || null,
      questions: cacheHit.questions,
      cached: true,
    });
  }

  // Generate new questions via GPT
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  const prompt = buildCompanyQuestionsPrompt(company, role || undefined, count || 8);
  const openai = new OpenAI({ apiKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert interview coach who knows the interview processes of major tech companies. Generate realistic behavioral interview questions in valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        if (attempt === 0) continue;
        return NextResponse.json(
          { error: "Empty response from AI" },
          { status: 500 }
        );
      }

      const parsed = JSON.parse(raw);
      const validated = questionsResponseSchema.safeParse(parsed);

      if (!validated.success) {
        if (attempt === 0) continue;
        return NextResponse.json(
          { error: "AI returned invalid format" },
          { status: 500 }
        );
      }

      const questions = validated.data.questions;

      // Cache to DB
      await db.insert(companyQuestions).values({
        userId,
        company: normalizedCompany,
        role: normalizedRole,
        questions,
      });

      log.info(
        { company: normalizedCompany, role: normalizedRole, count: questions.length },
        "Generated and cached company questions"
      );

      return NextResponse.json({
        company,
        role: role || null,
        questions,
        cached: false,
      });
    } catch (err) {
      if (attempt === 0) continue;
      log.error({ err }, "Company question generation failed");
      return NextResponse.json(
        { error: "Failed to generate questions" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Failed to generate questions after retries" },
    { status: 500 }
  );
}
