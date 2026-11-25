import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Shuffle } from 'lucide-react';
import type { ItemPlain } from '../../crypto/items';
import { defaultGenerator, generatePassword } from '../../crypto/generator';
export function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ItemPlain;
  onSave: (item: ItemPlain) => Promise<void>;
  onCancel: () => void;
}) {
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
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
