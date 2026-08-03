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

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replaceAll("−", "-"));
  return Number.isFinite(parsed) ? parsed : null;
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

function resultName(value: UnknownRecord): string {
  return string(record(value.name)?.value) || string(value.name);
}

function resultLine(value: UnknownRecord | undefined): number | null {
  const match = value ? resultName(value).match(/(-?\d+(?:\.\d+)?)/) : null;
  return match ? number(match[1]) : null;
}

function quote(
  playerName: string,
  market: LiveMarket,
  game: UnknownRecord,
  fixture: UnknownRecord,
  line: number,
  overOdds: number | null,
  underOdds: number | null,
  season: number,
  updatedAt: string,
): SportsbookQuote {
  const known = PLAYERS.find(
    (player) => comparableName(player.name) === comparableName(playerName),
  );
  return {
    scope: "season",
    season,
    eventId: String(fixture.id ?? game.id ?? "") || undefined,
    player: {
      id: known?.id ?? slug(playerName),
      name: known?.name ?? playerName,
      position: known?.position ?? inferPosition([market]),
      team: known?.team,
    },
    market,
    book: { key: "betmgm", name: "BetMGM" },
    line,
    overOdds,
    underOdds,
    updatedAt,
    source: "betmgm-direct",
  };
}

export function normalizeBetMgmSeasonPayload(
  payload: unknown,
  season: number,
  updatedAt: string,
): ProviderResult {
  const root = record(payload);
  const result: ProviderResult = {
    source: "betmgm-direct",
    quotes: [],
    games: [],
    warnings: [],
  };
  if (!root) return result;

  for (const rawFixture of array(root.fixtures)) {
    const fixture = record(rawFixture);
    if (!fixture) continue;
    for (const rawGame of array(fixture.games)) {
      const game = record(rawGame);
      if (!game) continue;
      const name = string(record(game.name)?.value) || string(game.name);
      if (!/regular season/i.test(name)) continue;
      const market = normalizeMarket(undefined, name);
      if (!market) continue;
      const player = record(game.player1);
      const playerName =
        string(player?.short) ||
        string(player?.value).replace(/\s+\([A-Z]{2,3}\)\s*$/, "") ||
        name.replace(/\s+\([A-Z]{2,3}\):.*$/, "").trim();
      if (!playerName) continue;

      const outcomes = array(game.results)
        .map(record)
        .filter((outcome): outcome is UnknownRecord => outcome !== null);
      const over = outcomes.find(
        (outcome) =>
          string(outcome.totalsPrefix).toLowerCase() === "over" ||
          /^over\b/i.test(resultName(outcome)),
      );
      const under = outcomes.find(
        (outcome) =>
          string(outcome.totalsPrefix).toLowerCase() === "under" ||
          /^under\b/i.test(resultName(outcome)),
      );
      const line = number(game.attr) ?? resultLine(over) ?? resultLine(under);
      if (line === null) continue;

      result.quotes.push(
        quote(
          playerName,
          market,
          game,
          fixture,
          Math.abs(line),
          number(over?.americanOdds),
          number(under?.americanOdds),
          season,
          updatedAt,
        ),
      );
    }
  }

  return result;
}
