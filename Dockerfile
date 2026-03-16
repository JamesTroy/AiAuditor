FROM node:22-alpine AS base
# Ensure SSL certificates are available for Supabase/external API connections
RUN apk add --no-cache libc6-compat

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (dummy values — real secrets injected at runtime by Railway)
ENV ANTHROPIC_API_KEY=dummy_key_for_build
ENV BETTER_AUTH_SECRET=dummy_secret_for_build_only_00000000
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined into the JS bundle at build time by Next.js.
# They MUST be set here — runtime env vars are too late for client-side code.
ARG NEXT_PUBLIC_APP_URL=https://claudit.consulting
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "echo '[DEBUG] Env vars present at runtime:' && env | grep -E '^(BETTER_AUTH|DATABASE_URL|ANTHROPIC|HEALTH|RESEND|REVALIDATION|API_ACCESS|TOTP|NEXT_PUBLIC|EMAIL_FROM)' | sed 's/=.*/=***/' && node server.js"]
