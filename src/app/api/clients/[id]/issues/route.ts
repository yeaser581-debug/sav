import { NextRequest } from 'next/server';
import { adminFrom, notFound, parseId, privateJson, unauthorized } from '@/lib/admin-guard';
import { clientExists, listClientIssues } from '@/lib/client-directory';
import { HISTORY_PAGE_SIZE, parseHistoryFilter, parsePaging } from '@/lib/client-search';

// One client's claims, newest first, filtered by status group and paged.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminFrom(req)) return unauthorized();

  const clientId = parseId((await params).id);
  if (!clientId) return notFound();

  const search = req.nextUrl.searchParams;
  const { page, limit } = parsePaging(search, HISTORY_PAGE_SIZE);
  const filter = parseHistoryFilter(search.get('status'));

  const [exists, result] = await Promise.all([
    clientExists(clientId),
    listClientIssues({ clientId, filter, page, limit }),
  ]);
  if (!exists) return notFound();

  return privateJson({ ...result, filter });
}
