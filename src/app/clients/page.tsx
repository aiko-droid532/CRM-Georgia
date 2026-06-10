import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getLeads } from '@/app/actions/leads';
import LeadsClient from './LeadsClient';

export default async function LeadsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  let organizationId = 'default';
  
  if (token) {
    try {
      const { payload } = await verifyToken(token);
      if (payload && typeof payload !== 'string') {
        organizationId = (payload.app_metadata?.organization_id as string) || (payload.sub as string);
      }
    } catch (e) {
      console.error('Token verification failed:', e);
    }
  }

  const leads = await getLeads(organizationId);

  return <LeadsClient initialLeads={leads} organizationId={organizationId} />;
}
