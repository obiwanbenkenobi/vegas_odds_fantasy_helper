import { PLAYERS } from "@/lib/data/players";
import { inferPosition, normalizeMarket } from "./markets";
import type {
  LiveMarket,
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

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function comparableName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function playerName(event: UnknownRecord): string {
  return string(event.name)
    .replace(/\s+Markets\s+\d{4}\/\d{2,4}\s*$/i, "")
    .trim();
}

function line(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.abs(value) / 1000;
}

function americanOdds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(string(value).replaceAll("−", "-"));
  return Number.isFinite(parsed) ? parsed : null;
}

function quote(
  name: string,
  market: LiveMarket,
  eventId: string,
  total: number,
  overOdds: number | null,
  underOdds: number | null,
  season: number,
  updatedAt: string,
  source: string,
  book: { key: string; name: string },
): SportsbookQuote {
  const known = PLAYERS.find(
    (player) => comparableName(player.name) === comparableName(name),
  );
  return {
    scope: "season",
    season,
    eventId: eventId || undefined,
    player: {
      id: known?.id ?? slug(name),
      name: known?.name ?? name,
      position: known?.position ?? inferPosition([market]),
      team: known?.team,
    },
    market,
    book,
    line: total,
    overOdds,
    underOdds,
    updatedAt,
    source,
  };
}

export function normalizeKambiSeasonPayload(
  payload: unknown,
  season: number,
  source: string,
  book: { key: string; name: string },
): ProviderResult {
  const root = record(payload);
  const result: ProviderResult = {
    source,
    quotes: [],
    games: [],
    warnings: [],
  };
  if (!root) return result;

  for (const rawItem of array(root.events)) {
    const item = record(rawItem);
    const event = record(item?.event);
    if (!item || !event) continue;
    const name = playerName(event);
    if (!name || !/\sMarkets\s/i.test(string(event.name))) continue;

    for (const rawOffer of array(item.betOffers)) {
      const offer = record(rawOffer);
      if (!offer) continue;
      const criterion = record(offer.criterion);
      const label =
        string(criterion?.englishLabel) || string(criterion?.label);
      const market = normalizeMarket(undefined, label);
      if (!market) continue;

      const outcomes = array(offer.outcomes)
        .map(record)
        .filter((outcome): outcome is UnknownRecord => outcome !== null);
      const over = outcomes.find(
        (outcome) => string(outcome.type) === "OT_OVER",
      );
      const under = outcomes.find(
        (outcome) => string(outcome.type) === "OT_UNDER",
      );
      const total = line(over?.line ?? under?.line);
      if (total === null) continue;
      const updatedAt = [string(over?.changedDate), string(under?.changedDate)]
        .filter(Boolean)
        .sort()
        .at(-1) ?? new Date().toISOString();

      result.quotes.push(
        quote(
          name,
          market,
          String(event.id ?? ""),
          total,
          americanOdds(over?.oddsAmerican),
          americanOdds(under?.oddsAmerican),
          season,
          updatedAt,
          source,
          book,
        ),
      );
    }
  }

  return result;
}

export function normalizeBetRiversSeasonPayload(
  payload: unknown,
  season: number,
): ProviderResult {
  return normalizeKambiSeasonPayload(payload, season, "betrivers-direct", {
    key: "betrivers",
    name: "BetRivers",
  });
}
