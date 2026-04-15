import { NextResponse } from "next/server";

// Liveness probe — intentionally does NOT touch the database, filesystem, or
// any external service. Returns 200 as long as the Node process is up. Pair
// with `/api/health` (readiness) which pings Postgres. See
// apps/web/README.md → Health checks.
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
