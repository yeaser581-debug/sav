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
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Mot de passe oublié</h1>
          <p className="text-slate-400 text-sm mt-1">
            {step === 'email' && 'Entrez votre email pour recevoir un code.'}
            {step === 'otp' && `Code envoyé à ${email}`}
            {step === 'done' && 'Mot de passe mis à jour !'}
          </p>
        </div>

        <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {(['email', 'otp', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s ? 'bg-indigo-600 text-white' :
                  (['email', 'otp', 'done'].indexOf(step) > i) ? 'bg-indigo-600/40 text-indigo-300' :
                  'bg-white/5 text-slate-500'
                }`}>
                  {i + 1}
                </div>
                {i < 2 && <div className={`w-8 h-px ${['email', 'otp', 'done'].indexOf(step) > i ? 'bg-indigo-600' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {step === 'email' && (
            <form onSubmit={sendOTP} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="exemple@aftersales.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOTP} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Code à 6 chiffres</label>
                <input
                  type="text" required maxLength={6} value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nouveau mot de passe</label>
                <input
                  type="password" required value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
                {loading ? 'Vérification...' : 'Réinitialiser'}
              </button>
              <button type="button" onClick={() => setStep('email')}
                className="w-full text-slate-500 hover:text-slate-300 text-sm transition">
                ← Changer d'email
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-slate-300">Votre mot de passe a été mis à jour avec succès.</p>
              <Link href="/login"
                className="block w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition text-center">
                Se connecter
              </Link>
            </div>
          )}
        </div>

        <p className="text-center mt-6">
          <Link href="/login" className="text-slate-500 hover:text-slate-300 text-sm transition">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
