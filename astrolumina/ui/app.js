import { SIGN_ORDER, ZODIAC_DATA } from '../data/zodiacData.js';
import { mountSignExplorer } from './signExplorer.js';
import { mountCompatibilityUI } from './compatibilityUI.js';
import { mountNatalUI } from './natalUI.js';
import { mountDualCompatUI } from './dualCompatUI.js';
import { mountUniverseBackground } from './universeBackground.js';

function buildHeroMandala() {
  const ticks = document.getElementById('zodiac-ticks');
  const stars = document.getElementById('inner-stars');
  if (!ticks || !stars) return;
  SIGN_ORDER.forEach((sign, i) => {
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x1 = 200 + 138 * Math.cos(ang);
    const y1 = 200 + 138 * Math.sin(ang);
    const x2 = 200 + 150 * Math.cos(ang);
    const y2 = 200 + 150 * Math.sin(ang);
    const tx = 200 + 165 * Math.cos(ang);
    const ty = 200 + 165 * Math.sin(ang);
    ticks.innerHTML += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#D4AF37" stroke-width="1" opacity="0.7"/>`;
    ticks.innerHTML += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="#F3E5AB" font-size="12" opacity="0.85">${ZODIAC_DATA[sign].glyph}</text>`;
  });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const x = 200 + 70 * Math.cos(ang);
    const y = 200 + 70 * Math.sin(ang);
    stars.innerHTML += `<circle cx="${x}" cy="${y}" r="2" fill="#9D4EDD" opacity="0.8"/>`;
  }
}

function setupMobileMenu() {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuOverlay = document.getElementById('menu-overlay');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');

  function setMenu(open) {
    mobileMenu.classList.toggle('open', open);
    menuOverlay.classList.toggle('hidden', !open);
    iconOpen.classList.toggle('hidden', open);
    iconClose.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  menuBtn.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  menuOverlay.addEventListener('click', () => setMenu(false));
  document.querySelectorAll('.mobile-nav').forEach((a) => a.addEventListener('click', () => setMenu(false)));
}

function setupNavSpy() {
  const sections = ['inicio', 'mapa', 'signos', 'casal', 'sinastria'];
  const navLinks = document.querySelectorAll('.nav-link');
  window.addEventListener('scroll', () => {
    const y = window.scrollY + 120;
    let current = 'inicio';
    for (const id of sections) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (y >= el.offsetTop) current = id;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) {
      current = 'sinastria';
    }
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  mountUniverseBackground(document.body);
  buildHeroMandala();
  setupMobileMenu();
  setupNavSpy();
  mountNatalUI(document.getElementById('mapa'));
  mountDualCompatUI(document.getElementById('casal'));

  const compat = mountCompatibilityUI(document.getElementById('sinastria'));
  mountSignExplorer(document.getElementById('signos'), {
    onOpenPair: (a, b) => compat.setPair(a, b),
  });
});
