import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userResumes } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";

// GET /api/resume — list the authenticated user's resumes
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({ route: "GET /api/resume", userId: session.user.id });

  const resumes = await db
    .select({
      id: userResumes.id,
      filename: userResumes.filename,
      content: userResumes.content,
      createdAt: userResumes.createdAt,
    })
    .from(userResumes)
    .where(eq(userResumes.userId, session.user.id))
    .orderBy(desc(userResumes.createdAt));

  log.info({ count: resumes.length }, "Listed resumes");

  return NextResponse.json({ resumes });
}
