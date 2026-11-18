import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PRELOGIN_SECRET: z.string().min(32),
  ALLOWED_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  SESSION_IDLE_MIN: z.coerce.number().int().min(1).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).default(8)
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return schema.parse(env);
}
export type Config = ReturnType<typeof loadConfig>;
