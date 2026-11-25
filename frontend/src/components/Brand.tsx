import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
export function Brand() {
  return (
    <Link to="/vault" className="brand" aria-label="ChaveMestra início">
      <span className="brand-mark">
        <LockKeyhole size={23} strokeWidth={2.4} />
      </span>
      <span>
        ch4ve<span className="brand-blue">mestr4</span>
        <small>SEU COFRE, SUAS CHAVES</small>
      </span>
    </Link>
  );
}
