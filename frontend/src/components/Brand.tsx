import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
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
