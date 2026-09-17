import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminFrom, notFound, parseId, privateJson, unauthorized } from '@/lib/admin-guard';

// The QR login token is a credential: it signs the resident in. It is handed
// out for one client at a time, only when an admin opens that client's QR code.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminFrom(req)) return unauthorized();

  const clientId = parseId((await params).id);
  if (!clientId) return notFound();

  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { qrToken: true, qrUsedAt: true },
  });

  return client ? privateJson(client) : notFound();
}
