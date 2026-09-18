// What a bulk delete is allowed to ask for. Pure, so the rules can be tested
// without a database: the route does the deleting.

export const BULK_ENTITIES = {
  clients: { label: 'client', plural: 'clients', audit: 'Client' },
  agents: { label: 'agent', plural: 'agents', audit: 'Agent' },
  areas: { label: 'zone', plural: 'zones', audit: 'Area' },
  buildings: { label: 'immeuble', plural: 'immeubles', audit: 'Building' },
} as const;

export type BulkEntity = keyof typeof BULK_ENTITIES;

/** One request cannot sweep the whole database in a single click. */
export const MAX_BULK_IDS = 200;

export type BulkRequest =
  | { ok: true; entity: BulkEntity; ids: number[] }
  | { ok: false; error: string };

export function isBulkEntity(value: unknown): value is BulkEntity {
  return typeof value === 'string' && Object.hasOwn(BULK_ENTITIES, value);
}

export function parseBulkRequest(body: unknown): BulkRequest {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Requête illisible.' };
  }
  const { entity, ids } = body as { entity?: unknown; ids?: unknown };

  if (!isBulkEntity(entity)) {
    return { ok: false, error: 'Type d’élément inconnu.' };
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: 'Aucun élément sélectionné.' };
  }

  const clean = [...new Set(ids)].filter(
    (id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
  );
  if (clean.length !== new Set(ids).size) {
    return { ok: false, error: 'Sélection invalide.' };
  }
  if (clean.length > MAX_BULK_IDS) {
    return { ok: false, error: `Maximum ${MAX_BULK_IDS} éléments à la fois.` };
  }

  return { ok: true, entity, ids: clean };
}

/** "3 clients supprimés", "1 zone supprimée" — agreement included. */
export function deletedMessage(entity: BulkEntity, count: number): string {
  const { label, plural } = BULK_ENTITIES[entity];
  const noun = count === 1 ? label : plural;
  const feminine = entity === 'areas';
  const past = `supprimé${feminine ? 'e' : ''}${count === 1 ? '' : 's'}`;
  return `${count} ${noun} ${past}`;
}
