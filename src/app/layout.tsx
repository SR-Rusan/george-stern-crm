import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { client } from '@/config/client';
import { brandCssVars } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: `${client.business.name} — Inquiries`,
  description: client.business.tagline,
  robots: { index: false, follow: false },
};

const brandStyle = `:root{${Object.entries(brandCssVars(client.brand.accent))
  .map(([k, v]) => `${k}:${v}`)
  .join(';')}}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandStyle }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-stone-900 antialiased selection:bg-brand/15 selection:text-stone-900">
        {children}
      </body>
    </html>
  );
}
