import { Router } from 'express';
import type pg from 'pg';
import { asyncHandler } from '../utils/asyncHandler.js';

export function createHealthRouter(pool: pg.Pool) {
  const router = Router();

  router.get(
    '/health',
    asyncHandler(async (_request, response) => {
      await pool.query('SELECT 1');
      response.json({ status: 'ok' });
    }),
  );

  return router;
}
