import { useNavigate } from 'react-router-dom';
import { LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { useSession } from '../../state/SessionContext';
import { ChangePasswordForm } from './ChangePasswordForm';
import { GuestSettings } from './GuestSettings';

export function Settings() {
  const { session, lockMinutes, setLockMinutes, lock, logout } = useSession();
  const navigate = useNavigate();
  if (session.status === 'guest') return <GuestSettings />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>
            Configurações<span className="heading-star">✳</span>
          </h1>
          <p>Controle seu acesso e mantenha seu cofre protegido.</p>
        </div>
      </div>
      <div className="settings-grid">
        <ChangePasswordForm />
        <div className="settings-side">
          <section className="panel settings-panel">
            <div className="section-heading">
              <span className="round-icon">
                <LockKeyhole size={22} />
              </span>
              <div>
                <h2>Bloqueio automático</h2>
                <p className="muted">Escolha o tempo de inatividade.</p>
              </div>
            </div>
            <div className="segment">
              {[1, 5, 15].map((value) => (
                <button
                  key={value}
                  className={lockMinutes === value ? 'active' : ''}
                  onClick={() => setLockMinutes(value)}
                >
                  {value} min
                </button>
              ))}
            </div>
            <button className="button secondary full" onClick={lock}>
              <LockKeyhole size={17} /> Bloquear agora
            </button>
          </section>
          <section className="panel settings-panel">
            <div className="section-heading">
              <span className="round-icon">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h2>Sua sessão</h2>
                <p className="muted">{session.status === 'unlocked' ? session.email : ''}</p>
              </div>
            </div>
            <button
              className="button secondary full"
              onClick={() => {
                void logout();
                navigate('/login');
              }}
            >
              <LogOut size={17} /> Sair da conta
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
