import { SIGN_ORDER, ZODIAC_DATA, ELEMENT_COLORS } from '../data/zodiacData.js';
import { analyzePair } from '../utils/compatibilityEngine.js';

function bar(label, value, id) {
  return `
    <div>
      <div class="flex justify-between text-xs mb-1"><span class="text-white/60">${label}</span><span class="text-gold" id="${id}">${value}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${value}%"></div></div>
    </div>`;
}

function renderResult(container, analysis) {
  if (!analysis) {
    container.innerHTML = `<p class="text-white/50 text-center">Escolha dois signos</p>`;
    return;
  }
  const { aspect, element, modality, dimensions, scores, affinity, signA, signB, rulers, precisionNote } = analysis;
  const ga = ZODIAC_DATA[signA].glyph;
  const gb = ZODIAC_DATA[signB].glyph;

  container.innerHTML = `
    <div class="flex flex-col lg:flex-row gap-8 items-start">
      <div class="flex flex-col items-center gap-4 shrink-0 mx-auto lg:mx-0">
        <div class="relative w-40 h-40">
          <div class="affinity-ring absolute inset-0 rounded-full" style="--pct:${affinity}%"></div>
          <div class="absolute inset-3 rounded-full bg-indigoDark flex flex-col items-center justify-center">
            <span class="font-cinzel text-3xl gold-text">${affinity}%</span>
            <span class="text-[10px] tracking-widest text-white/50 uppercase">Afinidade*</span>
          </div>
        </div>
        <div class="text-center">
          <div class="font-playfair text-xl text-goldLight italic">${ga} ${signA} ✦ ${gb} ${signB}</div>
          <div class="flex flex-wrap justify-center gap-2 mt-3">
            <span class="aspect-badge">${aspect.name} · ${aspect.badge}</span>
            <span class="aspect-badge aspect-badge--soft">${aspect.category}</span>
          </div>
        </div>
        <div class="w-full space-y-3 mt-2">
          ${bar('Química / atração', scores.chemistry, 'sc-chem')}
          ${bar('Conversa / mente', scores.communication, 'sc-comm')}
          ${bar('Afeto / morar junto', scores.affection, 'sc-aff')}
        </div>
      </div>

      <div class="flex-1 space-y-5 text-sm text-white/75 leading-relaxed w-full">
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex px-2.5 py-0.5 rounded-full text-[10px] tracking-widest uppercase border border-gold/30 text-goldLight" style="border-color:${ELEMENT_COLORS[element.a]}55">${element.a}</span>
          <span class="text-white/30">×</span>
          <span class="inline-flex px-2.5 py-0.5 rounded-full text-[10px] tracking-widest uppercase border border-gold/30 text-goldLight" style="border-color:${ELEMENT_COLORS[element.b]}55">${element.b}</span>
          <span class="inline-flex px-2.5 py-0.5 rounded-full text-[10px] tracking-widest uppercase border border-cosmicLight/40 text-cosmicLight">${modality.a} × ${modality.b}</span>
        </div>

        <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4">
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Como funciona o par — ${aspect.name}</h4>
          <p>${dimensions.dynamic}</p>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4">
            <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Elementos — ${element.label}</h4>
            <p class="mb-2">${element.summary}</p>
            <p class="text-[11px] text-white/45">Clima mental: ${element.mind} · Casa: ${element.home}</p>
          </div>
          <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4">
            <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Ritmo — ${modality.label}</h4>
            <p class="mb-2">${modality.summary}</p>
            <p class="text-[11px] text-white/45">${modality.tip}</p>
          </div>
        </div>

        <div>
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Química e atração</h4>
          <p>${dimensions.chemistry}</p>
        </div>
        <div>
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Conversa e mente</h4>
          <p>${dimensions.communication}</p>
        </div>
        <div>
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Afeto e morar junto</h4>
          <p>${dimensions.affection}</p>
        </div>
        <div class="rounded-xl border border-cosmic/30 bg-cosmic/10 p-4">
          <h4 class="font-cinzel text-xs tracking-widest text-cosmicLight mb-2">Desafio principal</h4>
          <p class="mb-3">${dimensions.challenge}</p>
          <h4 class="font-cinzel text-xs tracking-widest text-gold mb-2">Dicas práticas</h4>
          <ul class="list-disc pl-5 space-y-1 text-white/70">
            ${dimensions.tips.map((t) => `<li>${t}</li>`).join('')}
          </ul>
        </div>

        <p class="text-[11px] text-white/40">
          Planetas em jogo: ${signA} (${rulers.a.classical}${rulers.a.modern !== rulers.a.classical ? ` / ${rulers.a.modern}` : ''})
          · ${signB} (${rulers.b.classical}${rulers.b.modern !== rulers.b.classical ? ` / ${rulers.b.modern}` : ''}).
        </p>
        <p class="text-[11px] text-white/35 border-t border-gold/10 pt-3">* ${precisionNote}</p>
      </div>
    </div>`;
}

export function mountCompatibilityUI(root) {
  const selA = root.querySelector('#syn-a');
  const selB = root.querySelector('#syn-b');
  const search = root.querySelector('#syn-search');
  const result = root.querySelector('#syn-result');

  function fillSelect(sel, selected) {
    sel.innerHTML = SIGN_ORDER.map(
      (s) =>
        `<option value="${s}" ${s === selected ? 'selected' : ''}>${ZODIAC_DATA[s].glyph} ${s} · ${ZODIAC_DATA[s].element}</option>`
    ).join('');
  }

  fillSelect(selA, 'Áries');
  fillSelect(selB, 'Leão');

  function update() {
    const analysis = analyzePair(selA.value, selB.value);
    renderResult(result, analysis);
  }

  selA.addEventListener('change', update);
  selB.addEventListener('change', update);

  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const match = SIGN_ORDER.find(
        (s) =>
          s.toLowerCase().includes(q) ||
          ZODIAC_DATA[s].element.toLowerCase().includes(q) ||
          ZODIAC_DATA[s].modality.toLowerCase().includes(q)
      );
      if (match && q.length >= 2) {
        selB.value = match;
        update();
      }
    });
  }

  const quick = root.querySelector('#syn-quick');
  if (quick) {
    quick.innerHTML = SIGN_ORDER.map(
      (s) =>
        `<button type="button" class="element-chip" data-quick="${s}">${ZODIAC_DATA[s].glyph} ${s}</button>`
    ).join('');
    quick.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quick]');
      if (!btn) return;
      selB.value = btn.dataset.quick;
      update();
    });
  }

  update();

  return {
    setPair(a, b) {
      if (ZODIAC_DATA[a]) selA.value = a;
      if (ZODIAC_DATA[b]) selB.value = b;
      update();
      const scroller = root.querySelector('.panel-scroll') || root.closest('.app-panel')?.querySelector('.panel-scroll');
      if (scroller) scroller.scrollTop = 0;
    },
  };
}
