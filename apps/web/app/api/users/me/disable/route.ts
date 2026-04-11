import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

// POST /api/users/me/disable — disable the current user's account
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already disabled
  const [user] = await db
    .select({ disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (user?.disabledAt) {
    return NextResponse.json(
      { error: "Account is already disabled" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(users)
    .set({ disabledAt: new Date() })
    .where(eq(users.id, session.user.id))
    .returning({ id: users.id, disabledAt: users.disabledAt });

  return NextResponse.json(updated);
}
