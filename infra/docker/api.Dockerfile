FROM node:24-alpine

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .
RUN npm run db:generate --workspace=api

EXPOSE 3001
CMD ["npm", "run", "start:dev", "--workspace=api"]