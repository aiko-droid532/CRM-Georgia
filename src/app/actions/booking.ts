'use server';

import { db as prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createBooking(data: {
  leadId: string;
  unitId: string;
  organizationId: string;
}) {
  try {
    // 1. Создаем сделку
    const deals: any[] = await prisma.$queryRaw`
      INSERT INTO "Deal" ("id", "leadId", "unitId", "organizationId", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${data.leadId}, ${data.unitId}, ${data.organizationId}, 'RESERVATION', NOW(), NOW())
      RETURNING *
    `;

    // 2. Меняем статус квартиры на "Бронь"
    await prisma.$executeRaw`
      UPDATE "Unit" SET status = 'RESERVATION_PAID', "updatedAt" = NOW()
      WHERE id = ${data.unitId}
    `;

    revalidatePath('/shakhmatka');
    revalidatePath('/deals');
    revalidatePath('/');
    
    return { success: true, deal: deals[0] };
  } catch (error) {
    console.error('Booking error:', error);
    return { success: false, error: 'Failed to create booking' };
  }
}

// Получить список всех лидов для выпадающего списка
export async function getLeadsList(organizationId: string) {
  return await prisma.$queryRaw`
    SELECT * FROM "Lead" 
    WHERE "organizationId" = ${organizationId} 
    ORDER BY "createdAt" DESC
  `;
}
