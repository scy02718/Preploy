import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketerDrafts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { editDraftSchema } from "@/lib/validations";
import { isAdmin } from "@/lib/admin-utils";

// PATCH /api/admin/marketer/drafts/[id] — update reply text + mark as edited
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const log = createRequestLogger({
    route: "PATCH /api/admin/marketer/drafts/[id]",
    userId: session.user.id,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = editDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const [draft] = await db
      .update(marketerDrafts)
      .set({
        reply: parsed.data.reply,
        status: "edited",
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      })
      .where(eq(marketerDrafts.id, id))
      .returning();

    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    log.info({ draftId: id }, "draft edited");
    return NextResponse.json(draft);
  } catch (err) {
    log.error({ err, draftId: id }, "failed to edit draft");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
