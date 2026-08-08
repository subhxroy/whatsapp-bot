import { buildServer } from './server';
import { getEnv } from '@private-md-bot/config';

async function main() {
  const env = getEnv();
  const { fastify, waClient } = await buildServer();

  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Fastify API Server running on port ${env.PORT}`);

    // Auto-connect WhatsApp if session exists
    waClient.connect().catch((err) => console.error('Initial WhatsApp connection attempt failed:', err));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
