import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + inline (Next.js hydration) + eval (Monaco) + jsdelivr (Monaco loader)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  // Styles: self + inline (Tailwind) + Monaco CDN styles
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  // Images: self + data URIs + avatars/external
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  // Fonts: self + Monaco editor fonts (Codicon)
  "font-src 'self' https://cdn.jsdelivr.net",
  // Connect: self + OpenAI + Supabase + Sentry + Python API + Monaco CDN
  "connect-src 'self' https://api.openai.com wss://api.openai.com https://*.supabase.co https://*.sentry.io https://*.ingest.us.sentry.io http://localhost:8000 https://cdn.jsdelivr.net",
  // Media: self + blob (audio recording)
  "media-src 'self' blob:",
  // Workers: self + blob (Monaco editor workers)
  "worker-src 'self' blob:",
  // Child: same as worker (some browsers use child-src for workers)
  "child-src 'self' blob:",
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
  // Emit a self-contained server bundle for Docker. The runner stage copies
  // only `.next/standalone`, `.next/static`, and `public` — see
  // apps/web/Dockerfile.
  output: "standalone",
  // In a monorepo, tell Next to trace files from the repo root so
  // `packages/shared` is picked up by the standalone output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
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
