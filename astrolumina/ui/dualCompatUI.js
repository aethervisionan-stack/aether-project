import { ZODIAC_DATA, ELEMENT_COLORS } from '../data/zodiacData.js';
import { analyzeDualRelationship } from '../utils/dualRelationshipEngine.js';

const TONE_CLASS = {
  harmonioso: 'tone-harmonious',
  fusão: 'tone-harmonious',
  magnético: 'tone-magnetic',
  ajuste: 'tone-adjust',
  tenso: 'tone-tense',
};

const TONE_LABEL = {
  harmonioso: 'Harmonioso',
  fusão: 'Fusão',
  magnético: 'Magnético',
  ajuste: 'Ajuste',
  tenso: 'Tenso',
};

function personFields(prefix, title) {
  return `
    <div class="glass-card rounded-2xl p-5 sm:p-6 space-y-4 border border-gold/15">
      <h3 class="font-cinzel text-sm tracking-[0.2em] text-gold">${title}</h3>
      <div>
        <label for="${prefix}-name">Nome</label>
        <input id="${prefix}-name" type="text" required placeholder="Nome" autocomplete="name" />
      </div>
      <div>
        <label for="${prefix}-date">Data de nascimento</label>
        <input id="${prefix}-date" type="date" required />
      </div>
      <div>
        <label for="${prefix}-time">Hora de nascimento</label>
        <input id="${prefix}-time" type="time" value="12:00" />
        <label class="mt-2 flex items-center gap-2 cursor-pointer text-white/70">
          <input id="${prefix}-unknown" type="checkbox" />
          <span>Não sei a hora (estimativa ao meio-dia)</span>
        </label>
      </div>
      <div>
        <label for="${prefix}-city">Cidade</label>
        <input id="${prefix}-city" type="text" required placeholder="Ex: Rio de Janeiro" />
      </div>
    </div>`;
}

function readPerson(root, prefix) {
  return {
    name: root.querySelector(`#${prefix}-name`).value.trim(),
    date: root.querySelector(`#${prefix}-date`).value,
    time: root.querySelector(`#${prefix}-time`).value,
    unknownTime: root.querySelector(`#${prefix}-unknown`).checked,
    city: root.querySelector(`#${prefix}-city`).value.trim(),
  };
}

function triadCard(person, label) {
  const roles = [
    { key: 'sun', label: 'Sol' },
    { key: 'moon', label: 'Lua' },
    { key: 'asc', label: 'ASC' },
  ];
  return `
    <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4">
      <div class="font-cinzel text-xs tracking-widest text-gold mb-3">${label} — ${person.name}</div>
      <div class="grid grid-cols-3 gap-2 text-center">
        ${roles
          .map((r) => {
            const sign = person[r.key];
            const d = ZODIAC_DATA[sign];
            return `<div>
              <div class="text-xl" style="color:${ELEMENT_COLORS[d.element]}">${d.glyph}</div>
              <div class="text-[10px] tracking-widest text-gold uppercase mt-1">${r.label}</div>
              <div class="text-sm text-goldLight">${sign}</div>
            </div>`;
          })
          .join('')}
      </div>
      <p class="text-[10px] text-white/35 mt-3 leading-snug">
        Sol: preciso por data · Lua/ASC: ${person.estimatedTime ? 'hora estimada · ' : ''}aproximação
      </p>
    </div>`;
}

function channelRow(ch) {
  const toneClass = TONE_CLASS[ch.tone] || TONE_CLASS.ajuste;
  const toneLabel = TONE_LABEL[ch.tone] || ch.tone;
  return `
    <article class="channel-row rounded-xl border border-gold/12 bg-midnight/35 p-4 ${toneClass}">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <div class="font-cinzel text-xs tracking-widest text-gold">${ch.label}</div>
          <div class="text-sm text-goldLight mt-1">${ch.glyphA} ${ch.signA} ✦ ${ch.glyphB} ${ch.signB}</div>
          <div class="text-[11px] text-white/45 mt-1">${ch.role}</div>
        </div>
        <div class="text-right">
          <span class="aspect-badge">${ch.analysis.aspect.name}</span>
          <div class="mt-2"><span class="tone-pill">${toneLabel}</span></div>
          <div class="text-gold font-cinzel text-lg mt-1">${ch.score}%</div>
        </div>
      </div>
      <p class="text-sm text-white/70 leading-relaxed mb-2">${ch.loveFocus}</p>
      <p class="text-sm text-white/65 leading-relaxed">${ch.analysis.dimensions.dynamic}</p>
      <p class="text-[11px] text-white/40 mt-2">${ch.analysis.element.label} · ${ch.analysis.modality.label}</p>
    </article>`;
}

function renderResult(container, result) {
  const { personA, personB, overall, verdict, channels, strengths, weaknesses, navigation, precisionNote, counts } =
    result;

  const harmonious = channels.filter((c) => c.tone === 'harmonioso' || c.tone === 'fusão');
  const tense = channels.filter((c) => c.tone === 'tenso' || c.tone === 'ajuste');
  const magnetic = channels.filter((c) => c.tone === 'magnético');

  container.innerHTML = `
    <div class="space-y-8">
      <div class="flex flex-col lg:flex-row gap-6 items-stretch">
        <div class="relative w-36 h-36 shrink-0 mx-auto lg:mx-0">
          <div class="affinity-ring absolute inset-0 rounded-full" style="--pct:${overall}%"></div>
          <div class="absolute inset-3 rounded-full bg-indigoDark flex flex-col items-center justify-center">
            <span class="font-cinzel text-3xl gold-text">${overall}%</span>
            <span class="text-[9px] tracking-widest text-white/50 uppercase">Síntese*</span>
          </div>
        </div>
        <div class="flex-1">
          <p class="font-playfair text-xl sm:text-2xl italic text-goldLight mb-3">${personA.name} ✦ ${personB.name}</p>
          <p class="font-cinzel text-xs tracking-widest text-cosmicLight mb-2">VEREDITO RELACIONAL</p>
          <p class="text-white/80 leading-relaxed mb-2">${verdict.headline}</p>
          <p class="text-sm text-white/60 leading-relaxed">${verdict.summary}</p>
          <div class="flex flex-wrap gap-2 mt-4">
            <span class="aspect-badge">${counts.harmonic} harmônicos</span>
            <span class="aspect-badge aspect-badge--soft">${counts.magnetic} magnéticos</span>
            <span class="tone-pill tone-tense-pill">${counts.tense} tensos / ajuste</span>
          </div>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        ${triadCard(personA, 'Pessoa A')}
        ${triadCard(personB, 'Pessoa B')}
      </div>

      <div>
        <h3 class="font-cinzel text-sm tracking-widest text-gold mb-3">Canais de amor — harmoniosos</h3>
        <div class="space-y-3">
          ${harmonious.length ? harmonious.map(channelRow).join('') : '<p class="text-sm text-white/50">Nenhum canal claramente fluido — o crescimento virá do método nos pontos tensos.</p>'}
        </div>
      </div>

      ${
        magnetic.length
          ? `<div>
        <h3 class="font-cinzel text-sm tracking-widest text-gold mb-3">Magnetismo / espelho</h3>
        <div class="space-y-3">${magnetic.map(channelRow).join('')}</div>
      </div>`
          : ''
      }

      <div>
        <h3 class="font-cinzel text-sm tracking-widest text-gold mb-3">Canais tensos ou de ajuste</h3>
        <div class="space-y-3">
          ${tense.length ? tense.map(channelRow).join('') : '<p class="text-sm text-white/50">Pouca fricção angular nos canais principais — cuidem para não evitar conversas necessárias.</p>'}
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-xl border border-gold/25 bg-gold/5 p-5">
          <h3 class="font-cinzel text-xs tracking-widest text-gold mb-3">Pontos fortes</h3>
          <ul class="space-y-2 text-sm text-white/75 list-disc pl-5">
            ${strengths.map((s) => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        <div class="rounded-xl border border-cosmic/35 bg-cosmic/10 p-5">
          <h3 class="font-cinzel text-xs tracking-widest text-cosmicLight mb-3">Pontos fracos</h3>
          <ul class="space-y-2 text-sm text-white/75 list-disc pl-5">
            ${weaknesses.map((s) => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="rounded-xl border border-gold/20 bg-midnight/50 p-5 sm:p-6">
        <h3 class="font-cinzel text-xs tracking-widest text-gold mb-2">Como navegar bem juntos</h3>
        <p class="text-sm text-white/60 mb-4">Mesmo com dinâmica tensa, o casal pode construir um sistema relacional claro:</p>
        <ol class="space-y-2 text-sm text-white/75 list-decimal pl-5">
          ${navigation.map((t) => `<li>${t}</li>`).join('')}
        </ol>
      </div>

      <p class="text-[11px] text-white/35 leading-relaxed border-t border-gold/10 pt-4">* ${precisionNote}</p>
    </div>`;
}

export function mountDualCompatUI(root) {
  const formWrap = root.querySelector('#dual-form-wrap');
  const result = root.querySelector('#dual-result');

  formWrap.innerHTML = `
    <form id="dual-form" class="space-y-6">
      <div class="grid lg:grid-cols-2 gap-5">
        ${personFields('dual-a', 'Pessoa A')}
        ${personFields('dual-b', 'Pessoa B')}
      </div>
      <button type="submit" class="btn-gold w-full sm:w-auto px-8 py-3 rounded-md text-sm tracking-wide">Analisar compatibilidade a dois</button>
    </form>`;

  ['dual-a', 'dual-b'].forEach((prefix) => {
    const unknown = root.querySelector(`#${prefix}-unknown`);
    const time = root.querySelector(`#${prefix}-time`);
    unknown.addEventListener('change', () => {
      time.disabled = unknown.checked;
      if (unknown.checked) time.value = '12:00';
    });
  });

  root.querySelector('#dual-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const a = readPerson(root, 'dual-a');
    const b = readPerson(root, 'dual-b');
    if (!a.name || !a.date || !a.city || !b.name || !b.date || !b.city) return;

    const analysis = analyzeDualRelationship(a, b);
    result.classList.remove('hidden');
    renderResult(result, analysis);
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
