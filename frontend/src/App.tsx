import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './state/SessionContext';
import { useAutoLock } from './state/useAutoLock';
import { AppShell } from './components/AppShell';
import { Login, LockScreen, Register } from './pages/Auth';
import { Vault } from './pages/Vault';
import { Generator } from './pages/Generator';
import { Settings } from './pages/Settings';
import './styles.css';

function Guard({ children }: { children: ReactNode }) {
  const { session } = useSession();
  useAutoLock();
  if (session.status === 'loading') return <div className="loading-screen">Abrindo VaultZero…</div>;
  if (session.status === 'anonymous') return <Navigate to="/login" replace />;
  if (session.status === 'locked') return <LockScreen />;
  return <AppShell>{children}</AppShell>;
}
function PublicOnly({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (session.status === 'loading') return <div className="loading-screen">Abrindo VaultZero…</div>;
  if (session.status === 'unlocked') return <Navigate to="/vault" replace />;
  if (session.status === 'locked') return <LockScreen />;
  return <>{children}</>;
}
export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <Register />
              </PublicOnly>
            }
          />
          <Route
            path="/vault"
            element={
              <Guard>
                <Vault />
              </Guard>
            }
          />
          <Route
            path="/generator"
            element={
              <Guard>
                <Generator />
              </Guard>
            }
          />
          <Route
            path="/settings"
            element={
              <Guard>
                <Settings />
              </Guard>
            }
          />
          <Route path="*" element={<Navigate to="/vault" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
