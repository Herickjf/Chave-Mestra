import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

export function createErrorHandler(log: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.code });
      return;
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.status(400).json({ error: 'invalid_input' });
      return;
    }

    if (typeof error === 'object' && error !== null) {
      if ('type' in error && error.type === 'entity.too.large') {
        response.status(413).json({ error: 'payload_too_large' });
        return;
      }

      if ('code' in error && error.code === '23505') {
        response.status(409).json({ error: 'conflict' });
        return;
      }
    }

    log.error({ event: 'server_error', kind: error instanceof Error ? error.name : 'unknown' });
    response.status(500).json({ error: 'internal_error' });
  };
}
