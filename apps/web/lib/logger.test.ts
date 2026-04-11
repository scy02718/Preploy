import { describe, it, expect } from "vitest";
import { logger, createRequestLogger } from "./logger";

describe("logger", () => {
  it("exports a pino logger instance", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("has a level property", () => {
    expect(logger.level).toBeDefined();
    expect(typeof logger.level).toBe("string");
  });
});

describe("createRequestLogger", () => {
  it("returns a child logger with context", () => {
    const log = createRequestLogger({ route: "POST /api/test", userId: "user-1" });
    expect(log).toBeDefined();
    expect(typeof log.info).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("includes a requestId in the child logger bindings", () => {
    const log = createRequestLogger({ route: "GET /api/sessions" });
    // Pino child loggers expose bindings
    const bindings = log.bindings();
    expect(bindings.requestId).toBeDefined();
    expect(typeof bindings.requestId).toBe("string");
    expect(bindings.requestId.length).toBeGreaterThan(0);
  });

  it("includes provided context in bindings", () => {
    const log = createRequestLogger({ sessionId: "sess-123", userId: "user-456" });
    const bindings = log.bindings();
    expect(bindings.sessionId).toBe("sess-123");
    expect(bindings.userId).toBe("user-456");
  });

  it("generates unique requestIds per call", () => {
    const log1 = createRequestLogger({});
    const log2 = createRequestLogger({});
    expect(log1.bindings().requestId).not.toBe(log2.bindings().requestId);
  });
});
