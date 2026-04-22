/**
 * Resume parser: uses OpenAI structured output to convert raw resume text
 * into a typed payload (roles + bullets with impact scores, skills).
 *
 * Returns null on any failure so callers can gracefully fall back to
 * the unstructured plaintext view.
 *
 * Lazy-init OpenAI client: never constructed at module load so that
 * `next build` can import this module without OPENAI_API_KEY present.
 */
import { z } from "zod/v4";

// ---- Zod schemas (also used by the DB column type) ----

export const bulletSchema = z.object({
  text: z.string().min(1).max(800),
  impact_score: z.number().int().min(0).max(10),
  has_quantified_metric: z.boolean(),
});

export const roleSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  dates: z.string().max(120),
  bullets: z.array(bulletSchema).max(20),
});

export const structuredResumeSchema = z.object({
  roles: z.array(roleSchema).max(20),
  skills: z.array(z.string().min(1).max(80)).max(100),
});

export type StructuredResume = z.infer<typeof structuredResumeSchema>;

// ---- JSON schema for OpenAI structured output ----
// Mirrors the Zod schema above but expressed as JSON Schema strict mode
// requires. All fields must be listed in `required`; no `additionalProperties`.

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          dates: { type: "string" },
          bullets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                impact_score: { type: "integer" },
                has_quantified_metric: { type: "boolean" },
              },
              required: ["text", "impact_score", "has_quantified_metric"],
              additionalProperties: false,
            },
          },
        },
        required: ["company", "title", "dates", "bullets"],
        additionalProperties: false,
      },
    },
    skills: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["roles", "skills"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a resume analysis expert. Parse the provided resume text into structured JSON.

For each role/position:
- Extract company name, job title, and date range
- Extract each bullet point as-is
- Score each bullet's impact on a scale of 0-10:
  * 0-5: weak (vague, generic, no measurable outcome)
  * 6-7: moderate (some specificity but missing metrics or action clarity)
  * 8-10: strong (clear action verb, quantified impact, specific outcome)
- Set has_quantified_metric=true only if the bullet contains a number/percentage/dollar amount

For skills: extract all technical skills, tools, languages, and frameworks mentioned.

Return ONLY valid JSON matching the specified schema. No markdown, no commentary.`;

/**
 * Parse raw resume text into structured data.
 * Returns null if parsing fails for any reason (network error, invalid JSON,
 * schema mismatch, empty input) — callers must handle null gracefully.
 */
export async function parseResume(text: string): Promise<StructuredResume | null> {
  if (!text || text.trim().length === 0) return null;

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 15000) }, // guard against enormous resumes
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_resume",
          strict: true,
          schema: RESPONSE_JSON_SCHEMA,
        },
      },
      max_completion_tokens: 4000,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return null;
    }

    const result = structuredResumeSchema.safeParse(parsed);
    if (!result.success) return null;

    return result.data;
  } catch {
    return null;
  }
}
