import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

/** Aceita apenas base64url canônico e verifica o tamanho dos bytes decodificados. */
export function bytesSchema(length?: number, max?: number) {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine((value) => {
      const decoded = Buffer.from(value, 'base64url');

      return (
        decoded.toString('base64url') === value &&
        (length === undefined || decoded.length === length) &&
        (max === undefined || decoded.length <= max)
      );
    }, 'invalid_base64url');
}

export const ivSchema = bytesSchema(12);
