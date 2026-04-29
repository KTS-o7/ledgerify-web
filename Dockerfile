# Stage 1: Install dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Stage 3: Production runner (minimal)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S ledgerify && adduser -S ledgerify -G ledgerify

COPY --from=builder --chown=ledgerify:ledgerify /app/public ./public
COPY --from=builder --chown=ledgerify:ledgerify /app/.next/standalone ./
COPY --from=builder --chown=ledgerify:ledgerify /app/.next/static ./.next/static

USER ledgerify
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
