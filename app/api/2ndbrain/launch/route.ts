import { NextResponse } from 'next/server';
import { active, cookieName, decode, encode } from '../../../../server/marketplace.mjs';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('launch_token') || '';
  const claims = decode(token, true);
  if (!claims || !(await active(claims))) return new NextResponse('Launch session invalid or unavailable. Launch again from AI CUBER.', { status: 401, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  const session = encode({ ...claims, exp: Math.floor(Date.now() / 1000) + 8 * 3600 });
  // A relative Location keeps the browser on the public origin, even when the
  // server's request URL contains Railway's internal 0.0.0.0 bind address.
  const response = new NextResponse(null, { status: 303, headers: { Location: '/' } });
  response.cookies.set(cookieName, session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 3600 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
