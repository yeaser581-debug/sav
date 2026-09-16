import { Ban, Check, CheckCheck, Contrast, RotateCcw, type LucideIcon } from 'lucide-react';

// Statuses share four colour families. Inside a family, the icon and the weight
// tell the states apart — never a new hue.
type Family = 'neutral' | 'warning' | 'success';

const FAMILY: Record<Family, string> = {
  neutral: 'bg-neutral-wash text-neutral',
  warning: 'bg-warning-wash text-warning',
  success: 'bg-success-wash text-success',
};

const STATUS: Record<string, { label: string; family: Family; icon: LucideIcon | null; weight: string }> = {
  PENDING_AGENT: { label: 'Nouvelle', family: 'neutral', icon: null, weight: 'font-bold' },
  REJECTED: { label: 'Rejetée', family: 'neutral', icon: Ban, weight: 'font-medium' },
  IN_PROGRESS: { label: 'En cours', family: 'warning', icon: Contrast, weight: 'font-bold' },
  DISPUTED: { label: 'Contestée', family: 'warning', icon: RotateCcw, weight: 'font-bold' },
  RESOLVED: { label: 'Résolue', family: 'success', icon: Check, weight: 'font-medium' },
  CONFIRMED: { label: 'Confirmée', family: 'success', icon: CheckCheck, weight: 'font-bold' },
};

export function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status];
  if (!s) {
    return <span className="text-xs font-semibold text-muted-foreground">{status}</span>;
  }

  const Icon = s.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs whitespace-nowrap ${FAMILY[s.family]} ${s.weight}`}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
      )}
      {s.label}
    </span>
  );
}
