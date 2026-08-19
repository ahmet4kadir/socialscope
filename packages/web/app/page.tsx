const pipeline = [
  {
    step: 'npm run login',
    detail: 'Tarayıcıda bir kez elle giriş yapın; oturum kaydedilir',
  },
  {
    step: 'npm run scrape',
    detail: 'Kendi hesabınızın ve rakiplerin son gönderilerini çekin',
  },
  {
    step: 'npm run tracker',
    detail: 'Yeni gönderilerin ilk 48 saatini saatlik izleyin',
  },
  {
    step: 'npm run dev',
    detail: 'Metrikleri, karşılaştırmaları ve önerileri burada inceleyin',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">SocialScope</h1>
        <p className="text-lg text-slate-400">
          Sosyal medya pazarlama analizi — kendi hesaplarınızı ve rakiplerinizi
          tarayın, gönderi performansını saat saat takip edin, veriyi somut
          önerilere dönüştürün.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          İş akışı
        </h2>
        <ol className="space-y-2">
          {pipeline.map(({ step, detail }, index) => (
            <li
              key={step}
              className="flex items-baseline gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <span className="text-sm font-medium text-slate-500">
                {index + 1}
              </span>
              <div>
                <code className="text-sm font-semibold text-emerald-400">
                  {step}
                </code>
                <p className="text-sm text-slate-400">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-slate-500">
        Veritabanına veri düştüğünde panel canlanır — başlamak için en az bir
        hesap tarayın.
      </p>
    </main>
  );
}
