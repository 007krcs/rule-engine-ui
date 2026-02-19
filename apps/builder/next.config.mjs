/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: [
    '@platform/schema',
    '@platform/component-contract',
    '@platform/component-system',
    '@platform/plugin-sdk',
  ],
};

export default nextConfig;
