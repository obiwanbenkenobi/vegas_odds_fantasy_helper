import type { LiveMarket, LiveScoringSystem } from "./types";

export function fantasyPointsForLine(
  market: LiveMarket,
  line: number,
  scoring: LiveScoringSystem,
): number {
  switch (market) {
    case "passing_yards":
      return line * 0.04;
    case "passing_tds":
      return line * 4;
    case "interceptions":
      return line * -2;
    case "rushing_yards":
    case "receiving_yards":
    case "rushing_receiving_yards":
      return line * 0.1;
    case "rushing_tds":
    case "receiving_tds":
      return line * 6;
    case "receptions":
      return line * (scoring === "ppr" ? 1 : scoring === "half_ppr" ? 0.5 : 0);
  }
}
