/**
 * Análise romântica entre duas tríades natais (Sol / Lua / ASC).
 * Reutiliza analyzePair do motor angular; Lua/ASC são aproximações do natalEngine.
 */
import { ZODIAC_DATA } from '../data/zodiacData.js';
import { calculateFullTriad } from './natalEngine.js';
import { analyzePair, affinityBucket } from './compatibilityEngine.js';

const CHANNELS = [
  {
    id: 'sun_sun',
    weight: 1.15,
    label: 'Sol–Sol',
    role: 'Identidade e propósito a dois',
    loveFocus: 'Como as essências se reconhecem e negociam o “nós”.',
  },
  {
    id: 'moon_moon',
    weight: 1.25,
    label: 'Lua–Lua',
    role: 'Clima emocional e necessidade de segurança',
    loveFocus: 'Como cuidam um do outro no dia a dia e sob estresse.',
  },
  {
    id: 'asc_asc',
    weight: 0.85,
    label: 'Asc–Asc',
    role: 'Estilo de chegada e primeira impressão',
    loveFocus: 'Como se apresentam ao mundo e o ritmo social do casal.',
  },
  {
    id: 'sun_a_moon_b',
    weight: 1.2,
    label: 'Sol A → Lua B',
    role: 'Vitalidade de A nutre (ou pressiona) o coração de B',
    loveFocus: 'Se a identidade de A aquece a necessidade emocional de B.',
  },
  {
    id: 'sun_b_moon_a',
    weight: 1.2,
    label: 'Sol B → Lua A',
    role: 'Vitalidade de B nutre (ou pressiona) o coração de A',
    loveFocus: 'Se a identidade de B acolhe a vulnerabilidade de A.',
  },
  {
    id: 'moon_a_sun_b',
    weight: 0.95,
    label: 'Lua A → Sol B',
    role: 'Cuidado de A encontra o ego solar de B',
    loveFocus: 'Se o afeto de A valida ou sufoca a expressão de B.',
  },
  {
    id: 'moon_b_sun_a',
    weight: 0.95,
    label: 'Lua B → Sol A',
    role: 'Cuidado de B encontra o ego solar de A',
    loveFocus: 'Se o afeto de B fortalece ou amarra a identidade de A.',
  },
];

const TONE_RANK = {
  fluidez: 2,
  fusão: 1,
  magnetismo: 0,
  ajuste: -1,
  atrito: -2,
};

function toneFromBucket(bucket) {
  if (bucket === 'fluidez' || bucket === 'fusão') return 'harmonioso';
  if (bucket === 'magnetismo') return 'magnético';
  if (bucket === 'ajuste') return 'ajuste';
  return 'tenso';
}

function channelPair(personA, personB, channelId) {
  switch (channelId) {
    case 'sun_sun':
      return [personA.sun, personB.sun];
    case 'moon_moon':
      return [personA.moon, personB.moon];
    case 'asc_asc':
      return [personA.asc, personB.asc];
    case 'sun_a_moon_b':
      return [personA.sun, personB.moon];
    case 'sun_b_moon_a':
      return [personB.sun, personA.moon];
    case 'moon_a_sun_b':
      return [personA.moon, personB.sun];
    case 'moon_b_sun_a':
      return [personB.moon, personA.sun];
    default:
      return [null, null];
  }
}

function buildChannel(personA, personB, meta) {
  const [signA, signB] = channelPair(personA, personB, meta.id);
  const analysis = analyzePair(signA, signB);
  if (!analysis) return null;
  const bucket = affinityBucket(signA, signB);
  const tone = toneFromBucket(bucket);
  return {
    ...meta,
    signA,
    signB,
    glyphA: ZODIAC_DATA[signA].glyph,
    glyphB: ZODIAC_DATA[signB].glyph,
    bucket,
    tone,
    analysis,
    score: analysis.affinity,
  };
}

function verdictHeadline(overall, harmonicCount, tenseCount) {
  if (overall >= 78 && tenseCount <= 1) {
    return 'Sinastria com forte corrente de apoio — o vínculo tende a fluir quando ambos escolhem presença.';
  }
  if (overall >= 65) {
    return 'Há química e terreno comum suficientes; os pontos de atrito pedem método, não fuga.';
  }
  if (overall >= 52) {
    return 'Dinâmica mista: o casal pode prosperar se transformar tensão em acordo explícito.';
  }
  return 'O mapa mostra fricção relevante — ainda assim dá para construir se houver maturidade e rituais claros.';
}

function collectStrengths(channels, nameA, nameB) {
  const harmonic = channels
    .filter((c) => c.tone === 'harmonioso' || c.tone === 'fusão' || (c.tone === 'magnético' && c.score >= 70))
    .sort((a, b) => b.score - a.score);

  const strengths = harmonic.slice(0, 4).map((c) => {
    if (c.id === 'moon_moon') {
      return `Clima lunar (${c.signA}–${c.signB}, ${c.analysis.aspect.name}): ${nameA} e ${nameB} tendem a entender o “clima” um do outro sem longas explicações — base de cuidado mútuo.`;
    }
    if (c.id.startsWith('sun_') && c.id.includes('moon')) {
      return `${c.label} (${c.signA}→${c.signB}): a vitalidade de um encontra acolhida no coração do outro — combustível clássico de romance.`;
    }
    if (c.id === 'sun_sun') {
      return `Sol–Sol em ${c.analysis.aspect.name}: propósitos de vida conversam (${c.analysis.element.label}) — dá para sonhar o futuro na mesma direção.`;
    }
    return `${c.label}: ${c.analysis.aspect.name} favorece ${c.role.toLowerCase()}.`;
  });

  if (strengths.length < 2) {
    strengths.push(
      `Mesmo sob tensão, ${nameA} e ${nameB} compartilham um campo de aprendizado: cada canal difícil revela um talento que o outro ainda não integrou.`
    );
    strengths.push(
      `A honestidade sobre limites (hora aproximada, Lua/ASC estimados) já é um ponto forte: o casal pode tratar o mapa como mapa, não como sentença.`
    );
  }
  return strengths.slice(0, 4);
}

function collectWeaknesses(channels, nameA, nameB) {
  const tense = channels
    .filter((c) => c.tone === 'tenso' || c.tone === 'ajuste' || (c.tone === 'magnético' && c.score < 65))
    .sort((a, b) => a.score - b.score);

  const weaknesses = tense.slice(0, 4).map((c) => {
    if (c.id === 'moon_moon') {
      return `Lua–Lua em ${c.analysis.aspect.name}: sob estresse, ${nameA} e ${nameB} podem falhar em confortar um ao outro do jeito que cada um precisa.`;
    }
    if (c.id.includes('sun') && c.id.includes('moon')) {
      return `${c.label}: a identidade de um pode ferir a segurança emocional do outro se chegar sem tato — atrito clássico de amor intenso.`;
    }
    if (c.id === 'asc_asc') {
      return `Asc–Asc: estilos sociais diferentes geram mal-entendido na “vitrine” do casal (amigos, ritmo, imagem).`;
    }
    return `${c.label} (${c.analysis.aspect.name}): ${c.analysis.dimensions.challenge}`;
  });

  if (!weaknesses.length) {
    weaknesses.push(
      `O risco desta combinação não é o conflito aberto, e sim acomodar demais: ${nameA} e ${nameB} podem evitar conversas difíceis por excesso de fluidez.`
    );
  }
  return weaknesses.slice(0, 4);
}

function navigationSystem(channels, nameA, nameB, overall) {
  const tense = channels.filter((c) => c.tone === 'tenso' || c.tone === 'ajuste');
  const tips = [];

  tips.push(
    `Ritual semanal de clima: ${nameA} e ${nameB} reservam 20 minutos sem celular para nomear uma necessidade lunar cada (segurança, espaço, toque, palavras).`
  );

  if (tense.some((c) => c.id.includes('moon') && c.id.includes('sun'))) {
    tips.push(
      'Quando o Sol de um ferir a Lua do outro: pausa de 10 minutos, depois a frase “o que você precisava ouvir?” — não “quem está certo?”.'
    );
  }
  if (tense.some((c) => c.id === 'moon_moon')) {
    tips.push(
      'Divergência lunar: combinem um “código de cuidado” escrito (o que acalma cada um). Não improvise só no calor do momento.'
    );
  }
  if (tense.some((c) => c.id === 'sun_sun')) {
    tips.push(
      'Sol–Sol tenso: separem territórios de protagonismo (carreira, casa, lazer) para não competirem pelo mesmo palco.'
    );
  }
  if (tense.some((c) => c.id === 'asc_asc')) {
    tips.push(
      'Asc distintos: alternem o “modo social” do casal — uma semana mais introspectiva, outra mais expansiva — sem exigir que os dois tenham a mesma máscara.'
    );
  }

  // Pull practical tips from the two hardest channels
  tense
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .forEach((c) => {
      (c.analysis.dimensions.tips || []).slice(0, 1).forEach((t) => {
        tips.push(`${c.label}: ${t}`);
      });
    });

  if (overall < 60) {
    tips.push(
      'Tratem a tensão como currículo compartilhado: terapia de casal ou mentoria relacional ajuda a traduzir o mapa em hábitos — o aspecto sozinho não resolve.'
    );
  }

  // unique
  return [...new Set(tips)].slice(0, 6);
}

/**
 * @param {object} inputA { name, date, time, unknownTime, city }
 * @param {object} inputB same
 */
export function analyzeDualRelationship(inputA, inputB) {
  const triadA = calculateFullTriad(
    inputA.date,
    inputA.time,
    inputA.unknownTime,
    inputA.name,
    inputA.city
  );
  const triadB = calculateFullTriad(
    inputB.date,
    inputB.time,
    inputB.unknownTime,
    inputB.name,
    inputB.city
  );

  const personA = {
    name: inputA.name.trim(),
    city: inputA.city.trim(),
    ...triadA,
  };
  const personB = {
    name: inputB.name.trim(),
    city: inputB.city.trim(),
    ...triadB,
  };

  const channels = CHANNELS.map((meta) => buildChannel(personA, personB, meta)).filter(Boolean);

  let weightSum = 0;
  let scoreSum = 0;
  channels.forEach((c) => {
    weightSum += c.weight;
    scoreSum += c.score * c.weight;
  });
  const overall = Math.round(scoreSum / weightSum);

  const harmonic = channels.filter((c) => c.tone === 'harmonioso' || c.tone === 'fusão');
  const tense = channels.filter((c) => c.tone === 'tenso' || c.tone === 'ajuste');
  const magnetic = channels.filter((c) => c.tone === 'magnético');

  const ranked = [...channels].sort((a, b) => {
    const tr = (TONE_RANK[b.bucket] ?? 0) - (TONE_RANK[a.bucket] ?? 0);
    if (tr !== 0) return tr;
    return b.score - a.score;
  });

  const strengths = collectStrengths(channels, personA.name, personB.name);
  const weaknesses = collectWeaknesses(channels, personA.name, personB.name);
  const navigation = navigationSystem(channels, personA.name, personB.name, overall);

  return {
    personA,
    personB,
    channels,
    ranked,
    overall,
    counts: {
      harmonic: harmonic.length,
      tense: tense.length,
      magnetic: magnetic.length,
    },
    verdict: {
      headline: verdictHeadline(overall, harmonic.length, tense.length),
      summary:
        overall >= 70
          ? `${personA.name} e ${personB.name} encontram mais pontes do que abismos nos canais de amor analisados — especialmente onde Lua e Sol se entrelaçam com fluidez.`
          : overall >= 55
            ? `Entre ${personA.name} e ${personB.name} há desejo e diferença: o mapa não pede perfeição, pede método para os canais tensos.`
            : `A combinação pede trabalho consciente: ${personA.name} e ${personB.name} podem construir vínculo sólido se tratarem o atrito como informação, não como fracasso.`,
    },
    strengths,
    weaknesses,
    navigation,
    precisionNote:
      'Sol por data tropical é preciso nas faixas usuais. Lua e Ascendente são aproximações determinísticas no cliente (sem efeméride real nem latitude). A sinastria usa aspectos por passos de 30° entre esses signos — útil para reflexão, não substitui mapa com hora e local conferidos.',
  };
}

export { CHANNELS };
