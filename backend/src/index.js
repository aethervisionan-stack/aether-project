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
import { renderLandingHtml } from './landing.html.js';

const PORT = Number(process.env.PORT || 8000);
const VISION_TOKEN_MINT =
  process.env.VISION_TOKEN_MINT?.trim() ||
  '2iGxAEtYLYb8NBvtQEoPbuDZzTEezWzu7G3nYDrabftv';
const TREASURY_PUBLIC_KEY =
  process.env.TREASURY_PUBLIC_KEY?.trim() ||
  '9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911';
const EXPO_WEB_URL =
  process.env.EXPO_WEB_URL?.replace(/\/$/, '') || 'http://localhost:8081';
const EMERGENT_LLM_KEY = (process.env.EMERGENT_LLM_KEY || '').trim();
const LLM_LIVE =
  Boolean(EMERGENT_LLM_KEY) &&
  EMERGENT_LLM_KEY.toLowerCase() !== 'placeholder';

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL,
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean);

const connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');

const DEMO_BURNS = [
  {
    id: 'burn-1',
    amount: 125_000,
    ts: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    note: 'Buyback pos-presale - fase soft cap',
  },
  {
    id: 'burn-2',
    amount: 48_500,
    ts: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    note: 'Assinaturas app IA - ciclo semanal',
  },
  {
    id: 'burn-3',
    amount: 210_000,
    ts: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    note: 'Treasury rebalance - Vision 1.0',
  },
];

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

function landingPayload() {
  return {
    ok: true,
    brand: 'Aether Vision',
    tagline: 'Carteira Fortaleza + Copiloto de Voz + Burn',
    description:
      'App Expo local com auto-custódia SOL/$VISION, Voice Copilot (expo-audio + VAD) e Burn Tracker.',
    visionTokenMint: VISION_TOKEN_MINT,
    treasuryPublicKey: TREASURY_PUBLIC_KEY,
    expoWebUrl: EXPO_WEB_URL,
    llmMode: LLM_LIVE ? 'live' : 'mock',
    features: [
      {
        id: 'wallet',
        title: 'Carteira Fortaleza',
        href: '/wallet',
        summary: 'SOL + $VISION, QR e chaves no dispositivo',
      },
      {
        id: 'copilot',
        title: 'Copiloto de Voz',
        href: '/copilot',
        summary: 'expo-audio com VAD por metering + mock LLM',
      },
      {
        id: 'burn',
        title: 'Burn Tracker',
        href: '/burn',
        summary: 'Buyback & burn $VISION com histórico demo',
      },
    ],
    routes: {
      wallet: '/(tabs)/wallet',
      copilot: '/(tabs)/copilot',
      burn: '/(tabs)/burn',
      health: '/health',
      balances: '/api/balances/:address',
      prices: '/api/prices',
      burnApi: '/api/burn',
      copilotApi: '/api/copilot',
      config: '/api/config',
    },
  };
}

function wantsHtml(req) {
  const format = String(req.query.format || '').toLowerCase();
  if (format === 'json') return false;
  if (format === 'html') return true;
  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return false;
  }
  return true;
}

function sendLanding(req, res) {
  const data = landingPayload();
  if (wantsHtml(req)) {
    try {
      const html = renderLandingHtml({
        brand: data.brand,
        tagline: data.tagline,
        visionTokenMint: data.visionTokenMint,
        treasuryPublicKey: data.treasuryPublicKey,
        expoWebUrl: data.expoWebUrl,
      });
      res
        .status(200)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'no-store')
        .send(html);
    } catch (err) {
      console.error('[landing]', err);
      res
        .status(500)
        .set('Content-Type', 'text/html; charset=utf-8')
        .send('<!doctype html><title>Landing</title><p>Landing indisponível.</p>');
    }
    return;
  }
  res.status(200).json(data);
}

function mockCopilotReply(message) {
  const q = String(message || '').toLowerCase();
  if (q.includes('burn')) {
    return 'Burn Tracker (mock): ~383.5k $VISION queimados no histórico demo, com ~125k nas últimas 24h via buyback pós-presale.';
  }
  if (q.includes('carteira') || q.includes('wallet') || q.includes('saldo')) {
    return 'Carteira Fortaleza (mock): saldos vêm da API local com fallback RPC; envio é simulado nesta demo.';
  }
  return 'Aether Vision Copilot (mock): Carteira Fortaleza, Copiloto de Voz com VAD e Burn Tracker estão online. Defina EMERGENT_LLM_KEY para IA real.';
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'aether-vision-backend',
    mint: VISION_TOKEN_MINT,
    treasury: TREASURY_PUBLIC_KEY,
    llmMode: LLM_LIVE ? 'live' : 'mock',
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    visionTokenMint: VISION_TOKEN_MINT,
    treasuryPublicKey: TREASURY_PUBLIC_KEY,
    expoWebUrl: EXPO_WEB_URL,
    llmMode: LLM_LIVE ? 'live' : 'mock',
  });
});

app.get('/', sendLanding);
app.get('/api/landing', sendLanding);

app.get('/api/prices', (_req, res) => {
  res.json({
    solUsd: 150,
    visionUsd: 0.05,
    source: 'mock',
  });
});

app.get('/api/burn', (_req, res) => {
  const burned24h = DEMO_BURNS.filter(
    (b) => Date.now() - Date.parse(b.ts) < 1000 * 60 * 60 * 24,
  ).reduce((sum, b) => sum + b.amount, 0);
  res.json({
    totalBurned: DEMO_BURNS.reduce((sum, b) => sum + b.amount, 0),
    burned24h,
    recentBurns: DEMO_BURNS,
    source: 'mock',
  });
});

app.post('/api/copilot', (req, res) => {
  const message = req.body?.message || '';
  if (LLM_LIVE) {
    // Real Emergent/Anthropic wiring lives outside this demo scaffold.
    res.json({
      reply: mockCopilotReply(message),
      mode: 'live',
      model: 'emergent-placeholder',
    });
    return;
  }
  res.json({
    reply: mockCopilotReply(message),
    mode: 'mock',
    model: 'aether-demo-llm',
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

    try {
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
        source: 'backend',
      });
    } catch (rpcErr) {
      console.warn('[balances] RPC failed, serving demo balances', rpcErr);
      res.json({
        address,
        sol: 1.25,
        vision: 1050,
        treasury: TREASURY_PUBLIC_KEY,
        mint: VISION_TOKEN_MINT,
        source: 'demo',
      });
    }
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
  console.log(`  EXPO_WEB_URL=${EXPO_WEB_URL}`);
  console.log(`  LLM_MODE=${LLM_LIVE ? 'live' : 'mock'}`);
});
