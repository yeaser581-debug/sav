'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/session';

export default function ActivationHeader() {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
          <span className="text-background text-[10px] font-bold tracking-wider">AS</span>
        </div>
        <p className="text-foreground font-semibold text-sm">After-Sales</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logout()}
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-3.5 w-3.5" />
        Déconnexion
      </Button>
    </div>
  );
}
