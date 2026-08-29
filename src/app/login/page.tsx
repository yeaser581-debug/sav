'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Home,
  HardHat,
  Shield,
  Building2,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';

type Role = 'admin' | 'agent' | 'client';

// ─── Role config ────────────────────────────────────────────────────────────
const roleConfig = {
  client: { label: 'Client', Icon: Home },
  agent: { label: 'Agent', Icon: HardHat },
  admin: { label: 'Admin', Icon: Shield },
} satisfies Record<Role, { label: string; Icon: React.ElementType }>;

const roles: Role[] = ['client', 'agent', 'admin'];

// ─── Stats for left panel ────────────────────────────────────────────────────
const stats = [
  { value: '200+', label: 'Résidences gérées' },
  { value: '98%', label: 'Satisfaction client' },
  { value: '5k+', label: 'Tickets traités' },
];

// ─── Decorative grid SVG (subtle dot grid) ───────────────────────────────────
function DotGrid() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.06]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
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
  const errorParam = params.get('error');

  const [role, setRole] = useState<Role>('client');
  const [form, setForm] = useState({ email: '', login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === 'invalid_token'
      ? 'QR code invalide ou expiré.'
      : errorParam === 'missing_token'
      ? 'Token manquant.'
      : errorParam === 'disabled'
      ? 'Votre compte a été désactivé. Contactez un autre administrateur.'
      : errorParam === 'qr_used'
      ? 'Ce QR code a déjà été utilisé. Connectez-vous avec votre identifiant et mot de passe, ou demandez un nouveau code à votre gestionnaire.'
      : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint =
        role === 'client' ? '/api/auth/client-login' : '/api/auth/login';
      const body =
        role === 'client'
          ? { login: form.login, password: form.password }
          : { email: form.email, password: form.password, role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Identifiants invalides');
        return;
      }

      router.push(`/${data.user.role}`);
      router.refresh();
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[40%] relative flex-col justify-between p-12 overflow-hidden bg-foreground text-background">
        {/* Dot grid */}
        <DotGrid />

        {/* Top: Logo + brand */}
        <div className="relative z-10">
          {/* AS monogram */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-8">
            <span className="text-foreground text-2xl font-black tracking-tight select-none">AS</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight mb-3">
            After-Sales
          </h1>
          <p className="text-lg text-background/70 font-medium leading-snug max-w-xs">
            Gestion du service<br />après-vente immobilier
          </p>

          {/* Divider */}
          <div className="mt-8 mb-8 h-px w-16 bg-background/30" />

          {/* Description */}
          <p className="text-sm text-background/50 max-w-xs leading-relaxed">
            Plateforme unifiée pour les résidences, les équipes terrain et l&apos;administration.
          </p>
        </div>

        {/* Bottom: stats */}
        <div className="relative z-10 space-y-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 p-4 rounded-xl bg-background/5 border border-background/10"
            >
              <Building2 className="w-5 h-5 text-background/60 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="text-xs text-background/50 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="relative w-full max-w-md">
          {/* Mobile-only logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-foreground mb-4">
              <span className="text-background text-xl font-black tracking-tight">AS</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">After-Sales Platform</h1>
            <p className="text-sm text-muted-foreground mt-1">Service après-vente immobilier</p>
          </div>

          {/* Form card */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-xl font-bold text-foreground">Connexion</h2>
              <p className="text-sm text-muted-foreground mt-1">Sélectionnez votre profil pour continuer</p>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-3 gap-2 mb-7 p-1 bg-muted rounded-xl border border-border">
              {roles.map((r) => {
                const { label, Icon } = roleConfig[r];
                const isActive = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setError(''); }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Identifier field */}
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">
                  {role === 'client' ? 'Identifiant client' : 'Adresse email'}
                </Label>
                {role === 'client' ? (
                  <Input
                    type="text"
                    required
                    value={form.login}
                    onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                    placeholder="ex: ahmed.alami"
                    className="h-11"
                  />
                ) : (
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="exemple@aftersales.com"
                    className="h-11"
                  />
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Mot de passe</Label>
                <Input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="h-11"
                />
              </div>

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 font-semibold text-sm tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connexion…
                  </>
                ) : (
                  <>
                    Se connecter
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </form>

            {/* Forgot password — staff only */}
            {role !== 'client' && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                <Link
                  href="/login/forgot"
                  className="text-foreground hover:underline underline-offset-4"
                >
                  Mot de passe oublié ?
                </Link>
              </p>
            )}

            {/* QR hint — clients only */}
            {role === 'client' && (
              <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
                Vous pouvez aussi scanner votre{' '}
                <span className="text-foreground">QR code</span> pour accéder directement.
              </p>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/70 mt-6">
            © {new Date().getFullYear()} After-Sales Platform · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
