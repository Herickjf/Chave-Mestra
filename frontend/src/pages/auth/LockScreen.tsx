import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSession } from '../../state/SessionContext';
import { Alert } from '../../components/Alert';
import { PasswordInput } from '../../components/PasswordInput';
import { AuthShell } from '../../layouts/AuthShell';
import { ApiError } from '../../api/client';

export function LockScreen() {
  const { unlock, logout } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await unlock(password);
      setPassword('');
      navigate('/vault');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        navigate('/login');
        return;
      }
      setError('Senha incorreta ou cofre corrompido.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Cofre bloqueado" subtitle="Digite sua senha mestra para continuar.">
      <form onSubmit={submit} className="form-stack">
        <label>
          Senha mestra
          <PasswordInput value={password} onChange={setPassword} />
        </label>
        {error && <Alert>{error}</Alert>}
        <button disabled={busy} className="button primary full">
          {busy ? 'Desbloqueando…' : 'Desbloquear'} <ChevronRight size={18} />
        </button>
      </form>
      <button
        className="text-button center"
        onClick={() => {
          void logout();
          navigate('/login');
        }}
      >
        Sair da conta
      </button>
    </AuthShell>
  );
}
