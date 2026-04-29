import { getSeasonProps, getSeasonResult } from "../data/access";
import type { OddsProvider } from "./types";

export const sampleProvider: OddsProvider = {
  async getSeasonProps(playerId, season) {
    return getSeasonProps(playerId, season);
  },
  async getSeasonResult(playerId, season) {
    return getSeasonResult(playerId, season);
  },
};
