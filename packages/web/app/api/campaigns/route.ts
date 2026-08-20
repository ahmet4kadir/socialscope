import { NextResponse } from 'next/server';

import type { Platform } from '@socialscope/shared';

import { openDbReadonly, openDbWritable } from '@/lib/server/db';

export interface CampaignMemberView {
  postId: string;
  platform: Platform;
  username: string;
  postedAt: string;
  snippet: string;
  engagement: number;
}

export interface CampaignView {
  id: number;
  name: string;
  createdAt: string;
  postCount: number;
  totalEngagement: number;
  avgEngagement: number | null;
  totalViews: number | null;
  members: CampaignMemberView[];
}

export interface CampaignCandidate {
  postId: string;
  platform: Platform;
  username: string;
  postedAt: string;
  snippet: string;
}

const SCHEMA_HINT = 'Kampanya tabloları eksik, `npm run migrate` çalıştırın.';

export function GET(): NextResponse {
  const db = openDbReadonly();
  if (!db) return NextResponse.json({ campaigns: [], candidates: [] });

  try {
    const campaigns = db
      .prepare('SELECT id, name, created_at FROM campaigns ORDER BY created_at DESC')
      .all() as Array<{ id: number; name: string; created_at: string }>;

    const memberStmt = db.prepare(
      `SELECT p.id AS post_id, p.platform, p.username, p.posted_at,
              substr(p.content_text, 1, 60) AS snippet,
              (s.likes + s.comments + COALESCE(s.shares, 0)) AS engagement,
              s.views
       FROM campaign_posts cp
       JOIN posts p ON p.id = cp.post_id
       JOIN snapshots s
         ON s.post_id = p.id
        AND s.captured_at = (SELECT MAX(captured_at) FROM snapshots WHERE post_id = p.id)
       WHERE cp.campaign_id = ?
       ORDER BY p.posted_at DESC`,
    );

    const views: CampaignView[] = campaigns.map((campaign) => {
      const members = memberStmt.all(campaign.id) as Array<{
        post_id: string;
        platform: Platform;
        username: string;
        posted_at: string;
        snippet: string;
        engagement: number;
        views: number | null;
      }>;
      const totalEngagement = members.reduce((sum, m) => sum + m.engagement, 0);
      const viewValues = members
        .map((m) => m.views)
        .filter((v): v is number => v !== null);
      return {
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.created_at,
        postCount: members.length,
        totalEngagement,
        avgEngagement:
          members.length > 0
            ? Math.round((totalEngagement / members.length) * 100) / 100
            : null,
        totalViews:
          viewValues.length > 0 ? viewValues.reduce((sum, v) => sum + v, 0) : null,
        members: members.map((m) => ({
          postId: m.post_id,
          platform: m.platform,
          username: m.username,
          postedAt: m.posted_at,
          snippet: m.snippet,
          engagement: m.engagement,
        })),
      };
    });

    const candidates = (
      db
        .prepare(
          `SELECT id AS post_id, platform, username, posted_at,
                  substr(content_text, 1, 60) AS snippet
           FROM posts ORDER BY posted_at DESC LIMIT 200`,
        )
        .all() as Array<{
        post_id: string;
        platform: Platform;
        username: string;
        posted_at: string;
        snippet: string;
      }>
    ).map((row) => ({
      postId: row.post_id,
      platform: row.platform,
      username: row.username,
      postedAt: row.posted_at,
      snippet: row.snippet,
    }));

    return NextResponse.json({ campaigns: views, candidates });
  } catch {
    return NextResponse.json({ campaigns: [], candidates: [], error: SCHEMA_HINT });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim() ?? '';
  if (name === '' || name.length > 80) {
    return NextResponse.json(
      { error: 'Kampanya adı 1-80 karakter olmalı.' },
      { status: 400 },
    );
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json(
      { error: 'Veritabanı henüz yok, önce `npm run migrate` çalıştırın.' },
      { status: 409 },
    );
  }
  try {
    db.prepare('INSERT INTO campaigns (name, created_at) VALUES (?, ?)').run(
      name,
      new Date().toISOString(),
    );
  } catch {
    return NextResponse.json({ error: SCHEMA_HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export function DELETE(request: Request): NextResponse {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Geçersiz kampanya.' }, { status: 400 });
  }
  const db = openDbWritable();
  if (!db) return NextResponse.json({ ok: true });
  try {
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
  } catch {
    return NextResponse.json({ error: SCHEMA_HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
