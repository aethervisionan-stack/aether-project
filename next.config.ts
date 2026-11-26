import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Hide floating Next.js Dev Tools badge in local development.
  devIndicators: false,
  // Do not auto-write AGENTS.md on `next dev`.
  agentRules: false,
  // Dedicated local port for "quiz de QI" / aether IQ test: http://127.0.0.1:3010
  // (package.json `dev`/`start` use -p 3010; .env.local PORT + NEXT_PUBLIC_APP_URL).
  // Never kill other projects' listeners on 3000/5173/8000/etc.
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
