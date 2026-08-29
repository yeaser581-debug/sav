import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export default async function AgentBuildingsPage() {
  const headersList = await headers();
  const agentId = Number(headersList.get('x-user-id'));

  const buildings = await prisma.building.findMany({
    include: {
      area: true,
      clients: {
        select: { id: true, name: true, login: true, unitNumber: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const myArea = await prisma.area.findFirst({ where: { agentId } });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Immeubles</h1>
        <p className="text-muted-foreground mt-1">
          {myArea ? `Votre zone : ${myArea.name}` : 'Vue de tous les immeubles du patrimoine.'}
        </p>
      </div>

      {buildings.length === 0 ? (
        <div className="border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">Aucun immeuble enregistré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {buildings.map(building => (
            <div
              key={building.id}
              className="border border-border rounded-2xl overflow-hidden bg-card"
            >
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{building.name}</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">{building.address}</p>
                  </div>
                  {building.area && (
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border font-medium shrink-0 ml-3">
                      {building.area.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5 bg-muted/40">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {building.clients.length} résidents
                </p>
                {building.clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun résident enregistré.</p>
                ) : (
                  <div className="space-y-2">
                    {building.clients.map(client => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between bg-muted rounded-xl px-3 py-2"
                      >
                        <span className="text-foreground text-sm font-medium">
                          {client.name || client.login}
                        </span>
                        <span className="text-muted-foreground text-xs font-mono">
                          Unité {client.unitNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}