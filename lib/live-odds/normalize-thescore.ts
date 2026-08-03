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

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^even$/i.test(value.trim())) return 100;
  const parsed = Number(value.replaceAll("−", "-").replace(/[^0-9+.-]/g, ""));
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

function playerName(name: string): string {
  return name
    .replace(
      /\s+Total\s+(?:Passing|Rushing|Receiving)\s+(?:Yards|TDs|Touchdowns)\s*$/i,
      "",
    )
    .trim();
}

function selectionOdds(selection: UnknownRecord | undefined): number | null {
  return number(record(selection?.odds)?.formattedOdds);
}

function selectionLine(selection: UnknownRecord | undefined): number | null {
  return number(record(selection?.points)?.decimalPoints);
}

function quote(
  name: string,
  market: LiveMarket,
  marketRecord: UnknownRecord,
  line: number,
  overOdds: number | null,
  underOdds: number | null,
  season: number,
  fetchedAt: string,
): SportsbookQuote {
  const known = PLAYERS.find(
    (player) => comparableName(player.name) === comparableName(name),
  );
  return {
    scope: "season",
    season,
    eventId: string(marketRecord.id) || undefined,
    player: {
      id: known?.id ?? slug(name),
      name: known?.name ?? name,
      position: known?.position ?? inferPosition([market]),
      team: known?.team,
    },
    market,
    book: { key: "thescore", name: "theScore Bet" },
    line,
    overOdds,
    underOdds,
    updatedAt: string(marketRecord.updatedAtTime) || fetchedAt,
    source: "thescore-direct",
  };
}

export function normalizeTheScoreSeasonPayload(
  payload: unknown,
  market: LiveMarket,
  season: number,
  fetchedAt: string,
): ProviderResult {
  const root = record(payload);
  const data = record(root?.data);
  const drawer = record(data?.competitionDrawer);
  const result: ProviderResult = {
    source: "thescore-direct",
    quotes: [],
    games: [],
    warnings: [],
  };
  if (!drawer) return result;

  for (const rawShelf of array(drawer.drawerChildren)) {
    const shelf = record(rawShelf);
    if (!shelf) continue;
    for (const rawCard of array(shelf.marketplaceShelfChildren)) {
      const card = record(rawCard);
      if (!card) continue;
      for (const rawMarket of array(card.markets)) {
        const marketRecord = record(rawMarket);
        if (!marketRecord) continue;
        const name = playerName(string(marketRecord.name));
        if (!name) continue;
        const selections = array(marketRecord.selections)
          .map(record)
          .filter((selection): selection is UnknownRecord => selection !== null);
        const over = selections.find(
          (selection) => string(selection.type).toUpperCase() === "OVER",
        );
        const under = selections.find(
          (selection) => string(selection.type).toUpperCase() === "UNDER",
        );
        const line = selectionLine(over) ?? selectionLine(under);
        if (line === null) continue;
        result.quotes.push(
          quote(
            name,
            market,
            marketRecord,
            Math.abs(line),
            selectionOdds(over),
            selectionOdds(under),
            season,
            fetchedAt,
          ),
        );
      }
    }
  }

  return result;
}
