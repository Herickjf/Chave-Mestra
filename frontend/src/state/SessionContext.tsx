import { createContext, useContext } from 'react';
import type { SessionContextValue } from './session.types';

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider ausente');
  return value;
}
