// Reading the developer's unit spreadsheet. Pure: no database, no file format —
// it takes rows of strings and says what should happen to each one.

export const UNIT_TYPES = { A: 'APPARTEMENT', D: 'DUPLEX', M: 'MAGASIN' } as const;
export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES];

/** The spreadsheet's column titles, as they appear in the file. */
export const COLUMNS = {
  code: 'Num Archi',
  nature: 'Nature',
  floor: 'Etage',
  standing: 'Standing',
  name: 'Client',
  address: 'Adresse',
  city: 'Ville',
  country: 'Pays',
  email: 'Email',
  phone1: 'Tel 1',
  phone2: 'Tel 2',
} as const;

export type RawRow = Record<string, string | null | undefined>;

export type UnitCode = {
  /** The code as typed, uppercased: GZ-T1-3-A-A-21 */
  code: string;
  project: string;
  tranche: string | null;
  /** From the code; the sheet's Étage column wins when it says something. */
  floor: string | null;
  building: string;
  type: UnitType;
  /** What a human calls the flat: "21", "62-64", "M1". */
  number: string;
};

/**
 * Three shapes appear in the file:
 *   GZ-T1-3-A-A-21   project, tranche, floor, building, appartement 21
 *   GZ-D-A-62-64     duplex spanning two numbers; floor comes from the column
 *   GZ-1-0-B-M1      magasin 1 — tranche written without the T
 */
export function parseUnitCode(raw: string | null | undefined): UnitCode | null {
  const code = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return null;
  const parts = code.split('-');
  if (parts.length < 4) return null;

  const [project, second] = parts;
  if (!/^[A-Z]{2,4}$/.test(project)) return null;

  // Duplex: GZ-D-A-62-64
  if (second === 'D') {
    const [, , building, ...numbers] = parts;
    if (!/^[A-Z]$/.test(building) || numbers.length === 0) return null;
    return {
      code, project, tranche: null, floor: null, building,
      type: UNIT_TYPES.D, number: numbers.join('-'),
    };
  }

  const tranche = /^T?\d+$/.test(second) ? `T${second.replace(/^T/, '')}` : null;
  if (!tranche) return null;

  const [, , floorPart, building, kind, ...rest] = parts;
  if (!/^\d+$/.test(floorPart) || !/^[A-Z]$/.test(building)) return null;

  // Magasin: the kind carries its own number (M1), apartments have it after.
  if (/^M\d*$/.test(kind)) {
    return { code, project, tranche, floor: floorPart, building, type: UNIT_TYPES.M, number: kind };
  }
  if (kind === 'A' && rest.length > 0) {
    return { code, project, tranche, floor: floorPart, building, type: UNIT_TYPES.A, number: rest.join('-') };
  }
  return null;
}

/** "_RDC" → "RDC", "10ème ETAGE" → "10", "15-16" kept as is. */
export function readFloor(column: string | null | undefined, fromCode: string | null): string | null {
  const raw = (column ?? '').trim().replace(/^_+/, '');
  if (raw) {
    if (/^rdc$/i.test(raw)) return 'RDC';
    const single = raw.match(/^(\d+)\s*(?:è|e)?me?\s*(?:etage|étage)?$/i);
    if (single) return single[1];
    return raw;
  }
  if (fromCode === null) return null;
  return fromCode === '0' ? 'RDC' : fromCode;
}

/** Collapses the double spaces without touching the casing: EL, AIT, ID survive. */
export function cleanName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Keeps a phone in a shape a human can dial: international prefixes normalised
 * to +, spaces removed. Anything without enough digits is dropped rather than
 * stored as noise ("00" appears in the file).
 */
export function cleanPhone(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  const plus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) return null;

  if (plus) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return digits;      // local, kept as dialled
  return `+${digits}`;                            // 212661…, 33…, 971…
}

export function cleanText(raw: string | null | undefined): string | null {
  const value = (raw ?? '').replace(/\s+/g, ' ').trim();
  return value || null;
}

export function cleanEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : null;
}

export type ParsedClient = {
  unitCode: string;
  unitNumber: string;
  login: string;
  name: string;
  floor: string | null;
  unitType: UnitType;
  standing: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  building: { project: string; tranche: string | null; letter: string };
};

export type RowOutcome =
  | { line: number; status: 'ready'; client: ParsedClient }
  | { line: number; status: 'skipped'; code: string | null; reason: string }
  | { line: number; status: 'error'; code: string | null; reason: string };

/** One spreadsheet row: a client to write, a row to skip, or a row to report. */
export function parseRow(row: RawRow, line: number): RowOutcome {
  const rawCode = cleanText(row[COLUMNS.code]);
  const unit = parseUnitCode(rawCode);

  if (!unit) {
    return { line, status: 'error', code: rawCode, reason: 'Code « Num Archi » illisible.' };
  }
  if (unit.type === UNIT_TYPES.M) {
    return { line, status: 'skipped', code: unit.code, reason: 'Magasin — hors périmètre du SAV.' };
  }

  const name = cleanName(row[COLUMNS.name]);
  if (!name) {
    return { line, status: 'error', code: unit.code, reason: 'Nom du client manquant.' };
  }

  return {
    line,
    status: 'ready',
    client: {
      unitCode: unit.code,
      unitNumber: unit.number,
      login: unit.code.toLowerCase(),
      name,
      floor: readFloor(row[COLUMNS.floor], unit.floor),
      unitType: unit.type,
      standing: cleanText(row[COLUMNS.standing]),
      addressLine: cleanText(row[COLUMNS.address]),
      city: cleanText(row[COLUMNS.city]),
      country: cleanText(row[COLUMNS.country]),
      email: cleanEmail(row[COLUMNS.email]),
      phone: cleanPhone(row[COLUMNS.phone1]),
      phone2: cleanPhone(row[COLUMNS.phone2]),
      building: { project: unit.project, tranche: unit.tranche, letter: unit.building },
    },
  };
}

export type ImportPlan = {
  create: ParsedClient[];
  update: ParsedClient[];
  skipped: { line: number; code: string | null; reason: string }[];
  errors: { line: number; code: string | null; reason: string }[];
  buildings: { project: string; tranche: string | null; letter: string; label: string }[];
};

export function buildingLabel(b: { tranche: string | null; letter: string }): string {
  return b.tranche ? `Tranche ${b.tranche.replace(/^T/, '')} · Immeuble ${b.letter}` : `Immeuble ${b.letter}`;
}

/**
 * What the import would do. `existingCodes` are the unit codes already in the
 * database, so a corrected file updates rows instead of duplicating them.
 */
export function planImport(rows: RawRow[], existingCodes: Set<string>): ImportPlan {
  const plan: ImportPlan = { create: [], update: [], skipped: [], errors: [], buildings: [] };
  const seen = new Map<string, number>();
  const ready: ParsedClient[] = [];

  rows.forEach((row, index) => {
    const line = index + 2; // row 1 holds the column titles
    const outcome = parseRow(row, line);

    if (outcome.status === 'skipped') {
      plan.skipped.push({ line, code: outcome.code, reason: outcome.reason });
      return;
    }
    if (outcome.status === 'error') {
      plan.errors.push({ line, code: outcome.code, reason: outcome.reason });
      return;
    }

    const { client } = outcome;
    const first = seen.get(client.unitCode);
    if (first !== undefined) {
      plan.errors.push({
        line, code: client.unitCode,
        reason: `Code déjà présent ligne ${first} — un logement ne peut avoir qu’un compte.`,
      });
      return;
    }
    seen.set(client.unitCode, line);
    ready.push(client);
  });

  // A duplex code carries no tranche (GZ-D-A-62-64). When the rest of the file
  // is one single tranche, the duplex belongs to that same building rather than
  // to a second "Immeuble A" standing on its own.
  const tranches = new Set(ready.flatMap(c => (c.building.tranche ? [c.building.tranche] : [])));
  if (tranches.size === 1) {
    const [only] = tranches;
    for (const client of ready) {
      if (client.building.tranche === null) client.building.tranche = only;
    }
  }

  const buildings = new Map<string, ImportPlan['buildings'][number]>();
  for (const client of ready) {
    const key = `${client.building.project}|${client.building.tranche ?? ''}|${client.building.letter}`;
    if (!buildings.has(key)) {
      buildings.set(key, { ...client.building, label: buildingLabel(client.building) });
    }
    if (existingCodes.has(client.unitCode)) plan.update.push(client);
    else plan.create.push(client);
  }

  plan.buildings = [...buildings.values()].sort((a, b) => a.label.localeCompare(b.label));
  return plan;
}
