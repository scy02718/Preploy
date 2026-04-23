import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { patchResumeBulletSchema } from "@/lib/validations";
import { parseResume } from "@/lib/resume-parser";

// PATCH /api/resume/[id] — replace a bullet in place + re-parse structured data
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({ route: "PATCH /api/resume/[id]", userId });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchResumeBulletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { oldBullet, newBullet } = parsed.data;

  let existing;
  [existing] = await db
    .select()
    .from(userResumes)
    .where(eq(userResumes.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Confirm the old bullet appears in content — replace first occurrence only.
  // Note: indexOf / replace are literal string operations; no regex / fuzzy matching.
  // If the bullet appears verbatim twice, only the first occurrence is replaced.
  if (!existing.content.includes(oldBullet)) {
    return NextResponse.json(
      { error: "Bullet not found in resume content" },
      { status: 400 }
    );
  }

  const newContent = existing.content.replace(oldBullet, newBullet);

  // Re-parse with new content — graceful fallback if parser fails
  let structuredData: unknown = null;
  try {
    structuredData = await parseResume(newContent);
  } catch (err) {
    log.warn({ err }, "parseResume threw on PATCH; proceeding with structuredData: null");
  }

  const [updated] = await db
    .update(userResumes)
    .set({ content: newContent, structuredData })
    .where(eq(userResumes.id, id))
    .returning({
      id: userResumes.id,
      filename: userResumes.filename,
      content: userResumes.content,
      structuredData: userResumes.structuredData,
      createdAt: userResumes.createdAt,
    });

  log.info({ resumeId: id }, "Resume bullet patched");

  return NextResponse.json(updated, { status: 200 });
}

// DELETE /api/resume/[id] — delete a specific resume owned by the authenticated user
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const log = createRequestLogger({ route: "DELETE /api/resume/[id]", userId });

  let existing;
  try {
    [existing] = await db
      .select()
      .from(userResumes)
      .where(eq(userResumes.id, id));
  } catch {
    // Postgres will throw when the id is not a valid UUID — treat as 404
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Return 404 (not 403) to avoid leaking existence of another user's resource
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  await db.delete(userResumes).where(eq(userResumes.id, id));

  log.info({ resumeId: id }, "Resume deleted");

  return new NextResponse(null, { status: 204 });
}
