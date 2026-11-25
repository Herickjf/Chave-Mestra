import type { RequestHandler } from 'express';
import { SESSION_COOKIE_NAME, type SessionService } from '../services/session.service.js';

export function createAuthMiddleware(sessions: SessionService): RequestHandler {
  return (request, response, next) => {
    void sessions
      .findActive(request.cookies?.[SESSION_COOKIE_NAME])
      .then((session) => {
        if (!session) {
          response.status(401).json({ error: 'unauthorized' });
          return;
        }

        response.locals.userId = session.user_id;
        response.locals.email = session.email;
        next();
      })
      .catch(next);
  };
}
