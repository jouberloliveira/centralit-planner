import { z } from 'zod';

const WEAK_SECRET_MARKERS = ['change', 'default', 'example', 'placeholder', 'secret-please'];

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥32 chars and never defaulted'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGIN: z
      .string()
      .min(1, 'CORS_ORIGIN is required (comma-separated list of full origins, e.g. https://app.example.com)')
      .refine(
        (v) => !v.split(',').map((s) => s.trim()).includes('*'),
        'CORS_ORIGIN=* is forbidden: the API sends credentials, so an explicit allow-list is required',
      ),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;
    const lowered = data.JWT_SECRET.toLowerCase();
    if (WEAK_SECRET_MARKERS.some((marker) => lowered.includes(marker))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'JWT_SECRET appears to be a development placeholder (contains change/default/example/placeholder). Refusing to start in production. Generate one via `openssl rand -base64 48`.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
