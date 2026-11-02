import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const PORT = Number(process.env.PORT || 8000);
const VISION_TOKEN_MINT =
  process.env.VISION_TOKEN_MINT?.trim() ||
  '2iGxAEtYLYb8NBvtQEoPbuDZzTEezWzu7G3nYDrabftv';
const TREASURY_PUBLIC_KEY =
  process.env.TREASURY_PUBLIC_KEY?.trim() ||
  '9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911';

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL,
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean);

const connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');

async function readUiAmount(owner, mint, programId) {
  try {
    const ata = await getAssociatedTokenAddress(mint, owner, false, programId);
    const bal = await connection.getTokenAccountBalance(ata);
    return Number(bal.value.uiAmount ?? 0);
  } catch {
    return null;
  }
}

async function getVisionBalance(ownerStr) {
  const owner = new PublicKey(ownerStr);
  const mint = new PublicKey(VISION_TOKEN_MINT);
  const token2022 = await readUiAmount(owner, mint, TOKEN_2022_PROGRAM_ID);
  if (token2022 != null) return token2022;
  const classic = await readUiAmount(owner, mint, TOKEN_PROGRAM_ID);
  return classic ?? 0;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'aether-vision-backend',
    mint: VISION_TOKEN_MINT,
    treasury: TREASURY_PUBLIC_KEY,
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    visionTokenMint: VISION_TOKEN_MINT,
    treasuryPublicKey: TREASURY_PUBLIC_KEY,
  });
});

app.get('/api/landing', (_req, res) => {
  res.status(200).json({
    ok: true,
    brand: 'Aether Vision',
    tagline: 'Carteira Fortaleza + Voice Copilot',
    visionTokenMint: VISION_TOKEN_MINT,
    treasuryPublicKey: TREASURY_PUBLIC_KEY,
    routes: {
      wallet: '/(tabs)/wallet',
      copilot: '/(tabs)/copilot',
    },
  });
});

app.get('/api/balances/:address', async (req, res) => {
  try {
    const address = req.params.address?.trim();
    if (!address) {
      res.status(400).json({ error: 'address required' });
      return;
    }
    new PublicKey(address);

    const [lamports, vision] = await Promise.all([
      connection.getBalance(new PublicKey(address)),
      getVisionBalance(address),
    ]);

    res.json({
      address,
      sol: lamports / LAMPORTS_PER_SOL,
      vision,
      treasury: TREASURY_PUBLIC_KEY,
      mint: VISION_TOKEN_MINT,
    });
  } catch (err) {
    console.error('[balances]', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'balance lookup failed',
    });
  }
});

app.listen(PORT, () => {
  console.log(`[aether-vision-backend] http://localhost:${PORT}`);
  console.log(`  VISION_TOKEN_MINT=${VISION_TOKEN_MINT}`);
  console.log(`  TREASURY_PUBLIC_KEY=${TREASURY_PUBLIC_KEY}`);
});
