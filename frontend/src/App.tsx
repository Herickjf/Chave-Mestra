import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './state/SessionProvider';
import { Guard, PublicOnly } from './routing/RouteGuards';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Vault } from './pages/vault/Vault';
import { Generator } from './pages/Generator';
import { Settings } from './pages/settings/Settings';
import './styles/index.css';

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
