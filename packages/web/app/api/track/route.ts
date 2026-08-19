import { NextResponse } from 'next/server';

import { derivePostId, type Platform } from '@socialscope/shared';

import { startJob } from '@/lib/server/jobs';

function platformFromUrl(url: string): Platform | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'instagram.com') return 'instagram';
    if (host === 'x.com' || host === 'twitter.com') return 'x';
  } catch {
    // Not a URL at all.
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim() ?? '';

  const platform = platformFromUrl(url);
  if (!platform || !derivePostId(platform, url)) {
    return NextResponse.json(
      { error: 'Geçerli bir Instagram veya X gönderi bağlantısı girin.' },
      { status: 400 },
    );
  }

  const result = startJob('track', 'Gönderi takibe alınıyor', ['--url', url]);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ job: result.job });
}
