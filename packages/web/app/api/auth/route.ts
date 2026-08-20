import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.json({ ok: true }); // auth disabled

  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;
  if (body?.password !== password) {
    return NextResponse.json({ error: 'Şifre hatalı.' }, { status: 401 });
  }

  const token = createHash('sha256')
    .update(`socialscope:${password}`)
    .digest('hex');
  const response = NextResponse.json({ ok: true });
  response.cookies.set('socialscope_auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
