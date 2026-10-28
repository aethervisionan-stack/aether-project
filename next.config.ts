import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-backpack",
  ],
};

export default nextConfig;
