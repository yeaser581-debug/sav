import { issueDeadline } from '@/lib/utils';

export function OverdueTag({
  severity,
  createdAt,
  status,
  variant = 'tag',
}: {
  severity: string | null | undefined;
  createdAt: string | Date | null | undefined;
  status: string;
  variant?: 'tag' | 'full';
}) {
  const info = issueDeadline(severity, createdAt, status);
  if (!info) return null;

  if (variant === 'full') {
    const formatted = info.deadlineAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return (
      <p className={`text-xs font-medium mt-1.5 ${info.overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
        {info.overdue ? 'En retard depuis le ' : 'Échéance : '}{formatted}
      </p>
    );
  }

  if (!info.overdue) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-destructive px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-destructive">
      En retard
    </span>
  );
}
