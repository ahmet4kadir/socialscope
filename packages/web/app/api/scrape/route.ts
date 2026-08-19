import { NextResponse } from 'next/server';

import { startJob } from '@/lib/server/jobs';

const USERNAME_PATTERN = /^[a-z0-9._]{1,40}$/i;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
    username?: string;
    role?: string;
    force?: boolean;
  } | null;

  if (body?.platform !== 'instagram' && body?.platform !== 'x') {
    return NextResponse.json({ error: 'Geçersiz platform.' }, { status: 400 });
  }
  const platform = body.platform;

  const username = body.username?.replace(/^@/, '').trim().toLowerCase() ?? '';
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: 'Geçersiz kullanıcı adı — harf, rakam, nokta ve alt çizgi kullanın.' },
      { status: 400 },
    );
  }

  if (body.role !== 'me' && body.role !== 'competitor') {
    return NextResponse.json(
      { error: 'Hesap rolünü seçin: benim hesabım mı, rakip mi?' },
      { status: 400 },
    );
  }

  const args = [
    '--platform', platform,
    '--user', username,
    '--role', body.role,
  ];
  if (body.force === true) args.push('--force');

  const result = startJob('scrape', `@${username} taranıyor`, args);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ job: result.job });
}
