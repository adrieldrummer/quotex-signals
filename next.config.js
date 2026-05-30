/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  outputFileTracingIncludes: {
    '/api/signals/**/*': ['./lib/fonts/**/*'],
  },
};
module.exports = nextConfig;
