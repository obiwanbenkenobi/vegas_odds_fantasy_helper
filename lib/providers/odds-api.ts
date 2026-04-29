import type { PropLine, SeasonResult } from "../types";
import type { OddsProvider } from "./types";

// Stub adapter for https://the-odds-api.com/. Drop in an API key via the
// ODDS_API_KEY env var, then wire this provider into lib/providers/index.ts.
//
// The Odds API exposes NFL season-long player props under markets like
// `player_pass_yds_alternate`, `player_rush_yds_alternate`, etc. on the
// `americanfootball_nfl_player_props` endpoint. Map those market keys to our
// StatMarket union and return the resulting PropLine[].

export class OddsApiProvider implements OddsProvider {
  constructor(private readonly apiKey: string) {}

  async getSeasonProps(_playerId: string, _season: number): Promise<PropLine[]> {
    throw new Error("OddsApiProvider.getSeasonProps not implemented yet");
  }

  async getSeasonResult(
    _playerId: string,
    _season: number,
  ): Promise<SeasonResult | null> {
    throw new Error("OddsApiProvider.getSeasonResult not implemented yet");
  }
}
