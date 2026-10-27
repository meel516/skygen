import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['@modelcontextprotocol/sdk', 'esbuild'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "zod/v3": "zod"
    };
    return config;
  },
  // Acknowledge Turbopack is being used (required in Next.js 16)
  turbopack: {
    resolveAlias: {
      "zod/v3": "zod",
    },
    root: __dirname,
  },
};

export default nextConfig;
