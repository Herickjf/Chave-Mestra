import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api, type StoredItem } from '../api/client';
import { fromBase64Url, toBase64Url } from '../crypto/encoding';
import { decryptItem, encryptItem, type ItemPlain, TamperError } from '../crypto/items';
import { defaultGenerator, generatePassword } from '../crypto/generator';
import { useSession } from '../state/SessionContext';
import { Alert, errorText } from '../components/Common';
import { copySecret } from '../utils/clipboard';

const emptyItem: ItemPlain = { title: '', url: '', username: '', password: '', notes: '' };

type OpenedItem = StoredItem & { plain?: ItemPlain; tampered?: boolean };

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function Vault() {
  const { session, guestItems, saveGuestItem, deleteGuestItem } = useSession();
  if (session.status !== 'unlocked' && session.status !== 'guest') return null;
  return (
    <VaultContents
      userId={session.userId}
      vaultKey={session.vaultKey}
      guest={session.status === 'guest'}
      guestItems={guestItems}
      saveGuestItem={saveGuestItem}
      deleteGuestItem={deleteGuestItem}
    />
  );
}
function VaultContents({
  userId,
  vaultKey,
  guest,
  guestItems,
  saveGuestItem,
  deleteGuestItem,
}: {
  userId: string;
  vaultKey: CryptoKey;
  guest: boolean;
  guestItems: StoredItem[];
  saveGuestItem: (item: StoredItem) => void;
  deleteGuestItem: (id: string) => void;
}) {
  const [items, setItems] = useState<OpenedItem[]>([]),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [creating, setCreating] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [reveal, setReveal] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const stored = guest ? guestItems : await api<StoredItem[]>('/vault/items');
      const opened = await Promise.all(
        stored.map(async (item) => {
          try {
            return {
              ...item,
              plain: await decryptItem(
                { iv: fromBase64Url(item.iv), ciphertext: fromBase64Url(item.ciphertext) },
                vaultKey,
                userId,
                item.id,
              ),
            };
          } catch (e) {
            if (e instanceof TamperError) return { ...item, tampered: true };
            throw e;
          }
        }),
      );
      setItems(opened);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [userId, vaultKey]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          item.tampered ||
          `${item.plain?.title} ${item.plain?.url}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const active = items.find((item) => item.id === selected);
  const save = async (plain: ItemPlain) => {
    try {
      const id = creating ? crypto.randomUUID() : active!.id;
      const encrypted = await encryptItem(plain, vaultKey, userId, id);
      const body = {
        id,
        iv: toBase64Url(encrypted.iv),
        ciphertext: toBase64Url(encrypted.ciphertext),
        version: creating ? 1 : active!.version,
      };
      if (guest) {
        const now = new Date().toISOString();
        const stored: StoredItem = {
          ...body,
          version: creating ? 1 : active!.version + 1,
          createdAt: creating ? now : active!.createdAt,
          updatedAt: now,
        };
        saveGuestItem(stored);
        setItems((current) => [{ ...stored, plain }, ...current.filter((item) => item.id !== id)]);
      } else {
        await api(
          `/vault/items${creating ? '' : `/${id}`}`,
          creating ? 'POST' : 'PUT',
          creating ? body : { iv: body.iv, ciphertext: body.ciphertext, version: body.version },
        );
      }
      setCreating(false);
      setEditing(false);
      setSelected(id);
      setMessage('Credencial salva com segurança.');
      if (!guest) await load();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const remove = async () => {
    if (!active || !window.confirm('Excluir esta credencial? Essa ação não pode ser desfeita.'))
      return;
    try {
      if (guest) {
        deleteGuestItem(active.id);
        setItems((current) => current.filter((item) => item.id !== active.id));
      } else {
        await api(`/vault/items/${active.id}`, 'DELETE');
      }
      setSelected(null);
      setMessage('Credencial excluída.');
      if (!guest) await load();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU ESPAÇO SEGURO</span>
          <h1>
            Meu cofre<span className="heading-star">✳</span>
          </h1>
          <p>Tudo o que importa, em um só lugar. Só você pode abrir.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setCreating(true);
            setEditing(false);
            setSelected(null);
          }}
        >
          <Plus size={19} /> Nova credencial
        </button>
      </div>
      {guest && (
        <div className="guest-banner" role="status">
          <Sparkles size={19} />
          <span>
            <strong>Modo visitante.</strong> Itens cifrados só nesta aba. Sair, recarregar ou ficar
            inativo apaga o cofre sem recuperação.
          </span>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="panel vault-panel">
          <div className="panel-head">
            <div>
              <h2>Suas credenciais</h2>
              <span className="subline">
                {items.length} {items.length === 1 ? 'item protegido' : 'itens protegidos'}
              </span>
            </div>
            <span className="count-pill">{items.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="search-box">
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou site..."
              aria-label="Buscar credenciais"
            />
          </div>
          {error && <Alert>{error}</Alert>}
          {message && <Alert kind="success">{message}</Alert>}
          <div className="item-list">
            {loading ? (
              <p className="empty-state">Abrindo suas credenciais…</p>
            ) : filtered.length === 0 ? (
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
              filtered.map((item) => (
                <button
                  className={`item-row ${selected === item.id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setReveal(false);
                    setEditing(false);
                    setCreating(false);
                  }}
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
        <aside className="detail-column">
          <section className="panel detail-panel">
            {creating || (editing && active?.plain) ? (
              <ItemForm
                initial={creating ? emptyItem : active!.plain!}
                onSave={save}
                onCancel={() => {
                  setCreating(false);
                  setEditing(false);
                }}
              />
            ) : active ? (
              active.tampered ? (
                <>
                  <div className="detail-top-icon warning">!</div>
                  <h2>Item adulterado</h2>
                  <p className="muted">
                    A verificação de integridade falhou. Nenhum conteúdo deste item será exibido.
                  </p>
                  <button className="button secondary" onClick={() => void remove()}>
                    <Trash2 size={17} /> Excluir item
                  </button>
                </>
              ) : (
                <>
                  <div className="detail-top-icon">
                    {active.plain?.title.charAt(0).toUpperCase()}
                  </div>
                  <span className="eyebrow">DETALHES DA CREDENCIAL</span>
                  <h2>{active.plain?.title}</h2>
                  <p className="muted">
                    Atualizada em {new Date(active.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                  <div className="detail-field">
                    <small>SITE</small>
                    {safeUrl(active.plain?.url || '') ? (
                      <a
                        href={safeUrl(active.plain?.url || '')!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {active.plain?.url}
                      </a>
                    ) : (
                      <span>{active.plain?.url || '—'}</span>
                    )}
                  </div>
                  <div className="detail-field">
                    <small>USUÁRIO</small>
                    <span>
                      {active.plain?.username || '—'}{' '}
                      {active.plain?.username && (
                        <button
                          className="icon-button"
                          onClick={() => copySecret(active.plain!.username, setMessage)}
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
                      {reveal ? active.plain?.password : '••••••••••••'}{' '}
                      <button
                        className="icon-button"
                        onClick={() => setReveal(!reveal)}
                        aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => copySecret(active.plain!.password, setMessage)}
                        aria-label="Copiar senha"
                      >
                        <Copy size={16} />
                      </button>
                    </span>
                  </div>
                  {active.plain?.notes && (
                    <div className="detail-field">
                      <small>NOTAS</small>
                      <span className="notes-text">{active.plain.notes}</span>
                    </div>
                  )}
                  <div className="detail-actions">
                    <button className="button secondary" onClick={() => setEditing(true)}>
                      Editar
                    </button>
                    <button
                      className="icon-button delete"
                      onClick={() => void remove()}
                      aria-label="Excluir credencial"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </>
              )
            ) : (
              <div className="detail-placeholder">
                <div className="detail-top-icon">
                  <Sparkles size={26} />
                </div>
                <h2>Feito para sua paz de espírito.</h2>
                <p>Selecione uma credencial para visualizar ou adicione uma nova ao seu cofre.</p>
                <div className="mini-shield">
                  <ShieldCheck size={18} />{' '}
                  {guest ? 'Criptografado somente nesta aba' : 'Criptografado no seu navegador'}
                </div>
              </div>
            )}
          </section>
          <section className="tip-card">
            <span className="tip-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>{guest ? 'Sessão temporária' : 'Uma camada extra de cuidado'}</strong>
              <p>
                {guest
                  ? 'A inatividade encerra a visita e apaga os itens desta sessão.'
                  : 'Bloquearemos seu cofre após alguns minutos sem atividade.'}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ItemPlain;
  onSave: (item: ItemPlain) => Promise<void>;
  onCancel: () => void;
}) {
  const [item, setItem] = useState(initial),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const change = (field: keyof ItemPlain, value: string) =>
    setItem((v) => ({ ...v, [field]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(item);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="form-stack item-form">
      <span className="eyebrow">CREDENCIAL SEGURA</span>
      <h2>{initial.title ? 'Editar credencial' : 'Nova credencial'}</h2>
      <label>
        Nome
        <input
          value={item.title}
          onChange={(e) => change('title', e.target.value)}
          placeholder="Ex.: Meu e-mail"
          maxLength={120}
          required
        />
      </label>
      <label>
        Site ou URL
        <input
          value={item.url}
          onChange={(e) => change('url', e.target.value)}
          placeholder="https://exemplo.com"
          maxLength={2048}
        />
      </label>
      <label>
        Usuário
        <input
          value={item.username}
          onChange={(e) => change('username', e.target.value)}
          placeholder="seu usuário"
          maxLength={320}
        />
      </label>
      <label>
        Senha
        <div className="password-wrap">
          <input
            type={show ? 'text' : 'password'}
            autoComplete="off"
            value={item.password}
            onChange={(e) => change('password', e.target.value)}
            placeholder="Senha da conta"
            required
          />
          <button
            className="icon-button"
            type="button"
            onClick={() => setShow(!show)}
            aria-label="Mostrar ou ocultar senha"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      <button
        type="button"
        className="text-button"
        onClick={() => change('password', generatePassword(defaultGenerator).password)}
      >
        <Shuffle size={16} /> Gerar senha forte
      </button>
      <label>
        Notas
        <textarea
          value={item.notes}
          onChange={(e) => change('notes', e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Detalhes opcionais"
        />
      </label>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar credencial'}
        </button>
      </div>
    </form>
  );
}
