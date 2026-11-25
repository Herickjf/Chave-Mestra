import { z } from 'zod';
import { bytesSchema, emailSchema, ivSchema, uuidSchema } from './shared.schemas.js';

const authKey = bytesSchema(32);
const salt = bytesSchema(16);
const iterations = z.number().int().min(600000).max(5000000);
const wrappedKey = bytesSchema(undefined, 128).refine(
  (value) => Buffer.from(value, 'base64url').length >= 48,
);

export const registerSchema = z
  .object({
    id: uuidSchema,
    email: emailSchema,
    authKey,
    kdfSalt: salt,
    kdfIterations: iterations,
    wrappedVaultKey: wrappedKey,
    wrappedVaultIv: ivSchema,
  })
  .strict();

export const loginSchema = z.object({ email: emailSchema, authKey }).strict();
export const preloginSchema = z.object({ email: emailSchema }).strict();

export const changePasswordSchema = z
  .object({
    currentAuthKey: authKey,
    newAuthKey: authKey,
    newKdfSalt: salt,
    newKdfIterations: iterations,
    newWrappedVaultKey: wrappedKey,
    newWrappedVaultIv: ivSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
