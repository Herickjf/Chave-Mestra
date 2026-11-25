import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { PasswordInput } from '../../components/PasswordInput';
import { StrengthMeter } from '../../components/StrengthMeter';
import { errorText } from '../../utils/errors';
import { passwordStrong } from '../../utils/passwordStrength';
import { useSession } from '../../state/SessionContext';

export function ChangePasswordForm() {
  const { changePassword } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
  );
}
