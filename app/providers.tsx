"use client";

import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

export function AppProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SOLANA_RPC ??
      clusterApiUrl(WalletAdapterNetwork.Mainnet),
    [],
  );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new BackpackWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
