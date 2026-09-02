'use client';

import { CloudUpload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useOutbox } from '@/hooks/useOutbox';

export function OutboxIndicator({ variant = 'row' }: { variant?: 'row' | 'icon' }) {
  const { pendingCount } = useOutbox();

  if (pendingCount === 0) return null;

  if (variant === 'icon') {
    return (
      <div className="relative flex items-center justify-center h-8 w-8 text-muted-foreground" title="En attente d'envoi">
        <CloudUpload className="h-4 w-4" />
        <Badge variant="destructive" className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center p-0 text-[10px]">
          {pendingCount}
        </Badge>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center gap-2 h-8 px-3 text-sm text-muted-foreground">
      <CloudUpload className="h-3.5 w-3.5" />
      <span>{pendingCount} en attente d&apos;envoi</span>
    </div>
  );
}
