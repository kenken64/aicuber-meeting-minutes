import { NextRequest, NextResponse } from 'next/server';
import { active, cookieName, decode } from './server/marketplace.mjs';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith('/_next/') || path === '/api/health' || path === '/api/2ndbrain/launch' || path === '/api/2ndbrain/signout') return NextResponse.next();
  const claims = decode(request.cookies.get(cookieName)?.value || '');
  if (!claims || !(await active(claims))) return new NextResponse('Session unavailable. Launch Meeting Minutes from AI CUBER.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.next();
}
export const config = { matcher: '/:path*' };
