import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { handleZoomRequest } from '../../../../server/zoom.mjs';

export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  return handleZoomRequest(request, env, await getChatGPTUser());
}
export { handle as GET, handle as POST };
