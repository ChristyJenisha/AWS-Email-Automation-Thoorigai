import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

// Load .env if present
for (const envPath of [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'api/.env'), resolve(process.cwd(), '../.env')]) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // ignore
    }
  }
}

async function bootstrap() {
  // Production security checks (P1-1, P1-4, P3-8)
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (process.env.DEMO_MODE === 'true') {
      throw new Error('FATAL: DEMO_MODE cannot be enabled in production environments.');
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('FATAL: JWT_SECRET environment variable must be set to at least 32 characters in production.');
    }
    const signingSecret = process.env.TOKEN_SIGNING_SECRET;
    if (!signingSecret || signingSecret.length < 16) {
      throw new Error('FATAL: TOKEN_SIGNING_SECRET must be set to at least 16 characters in production.');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers with Helmet (P1-6)
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP managed at reverse proxy/Pages layer to allow API responses
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie parser for secure httpOnly session cookies (P1-8)
  app.use(cookieParser());

  // Trust proxy for reverse proxy headers (Cloudflare / Nginx / AWS ALB) (P1-7)
  app.set('trust proxy', 1);

  // CORS allowlist configuration (P1-5)
  const defaultAllowedOrigins = [
    'https://collectflow-app.pages.dev',
    'https://thoorigaibilltracker.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const envCors = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envCors]));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'idempotency-key'],
  });

  // Swagger OpenAPI Documentation (P2-8)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CollectFlow API')
    .setDescription('Bill Collection Tracker API & Workflow Engine')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.API_PORT ?? process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`[API_READY] Server listening on http://localhost:${port}`);
  console.log(`[SWAGGER_READY] OpenAPI documentation active at http://localhost:${port}/api/docs`);
}
await bootstrap();
