FROM node:24-alpine AS builder

WORKDIR /workspace

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY api/prisma api/prisma/
COPY web/package.json web/package.json

RUN npm ci

COPY web/ web/

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

RUN npm run build --workspace=web

# Production runtime stage
FROM node:24-alpine AS runner

WORKDIR /workspace

RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY web/package.json web/package.json

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /workspace/web/.next /workspace/web/.next
COPY --from=builder /workspace/web/public /workspace/web/public 2>/dev/null || true

WORKDIR /workspace/web

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
