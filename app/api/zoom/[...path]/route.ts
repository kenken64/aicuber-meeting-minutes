import { cookies } from 'next/headers';
import { cookieName, decode } from '../../../../server/marketplace.mjs';
import { database } from '../../../../server/railway-db.mjs';
import { handleZoomRequest } from '../../../../server/zoom.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function handle(request: Request) {
  const claims = decode((await cookies()).get(cookieName)?.value || '');
  const user = claims ? { userId: claims.user_id, email: claims.email || '', displayName: claims.email || 'Your workspace' } : null;
  return handleZoomRequest(request, { ...process.env, DB: database() }, user);
}
export { handle as GET, handle as POST };
