import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import { dictionary, adjacencyGraphs } from '@zxcvbn-ts/language-common';
import { ApiError } from '../api/client';

zxcvbnOptions.setOptions({ dictionary, graphs: adjacencyGraphs });
export const errorText = (error: unknown) =>
  error instanceof ApiError
    ? ({
        0: 'Falha de rede. Tente novamente.',
        401: 'E-mail ou senha incorretos.',
        404: 'Item não encontrado.',
        409: 'Conflito de versão. Recarregue o item.',
        429: 'Muitas tentativas. Aguarde alguns minutos.',
      }[error.status] ?? 'Não foi possível concluir a ação.')
    : error instanceof Error
      ? error.message
      : 'Ocorreu um erro.';
const strength = (password: string) => (password ? zxcvbn(password).score : 0);
export const passwordStrong = (password: string) =>
  password.length >= 12 && strength(password) >= 3;
export function Brand() {
  return (
    <Link to="/vault" className="brand" aria-label="VaultZero início">
      <span className="brand-mark">
        <LockKeyhole size={23} strokeWidth={2.4} />
      </span>
      <span>
        vault<span className="brand-blue">zero</span>
        <small>SEU COFRE, SUAS CHAVES</small>
      </span>
    </Link>
  );
}
export function StrengthMeter({ value }: { value: string }) {
  const score = strength(value);
  return (
    <div className="strength">
      <div className="strength-track">
        <span className={`strength-${value ? score + 1 : 0}`} />
      </div>
      <small>
        {value
          ? ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'][score]
          : 'Use ao menos 12 caracteres e uma senha forte'}
      </small>
    </div>
  );
}
export function Alert({
  children,
  kind = 'error',
}: {
  children: ReactNode;
  kind?: 'error' | 'success';
}) {
  return (
    <div className={`alert ${kind}`} role="status">
      {kind === 'success' ? <Check size={18} /> : <Bell size={18} />}
      {children}
    </div>
  );
}
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-layout">
      <div className="auth-intro">
        <Brand />
        <span className="eyebrow">PROTEÇÃO QUE COMEÇA COM VOCÊ</span>
        <h1>
          Seu mundo digital,
          <br />
          <em>sob seu controle.</em>
        </h1>
        <p>
          Guarde o que importa em um cofre que só você pode abrir. Criptografia no seu navegador,
          simplicidade no seu dia.
        </p>
        <div className="intro-note">
          <ShieldCheck size={22} />
          <span>Suas credenciais nunca chegam legíveis ao servidor.</span>
        </div>
      </div>
      <section className="auth-card">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="card-symbol">
          <KeyRound size={24} />
        </div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
      <footer className="auth-footer">
        VAULTZERO <span>·</span> MAIS LEVE PARA VOCÊ. MAIS DIFÍCIL PARA INTRUSOS.
      </footer>
    </main>
  );
}
export function PasswordInput({
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder = 'Sua senha mestra',
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-wrap">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        className="icon-button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
