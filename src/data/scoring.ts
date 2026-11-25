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

export function scoreAnswers(
  answers: Record<string, string>,
  questions: Question[] = QUESTIONS,
): HybridScoreBundle {
  const scores = emptyScores();
  const choices: ChoiceRecord[] = [];
  const tagCounts: Partial<Record<BehavioralTag, number>> = {};

  for (const question of questions) {
    const optionId = answers[question.id];
    if (!optionId) continue;
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
): NarrativeResult {
  const bundle = scoreAnswers(answers);
  return calculateResult(bundle, TOTAL_QUESTIONS);
}
