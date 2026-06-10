const { Client } = require('pg');
require('dotenv').config();

const queries = [
  // 1. Таблица Менеджеров
  `CREATE TABLE IF NOT EXISTS "Manager" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "status" TEXT DEFAULT 'ACTIVE',
      "currentLoad" INTEGER DEFAULT 0,
      "organizationId" TEXT NOT NULL,
      "lastActiveAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // 2. Вставка 5 дефолтных менеджеров
  `INSERT INTO "Manager" ("id", "name", "status", "currentLoad", "organizationId")
   VALUES 
      ('manager_1', 'Александр Иванов', 'ACTIVE', 0, 'default'),
      ('manager_2', 'Мария Петрова', 'ACTIVE', 0, 'default'),
      ('manager_3', 'Дмитрий Смирнов', 'ACTIVE', 0, 'default'),
      ('manager_4', 'Елена Козлова', 'ACTIVE', 0, 'default'),
      ('manager_5', 'Алексей Морозов', 'ACTIVE', 0, 'default')
   ON CONFLICT ("id") DO NOTHING;`,

  // 3. Таблица Приемов (График)
  `CREATE TABLE IF NOT EXISTS "Reception" (
      "id" TEXT PRIMARY KEY,
      "leadId" TEXT NOT NULL REFERENCES "Lead"("id") ON DELETE CASCADE,
      "managerId" TEXT NOT NULL REFERENCES "Manager"("id") ON DELETE CASCADE,
      "date" DATE NOT NULL,
      "timeSlot" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // Индекс для уникальности слота у менеджера в день
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_reception_slot" ON "Reception" ("managerId", "date", "timeSlot");`,

  // 4. Поля для квалификации в таблице Lead
  `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "roomsInterested" INTEGER;`,
  `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "areaMin" DOUBLE PRECISION;`,
  `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "areaMax" DOUBLE PRECISION;`,
  `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "deliveryDeadline" TEXT;`,

  // 5. Таблица Со-клиентов сделки (DealClient)
  `CREATE TABLE IF NOT EXISTS "DealClient" (
      "id" TEXT PRIMARY KEY,
      "dealId" TEXT NOT NULL REFERENCES "Deal"("id") ON DELETE CASCADE,
      "leadId" TEXT NOT NULL REFERENCES "Lead"("id") ON DELETE CASCADE,
      "isPrimary" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_deal_client_unique" ON "DealClient" ("dealId", "leadId");`,

  // 6. Таблица Объектов сделки (DealUnit) для поддержки нескольких квартир и хранения причин удаления
  `CREATE TABLE IF NOT EXISTS "DealUnit" (
      "id" TEXT PRIMARY KEY,
      "dealId" TEXT NOT NULL REFERENCES "Deal"("id") ON DELETE CASCADE,
      "unitId" TEXT NOT NULL REFERENCES "Unit"("id") ON DELETE CASCADE,
      "isDeleted" BOOLEAN DEFAULT false,
      "deleteReason" TEXT,
      "deletedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // 7. Делаем unitId необязательным в таблице Deal (поскольку теперь они хранятся в DealUnit)
  `ALTER TABLE "Deal" ALTER COLUMN "unitId" DROP NOT NULL;`
];

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  console.log('Connected to DB. Running migration queries...');
  try {
    for (const sql of queries) {
      await client.query(sql);
      console.log('Successfully executed query:', sql.trim().substring(0, 50) + '...');
    }
    console.log('DB migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.end();
  }
}

run();
