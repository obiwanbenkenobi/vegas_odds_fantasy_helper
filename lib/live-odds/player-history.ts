import "server-only";

import { currentNflSeason } from "./providers";
import type {
  HistoricalSeasonStats,
  LiveScoringSystem,
  PlayerHistoryResponse,
} from "./types";

const SLEEPER_STATS_BASE = "https://api.sleeper.app/stats/nfl/player";
const HISTORY_SEASON_COUNT = 3;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function number(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function pointsForStats(
  stats: Pick<
    HistoricalSeasonStats,
    | "passingYards"
    | "passingTouchdowns"
    | "interceptions"
    | "rushingYards"
    | "rushingTouchdowns"
    | "receptions"
    | "receivingYards"
    | "receivingTouchdowns"
    | "fumblesLost"
  >,
  scoring: LiveScoringSystem,
): number {
  const receptionValue = scoring === "ppr" ? 1 : scoring === "half_ppr" ? 0.5 : 0;
  return (
    stats.passingYards * 0.04 +
    stats.passingTouchdowns * 4 -
    stats.interceptions * 2 +
    stats.rushingYards * 0.1 +
    stats.rushingTouchdowns * 6 +
    stats.receptions * receptionValue +
    stats.receivingYards * 0.1 +
    stats.receivingTouchdowns * 6 -
    stats.fumblesLost * 2
  );
}

function normalizeSeason(
  payload: unknown,
  season: number,
): HistoricalSeasonStats | null {
  const result = record(payload);
  const stats = record(result?.stats);
  if (!stats) return null;

  const normalized = {
    season,
    games: number(stats.gp),
    passingYards: number(stats.pass_yd),
    passingTouchdowns: number(stats.pass_td),
    interceptions: number(stats.pass_int),
    rushingAttempts: number(stats.rush_att),
    rushingYards: number(stats.rush_yd),
    rushingTouchdowns: number(stats.rush_td),
    targets: number(stats.rec_tgt),
    receptions: number(stats.rec),
    receivingYards: number(stats.rec_yd),
    receivingTouchdowns: number(stats.rec_td),
    fumblesLost: number(stats.fum_lost),
  };

  return {
    ...normalized,
    points: {
      ppr: pointsForStats(normalized, "ppr"),
      half_ppr: pointsForStats(normalized, "half_ppr"),
      standard: pointsForStats(normalized, "standard"),
    },
    positionRank: {
      ppr: number(stats.pos_rank_ppr) || undefined,
      half_ppr: number(stats.pos_rank_half_ppr) || undefined,
      standard: number(stats.pos_rank_std) || undefined,
    },
  };
}

async function getSleeperSeason(
  playerId: string,
  season: number,
): Promise<HistoricalSeasonStats | null> {
  const params = new URLSearchParams({
    season_type: "regular",
    season: String(season),
    grouping: "season",
  });
  const response = await fetch(
    `${SLEEPER_STATS_BASE}/${encodeURIComponent(playerId)}?${params}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Sleeper player stats returned ${response.status}`);
  }
  return normalizeSeason(await response.json(), season);
}

export async function getPlayerHistory(
  playerId: string,
): Promise<PlayerHistoryResponse> {
  const currentSeason = currentNflSeason();
  const seasons = Array.from(
    { length: HISTORY_SEASON_COUNT },
    (_, index) => currentSeason - index - 1,
  );
  const results = await Promise.all(
    seasons.map((season) => getSleeperSeason(playerId, season)),
  );

  return {
    playerId,
    source: "Sleeper",
    seasons: results.filter(
      (result): result is HistoricalSeasonStats => result !== null,
    ),
  };
}
