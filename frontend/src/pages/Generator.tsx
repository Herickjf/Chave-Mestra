import { useState } from 'react';
import { ChevronRight, Copy, ShieldCheck, Shuffle } from 'lucide-react';
import { defaultGenerator, generatePassword, type GeneratorOptions } from '../crypto/generator';
import { Alert } from '../components/Alert';
import { errorText } from '../utils/errors';
import { copySecret } from '../utils/clipboard';

export function Generator() {
  const [options, setOptions] = useState<GeneratorOptions>(defaultGenerator);
  const [result, setResult] = useState(() => generatePassword(defaultGenerator));
  const [message, setMessage] = useState('');
  const update = (key: keyof GeneratorOptions, value: boolean | number) =>
    setOptions((o) => ({ ...o, [key]: value }));
  const regenerate = () => {
    try {
      setResult(generatePassword(options));
      setMessage('');
    } catch (e) {
      setMessage(errorText(e));
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CRIE COM CONFIANÇA</span>
          <h1>
            Gerador de senhas<span className="heading-star">✳</span>
          </h1>
          <p>Senhas únicas e fortes, criadas com aleatoriedade segura.</p>
        </div>
      </div>
      <div className="generator-grid">
        <section className="panel generator-result">
          <div className="round-icon">
            <Shuffle size={24} />
          </div>
          <span className="eyebrow">SENHA GERADA</span>
          <div className="generated-password">{result.password}</div>
          <div className="generator-actions">
            <button
              className="button primary"
              onClick={() => copySecret(result.password, setMessage)}
            >
              <Copy size={18} /> Copiar senha
            </button>
            <button className="button secondary" onClick={regenerate}>
              <Shuffle size={18} /> Gerar outra
            </button>
          </div>
          <div className="entropy">
            <ShieldCheck size={18} /> Entropia estimada: {result.entropy} bits
          </div>
          {message && <Alert kind="success">{message}</Alert>}
        </section>
        <section className="panel generator-options">
          <h2>Personalize sua senha</h2>
          <p className="muted">Ajuste o comprimento e os tipos de caracteres.</p>
          <label className="range-label">
            Comprimento <strong>{options.length} caracteres</strong>
            <input
              type="range"
              min="8"
              max="128"
              value={options.length}
              onChange={(e) => update('length', Number(e.target.value))}
            />
          </label>
          <div className="option-list">
            {(
              [
                ['lower', 'Letras minúsculas', 'a b c'],
                ['upper', 'Letras maiúsculas', 'A B C'],
                ['digits', 'Números', '1 2 3'],
                ['symbols', 'Símbolos', '! @ #'],
                ['excludeAmbiguous', 'Evitar caracteres parecidos', '0 O l I'],
              ] as const
            ).map(([key, label, hint]) => (
              <label className="option-row" key={key}>
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => update(key, e.target.checked)}
                />
              </label>
            ))}
          </div>
          <button className="button primary full" onClick={regenerate}>
            Aplicar opções <ChevronRight size={18} />
          </button>
        </section>
      </div>
    </>
  );
}
