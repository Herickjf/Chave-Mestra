import { useNavigate } from 'react-router-dom';
import { LockKeyhole, LogOut } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { useSession } from '../../state/SessionContext';

export function GuestSettings() {
  const { lockMinutes, setLockMinutes, lock } = useSession();
  const navigate = useNavigate();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MODO VISITANTE</span>
          <h1>
            Configurações<span className="heading-star">✳</span>
          </h1>
          <p>Esta sessão é local e temporária. Nenhuma conta foi criada.</p>
        </div>
      </div>
      <div className="settings-grid guest-settings">
        <section className="panel settings-panel">
          <div className="section-heading">
            <span className="round-icon">
              <LockKeyhole size={22} />
            </span>
            <div>
              <h2>Encerrar por inatividade</h2>
              <p className="muted">Após esse período, os itens temporários são apagados.</p>
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
          <Alert>Recarregar ou fechar a aba também apaga o cofre visitante.</Alert>
          <button
            className="button secondary full guest-end-button"
            onClick={() => {
              if (
                !window.confirm(
                  'Encerrar a visita? Os itens temporários serão apagados sem recuperação.',
                )
              )
                return;
              lock();
              navigate('/login');
            }}
          >
            <LogOut size={17} /> Encerrar visita
          </button>
        </section>
      </div>
    </>
  );
}
