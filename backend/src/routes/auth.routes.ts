import { Router, type RequestHandler } from 'express';
import type { Config } from '../config.js';
import { createAuthLimiter } from '../middleware/rateLimit.js';
import type { AuthService } from '../services/auth.service.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  type SessionService,
} from '../services/session.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  changePasswordSchema,
  loginSchema,
  preloginSchema,
  registerSchema,
} from '../validation/auth.schemas.js';

export function createAuthRouter(
  config: Config,
  auth: AuthService,
  sessions: SessionService,
  requireAuth: RequestHandler,
) {
  const router = Router();
  // Login e prelogin compartilham a mesma janela de tentativas por IP.
  const authLimiter = createAuthLimiter();

  router.post(
    '/register',
    asyncHandler(async (request, response) => {
      await auth.register(registerSchema.parse(request.body));
      response.status(201).json({});
    }),
  );

  router.post(
    '/prelogin',
    authLimiter,
    asyncHandler(async (request, response) => {
      const { email } = preloginSchema.parse(request.body);
      response.json(await auth.prelogin(email));
    }),
  );

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (request, response) => {
      const { token, account } = await auth.login(loginSchema.parse(request.body));
      response.cookie(SESSION_COOKIE_NAME, token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: config.SESSION_ABSOLUTE_HOURS * 3600000,
      });
      response.json(account);
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (_request, response) => {
      response.json(await auth.me(response.locals.userId));
    }),
  );

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (request, response) => {
      await sessions.revoke(response.locals.userId, request.cookies[SESSION_COOKIE_NAME]);
      response.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
      response.json({});
    }),
  );

  router.post(
    '/change-password',
    requireAuth,
    asyncHandler(async (request, response) => {
      await auth.changePassword(
        response.locals.userId,
        request.cookies[SESSION_COOKIE_NAME],
        changePasswordSchema.parse(request.body),
      );
      response.json({});
    }),
  );

  return router;
}
