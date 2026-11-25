import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useSession } from '../../state/SessionContext';
import { Alert } from '../../components/Alert';
import { errorText } from '../../utils/errors';
export function GuestEntry() {
  const { startGuest } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const enter = async () => {
    setBusy(true);
    setError('');
    try {
      await startGuest();
      navigate('/vault');
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="guest-entry">
      <span className="guest-divider">ou</span>
      <button
        type="button"
        className="button secondary full"
        disabled={busy}
        onClick={() => void enter()}
      >
        <Sparkles size={18} /> {busy ? 'Abrindo...' : 'Continuar sem conta'}
      </button>
      <small>
        Sessão temporária neste navegador. Seus itens desaparecem ao sair, recarregar a página ou
        ficar inativo.
      </small>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
