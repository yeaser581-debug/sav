import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return 'à l\'instant';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} j`;

  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const SLA_HOURS: Record<string, number> = { CRITICAL: 24, MEDIUM: 72, LOW: 24 * 7 };
const FINAL_STATUSES = new Set(['RESOLVED', 'CONFIRMED', 'REJECTED']);

export function issueDeadline(
  severity: string | null | undefined,
  createdAt: string | Date | null | undefined,
  status: string
): { deadlineAt: Date; overdue: boolean } | null {
  if (!severity || !createdAt || FINAL_STATUSES.has(status)) return null;
  const hours = SLA_HOURS[severity];
  if (!hours) return null;

  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const deadlineAt = new Date(created.getTime() + hours * 3_600_000);
  return { deadlineAt, overdue: Date.now() > deadlineAt.getTime() };
}
