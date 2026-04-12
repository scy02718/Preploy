import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionTemplates } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { createRequestLogger } from "@/lib/logger";

// GET /api/templates — list user's templates, optionally filtered by type
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeFilter = request.nextUrl.searchParams.get("type");

  const conditions = [eq(sessionTemplates.userId, session.user.id)];
  if (typeFilter === "behavioral" || typeFilter === "technical") {
    conditions.push(eq(sessionTemplates.type, typeFilter));
  }

  const templates = await db
    .select()
    .from(sessionTemplates)
    .where(and(...conditions))
    .orderBy(desc(sessionTemplates.updatedAt));

  return NextResponse.json(templates);
}

// POST /api/templates — save a new template
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createRequestLogger({ route: "POST /api/templates", userId: session.user.id });

  const body = await request.json();
  const { name, type, config } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "Template name must be under 100 characters" }, { status: 400 });
  }

  if (type !== "behavioral" && type !== "technical") {
    return NextResponse.json({ error: "Type must be 'behavioral' or 'technical'" }, { status: 400 });
  }

  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "Config object is required" }, { status: 400 });
  }

  const [template] = await db
    .insert(sessionTemplates)
    .values({
      userId: session.user.id,
      name: name.trim(),
      type,
      config,
    })
    .returning();

  log.info({ templateId: template.id, name: template.name }, "Template created");

  return NextResponse.json(template, { status: 201 });
}
