'use client';

import type { PostWithMetrics } from '@/lib/api-types';

interface Props {
  account: { platform: string; username: string };
  posts: PostWithMetrics[] | null;
  busy: boolean;
  onTrack: (post: PostWithMetrics) => void;
}

const MEDIA_LABELS: Record<string, string> = {
  image: 'Görsel',
  video: 'Video',
  carousel: 'Albüm',
  text: 'Metin',
  unknown: 'Bilinmiyor',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatCount(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('tr-TR');
}

export function PostsPanel({ account, posts, busy, onTrack }: Props) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">@{account.username} gönderileri</h2>

      {posts === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-500">
          Bu hesap için gönderi yok, önce bir tarama çalıştırın.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3" />
                <th className="py-2 pr-4">Tarih</th>
                <th className="py-2 pr-4">Tür</th>
                <th className="py-2 pr-4">Beğeni</th>
                <th className="py-2 pr-4">Yorum</th>
                <th className="py-2 pr-4">Görüntülenme</th>
                <th className="py-2 pr-4">İçerik</th>
                <th className="py-2 pr-4">Takip</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-slate-800/60 align-middle">
                  <td className="py-2 pr-3">
                    {post.thumbnailUrl ? (
                      // Plain <img>: platform CDN URLs are signed and
                      // temporary, so no next/image optimization cache.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="h-12 w-12 rounded-md object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-800 text-lg">
                        {post.mediaType === 'video' ? '🎬' : '🖼️'}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-400">
                    {formatDate(post.postedAt)}
                  </td>
                  <td className="py-2 pr-4">
                    {MEDIA_LABELS[post.mediaType] ?? post.mediaType}
                  </td>
                  <td className="py-2 pr-4">{formatCount(post.likes)}</td>
                  <td className="py-2 pr-4">{formatCount(post.comments)}</td>
                  <td className="py-2 pr-4">{formatCount(post.views)}</td>
                  <td className="max-w-xs py-2 pr-4 text-slate-400">
                    <span className="line-clamp-2">
                      {post.contentText || <em className="text-slate-600">açıklama yok</em>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {post.tracking === 'active' ? (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        Takipte
                      </span>
                    ) : post.tracking === 'stopped' ? (
                      <span className="rounded-full bg-slate-700/40 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                        Takip bitti
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onTrack(post)}
                        disabled={busy}
                        className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Takibe Al
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-emerald-400 hover:underline"
                    >
                      Gönderiye git ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
