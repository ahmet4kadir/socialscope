import type { Database } from 'better-sqlite3';

import { bestHeatmapSlot, type Platform } from '@socialscope/shared';

import {
  analyzeAccount,
  loadRegistry,
  recommendationsFor,
} from './analysis';

// Single-page markdown report of the full analysis — the shareable artifact
// of the whole pipeline. Turkish, like the rest of the user-facing output.

const DAY_NAMES: Record<number, string> = {
  0: 'Pazar',
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
};

const MEDIA_NAMES: Record<string, string> = {
  image: 'Görsel',
  video: 'Video',
  carousel: 'Albüm',
  text: 'Metin',
  unknown: 'Bilinmiyor',
};

const PRIORITY_NAMES = { high: 'Yüksek', medium: 'Orta', low: 'Bilgi' } as const;

const num = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString('tr-TR');

export function generateReport(db: Database | null): string {
  const now = new Date();
  const lines: string[] = [
    '# SocialScope Analiz Raporu',
    '',
    `_Oluşturulma: ${now.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}_`,
    '',
  ];

  const registry = db ? loadRegistry(db) : [];
  if (!db || registry.length === 0) {
    lines.push(
      'Henüz analiz edilecek veri yok. Panelden bir hesap ekleyip tarama',
      'çalıştırdıktan sonra bu rapor otomatik olarak dolar.',
    );
    return lines.join('\n');
  }

  const analyses = registry.map((account) => ({
    account,
    analysis: analyzeAccount(db, account.platform, account.username),
  }));

  // --- Hesap özeti ---------------------------------------------------------
  lines.push('## Hesap Özeti', '');
  lines.push(
    '| Hesap | Rol | Takipçi | Ort. Etkileşim | Gönderi/Hafta | İncelenen / Profil Gönderi |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  );
  for (const { account, analysis } of analyses) {
    const followers = analysis.followers.filter((p) => p.followers !== null);
    const latest = followers[followers.length - 1]?.followers ?? null;
    lines.push(
      `| @${account.username} (${account.platform}) | ${account.role === 'me' ? 'Benim' : 'Rakip'} | ${num(latest)} | ${num(analysis.metrics.avgEngagement)} | ${num(analysis.metrics.postingFrequencyPerWeek)} | ${num(analysis.metrics.postCount)} / ${num(analysis.profilePostCount)} |`,
    );
  }
  lines.push('');

  // --- Hesap detayları -----------------------------------------------------
  for (const { account, analysis } of analyses) {
    lines.push(`## @${account.username} — Detaylı Analiz`, '');

    const best = bestHeatmapSlot(analysis.heatmap);
    if (best) {
      lines.push(
        `**En iyi paylaşım saati:** ${DAY_NAMES[best.dayOfWeek]} ${String(best.hour).padStart(2, '0')}:00 ` +
          `(ort. etkileşim ${num(best.avgEngagement)}, ${best.count} gönderi — Türkiye saati)`,
        '',
      );
    }

    if (analysis.media.length > 0) {
      lines.push('### İçerik Türü Performansı', '');
      lines.push('| Tür | Gönderi | Pay | Ort. Etkileşim |', '| --- | ---: | ---: | ---: |');
      for (const media of analysis.media) {
        lines.push(
          `| ${MEDIA_NAMES[media.mediaType] ?? media.mediaType} | ${media.count} | %${media.percentage.toLocaleString('tr-TR')} | ${num(media.avgEngagement)} |`,
        );
      }
      lines.push('');
    }

    if (analysis.hashtags.length > 0) {
      lines.push('### Hashtag Performansı (ilk 10)', '');
      lines.push('| Hashtag | Kullanım | Ort. Etkileşim |', '| --- | ---: | ---: |');
      for (const tag of analysis.hashtags.slice(0, 10)) {
        lines.push(`| #${tag.hashtag} | ${tag.count} | ${num(tag.avgEngagement)} |`);
      }
      lines.push('');
    }

    if (analysis.contentLength.length > 0) {
      lines.push('### Açıklama Uzunluğu ve Performans', '');
      lines.push('| Uzunluk | Gönderi | Ort. Etkileşim |', '| --- | ---: | ---: |');
      for (const bucket of analysis.contentLength) {
        lines.push(`| ${bucket.bucket} | ${bucket.count} | ${num(bucket.avgEngagement)} |`);
      }
      lines.push('');
    }
  }

  // --- Öneriler (yalnızca kendi hesaplar) ----------------------------------
  const myAccounts = registry.filter((account) => account.role === 'me');
  for (const account of myAccounts) {
    const recommendations = recommendationsFor(db, account.platform, account.username);
    if (recommendations.length === 0) continue;
    lines.push(`## Öneriler — @${account.username}`, '');
    for (const rec of recommendations) {
      lines.push(
        `- **[${PRIORITY_NAMES[rec.priority]}] ${rec.title}** — ${rec.advice}`,
        `  - _Kanıt: ${rec.evidence}_`,
      );
    }
    lines.push('');
  }

  appendTracking(db, lines);
  appendCampaigns(db, lines);
  appendGoals(db, lines);

  lines.push('---', '', '_Bu rapor SocialScope tarafından yerel verilerden otomatik üretildi._');
  return lines.join('\n');
}

function appendTracking(db: Database, lines: string[]): void {
  interface Row {
    post_id: string;
    username: string;
    platform: Platform;
    posted_at: string;
    active: 0 | 1;
    auto_stop_at: string;
    snap_count: number;
  }
  let rows: Row[];
  try {
    rows = db
      .prepare(
        `SELECT tp.post_id, tp.active, tp.auto_stop_at, p.username, p.platform, p.posted_at,
                (SELECT COUNT(*) FROM snapshots s WHERE s.post_id = tp.post_id) AS snap_count
         FROM tracked_posts tp JOIN posts p ON p.id = tp.post_id
         ORDER BY tp.tracking_started_at DESC`,
      )
      .all() as Row[];
  } catch {
    return;
  }
  if (rows.length === 0) return;

  const now = new Date().toISOString();
  lines.push('## Takip Edilen Gönderiler', '');
  lines.push('| Gönderi | Hesap | Paylaşım | Durum | Ölçüm |', '| --- | --- | --- | --- | ---: |');
  for (const row of rows) {
    const status = row.active === 1 && row.auto_stop_at > now ? 'Takipte' : 'Tamamlandı';
    lines.push(
      `| ${row.post_id} | @${row.username} | ${new Date(row.posted_at).toLocaleDateString('tr-TR')} | ${status} | ${row.snap_count} |`,
    );
  }
  lines.push('');
}

function appendCampaigns(db: Database, lines: string[]): void {
  interface Row {
    name: string;
    post_count: number;
    total_engagement: number | null;
  }
  let rows: Row[];
  try {
    rows = db
      .prepare(
        `SELECT c.name, COUNT(cp.post_id) AS post_count,
                SUM(s.likes + s.comments + COALESCE(s.shares, 0)) AS total_engagement
         FROM campaigns c
         LEFT JOIN campaign_posts cp ON cp.campaign_id = c.id
         LEFT JOIN snapshots s
           ON s.post_id = cp.post_id
          AND s.captured_at = (SELECT MAX(captured_at) FROM snapshots WHERE post_id = cp.post_id)
         GROUP BY c.id ORDER BY c.created_at DESC`,
      )
      .all() as Row[];
  } catch {
    return;
  }
  if (rows.length === 0) return;

  lines.push('## Kampanyalar', '');
  lines.push('| Kampanya | Gönderi | Toplam Etkileşim |', '| --- | ---: | ---: |');
  for (const row of rows) {
    lines.push(`| ${row.name} | ${row.post_count} | ${num(row.total_engagement)} |`);
  }
  lines.push('');
}

function appendGoals(db: Database, lines: string[]): void {
  interface Row {
    username: string;
    platform: Platform;
    metric: string;
    target: number;
  }
  let rows: Row[];
  try {
    rows = db
      .prepare('SELECT username, platform, metric, target FROM goals ORDER BY created_at DESC')
      .all() as Row[];
  } catch {
    return;
  }
  if (rows.length === 0) return;

  const metricNames: Record<string, string> = {
    followers: 'Takipçi',
    avg_engagement: 'Ort. etkileşim',
    posting_frequency: 'Haftalık gönderi',
  };
  lines.push('## Hedefler', '');
  for (const row of rows) {
    lines.push(
      `- @${row.username} (${row.platform}): ${metricNames[row.metric] ?? row.metric} hedefi ${num(row.target)}`,
    );
  }
  lines.push('');
}
