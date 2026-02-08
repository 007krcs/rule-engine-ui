import createMDX from '@next/mdx';

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    mdxRs: true,
  },
};

export default withMDX(nextConfig);
