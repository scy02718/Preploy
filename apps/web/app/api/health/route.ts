import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { createRequestLogger } from "@/lib/logger";

// Public endpoint — intentionally does not call `auth()`. Used by load balancer
// health checks and local `curl` smoke tests.
export async function GET() {
  const log = createRequestLogger({ route: "GET /api/health" });
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    log.error({ err }, "health check failed");
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
