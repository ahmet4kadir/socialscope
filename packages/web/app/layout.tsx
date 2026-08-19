import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'SocialScope',
  description:
    'Sosyal medya pazarlama analizi: gönderi takibi, metrikler ve LLM destekli öneriler',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
