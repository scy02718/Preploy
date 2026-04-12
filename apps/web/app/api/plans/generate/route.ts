import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPlans, sessionFeedback, interviewSessions } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import OpenAI from "openai";
import { buildPlanGenerationPrompt, extractWeakAreas } from "@/lib/plan-generator";
import { createRequestLogger } from "@/lib/logger";
import type { PlanData } from "@/lib/plan-generator";

const generatePlanSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  interview_date: z.string().min(1),
});

// POST /api/plans/generate — generate a day-by-day interview prep plan
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "POST /api/plans/generate",
    userId: session.user.id,
  });

  const body = await request.json();
  const parsed = generatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { company, role, interview_date } = parsed.data;

  // Validate the date
  const interviewDate = new Date(interview_date);
  if (isNaN(interviewDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid interview date" },
      { status: 400 }
    );
  }

  // Auto-detect weak areas from past feedback
  const feedbackRows = await db
    .select({ weaknesses: sessionFeedback.weaknesses })
    .from(sessionFeedback)
    .innerJoin(
      interviewSessions,
      eq(sessionFeedback.sessionId, interviewSessions.id)
    )
    .where(
      and(
        eq(interviewSessions.userId, session.user.id),
        eq(interviewSessions.status, "completed")
      )
    );

  const weakAreas = extractWeakAreas(
    feedbackRows.map((r) => ({ weaknesses: r.weaknesses as string[] | undefined }))
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  const prompt = buildPlanGenerationPrompt({
    company,
    role,
    interview_date,
    weak_areas: weakAreas.length > 0 ? weakAreas : undefined,
  });

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert interview coach. Generate structured preparation plans in valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 500 }
      );
    }

    const planData: PlanData = JSON.parse(raw);

    // Ensure all days have completed: false
    if (planData.days) {
      planData.days = planData.days.map((day) => ({
        ...day,
        completed: false,
      }));
    }

    // Save to database
    const [created] = await db
      .insert(interviewPlans)
      .values({
        userId: session.user.id,
        company,
        role,
        interviewDate,
        planData,
      })
      .returning();

    log.info({ planId: created.id }, "Plan generated successfully");

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    log.error({ err }, "Plan generation failed");
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}
