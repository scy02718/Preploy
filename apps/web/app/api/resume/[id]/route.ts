import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";

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
