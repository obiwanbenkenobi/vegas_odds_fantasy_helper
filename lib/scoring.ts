import type {
  ScoringRules,
  ScoringSystem,
  SeasonStats,
  StatMarket,
} from "./types";

export const SCORING_PRESETS: Record<ScoringSystem, ScoringRules> = {
  ppr: {
    perPassingYard: 0.04,
    perPassingTd: 4,
    perInterception: -2,
    perRushingYard: 0.1,
    perRushingTd: 6,
    perReceivingYard: 0.1,
    perReception: 1,
    perReceivingTd: 6,
    perFumbleLost: -2,
  },
  half_ppr: {
    perPassingYard: 0.04,
    perPassingTd: 4,
    perInterception: -2,
    perRushingYard: 0.1,
    perRushingTd: 6,
    perReceivingYard: 0.1,
    perReception: 0.5,
    perReceivingTd: 6,
    perFumbleLost: -2,
  },
  standard: {
    perPassingYard: 0.04,
    perPassingTd: 4,
    perInterception: -2,
    perRushingYard: 0.1,
    perRushingTd: 6,
    perReceivingYard: 0.1,
    perReception: 0,
    perReceivingTd: 6,
    perFumbleLost: -2,
  },
};

export const SCORING_LABELS: Record<ScoringSystem, string> = {
  ppr: "PPR",
  half_ppr: "Half PPR",
  standard: "Standard",
};

export function fantasyPoints(stats: SeasonStats, rules: ScoringRules): number {
  return (
    (stats.passing_yards ?? 0) * rules.perPassingYard +
    (stats.passing_tds ?? 0) * rules.perPassingTd +
    (stats.interceptions ?? 0) * rules.perInterception +
    (stats.rushing_yards ?? 0) * rules.perRushingYard +
    (stats.rushing_tds ?? 0) * rules.perRushingTd +
    (stats.receiving_yards ?? 0) * rules.perReceivingYard +
    (stats.receptions ?? 0) * rules.perReception +
    (stats.receiving_tds ?? 0) * rules.perReceivingTd +
    (stats.fumbles_lost ?? 0) * rules.perFumbleLost
  );
}

export function pointsForStat(
  market: StatMarket,
  value: number,
  rules: ScoringRules,
): number {
  switch (market) {
    case "passing_yards":
      return value * rules.perPassingYard;
    case "passing_tds":
      return value * rules.perPassingTd;
    case "interceptions":
      return value * rules.perInterception;
    case "rushing_yards":
      return value * rules.perRushingYard;
    case "rushing_tds":
      return value * rules.perRushingTd;
    case "receiving_yards":
      return value * rules.perReceivingYard;
    case "receptions":
      return value * rules.perReception;
    case "receiving_tds":
      return value * rules.perReceivingTd;
  }
}
