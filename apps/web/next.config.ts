import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + inline (Next.js requires inline scripts for hydration)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: self + inline (Tailwind injects styles)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs + avatars/external
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  // Fonts: self
  "font-src 'self'",
  // Connect: self + OpenAI + Supabase + Sentry + Python API
  "connect-src 'self' https://api.openai.com wss://api.openai.com https://*.supabase.co https://*.sentry.io https://*.ingest.us.sentry.io http://localhost:8000",
  // Media: self + blob (audio recording)
  "media-src 'self' blob:",
  // Workers: self + blob (MediaPipe, Monaco)
  "worker-src 'self' blob:",
  // Frame: none
  "frame-src 'none'",
  // Object: none
  "object-src 'none'",
  // Base URI: self
  "base-uri 'self'",
  // Form action: self
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
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
