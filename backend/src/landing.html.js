/** Branded HTML landing for browsers (JSON stays available via Accept / ?format=json). */
export function renderLandingHtml({
  brand,
  tagline,
  visionTokenMint,
  treasuryPublicKey,
  expoWebUrl,
}) {
  const short = (v, n = 4) =>
    v && v.length > n * 2 + 1 ? `${v.slice(0, n)}…${v.slice(-n)}` : v;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${brand} — Landing</title>
  <style>
    :root {
      --onyx: #0B0B0C;
      --surface: #121316;
      --ink: #F4F7F8;
      --muted: #8A9199;
      --cyan: #00F0FF;
      --neon: #7CFFB2;
      --border: rgba(255,255,255,0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse at top, rgba(0,240,255,0.12), transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(124,255,178,0.08), transparent 46%),
        var(--onyx);
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 48px 24px 64px;
    }
    .brand {
      color: var(--cyan);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 700;
    }
    h1 {
      margin: 10px 0 8px;
      font-size: clamp(2rem, 5vw, 3.1rem);
      line-height: 1.1;
    }
    .tagline { color: var(--muted); font-size: 1.05rem; max-width: 36rem; }
    .grid {
      display: grid;
      gap: 16px;
      margin-top: 36px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
    }
    .card h2 { margin: 0 0 8px; font-size: 1.15rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.95rem; line-height: 1.45; }
    .meta {
      margin-top: 28px;
      padding: 16px 18px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: rgba(18,19,22,0.8);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.7;
    }
    .meta strong { color: var(--ink); font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      border-radius: 999px;
      padding: 12px 18px;
      font-weight: 700;
      font-size: 14px;
    }
    a.primary { background: var(--cyan); color: var(--onyx); }
    a.ghost {
      border: 1px solid var(--border);
      color: var(--ink);
      background: transparent;
    }
    .badge {
      display: inline-block;
      margin-top: 14px;
      color: var(--neon);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <main>
    <div class="brand">${brand}</div>
    <h1>${tagline}</h1>
    <p class="tagline">
      Protocolo local pronto: Carteira Fortaleza (SOL + $VISION) e Copiloto de Voz
      com expo-audio + VAD. Backend nesta porta; app Expo em ${expoWebUrl}.
    </p>
    <div class="badge">Auto-custódia • Mint + tesouraria on-chain</div>

    <div class="grid">
      <section class="card">
        <h2>Carteira Fortaleza</h2>
        <p>Saldo SOL e $VISION, QR do endereço local e chaves no dispositivo.</p>
      </section>
      <section class="card">
        <h2>Copiloto de Voz</h2>
        <p>Escuta com expo-audio e detecção de fala (VAD) por nível de microfone.</p>
      </section>
      <section class="card">
        <h2>API local</h2>
        <p>Health, config, balances e esta landing em <code>/api/landing</code>.</p>
      </section>
    </div>

    <div class="actions">
      <a class="btn primary" href="${expoWebUrl}/wallet">Abrir Carteira</a>
      <a class="btn ghost" href="${expoWebUrl}/copilot">Abrir Copiloto</a>
      <a class="btn ghost" href="/api/landing?format=json">JSON</a>
      <a class="btn ghost" href="/health">Health</a>
    </div>

    <div class="meta">
      <div><strong>VISION_TOKEN_MINT</strong> ${visionTokenMint} (${short(visionTokenMint)})</div>
      <div><strong>TREASURY_PUBLIC_KEY</strong> ${treasuryPublicKey} (${short(treasuryPublicKey)})</div>
      <div><strong>Expo Web</strong> ${expoWebUrl}</div>
    </div>
  </main>
</body>
</html>`;
}
