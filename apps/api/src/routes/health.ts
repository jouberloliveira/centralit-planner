import type { FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from '@centralit/shared';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe',
        response: { 200: healthResponseSchema },
      },
    },
    async (): Promise<HealthResponse> => ({
      status: 'ok',
      service: 'centralit-planner-api',
      timestamp: new Date().toISOString(),
    }),
  );
}
