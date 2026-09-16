import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';

export const dynamic = 'force-dynamic';

export default async function AgentClientsPage() {
  const headersList = await headers();
  const agentId = Number(headersList.get('x-user-id'));

  const myArea = await prisma.area.findFirst({ where: { agentId } });

  const clients = await prisma.client.findMany({
    ...(myArea && { where: { building: { areaId: myArea.id } } }),
    include: {
      building: { select: { name: true } },
      issues: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Clients</h1>
        <p className="text-muted-foreground mt-1">
          {myArea ? `Résidents de votre zone : ${myArea.name}` : 'Tous les résidents de la plateforme.'}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">Aucun client dans votre zone.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-medium">Résident</th>
                <th className="p-4 font-medium">Unité</th>
                <th className="p-4 font-medium">Immeuble</th>
                <th className="p-4 font-medium">Dernière réclamation</th>
                <th className="p-4 font-medium text-right">Réclamations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map(client => {
                const lastIssue = client.issues[0];
                return (
                  <tr key={client.id} className="hover:bg-accent/40 transition-colors">
                    <td className="p-4">
                      <p className="text-foreground font-medium">{client.name || client.login}</p>
                      <p className="text-muted-foreground text-xs">{client.login}</p>
                    </td>
                    <td className="p-4 text-muted-foreground font-mono text-sm">{client.unitNumber}</td>
                    <td className="p-4 text-muted-foreground text-sm">{client.building?.name || '—'}</td>
                    <td className="p-4">
                      {lastIssue ? (
                        <Link href={`/agent/issues/${lastIssue.id}`} className="inline-flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">#{lastIssue.id}</span>
                          <StatusBadge status={lastIssue.status} />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs">Aucune</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-bold text-foreground">{client.issues.length}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="md:hidden divide-y divide-border">
            {clients.map(client => {
              const lastIssue = client.issues[0];
              return (
                <div key={client.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium truncate">{client.name || client.login}</p>
                      <p className="text-muted-foreground text-xs">{client.login}</p>
                    </div>
                    <span className="text-sm font-bold text-foreground shrink-0">{client.issues.length} réclam.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">Unité {client.unitNumber}</span>
                    <span>·</span>
                    <span className="truncate">{client.building?.name || '—'}</span>
                  </div>
                  {lastIssue ? (
                    <Link href={`/agent/issues/${lastIssue.id}`} className="inline-flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{lastIssue.id}</span>
                      <StatusBadge status={lastIssue.status} />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-xs">Aucune réclamation</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}