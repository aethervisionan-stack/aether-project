import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Quiz landing is local-first: prefer http://127.0.0.1:3000 (npm run dev).
  // allowedDevOrigins keeps Cross-Origin warnings quiet if preview hits localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["@neondatabase/serverless"],
  // Wallet adapters only load under /aether — still listed so that route builds cleanly.
  transpilePackages: [
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-backpack",
  ],
};

export default nextConfig;
