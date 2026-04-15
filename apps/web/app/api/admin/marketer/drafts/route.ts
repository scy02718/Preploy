import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketerDrafts, marketerPosts } from "@/lib/schema";
import { eq, count, desc } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";
import { listMarketerDraftsQuerySchema } from "@/lib/validations";
import { isAdmin } from "@/lib/admin-utils";

// GET /api/admin/marketer/drafts — list pending drafts, paginated
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const log = createRequestLogger({
    route: "GET /api/admin/marketer/drafts",
    userId: session.user.id,
  });

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = listMarketerDraftsQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const [drafts, [{ total }]] = await Promise.all([
      db
        .select({
          id: marketerDrafts.id,
          postId: marketerDrafts.postId,
          intent: marketerDrafts.intent,
          reply: marketerDrafts.reply,
          status: marketerDrafts.status,
          createdAt: marketerDrafts.createdAt,
          post: {
            id: marketerPosts.id,
            subreddit: marketerPosts.subreddit,
            title: marketerPosts.title,
            body: marketerPosts.body,
            permalink: marketerPosts.permalink,
            classification: marketerPosts.classification,
            summary: marketerPosts.summary,
            postedAt: marketerPosts.postedAt,
          },
        })
        .from(marketerDrafts)
        .innerJoin(marketerPosts, eq(marketerDrafts.postId, marketerPosts.id))
        .where(eq(marketerDrafts.status, "pending"))
        .orderBy(desc(marketerDrafts.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(marketerDrafts)
        .where(eq(marketerDrafts.status, "pending")),
    ]);

    log.info({ count: drafts.length }, "listed marketer drafts");
    return NextResponse.json({
      drafts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    log.error({ err }, "failed to list marketer drafts");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
