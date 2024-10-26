import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },

  // 添加 Vercel 特定的配置
  serverRuntimeConfig: {
    maxDuration: 300, // 5 minutes in seconds
  }

  /* config options here */
};

export default nextConfig;
