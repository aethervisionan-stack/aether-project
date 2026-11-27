import { ZODIAC_DATA, ELEMENT_COLORS } from '../data/zodiacData.js';
import { calculateFullTriad, elementalBalance, renderNatalWheelSVG } from '../utils/natalEngine.js';

export function mountNatalUI(root) {
  const form = root.querySelector('#natal-form');
  const unknown = root.querySelector('#natal-unknown-time');
  const timeInput = root.querySelector('#natal-time');
  const result = root.querySelector('#natal-result');
  const placeholder = root.querySelector('#natal-placeholder');

  unknown.addEventListener('change', (e) => {
    timeInput.disabled = e.target.checked;
    if (e.target.checked) timeInput.value = '12:00';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = root.querySelector('#natal-name').value.trim();
    const date = root.querySelector('#natal-date').value;
    const time = timeInput.value;
    const city = root.querySelector('#natal-city').value.trim();
    if (!name || !date || !city) return;

    const triad = calculateFullTriad(date, time, unknown.checked, name, city);
    const balance = elementalBalance(triad.sun, triad.moon, triad.asc);

    placeholder.classList.add('hidden');
    result.classList.remove('hidden');

    const est = triad.estimatedTime ? ' (hora estimada ao meio-dia)' : '';
    root.querySelector('#natal-greeting').textContent =
      `${name}, nascido(a) em ${city}${est} — eis a sua tríade.`;

    const roles = [
      { label: 'Sol', sign: triad.sun, hint: 'Essência', note: triad.precision.sun },
      { label: 'Lua', sign: triad.moon, hint: 'Emoção', note: triad.precision.moon },
      { label: 'Ascendente', sign: triad.asc, hint: 'Máscara', note: triad.precision.asc },
    ];
    root.querySelector('#triad-cards').innerHTML = roles
      .map(
        (r) => `
      <div class="rounded-xl border border-gold/15 bg-midnight/40 p-4 text-center">
        <div class="text-2xl mb-1" style="color:${ELEMENT_COLORS[ZODIAC_DATA[r.sign].element]}">${ZODIAC_DATA[r.sign].glyph}</div>
        <div class="font-cinzel text-[10px] tracking-widest text-gold uppercase">${r.label}</div>
        <div class="font-playfair text-lg text-goldLight mt-1">${r.sign}</div>
        <div class="text-[10px] text-white/40 mt-1">${r.hint} · ${ZODIAC_DATA[r.sign].element}</div>
        <div class="text-[9px] text-white/30 mt-2 leading-snug">${r.note}</div>
      </div>`
      )
      .join('');

    root.querySelector('#element-bars').innerHTML = Object.entries(balance)
      .map(
        ([el, pct]) => `
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-white/60">${el}</span>
          <span class="text-gold">${pct}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${ELEMENT_COLORS[el]}"></div></div>
      </div>`
      )
      .join('');

    root.querySelector('#natal-wheel').innerHTML = renderNatalWheelSVG(triad.sun, triad.moon, triad.asc);
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
