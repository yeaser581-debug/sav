import { Minus, SignalLow, SignalMedium, TriangleAlert, type LucideIcon } from 'lucide-react';

// Only the highest severity belongs to the danger family, and the danger family
// is the only one drawn as an outline. The other levels are neutral: they carry
// information without raising an alarm.
const SEVERITY: Record<string, { label: string; danger?: boolean; icon: LucideIcon; weight: string }> = {
  CRITICAL: { label: 'Urgent', danger: true, icon: TriangleAlert, weight: 'font-bold' },
  MEDIUM: { label: 'Moyen', icon: SignalMedium, weight: 'font-semibold' },
  LOW: { label: 'Faible', icon: SignalLow, weight: 'font-medium' },
};

const UNSET = { label: 'Non défini', icon: Minus, weight: 'font-medium' } as const;

export const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Urgent' },
  { value: 'MEDIUM', label: 'Moyen' },
  { value: 'LOW', label: 'Faible' },
];

export function severityLabel(severity: string | null | undefined): string {
  return SEVERITY[severity ?? '']?.label ?? UNSET.label;
}

export function severityAccentColor(severity: string | null): string {
  if (severity === 'CRITICAL') return 'bg-destructive';
  if (severity === 'MEDIUM') return 'bg-warning';
  return 'bg-muted-foreground';
}

export function SeverityBadge({ severity }: { severity: string | null }) {
  const s = SEVERITY[severity ?? ''] ?? UNSET;
  const Icon = s.icon;
  const danger = 'danger' in s && s.danger === true;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs whitespace-nowrap ${s.weight} ${
        danger
          ? 'border-[1.5px] border-destructive text-destructive'
          : 'bg-neutral-wash text-neutral'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {s.label}
    </span>
  );
}
