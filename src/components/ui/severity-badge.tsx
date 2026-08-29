const BAR_HEIGHTS = ['h-[5px]', 'h-[8px]', 'h-[11px]'];

// Intensity shown as filled bars, not a color you have to learn — also works for
// anyone who can't rely on hue alone to tell severities apart.
function Bars({ filled, colorClass }: { filled: number; colorClass: string }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden="true">
      {BAR_HEIGHTS.map((h, i) => (
        <span
          key={i}
          className={`block w-0.75 rounded-[1px] ${h} ${colorClass} ${i < filled ? '' : 'opacity-25'}`}
        />
      ))}
    </span>
  );
}

const SEVERITY: Record<string, { label: string; filled: number; text: string; bar: string }> = {
  CRITICAL: { label: 'Urgent', filled: 3, text: 'text-destructive', bar: 'bg-destructive' },
  MEDIUM: { label: 'Moyen', filled: 2, text: 'text-warning', bar: 'bg-warning' },
  LOW: { label: 'Faible', filled: 1, text: 'text-muted-foreground', bar: 'bg-muted-foreground' },
};

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Bars filled={0} colorClass="bg-muted-foreground" />
        Non défini
      </span>
    );
  }

  const s = SEVERITY[severity] ?? { label: severity, filled: 0, text: 'text-muted-foreground', bar: 'bg-muted-foreground' };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <Bars filled={s.filled} colorClass={s.bar} />
      {s.label}
    </span>
  );
}
