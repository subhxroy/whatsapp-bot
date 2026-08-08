import path from 'path';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { getEnv } from '@private-md-bot/config';
import { WhatsAppClient } from '@private-md-bot/whatsapp';
import { CommandDispatcher } from '@private-md-bot/commands';

import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerWhatsAppRoutes } from './routes/whatsapp';
import { registerCommandRoutes } from './routes/commands';
import { registerAutoReplyRoutes } from './routes/autoreply';
import { registerSettingsRoutes } from './routes/settings';
import { registerLogRoutes } from './routes/logs';
import { registerPaymentRoutes } from './routes/payment';
import { registerWebSocketGateway } from './websocket';
import { startMessageScheduler } from './scheduler';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export async function buildServer() {
  const env = getEnv();

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

  // Serve static public landing page at /landing/
  const landingPath = path.resolve(process.cwd(), 'landing');
  await fastify.register(fastifyStatic, {
    root: landingPath,
    prefix: '/landing/',
  });

  // Authentication decorator
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
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

  // WhatsApp Client & Dispatcher initialization
  const waClient = new WhatsAppClient();
  const dispatcher = new CommandDispatcher(waClient);

  waClient.onMessage(async (msg) => {
    await dispatcher.handleMessage(msg);
  });

  // Start background birthday & scheduled message delivery engine
  startMessageScheduler(waClient);

  // Register Routes
  registerHealthRoutes(fastify, waClient);
  registerAuthRoutes(fastify);
  registerWhatsAppRoutes(fastify, waClient);
  registerCommandRoutes(fastify);
  registerAutoReplyRoutes(fastify);
  registerSettingsRoutes(fastify);
  registerLogRoutes(fastify);
  registerPaymentRoutes(fastify);
  registerWebSocketGateway(fastify, waClient);

  return { fastify, waClient };
}
