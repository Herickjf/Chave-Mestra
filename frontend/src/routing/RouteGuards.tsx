import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import { useAutoLock } from '../state/useAutoLock';
import { AppShell } from '../layouts/AppShell';
import { LockScreen } from '../pages/auth/LockScreen';

export function Guard({ children }: { children: ReactNode }) {
  const { session } = useSession();
  useAutoLock();
  if (session.status === 'loading') return <div className="loading-screen">Abrindo Chave Mestra…</div>;
  if (session.status === 'anonymous') return <Navigate to="/login" replace />;
  if (session.status === 'locked') return <LockScreen />;
  return <AppShell>{children}</AppShell>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (session.status === 'loading') return <div className="loading-screen">Abrindo Chave Mestra…</div>;
  if (session.status === 'unlocked' || session.status === 'guest')
    return <Navigate to="/vault" replace />;
  if (session.status === 'locked') return <LockScreen />;
  return <>{children}</>;
}
