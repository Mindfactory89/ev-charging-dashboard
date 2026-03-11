FROM node:25-bookworm-slim

WORKDIR /app

# System deps for Prisma + SSL
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Dependencies
COPY package.json package-lock.json ./
RUN npm ci

# App source
COPY . .

# Prisma client
RUN npx prisma generate
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["node", "server.js"]
