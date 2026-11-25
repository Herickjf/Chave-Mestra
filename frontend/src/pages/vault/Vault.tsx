import { Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useSession } from '../../state/SessionContext';
import { ItemDetail } from './ItemDetail';
import { ItemForm } from './ItemForm';
import { ItemList } from './ItemList';
import { emptyItem, type VaultSession } from './types';
import { useVault } from './useVault';

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

function VaultContents(props: VaultSession) {
  const { guest } = props;
  const vault = useVault(props);
  const selectItem = (id: string) => {
    vault.setSelected(id);
    vault.setReveal(false);
    vault.setEditing(false);
    vault.setCreating(false);
  };
  const cancelEditing = () => {
    vault.setCreating(false);
    vault.setEditing(false);
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
            vault.setCreating(true);
            vault.setEditing(false);
            vault.setSelected(null);
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
        <ItemList
          items={vault.filtered}
          total={vault.items.length}
          query={vault.query}
          selected={vault.selected}
          loading={vault.loading}
          error={vault.error}
          message={vault.message}
          onQueryChange={vault.setQuery}
          onSelect={selectItem}
        />
        <aside className="detail-column">
          <section className="panel detail-panel">
            {vault.creating || (vault.editing && vault.active?.plain) ? (
              <ItemForm
                initial={vault.creating ? emptyItem : vault.active!.plain!}
                onSave={vault.save}
                onCancel={cancelEditing}
              />
            ) : vault.active ? (
              <ItemDetail
                item={vault.active}
                reveal={vault.reveal}
                onToggleReveal={() => vault.setReveal(!vault.reveal)}
                onEdit={() => vault.setEditing(true)}
                onRemove={vault.remove}
                notify={vault.setMessage}
              />
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
