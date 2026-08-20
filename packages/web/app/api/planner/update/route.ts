import { NextResponse } from 'next/server';

import { openDbWritable } from '@/lib/server/db';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    id?: number;
    action?: string;
    postId?: string;
  } | null;

  const id = Number(body?.id);
  const action = body?.action;
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    (action !== 'link' && action !== 'skip') ||
    (action === 'link' && !body?.postId)
  ) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json({ error: 'Veritabanı henüz hazır değil.' }, { status: 409 });
  }

  try {
    if (action === 'link') {
      db.prepare(
        "UPDATE planned_posts SET status = 'published', linked_post_id = ? WHERE id = ?",
      ).run(body?.postId, id);
    } else {
      db.prepare(
        "UPDATE planned_posts SET status = 'skipped', linked_post_id = NULL WHERE id = ?",
      ).run(id);
    }
  } catch {
    return NextResponse.json(
      { error: 'Planlayıcı tablosu eksik; veritabanı güncellemesi gerekiyor.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
