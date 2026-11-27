/**
 * Três signos básicos no cliente.
 * Preciso: Sol pela faixa de datas tropicais.
 * Estimado: Lua e Ascendente sem hora/latitude reais (cálculo fixo + meio-dia se a hora for desconhecida).
 */
import { SIGN_ORDER, ZODIAC_DATA, getSunSign, ELEMENT_COLORS } from '../data/zodiacData.js';

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function calculateFullTriad(dateStr, timeStr, unknownTime, name, city) {
  const [, month, day] = dateStr.split('-').map(Number);
  const sun = getSunSign(month, day);
  const time = unknownTime ? '12:00' : timeStr || '12:00';
  const [hh, mm] = time.split(':').map(Number);
  const seed = hashString(`${dateStr}|${time}|${(name || '').toLowerCase()}|${(city || '').toLowerCase()}`);
  const sunIdx = SIGN_ORDER.indexOf(sun);
  const moonIdx = (sunIdx + (seed % 12) + Math.floor(day / 3)) % 12;
  const hourOffset = Math.floor(hh + mm / 60) / 2 + (seed % 5);
  const ascIdx = (sunIdx + Math.floor(hourOffset)) % 12;
  return {
    sun,
    moon: SIGN_ORDER[moonIdx],
    asc: SIGN_ORDER[ascIdx],
    estimatedTime: !!unknownTime,
    precision: {
      sun: 'certo pela data (faixa do Sol no zodíaco tropical)',
      moon: 'estimativa no navegador — não é a Lua real do céu naquele dia',
      asc: 'estimativa — Ascendente de verdade precisa de hora e lugar de nascimento',
    },
  };
}

export function elementalBalance(sun, moon, asc) {
  const counts = { Fogo: 0, Terra: 0, Ar: 0, Água: 0 };
  [sun, moon, asc].forEach((s) => {
    counts[ZODIAC_DATA[s].element]++;
  });
  return Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, Math.round((v / 3) * 100)])
  );
}

export function renderNatalWheelSVG(sun, moon, asc) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 110;
  let slices = '';
  SIGN_ORDER.forEach((sign, i) => {
    const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const el = ZODIAC_DATA[sign].element;
    const color = ELEMENT_COLORS[el];
    const mid = (a0 + a1) / 2;
    const lx = cx + (r - 22) * Math.cos(mid);
    const ly = cy + (r - 22) * Math.sin(mid);
    slices += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z" fill="${color}" fill-opacity="0.18" stroke="rgba(212,175,55,0.35)" stroke-width="0.8"/>`;
    slices += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#F3E5AB" font-size="11">${ZODIAC_DATA[sign].glyph}</text>`;
  });

  function marker(sign, color, radius) {
    const idx = SIGN_ORDER.indexOf(sign);
    const ang = ((idx + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const x = cx + radius * Math.cos(ang);
    const y = cy + radius * Math.sin(ang);
    return `<circle cx="${x}" cy="${y}" r="7" fill="${color}" stroke="#0B0D17" stroke-width="2"/>`;
  }

  return `
    <svg viewBox="0 0 ${size} ${size}" class="w-full max-w-[280px]" aria-label="Roda do mapa">
      <circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="1"/>
      ${slices}
      <circle cx="${cx}" cy="${cy}" r="36" fill="#121629" stroke="#D4AF37" stroke-width="1.2"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#F3E5AB" font-family="Cinzel" font-size="10">MAPA</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="#9D4EDD" font-size="9">✦</text>
      ${marker(sun, '#D4AF37', 78)}
      ${marker(moon, '#9D4EDD', 62)}
      ${marker(asc, '#7EB6D9', 48)}
      <g font-size="9" fill="#E8E6F0" font-family="Plus Jakarta Sans">
        <circle cx="24" cy="${size - 36}" r="5" fill="#D4AF37"/><text x="34" y="${size - 32}">Sol</text>
        <circle cx="24" cy="${size - 20}" r="5" fill="#9D4EDD"/><text x="34" y="${size - 16}">Lua</text>
        <circle cx="90" cy="${size - 28}" r="5" fill="#7EB6D9"/><text x="100" y="${size - 24}">ASC</text>
      </g>
    </svg>`;
}
