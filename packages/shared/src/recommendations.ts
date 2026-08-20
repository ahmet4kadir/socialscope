import type { AccountMetrics } from './metrics/account';
import type { MediaTypeMetric } from './metrics/account';
import { bestHeatmapSlot, type HeatmapCell } from './metrics/heatmap';
import type { HashtagMetric } from './metrics/hashtags';
import type { LengthBucketMetric } from './metrics/content-length';

// Rule-based recommendation engine: every recommendation is derived from the
// computed metrics and cites its evidence. No LLM involved, deliberately
// deterministic and auditable. Output text is Turkish (the product's UI
// language); the rules themselves are language-independent.

export type RecommendationCategory =
  | 'zamanlama'
  | 'içerik'
  | 'sıklık'
  | 'hashtag'
  | 'büyüme'
  | 'etkileşim';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  advice: string;
  evidence: string;
}

export interface CompetitorSummary {
  username: string;
  avgEngagement: number | null;
  postingFrequencyPerWeek: number | null;
  followers: number | null;
  topHashtags: string[];
}

export interface RecommendationInput {
  username: string;
  metrics: AccountMetrics;
  heatmap: HeatmapCell[];
  media: MediaTypeMetric[];
  hashtags: HashtagMetric[];
  contentLength: LengthBucketMetric[];
  followers: { current: number | null; growth: number | null };
  competitors: CompetitorSummary[];
}

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
  image: 'görsel',
  video: 'video',
  carousel: 'albüm (carousel)',
  text: 'metin',
  unknown: 'diğer',
};

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const fmt = (value: number): string => value.toLocaleString('tr-TR');

export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];

  bestHourRule(input, out);
  mediaTypeRule(input, out);
  cadenceRule(input, out);
  hashtagRules(input, out);
  captionLengthRule(input, out);
  followerGrowthRule(input, out);
  engagementRateRule(input, out);

  return out.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/** Post at your proven best slot, when it clearly beats your average. */
function bestHourRule(input: RecommendationInput, out: Recommendation[]): void {
  const overall = input.metrics.avgEngagement;
  const best = bestHeatmapSlot(input.heatmap);
  if (!best || best.avgEngagement === null || overall === null || overall <= 0) return;
  if (best.avgEngagement < overall * 1.15) return;

  const slot = `${DAY_NAMES[best.dayOfWeek]} ${String(best.hour).padStart(2, '0')}:00`;
  out.push({
    id: 'best-hour',
    category: 'zamanlama',
    priority: 'high',
    title: `En güçlü saatiniz: ${slot}`,
    advice: `Yeni gönderilerinizi ${slot} civarına planlayın, bu saat dilimindeki gönderileriniz hesap ortalamanızın belirgin üstünde performans gösteriyor.`,
    evidence: `${slot} ortalama etkileşimi ${fmt(best.avgEngagement)} (${best.count} gönderi); hesap ortalaması ${fmt(overall)}.`,
  });
}

/** Lean into the format that outperforms, when the gap is real. */
function mediaTypeRule(input: RecommendationInput, out: Recommendation[]): void {
  const ranked = input.media
    .filter((m) => m.avgEngagement !== null && m.count >= 2)
    .sort((a, b) => (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0));
  if (ranked.length < 2) return;

  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;
  if ((best.avgEngagement ?? 0) < (worst.avgEngagement ?? 0) * 1.2) return;

  const ratio = (best.avgEngagement ?? 0) / Math.max(worst.avgEngagement ?? 1, 1);
  out.push({
    id: 'media-type',
    category: 'içerik',
    priority: ratio >= 1.5 ? 'high' : 'medium',
    title: `${MEDIA_NAMES[best.mediaType] ?? best.mediaType} içerikler öne çıkıyor`,
    advice: `İçerik planınızda ${MEDIA_NAMES[best.mediaType] ?? best.mediaType} türüne ağırlık verin; ${MEDIA_NAMES[worst.mediaType] ?? worst.mediaType} türü belirgin şekilde geride kalıyor.`,
    evidence: `${MEDIA_NAMES[best.mediaType] ?? best.mediaType}: ort. ${fmt(best.avgEngagement ?? 0)} etkileşim (${best.count} gönderi); ${MEDIA_NAMES[worst.mediaType] ?? worst.mediaType}: ort. ${fmt(worst.avgEngagement ?? 0)} (${worst.count} gönderi).`,
  });
}

/** Competitors that post much more often set the cadence benchmark. */
function cadenceRule(input: RecommendationInput, out: Recommendation[]): void {
  const mine = input.metrics.postingFrequencyPerWeek;
  const fastest = input.competitors
    .filter((c) => c.postingFrequencyPerWeek !== null)
    .sort((a, b) => (b.postingFrequencyPerWeek ?? 0) - (a.postingFrequencyPerWeek ?? 0))[0];
  if (!fastest || fastest.postingFrequencyPerWeek === null) return;
  if (mine !== null && fastest.postingFrequencyPerWeek < mine * 1.5) return;

  out.push({
    id: 'cadence',
    category: 'sıklık',
    priority: 'high',
    title: 'Paylaşım sıklığınız rakiplerin gerisinde',
    advice: `Haftalık paylaşım sayınızı kademeli olarak artırın; düzenli içerik akışı hem erişimi hem takipçi büyümesini besler. @${fastest.username} temposu iyi bir kıyas noktası.`,
    evidence: `Siz: ${mine === null ? 'haftada 1’den az' : `haftada ${fmt(mine)}`}; @${fastest.username}: haftada ${fmt(fastest.postingFrequencyPerWeek)}.`,
  });
}

/** Start using hashtags, or double down on the ones that work. */
function hashtagRules(input: RecommendationInput, out: Recommendation[]): void {
  if (input.hashtags.length === 0) {
    const withTags = input.competitors.find((c) => c.topHashtags.length > 0);
    if (!withTags) return;
    out.push({
      id: 'hashtag-start',
      category: 'hashtag',
      priority: 'medium',
      title: 'Hiç hashtag kullanmıyorsunuz',
      advice: `Gönderilerinize alanınızla ilgili 3-5 hashtag ekleyin, keşfet erişiminin en ucuz yolu. Başlangıç için rakibinizin kullandıklarına bakabilirsiniz: ${withTags.topHashtags.map((t) => `#${t}`).join(' ')}.`,
      evidence: `Sizin gönderilerinizde hashtag yok; @${withTags.username} düzenli olarak ${withTags.topHashtags.map((t) => `#${t}`).join(', ')} kullanıyor.`,
    });
    return;
  }

  const proven = input.hashtags.filter((t) => t.count >= 2 && t.avgEngagement !== null);
  const top = proven[0];
  const overall = input.metrics.avgEngagement;
  if (!top || overall === null || (top.avgEngagement ?? 0) < overall * 1.15) return;
  out.push({
    id: 'hashtag-top',
    category: 'hashtag',
    priority: 'medium',
    title: `#${top.hashtag} sizin için çalışıyor`,
    advice: `#${top.hashtag} etiketini kullanmaya devam edin ve benzer etiketler deneyin, bu etiketli gönderileriniz ortalamanın üstünde.`,
    evidence: `#${top.hashtag} ile ort. ${fmt(top.avgEngagement ?? 0)} etkileşim (${top.count} gönderi); hesap ortalaması ${fmt(overall)}.`,
  });
}

/** Caption length sweet spot, when the data shows one. */
function captionLengthRule(input: RecommendationInput, out: Recommendation[]): void {
  const ranked = input.contentLength
    .filter((b) => b.avgEngagement !== null && b.count >= 2)
    .sort((a, b) => (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0));
  if (ranked.length < 2) return;
  const best = ranked[0]!;
  const rest = ranked.slice(1);
  const restAvg =
    rest.reduce((sum, b) => sum + (b.avgEngagement ?? 0), 0) / rest.length;
  if ((best.avgEngagement ?? 0) < restAvg * 1.2) return;

  const label =
    best.bucket === '0'
      ? 'açıklamasız'
      : best.bucket === '301+'
        ? '301+ karakterlik uzun'
        : `${best.bucket} karakterlik`;
  out.push({
    id: 'caption-length',
    category: 'içerik',
    priority: 'low',
    title: `${label} açıklamalar daha iyi performans gösteriyor`,
    advice: `Gönderi açıklamalarınızı bu uzunluk aralığında tutmayı deneyin.`,
    evidence: `${label} gönderiler ort. ${fmt(best.avgEngagement ?? 0)} etkileşim (${best.count} gönderi); diğer uzunlukların ortalaması ${fmt(Math.round(restAvg * 100) / 100)}.`,
  });
}

/** Losing followers is the one alarm that should never be silent. */
function followerGrowthRule(input: RecommendationInput, out: Recommendation[]): void {
  const { current, growth } = input.followers;
  if (growth === null || growth >= 0) return;
  out.push({
    id: 'follower-drop',
    category: 'büyüme',
    priority: 'high',
    title: 'Takipçi kaybı yaşanıyor',
    advice:
      'Son dönemdeki içerik değişikliklerinizi gözden geçirin; en çok etkileşim alan içerik türünüze ve saatlerinize geri dönün, düzenli paylaşımı koruyun.',
    evidence: `Son iki tarama arasında ${fmt(Math.abs(growth))} takipçi kaybı${current !== null ? ` (güncel: ${fmt(current)})` : ''}.`,
  });
}

/**
 * Engagement per 1000 followers, the fair way to compare accounts of very
 * different sizes. Praises real strength, flags a real gap.
 */
function engagementRateRule(input: RecommendationInput, out: Recommendation[]): void {
  const mine = perThousand(input.metrics.avgEngagement, input.followers.current);
  if (mine === null) return;
  const rated = input.competitors
    .map((c) => ({ username: c.username, rate: perThousand(c.avgEngagement, c.followers) }))
    .filter((c): c is { username: string; rate: number } => c.rate !== null)
    .sort((a, b) => b.rate - a.rate);
  const top = rated[0];
  if (!top) return;

  if (mine >= top.rate * 1.2) {
    out.push({
      id: 'engagement-rate-strong',
      category: 'etkileşim',
      priority: 'low',
      title: 'Etkileşim oranınız rakiplerden güçlü',
      advice:
        'Takipçi başına etkileşimde öndesiniz, büyüme için içerik kalitesinden ödün vermeden erişimi (sıklık, hashtag, paylaşım saati) artırmaya odaklanabilirsiniz.',
      evidence: `Sizde 1.000 takipçi başına ${fmt(mine)} etkileşim; en yakın rakip @${top.username} ${fmt(top.rate)}.`,
    });
  } else if (top.rate >= mine * 1.2) {
    out.push({
      id: 'engagement-rate-weak',
      category: 'etkileşim',
      priority: 'medium',
      title: 'Takipçi başına etkileşim rakibin altında',
      advice: `@${top.username} hesabının içerik formatlarını ve etkileşim çağrılarını (soru sorma, yorum teşviki) inceleyin; kitleniz benzer olduğu için uygulanabilir fikirler çıkacaktır.`,
      evidence: `Sizde 1.000 takipçi başına ${fmt(mine)} etkileşim; @${top.username} ${fmt(top.rate)}.`,
    });
  }
}

function perThousand(
  avgEngagement: number | null,
  followers: number | null,
): number | null {
  if (avgEngagement === null || followers === null || followers <= 0) return null;
  return Math.round((avgEngagement / followers) * 1000 * 100) / 100;
}
