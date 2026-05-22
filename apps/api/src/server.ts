import Fastify from 'fastify';
import type { HealthResponse } from '@centralit/shared';

const app = Fastify({ logger: true });

app.get('/health', async (): Promise<HealthResponse> => {
  return { status: 'ok', service: 'centralit-planner-api', timestamp: new Date().toISOString() };
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`API listening on http://${host}:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
