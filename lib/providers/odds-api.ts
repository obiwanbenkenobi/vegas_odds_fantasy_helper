import type { PropLine, SeasonResult } from "../types";
import type { OddsProvider } from "./types";

// Legacy adapter retained for the original comparison components. The live
// dashboard uses lib/live-odds/providers.ts, which correctly treats The Odds
// API as a game-level player-props source rather than a season-futures source.

export class OddsApiProvider implements OddsProvider {
  constructor(private readonly apiKey: string) {}

  async getSeasonProps(playerId: string, season: number): Promise<PropLine[]> {
    void playerId;
    void season;
    throw new Error("OddsApiProvider.getSeasonProps not implemented yet");
  }

  async getSeasonResult(
    playerId: string,
    season: number,
  ): Promise<SeasonResult | null> {
    void playerId;
    void season;
    throw new Error("OddsApiProvider.getSeasonResult not implemented yet");
  }
}
