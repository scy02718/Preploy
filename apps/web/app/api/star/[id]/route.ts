import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { starStories, starStoryAnalyses } from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { updateStarStorySchema } from "@/lib/validations";

// GET /api/star/[id] — fetch a specific STAR story with its analyses
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "GET /api/star/[id]",
    userId: session.user.id,
    storyId: id,
  });

  try {
    const [story] = await db
      .select()
      .from(starStories)
      .where(
        and(eq(starStories.id, id), eq(starStories.userId, session.user.id))
      );

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const analyses = await db
      .select()
      .from(starStoryAnalyses)
      .where(eq(starStoryAnalyses.storyId, id))
      .orderBy(desc(starStoryAnalyses.createdAt));

    log.info({ analysesCount: analyses.length }, "fetched STAR story");
    return NextResponse.json({ story, analyses });
  } catch (err) {
    log.error({ err }, "failed to fetch STAR story");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/star/[id] — update a STAR story
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "PATCH /api/star/[id]",
    userId: session.user.id,
    storyId: id,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateStarStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    // Verify ownership first
    const [existing] = await db
      .select()
      .from(starStories)
      .where(
        and(eq(starStories.id, id), eq(starStories.userId, session.user.id))
      );

    if (!existing) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const updateData: Partial<typeof starStories.$inferInsert> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.expectedQuestions !== undefined)
      updateData.expectedQuestions = parsed.data.expectedQuestions;
    if (parsed.data.situation !== undefined)
      updateData.situation = parsed.data.situation;
    if (parsed.data.task !== undefined) updateData.task = parsed.data.task;
    if (parsed.data.action !== undefined)
      updateData.action = parsed.data.action;
    if (parsed.data.result !== undefined)
      updateData.result = parsed.data.result;

    const [updated] = await db
      .update(starStories)
      .set(updateData)
      .where(
        and(eq(starStories.id, id), eq(starStories.userId, session.user.id))
      )
      .returning();

    log.info("updated STAR story");
    return NextResponse.json(updated);
  } catch (err) {
    log.error({ err }, "failed to update STAR story");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/star/[id] — delete a STAR story (cascade to analyses)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "DELETE /api/star/[id]",
    userId: session.user.id,
    storyId: id,
  });

  try {
    const [deleted] = await db
      .delete(starStories)
      .where(
        and(eq(starStories.id, id), eq(starStories.userId, session.user.id))
      )
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    log.info("deleted STAR story");
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, "failed to delete STAR story");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
