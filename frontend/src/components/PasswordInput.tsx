import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
