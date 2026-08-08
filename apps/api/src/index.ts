import { buildServer } from './server';
import { getEnv } from '@private-md-bot/config';

async function main() {
  const env = getEnv();
  const { fastify, sessionManager } = await buildServer();

  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Fastify API Server running on port ${env.PORT}`);

    // Auto-connect all approved users' WhatsApp sessions
    sessionManager.connectAllApproved().catch((err) => console.error('Startup session connect failed:', err));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
