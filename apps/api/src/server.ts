import path from 'path';
import fs from 'fs';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { getEnv } from '@private-md-bot/config';
import { db } from '@private-md-bot/database';
import { SessionManager } from './session-manager';

import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerWhatsAppRoutes } from './routes/whatsapp';
import { registerCommandRoutes } from './routes/commands';
import { registerAutoReplyRoutes } from './routes/autoreply';
import { registerSettingsRoutes } from './routes/settings';
import { registerLogRoutes } from './routes/logs';
import { registerPaymentRoutes } from './routes/payment';
import { registerScheduledMessageRoutes } from './routes/scheduler';
import { registerWebSocketGateway } from './websocket';
import { startMessageScheduler } from './scheduler';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export async function buildServer() {
  const env = getEnv();

  // SECURITY: never allow the default JWT secret in production — anyone who knows
  // the default can forge an OWNER-role dashboard token and take over the bot.
  const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_change_in_production_32bytes_minimum';
  if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error(
      'Refusing to start in production with the default JWT_SECRET. ' +
      'Set a strong random JWT_SECRET environment variable (e.g. `openssl rand -hex 32`).'
    );
  }

  const fastify = Fastify({
    logger: {
      level: 'info',
      redact: ['headers.authorization', 'req.headers.cookie'],
    },
  });

  // CORS Configuration
  await fastify.register(fastifyCors, {
    origin: [env.WEB_URL, 'http://localhost:3000'],
    credentials: true,
  });

  // Global Rate Limiting (Protection against DDoS and brute-force)
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again in a minute.',
    }),
  });

  await fastify.register(fastifyCookie);
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  await fastify.register(fastifyWebsocket);

  // Serve static public landing page at /landing/ if directory exists
  const candidateLandingPaths = [
    path.resolve(process.cwd(), 'landing'),
    path.resolve(process.cwd(), '../../landing'),
    path.resolve(__dirname, '../../../landing'),
  ];
  const validLanding = candidateLandingPaths.find((p) => fs.existsSync(p));

  if (validLanding) {
    await fastify.register(fastifyStatic, {
      root: validLanding,
      prefix: '/landing/',
    });
  }

  // Authentication decorator
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    // SECURITY: never trust the role claim from the token alone — always reload the
    // user from the database so role changes/revocations take effect immediately.
    const claims = request.user || {};
    const dbUser = await db.findUserById(claims.id || '').catch(() => null);
    if (dbUser) {
      request.user = {
        ...claims,
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        email: dbUser.username,
      };
    } else if (!claims.id) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Global Error Handler (never leak stack traces or internal secrets)
  fastify.setErrorHandler((error: any, request, reply) => {
    fastify.log.error(error);
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : error.message;
    reply.status(statusCode).send({ error: message });
  });

  // Session Manager for multi-tenant WhatsApp connections
  const sessionManager = new SessionManager();

  // Start background birthday & scheduled message delivery engine
  startMessageScheduler(sessionManager);

  // Register Routes
  registerHealthRoutes(fastify, sessionManager);
  registerAuthRoutes(fastify);
  registerWhatsAppRoutes(fastify, sessionManager);
  registerCommandRoutes(fastify);
  registerAutoReplyRoutes(fastify);
  registerSettingsRoutes(fastify);
  registerLogRoutes(fastify);
  registerPaymentRoutes(fastify, sessionManager);
  registerScheduledMessageRoutes(fastify);
  registerWebSocketGateway(fastify, sessionManager);

  return { fastify, sessionManager };
}
