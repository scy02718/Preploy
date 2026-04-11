import * as Sentry from "@sentry/nextjs";

/**
 * Set Sentry user context from an auth session.
 * Call at the top of API route handlers after auth().
 */
export function setSentryUser(user: { id?: string; email?: string | null; name?: string | null } | undefined) {
  if (!user?.id) return;
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.name ?? undefined,
  });
}

/**
 * Tag a Sentry event with interview context.
 */
export function setSentryContext(context: {
  sessionType?: string;
  sessionId?: string;
}) {
  Sentry.setTag("session_type", context.sessionType);
  if (context.sessionId) {
    Sentry.setTag("session_id", context.sessionId);
  }
}
