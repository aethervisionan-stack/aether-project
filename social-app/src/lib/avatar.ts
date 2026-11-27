/** SVG avatar data URLs for local testing (no external assets). */
export function avatarDataUrl(initials: string, bg: string, fg = "#F5F0E8"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${bg}"/>
    <stop offset="100%" stop-color="${bg}cc"/>
  </linearGradient></defs>
  <rect width="240" height="240" fill="url(#g)"/>
  <circle cx="120" cy="96" r="44" fill="${fg}" opacity="0.92"/>
  <ellipse cx="120" cy="210" rx="72" ry="54" fill="${fg}" opacity="0.92"/>
  <text x="120" y="108" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="700" fill="${bg}">${initials}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
