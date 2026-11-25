import type { ReactNode } from 'react';
import { Bell, Check } from 'lucide-react';
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
