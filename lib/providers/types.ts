import type { PropLine, SeasonResult } from "../types";

export interface OddsProvider {
  getSeasonProps(playerId: string, season: number): Promise<PropLine[]>;
  getSeasonResult(playerId: string, season: number): Promise<SeasonResult | null>;
}
