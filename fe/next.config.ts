import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
  transpilePackages: ['@solana/wallet-adapter-wallets'],
};

export default nextConfig;
