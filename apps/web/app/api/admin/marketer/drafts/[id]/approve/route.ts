import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketerDrafts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { isAdmin } from "@/lib/admin-utils";

// POST /api/admin/marketer/drafts/[id]/approve — mark draft as approved
export async function POST(
  _request: NextRequest,
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
    route: "POST /api/admin/marketer/drafts/[id]/approve",
    userId: session.user.id,
  });

  try {
    const [draft] = await db
      .update(marketerDrafts)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      })
      .where(eq(marketerDrafts.id, id))
      .returning();

    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    log.info({ draftId: id }, "draft approved");
    return NextResponse.json(draft);
  } catch (err) {
    log.error({ err, draftId: id }, "failed to approve draft");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
