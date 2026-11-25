import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { copySecret } from '../../utils/clipboard';
import { safeUrl } from '../../utils/url';
import type { OpenedItem } from './types';

type Props = {
  item: OpenedItem;
  reveal: boolean;
  onToggleReveal: () => void;
  onEdit: () => void;
  onRemove: () => Promise<void>;
  notify: (message: string) => void;
};

export function ItemDetail({ item, reveal, onToggleReveal, onEdit, onRemove, notify }: Props) {
  if (item.tampered) {
    return (
      <>
        <div className="detail-top-icon warning">!</div>
        <h2>Item adulterado</h2>
        <p className="muted">
          A verificação de integridade falhou. Nenhum conteúdo deste item será exibido.
        </p>
        <button className="button secondary" onClick={() => void onRemove()}>
          <Trash2 size={17} /> Excluir item
        </button>
      </>
    );
  }
  return (
    <>
      <div className="detail-top-icon">{item.plain?.title.charAt(0).toUpperCase()}</div>
      <span className="eyebrow">DETALHES DA CREDENCIAL</span>
      <h2>{item.plain?.title}</h2>
      <p className="muted">Atualizada em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</p>
      <div className="detail-field">
        <small>SITE</small>
        {safeUrl(item.plain?.url || '') ? (
          <a href={safeUrl(item.plain?.url || '')!} target="_blank" rel="noopener noreferrer">
            {item.plain?.url}
          </a>
        ) : (
          <span>{item.plain?.url || '—'}</span>
        )}
      </div>
      <div className="detail-field">
        <small>USUÁRIO</small>
        <span>
          {item.plain?.username || '—'}{' '}
          {item.plain?.username && (
            <button
              className="icon-button"
              onClick={() => copySecret(item.plain!.username, notify)}
              aria-label="Copiar usuário"
            >
              <Copy size={16} />
            </button>
          )}
        </span>
      </div>
      <div className="detail-field">
        <small>SENHA</small>
        <span className="password-display">
          {reveal ? item.plain?.password : '••••••••••••'}{' '}
          <button
            className="icon-button"
            onClick={onToggleReveal}
            aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className="icon-button"
            onClick={() => copySecret(item.plain!.password, notify)}
            aria-label="Copiar senha"
          >
            <Copy size={16} />
          </button>
        </span>
      </div>
      {item.plain?.notes && (
        <div className="detail-field">
          <small>NOTAS</small>
          <span className="notes-text">{item.plain.notes}</span>
        </div>
      )}
      <div className="detail-actions">
        <button className="button secondary" onClick={onEdit}>
          Editar
        </button>
        <button
          className="icon-button delete"
          onClick={() => void onRemove()}
          aria-label="Excluir credencial"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </>
  );
}
