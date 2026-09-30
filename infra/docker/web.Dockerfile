FROM node:24-alpine

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=web", "--", "--hostname", "0.0.0.0"]