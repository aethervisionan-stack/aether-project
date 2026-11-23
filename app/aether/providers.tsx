"use client";

import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  getClientRpcEndpoint,
  PRIMARY_SOLANA_RPC,
  SOLANA_CONNECTION_CONFIG,
} from "@/lib/solana";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

/** Wallet stack only for the Aether Vision presale pages. */
export function AetherProviders({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const endpoint = useMemo(
    () => (ready ? getClientRpcEndpoint() : PRIMARY_SOLANA_RPC),
    [ready],
  );

  const wallets = useMemo(
    () =>
      ready
        ? [new PhantomWalletAdapter(), new BackpackWalletAdapter()]
        : [],
    [ready],
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={SOLANA_CONNECTION_CONFIG}>
      <WalletProvider wallets={wallets} autoConnect={ready}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
