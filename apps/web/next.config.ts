import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages export TS source — Next must transpile them
  transpilePackages: ['@pva/shared-types', '@pva/sdk-ts'],

  // Allow MinIO localhost images via <img>
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost', port: '9000' }],
  },
};

export default nextConfig;
