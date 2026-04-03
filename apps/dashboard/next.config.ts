import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@claude-agent/shared'],
};

export default nextConfig;
