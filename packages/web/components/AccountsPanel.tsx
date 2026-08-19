'use client';

import type { AccountSummary, PostWithMetrics } from '@/lib/api-types';

interface Props {
  accounts: AccountSummary[] | null;
  selected: { platform: string; username: string } | null;
  posts: PostWithMetrics[] | null;
  onSelect: (account: AccountSummary) => void;
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

export function AccountsPanel({ accounts, selected, posts, onSelect }: Props) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Hesaplar ve Veriler</h2>

      {accounts === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-500">
          Henüz veri yok — yukarıdan ilk taramanızı başlatın. Taranan hesaplar
          ve gönderileri burada listelenir.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">Hesap</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Gönderi</th>
                <th className="py-2 pr-4">Son gönderi</th>
                <th className="py-2 pr-4">Son tarama</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isSelected =
                  selected?.platform === account.platform &&
                  selected.username === account.username;
                return (
                  <tr
                    key={`${account.platform}:${account.username}`}
                    className="border-b border-slate-800/60"
                  >
                    <td className="py-2 pr-4 font-medium">
                      @{account.username}
                      <span className="ml-2 text-xs text-slate-500">
                        {account.platform}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {account.role === 'me' ? 'Benim hesabım' : 'Rakip'}
                    </td>
                    <td className="py-2 pr-4">{account.postCount}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      {account.lastPostedAt ? formatDate(account.lastPostedAt) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {account.sweptAt ? formatDate(account.sweptAt) : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onSelect(account)}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400"
                      >
                        {isSelected ? 'Yenile' : 'Gönderileri Gör'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-slate-300">
            @{selected.username} gönderileri
          </h3>
          {posts === null ? (
            <p className="text-sm text-slate-500">Yükleniyor…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-slate-500">Bu hesap için gönderi bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">Tarih</th>
                    <th className="py-2 pr-4">Tür</th>
                    <th className="py-2 pr-4">Beğeni</th>
                    <th className="py-2 pr-4">Yorum</th>
                    <th className="py-2 pr-4">Görüntülenme</th>
                    <th className="py-2 pr-4">İçerik</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b border-slate-800/60 align-top">
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
        </div>
      )}
    </section>
  );
}
