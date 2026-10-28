import { cookies } from 'next/headers';
import { cookieName, decode } from '../../../../server/marketplace.mjs';
import { handleBrokeredZoomRequest } from '../../../../server/zoom-broker.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function handle(request: Request) {
  const claims = decode((await cookies()).get(cookieName)?.value || '');
  return handleBrokeredZoomRequest(request, process.env, claims);
}
export { handle as GET, handle as POST };
