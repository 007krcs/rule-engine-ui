/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ['@platform/core-runtime', '@platform/schema', '@platform/component-system'],
};

export default nextConfig;
