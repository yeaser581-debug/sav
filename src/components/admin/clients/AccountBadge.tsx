import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccountBadge({ activated }: { activated: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
      activated ? 'bg-success-wash text-success' : 'bg-warning-wash text-warning',
    )}>
      <ShieldCheck className="h-3 w-3" />
      {activated ? 'Compte activé' : 'En attente d’activation'}
    </span>
  );
}
