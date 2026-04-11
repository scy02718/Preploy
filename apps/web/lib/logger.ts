import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

/**
 * Create a child logger with request context and auto-generated request ID.
 * Use in API route handlers: `const log = createRequestLogger({ sessionId, userId })`
 */
export function createRequestLogger(context: Record<string, unknown>) {
  return logger.child({
    requestId: crypto.randomUUID(),
    ...context,
  });
}
