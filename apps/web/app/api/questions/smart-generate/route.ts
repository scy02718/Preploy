import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import { buildSmartQuestionsPrompt } from "@/lib/smart-questions-prompt";
import OpenAI from "openai";

const openai = new OpenAI();

// POST /api/questions/smart-generate — generate questions combining company + resume context
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  const log = createRequestLogger({ route: "POST /api/questions/smart-generate", userId: session.user.id });

  const body = await request.json();
  const { company, role, resume_id, question_type } = body;

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
