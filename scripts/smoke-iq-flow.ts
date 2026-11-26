/**
 * Headless smoke: scoring, hybrid mix, challenge URL, leaderboard helpers.
 * Run: npx tsx scripts/smoke-iq-flow.ts
 */
import { getAssessmentItems } from "../src/lib/assessmentBank";
import { calculateIqResult } from "../src/lib/iqCalculator";
import {
  buildChallengePath,
  parseChallengeInvite,
  topPercentFromPercentile,
} from "../src/lib/challengeInvite";
import {
  assessmentModeToLeaderboardMode,
  buildLeaderboardEntry,
  normalizeParticipantName,
} from "../src/lib/leaderboard";
import { createInitialState } from "../src/lib/quizStorage";
import { QUIZ_TOTAL_QUESTIONS } from "../src/types/quiz";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main() {
  for (const mode of ["figures", "questions", "hybrid"] as const) {
    const items = getAssessmentItems(mode);
    assert(items.length === QUIZ_TOTAL_QUESTIONS, `${mode} size`);
    const selected = items.map((q) => q.correctIndex);
    const times = items.map(() => 20_000);
    const result = calculateIqResult(items, selected, times, [], mode);
    assert(result.iq >= 130, `${mode} all-correct IQ ${result.iq}`);
    assert(result.percentile > 90, `${mode} percentile`);
    assert(result.answers.every((a) => a.correct), `${mode} all correct flags`);

    const state = createInitialState(mode, items.length, "QA Tester", null);
    assert(state.answers.length === items.length, `${mode} state answers`);
    assert(state.participantName === "QA Tester", `${mode} name`);
    assert(state.resultsUnlocked === false, `${mode} locked by default`);
    assert(state.sessionId === null, `${mode} sessionId starts null`);
    assert(state.unlockOrderNsu === null, `${mode} unlockOrderNsu null`);

    const entry = buildLeaderboardEntry({
      name: state.participantName,
      result,
      durationSeconds: 600,
      avatarUrl: null,
    });
    assert(entry.mode === assessmentModeToLeaderboardMode(mode), `${mode} lb mode`);
    assert(entry.name === "QA Tester", `${mode} lb name`);

    const path = buildChallengePath({
      name: entry.name,
      iq: result.iq,
      marginOfError: result.marginOfError,
      percentile: result.percentile,
      rank: 1,
      mode,
    });
    assert(path.startsWith("/teste-qi?"), `${mode} challenge path`);
    const invite = parseChallengeInvite(path.split("?")[1]);
    assert(invite?.challenger === "QA Tester", `${mode} invite parse`);
    assert(invite?.targetIq === result.iq, `${mode} invite iq`);
  }

  assert(normalizeParticipantName("  ") === "Anônimo", "anon name");
  assert(topPercentFromPercentile(98) === 2, "top%");
  console.log(JSON.stringify({ ok: true, modes: 3 }, null, 2));
}

main();
