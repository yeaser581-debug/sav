'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IssueFileUpload, type UploadedMedia } from '@/components/client/IssueFileUpload';
import { showUndoToast } from '@/components/ui/undo-toast';
import { outboxFetch } from '@/lib/outbox';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewIssuePage() {
  const router = useRouter();
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = () => {
    if (!description.trim() && media.length === 0) {
      router.push('/client/issues');
      return;
    }
    showUndoToast({
      message: 'Formulaire annulé',
      description: 'Vos informations seront perdues.',
      duration: 5000,
      onUndo: () => {
        if (cancelTimerRef.current) {
          clearTimeout(cancelTimerRef.current);
          cancelTimerRef.current = null;
        }
      },
    });
    cancelTimerRef.current = setTimeout(() => {
      router.push('/client/issues');
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Veuillez décrire le problème.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const clientRequestId = crypto.randomUUID();
      const result = await outboxFetch(
        '/api/issues',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, media, clientRequestId }),
        },
        clientRequestId,
        { kind: 'issue' }
      );

      if (result.status === 'queued') {
        toast('Hors ligne — réclamation enregistrée, elle sera envoyée automatiquement dès que vous serez en ligne.');
        router.push('/client/issues');
        return;
      }

      const data = await result.res.json();
      if (!result.res.ok) throw new Error(data.error || 'Erreur lors de la création.');

      router.push(`/client/issues/${data.issueId}`);
    } catch (err: any) {
      setError(err.message || 'Erreur serveur.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <Link href="/client/issues" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        Retour à mes réclamations
      </Link>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Nouvelle réclamation</h1>
        <p className="text-muted-foreground mt-1 text-sm">Déclarez un dysfonctionnement ou une anomalie constatée dans votre logement.</p>
      </div>

      <Card className="bg-card border-border shadow-md">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Description Textarea */}
            <div className="space-y-2.5">
              <Label htmlFor="description" className="text-sm font-bold text-foreground">
                Description détaillée du problème <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                required
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Fuite d'eau importante constatée sous le lavabo de la salle de bain principale. L'eau s'écoule sur le meuble en bois..."
                className="bg-muted border-border focus-visible:ring-ring text-foreground placeholder-muted-foreground rounded-xl leading-relaxed resize-none p-4"
              />
              <p className="text-[11px] text-muted-foreground leading-normal">
                Soyez le plus précis possible. Un agent va traiter votre demande pour catégoriser le problème et estimer son degré d'urgence.
              </p>
            </div>

            {/* Media Upload Area */}
            <div className="space-y-2.5">
              <Label className="text-sm font-bold text-foreground">
                Pièces jointes (Photos, Vidéos, Audio)
              </Label>
              <IssueFileUpload
                onChange={setMedia}
                onBusyChange={setUploading}
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-xs font-semibold text-destructive">
                {error}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground hover:bg-accent px-5 h-10 rounded-lg text-xs font-semibold"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || uploading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 h-10 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-65"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Création en cours...
                  </>
                ) : uploading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Téléversement des fichiers...
                  </>
                ) : (
                  'Soumettre la réclamation'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
