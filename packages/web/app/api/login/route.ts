import { NextResponse } from 'next/server';

import { startJob } from '@/lib/server/jobs';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
  } | null;

  if (body?.platform !== 'instagram' && body?.platform !== 'x') {
    return NextResponse.json({ error: 'Geçersiz platform.' }, { status: 400 });
  }
  const platform = body.platform;

  const result = startJob(
    'login',
    platform === 'x' ? 'X (Twitter) girişi' : 'Instagram girişi',
    ['--platform', platform],
  );
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ job: result.job });
}
