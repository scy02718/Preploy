import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";
import { technicalConfigSchema, problemSchema } from "@/lib/validations";
import { buildProblemGenerationPrompt } from "@/lib/prompts-technical";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";

// POST /api/problems/generate — generate a coding problem from config
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(session.user.id);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const configResult = technicalConfigSchema.safeParse(body.config);
  if (!configResult.success) {
    return NextResponse.json(
      { error: "Invalid config", details: configResult.error.issues },
      { status: 400 }
    );
  }

  // Optional: previously-shown problems the user wants to exclude. The
  // prompt will instruct the model not to reuse them or close variants.
  const excludeQuestions: string[] = Array.isArray(body.excludeQuestions)
    ? body.excludeQuestions.filter(
        (q: unknown): q is string => typeof q === "string" && q.length > 0
      ).slice(0, 20) // cap to prevent prompt stuffing
    : [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  const prompt = buildProblemGenerationPrompt(configResult.data);
  const openai = new OpenAI({ apiKey });

  // Try up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Build the exclusion clause for the system prompt so the model
      // avoids repeating previously-shown problems.
      const exclusionClause =
        excludeQuestions.length > 0
          ? `\n\nIMPORTANT: The user has already seen the following problems. Do NOT reuse them or generate close variants:\n${excludeQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
          : "";

      const completion = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [
          {
            role: "system",
            content: `You are a technical interview problem generator. Generate problems in valid JSON only.${exclusionClause}`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8, // slightly higher to increase variety on regeneration
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
      const validated = problemSchema.safeParse(parsed);

      if (validated.success) {
        return NextResponse.json(validated.data);
      }

      // Invalid schema — retry once
      if (attempt === 0) continue;

      return NextResponse.json(
        { error: "AI returned invalid problem format" },
        { status: 500 }
      );
    } catch (err) {
      if (attempt === 0) continue;

      logger.error({ err }, "Problem generation failed");
      return NextResponse.json(
        { error: "Failed to generate problem" },
        { status: 500 }
      );
    }
  }

  // Should not reach here, but safety net
  return NextResponse.json(
    { error: "Failed to generate problem after retries" },
    { status: 500 }
  );
}
