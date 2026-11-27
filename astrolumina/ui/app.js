import { SIGN_ORDER, ZODIAC_DATA } from '../data/zodiacData.js';
import { mountSignExplorer } from './signExplorer.js';
import { mountCompatibilityUI } from './compatibilityUI.js';
import { mountNatalUI } from './natalUI.js';
import { mountDualCompatUI } from './dualCompatUI.js';
import { mountUniverseBackground } from './universeBackground.js';

const SECTIONS = ['inicio', 'mapa-astral', 'signos', 'compatibilidade', 'casal', 'sobre'];

/** Legacy hashes from the long-scroll landing */
const HASH_ALIASES = {
  mapa: 'mapa-astral',
  sinastria: 'compatibilidade',
  about: 'sobre',
  footer: 'sobre',
};

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

  return { close: () => setMenu(false) };
}

function normalizeSection(raw) {
  const key = (raw || '').replace(/^#/, '').trim().toLowerCase();
  if (!key) return 'inicio';
  const aliased = HASH_ALIASES[key] || key;
  return SECTIONS.includes(aliased) ? aliased : 'inicio';
}

function showSection(sectionId, { updateHash = true } = {}) {
  const id = normalizeSection(sectionId);

  document.querySelectorAll('.app-panel').forEach((panel) => {
    const active = panel.dataset.panel === id;
    panel.classList.toggle('is-active', active);
    if (active) {
      panel.removeAttribute('hidden');
      const scroller = panel.querySelector('.panel-scroll');
      if (scroller) scroller.scrollTop = 0;
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  document.querySelectorAll('.nav-link, .section-tab, .mobile-nav').forEach((link) => {
    const target = normalizeSection(link.getAttribute('href') || link.dataset.section || '');
    link.classList.toggle('active', target === id);
  });

  if (updateHash) {
    const next = '#' + id;
    if (location.hash !== next) {
      history.replaceState(null, '', next);
    }
  }

  return id;
}

function setupSectionRouter() {
  const applyFromHash = () => {
    const raw = location.hash.slice(1);
    const id = normalizeSection(raw);
    // Rewrite legacy aliases in the address bar
    if (raw && HASH_ALIASES[raw.toLowerCase()]) {
      history.replaceState(null, '', '#' + id);
    }
    showSection(id, { updateHash: false });
  };

  window.addEventListener('hashchange', applyFromHash);

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const id = normalizeSection(href);
    if (!SECTIONS.includes(id) && !HASH_ALIASES[href.slice(1).toLowerCase()]) return;
    e.preventDefault();
    showSection(id, { updateHash: true });
  });

  applyFromHash();

  return { showSection, normalizeSection };
}

document.addEventListener('DOMContentLoaded', () => {
  mountUniverseBackground(document.body);
  buildHeroMandala();
  setupMobileMenu();
  const router = setupSectionRouter();

  mountNatalUI(document.getElementById('mapa-astral'));
  mountDualCompatUI(document.getElementById('casal'));

  const compat = mountCompatibilityUI(document.getElementById('compatibilidade'));
  mountSignExplorer(document.getElementById('signos'), {
    onOpenPair: (a, b) => {
      compat.setPair(a, b);
      router.showSection('compatibilidade');
    },
  });
});
