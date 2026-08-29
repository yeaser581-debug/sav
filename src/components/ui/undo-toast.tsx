'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';

function UndoToastContent({
  id,
  message,
  description,
  duration,
  onUndo,
}: {
  id: string | number;
  message: string;
  description?: string;
  duration: number;
  onUndo: () => void;
}) {
  const [depleted, setDepleted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDepleted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="w-full flex flex-col gap-2.5 pointer-events-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{message}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            onUndo();
            toast.dismiss(id);
          }}
          className="shrink-0 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Annuler
        </button>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: depleted ? '0%' : '100%',
            transition: `width ${duration}ms linear`,
          }}
        />
      </div>
    </div>
  );
}

export function showUndoToast({
  message,
  description,
  onUndo,
  duration = 5000,
}: {
  message: string;
  description?: string;
  onUndo: () => void;
  duration?: number;
}) {
  toast.custom(
    (id) => (
      <UndoToastContent
        id={id}
        message={message}
        description={description}
        duration={duration}
        onUndo={onUndo}
      />
    ),
    { duration }
  );
}
