const STATUS: Record<string, { label: string; text: string; dot: string; wash: string }> = {
  PENDING_AGENT: { label: 'Nouvelle', text: 'text-muted-foreground', dot: 'bg-muted-foreground', wash: 'bg-muted' },
  IN_PROGRESS: { label: 'En cours', text: 'text-warning', dot: 'bg-warning', wash: 'bg-warning-wash' },
  RESOLVED: { label: 'Résolue', text: 'text-success', dot: 'bg-success', wash: 'bg-success-wash' },
  CONFIRMED: { label: 'Confirmée', text: 'text-primary', dot: 'bg-primary', wash: 'bg-accent' },
  DISPUTED: { label: 'Contestée', text: 'text-dispute', dot: 'bg-dispute', wash: 'bg-dispute-wash' },
  REJECTED: { label: 'Rejetée', text: 'text-closed', dot: 'bg-closed', wash: 'bg-closed-wash' },
};

export function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status];
  if (!s) {
    return <span className="text-xs font-semibold text-muted-foreground">{status}</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1.5 pr-2 text-xs font-semibold whitespace-nowrap ${s.wash} ${s.text}`}
    >
      <span className={`block h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
