import { describe, it, expect, vi } from "vitest";
import {
  withOpenAIRetry,
  OpenAIRetryError,
  type OpenAIChatLikeResponse,
} from "./openai-retry";

function makeLogger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function ok(content: string | null): OpenAIChatLikeResponse {
  return { choices: [{ message: { content } }] };
}

const SERVICE = "test-service";

describe("withOpenAIRetry", () => {
  // ---- empty reason ----

  it("succeeds on attempt 1 (no retry, no warning)", async () => {
    const log = makeLogger();
    const call = vi.fn().mockResolvedValue(ok("good"));
    const parseAndValidate = vi.fn().mockReturnValue({ ok: true });

    const result = await withOpenAIRetry(call, parseAndValidate, {
      service: SERVICE,
      log,
    });

    expect(result).toEqual({ ok: true });
    expect(call).toHaveBeenCalledTimes(1);
    expect(parseAndValidate).toHaveBeenCalledWith("good");
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("retries on empty content then succeeds", async () => {
    const log = makeLogger();
    const call = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok("good"));
    const parseAndValidate = vi.fn().mockReturnValue({ ok: true });

    const result = await withOpenAIRetry(call, parseAndValidate, {
      service: SERVICE,
      log,
    });

    expect(result).toEqual({ ok: true });
    expect(call).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      { attempt: 1, service: SERVICE, reason: "empty" },
      "GPT response malformed, retrying",
    );
  });

  it("throws after two empty responses", async () => {
    const log = makeLogger();
    const call = vi.fn().mockResolvedValue(ok(null));
    const parseAndValidate = vi.fn();

    await expect(
      withOpenAIRetry(call, parseAndValidate, { service: SERVICE, log }),
    ).rejects.toMatchObject({
      name: "OpenAIRetryError",
      reason: "empty",
    });
    expect(call).toHaveBeenCalledTimes(2);
    expect(parseAndValidate).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  // ---- invalid_json reason ----

  it("retries on invalid_json then succeeds", async () => {
    const log = makeLogger();
    const call = vi.fn().mockResolvedValue(ok("anything"));
    const parseAndValidate = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new OpenAIRetryError("invalid_json");
      })
      .mockReturnValueOnce({ parsed: true });

    const result = await withOpenAIRetry(call, parseAndValidate, {
      service: SERVICE,
      log,
    });

    expect(result).toEqual({ parsed: true });
    expect(call).toHaveBeenCalledTimes(2);
    expect(parseAndValidate).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(
      { attempt: 1, service: SERVICE, reason: "invalid_json" },
      "GPT response malformed, retrying",
    );
  });

  it("throws after two invalid_json responses", async () => {
    const log = makeLogger();
    const call = vi.fn().mockResolvedValue(ok("nope"));
    const parseAndValidate = vi.fn().mockImplementation(() => {
      throw new OpenAIRetryError("invalid_json");
    });

    await expect(
      withOpenAIRetry(call, parseAndValidate, { service: SERVICE, log }),
    ).rejects.toMatchObject({ reason: "invalid_json" });
    expect(call).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  // ---- schema_mismatch reason ----

  it("retries on schema_mismatch then succeeds", async () => {
    const log = makeLogger();
    const call = vi.fn().mockResolvedValue(ok("anything"));
    const parseAndValidate = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new OpenAIRetryError("schema_mismatch");
      })
      .mockReturnValueOnce({ valid: true });

    const result = await withOpenAIRetry(call, parseAndValidate, {
      service: SERVICE,
      log,
    });

    expect(result).toEqual({ valid: true });
    expect(log.warn).toHaveBeenCalledWith(
      { attempt: 1, service: SERVICE, reason: "schema_mismatch" },
      "GPT response malformed, retrying",
    );
  });

  it("throws after two schema_mismatch responses", async () => {
    const log = makeLogger();
    const call = vi.fn().mockResolvedValue(ok("anything"));
    const parseAndValidate = vi.fn().mockImplementation(() => {
      throw new OpenAIRetryError("schema_mismatch");
    });

    await expect(
      withOpenAIRetry(call, parseAndValidate, { service: SERVICE, log }),
    ).rejects.toMatchObject({ reason: "schema_mismatch" });
    expect(call).toHaveBeenCalledTimes(2);
  });

  // ---- mixed reasons + non-retry errors ----

  it("retries empty then schema_mismatch then throws schema_mismatch", async () => {
    const log = makeLogger();
    const call = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok("bad"));
    const parseAndValidate = vi.fn().mockImplementation(() => {
      throw new OpenAIRetryError("schema_mismatch");
    });

    await expect(
      withOpenAIRetry(call, parseAndValidate, { service: SERVICE, log }),
    ).rejects.toMatchObject({ reason: "schema_mismatch" });
    expect(call).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      { attempt: 1, service: SERVICE, reason: "empty" },
      "GPT response malformed, retrying",
    );
  });

  it("does not retry non-OpenAIRetryError errors (e.g. network failure)", async () => {
    const log = makeLogger();
    const networkErr = new Error("ECONNRESET");
    const call = vi.fn().mockRejectedValue(networkErr);
    const parseAndValidate = vi.fn();

    await expect(
      withOpenAIRetry(call, parseAndValidate, { service: SERVICE, log }),
    ).rejects.toBe(networkErr);
    expect(call).toHaveBeenCalledTimes(1);
    expect(log.warn).not.toHaveBeenCalled();
  });
});
