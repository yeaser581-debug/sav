'use client';

import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushToggle({ variant = 'row' }: { variant?: 'row' | 'card' }) {
  const { state, subscribed, busy, enable, disable } = usePushNotifications();

  if (state === 'unsupported') return null;

  if (variant === 'card') {
    if (subscribed || state === 'denied') return null;

    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent border border-border flex items-center justify-center shrink-0">
          {state === 'needs-install' ? (
            <Smartphone className="h-5 w-5 text-foreground" />
          ) : (
            <Bell className="h-5 w-5 text-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">
            {state === 'needs-install'
              ? 'Installez l’application pour les alertes'
              : 'Activer les alertes sur ce téléphone'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {state === 'needs-install'
              ? 'Sur iPhone, les notifications ne fonctionnent qu’une fois l’application ajoutée à l’écran d’accueil.'
              : 'Soyez prévenu dès qu’une réponse arrive, même application fermée.'}
          </p>
        </div>
        {state !== 'needs-install' && (
          <Button
            onClick={enable}
            disabled={busy}
            className="shrink-0 h-9 px-4 text-xs font-bold rounded-xl gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            {busy ? 'Activation…' : 'Activer'}
          </Button>
        )}
      </div>
    );
  }

  if (state === 'needs-install') return null;

  if (state === 'denied') {
    return (
      <p className="px-3 py-1.5 text-[11px] text-muted-foreground leading-relaxed">
        Notifications bloqu&eacute;es. Autorisez-les dans les r&eacute;glages de votre navigateur.
      </p>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-accent px-3 text-sm"
    >
      {subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {subscribed ? 'Désactiver les alertes' : 'Activer les alertes'}
    </Button>
  );
}
