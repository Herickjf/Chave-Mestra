import type { NextFunction, Request, Response } from 'express';

type AsyncHandler = (request: Request, response: Response) => Promise<void>;

/** Encaminha rejeições de handlers assíncronos ao middleware de erros do Express 4. */
export function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response)).catch(next);
  };
}
