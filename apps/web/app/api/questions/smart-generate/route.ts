import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit, requireProFeature } from "@/lib/api-utils";
import { buildSmartQuestionsPrompt } from "@/lib/smart-questions-prompt";
import OpenAI from "openai";

// POST /api/questions/smart-generate — generate questions combining company + resume context
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lazy-instantiate so `next build` can import this module without
  // OPENAI_API_KEY being present. The SDK throws synchronously if the key
  // is missing at construction time.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Smart generation issues an OpenAI call per request — "openai" tier (5/min).
  const rateLimited = await checkRateLimit(session.user.id, "openai");
  if (rateLimited) return rateLimited;

  const log = createRequestLogger({ route: "POST /api/questions/smart-generate", userId: session.user.id });

  const body = await request.json();
  const { company, role, resume_id, question_type } = body;

  // Pro-gating: this route is `/api/questions/generate` + an optional
  // resume-content injection. The resume injection IS the Pro feature
  // (resume-tailored questions). If the caller supplies a `resume_id`,
  // require Pro. If they don't, fall through — a company-only smart
  // question set is equivalent to the free `/api/questions/generate`
  // surface, so blocking it would be over-reach. Blocks the parallel
  // attack path where a free user posts their own `resume_id` here to
  // get resume-tailored output without paying.
  if (resume_id) {
    const gated = await requireProFeature(session.user.id, "resume_tailored_questions");
    if (gated) return gated;
  }

  if (!company || typeof company !== "string") {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  if (question_type !== "behavioral" && question_type !== "technical") {
    return NextResponse.json({ error: "question_type must be 'behavioral' or 'technical'" }, { status: 400 });
  }

  // Fetch resume text if resume_id provided
  let resumeText: string | undefined;
  if (resume_id) {
    const [resume] = await db
      .select({ content: userResumes.content })
      .from(userResumes)
      .where(and(eq(userResumes.id, resume_id), eq(userResumes.userId, session.user.id)));

    if (resume) {
      resumeText = resume.content;
    }
  }

  const prompt = buildSmartQuestionsPrompt({
    company,
    role: role || undefined,
    resumeText,
    questionType: question_type,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_completion_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    let questions: unknown[];
    try {
      const parsed = JSON.parse(raw);
      questions = Array.isArray(parsed) ? parsed : parsed.questions ?? [];
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      questions = match ? JSON.parse(match[0]) : [];
    }

    log.info({ company, resumeId: resume_id, questionType: question_type, count: questions.length }, "Smart questions generated");

    return NextResponse.json({
      company,
      questions,
      mode: resumeText ? "smart" : "company-only",
    });
  } catch (err) {
    log.error({ err }, "Smart question generation failed");
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
