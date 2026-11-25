import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSession } from '../../state/SessionContext';
import { Alert } from '../../components/Alert';
import { PasswordInput } from '../../components/PasswordInput';
import { AuthShell } from '../../layouts/AuthShell';
import { ApiError } from '../../api/client';
import { errorText } from '../../utils/errors';
import { GuestEntry } from './GuestEntry';
import { StrengthMeter } from '../../components/StrengthMeter';
import { passwordStrong } from '../../utils/passwordStrength';

export function Register() {
  const { register } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      <GuestEntry />
      <p className="auth-switch">
        Já tem uma conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthShell>
  );
}
