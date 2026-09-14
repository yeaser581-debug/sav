const SEVERITY: Record<string, { label: string; text: string; dot: string; wash: string }> = {
  CRITICAL: { label: 'Urgent', text: 'text-destructive', dot: 'bg-destructive', wash: 'bg-destructive-wash' },
  MEDIUM: { label: 'Moyen', text: 'text-warning', dot: 'bg-warning', wash: 'bg-warning-wash' },
  LOW: { label: 'Faible', text: 'text-muted-foreground', dot: 'bg-muted-foreground', wash: 'bg-muted' },
};

export const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Urgent' },
  { value: 'MEDIUM', label: 'Moyen' },
  { value: 'LOW', label: 'Faible' },
];

export function severityLabel(severity: string | null | undefined): string {
  return SEVERITY[severity ?? '']?.label ?? 'Non défini';
}

export function severityAccentColor(severity: string | null): string {
  return SEVERITY[severity ?? '']?.dot ?? 'bg-muted-foreground';
}

export function SeverityBadge({ severity }: { severity: string | null }) {
  const s = SEVERITY[severity ?? ''] ?? {
    label: 'Non défini',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    wash: 'bg-muted',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1.5 pr-2 text-xs font-semibold whitespace-nowrap ${s.wash} ${s.text}`}
    >
      <span className={`block h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
