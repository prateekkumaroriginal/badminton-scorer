import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConvexClientProvider } from './convex-client-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000'),
  title: 'Badminton Scorer',
  description: 'Record badminton scores and export a timed SRT track for Filmora.',
  openGraph: {
    title: 'Rallyframe',
    description: 'Badminton scoring, timed for Filmora',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Rallyframe badminton scorer' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rallyframe',
    description: 'Badminton scoring, timed for Filmora',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
