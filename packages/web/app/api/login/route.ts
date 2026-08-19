import { NextResponse } from 'next/server';

import { startJob } from '@/lib/server/jobs';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
  } | null;

  if (body?.platform === 'x') {
    return NextResponse.json(
      { error: 'X (Twitter) girişi 3. aşamada geliyor — şimdilik yalnızca Instagram.' },
      { status: 400 },
    );
  }
  if (body?.platform !== 'instagram') {
    return NextResponse.json({ error: 'Geçersiz platform.' }, { status: 400 });
  }

  const result = startJob('login', 'Instagram girişi', ['--platform', 'instagram']);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ job: result.job });
}
