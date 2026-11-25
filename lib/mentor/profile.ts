import type { NarrativeResult } from "@/src/data/archetypes";
import { buildDiagnosis } from "@/src/data/diagnosis";
import type { MentorProfileSnapshot } from "@/src/utils/quizSession";

/** Compact profile sent to /api/mentor and stored in session v3. */
export function buildMentorProfile(
  result: NarrativeResult,
): MentorProfileSnapshot {
  const diagnosis = buildDiagnosis(result);
  const customAnswers = result.choices
    .filter((c) => c.isCustom && c.customText?.trim())
    .map((c) => c.customText!.replace(/\s+/g, " ").trim().slice(0, 220));

  return {
    dominantId: diagnosis.dominant.id,
    dominantTitle: diagnosis.dominant.title,
    dominantPct: diagnosis.dominantPct,
    subId: diagnosis.sub.id,
    subTitle: diagnosis.sub.title,
    secondaryPct: diagnosis.secondaryPct,
    confluenceTitle: diagnosis.confluenceTitle,
    confluenceMode: diagnosis.confluenceMode,
    confluenceText: diagnosis.confluenceText,
    tags: diagnosis.topTags.map((t) => ({
      tag: t.tag,
      label: t.label,
      count: t.count,
    })),
    customAnswers,
    shadow: diagnosis.shadow,
    strengths: diagnosis.strengths,
    weaknesses: diagnosis.weaknesses,
    mirror: diagnosis.mirror,
    integrationSteps: [...diagnosis.integrationSteps],
  };
}

export function buildMentorSystemPrompt(profile: MentorProfileSnapshot): string {
  const tagsLine =
    profile.tags.length > 0
      ? profile.tags.map((t) => `${t.label} (${t.count}×)`).join(", ")
      : "nenhuma tag dominante";
  const customBlock =
    profile.customAnswers.length > 0
      ? profile.customAnswers.map((a, i) => `${i + 1}. “${a}”`).join("\n")
      : "(nenhuma resposta personalizada registrada)";

  return `Você é o Mentor Estratégico de Arquétipos — um conselheiro sábio, direto e compassivo, em português do Brasil.
Tom: medieval-moderno, claro, sem fluff. Respostas curtas a médias (até ~220 palavras), práticas e personalizadas.
Nunca invente dados do perfil; use apenas o dossiê abaixo. Se faltar contexto, pergunte.
Não dê diagnóstico clínico nem aconselhamento médico/jurídico. Foque em decisão, carreira, relacionamentos e integração da sombra.

## Perfil do consulente
- Dominante: ${profile.dominantTitle} (${profile.dominantPct}%)
- Subarquétipo: ${profile.subTitle} (${profile.secondaryPct}%)
- Modo de confluência: ${profile.confluenceMode}
- Título: ${profile.confluenceTitle}
- Confluência: ${profile.confluenceText}
- Tags comportamentais: ${tagsLine}
- Espelho das escolhas: ${profile.mirror}
- Luz / forças: ${profile.strengths}
- Gatilhos: ${profile.weaknesses}
- Sombra: ${profile.shadow}
- Passos de integração: ${profile.integrationSteps.map((s, i) => `${i + 1}. ${s}`).join(" ")}

## Respostas personalizadas (texto livre do quiz)
${customBlock}

Ao responder, nomeie o arquétipo dominante/sub quando útil e proponha 1–3 ações concretas.`;
}
