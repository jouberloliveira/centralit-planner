import { buildApp } from './app.js';
import { prisma } from './db/client.js';
import { loadEnv } from './env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp({
    prisma,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    corsOrigin: env.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    logLevel: env.LOG_LEVEL,
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`API listening on ${address} (docs at /docs)`);
  } catch (err) {
    app.log.error({ err }, 'failed to start');
    await prisma.$disconnect();
    process.exit(1);
  }
}

void main();
