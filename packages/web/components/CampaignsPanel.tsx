'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  CampaignCandidate,
  CampaignView,
} from '@/app/api/campaigns/route';
import { formatDateTime, formatNumber } from '@/lib/format';

export function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<CampaignView[] | null>(null);
  const [candidates, setCandidates] = useState<CampaignCandidate[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = (await res.json()) as {
        campaigns?: CampaignView[];
        candidates?: CampaignCandidate[];
        error?: string;
      };
      setCampaigns(data.campaigns ?? []);
      setCandidates(data.candidates ?? []);
      setWarning(data.error ?? null);
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function call(url: string, init: RequestInit): Promise<void> {
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'İşlem başarısız oldu.');
        return;
      }
      void refresh();
    } catch {
      setError('Sunucuya ulaşılamadı.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Kampanyalar</h2>
          <p className="text-sm text-slate-500">
            Gönderileri kampanyalara etiketleyin, performansı kampanya düzeyinde
            ölçün.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() === '') return;
            void call('/api/campaigns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            });
            setName('');
          }}
        >
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Yeni kampanya adı"
            className="w-48 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={name.trim() === ''}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Oluştur
          </button>
        </form>
      </div>

      {(error ?? warning) && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {error ?? warning}
        </p>
      )}

      {campaigns === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : campaigns.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-500">
            Henüz kampanya yok. Örneğin &quot;Yaz Lansmanı&quot; adında bir
            kampanya oluşturup ilgili gönderileri ekleyin — toplam ve ortalama
            performansı burada ölçülür.
          </p>
        </section>
      ) : (
        campaigns.map((campaign) => {
          const memberIds = new Set(campaign.members.map((m) => m.postId));
          const addable = candidates.filter((c) => !memberIds.has(c.postId));
          return (
            <section
              key={campaign.id}
              className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{campaign.name}</h3>
                  <p className="text-xs text-slate-500">
                    Oluşturulma: {formatDateTime(campaign.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void call(`/api/campaigns?id=${campaign.id}`, { method: 'DELETE' })
                  }
                  className="rounded-md border border-slate-800 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-rose-500 hover:text-rose-400"
                >
                  Kampanyayı Sil
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['Gönderi', formatNumber(campaign.postCount)],
                    ['Toplam etkileşim', formatNumber(campaign.totalEngagement)],
                    ['Ort. etkileşim', formatNumber(campaign.avgEngagement)],
                    ['Toplam görüntülenme', formatNumber(campaign.totalViews)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-950 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>

              {campaign.members.length > 0 && (
                <ul className="space-y-1">
                  {campaign.members.map((member) => (
                    <li
                      key={member.postId}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-300">
                        <span className="text-slate-500">@{member.username}</span>{' '}
                        {member.snippet || <em className="text-slate-600">açıklama yok</em>}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatNumber(member.engagement)} etkileşim
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void call('/api/campaigns/assign', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              campaignId: campaign.id,
                              postId: member.postId,
                              action: 'remove',
                            }),
                          })
                        }
                        className="shrink-0 text-xs text-slate-500 hover:text-rose-400"
                      >
                        Çıkar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {addable.length > 0 && (
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value === '') return;
                    void call('/api/campaigns/assign', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        campaignId: campaign.id,
                        postId: event.target.value,
                        action: 'add',
                      }),
                    });
                  }}
                  className="w-full rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-400 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">+ Gönderi ekle…</option>
                  {addable.map((candidate) => (
                    <option key={candidate.postId} value={candidate.postId}>
                      @{candidate.username} ·{' '}
                      {new Date(candidate.postedAt).toLocaleDateString('tr-TR')} ·{' '}
                      {candidate.snippet || 'açıklama yok'}
                    </option>
                  ))}
                </select>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
