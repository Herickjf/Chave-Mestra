import { z } from 'zod';
import { bytesSchema, ivSchema, uuidSchema } from './shared.schemas.js';

const ciphertext = bytesSchema(undefined, 65536).refine(
  (value) => Buffer.from(value, 'base64url').length >= 16,
);

export const createItemSchema = z
  .object({
    id: uuidSchema,
    iv: ivSchema,
    ciphertext,
    version: z.literal(1),
  })
  .strict();

export const updateItemSchema = z
  .object({
    iv: ivSchema,
    ciphertext,
    version: z.number().int().positive(),
  })
  .strict();

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
