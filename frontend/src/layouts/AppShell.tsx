import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LockKeyhole,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  ShieldCheck,
  Shuffle,
} from 'lucide-react';
import { useSession } from '../state/SessionContext';
import { Brand } from '../components/Brand';

export function AppShell({ children }: { children: ReactNode }) {
  const { lock, logout, session } = useSession();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const guest = session.status === 'guest';
  const endGuest = () => {
    if (!window.confirm('Encerrar a visita? Os itens temporários serão apagados sem recuperação.'))
      return;
    lock();
    navigate('/login');
  };
  return (
    <div className="app-layout">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Brand />
        <nav className="side-nav">
          <NavLink to="/vault" onClick={() => setMenu(false)}>
            <LockKeyhole size={19} /> Meu cofre
          </NavLink>
          <NavLink to="/generator" onClick={() => setMenu(false)}>
            <Shuffle size={19} /> Gerador
          </NavLink>
          <NavLink to="/settings" onClick={() => setMenu(false)}>
            <SettingsIcon size={19} /> Configurações
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="security-tile">
            <span className="tile-icon">
              <ShieldCheck size={20} />
            </span>
            <strong>{guest ? 'Sessão visitante' : 'Protegido por você'}</strong>
            <p>
              {guest
                ? 'Itens cifrados apenas nesta aba. Nada é enviado ao servidor.'
                : 'Seus dados são criptografados antes de sair deste dispositivo.'}
            </p>
          </div>
          <button className="side-action" onClick={guest ? endGuest : lock}>
            <LockKeyhole size={18} /> {guest ? 'Encerrar visita' : 'Bloquear cofre'}
          </button>
          {!guest && (
            <button
              className="side-action"
              onClick={() => {
                void logout();
                navigate('/login');
              }}
            >
              <LogOut size={18} /> Sair
            </button>
          )}
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <span className="topbar-crumb">VAULTZERO / ÁREA SEGURA</span>
          <div className="topbar-right">
            <span className="status-dot" /> {guest ? 'Sessão visitante' : 'Cofre desbloqueado'}{' '}
            <span className="avatar">
              {session.status === 'unlocked' ? session.email.charAt(0).toUpperCase() : 'V'}
            </span>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <nav className="bottom-nav">
          <NavLink to="/vault">
            <LockKeyhole size={21} />
            Cofre
          </NavLink>
          <NavLink to="/generator">
            <Shuffle size={21} />
            Gerador
          </NavLink>
          <NavLink to="/settings">
            <SettingsIcon size={21} />
            Ajustes
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
