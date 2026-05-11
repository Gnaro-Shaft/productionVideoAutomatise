import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages export TS source — Next must transpile them
  transpilePackages: ['@pva/shared-types', '@pva/sdk-ts'],

  // Allow MinIO images (localhost on dev, LAN IPs when split across machines)
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      { protocol: 'http', hostname: '192.168.1.15', port: '9000' },
      { protocol: 'http', hostname: '192.168.1.55', port: '9000' },
    ],
  },

  // Allowed dev origins for cross-origin requests in dev mode (Next.js 15+)
  allowedDevOrigins: [
    '192.168.1.15',
    '192.168.1.55',
    'localhost',
  ],
};

export default nextConfig;
