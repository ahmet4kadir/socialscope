import { NextResponse } from 'next/server';

import { openDbWritable } from '@/lib/server/db';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    campaignId?: number;
    postId?: string;
    action?: string;
  } | null;

  const campaignId = Number(body?.campaignId);
  const postId = body?.postId ?? '';
  const action = body?.action;
  if (
    !Number.isInteger(campaignId) ||
    campaignId <= 0 ||
    postId === '' ||
    (action !== 'add' && action !== 'remove')
  ) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json(
      { error: 'Veritabanı henüz yok, önce `npm run migrate` çalıştırın.' },
      { status: 409 },
    );
  }

  try {
    if (action === 'add') {
      db.prepare(
        'INSERT OR IGNORE INTO campaign_posts (campaign_id, post_id) VALUES (?, ?)',
      ).run(campaignId, postId);
    } else {
      db.prepare(
        'DELETE FROM campaign_posts WHERE campaign_id = ? AND post_id = ?',
      ).run(campaignId, postId);
    }
  } catch {
    return NextResponse.json(
      { error: 'Kampanya tabloları eksik, `npm run migrate` çalıştırın.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
