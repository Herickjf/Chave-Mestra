import { ApiError } from '../api/client';
export const errorText = (error: unknown) =>
  error instanceof ApiError
    ? ({
        0: 'Falha de rede. Tente novamente.',
        401: 'E-mail ou senha incorretos.',
        404: 'Item não encontrado.',
        409: 'Conflito de versão. Recarregue o item.',
        429: 'Muitas tentativas. Aguarde alguns minutos.',
      }[error.status] ?? 'Não foi possível concluir a ação.')
    : error instanceof Error
      ? error.message
      : 'Ocorreu um erro.';
