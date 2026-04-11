import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";
import { technicalConfigSchema, problemSchema } from "@/lib/validations";
import { buildProblemGenerationPrompt } from "@/lib/prompts-technical";

// POST /api/problems/generate — generate a coding problem from config
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const configResult = technicalConfigSchema.safeParse(body.config);
  if (!configResult.success) {
    return NextResponse.json(
      { error: "Invalid config", details: configResult.error.issues },
      { status: 400 }
    );
  }

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
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a technical interview problem generator. Generate problems in valid JSON only.",
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

      console.error("Problem generation error:", err);
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
