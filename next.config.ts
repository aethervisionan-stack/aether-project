import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Try Live / preview often hits 127.0.0.1 while the server binds as localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["@neondatabase/serverless"],
  transpilePackages: [
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-backpack",
  ],
};

export default nextConfig;
