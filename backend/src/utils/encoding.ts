export const fromBase64Url = (value: string): Buffer => Buffer.from(value, 'base64url');

export const toBase64Url = (value: Buffer): string => value.toString('base64url');
