import path from 'node:path';

const shared = path.resolve(process.cwd(), '../../packages/shared/src/index.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@dar/shared'],
  // Use the shared package's TypeScript source directly (no separate build step).
  webpack: (config) => {
    config.resolve.alias['@dar/shared'] = shared;
    return config;
  },
  turbopack: { resolveAlias: { '@dar/shared': '../../packages/shared/src/index.ts' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
