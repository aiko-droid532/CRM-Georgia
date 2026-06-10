import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getProjects } from '@/app/actions/units';
import { getLeadsList } from '@/app/actions/booking';
import ShakhmatkaClient from './ShakhmatkaClient';

export default async function ShakhmatkaPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const cookieStore = cookies();
  const token = searchParams.token || cookieStore.get('auth_token')?.value;
  
  let organizationId = 'default';
  
  if (token) {
    const { payload } = await verifyToken(token);
    if (payload && typeof payload !== 'string') {
      organizationId = (payload.app_metadata?.organization_id as string) || (payload.sub as string);
    }
  }

  // Загружаем данные параллельно
  const [projects, leads] = await Promise.all([
    getProjects(organizationId),
    getLeadsList(organizationId)
  ]);

  return (
    <ShakhmatkaClient 
      projects={projects} 
      leads={leads} 
      organizationId={organizationId} 
    />
  );
}
