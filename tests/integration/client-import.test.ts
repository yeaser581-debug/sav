import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { POST as importClients } from '@/app/api/clients/import/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedClient } from '../helpers/db';
import { signToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

beforeEach(resetDb);

let admin: { id: number; email: string };

beforeEach(async () => {
  const row = await seedAdmin();
  admin = { id: row.id, email: row.email };
});

// The header line and three rows, in the shape the developer's file uses.
const HEADER = 'Num Archi,Nature,Etage,Standing,Client,CIN,Adresse,Ville,Pays,Adresse CIN,Email,Tel 1,Tel 2';
const ROWS = [
  'GZ-T1-0-A-A-48,Appartement,,Haut Standing,ait saad hassan,J361733,,Casablanca,Maroc,,,,',
  'GZ-T1-2-B-A-5,Appartement,2ème ETAGE,Haut Standing,ALALI  FOUAD,18DF 57960,,France,FRANCE,,,+33650024912,',
  'GZ-1-0-B-M1,Magasin,_RDC,Haut Standing,SAAD ELDIN AHMAD,BE55072A,,,,,,,',
];

function request(form: FormData, token?: string) {
  const headers = new Headers();
  if (token) headers.set('cookie', `token=${token}`);
  return new NextRequest('http://localhost:3000/api/clients/import', { method: 'POST', body: form, headers });
}

function upload(csv: string, mode: 'preview' | 'apply' = 'preview', zone?: string) {
  const form = new FormData();
  form.set('file', new File([csv], 'clients.csv', { type: 'text/csv' }));
  form.set('mode', mode);
  if (zone) form.set('zone', zone);
  return request(form, signToken({ id: admin.id, email: admin.email, role: 'admin' }));
}

const csv = (rows: string[] = ROWS) => [HEADER, ...rows].join('\n');

async function body(res: Response) {
  expect(res.status, await res.clone().text()).toBe(200);
  return res.json();
}

describe('who may import', () => {
  it('turns away an agent and an unauthenticated request', async () => {
    const agent = await seedAgent();
    const form = new FormData();
    form.set('file', new File([csv()], 'c.csv'));

    const asAgent = request(form, signToken({ id: agent.id, email: agent.email, role: 'agent' }));
    const anonymous = request(form);

    expect((await importClients(asAgent)).status).toBe(401);
    expect((await importClients(anonymous)).status).toBe(401);
  });
});

describe('the preview', () => {
  it('says what would happen without writing anything', async () => {
    const data = await body(await importClients(upload(csv())));

    expect(data).toMatchObject({ mode: 'preview', create: 2, update: 0 });
    expect(data.skipped).toHaveLength(1);
    expect(data.skipped[0]).toMatchObject({ code: 'GZ-1-0-B-M1' });
    expect(data.buildings).toEqual(['Tranche 1 · Immeuble A', 'Tranche 1 · Immeuble B']);
    expect(await prisma.client.count()).toBe(0);
    expect(await prisma.building.count()).toBe(0);
  });

  it('shows a sample so a mis-read column is caught before writing', async () => {
    const { sample } = await body(await importClients(upload(csv())));
    expect(sample[0]).toMatchObject({ unitCode: 'GZ-T1-0-A-A-48', name: 'ait saad hassan', login: 'gz-t1-0-a-a-48' });
  });

  it('reports unreadable rows with their line number', async () => {
    const data = await body(await importClients(upload(csv([...ROWS, 'PAS-UN-CODE,Appartement,,,X,,,,,,,,']))));
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].line).toBe(5);
  });

  it('refuses a file that is not a sheet', async () => {
    const form = new FormData();
    form.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const res = await importClients(request(form, signToken({ id: admin.id, email: admin.email, role: 'admin' })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('.xlsx');
  });
});

describe('applying the import', () => {
  it('creates the zone, the buildings and the clients', async () => {
    const data = await body(await importClients(upload(csv(), 'apply')));

    expect(data.created).toHaveLength(2);
    expect(data.skipped).toBe(1);

    const zone = await prisma.area.findFirstOrThrow({ where: { name: 'Glorious Zenata' } });
    const buildings = await prisma.building.findMany({ where: { areaId: zone.id }, orderBy: { name: 'asc' } });
    expect(buildings.map(b => b.name)).toEqual(['Tranche 1 · Immeuble A', 'Tranche 1 · Immeuble B']);
    expect(buildings[0].tranche).toBe('T1');

    const client = await prisma.client.findFirstOrThrow({ where: { unitCode: 'GZ-T1-2-B-A-5' } });
    expect(client).toMatchObject({
      login: 'gz-t1-2-b-a-5',
      name: 'ALALI FOUAD',       // the double space is gone
      unitNumber: '5',
      floor: '2',
      unitType: 'APPARTEMENT',
      city: 'France',
      phone: '+33650024912',
      mustSetPassword: true,
    });
    expect(client.buildingId).toBe(buildings[1].id);
  });

  it('hands back a password that actually opens the account', async () => {
    const data = await body(await importClients(upload(csv(), 'apply')));
    const account = data.created.find((c: { unitCode: string }) => c.unitCode === 'GZ-T1-0-A-A-48');

    const stored = await prisma.client.findFirstOrThrow({ where: { login: account.login } });
    expect(account.password).toHaveLength(14);
    expect(await bcrypt.compare(account.password, stored.passwordHash)).toBe(true);
    expect(account.qrToken).toBe(stored.qrToken);
  });

  it('gives every client a different password and QR token', async () => {
    const { created } = await body(await importClients(upload(csv(), 'apply')));
    expect(new Set(created.map((c: { password: string }) => c.password)).size).toBe(created.length);
    expect(new Set(created.map((c: { qrToken: string }) => c.qrToken)).size).toBe(created.length);
  });

  it('takes the zone name from the form', async () => {
    await body(await importClients(upload(csv(), 'apply', 'Résidence Atlas')));
    expect(await prisma.area.findFirst({ where: { name: 'Résidence Atlas' } })).not.toBeNull();
  });

  it('leaves magasins out of the database entirely', async () => {
    await body(await importClients(upload(csv(), 'apply')));
    expect(await prisma.client.findFirst({ where: { unitCode: 'GZ-1-0-B-M1' } })).toBeNull();
    expect(await prisma.client.count()).toBe(2);
  });
});

describe('re-importing a corrected file', () => {
  it('updates the rows instead of creating them a second time', async () => {
    await body(await importClients(upload(csv(), 'apply')));
    const corrected = [
      'GZ-T1-0-A-A-48,Appartement,,Haut Standing,AIT SAAD HASSAN,J361733,,Rabat,Maroc,,hassan@mail.ma,0661234567,',
      ROWS[1],
      ROWS[2],
    ];
    const second = await body(await importClients(upload(csv(corrected), 'apply')));

    expect(second.created).toHaveLength(0);
    expect(second.updated).toBe(2);
    expect(await prisma.client.count()).toBe(2);

    const after = await prisma.client.findFirstOrThrow({ where: { unitCode: 'GZ-T1-0-A-A-48' } });
    expect(after.name).toBe('AIT SAAD HASSAN');
    expect(after.city).toBe('Rabat');
    expect(after.email).toBe('hassan@mail.ma');
    expect(after.phone).toBe('0661234567');
  });

  it('keeps the login, the password and the QR code a resident already has', async () => {
    await body(await importClients(upload(csv(), 'apply')));
    const before = await prisma.client.findFirstOrThrow({ where: { unitCode: 'GZ-T1-0-A-A-48' } });

    await body(await importClients(upload(csv(), 'apply')));
    const after = await prisma.client.findFirstOrThrow({ where: { unitCode: 'GZ-T1-0-A-A-48' } });

    expect(after.login).toBe(before.login);
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.qrToken).toBe(before.qrToken);
    expect(after.id).toBe(before.id);
  });

  it('does not create the zone and buildings twice', async () => {
    await body(await importClients(upload(csv(), 'apply')));
    await body(await importClients(upload(csv(), 'apply')));

    expect(await prisma.area.count({ where: { name: 'Glorious Zenata' } })).toBe(1);
    expect(await prisma.building.count()).toBe(2);
  });

  it('adds a unit that appears only in the newer file', async () => {
    await body(await importClients(upload(csv(), 'apply')));
    const grown = await body(await importClients(
      upload(csv([...ROWS, 'GZ-T1-3-C-A-9,Appartement,3ème ETAGE,Haut Standing,NOUVEAU CLIENT,X1,,Casablanca,Maroc,,,,']), 'apply'),
    ));

    expect(grown.created).toHaveLength(1);
    expect(grown.updated).toBe(2);
    expect(await prisma.client.count()).toBe(3);
  });

  it('does not collide with clients created by hand, which have no unit code', async () => {
    await seedClient({ login: 'manuel' });
    await body(await importClients(upload(csv(), 'apply')));
    expect(await prisma.client.count()).toBe(3);
  });
});
