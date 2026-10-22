FROM node:24-alpine

WORKDIR /workspace
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=web", "--", "--hostname", "0.0.0.0"]