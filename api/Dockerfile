FROM node:20-bookworm-slim

WORKDIR /app/api

# System deps for Prisma + SSL
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Dependencies
COPY api/package.json api/package-lock.json ./
RUN npm ci

# App source
COPY api ./
COPY shared /app/shared

# Prisma client
RUN npx prisma generate
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["node", "server.js"]
