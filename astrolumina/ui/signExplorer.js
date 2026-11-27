import {
  SIGN_ORDER,
  ZODIAC_DATA,
  ELEMENT_COLORS,
  ELEMENTS,
  approxDegreeInSign,
  decanForDegree,
} from '../data/zodiacData.js';
import { affinityMatrixFor } from '../utils/compatibilityEngine.js';

const TABS = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'decanos', label: 'Decanos' },
  { id: 'psicologia', label: 'Psicologia' },
  { id: 'correspondencias', label: 'Correspondências' },
  { id: 'afinidades', label: 'Afinidades' },
];

let state = {
  filter: 'todos',
  query: '',
  selected: 'Áries',
  tab: 'identidade',
  degree: 15,
  onOpenPair: null,
};

function badge(text, extra = '') {
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tracking-widest uppercase border border-gold/30 text-goldLight ${extra}">${text}</span>`;
}

function renderGrid(root) {
  const grid = root.querySelector('#zodiac-grid');
  const q = state.query.trim().toLowerCase();
  grid.innerHTML = '';
  SIGN_ORDER.forEach((sign) => {
    const d = ZODIAC_DATA[sign];
    if (state.filter !== 'todos' && d.element !== state.filter) return;
    if (q && !sign.toLowerCase().includes(q) && !d.element.toLowerCase().includes(q) && !d.modality.toLowerCase().includes(q)) {
      return;
    }
    const active = state.selected === sign;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sign-card glass-card rounded-xl p-4 text-left border w-full ${active ? 'border-gold/50 ring-1 ring-gold/30' : 'border-gold/10'}`;
    btn.innerHTML = `
      <div class="text-3xl mb-2" style="color:${ELEMENT_COLORS[d.element]}">${d.glyph}</div>
      <div class="font-cinzel tracking-widest text-goldLight text-sm">${sign}</div>
      <div class="text-[11px] text-white/40 mt-1">${d.dates}</div>
      <div class="flex flex-wrap gap-1 mt-2">
        ${badge(d.element)}
        ${badge(d.modality)}
      </div>`;
    btn.addEventListener('click', () => {
      state.selected = sign;
      state.degree = 15;
      renderAll(root);
    });
    grid.appendChild(btn);
  });
}

function renderIdentity(d, sign) {
  return `
    <div class="space-y-5 text-sm text-white/75 leading-relaxed">
      <div class="flex flex-wrap gap-2">
        ${badge(d.element)}
        ${badge(d.modality)}
        ${badge(d.polarityLabel)}
        ${badge(`Casa ${d.naturalHouse}`)}
        ${badge(`Eixo ${d.axis}`)}
      </div>
      <p><span class="text-gold font-cinzel text-xs tracking-widest">DATAS SOLARES</span><br>${d.dates} <span class="text-white/40">(aprox. tropical)</span></p>
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4">
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Regente clássico — ${d.rulers.classical.name}</h4>
          <p>${d.rulers.classical.meaning}</p>
        </div>
        <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4">
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Regente moderno — ${d.rulers.modern.name}</h4>
          <p>${d.rulers.modern.meaning}</p>
        </div>
      </div>
      <div>
        <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Sol · Lua · Ascendente (arquétipo)</h4>
        <p class="mb-2"><strong class="text-goldLight">Sol:</strong> ${d.sun}</p>
        <p class="mb-2"><strong class="text-goldLight">Lua:</strong> ${d.moon}</p>
        <p><strong class="text-goldLight">Ascendente:</strong> ${d.asc}</p>
      </div>
      <p class="text-[11px] text-white/40 border-t border-gold/10 pt-3">
        Transparência: o Sol por data é preciso nas faixas tropicais. Interpretações de Lua/ASC aqui são arquetípicas do signo — posição real exige hora e local.
      </p>
    </div>`;
}

function renderDecans(d, sign) {
  const decan = decanForDegree(sign, state.degree);
  return `
    <div class="space-y-5 text-sm text-white/75 leading-relaxed">
      <p>Os decanos dividem cada signo em três faixas de 10°. Usamos a tradição <strong class="text-goldLight">caldeia</strong> de sub-regência planetária para matizar a expressão.</p>
      <div>
        <label class="block mb-2" for="decan-degree">Grau aproximado no signo: <span class="text-gold" id="decan-degree-label">${state.degree.toFixed(1)}°</span></label>
        <input id="decan-degree" type="range" min="0" max="29.9" step="0.1" value="${state.degree}" class="w-full accent-gold" />
        <div class="mt-3 flex flex-wrap gap-2 items-end">
          <div class="flex-1 min-w-[140px]">
            <label for="decan-day">Ou dia do mês (aprox.)</label>
            <input id="decan-day" type="number" min="1" max="31" placeholder="Dia" />
          </div>
          <div class="flex-1 min-w-[140px]">
            <label for="decan-month">Mês</label>
            <input id="decan-month" type="number" min="1" max="12" placeholder="Mês" />
          </div>
          <button type="button" id="decan-from-date" class="btn-outline-gold px-4 py-3 rounded-md text-xs tracking-wide">Usar data</button>
        </div>
      </div>
      <div class="grid sm:grid-cols-3 gap-3">
        ${d.decans
          .map(
            (dc) => `
          <div class="rounded-xl border p-4 ${decan && decan.index === dc.index ? 'border-gold/50 bg-gold/10' : 'border-gold/15 bg-midnight/40'}">
            <div class="font-cinzel text-xs tracking-widest text-gold mb-1">Decanato ${dc.index}</div>
            <div class="text-goldLight text-sm mb-1">${dc.range} · ${dc.ruler}</div>
            <p class="text-xs text-white/65">${dc.nuance}</p>
          </div>`
          )
          .join('')}
      </div>
      ${
        decan
          ? `<p class="font-playfair italic text-goldLight">No grau ${state.degree.toFixed(1)}°, ressoa o decanato ${decan.index} (sub-regente ${decan.ruler}): ${decan.nuance}</p>`
          : ''
      }
    </div>`;
}

function renderPsychology(d) {
  return `
    <div class="space-y-4 text-sm text-white/75 leading-relaxed">
      <div><h4 class="font-cinzel text-xs tracking-widest text-gold mb-1">Essência / impulso central</h4><p>${d.psychology.essence}</p></div>
      <div><h4 class="font-cinzel text-xs tracking-widest text-gold mb-1">Dons e poderes</h4><p>${d.psychology.gifts}</p></div>
      <div><h4 class="font-cinzel text-xs tracking-widest text-gold mb-1">Sombras e pontos cegos</h4><p>${d.psychology.shadows}</p></div>
      <div><h4 class="font-cinzel text-xs tracking-widest text-gold mb-1">Necessidade emocional</h4><p>${d.psychology.emotionalNeed}</p></div>
      <div><h4 class="font-cinzel text-xs tracking-widest text-gold mb-1">Linguagem relacional</h4><p>${d.psychology.relationalLanguage}</p></div>
    </div>`;
}

function renderCorrespondences(d) {
  return `
    <div class="space-y-4 text-sm text-white/75 leading-relaxed">
      <div>
        <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Palavras-chave</h4>
        <div class="flex flex-wrap gap-2">${d.correspondences.keywords.map((k) => badge(k)).join('')}</div>
      </div>
      <div>
        <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Pedras / cristais tradicionais</h4>
        <p>${d.correspondences.stones.join(' · ')}</p>
      </div>
      <div>
        <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Cores simbólicas</h4>
        <p>${d.correspondences.colors.join(' · ')}</p>
      </div>
      <div>
        <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Correspondência corporal (astrologia médica tradicional)</h4>
        <p>${d.correspondences.bodyParts}</p>
        <p class="text-[11px] text-white/40 mt-2">Informação simbólica/histórica apenas — não constitui aconselhamento médico.</p>
      </div>
    </div>`;
}

function renderAffinities(sign) {
  const matrix = affinityMatrixFor(sign);
  const sections = [
    { key: 'fluidez', title: 'Fluidez (trígono / sextil)', hint: 'Facilidade e cooperação elemental' },
    { key: 'magnetismo', title: 'Magnetismo / espelho (oposição)', hint: 'Polos que se atraem e completam' },
    { key: 'atrito', title: 'Atrito construtivo (quadratura / quincúncio)', hint: 'Fricção que pede crescimento' },
    { key: 'fusão', title: 'Fusão (conjunção)', hint: 'Mesma frequência arquetípica' },
    { key: 'ajuste', title: 'Ajuste fino (semissextil)', hint: 'Vizinhos que pedem cortesia' },
  ];
  return `
    <div class="space-y-5 text-sm text-white/75">
      <p>Matriz angular a partir de <strong class="text-goldLight">${sign}</strong>. Clique um signo para abrir a análise completa do par.</p>
      ${sections
        .map((sec) => {
          const items = matrix[sec.key] || [];
          if (!items.length) return '';
          return `
          <div>
            <h4 class="font-cinzel text-xs tracking-widest text-gold mb-1">${sec.title}</h4>
            <p class="text-[11px] text-white/40 mb-2">${sec.hint}</p>
            <div class="flex flex-wrap gap-2">
              ${items
                .map(({ sign: other, aspect }) => {
                  const od = ZODIAC_DATA[other];
                  return `<button type="button" class="affinity-chip glass-card border border-gold/20 rounded-lg px-3 py-2 text-left hover:border-gold/50" data-pair-a="${sign}" data-pair-b="${other}">
                    <span style="color:${ELEMENT_COLORS[od.element]}">${od.glyph}</span>
                    <span class="text-goldLight ml-1">${other}</span>
                    <span class="block text-[10px] text-white/40">${aspect.name} · ${aspect.badge}</span>
                  </button>`;
                })
                .join('')}
            </div>
          </div>`;
        })
        .join('')}
    </div>`;
}

function renderDetail(root) {
  const sign = state.selected;
  const d = ZODIAC_DATA[sign];
  const panel = root.querySelector('#sign-detail');
  const tabBar = TABS.map(
    (t) =>
      `<button type="button" class="sign-tab ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  let body = '';
  if (state.tab === 'identidade') body = renderIdentity(d, sign);
  if (state.tab === 'decanos') body = renderDecans(d, sign);
  if (state.tab === 'psicologia') body = renderPsychology(d);
  if (state.tab === 'correspondencias') body = renderCorrespondences(d);
  if (state.tab === 'afinidades') body = renderAffinities(sign);

  panel.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <div class="text-5xl mb-2" style="color:${ELEMENT_COLORS[d.element]}">${d.glyph}</div>
        <h3 class="font-cinzel text-2xl sm:text-3xl gold-text tracking-widest">${sign}</h3>
        <p class="text-sm text-white/50 mt-1">${d.dates} · ${d.rulers.classical.name}${d.rulers.modern.name !== d.rulers.classical.name ? ` / ${d.rulers.modern.name}` : ''}</p>
      </div>
    </div>
    <div class="sign-tabs flex flex-wrap gap-2 mb-6">${tabBar}</div>
    <div id="sign-tab-body">${body}</div>`;

  panel.querySelectorAll('.sign-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      renderDetail(root);
    });
  });

  const range = panel.querySelector('#decan-degree');
  if (range) {
    range.addEventListener('input', () => {
      state.degree = Number(range.value);
      renderDetail(root);
    });
  }
  const fromDate = panel.querySelector('#decan-from-date');
  if (fromDate) {
    fromDate.addEventListener('click', () => {
      const day = Number(panel.querySelector('#decan-day').value);
      const month = Number(panel.querySelector('#decan-month').value);
      if (!day || !month) return;
      state.degree = approxDegreeInSign(sign, month, day);
      renderDetail(root);
    });
  }

  panel.querySelectorAll('[data-pair-a]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof state.onOpenPair === 'function') {
        state.onOpenPair(btn.dataset.pairA, btn.dataset.pairB);
      }
    });
  });
}

function renderAll(root) {
  renderGrid(root);
  renderDetail(root);
}

export function mountSignExplorer(root, { onOpenPair } = {}) {
  state.onOpenPair = onOpenPair || null;
  const filters = root.querySelector('#element-filters');
  filters.innerHTML = ['todos', ...ELEMENTS]
    .map(
      (el) =>
        `<button type="button" class="element-chip ${state.filter === el ? 'active' : ''}" data-element="${el}">${el === 'todos' ? 'Todos' : el}</button>`
    )
    .join('');

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.element-chip');
    if (!btn) return;
    state.filter = btn.dataset.element;
    filters.querySelectorAll('.element-chip').forEach((c) => c.classList.toggle('active', c === btn));
    renderGrid(root);
  });

  const search = root.querySelector('#sign-search');
  if (search) {
    search.addEventListener('input', () => {
      state.query = search.value;
      renderGrid(root);
    });
  }

  renderAll(root);

  return {
    selectSign(sign) {
      if (ZODIAC_DATA[sign]) {
        state.selected = sign;
        renderAll(root);
      }
    },
  };
}
