import { PLAYERS } from "@/lib/data/players";
import { inferPosition } from "./markets";
import type {
  LiveMarket,
  ProviderResult,
  SportsbookQuote,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const MARKET_PATTERN =
  /^(.*?)\s+Regular Season\s+(Passing|Rushing|Receiving)\s+(Yards|TDs|Touchdowns)\s+\d{4}-\d{2,4}$/i;

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

function values(value: unknown): UnknownRecord[] {
  const source = record(value);
  return source
    ? Object.values(source)
        .map(record)
        .filter((item): item is UnknownRecord => item !== null)
    : [];
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

function marketDetails(name: string): {
  playerName: string;
  market: LiveMarket;
} | null {
  const match = name.match(MARKET_PATTERN);
  if (!match) return null;
  const action = match[2].toLowerCase();
  const statistic = match[3].toLowerCase();
  const market = (
    statistic === "yards"
      ? `${action}_yards`
      : `${action}_tds`
  ) as LiveMarket;
  return { playerName: match[1].trim(), market };
}

function runnerLine(runner: UnknownRecord | undefined): number | null {
  const match = string(runner?.runnerName).match(
    /\b(?:Over|Under)\s+(-?\d+(?:\.\d+)?)/i,
  );
  return match ? number(match[1]) : null;
}

function runnerOdds(runner: UnknownRecord | undefined): number | null {
  return number(
    record(record(runner?.winRunnerOdds)?.americanDisplayOdds)?.americanOdds,
  );
}

function quote(
  playerName: string,
  market: LiveMarket,
  marketRecord: UnknownRecord,
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
    eventId: String(marketRecord.eventId ?? marketRecord.marketId ?? "") || undefined,
    player: {
      id: known?.id ?? slug(playerName),
      name: known?.name ?? playerName,
      position: known?.position ?? inferPosition([market]),
      team: known?.team,
    },
    market,
    book: { key: "fanduel", name: "FanDuel" },
    line,
    overOdds,
    underOdds,
    updatedAt,
    source: "fanduel-direct",
  };
}

export function normalizeFanDuelSeasonPayload(
  payload: unknown,
  season: number,
  updatedAt: string,
): ProviderResult {
  const root = record(payload);
  const result: ProviderResult = {
    source: "fanduel-direct",
    quotes: [],
    games: [],
    warnings: [],
  };
  const attachments = record(root?.attachments);
  if (!attachments) return result;

  for (const marketRecord of values(attachments.markets)) {
    const details = marketDetails(string(marketRecord.marketName));
    if (!details) continue;
    const runners = array(marketRecord.runners)
      .map(record)
      .filter((runner): runner is UnknownRecord => runner !== null);
    const over = runners.find((runner) =>
      /\bOver\s+-?\d/i.test(string(runner.runnerName)),
    );
    const under = runners.find((runner) =>
      /\bUnder\s+-?\d/i.test(string(runner.runnerName)),
    );
    const line = runnerLine(over) ?? runnerLine(under);
    if (line === null) continue;

    result.quotes.push(
      quote(
        details.playerName,
        details.market,
        marketRecord,
        Math.abs(line),
        runnerOdds(over),
        runnerOdds(under),
        season,
        updatedAt,
      ),
    );
  }

  return result;
}
