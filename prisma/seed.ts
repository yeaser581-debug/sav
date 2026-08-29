import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb from 'mariadb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "127.0.0.1",
  port: Number(process.env.DATABASE_PORT) || 3306,
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "aftersales_db",
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Admin
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@aftersales.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@aftersales.com',
      passwordHash,
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // 2. Agents
  const agent1 = await prisma.agent.upsert({
    where: { email: 'youssef@aftersales.com' },
    update: {},
    create: {
      name: 'Youssef Benali',
      email: 'youssef@aftersales.com',
      phone: '+212600000001',
      passwordHash,
    },
  });

  const agent2 = await prisma.agent.upsert({
    where: { email: 'sara@aftersales.com' },
    update: {},
    create: {
      name: 'Sara Idrissi',
      email: 'sara@aftersales.com',
      phone: '+212600000002',
      passwordHash,
    },
  });
  console.log('✅ Agents: Youssef & Sara');

  // 3. Areas (use findFirst + create pattern to avoid id issues)
  let area1 = await prisma.area.findFirst({ where: { name: 'Hay Riad' } });
  if (!area1) {
    area1 = await prisma.area.create({
      data: { name: 'Hay Riad', agentId: agent1.id },
    });
  }

  let area2 = await prisma.area.findFirst({ where: { name: 'Gauthier' } });
  if (!area2) {
    area2 = await prisma.area.create({
      data: { name: 'Gauthier', agentId: agent2.id },
    });
  }
  console.log('✅ Areas: Hay Riad & Gauthier');

  // 4. Buildings
  let building1 = await prisma.building.findFirst({ where: { name: 'Résidence Palmiers' } });
  if (!building1) {
    building1 = await prisma.building.create({
      data: {
        name: 'Résidence Palmiers',
        address: '123 Avenue Hay Riad, Rabat',
        areaId: area1.id,
      },
    });
  }

  let building2 = await prisma.building.findFirst({ where: { name: 'Résidence Jasmin' } });
  if (!building2) {
    building2 = await prisma.building.create({
      data: {
        name: 'Résidence Jasmin',
        address: '45 Rue Gauthier, Casablanca',
        areaId: area2.id,
      },
    });
  }
  console.log('✅ Buildings: Palmiers & Jasmin');

  // 5. Clients
  const clientsData = [
    { name: 'Ahmed Alami', login: 'ahmed.alami', unit: 'A1', buildingId: building1.id },
    { name: 'Fatima Zahra', login: 'fatima.zahra', unit: 'B2', buildingId: building1.id },
    { name: 'Karim Tazi', login: 'karim.tazi', unit: 'C3', buildingId: building2.id },
  ];

  for (const c of clientsData) {
    const existing = await prisma.client.findUnique({ where: { login: c.login } });
    if (!existing) {
      await prisma.client.create({
        data: {
          name: c.name,
          login: c.login,
          unitNumber: c.unit,
          passwordHash,
          qrToken: crypto.randomBytes(16).toString('hex'),
          buildingId: c.buildingId,
        },
      });
    }
  }
  console.log(`✅ ${clientsData.length} Clients created`);

  // 6. Contract
  const existingContract = await prisma.contract.findFirst({ where: { isActive: true } });
  if (!existingContract) {
    await prisma.contract.create({
      data: {
        version: 1,
        isActive: true,
        content: `# Contrat de Service Après-Vente (SAV)

## 1. Couverture
Le présent contrat couvre les défauts de construction et les dysfonctionnements des équipements suivants pendant une durée de 1 an après la livraison :
- Plomberie (fuites, robinetterie défectueuse, canalisations)
- Électricité (prises, interrupteurs, tableau électrique)
- Menuiserie (portes, fenêtres, volets, serrures)
- Revêtements (carrelage, parquet, peinture, faux-plafond)
- Étanchéité (toiture, terrasse, balcon)

## 2. Exclusions
Les éléments suivants ne sont pas couverts par la garantie :
- Usure normale due à l'utilisation
- Dommages causés par le client (chocs, mauvaise utilisation, modifications non autorisées)
- Problèmes liés à des catastrophes naturelles ou cas de force majeure
- Dégâts causés par des tiers extérieurs

## 3. Délais d'intervention
- Problèmes critiques (fuite d'eau majeure, panne électrique totale, problème structurel) : 24 heures
- Problèmes moyens (panne partielle, problème de menuiserie, dysfonctionnement d'équipement) : 72 heures
- Problèmes mineurs (retouches esthétiques, petites fissures, peinture) : 7 jours`,
      },
    });
  }
  console.log('✅ Contract created');

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📋 Login credentials (password: password123):');
  console.log('  Admin:  admin@aftersales.com');
  console.log('  Agent1: youssef@aftersales.com');
  console.log('  Agent2: sara@aftersales.com');
  console.log('  Client: ahmed.alami / fatima.zahra / karim.tazi');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
