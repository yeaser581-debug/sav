import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, ShieldCheck, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClientContractPage() {
  const contract = await prisma.contract.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mon contrat SAV</h1>
        <p className="text-muted-foreground mt-1 text-sm">Consultez les conditions générales de votre garantie constructeur et votre couverture après-vente.</p>
      </div>

      <Card className="bg-card border-border shadow-md overflow-hidden relative">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-foreground/5 rounded-full blur-2xl pointer-events-none" />

        {!contract ? (
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-semibold text-sm">Aucun contrat actif trouvé.</p>
            <p className="text-muted-foreground text-xs mt-1">Veuillez contacter l'administration pour activer votre garantie.</p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b border-border pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      Garantie Constructeur & SAV Actif
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Dernière mise à jour : {new Date(contract.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </CardDescription>
                  </div>
                </div>
                <div className="bg-muted border border-border px-3 py-1.5 rounded-lg text-center shrink-0">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Version</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{contract.version}.0</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Document Text */}
              <div className="bg-muted border border-border rounded-xl p-6 md:p-8 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <article className="text-foreground text-sm leading-relaxed whitespace-pre-wrap font-medium font-sans">
                  {contract.content}
                </article>
              </div>

              {/* Notice */}
              <div className="mt-5 p-4 bg-muted border border-border rounded-xl flex items-start gap-3">
                <span className="text-foreground text-sm mt-0.5">ℹ️</span>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Ce document contractuel détermine les parties couvertes par votre garantie ainsi que le délai maximal de prise en charge et de résolution des pannes. Pour toute contestation sur la couverture d'une réclamation, veuillez contacter l'administration de la copropriété.
                </p>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
