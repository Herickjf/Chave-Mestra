import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { useSession } from '../state/SessionContext';
import {
  Alert,
  PasswordInput,
  StrengthMeter,
  errorText,
  passwordStrong,
} from '../components/Common';

export function Settings() {
  const { session, lockMinutes, setLockMinutes, changePassword, lock, logout } = useSession();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordStrong(next) || next !== confirm) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage('Senha mestra alterada. As outras sessões foram encerradas.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
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
        <section className="panel settings-panel">
          <div className="section-heading">
            <span className="round-icon">
              <KeyRound size={22} />
            </span>
            <div>
              <h2>Senha mestra</h2>
              <p className="muted">Troque sua senha sem recifrar suas credenciais.</p>
            </div>
          </div>
          <form onSubmit={submit} className="form-stack">
            <label>
              Senha atual
              <PasswordInput value={current} onChange={setCurrent} />
            </label>
            <label>
              Nova senha
              <PasswordInput
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                placeholder="Nova senha mestra"
              />
            </label>
            <StrengthMeter value={next} />
            <label>
              Confirme a nova senha
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Repita a nova senha"
              />
            </label>
            {error && <Alert>{error}</Alert>}
            {message && <Alert kind="success">{message}</Alert>}
            <button
              className="button primary"
              disabled={busy || !passwordStrong(next) || next !== confirm}
            >
              {busy ? 'Alterando…' : 'Atualizar senha mestra'}
            </button>
          </form>
        </section>
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
