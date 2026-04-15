import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    execute: (...args: unknown[]) => execute(...args),
  },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("returns 200 {status:'ok'} when the DB ping succeeds", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns 503 {status:'error'} when the DB ping throws", async () => {
    execute.mockRejectedValueOnce(new Error("connection refused"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "error" });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
