import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@tensorflow/tfjs-node', 'canvas'],
  output: 'standalone',
};

export default nextConfig;
