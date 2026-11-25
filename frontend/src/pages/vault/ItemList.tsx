import { ChevronRight, KeyRound, Search } from 'lucide-react';
import { Alert } from '../../components/Alert';
import type { OpenedItem } from './types';

type Props = {
  items: OpenedItem[];
  total: number;
  query: string;
  selected: string | null;
  loading: boolean;
  error: string;
  message: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
};

export function ItemList({
  items,
  total,
  query,
  selected,
  loading,
  error,
  message,
  onQueryChange,
  onSelect,
}: Props) {
  return (
    <section className="panel vault-panel">
      <div className="panel-head">
        <div>
          <h2>Suas credenciais</h2>
          <span className="subline">
            {total} {total === 1 ? 'item protegido' : 'itens protegidos'}
          </span>
        </div>
        <span className="count-pill">{total.toString().padStart(2, '0')}</span>
      </div>
      <div className="search-box">
        <Search size={19} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por nome ou site..."
          aria-label="Buscar credenciais"
        />
      </div>
      {error && <Alert>{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      <div className="item-list">
        {loading ? (
          <p className="empty-state">Abrindo suas credenciais…</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <KeyRound size={25} />
            </div>
            <strong>{query ? 'Nenhum resultado' : 'Seu cofre está pronto'}</strong>
            <p>
              {query
                ? 'Tente outro termo de busca.'
                : 'Adicione sua primeira credencial para começar.'}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <button
              className={`item-row ${selected === item.id ? 'selected' : ''}`}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <span className="item-icon">
                {item.tampered ? '!' : item.plain?.title.charAt(0).toUpperCase() || '•'}
              </span>
              <span className="item-label">
                <strong>{item.tampered ? 'Item adulterado' : item.plain?.title}</strong>
                <small>
                  {item.tampered
                    ? 'Não é possível decifrar este item'
                    : item.plain?.url || item.plain?.username}
                </small>
              </span>
              {item.tampered && <span className="tamper-badge">Adulterado</span>}
              <ChevronRight size={18} />
            </button>
          ))
        )}
      </div>
    </section>
  );
}
