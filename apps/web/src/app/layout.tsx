import './globals.css';
import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-whatsapp-bot.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Caldera — Self-Hosted Private WhatsApp Automation Bot',
    template: '%s | Caldera Bot',
  },
  description:
    'Production-grade self-hosted WhatsApp multi-device bot with AES-256 session encryption at rest, prefix commands, media conversion, and zero-telemetry defaults.',
  keywords: [
    'WhatsApp Bot',
    'Self-Hosted WhatsApp Automation',
    'Baileys Multi-Device Bot',
    'TypeScript WhatsApp Bot',
    'Private Automation Tool',
    'Caldera Design System',
  ],
  authors: [{ name: 'Caldera Core Team' }],
  creator: 'Caldera Automation',
  publisher: 'Caldera Automation',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    title: 'Caldera — Self-Hosted Private WhatsApp Automation Bot',
    description:
      'Private self-hosted WhatsApp multi-device bot control center running AES-256 encryption at rest and strict zero-telemetry privacy defaults.',
    siteName: 'Caldera Bot',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Caldera WhatsApp Bot Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Caldera — Self-Hosted Private WhatsApp Automation Bot',
    description:
      'Private self-hosted WhatsApp multi-device bot control center running AES-256 encryption at rest and strict zero-telemetry privacy defaults.',
    images: [`${siteUrl}/og-image.png`],
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Caldera WhatsApp Bot',
    operatingSystem: 'Linux, Windows, macOS',
    applicationCategory: 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Self-hosted, single-user private WhatsApp multi-device automation bot with AES-256 session encryption at rest and Caldera design dashboard.',
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning className="bg-[#e2e2df] text-[#070607] antialiased min-h-screen font-sans font-medium">
        {children}
      </body>
    </html>
  );
}
