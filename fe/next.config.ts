import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@solana/wallet-adapter-wallets'],
};

export default nextConfig;
