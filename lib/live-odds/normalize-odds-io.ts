import { normalizeMarket } from "./markets";
import { normalizeSportsbookPayload } from "./normalize";
import type { ProviderResult } from "./types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function decimalToAmerican(value: unknown): number | null {
  const decimal = number(value);
  if (decimal === null || decimal <= 1) return null;
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

function playerMarket(market: UnknownRecord): UnknownRecord | null {
  const name = string(market.name);
  const canonical = normalizeMarket(undefined, name);
  if (!canonical) return null;

  const outcomes = array(market.odds).flatMap((rawOdd) => {
    const odd = record(rawOdd);
    if (!odd) return [];
    const player = string(odd.label).trim();
    const point = number(odd.hdp);
    if (!player || point === null) return [];

    return [
      {
        name: "Over",
        description: player,
        point,
        price: decimalToAmerican(odd.over),
      },
      {
        name: "Under",
        description: player,
        point,
        price: decimalToAmerican(odd.under),
      },
    ];
  });

  if (outcomes.length === 0) return null;
  return {
    key: canonical,
    description: name,
    last_update: string(market.updatedAt ?? market.updated_at),
    outcomes,
  };
}

function gameMarket(
  market: UnknownRecord,
  homeTeam: string,
  awayTeam: string,
): UnknownRecord | null {
  const name = string(market.name).toLowerCase();
  const odd = record(array(market.odds)[0]);
  if (!odd) return null;
  const lastUpdate = string(market.updatedAt ?? market.updated_at);

  if (name === "ml" || name.includes("moneyline")) {
    return {
      key: "h2h",
      last_update: lastUpdate,
      outcomes: [
        { name: homeTeam, price: decimalToAmerican(odd.home) },
        { name: awayTeam, price: decimalToAmerican(odd.away) },
      ],
    };
  }

  if (name.includes("spread") || name.includes("handicap")) {
    const homePoint = number(odd.hdp);
    if (homePoint === null) return null;
    return {
      key: "spreads",
      last_update: lastUpdate,
      outcomes: [
        {
          name: homeTeam,
          point: homePoint,
          price: decimalToAmerican(odd.home),
        },
        {
          name: awayTeam,
          point: -homePoint,
          price: decimalToAmerican(odd.away),
        },
      ],
    };
  }

  if (name.includes("total")) {
    const point = number(odd.hdp);
    if (point === null) return null;
    return {
      key: "totals",
      last_update: lastUpdate,
      outcomes: [
        { name: "Over", point, price: decimalToAmerican(odd.over) },
        { name: "Under", point, price: decimalToAmerican(odd.under) },
      ],
    };
  }

  return null;
}

function transformEvent(rawEvent: unknown): UnknownRecord | null {
  const event = record(rawEvent);
  if (!event) return null;
  const homeTeam = string(event.home);
  const awayTeam = string(event.away);
  const rawBooks = record(event.bookmakers);
  if (!rawBooks) return null;

  const bookmakers = Object.entries(rawBooks).map(([name, rawMarkets]) => {
    const markets = array(rawMarkets)
      .map(record)
      .filter((market): market is UnknownRecord => market !== null)
      .flatMap((market) => {
        const player = playerMarket(market);
        if (player) return [player];
        const game = gameMarket(market, homeTeam, awayTeam);
        return game ? [game] : [];
      });
    const updates = markets
      .map((market) => string(market.last_update))
      .filter(Boolean)
      .sort();

    return {
      key: name,
      title: name,
      last_update: updates.at(-1),
      markets,
    };
  });

  return {
    id: `odds-io:${String(event.id ?? "")}`,
    commence_time: string(event.date),
    home_team: homeTeam,
    away_team: awayTeam,
    bookmakers,
  };
}

export function normalizeOddsIoPayload(
  payload: unknown,
  season: number,
): ProviderResult {
  const rawEvents = Array.isArray(payload) ? payload : [payload];
  const events = rawEvents
    .map(transformEvent)
    .filter((event): event is UnknownRecord => event !== null);

  return normalizeSportsbookPayload(events, {
    source: "odds-api-io",
    scope: "game",
    season,
  });
}
