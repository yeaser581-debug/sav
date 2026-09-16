'use client';

import { useState } from 'react';
import Link from 'next/link';

type Step = 'email' | 'otp' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStep('otp');
    } catch {
      setError('Erreur lors de l\'envoi du code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Code invalide.');
        return;
      }
      setStep('done');
    } catch {
      setError('Erreur serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Mot de passe oublié</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === 'email' && 'Entrez votre email pour recevoir un code.'}
            {step === 'otp' && `Code envoyé à ${email}`}
            {step === 'done' && 'Mot de passe mis à jour !'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">

          <div className="flex items-center justify-center gap-2 mb-8">
            {(['email', 'otp', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s ? 'bg-primary text-primary-foreground' :
                  (['email', 'otp', 'done'].indexOf(step) > i) ? 'bg-accent text-accent-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                {i < 2 && <div className={`w-8 h-px ${['email', 'otp', 'done'].indexOf(step) > i ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {step === 'email' && (
            <form onSubmit={sendOTP} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="exemple@aftersales.com"
                  className="w-full bg-transparent border border-input rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition"
                />
              </div>
              {error && <p className="text-destructive text-sm bg-destructive-wash border border-destructive/30 rounded-xl px-4 py-3">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary disabled:opacity-60 text-foreground font-semibold py-3 rounded-xl transition">
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOTP} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Code à 6 chiffres</label>
                <input
                  type="text" required maxLength={6} value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-transparent border border-input rounded-xl px-4 py-3 text-foreground text-center text-2xl tracking-widest placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nouveau mot de passe</label>
                <input
                  type="password" required value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  className="w-full bg-transparent border border-input rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition"
                />
              </div>
              {error && <p className="text-destructive text-sm bg-destructive-wash border border-destructive/30 rounded-xl px-4 py-3">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary disabled:opacity-60 text-foreground font-semibold py-3 rounded-xl transition">
                {loading ? 'Vérification...' : 'Réinitialiser'}
              </button>
              <button type="button" onClick={() => setStep('email')}
                className="w-full text-muted-foreground hover:text-foreground text-sm transition">
                ← Changer d'email
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-wash border border-success/30">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-foreground">Votre mot de passe a été mis à jour avec succès.</p>
              <Link href="/login"
                className="block w-full bg-primary hover:bg-primary text-foreground font-semibold py-3 rounded-xl transition text-center">
                Se connecter
              </Link>
            </div>
          )}
        </div>

        <p className="text-center mt-6">
          <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm transition">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
