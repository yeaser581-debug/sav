import { NextRequest } from 'next/server';
import { adminFrom, privateJson, unauthorized } from '@/lib/admin-guard';
import { quickSearch } from '@/lib/client-directory';
import { SEARCH_MIN_LENGTH, normalizeQuery } from '@/lib/client-search';

// Backs the Ctrl+K search: a few clients and a few claims for one query.
export async function GET(req: NextRequest) {
  if (!adminFrom(req)) return unauthorized();

  const query = normalizeQuery(req.nextUrl.searchParams.get('q'));
  if (query.length < SEARCH_MIN_LENGTH) {
    return privateJson({ query, clients: [], issues: [] });
  }

  return privateJson({ query, ...(await quickSearch(query)) });
}
