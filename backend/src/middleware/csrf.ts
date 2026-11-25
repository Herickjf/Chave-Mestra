import type { RequestHandler } from 'express';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const requireRequestedWith: RequestHandler = (request, response, next) => {
  if (
    MUTATING_METHODS.includes(request.method) &&
    request.get('X-Requested-With') !== 'vaultzero'
  ) {
    response.status(403).json({ error: 'invalid_request' });
    return;
  }

  next();
};
