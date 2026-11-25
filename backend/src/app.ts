import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type pg from 'pg';
import pino from 'pino';
import type { Config } from './config.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { requireRequestedWith } from './middleware/csrf.js';
import { createErrorHandler } from './middleware/errors.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createVaultRouter } from './routes/vault.routes.js';
import { createAuthService } from './services/auth.service.js';
import { createSessionService } from './services/session.service.js';
import { createVaultService } from './services/vault.service.js';

/** Compõe a aplicação; regras de negócio e SQL ficam em services/. */
export async function createApp(config: Config, pool: pg.Pool) {
  const app = express();
  const log = pino({ redact: ['req.headers.cookie', 'req.headers.authorization'] });
  const sessions = createSessionService(config, pool);
  const auth = await createAuthService(config, pool, sessions, log);
  const vault = createVaultService(pool);
  const requireAuth = createAuthMiddleware(sessions);

  // Caddy e Nginx são os dois proxies entre o navegador e a API.
  app.set('trust proxy', 2);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  app.use(cors({ origin: config.ALLOWED_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.use(requireRequestedWith);

  app.use('/api', createHealthRouter(pool));
  app.use('/api/auth', createAuthRouter(config, auth, sessions, requireAuth));
  app.use('/api/vault', createVaultRouter(vault, requireAuth));
  app.use(createErrorHandler(log));

  return app;
}
