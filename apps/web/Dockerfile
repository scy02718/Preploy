# syntax=docker/dockerfile:1.7
#
# Preploy web — multi-stage Dockerfile.
#
# Build context MUST be the repo root so the monorepo workspace files
# (package-lock.json, turbo.json, packages/shared) are visible:
#
#   docker build -f apps/web/Dockerfile -t preploy-web:dev .
#
# Stages:
#   deps    — install workspace node_modules with npm ci
#   builder — run `next build` to emit .next/standalone
#   runner  — minimal runtime image, non-root, sharp installed
#
# -----------------------------------------------------------------------------
# deps
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

# -----------------------------------------------------------------------------
# builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1 \
    # A few API routes construct their OpenAI client at module top-level
    # (`const openai = new OpenAI()`), which means `next build`'s page-data
    # collection instantiates the client and the SDK throws if the env var
    # is missing. Supply a placeholder ONLY for the build stage — it never
    # reaches the runner image. Real keys are injected at container-run
    # time via --env-file (see apps/web/README.md → Local Docker).
    OPENAI_API_KEY=sk-build-placeholder
WORKDIR /app/apps/web
# Next.js 16 stat()s apps/web/.env during `next build` and errors out with
# ENOENT if it is missing instead of treating "no .env" as "no overrides".
# `.dockerignore` excludes .env* from the build context, so materialize an
# empty placeholder. Real runtime env values are injected at container-run
# time via --env-file, never baked into the image.
RUN touch .env
RUN npm run build

# -----------------------------------------------------------------------------
# runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -g 1001 -S nodejs \
 && adduser -S -u 1001 -G nodejs nextjs

# sharp is required by Next.js image optimization in production. Install it
# at image build time only (never in apps/web/package.json) so local dev on
# macOS/Windows doesn't download the Linux binary.
RUN npm install --omit=dev --prefix /tmp/sharp sharp \
 && mkdir -p /app/node_modules \
 && cp -R /tmp/sharp/node_modules/. /app/node_modules/ \
 && rm -rf /tmp/sharp \
 && chown -R nextjs:nodejs /app/node_modules

# Next.js standalone output in a monorepo emits under apps/web/.next/standalone
# containing a pruned node_modules AND a copy of the web source at
# apps/web/server.js. Preserve that layout when copying into /app.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
