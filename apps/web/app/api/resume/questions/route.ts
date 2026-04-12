import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { buildResumeQuestionsPrompt } from "@/lib/resume-prompt-builder";
import OpenAI from "openai";
import { z } from "zod/v4";

const requestSchema = z.object({
  resume_id: z.uuid(),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  question_type: z.enum(["behavioral", "technical"]),
});

const openai = new OpenAI();

// POST /api/resume/questions — generate resume-tailored interview questions
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({ route: "POST /api/resume/questions", userId: session.user.id });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { resume_id, company, role, question_type } = parsed.data;

  // Fetch resume — scoped to the current user (prevents accessing other users' resumes)
  const [resume] = await db
    .select({ id: userResumes.id, content: userResumes.content })
    .from(userResumes)
    .where(and(eq(userResumes.id, resume_id), eq(userResumes.userId, session.user.id)));

  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const prompt = buildResumeQuestionsPrompt({
    resumeText: resume.content,
    questionType: question_type,
    company,
    role,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content ?? "[]";

    // Parse the JSON array from GPT's response
    let questions: unknown[];
    try {
      questions = JSON.parse(responseText);
      if (!Array.isArray(questions)) {
        questions = [];
      }
    } catch {
      log.warn({ responseText }, "GPT response was not valid JSON, attempting extraction");
      // Try to extract JSON array from markdown code blocks
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    log.info({ resumeId: resume_id, questionType: question_type, count: questions.length }, "Generated resume questions");

    return NextResponse.json({ questions });
  } catch (err) {
    log.error({ err }, "Failed to generate questions from GPT");
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
