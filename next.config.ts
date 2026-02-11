import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // OpenNext Cloudflare adapter handles the build output
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
