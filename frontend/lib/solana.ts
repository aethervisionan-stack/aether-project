import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { TREASURY_PUBLIC_KEY, VISION_TOKEN_MINT } from '@/lib/config';

export const FORTALEZA_SECRET_STORAGE_KEY = 'aether-fortaleza-secret';
export const TREASURY_WALLET = TREASURY_PUBLIC_KEY;
export const VISION_MINT_ADDRESS = VISION_TOKEN_MINT;

const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

let cachedConnection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = new Connection(RPC_ENDPOINTS[0], 'confirmed');
  }
  return cachedConnection;
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export async function getOrCreateLocalWallet(): Promise<Keypair> {
  const existing = await AsyncStorage.getItem(FORTALEZA_SECRET_STORAGE_KEY);
  if (existing) {
    return Keypair.fromSecretKey(bs58.decode(existing));
  }
  const keypair = Keypair.generate();
  await AsyncStorage.setItem(
    FORTALEZA_SECRET_STORAGE_KEY,
    bs58.encode(keypair.secretKey),
  );
  return keypair;
}

export async function getSolBalance(publicKeyStr: string): Promise<number> {
  const connection = getSolanaConnection();
  const lamports = await connection.getBalance(new PublicKey(publicKeyStr));
  return lamports / LAMPORTS_PER_SOL;
}

async function readTokenBalance(
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey,
): Promise<number | null> {
  try {
    const connection = getSolanaConnection();
    const ata = await getAssociatedTokenAddress(mint, owner, false, programId);
    await getAccount(connection, ata, 'confirmed', programId);
    const bal = await connection.getTokenAccountBalance(ata);
    return Number(bal.value.uiAmount ?? 0);
  } catch {
    return null;
  }
}

export async function getVisionBalance(publicKeyStr: string): Promise<number> {
  const owner = new PublicKey(publicKeyStr);
  const mint = new PublicKey(VISION_MINT_ADDRESS);

  const token2022 = await readTokenBalance(owner, mint, TOKEN_2022_PROGRAM_ID);
  if (token2022 != null) return token2022;

  const classic = await readTokenBalance(owner, mint, TOKEN_PROGRAM_ID);
  return classic ?? 0;
}
