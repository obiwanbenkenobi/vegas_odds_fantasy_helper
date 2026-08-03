import { PLAYERS } from "@/lib/data/players";
import { inferPosition, normalizeMarket } from "./markets";
import type {
  GameBookLine,
  LiveBook,
  LiveMarket,
  LivePlayer,
  ProviderResult,
  SportsbookQuote,
} from "./types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function comparableName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanPlayerName(value: string): string {
  return value
    .replace(/\s+\([A-Z]{2,4}\)\s*$/i, "")
    .replace(/\s+-\s+(?:over|under)$/i, "")
    .trim();
}

function playerFromName(name: string, markets: Iterable<LiveMarket>): LivePlayer {
  const cleaned = cleanPlayerName(name);
  const known = PLAYERS.find(
    (player) => comparableName(player.name) === comparableName(cleaned),
  );

  return {
    id: known?.id ?? slug(cleaned),
    name: known?.name ?? cleaned,
    position: known?.position ?? inferPosition(markets),
    team: known?.team,
  };
}

function bookFrom(raw: UnknownRecord, market?: UnknownRecord): LiveBook {
  const key = string(raw.key) || string(raw.bookmaker) || string(market?.bookmaker);
  const name =
    string(raw.title) ||
    string(raw.name) ||
    string(raw.bookmaker_title) ||
    string(market?.bookmaker_title) ||
    key;
  return { key: slug(key || name), name: name || "Unknown book" };
}

function timestamp(...values: unknown[]): string {
  const found = values.find((value) => typeof value === "string") as
    | string
    | undefined;
  return found ?? new Date().toISOString();
}

function extractPlayerName(
  outcome: UnknownRecord,
  market: UnknownRecord,
): string {
  const description = string(outcome.description);
  if (description && !/^(over|under)$/i.test(description)) {
    return cleanPlayerName(description);
  }

  const outcomeName = string(outcome.name);
  if (outcomeName && !/^(over|under)$/i.test(outcomeName)) {
    return cleanPlayerName(outcomeName);
  }

  const marketDescription = string(market.description) || string(market.name);
  return cleanPlayerName(
    marketDescription
      .replace(/regular season/gi, "")
      .replace(/over\s*\/\s*under/gi, "")
      .replace(/(?:passing|rushing|receiving|reception)\s+(?:yards?|touchdowns?|tds?)/gi, "")
      .replace(/total/gi, "")
      .replace(/^\s*[-:–—]\s*|\s*[-:–—]\s*$/g, "")
      .trim(),
  );
}

interface EventContext {
  id: string;
  kickoff: string;
  week?: string;
  homeTeam: string;
  awayTeam: string;
}

function parsePlayerMarkets(
  markets: unknown[],
  bookRaw: UnknownRecord,
  context: EventContext,
  source: string,
  scope: "season" | "game",
  season: number,
): SportsbookQuote[] {
  const book = bookFrom(bookRaw);
  const quotes: SportsbookQuote[] = [];

  for (const rawMarket of markets) {
    const market = record(rawMarket);
    if (!market) continue;
    const canonical = normalizeMarket(
      string(market.key) || string(market.market_key),
      string(market.description) || string(market.name),
    );
    if (!canonical) continue;

    const grouped = new Map<
      string,
      {
        playerName: string;
        line: number;
        overOdds: number | null;
        underOdds: number | null;
      }
    >();

    for (const rawOutcome of array(market.outcomes)) {
      const outcome = record(rawOutcome);
      if (!outcome) continue;
      const side = string(outcome.name).toLowerCase();
      if (side !== "over" && side !== "under") continue;
      const line = number(outcome.point ?? outcome.line ?? outcome.overUnder);
      if (line === null) continue;
      const playerName = extractPlayerName(outcome, market);
      if (!playerName) continue;
      const key = `${comparableName(playerName)}:${line}`;
      const current = grouped.get(key) ?? {
        playerName,
        line,
        overOdds: null,
        underOdds: null,
      };
      const price = number(outcome.price ?? outcome.odds);
      if (side === "over") current.overOdds = price;
      if (side === "under") current.underOdds = price;
      grouped.set(key, current);
    }

    for (const item of grouped.values()) {
      const updatedAt = timestamp(
        market.last_update,
        market.book_updated_at,
        bookRaw.last_update,
      );
      quotes.push({
        scope,
        season,
        week: context.week,
        eventId: context.id || undefined,
        kickoff: context.kickoff || undefined,
        player: playerFromName(item.playerName, [canonical]),
        market: canonical,
        book: book.key ? book : bookFrom(bookRaw, market),
        line: item.line,
        overOdds: item.overOdds,
        underOdds: item.underOdds,
        updatedAt,
        source,
      });
    }
  }

  return quotes;
}

function parseGameLines(
  markets: unknown[],
  bookRaw: UnknownRecord,
  context: EventContext,
  source: string,
): GameBookLine | null {
  if (!context.id || !context.homeTeam || !context.awayTeam) return null;
  const book = bookFrom(bookRaw);
  const line: GameBookLine = {
    eventId: context.id,
    kickoff: context.kickoff,
    week: context.week,
    homeTeam: context.homeTeam,
    awayTeam: context.awayTeam,
    book,
    homeSpread: null,
    awaySpread: null,
    total: null,
    homeMoneyline: null,
    awayMoneyline: null,
    updatedAt: timestamp(bookRaw.last_update),
    source,
  };

  for (const rawMarket of markets) {
    const market = record(rawMarket);
    if (!market) continue;
    const key = string(market.key).toLowerCase();
    const outcomes = array(market.outcomes).map(record).filter(Boolean) as UnknownRecord[];
    if (key === "spreads") {
      for (const outcome of outcomes) {
        const name = string(outcome.name);
        if (name === context.homeTeam) line.homeSpread = number(outcome.point);
        if (name === context.awayTeam) line.awaySpread = number(outcome.point);
      }
    }
    if (key === "totals") {
      const over = outcomes.find((outcome) => /over/i.test(string(outcome.name)));
      line.total = over ? number(over.point) : null;
    }
    if (key === "h2h") {
      for (const outcome of outcomes) {
        const name = string(outcome.name);
        if (name === context.homeTeam) line.homeMoneyline = number(outcome.price);
        if (name === context.awayTeam) line.awayMoneyline = number(outcome.price);
      }
    }
    line.updatedAt = timestamp(market.last_update, line.updatedAt);
  }

  return Object.values(line).some((value) => typeof value === "number")
    ? line
    : null;
}

function eventsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  if (!root) return [];
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.events)) return root.events;
  return [root];
}

export function normalizeSportsbookPayload(
  payload: unknown,
  options: {
    source: string;
    scope: "season" | "game";
    season: number;
  },
): ProviderResult {
  const result: ProviderResult = {
    source: options.source,
    quotes: [],
    games: [],
    warnings: [],
  };

  for (const rawEvent of eventsFromPayload(payload)) {
    const event = record(rawEvent);
    if (!event) continue;
    const context: EventContext = {
      id: string(event.id ?? event.event_id ?? event.eventID),
      kickoff: string(event.commence_time ?? event.startsAt),
      week: string(record(event.info)?.seasonWeek) || string(event.week) || undefined,
      homeTeam: string(event.home_team ?? event.homeTeam),
      awayTeam: string(event.away_team ?? event.awayTeam),
    };

    const bookmakers = array(event.bookmakers);
    if (bookmakers.length > 0) {
      for (const rawBook of bookmakers) {
        const book = record(rawBook);
        if (!book) continue;
        const markets = array(book.markets);
        result.quotes.push(
          ...parsePlayerMarkets(
            markets,
            book,
            context,
            options.source,
            options.scope,
            options.season,
          ),
        );
        const game = parseGameLines(markets, book, context, options.source);
        if (game) result.games.push(game);
      }
      continue;
    }

    // Some futures feeds attach the bookmaker to each market instead of
    // returning a bookmakers array.
    for (const rawMarket of array(event.markets)) {
      const market = record(rawMarket);
      if (!market) continue;
      const syntheticBook: UnknownRecord = {
        key: market.bookmaker,
        title: market.bookmaker_title,
        last_update: market.last_update,
        markets: [market],
      };
      result.quotes.push(
        ...parsePlayerMarkets(
          [market],
          syntheticBook,
          context,
          options.source,
          options.scope,
          options.season,
        ),
      );
    }
  }

  return result;
}

