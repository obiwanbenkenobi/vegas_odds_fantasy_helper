import { adpEntryFor } from "./adp";
import { fantasyPointsForLine } from "./scoring";
import type {
  AdpEntry,
  AdpPlatform,
  ConsensusComponent,
  LiveMarket,
  LivePosition,
  LiveScoringSystem,
  PlayerProjection,
  SportsbookQuote,
} from "./types";

const MIN_ACTIVE_BOOKS = 3;
const MIN_MARKET_POPULATION = 8;
const MIN_VALUE_EDGE = 10;
const WIDE_BOOK_RANGE = 0.15;

export type VegasValueScope =
  | "full"
  | "passing"
  | "rushing"
  | "receiving";

export interface VegasMarketSignal {
  market: LiveMarket;
  label: string;
  line: number;
  percentile: number;
  playerCount: number;
  bookCount: number;
  wideBookRange: boolean;
}

export interface VegasValueEdge {
  player: PlayerProjection;
  adp: AdpEntry;
  draftPercentile: number;
  vegasPercentile: number;
  edge: number;
  scope: VegasValueScope;
  signals: VegasMarketSignal[];
  bookCount: number;
  wideBookRange: boolean;
}

interface MarketObservation {
  player: PlayerProjection;
  component: ConsensusComponent;
  line: number;
  score: number;
  bookCount: number;
  wideBookRange: boolean;
}

interface WeightedMarketSignal extends VegasMarketSignal {
  weight: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function activeQuotes(component: ConsensusComponent): SportsbookQuote[] {
  const byBook = new Map<string, SportsbookQuote>();
  for (const quote of component.quotes) {
    if (quote.stale || quote.book.stale) continue;
    const current = byBook.get(quote.book.key);
    if (!current || quote.updatedAt > current.updatedAt) {
      byBook.set(quote.book.key, quote);
    }
  }
  return [...byBook.values()];
}

function observationFor(
  player: PlayerProjection,
  component: ConsensusComponent,
  scoring: LiveScoringSystem,
): MarketObservation | null {
  const quotes = activeQuotes(component);
  if (quotes.length < MIN_ACTIVE_BOOKS) return null;
  const lines = quotes.map((quote) => quote.line);
  const line = median(lines);
  const score = fantasyPointsForLine(component.market, line, scoring);
  if (Math.abs(score) < Number.EPSILON) return null;
  const spread = Math.max(...lines) - Math.min(...lines);

  return {
    player,
    component,
    line,
    score,
    bookCount: quotes.length,
    wideBookRange: spread / Math.max(Math.abs(line), 1) >= WIDE_BOOK_RANGE,
  };
}

function marketKey(position: LivePosition, market: LiveMarket): string {
  return `${position}:${market}`;
}

function percentile(value: number, population: number[]): number {
  if (population.length <= 1) return 50;
  const below = population.filter((item) => item < value).length;
  const equal = population.filter((item) => item === value).length;
  const midpoint = below + (equal - 1) / 2;
  return (midpoint / (population.length - 1)) * 100;
}

function draftPercentile(adp: AdpEntry): number | null {
  if (!adp.positionRank || !adp.positionCount) return null;
  if (adp.positionCount <= 1) return 100;
  return (
    ((adp.positionCount - adp.positionRank) / (adp.positionCount - 1)) *
    100
  );
}

function fullProfileMarkets(
  position: LivePosition,
  scoring: LiveScoringSystem,
  available: Set<LiveMarket>,
): LiveMarket[] | null {
  if (position === "QB") {
    const required: LiveMarket[] = [
      "passing_yards",
      "passing_tds",
      "interceptions",
      "rushing_yards",
      "rushing_tds",
    ];
    return required.every((market) => available.has(market)) ? required : null;
  }

  if (position === "RB") {
    const required: LiveMarket[] = available.has("rushing_receiving_yards")
      ? ["rushing_receiving_yards", "rushing_tds", "receiving_tds"]
      : [
          "rushing_yards",
          "receiving_yards",
          "rushing_tds",
          "receiving_tds",
        ];
    if (scoring !== "standard") required.push("receptions");
    return required.every((market) => available.has(market)) ? required : null;
  }

  if (position === "WR" || position === "TE") {
    const required: LiveMarket[] = ["receiving_yards", "receiving_tds"];
    if (scoring !== "standard") required.push("receptions");
    return required.every((market) => available.has(market)) ? required : null;
  }

  return null;
}

function categoryProfile(
  position: LivePosition,
  scoring: LiveScoringSystem,
  available: Set<LiveMarket>,
): { scope: VegasValueScope; markets: LiveMarket[] } | null {
  if (
    position === "QB" &&
    available.has("passing_yards") &&
    available.has("passing_tds")
  ) {
    return {
      scope: "passing",
      markets: ["passing_yards", "passing_tds"],
    };
  }

  if (
    position === "RB" &&
    available.has("rushing_yards") &&
    available.has("rushing_tds")
  ) {
    return {
      scope: "rushing",
      markets: ["rushing_yards", "rushing_tds"],
    };
  }

  if (
    (position === "RB" || position === "WR" || position === "TE") &&
    available.has("receiving_yards")
  ) {
    const markets: LiveMarket[] = ["receiving_yards"];
    if (scoring !== "standard" && available.has("receptions")) {
      markets.push("receptions");
    }
    return { scope: "receiving", markets };
  }

  return null;
}

export function calculateVegasValueEdges(
  players: PlayerProjection[],
  scoring: LiveScoringSystem,
  platform: AdpPlatform,
): VegasValueEdge[] {
  const observations = players.flatMap((player) =>
    player.components.flatMap((component) => {
      const observation = observationFor(player, component, scoring);
      return observation ? [observation] : [];
    }),
  );
  const populations = new Map<string, MarketObservation[]>();

  for (const observation of observations) {
    const key = marketKey(
      observation.player.player.position,
      observation.component.market,
    );
    const values = populations.get(key) ?? [];
    values.push(observation);
    populations.set(key, values);
  }

  const signalsByPlayer = new Map<string, Map<LiveMarket, WeightedMarketSignal>>();
  for (const observationsForMarket of populations.values()) {
    if (observationsForMarket.length < MIN_MARKET_POPULATION) continue;
    const scores = observationsForMarket.map((observation) => observation.score);
    const weight = median(scores.map((score) => Math.abs(score)));
    if (weight <= 0) continue;

    for (const observation of observationsForMarket) {
      const signals = signalsByPlayer.get(observation.player.player.id) ?? new Map();
      signals.set(observation.component.market, {
        market: observation.component.market,
        label: observation.component.label,
        line: observation.line,
        percentile: percentile(observation.score, scores),
        playerCount: observationsForMarket.length,
        bookCount: observation.bookCount,
        wideBookRange: observation.wideBookRange,
        weight,
      });
      signalsByPlayer.set(observation.player.player.id, signals);
    }
  }

  return players
    .flatMap((player): VegasValueEdge[] => {
      const adp = adpEntryFor(player, scoring, platform);
      if (!adp) return [];
      const playerDraftPercentile = draftPercentile(adp);
      if (playerDraftPercentile === null) return [];
      const availableSignals = signalsByPlayer.get(player.player.id);
      if (!availableSignals) return [];
      const availableMarkets = new Set(availableSignals.keys());
      const fullMarkets = fullProfileMarkets(
        player.player.position,
        scoring,
        availableMarkets,
      );
      const profile = fullMarkets
        ? { scope: "full" as const, markets: fullMarkets }
        : categoryProfile(
            player.player.position,
            scoring,
            availableMarkets,
          );
      if (!profile) return [];
      const signals = profile.markets.flatMap((market) => {
        const signal = availableSignals.get(market);
        return signal ? [signal] : [];
      });
      if (signals.length !== profile.markets.length) return [];
      const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
      const vegasPercentile =
        signals.reduce(
          (sum, signal) => sum + signal.percentile * signal.weight,
          0,
        ) / totalWeight;
      const edge = vegasPercentile - playerDraftPercentile;
      if (edge < MIN_VALUE_EDGE) return [];

      return [
        {
          player,
          adp,
          draftPercentile: playerDraftPercentile,
          vegasPercentile,
          edge,
          scope: profile.scope,
          signals: signals.map((signal) => ({
            market: signal.market,
            label: signal.label,
            line: signal.line,
            percentile: signal.percentile,
            playerCount: signal.playerCount,
            bookCount: signal.bookCount,
            wideBookRange: signal.wideBookRange,
          })),
          bookCount: Math.min(...signals.map((signal) => signal.bookCount)),
          wideBookRange: signals.some((signal) => signal.wideBookRange),
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(right.scope === "full") - Number(left.scope === "full") ||
        right.edge - left.edge,
    );
}
