import { Router, type RequestHandler } from 'express';
import type { VaultService } from '../services/vault.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidSchema } from '../validation/shared.schemas.js';
import { createItemSchema, updateItemSchema } from '../validation/vault.schemas.js';

export function createVaultRouter(vault: VaultService, requireAuth: RequestHandler) {
  const router = Router();

  router.get(
    '/items',
    requireAuth,
    asyncHandler(async (_request, response) => {
      response.json(await vault.list(response.locals.userId));
    }),
  );

  router.post(
    '/items',
    requireAuth,
    asyncHandler(async (request, response) => {
      const item = await vault.create(response.locals.userId, createItemSchema.parse(request.body));
      response.status(201).json(item);
    }),
  );

  router.get(
    '/items/:id',
    requireAuth,
    asyncHandler(async (request, response) => {
      const itemId = uuidSchema.parse(request.params.id);
      response.json(await vault.find(response.locals.userId, itemId));
    }),
  );

  router.put(
    '/items/:id',
    requireAuth,
    asyncHandler(async (request, response) => {
      const itemId = uuidSchema.parse(request.params.id);
      const data = updateItemSchema.parse(request.body);
      response.json(await vault.update(response.locals.userId, itemId, data));
    }),
  );

  router.delete(
    '/items/:id',
    requireAuth,
    asyncHandler(async (request, response) => {
      const itemId = uuidSchema.parse(request.params.id);
      await vault.remove(response.locals.userId, itemId);
      response.status(204).end();
    }),
  );

  return router;
}
