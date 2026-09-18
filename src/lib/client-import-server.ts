// Turns an uploaded spreadsheet into clients. Reading the file and writing the
// rows live here; the rules that decide what each row means are in
// client-import.ts, where they can be tested without a file or a database.

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { buildingLabel, planImport, type ImportPlan, type ParsedClient, type RawRow } from '@/lib/client-import';

export const MAX_ROWS = 2000;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Readable, unambiguous: no O/0, no l/1, since these get read aloud and retyped. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_LENGTH = 14;

// A 14-character random password is far beyond guessing, and the resident must
// replace it at first login, so the hash does not need the full work factor the
// chosen passwords use.
const IMPORT_HASH_ROUNDS = 8;

export function generatePassword(): string {
  const bytes = crypto.randomBytes(PASSWORD_LENGTH);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return String(value.result ?? '');
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text).join('');
    }
    return '';
  }
  return String(value);
}

/** Splits one CSV line, honouring quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

function rowsFromCsv(text: string): RawRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])) as RawRow;
  });
}

async function rowsFromWorkbook(buffer: Buffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).trim();
  });

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    if (number === 1) return;
    const entry: RawRow = {};
    let hasValue = false;
    headers.forEach((header, col) => {
      if (!header) return;
      const text = cellText(row.getCell(col).value).trim();
      entry[header] = text;
      if (text) hasValue = true;
    });
    if (hasValue) rows.push(entry);
  });
  return rows;
}

export class ImportFileError extends Error {}

export async function readSheet(file: File): Promise<RawRow[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError('Fichier trop volumineux (max 8 Mo).');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let rows: RawRow[];
  if (name.endsWith('.csv')) rows = rowsFromCsv(buffer.toString('utf8'));
  else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) rows = await rowsFromWorkbook(buffer);
  else throw new ImportFileError('Format non supporté : attendez un fichier .xlsx ou .csv.');

  if (rows.length === 0) throw new ImportFileError('Aucune ligne trouvée dans le fichier.');
  if (rows.length > MAX_ROWS) {
    throw new ImportFileError(`Fichier trop long (${rows.length} lignes, maximum ${MAX_ROWS}).`);
  }
  return rows;
}

export async function planFromRows(rows: RawRow[]): Promise<ImportPlan> {
  const known = await prisma.client.findMany({
    where: { unitCode: { not: null } },
    select: { unitCode: true },
  });
  return planImport(rows, new Set(known.flatMap(c => (c.unitCode ? [c.unitCode] : []))));
}

export type Credentials = {
  unitCode: string;
  unitNumber: string;
  name: string;
  login: string;
  password: string;
  qrToken: string;
  building: string;
  floor: string | null;
};

export type ImportResult = {
  created: Credentials[];
  updated: number;
  skipped: number;
  errors: ImportPlan['errors'];
  buildings: string[];
};

/**
 * Writes the plan. Buildings are created as needed under one zone; existing
 * units are updated in place, keeping their login, password and QR code, so a
 * corrected file can be re-imported safely.
 */
export async function applyPlan(plan: ImportPlan, zoneName: string): Promise<ImportResult> {
  const zone = await prisma.area.findFirst({ where: { name: zoneName, deletedAt: null } })
    ?? await prisma.area.create({ data: { name: zoneName } });

  const buildingIds = new Map<string, number>();
  const buildingNames: string[] = [];
  for (const b of plan.buildings) {
    const label = buildingLabel(b);
    const existing = await prisma.building.findFirst({
      where: { name: label, areaId: zone.id, deletedAt: null },
      select: { id: true },
    });
    const building = existing ?? await prisma.building.create({
      data: { name: label, tranche: b.tranche, areaId: zone.id },
    });
    buildingIds.set(`${b.tranche ?? ''}|${b.letter}`, building.id);
    if (!existing) buildingNames.push(label);
  }

  const buildingIdFor = (client: ParsedClient) =>
    buildingIds.get(`${client.building.tranche ?? ''}|${client.building.letter}`)!;

  const details = (client: ParsedClient) => ({
    name: client.name,
    unitNumber: client.unitNumber,
    floor: client.floor,
    unitType: client.unitType,
    standing: client.standing,
    addressLine: client.addressLine,
    city: client.city,
    country: client.country,
    email: client.email,
    phone: client.phone,
    phone2: client.phone2,
    buildingId: buildingIdFor(client),
  });

  const created: Credentials[] = [];
  for (const client of plan.create) {
    const password = generatePassword();
    const row = await prisma.client.create({
      data: {
        ...details(client),
        unitCode: client.unitCode,
        login: client.login,
        passwordHash: await bcrypt.hash(password, IMPORT_HASH_ROUNDS),
        qrToken: crypto.randomBytes(32).toString('hex'),
        mustSetPassword: true,
      },
      select: { login: true, qrToken: true, unitNumber: true, floor: true, name: true, building: { select: { name: true } } },
    });
    created.push({
      unitCode: client.unitCode,
      unitNumber: row.unitNumber ?? client.unitNumber,
      name: row.name,
      login: row.login,
      password,
      qrToken: row.qrToken,
      building: row.building?.name ?? '',
      floor: row.floor,
    });
  }

  // An update never touches the login, the password or the QR code: a resident
  // who already has their code keeps it.
  for (const client of plan.update) {
    await prisma.client.updateMany({
      where: { unitCode: client.unitCode },
      data: details(client),
    });
  }

  return {
    created,
    updated: plan.update.length,
    skipped: plan.skipped.length,
    errors: plan.errors,
    buildings: buildingNames,
  };
}
