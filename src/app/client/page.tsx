import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plus, HelpCircle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Separator } from '@/components/ui/separator';

export default async function ClientDashboard() {
  const headersList = await headers();
  const userId = Number(headersList.get('x-user-id'));
  const userEmail = headersList.get('x-user-email') ?? 'Client';
  const userName = userEmail.split('@')[0];
  // Format the name nicely (capitalize first letter)
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  const issues = await prisma.issue.findMany({
    where: { clientId: userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      agent: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bonjour, {formattedName}</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Bienvenue sur votre espace client After-Sales. Suivez et gérez vos réclamations.</p>
        </div>
        <Link href="/client/issues/new" passHref>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95">
            <Plus className="h-4 w-4" />
            Nouvelle réclamation
          </Button>
        </Link>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Issues */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Demandes récentes</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">Vos 5 dernières demandes d'intervention</CardDescription>
            </div>
            <Link href="/client/issues" className="text-xs font-semibold text-foreground hover:underline flex items-center gap-1 transition-colors">
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-5">
            {issues.length === 0 ? (
              <div className="text-center py-12">
                <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground font-medium">Aucune réclamation pour le moment.</p>
                <p className="text-xs text-muted-foreground mt-1">Si vous rencontrez un problème, créez une demande d'intervention.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {issues.map((issue) => (
                  <Link key={issue.id} href={`/client/issues/${issue.id}`} className="block group">
                    <div className="p-4 bg-background hover:bg-accent/40 border border-border rounded-xl transition-all duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-muted-foreground">#{issue.id}</span>
                          <StatusBadge status={issue.status} />
                          {issue.severity && (
                            <SeverityBadge severity={issue.severity} />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {new Date(issue.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-foreground text-sm font-medium line-clamp-2 leading-relaxed">
                        {issue.originalDescription}
                      </p>
                      {issue.agent && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded w-fit">
                          <span>Assigné à : <span className="font-semibold text-foreground">{issue.agent.name}</span></span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Quick info / banner */}
        <div className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-md font-bold text-foreground">Support & Assistance</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Comment fonctionne le service après-vente ?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center font-bold text-xs text-foreground shrink-0 mt-0.5">1</div>
                <div>
                  <p className="font-semibold text-foreground text-xs">Déclarez le problème</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Décrivez la panne et joignez des photos. Un agent qualifie le degré d'urgence.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center font-bold text-xs text-foreground shrink-0 mt-0.5">2</div>
                <div>
                  <p className="font-semibold text-foreground text-xs">Planification & Intervention</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Un agent prend en charge la demande et planifie une visite si nécessaire.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center font-bold text-xs text-foreground shrink-0 mt-0.5">3</div>
                <div>
                  <p className="font-semibold text-foreground text-xs">Validation finale</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Une fois réparé, validez la résolution ou contestez-la directement depuis l'espace client.</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="bg-accent border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-foreground font-medium">Garantie active sur votre logement</p>
                <Link href="/client/contract" className="text-xs text-foreground hover:underline font-semibold mt-1.5 inline-block transition-colors">
                  Consulter les termes du contrat →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
