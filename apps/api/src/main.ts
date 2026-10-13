import './config/load-env';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { env } from './config/env';

// Safety net: BigInt values must never crash JSON serialization. Money is
// converted explicitly in mappers; this only guards against an overlooked field.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const config = env(); // fails fast on invalid configuration
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: true });
  const logger = new Logger('HTTP');

  app.set('trust proxy', config.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.useBodyParser('json', { limit: '256kb' });
  app.enableCors({
    origin: config.CORS_ORIGINS ? config.CORS_ORIGINS.split(',').map((s) => s.trim()) : false,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

  // Access log without bodies, query strings, tokens or personal data.
  app.use((req: any, res: any, next: () => void) => {
    const start = Date.now();
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.on('finish', () => {
      const path = (req.originalUrl || req.url).split('?')[0].replace(/\/v1\/dev-storage\/[^/]+/, '/v1/dev-storage/[signed]');
      logger.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - start}ms [${req.requestId}]${req.actor ? ` user=${req.actor.id}` : ''}`);
    });
    next();
  });

  app.enableShutdownHooks();
  await app.listen(config.PORT);
  logger.log(`API listening on :${config.PORT} (${config.NODE_ENV})`);
}

void bootstrap();
