import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
import { rewriteBulletSchema } from "@/lib/validations";
import OpenAI from "openai";

// POST /api/resume/rewrite-bullet — return 3 AI-rewritten variants of a weak bullet.
// No DB write — the user must accept a variant via PATCH /api/resume/[id].
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({ route: "POST /api/resume/rewrite-bullet", userId });

  const rateLimited = await checkRateLimit(userId, "openai");
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = rewriteBulletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { resumeId, bullet, roleTitle, roleCompany } = parsed.data;

  // Scope fetch to the authenticated user — foreign resumeId → 404
  const [resume] = await db
    .select({ id: userResumes.id })
    .from(userResumes)
    .where(and(eq(userResumes.id, resumeId), eq(userResumes.userId, userId)));

  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const contextParts: string[] = [];
  if (roleTitle) contextParts.push(`Role: ${roleTitle}`);
  if (roleCompany) contextParts.push(`Company: ${roleCompany}`);
  const contextStr = contextParts.length > 0 ? `\n${contextParts.join("\n")}` : "";

  const userPrompt = `Bullet to rewrite:
"${bullet}"${contextStr}

Return exactly 3 stronger variants as JSON: { "variants": ["...", "...", "..."] }
Each variant must use an action verb, add a quantifiable impact, and preserve the same facts. Do not invent numbers.`;

  const responseJsonSchema = {
    type: "object",
    properties: {
      variants: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["variants"],
    additionalProperties: false,
  };

  try {
    // Lazy-init: never construct at module load (next build safety — see CLAUDE.md)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional resume coach. Rewrite weak resume bullets to add quantifiable impact, use strong action verbs, and keep the same facts. Do not invent numbers.",
        },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bullet_variants",
          strict: true,
          schema: responseJsonSchema,
        },
      },
      max_completion_tokens: 600,
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      log.error({}, "OpenAI returned no content");
      return NextResponse.json({ error: "Failed to generate rewrites" }, { status: 500 });
    }

    let data: { variants: string[] };
    try {
      data = JSON.parse(rawContent) as { variants: string[] };
    } catch {
      log.error({ rawContent }, "Failed to parse OpenAI response as JSON");
      return NextResponse.json({ error: "Failed to generate rewrites" }, { status: 500 });
    }

    if (!Array.isArray(data.variants) || data.variants.length < 1) {
      log.error({ data }, "OpenAI response missing variants array");
      return NextResponse.json({ error: "Failed to generate rewrites" }, { status: 500 });
    }

    // Ensure exactly 3 — pad or trim if LLM misbehaved despite strict schema
    const variants = data.variants.slice(0, 3);
    while (variants.length < 3) {
      variants.push(variants[variants.length - 1] ?? bullet);
    }

    log.info({ resumeId, variantCount: variants.length }, "Bullet rewrites generated");

    return NextResponse.json({ variants });
  } catch (err) {
    log.error({ err }, "Failed to generate bullet rewrites");
    return NextResponse.json({ error: "Failed to generate rewrites" }, { status: 500 });
  }
}
