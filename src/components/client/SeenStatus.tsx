'use client';

import { Eye, Clock } from 'lucide-react';
import { formatSeenAt } from '@/lib/read-state';

export function SeenStatus({
  adminLastReadAt,
  status,
  variant = 'line',
}: {
  adminLastReadAt: string | null | undefined;
  status: string;
  variant?: 'line' | 'pill';
}) {
  if (adminLastReadAt) {
    if (variant === 'pill') {
      return (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent py-1 pr-2.5 pl-2 text-xs font-semibold text-primary">
          <Eye className="h-3.5 w-3.5" />
          Vue par l&apos;administration · {formatSeenAt(adminLastReadAt)}
        </p>
      );
    }
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Eye className="h-3.5 w-3.5" />
        Vue par l&apos;administration
      </p>
    );
  }

  if (status !== 'PENDING_AGENT') return null;

  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium text-muted-foreground ${variant === 'pill' ? 'mt-2' : ''}`}>
      <Clock className="h-3.5 w-3.5" />
      Pas encore consultée
    </p>
  );
}
