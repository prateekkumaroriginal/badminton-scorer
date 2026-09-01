'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://agile-schnauzer-858.convex.cloud';

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured.');
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
