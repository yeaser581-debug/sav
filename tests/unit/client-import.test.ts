import { describe, it, expect } from 'vitest';
import {
  COLUMNS, buildingLabel, cleanEmail, cleanName, cleanPhone, parseRow, parseUnitCode,
  planImport, readFloor, type RawRow,
} from '@/lib/client-import';

// Rows copied from the developer's file, shapes and typos included.
const row = (over: Partial<Record<string, string>> = {}): RawRow => ({
  [COLUMNS.code]: 'GZ-T1-3-A-A-21',
  [COLUMNS.nature]: 'Appartement',
  [COLUMNS.floor]: '3ème ETAGE',
  [COLUMNS.standing]: 'Haut Standing',
  [COLUMNS.name]: 'GHRIB HAKIMA',
  [COLUMNS.city]: 'KHOURIBGA',
  [COLUMNS.phone1]: '+212661846624',
  [COLUMNS.phone2]: '0672508524',
  ...over,
});

describe('parseUnitCode', () => {
  it('reads an apartment: project, tranche, floor, building, number', () => {
    expect(parseUnitCode('GZ-T1-2-B-A-5')).toMatchObject({
      project: 'GZ', tranche: 'T1', floor: '2', building: 'B', type: 'APPARTEMENT', number: '5',
    });
  });

  it('reads a duplex, which carries no tranche or floor', () => {
    expect(parseUnitCode('GZ-D-A-62-64')).toMatchObject({
      project: 'GZ', tranche: null, floor: null, building: 'A', type: 'DUPLEX', number: '62-64',
    });
  });

  it.each([['GZ-1-0-B-M1', 'M1'], ['GZ-1-0-C-M5', 'M5']])('reads %s as a magasin', (code, number) => {
    expect(parseUnitCode(code)).toMatchObject({ type: 'MAGASIN', number, tranche: 'T1' });
  });

  it('treats GZ-1 and GZ-T1 as the same tranche', () => {
    expect(parseUnitCode('GZ-1-0-B-A-3')?.tranche).toBe(parseUnitCode('GZ-T1-0-B-A-3')?.tranche);
  });

  it('keeps two-digit floors', () => {
    expect(parseUnitCode('GZ-T1-10-A-A-53')?.floor).toBe('10');
  });

  it('uppercases and ignores stray spaces', () => {
    expect(parseUnitCode(' gz-t1-4-c-a-26 ')?.code).toBe('GZ-T1-4-C-A-26');
  });

  it.each([null, '', 'GZ-T1', 'not a code', 'GZ-T1-A-A-A-1', '12-34-56-78'])('refuses %s', input => {
    expect(parseUnitCode(input)).toBeNull();
  });
});

describe('readFloor', () => {
  it.each([
    ['_RDC', null, 'RDC'],
    ['3ème ETAGE', '3', '3'],
    ['10ème ETAGE', '10', '10'],
    ['15-16', null, '15-16'],
    ['', '4', '4'],
    ['', '0', 'RDC'],
    ['', null, null],
  ])('column %s with code %s reads as %s', (column, code, expected) => {
    expect(readFloor(column, code)).toBe(expected);
  });
});

describe('cleanName', () => {
  it('collapses the double spaces without touching the casing', () => {
    expect(cleanName('KOUMZI  JAAFAR')).toBe('KOUMZI JAAFAR');
    expect(cleanName('  ait saad hassan ')).toBe('ait saad hassan');
    expect(cleanName('EL KHAMLICHI OMAR')).toBe('EL KHAMLICHI OMAR');
  });

  it('keeps two owners in one cell as one name', () => {
    expect(cleanName('WALED & ARHZAOUY ABDERRAHMANE')).toBe('WALED & ARHZAOUY ABDERRAHMANE');
  });
});

describe('cleanPhone', () => {
  it.each([
    ['+212661846624', '+212661846624'],
    ['212663297496', '+212663297496'],
    ['0663 43 08 74', '0663430874'],
    ['00 33 751 05 57 63', '+33751055763'],
    ['0031 611 125 238', '+31611125238'],
    ['001 514 583 85 16', '+15145838516'],
    ['+971509510497', '+971509510497'],
  ])('%s becomes %s', (input, expected) => {
    expect(cleanPhone(input)).toBe(expected);
  });

  it.each(['00', '', null, '  ', '123'])('drops %s rather than storing noise', input => {
    expect(cleanPhone(input)).toBeNull();
  });
});

describe('cleanEmail', () => {
  it('keeps a real address, lowercased', () => {
    expect(cleanEmail(' R.Makboul@Yahoo.fr ')).toBe('r.makboul@yahoo.fr');
  });

  it.each(['', null, 'pas-un-email', 'a@b'])('drops %s', input => {
    expect(cleanEmail(input)).toBeNull();
  });
});

describe('parseRow', () => {
  it('turns a row into a client, with the unit code as the login', () => {
    const outcome = parseRow(row(), 4);
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;

    expect(outcome.client).toMatchObject({
      unitCode: 'GZ-T1-3-A-A-21',
      login: 'gz-t1-3-a-a-21',
      unitNumber: '21',
      name: 'GHRIB HAKIMA',
      floor: '3',
      unitType: 'APPARTEMENT',
      city: 'KHOURIBGA',
      phone: '+212661846624',
      phone2: '0672508524',
      building: { project: 'GZ', tranche: 'T1', letter: 'A' },
    });
  });

  it('leaves out magasins, which are not part of the SAV', () => {
    const outcome = parseRow(row({ [COLUMNS.code]: 'GZ-1-0-B-M1', [COLUMNS.name]: 'SAAD ELDIN AHMAD' }), 5);
    expect(outcome).toMatchObject({ status: 'skipped', code: 'GZ-1-0-B-M1' });
  });

  it('reports a row whose code cannot be read', () => {
    expect(parseRow(row({ [COLUMNS.code]: 'ABC' }), 9)).toMatchObject({ status: 'error', line: 9 });
  });

  it('reports a row with no name rather than creating a nameless account', () => {
    expect(parseRow(row({ [COLUMNS.name]: '   ' }), 12)).toMatchObject({ status: 'error', line: 12 });
  });

  it('accepts a client with neither phone nor email', () => {
    const outcome = parseRow(row({ [COLUMNS.phone1]: '', [COLUMNS.phone2]: '', [COLUMNS.email]: '' }), 3);
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.client.phone).toBeNull();
    expect(outcome.client.email).toBeNull();
  });
});

describe('planImport', () => {
  const rows = [
    row({ [COLUMNS.code]: 'GZ-T1-0-A-A-48', [COLUMNS.name]: 'ait saad hassan' }),
    row({ [COLUMNS.code]: 'GZ-T1-2-B-A-5', [COLUMNS.name]: 'BABOUR HASSAN' }),
    row({ [COLUMNS.code]: 'GZ-1-0-B-M1', [COLUMNS.name]: 'SAAD ELDIN AHMAD' }),
    row({ [COLUMNS.code]: 'oops', [COLUMNS.name]: 'X' }),
  ];

  it('sorts rows into create, skip and error', () => {
    const plan = planImport(rows, new Set());
    expect(plan.create.map(c => c.unitCode)).toEqual(['GZ-T1-0-A-A-48', 'GZ-T1-2-B-A-5']);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.errors).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
  });

  it('numbers the lines as the spreadsheet does, titles on row 1', () => {
    const plan = planImport(rows, new Set());
    expect(plan.skipped[0].line).toBe(4);
    expect(plan.errors[0].line).toBe(5);
  });

  it('updates a unit already imported instead of creating it twice', () => {
    const plan = planImport(rows, new Set(['GZ-T1-2-B-A-5']));
    expect(plan.create.map(c => c.unitCode)).toEqual(['GZ-T1-0-A-A-48']);
    expect(plan.update.map(c => c.unitCode)).toEqual(['GZ-T1-2-B-A-5']);
  });

  it('refuses a unit code that appears twice in the same file', () => {
    const plan = planImport([rows[0], rows[0]], new Set());
    expect(plan.create).toHaveLength(1);
    expect(plan.errors[0].reason).toContain('ligne 2');
  });

  it('lists the buildings the file needs, once each', () => {
    const plan = planImport(rows, new Set());
    expect(plan.buildings).toEqual([
      { project: 'GZ', tranche: 'T1', letter: 'A', label: 'Tranche 1 · Immeuble A' },
      { project: 'GZ', tranche: 'T1', letter: 'B', label: 'Tranche 1 · Immeuble B' },
    ]);
  });

  it('names a duplex building without inventing a tranche', () => {
    expect(buildingLabel({ tranche: null, letter: 'A' })).toBe('Immeuble A');
  });
});

describe('duplexes and their building', () => {
  const apartment = 'GZ-T1-0-A-A-48';
  const duplex = 'GZ-D-A-62-64';
  const make = (code: string) => row({ [COLUMNS.code]: code, [COLUMNS.name]: 'X' });

  it('puts a duplex in the same building as the flats when the file has one tranche', () => {
    const plan = planImport([make(apartment), make(duplex)], new Set());
    expect(plan.buildings.map(b => b.label)).toEqual(['Tranche 1 · Immeuble A']);
    expect(plan.create.every(c => c.building.tranche === 'T1')).toBe(true);
  });

  it('leaves the duplex on its own when the file mixes tranches, rather than guessing', () => {
    const plan = planImport([make(apartment), make('GZ-T2-1-A-A-7'), make(duplex)], new Set());
    expect(plan.buildings.map(b => b.label)).toEqual([
      'Immeuble A', 'Tranche 1 · Immeuble A', 'Tranche 2 · Immeuble A',
    ]);
  });
});
