import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionTemplates } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// GET /api/templates/[id] — get a specific template
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [template] = await db
    .select()
    .from(sessionTemplates)
    .where(
      and(
        eq(sessionTemplates.id, id),
        eq(sessionTemplates.userId, session.user.id)
      )
    );

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

// PATCH /api/templates/[id] — update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [existing] = await db
    .select()
    .from(sessionTemplates)
    .where(
      and(
        eq(sessionTemplates.id, id),
        eq(sessionTemplates.userId, session.user.id)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    if (body.name.trim().length === 0 || body.name.length > 100) {
      return NextResponse.json({ error: "Name must be 1-100 characters" }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if (body.config && typeof body.config === "object") {
    updates.config = body.config;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(sessionTemplates)
    .set(updates)
    .where(eq(sessionTemplates.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/templates/[id] — delete a template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [existing] = await db
    .select()
    .from(sessionTemplates)
    .where(
      and(
        eq(sessionTemplates.id, id),
        eq(sessionTemplates.userId, session.user.id)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await db
    .delete(sessionTemplates)
    .where(eq(sessionTemplates.id, id));

  return NextResponse.json({ success: true });
}
