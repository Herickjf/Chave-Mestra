import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ApiError } from '../api/client';
import { useSession } from '../state/SessionContext';
import {
  Alert,
  AuthShell,
  PasswordInput,
  StrengthMeter,
  errorText,
  passwordStrong,
} from '../components/Common';

export function Register() {
  const { register } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordStrong(password) || password !== confirm || !ack) return;
    setBusy(true);
    setError('');
    try {
      await register(email.trim(), password);
      navigate('/vault');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Este e-mail já está cadastrado.'
          : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell
      title="Crie seu cofre"
      subtitle="Uma senha mestra é tudo de que você precisa para começar."
    >
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
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="Crie uma senha mestra forte"
          />
        </label>
        <StrengthMeter value={password} />
        <label>
          Confirme a senha
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            placeholder="Repita sua senha mestra"
          />
        </label>
        <label className="check-line">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />{' '}
          <span>
            Entendo que, se perder minha senha mestra, meus dados não poderão ser recuperados.
          </span>
        </label>
        {error && <Alert>{error}</Alert>}
        <button
          className="button primary full"
          disabled={busy || !passwordStrong(password) || password !== confirm || !ack}
        >
          {busy ? 'Criando seu cofre…' : 'Criar meu cofre'} <ChevronRight size={18} />
        </button>
      </form>
      <p className="auth-switch">
        Já tem uma conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthShell>
  );
}
export function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
      <p className="auth-switch">
        Primeira vez aqui? <Link to="/register">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
export function LockScreen() {
  const { unlock, logout } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
