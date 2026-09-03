import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverSourceMaps: false,
  },
};

export default nextConfig;
