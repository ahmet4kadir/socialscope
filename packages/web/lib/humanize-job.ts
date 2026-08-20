import type { JobView } from './api-types';

// Translates raw collector CLI output into sentences a non-technical user
// understands. The raw log stays available in the technical view.

export interface FriendlyJobStatus {
  message: string;
  detail?: string;
  tone: 'progress' | 'success' | 'error';
}

const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string; detail?: string }> = [
  {
    pattern: /No saved (instagram|x) session/i,
    message: 'Bu platform için kayıtlı oturum bulunamadı.',
    detail: 'Oturum bölümünden giriş yapın, ardından işlemi tekrar deneyin.',
  },
  {
    pattern: /login\/challenge page/i,
    message: 'Oturum geçersiz veya süresi dolmuş görünüyor.',
    detail: 'Oturum bölümünden yeniden giriş yapın.',
  },
  {
    pattern: /Captured 0 posts/i,
    message: 'Hesaptan gönderi alınamadı.',
    detail: 'Hesap gizli olabilir, hiç gönderisi olmayabilir ya da kullanıcı adı hatalı olabilir.',
  },
  {
    pattern: /Another scrape session/i,
    message: 'Şu anda başka bir işlem sürüyor.',
    detail: 'Önce onun bitmesini bekleyin, sonra tekrar deneyin.',
  },
  {
    pattern: /Could not launch the scraper browser/i,
    message: 'Tarama motoru başlatılamadı.',
    detail: 'Kurulum eksik olabilir; teknik görünümdeki ayrıntıyı sistem yöneticinizle paylaşın.',
  },
  {
    pattern: /post may be deleted\/private|Unrecognized .* post URL/i,
    message: 'Gönderiye ulaşılamadı.',
    detail: 'Gönderi silinmiş veya gizli olabilir; bağlantıyı kontrol edin.',
  },
  {
    pattern: /window was closed before login/i,
    message: 'Tarayıcı penceresi giriş tamamlanmadan kapatıldı.',
    detail: 'Giriş butonuna yeniden tıklayıp işlemi tamamlayın.',
  },
  {
    pattern: /Timed out .* waiting for login/i,
    message: 'Giriş için tanınan süre doldu.',
    detail: 'Giriş butonuna yeniden tıklayıp tekrar deneyin.',
  },
];

export function humanizeJob(job: JobView): FriendlyJobStatus {
  const text = job.lines.join('\n');

  if (job.status === 'running') {
    switch (job.kind) {
      case 'login':
        return {
          tone: 'progress',
          message: 'Açılan tarayıcı penceresinde hesabınıza giriş yapın.',
          detail: 'Giriş tamamlanınca pencere kendiliğinden kapanır ve oturum kaydedilir.',
        };
      case 'track':
        return {
          tone: 'progress',
          message: 'Gönderi verisi alınıyor…',
          detail: 'Bu işlem bir dakika kadar sürebilir.',
        };
      default:
        return {
          tone: 'progress',
          message: 'Hesap taranıyor…',
          detail:
            'Tarama, gerçek bir kullanıcı gibi yavaş ilerler; birkaç dakika sürebilir.',
        };
    }
  }

  if (job.status === 'failed') {
    for (const { pattern, message, detail } of ERROR_PATTERNS) {
      if (pattern.test(text)) {
        return { tone: 'error', message, ...(detail ? { detail } : {}) };
      }
    }
    return {
      tone: 'error',
      message: 'İşlem tamamlanamadı.',
      detail: 'Ayrıntıyı görmek için teknik görünüme geçebilirsiniz.',
    };
  }

  // Succeeded: pull the numbers out of the CLI's summary lines.
  if (/Skipping @/i.test(text)) {
    return {
      tone: 'success',
      message: 'Bu hesap son 6 saat içinde zaten taranmış.',
      detail: 'Veriler güncel; bir sonraki tarama otomatik olarak yapılır.',
    };
  }
  const captured = /Captured (\d+) post/.exec(text);
  if (captured) {
    const followers = /, ([\d.,]+) followers/.exec(text);
    return {
      tone: 'success',
      message: `${captured[1]} gönderi başarıyla alındı.`,
      detail: followers
        ? `Takipçi sayısı da kaydedildi: ${Number(followers[1]).toLocaleString('tr-TR')}.`
        : undefined,
    };
  }
  if (/Logged in/i.test(text)) {
    return {
      tone: 'success',
      message: 'Giriş başarılı, oturum kaydedildi.',
      detail: 'Artık bu platformda tarama yapabilirsiniz.',
    };
  }
  if (/Tracking instagram:|Tracking x:/i.test(text)) {
    return {
      tone: 'success',
      message: 'Gönderi takibe alındı.',
      detail: 'Saatlik ölçümler Takip sekmesinde birikecek.',
    };
  }
  if (/Already tracking/i.test(text)) {
    return { tone: 'success', message: 'Bu gönderi zaten takipte.' };
  }
  return { tone: 'success', message: 'İşlem tamamlandı.' };
}
