import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import { AppModule } from './app.module';

let cachedExpressApp: Express | null = null;

function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowed = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'https://apk-web-frontned.vercel.app',
  ].filter(Boolean) as string[];

  const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (
    allowed.includes(origin) ||
    isLocalDev ||
    origin.endsWith('.vercel.app')
  ) {
    callback(null, true);
    return;
  }

  callback(null, false);
}

/** Shared Nest bootstrap for local listen and Vercel serverless. */
export async function createExpressApp(): Promise<Express> {
  if (cachedExpressApp) {
    return cachedExpressApp;
  }

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: true,
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.init();
  cachedExpressApp = server;
  return server;
}
