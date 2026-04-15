import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { starStories } from "@/lib/schema";
import { desc, eq, count } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import {
  createStarStorySchema,
  listStarStoriesQuerySchema,
} from "@/lib/validations";

// GET /api/star — list current user's STAR stories (paginated)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "GET /api/star",
    userId: session.user.id,
  });

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = listStarStoriesQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const [stories, [{ total }]] = await Promise.all([
      db
        .select()
        .from(starStories)
        .where(eq(starStories.userId, session.user.id))
        .orderBy(desc(starStories.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(starStories)
        .where(eq(starStories.userId, session.user.id)),
    ]);

    log.info({ count: stories.length }, "listed STAR stories");
    return NextResponse.json({
      stories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    log.error({ err }, "failed to list STAR stories");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/star — create a new STAR story
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({
    route: "POST /api/star",
    userId: session.user.id,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createStarStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const [story] = await db
      .insert(starStories)
      .values({
        userId: session.user.id,
        title: parsed.data.title,
        role: parsed.data.role,
        expectedQuestions: parsed.data.expectedQuestions,
        situation: parsed.data.situation,
        task: parsed.data.task,
        action: parsed.data.action,
        result: parsed.data.result,
      })
      .returning();

    log.info({ storyId: story.id }, "created STAR story");
    return NextResponse.json(story, { status: 201 });
  } catch (err) {
    log.error({ err }, "failed to create STAR story");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
