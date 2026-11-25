import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSession } from '../../state/SessionContext';
import { Alert } from '../../components/Alert';
import { PasswordInput } from '../../components/PasswordInput';
import { AuthShell } from '../../layouts/AuthShell';
import { errorText } from '../../utils/errors';
import { GuestEntry } from './GuestEntry';

export function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/vault');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Seu cofre está a uma senha de distância.">
      <form onSubmit={submit} className="form-stack">
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="email"
            required
          />
        </label>
        <label>
          Senha mestra
          <PasswordInput value={password} onChange={setPassword} />
        </label>
        {error && <Alert>{error}</Alert>}
        <button className="button primary full" disabled={busy}>
          {busy ? 'Abrindo seu cofre…' : 'Entrar no cofre'} <ChevronRight size={18} />
        </button>
      </form>
      <GuestEntry />
      <p className="auth-switch">
        Primeira vez aqui? <Link to="/register">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
