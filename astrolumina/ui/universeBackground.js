/**
 * Living cosmos backdrop: dense starfield, nebula glow, shooting stars.
 * Single canvas, pointer-events none, prefers-reduced-motion aware.
 */

const MIDNIGHT = '#0B0D17';
const STAR_COLORS = [
  '255,255,255',
  '243,229,171',
  '212,175,55',
  '157,78,221',
  '210,190,255',
];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createStars(count, rand, depth) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(),
      y: rand(),
      r: (0.4 + rand() * 1.8) * (depth === 0 ? 1.15 : depth === 1 ? 0.9 : 0.65),
      a: 0.25 + rand() * 0.75,
      tw: rand() * Math.PI * 2,
      twSpeed: 0.4 + rand() * 1.6,
      color: STAR_COLORS[(rand() * STAR_COLORS.length) | 0],
      depth,
    });
  }
  return stars;
}

function createNebulae(rand) {
  return [
    { x: 0.22, y: 0.18, rx: 0.42, ry: 0.28, color: '123,44,191', a: 0.22, phase: rand() * Math.PI * 2, speed: 0.08 },
    { x: 0.78, y: 0.55, rx: 0.38, ry: 0.32, color: '123,44,191', a: 0.16, phase: rand() * Math.PI * 2, speed: 0.06 },
    { x: 0.55, y: 0.82, rx: 0.35, ry: 0.24, color: '212,175,55', a: 0.08, phase: rand() * Math.PI * 2, speed: 0.05 },
    { x: 0.12, y: 0.72, rx: 0.28, ry: 0.22, color: '157,78,221', a: 0.14, phase: rand() * Math.PI * 2, speed: 0.07 },
    { x: 0.88, y: 0.12, rx: 0.3, ry: 0.2, color: '90,40,160', a: 0.12, phase: rand() * Math.PI * 2, speed: 0.045 },
  ];
}

function spawnMeteor(w, h, rand) {
  const fromLeft = rand() > 0.35;
  const startX = fromLeft ? -40 - rand() * 80 : w * (0.15 + rand() * 0.7);
  const startY = fromLeft ? h * (rand() * 0.55) : -30 - rand() * 40;
  const angle = fromLeft
    ? (18 + rand() * 28) * (Math.PI / 180)
    : (35 + rand() * 40) * (Math.PI / 180);
  const speed = 520 + rand() * 680;
  return {
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed * (fromLeft ? 1 : 0.85),
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 0.55 + rand() * 0.55,
    len: 70 + rand() * 140,
    width: 1 + rand() * 1.6,
    gold: rand() > 0.55,
  };
}

export function mountUniverseBackground(root = document.body) {
  const existing = document.getElementById('universe-bg');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'universe-bg';
  wrap.className = 'universe-bg';
  wrap.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'universe-bg__canvas';
  wrap.appendChild(canvas);

  const veil = document.createElement('div');
  veil.className = 'universe-bg__veil';
  wrap.appendChild(veil);

  const staticField = document.querySelector('.starfield');
  if (staticField) {
    staticField.replaceWith(wrap);
  } else {
    root.prepend(wrap);
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  const rand = mulberry32(0xa57e01);
  let dpr = 1;
  let w = 0;
  let h = 0;
  let starsFar = [];
  let starsMid = [];
  let starsNear = [];
  let nebulae = [];
  let meteors = [];
  let raf = 0;
  let last = 0;
  let meteorCooldown = 0.4;
  let scrollY = 0;
  let reduced = prefersReducedMotion();
  let running = true;

  function rebuild() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const area = w * h;
    const density = Math.min(1.35, Math.max(0.7, area / (1400 * 900)));
    starsFar = createStars(Math.floor(220 * density), rand, 2);
    starsMid = createStars(Math.floor(160 * density), rand, 1);
    starsNear = createStars(Math.floor(90 * density), rand, 0);
    nebulae = createNebulae(rand);
    meteors = [];
    meteorCooldown = 0.3;
  }

  function drawNebulae(t) {
    for (const n of nebulae) {
      const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * n.speed + n.phase);
      const gx = n.x * w + (reduced ? 0 : Math.sin(t * n.speed * 0.4 + n.phase) * 18);
      const gy = n.y * h + (reduced ? 0 : Math.cos(t * n.speed * 0.35 + n.phase) * 12);
      const rx = n.rx * w;
      const ry = n.ry * h;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(rx, ry));
      g.addColorStop(0, `rgba(${n.color},${n.a * pulse})`);
      g.addColorStop(0.45, `rgba(${n.color},${n.a * 0.35 * pulse})`);
      g.addColorStop(1, `rgba(${n.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStarLayer(stars, t, parallax) {
    const ox = reduced ? 0 : Math.sin(t * 0.03) * 12 * parallax;
    const oy = reduced
      ? 0
      : Math.cos(t * 0.025) * 8 * parallax + scrollY * 0.018 * parallax;
    for (const s of stars) {
      const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * s.twSpeed + s.tw);
      const x = ((s.x * w + ox) % w + w) % w;
      const y = ((s.y * h + oy) % h + h) % h;
      const alpha = s.a * tw;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${s.color},${alpha})`;
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.4 && !reduced) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.color},${alpha * 0.25})`;
        ctx.arc(x, y, s.r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const fade = Math.max(0, 1 - m.life / m.maxLife);
      if (fade <= 0 || m.x > w + 200 || m.y > h + 200) {
        meteors.splice(i, 1);
        continue;
      }
      const mag = Math.hypot(m.vx, m.vy) || 1;
      const tx = (m.vx / mag) * m.len;
      const ty = (m.vy / mag) * m.len;
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - tx, m.y - ty);
      if (m.gold) {
        grad.addColorStop(0, `rgba(243,229,171,${0.95 * fade})`);
        grad.addColorStop(0.35, `rgba(212,175,55,${0.55 * fade})`);
        grad.addColorStop(1, 'rgba(123,44,191,0)');
      } else {
        grad.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
        grad.addColorStop(0.4, `rgba(210,190,255,${0.45 * fade})`);
        grad.addColorStop(1, 'rgba(123,44,191,0)');
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - tx, m.y - ty);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = m.gold
        ? `rgba(243,229,171,${0.9 * fade})`
        : `rgba(255,255,255,${0.9 * fade})`;
      ctx.arc(m.x, m.y, m.width * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintStatic() {
    ctx.fillStyle = MIDNIGHT;
    ctx.fillRect(0, 0, w, h);
    drawNebulae(0);
    drawStarLayer(starsFar, 0, 0.25);
    drawStarLayer(starsMid, 0, 0.55);
    drawStarLayer(starsNear, 0, 1);
  }

  function frame(now) {
    if (!running) return;
    const t = now * 0.001;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    ctx.fillStyle = MIDNIGHT;
    ctx.fillRect(0, 0, w, h);
    drawNebulae(t);
    drawStarLayer(starsFar, t, 0.25);
    drawStarLayer(starsMid, t, 0.55);
    drawStarLayer(starsNear, t, 1);

    if (!reduced) {
      meteorCooldown -= dt;
      if (meteorCooldown <= 0) {
        const burst = Math.random() > 0.72 ? 2 : 1;
        for (let i = 0; i < burst; i++) meteors.push(spawnMeteor(w, h, Math.random));
        meteorCooldown = 0.35 + Math.random() * 1.1;
      }
      drawMeteors(dt);
    }

    raf = requestAnimationFrame(frame);
  }

  function onScroll() {
    scrollY = window.scrollY || 0;
  }

  function onResize() {
    rebuild();
    if (reduced) paintStatic();
  }

  function onMotionChange(e) {
    reduced = e.matches;
    cancelAnimationFrame(raf);
    meteors = [];
    if (reduced) {
      paintStatic();
    } else {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onMotionChange);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduced && running) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  rebuild();
  onScroll();
  if (reduced) {
    paintStatic();
  } else {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    mq.removeEventListener('change', onMotionChange);
    wrap.remove();
  };
}
