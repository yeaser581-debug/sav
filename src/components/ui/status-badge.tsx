// Status isn't a category, it's a position in the ticket's lifecycle
// (En attente agent → En cours → Résolue → Confirmée), so the marker shows how far
// along it is — the same idea as SeverityBadge's bars, applied to progress instead
// of intensity. Rejected/disputed tickets left the normal flow, so they get a
// distinct "stopped" mark instead of a track that would misleadingly imply progress.
function Track({ filled, total, colorClass }: { filled: number; total: number; colorClass: string }) {
  return (
    <span className="inline-flex gap-0.75" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block w-2.5 h-1 rounded-full ${i < filled ? colorClass : 'bg-muted'}`}
        />
      ))}
    </span>
  );
}

const LINEAR: Record<string, { label: string; stage: number; text: string; bar: string }> = {
  PENDING_AGENT: { label: 'En attente agent', stage: 1, text: 'text-warning', bar: 'bg-warning' },
  IN_PROGRESS: { label: 'En cours', stage: 2, text: 'text-warning', bar: 'bg-warning' },
  RESOLVED: { label: 'Résolue', stage: 3, text: 'text-success', bar: 'bg-success' },
  CONFIRMED: { label: 'Confirmée', stage: 4, text: 'text-success', bar: 'bg-success' },
};

const EXCEPTION: Record<string, string> = {
  REJECTED: 'Rejetée',
  DISPUTED: 'Contestée',
};

export function StatusBadge({ status }: { status: string }) {
  const s = LINEAR[status];
  if (s) {
    return (
      <span className={`inline-flex items-center gap-2 text-xs font-semibold ${s.text}`}>
        <Track filled={s.stage} total={4} colorClass={s.bar} />
        {s.label}
      </span>
    );
  }

  const label = EXCEPTION[status];
  if (label) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-destructive">
        <span className="block w-1.75 h-1.75 rounded-xs bg-destructive shrink-0" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return <span className="text-xs font-semibold text-muted-foreground">{status}</span>;
}
