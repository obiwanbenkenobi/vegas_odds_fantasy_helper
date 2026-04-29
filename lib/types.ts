export type Position = "QB" | "RB" | "WR" | "TE";

export type Book =
  | "DraftKings"
  | "FanDuel"
  | "BetMGM"
  | "Caesars"
  | "ESPN BET";

export type StatMarket =
  | "passing_yards"
  | "passing_tds"
  | "interceptions"
  | "rushing_yards"
  | "rushing_tds"
  | "receiving_yards"
  | "receptions"
  | "receiving_tds";

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
}

export interface PropLine {
  book: Book;
  market: StatMarket;
  line: number;
  overOdds: number;
  underOdds: number;
}

export interface SeasonLines {
  playerId: string;
  season: number;
  props: PropLine[];
}

export interface SeasonStats {
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receiving_yards?: number;
  receptions?: number;
  receiving_tds?: number;
  fumbles_lost?: number;
}

export interface SeasonResult {
  playerId: string;
  season: number;
  stats: SeasonStats;
  positionFinish?: number;
}

export type ScoringSystem = "ppr" | "half_ppr" | "standard";

export interface ScoringRules {
  perPassingYard: number;
  perPassingTd: number;
  perInterception: number;
  perRushingYard: number;
  perRushingTd: number;
  perReceivingYard: number;
  perReception: number;
  perReceivingTd: number;
  perFumbleLost: number;
}

export const STAT_LABELS: Record<StatMarket, string> = {
  passing_yards: "Passing Yards",
  passing_tds: "Passing TDs",
  interceptions: "Interceptions",
  rushing_yards: "Rushing Yards",
  rushing_tds: "Rushing TDs",
  receiving_yards: "Receiving Yards",
  receptions: "Receptions",
  receiving_tds: "Receiving TDs",
};

export const MARKETS_BY_POSITION: Record<Position, StatMarket[]> = {
  QB: ["passing_yards", "passing_tds", "interceptions", "rushing_yards", "rushing_tds"],
  RB: ["rushing_yards", "rushing_tds", "receiving_yards", "receptions", "receiving_tds"],
  WR: ["receiving_yards", "receptions", "receiving_tds", "rushing_yards", "rushing_tds"],
  TE: ["receiving_yards", "receptions", "receiving_tds"],
};
