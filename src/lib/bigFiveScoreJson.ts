export interface BigFiveTraitScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface BigFiveJsonRow {
  openness: unknown;
  conscientiousness: unknown;
  extraversion: unknown;
  agreeableness: unknown;
  neuroticism: unknown;
}

function traitScore(value: unknown, label: string): number {
  if (typeof value === "object" && value !== null && "score" in value) {
    const score = (value as { score?: unknown }).score;
    if (typeof score === "number") return score;
  }

  throw new Error(`Missing ${label} score`);
}

export function bigFiveScoresFromJson(row: BigFiveJsonRow): BigFiveTraitScores {
  return {
    openness: traitScore(row.openness, "openness"),
    conscientiousness: traitScore(row.conscientiousness, "conscientiousness"),
    extraversion: traitScore(row.extraversion, "extraversion"),
    agreeableness: traitScore(row.agreeableness, "agreeableness"),
    neuroticism: traitScore(row.neuroticism, "neuroticism"),
  };
}

export function normalizeBigFiveLlmScores(scores: BigFiveTraitScores): BigFiveTraitScores {
  return {
    openness: (scores.openness / 120) * 100,
    conscientiousness: (scores.conscientiousness / 120) * 100,
    extraversion: (scores.extraversion / 120) * 100,
    agreeableness: (scores.agreeableness / 120) * 100,
    neuroticism: (scores.neuroticism / 120) * 100,
  };
}

export function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
