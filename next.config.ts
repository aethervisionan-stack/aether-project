import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Hide floating Next.js Dev Tools badge in local development.
  devIndicators: false,
  // Do not auto-write AGENTS.md on `next dev`.
  agentRules: false,
  // Dedicated local port for aether-project: http://127.0.0.1:3010 (see scripts/dev-with-port.mjs).
  // Prefer PORT=3010 in .env.local; if busy, the launcher picks the next free port — never kills others.
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
