/** Erro esperado da API. Apenas o código público é enviado ao cliente. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'HttpError';
  }
}
