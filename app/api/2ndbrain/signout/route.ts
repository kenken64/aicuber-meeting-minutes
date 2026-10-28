import { NextResponse } from 'next/server';
import { cookieName } from '../../../../server/marketplace.mjs';
export function GET() {
  const response = new NextResponse('Signed out. Launch Meeting Minutes again from AI CUBER.', { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(cookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
