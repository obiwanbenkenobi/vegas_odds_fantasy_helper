import { PLAYERS } from "@/lib/data/players";
import { LIVE_MARKET_LABELS, expectedMarkets, inferPosition } from "./markets";
import { fantasyPointsForLine } from "./scoring";
import type {
  DashboardResponse,
  GameBookLine,
  GameSummary,
  LiveBook,
  LiveMarket,
  LivePosition,
  PlayerProjection,
  SportsbookQuote,
} from "./types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function impliedProbability(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

function mainLineScore(quote: SportsbookQuote): number {
  if (quote.overOdds === null || quote.underOdds === null) return 1;
  const over = impliedProbability(quote.overOdds);
  const under = impliedProbability(quote.underOdds);
  return Math.abs(over / (over + under) - 0.5);
}

function latestTimestamp(values: string[]): string {
  return [...values].sort().at(-1) ?? new Date().toISOString();
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function slateWeek(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function quoteTarget(quote: SportsbookQuote): string {
  return quote.scope === "season"
    ? `season:${quote.season}`
    : `event:${slateWeek(quote.kickoff) ?? quote.eventId ?? quote.season}`;
}

function correctedPosition(
  name: string,
  current: LivePosition,
  markets: LiveMarket[],
): LivePosition {
  const known = PLAYERS.find(
    (player) => normalizeName(player.name) === normalizeName(name),
  );
  return known?.position ?? (current === "FLEX" ? inferPosition(markets) : current);
}

function chooseMainLines(quotes: SportsbookQuote[]): SportsbookQuote[] {
  const grouped = new Map<string, SportsbookQuote[]>();
  for (const quote of quotes) {
    const key = [
      quote.scope,
      quoteTarget(quote),
      normalizeName(quote.player.name),
      quote.market,
      quote.book.key,
    ].join(":");
    const values = grouped.get(key) ?? [];
    values.push(quote);
    grouped.set(key, values);
  }

  return [...grouped.values()].map((values) =>
    [...values].sort((a, b) => {
      const balance = mainLineScore(a) - mainLineScore(b);
      if (balance !== 0) return balance;
      return b.updatedAt.localeCompare(a.updatedAt);
    })[0],
  );
}

export function aggregatePlayers(quotes: SportsbookQuote[]): PlayerProjection[] {
  const mainQuotes = chooseMainLines(quotes);
  const playerGroups = new Map<string, SportsbookQuote[]>();

  for (const quote of mainQuotes) {
    const key = `${quoteTarget(quote)}:${normalizeName(quote.player.name)}`;
    const values = playerGroups.get(key) ?? [];
    values.push(quote);
    playerGroups.set(key, values);
  }

  const players: PlayerProjection[] = [];
  for (const playerQuotes of playerGroups.values()) {
    const first = playerQuotes[0];
    const markets = [...new Set(playerQuotes.map((quote) => quote.market))];
    const position = correctedPosition(
      first.player.name,
      first.player.position,
      markets,
    );
    const marketGroups = new Map<LiveMarket, SportsbookQuote[]>();
    for (const quote of playerQuotes) {
      const values = marketGroups.get(quote.market) ?? [];
      values.push(quote);
      marketGroups.set(quote.market, values);
    }

    const hasSeparateYardage =
      marketGroups.has("rushing_yards") || marketGroups.has("receiving_yards");
    const components = [...marketGroups.entries()]
      .filter(
        ([market]) =>
          market !== "rushing_receiving_yards" || !hasSeparateYardage,
      )
      .map(([market, values]) => {
        const lines = values.map((quote) => quote.line);
        const line = median(lines) ?? 0;
        return {
          market,
          label: LIVE_MARKET_LABELS[market],
          line,
          low: Math.min(...lines),
          high: Math.max(...lines),
          points: {
            ppr: fantasyPointsForLine(market, line, "ppr"),
            half_ppr: fantasyPointsForLine(market, line, "half_ppr"),
            standard: fantasyPointsForLine(market, line, "standard"),
          },
          quotes: [...values].sort((a, b) => a.book.name.localeCompare(b.book.name)),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const presentMarkets = new Set(markets);
    const expected = expectedMarkets(position);
    const covered = expected.filter((alternatives) =>
      alternatives.some((market) => presentMarkets.has(market)),
    ).length;
    const coverage = Math.round((covered / expected.length) * 100);
    const bookCount = new Set(playerQuotes.map((quote) => quote.book.key)).size;
    const confidence =
      bookCount >= 3 && coverage >= 70
        ? "High"
        : bookCount >= 2 && coverage >= 40
          ? "Medium"
          : "Low";

    const known = PLAYERS.find(
      (player) => normalizeName(player.name) === normalizeName(first.player.name),
    );

    players.push({
      player: {
        ...first.player,
        id: known?.id ?? first.player.id,
        position,
        team: first.player.team ?? known?.team,
      },
      eventId: first.eventId,
      kickoff: first.kickoff,
      week: first.week,
      points: {
        ppr: components.reduce((sum, item) => sum + item.points.ppr, 0),
        half_ppr: components.reduce((sum, item) => sum + item.points.half_ppr, 0),
        standard: components.reduce((sum, item) => sum + item.points.standard, 0),
      },
      rank: { ppr: 0, half_ppr: 0, standard: 0 },
      components,
      coverage,
      confidence,
      bookCount,
      updatedAt: latestTimestamp(playerQuotes.map((quote) => quote.updatedAt)),
    });
  }

  for (const scoring of ["ppr", "half_ppr", "standard"] as const) {
    const byPosition = new Map<LivePosition, PlayerProjection[]>();
    for (const player of players) {
      const values = byPosition.get(player.player.position) ?? [];
      values.push(player);
      byPosition.set(player.player.position, values);
    }
    for (const values of byPosition.values()) {
      values
        .sort((a, b) => b.points[scoring] - a.points[scoring])
        .forEach((player, index) => {
          player.rank[scoring] = index + 1;
        });
    }
  }

  return players.sort((a, b) => b.points.ppr - a.points.ppr);
}

function chooseLatestGameLines(lines: GameBookLine[]): GameBookLine[] {
  const grouped = new Map<string, GameBookLine>();
  for (const line of lines) {
    const key = `${gameTarget(line)}:${line.book.key}`;
    const current = grouped.get(key);
    if (!current || line.updatedAt > current.updatedAt) grouped.set(key, line);
  }
  return [...grouped.values()];
}

function gameTarget(line: GameBookLine): string {
  return [
    normalizeName(line.awayTeam),
    normalizeName(line.homeTeam),
    slateWeek(line.kickoff),
  ].join(":");
}

export function aggregateGames(rawLines: GameBookLine[]): GameSummary[] {
  const lines = chooseLatestGameLines(rawLines);
  const grouped = new Map<string, GameBookLine[]>();
  for (const line of lines) {
    const key = gameTarget(line);
    const values = grouped.get(key) ?? [];
    values.push(line);
    grouped.set(key, values);
  }

  return [...grouped.values()]
    .map((values) => {
      const first = values[0];
      const spread = median(
        values.flatMap((line) =>
          line.homeSpread === null ? [] : [line.homeSpread],
        ),
      );
      const total = median(
        values.flatMap((line) => (line.total === null ? [] : [line.total])),
      );
      const homeMoneyline = median(
        values.flatMap((line) =>
          line.homeMoneyline === null ? [] : [line.homeMoneyline],
        ),
      );
      const awayMoneyline = median(
        values.flatMap((line) =>
          line.awayMoneyline === null ? [] : [line.awayMoneyline],
        ),
      );
      return {
        eventId: first.eventId,
        kickoff: first.kickoff,
        week: first.week,
        homeTeam: first.homeTeam,
        awayTeam: first.awayTeam,
        homeSpread: spread,
        total,
        homeMoneyline,
        awayMoneyline,
        homeImpliedTotal:
          spread !== null && total !== null ? total / 2 - spread / 2 : null,
        awayImpliedTotal:
          spread !== null && total !== null ? total / 2 + spread / 2 : null,
        bookCount: values.length,
        lines: values.sort((a, b) => a.book.name.localeCompare(b.book.name)),
      };
    })
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function collectBooks(
  quotes: SportsbookQuote[],
  games: GameBookLine[],
): LiveBook[] {
  const books = new Map<string, LiveBook>();
  for (const item of [...quotes, ...games]) {
    const existing = books.get(item.book.key);
    const stale = "stale" in item && item.stale === true;
    books.set(item.book.key, {
      ...item.book,
      stale: existing ? existing.stale === true && stale : stale,
    });
  }
  return [...books.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type DashboardBase = Omit<
  DashboardResponse,
  "players" | "games" | "books"
>;
