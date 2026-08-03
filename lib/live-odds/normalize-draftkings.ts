import { PLAYERS } from "@/lib/data/players";
import { inferPosition } from "./markets";
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

function americanOdds(value: unknown): number | null {
  const normalized = string(value)
    .replaceAll("−", "-")
    .replace(/[^0-9+-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function lineFromSelection(selection: UnknownRecord): number | null {
  if (typeof selection.points === "number" && Number.isFinite(selection.points)) {
    return Math.abs(selection.points);
  }
  const match = string(selection.label).match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function playerNameFromEvent(event: UnknownRecord): string {
  const participant = array(event.participants)
    .map(record)
    .find((item) => item && string(item.name) && !string(item.id));
  if (participant) return string(participant.name).trim();

  return string(event.name)
    .replace(/^NFL\s+\d{4}\/\d{2}\s+-\s+/i, "")
    .trim();
}

function playerQuote(
  playerName: string,
  market: LiveMarket,
  eventId: string,
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
    eventId: eventId || undefined,
    player: {
      id: known?.id ?? slug(playerName),
      name: known?.name ?? playerName,
      position: known?.position ?? inferPosition([market]),
      team: known?.team,
    },
    market,
    book: { key: "draftkings", name: "DraftKings" },
    line,
    overOdds,
    underOdds,
    updatedAt,
    source: "draftkings-direct",
  };
}

export function normalizeDraftKingsSeasonPayload(
  payload: unknown,
  market: LiveMarket,
  season: number,
  updatedAt: string,
): ProviderResult {
  const root = record(payload);
  const result: ProviderResult = {
    source: "draftkings-direct",
    quotes: [],
    games: [],
    warnings: [],
  };
  if (!root) return result;

  const events = new Map(
    array(root.events)
      .map(record)
      .filter((event): event is UnknownRecord => event !== null)
      .map((event) => [string(event.id), event]),
  );
  const selectionsByMarket = new Map<string, UnknownRecord[]>();
  for (const selection of array(root.selections).map(record)) {
    if (!selection) continue;
    const marketId = string(selection.marketId);
    if (!marketId) continue;
    const values = selectionsByMarket.get(marketId) ?? [];
    values.push(selection);
    selectionsByMarket.set(marketId, values);
  }

  for (const rawMarket of array(root.markets)) {
    const draftKingsMarket = record(rawMarket);
    if (!draftKingsMarket) continue;
    const marketId = string(draftKingsMarket.id);
    const eventId = string(draftKingsMarket.eventId);
    const event = events.get(eventId);
    if (!marketId || !event) continue;

    const selections = selectionsByMarket.get(marketId) ?? [];
    const over = selections.find(
      (selection) => string(selection.outcomeType).toLowerCase() === "over",
    );
    const under = selections.find(
      (selection) => string(selection.outcomeType).toLowerCase() === "under",
    );
    const line = over
      ? lineFromSelection(over)
      : under
        ? lineFromSelection(under)
        : null;
    const playerName = playerNameFromEvent(event);
    if (line === null || !playerName) continue;

    result.quotes.push(
      playerQuote(
        playerName,
        market,
        eventId,
        line,
        americanOdds(record(over?.displayOdds)?.american),
        americanOdds(record(under?.displayOdds)?.american),
        season,
        updatedAt,
      ),
    );
  }

  return result;
}
