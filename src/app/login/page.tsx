'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Eye, EyeOff, Loader2, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LIMITS } from '@/lib/limits';

// What the app actually does, in the order a resident experiences it. This is
// the panel's whole content: no figures nobody measured.
const STEPS = [
  { title: 'Vous déclarez', detail: 'Photos, vidéo ou message vocal, depuis votre téléphone.' },
  { title: 'Un agent intervient', detail: 'Vous suivez l’avancement et la date de visite.' },
  { title: 'Vous confirmez', detail: 'La réparation n’est close que si vous la validez.' },
];

const ENTRY_ERRORS: Record<string, string> = {
  invalid_token: 'QR code invalide ou expiré.',
  missing_token: 'Token manquant.',
  rate_limited: 'Trop de tentatives. Réessayez dans quelques minutes.',
  disabled: 'Votre compte a été désactivé. Contactez un administrateur.',
  qr_used: 'Ce QR code a déjà été utilisé. Connectez-vous avec votre identifiant et votre mot de passe, ou demandez un nouveau code à votre gestionnaire.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(ENTRY_ERRORS[params.get('error') ?? ''] ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Identifiant ou mot de passe incorrect.');
        return;
      }
      // The server decides the role from the identifier; the page follows.
      router.push(`/${data.user.role}`);
      router.refresh();
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <form onSubmit={submit} className="flex w-full flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="identifier">Identifiant ou email</Label>
        <Input
          id="identifier"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={LIMITS.email}
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          placeholder="gz-t1-0-a-a-00 ou nom@exemple.com"
          className="h-11 font-mono text-sm"
        />
        <p className="text-[11.5px] text-muted-foreground">
          Résidents : le numéro de votre logement, tel qu’il figure sur votre fiche.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <div className="relative">
          <Input
            id="password"
            required
            type={reveal ? 'text' : 'password'}
            autoComplete="current-password"
            maxLength={LIMITS.password}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            aria-label={reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive-wash px-3 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 gap-2 text-[15px]">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Connexion…' : 'Se connecter'}
      </Button>

      <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
        <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <span className="block font-semibold text-foreground">Première connexion ?</span>
          Scannez le code QR remis par le promoteur.
        </span>
      </div>

      <Link href="/login/forgot" className="text-center text-[13px] text-primary hover:underline">
        Mot de passe oublié
      </Link>
    </form>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop only: what the service is, for someone opening it the first time. */}
      <aside className="hidden w-[42%] max-w-xl flex-col justify-between bg-foreground p-12 text-background lg:flex">
        <div>
          <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-background">
            <span className="text-sm font-extrabold tracking-wider text-foreground">AS</span>
          </div>
          <h1 className="max-w-[18ch] text-3xl font-bold leading-tight tracking-tight">
            Le suivi de vos réclamations, du signalement à la réparation.
          </h1>
          <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-background/70">
            Déclarez un désordre dans votre logement, suivez son traitement et échangez avec l’équipe,
            au même endroit.
          </p>
        </div>

        <ol className="flex flex-col gap-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-background/12 text-xs font-bold">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">{step.title}</span>
                <span className="text-xs text-background/70">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground">
              <span className="text-sm font-extrabold tracking-wider text-background">AS</span>
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-foreground">After-Sales</h1>
              <p className="text-sm text-muted-foreground">Service après-vente immobilier</p>
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="text-xl font-bold tracking-tight">Connexion</h2>
            <p className="mt-1 text-sm text-muted-foreground">Résidents, agents et administration.</p>
          </div>

          {form}
        </div>
      </main>
    </div>
  );
}
