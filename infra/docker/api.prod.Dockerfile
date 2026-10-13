FROM node:24-alpine AS builder

WORKDIR /workspace

# Install system dependencies if required for native modules
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json

RUN npm ci

COPY api/ api/

RUN npm run db:generate --workspace=api
RUN npm run build --workspace=api

# Production runtime stage
FROM node:24-alpine AS runner

WORKDIR /workspace

RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy generated Prisma engine & client from builder
COPY --from=builder /workspace/node_modules/@prisma /workspace/node_modules/@prisma
COPY --from=builder /workspace/node_modules/.prisma /workspace/node_modules/.prisma

# Copy built API distribution and Prisma schema/migrations
COPY --from=builder /workspace/api/dist /workspace/api/dist
COPY --from=builder /workspace/api/prisma /workspace/api/prisma

WORKDIR /workspace/api

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/main.js"]
