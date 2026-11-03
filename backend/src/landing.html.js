import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const landingFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'index.html',
);

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Static Emergent landing. Tokens are filled per request; JSON stays on ?format=json. */
export function renderLandingHtml({
  brand,
  tagline,
  visionTokenMint,
  treasuryPublicKey,
  expoWebUrl,
}) {
  const html = fs.readFileSync(landingFile, 'utf8');
  const tokens = {
    '{{BRAND}}': esc(brand),
    '{{TAGLINE}}': esc(tagline),
    '{{EXPO_WEB_URL}}': esc(expoWebUrl),
    '{{VISION_TOKEN_MINT}}': esc(visionTokenMint),
    '{{TREASURY_PUBLIC_KEY}}': esc(treasuryPublicKey),
  };
  return Object.entries(tokens).reduce(
    (doc, [token, value]) => doc.replaceAll(token, value),
    html,
  );
}
