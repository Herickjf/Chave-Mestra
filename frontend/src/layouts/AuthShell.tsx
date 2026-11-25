import type { ReactNode } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/Brand';
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
