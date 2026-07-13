import {
  CURRENT_LINES,
  CURRENT_SEASON,
  HISTORICAL_LINES_2023,
  HISTORICAL_LINES_2024,
  HISTORICAL_LINES_2025,
  type ConsensusLines,
  type SeasonConsensus,
} from "./consensus";
import { findResult } from "./results";
import type { Book, PropLine, SeasonResult, StatMarket } from "../types";

export { CURRENT_SEASON };

const BOOKS: Book[] = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "ESPN BET"];

const BOOK_LINE_OFFSET: Record<Book, number> = {
  DraftKings: 0,
  FanDuel: 0.5,
  BetMGM: -0.5,
  Caesars: 1,
  "ESPN BET": -1,
};

const BOOK_ODDS_TWEAK: Record<Book, [number, number]> = {
  DraftKings: [-110, -110],
  FanDuel: [-115, -105],
  BetMGM: [-105, -115],
  Caesars: [-110, -110],
  "ESPN BET": [-120, +100],
};

function lineFor(market: StatMarket, consensus: number, book: Book): number {
  const offset = BOOK_LINE_OFFSET[book];
  const isYardage =
    market === "passing_yards" ||
    market === "rushing_yards" ||
    market === "receiving_yards";
  const stepped = isYardage ? consensus + offset * 12.5 : consensus + offset * 0.5;
  return isYardage ? Math.round(stepped / 0.5) * 0.5 : stepped;
}

export const BOOKS_LIST: readonly Book[] = BOOKS;

function expandConsensus(consensus: ConsensusLines | undefined): PropLine[] {
  if (!consensus) return [];
  const out: PropLine[] = [];
  for (const [marketKey, line] of Object.entries(consensus)) {
    if (line == null) continue;
    const market = marketKey as StatMarket;
    for (const book of BOOKS) {
      const [overOdds, underOdds] = BOOK_ODDS_TWEAK[book];
      out.push({
        book,
        market,
        line: lineFor(market, line, book),
        overOdds,
        underOdds,
      });
    }
  }
  return out;
}

function consensusForSeason(season: number): SeasonConsensus | undefined {
  if (season === CURRENT_SEASON) return CURRENT_LINES;
  if (season === 2025) return HISTORICAL_LINES_2025;
  if (season === 2024) return HISTORICAL_LINES_2024;
  if (season === 2023) return HISTORICAL_LINES_2023;
  return undefined;
}

export function getSeasonProps(playerId: string, season: number): PropLine[] {
  const set = consensusForSeason(season);
  return expandConsensus(set?.[playerId]);
}

export function getSeasonResult(
  playerId: string,
  season: number,
): SeasonResult | null {
  return findResult(playerId, season) ?? null;
}

export const HISTORICAL_SEASONS = [2025, 2024, 2023] as const;
