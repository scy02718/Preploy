import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Only apply Sentry wrapping when DSN is configured
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Upload source maps for readable stack traces in Sentry
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      // Suppress noisy build logs
      silent: true,
    })
  : nextConfig;
