import LeadsClient from './LeadsClient';
import { getLeadsBoard } from '@/app/actions/leads';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export default async function LeadsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  let organizationId = 'default';

  if (token) {
    const verified = await verifyToken(token).catch(() => ({ error: 'invalid_token' }));
    if (!('error' in verified) && verified.payload) {
      organizationId = verified.payload.organizationId || verified.payload.orgId || organizationId;
    }
  }

  const leads = await getLeadsBoard(organizationId);

  return (
    <LeadsClient leads={leads} organizationId={organizationId} />
  );
}
