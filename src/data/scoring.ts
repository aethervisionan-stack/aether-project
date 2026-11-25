import {
  analyzeCustomAnswer,
  customAnswerSummary,
  isCustomOptionId,
} from "@/lib/custom-answer-analyzer";
import {
  POINTS_PER_ANSWER,
  PRIMARY_POINTS,
  SECONDARY_POINTS,
  calculateResult,
  emptyScores,
  type ChoiceRecord,
  type HybridScoreBundle,
  type NarrativeResult,
  type Question,
} from "./archetypes";
import type { BehavioralTag } from "./behavioralTags";
import { QUESTIONS, TOTAL_QUESTIONS } from "./quizQuestions";

export { QUESTIONS, TOTAL_QUESTIONS };

/**
 * Score closed options + free-text answers with the same +3/+1 weights
 * so custom answers stay normalized against the hybrid 16Q scale.
 */
export function scoreAnswers(
  answers: Record<string, string>,
  customAnswers: Record<string, string> = {},
  questions: Question[] = QUESTIONS,
): HybridScoreBundle {
  const scores = emptyScores();
  const choices: ChoiceRecord[] = [];
  const tagCounts: Partial<Record<BehavioralTag, number>> = {};

  for (const question of questions) {
    const optionId = answers[question.id];
    if (!optionId) continue;

    if (isCustomOptionId(optionId)) {
      const text = customAnswers[question.id] ?? "";
      const analysis = analyzeCustomAnswer(text, question.id, question.stage);

      scores[analysis.inferred_primary] += PRIMARY_POINTS;
      scores[analysis.inferred_secondary] += SECONDARY_POINTS;

      for (const tag of analysis.detected_tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }

      choices.push({
        questionId: question.id,
        optionId: optionId,
        primary: analysis.inferred_primary,
        secondary: analysis.inferred_secondary,
        tags: analysis.detected_tags,
        summary: customAnswerSummary(analysis),
        optionText: analysis.custom_answer_text,
        axis: question.stage,
        isCustom: true,
        customText: analysis.custom_answer_text,
        confidenceScore: analysis.confidence_score,
        emotionalTone: analysis.emotional_tone,
        actionStance: analysis.action_stance,
      });
      continue;
    }

    const option = question.options.find((o) => o.id === optionId);
    if (!option) continue;

    scores[option.primary] += PRIMARY_POINTS;
    scores[option.secondary] += SECONDARY_POINTS;

    for (const tag of option.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }

    choices.push({
      questionId: question.id,
      optionId: option.id,
      primary: option.primary,
      secondary: option.secondary,
      tags: option.tags,
      summary: option.summary,
      optionText: option.text,
      axis: question.stage,
    });
  }

  return {
    scores,
    choices,
    tagCounts,
    totalPoints: choices.length * POINTS_PER_ANSWER,
  };
}

export function buildNarrativeResult(
  answers: Record<string, string>,
  customAnswers: Record<string, string> = {},
): NarrativeResult {
  const bundle = scoreAnswers(answers, customAnswers);
  return calculateResult(bundle, TOTAL_QUESTIONS);
}
