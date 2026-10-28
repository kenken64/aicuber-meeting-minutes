# syntax=docker/dockerfile:1
FROM node:22.23.1-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build:railway

FROM node:22.23.1-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    MINUTES_DB_PATH=/data/minutes.sqlite

# Railway mounts volumes as root. Drop privileges after preparing the DB path.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint"]
CMD ["node", "server.js"]
