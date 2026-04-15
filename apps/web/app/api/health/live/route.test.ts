import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/health/live", () => {
  it("returns 200 {status:'ok'} without touching the database", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
