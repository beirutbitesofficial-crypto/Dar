import type { Metadata } from 'next';
import { BRAND } from '@dar/shared';
import { getT } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND.name.ar} · ${BRAND.name.en} — Admin`,
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
