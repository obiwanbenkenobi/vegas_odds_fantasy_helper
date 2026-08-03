import type { LiveMarket, LivePosition } from "./types";

export const LIVE_MARKET_LABELS: Record<LiveMarket, string> = {
  passing_yards: "Pass yards",
  passing_tds: "Pass TDs",
  interceptions: "Interceptions",
  rushing_yards: "Rush yards",
  rushing_tds: "Rush TDs",
  receiving_yards: "Rec yards",
  receptions: "Receptions",
  receiving_tds: "Rec TDs",
  rushing_receiving_yards: "Rush + rec yards",
};

export const WEEKLY_MARKET_KEYS = [
  "player_pass_yds",
  "player_pass_tds",
  "player_pass_interceptions",
  "player_rush_yds",
  "player_rush_tds",
  "player_reception_yds",
  "player_receptions",
  "player_reception_tds",
  "player_rush_reception_yds",
] as const;

const MARKET_KEY_MAP: Record<string, LiveMarket> = {
  player_pass_yds: "passing_yards",
  player_passing_yards: "passing_yards",
  passing_yards: "passing_yards",
  player_pass_tds: "passing_tds",
  player_passing_touchdowns: "passing_tds",
  passing_touchdowns: "passing_tds",
  player_pass_interceptions: "interceptions",
  player_interceptions: "interceptions",
  passing_interceptions: "interceptions",
  player_rush_yds: "rushing_yards",
  player_rushing_yards: "rushing_yards",
  rushing_yards: "rushing_yards",
  player_rush_tds: "rushing_tds",
  player_rushing_touchdowns: "rushing_tds",
  rushing_touchdowns: "rushing_tds",
  player_reception_yds: "receiving_yards",
  player_receiving_yards: "receiving_yards",
  receiving_yards: "receiving_yards",
  player_receptions: "receptions",
  receptions: "receptions",
  player_reception_tds: "receiving_tds",
  player_receiving_touchdowns: "receiving_tds",
  receiving_touchdowns: "receiving_tds",
  player_rush_reception_yds: "rushing_receiving_yards",
  player_rushing_receiving_yards: "rushing_receiving_yards",
  rushing_receiving_yards: "rushing_receiving_yards",
};

export function normalizeMarket(
  key: string | undefined,
  description?: string,
): LiveMarket | null {
  const normalizedKey = (key ?? "")
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (MARKET_KEY_MAP[normalizedKey]) return MARKET_KEY_MAP[normalizedKey];

  const text = `${normalizedKey} ${description ?? ""}`.toLowerCase();
  if (/rush(?:ing)?\s*\+\s*rec(?:eiving)?\s*yards/.test(text)) {
    return "rushing_receiving_yards";
  }
  if (/pass(?:ing)?\s+(?:yard|yd)/.test(text)) return "passing_yards";
  if (/pass(?:ing)?\s+(?:touchdown|td)/.test(text)) return "passing_tds";
  if (/interception/.test(text)) return "interceptions";
  if (/rush(?:ing)?\s+(?:yard|yd)/.test(text)) return "rushing_yards";
  if (/rush(?:ing)?\s+(?:touchdown|td)/.test(text)) return "rushing_tds";
  if (/receiv(?:ing|er)?\s+(?:yard|yd)/.test(text)) return "receiving_yards";
  if (/reception/.test(text) && !/(?:touchdown|td)/.test(text)) {
    return "receptions";
  }
  if (/receiv(?:ing|er|eption)?\s+(?:touchdown|td)/.test(text)) {
    return "receiving_tds";
  }
  return null;
}

export function inferPosition(markets: Iterable<LiveMarket>): LivePosition {
  const values = new Set(markets);
  if (
    values.has("passing_yards") ||
    values.has("passing_tds") ||
    values.has("interceptions")
  ) {
    return "QB";
  }
  if (
    values.has("rushing_yards") &&
    (values.has("receiving_yards") || values.has("receptions"))
  ) {
    return "RB";
  }
  return "FLEX";
}

export function expectedMarkets(position: LivePosition): LiveMarket[][] {
  switch (position) {
    case "QB":
      return [
        ["passing_yards"],
        ["passing_tds"],
        ["interceptions"],
        ["rushing_yards"],
        ["rushing_tds"],
      ];
    case "RB":
      return [
        ["rushing_yards", "rushing_receiving_yards"],
        ["receiving_yards", "rushing_receiving_yards"],
        ["receptions"],
        ["rushing_tds"],
        ["receiving_tds"],
      ];
    case "WR":
    case "TE":
      return [["receiving_yards"], ["receptions"], ["receiving_tds"]];
    default:
      return [
        ["receiving_yards", "rushing_receiving_yards"],
        ["receptions"],
        ["receiving_tds", "rushing_tds"],
      ];
  }
}

