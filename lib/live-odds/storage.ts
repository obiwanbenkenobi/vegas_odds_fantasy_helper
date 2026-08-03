import type {
  BoardMode,
  DashboardResponse,
  GameBookLine,
  LiveMarket,
  LivePosition,
  ProviderResult,
  SportsbookQuote,
} from "./types";

type StoredEntityType = "player" | "game";

interface StoredLine {
  line_key: string;
  mode: BoardMode;
  season: number;
  scope: "season" | "game";
  event_key: string;
  event_id: string | null;
  entity_type: StoredEntityType;
  entity_id: string;
  entity_name: string;
  position: string | null;
  team: string | null;
  opponent: string | null;
  market: string;
  book_key: string;
  book_name: string;
  line: number;
  opening_line: number;
  over_odds: number | null;
  under_odds: number | null;
  source: string;
  source_updated_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_moved_at: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
}

interface StoredEvent {
  event_fingerprint: string;
  captured_at: string;
  mode: BoardMode;
  season: number;
  line_key: string;
  entity_type: StoredEntityType;
  entity_id: string;
  entity_name: string;
  market: string;
  book_key: string;
  book_name: string;
  change_kind: "posted" | "moved" | "repriced" | "removed";
  previous_line: number | null;
  line: number | null;
  previous_over_odds: number | null;
  over_odds: number | null;
  previous_under_odds: number | null;
  under_odds: number | null;
  metadata: Record<string, unknown>;
}

export interface CaptureSummary {
  mode: BoardMode;
  capturedAt: string;
  fetchedLines: number;
  newLines: number;
  movedLines: number;
  repricedLines: number;
  removedLines: number;
  durationMs: number;
}

function storageConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function historyStorageConfigured(): boolean {
  return storageConfig() !== null;
}

const STORED_PLAYER_MARKETS = new Set<LiveMarket>([
  "passing_yards",
  "passing_tds",
  "interceptions",
  "rushing_yards",
  "rushing_tds",
  "receiving_yards",
  "receptions",
  "receiving_tds",
  "rushing_receiving_yards",
]);
const STORED_PLAYER_POSITIONS = new Set<LivePosition>([
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
]);

export interface StoredBookSnapshot {
  result: ProviderResult;
  capturedAt: string;
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value ? value : undefined;
}

export async function readStoredBookSnapshot(
  mode: BoardMode,
  season: number,
  bookKey: string,
): Promise<StoredBookSnapshot | null> {
  const rows = await supabaseRequest<StoredLine[]>(
    `odds_line_current?mode=eq.${mode}&season=eq.${season}&entity_type=eq.player&book_key=eq.${encodeURIComponent(bookKey)}&active=eq.true&select=*&order=last_seen_at.desc&limit=5000`,
  );
  const quotes = rows.flatMap((row): SportsbookQuote[] => {
    const market = row.market as LiveMarket;
    const position = row.position as LivePosition;
    const line = Number(row.line);
    if (
      !STORED_PLAYER_MARKETS.has(market) ||
      !STORED_PLAYER_POSITIONS.has(position) ||
      !Number.isFinite(line)
    ) {
      return [];
    }

    return [
      {
        scope: row.scope === "season" ? "season" : "game",
        season: row.season,
        week: metadataString(row.metadata, "week"),
        eventId: row.event_id ?? undefined,
        kickoff: metadataString(row.metadata, "kickoff"),
        player: {
          id: row.entity_id,
          name: row.entity_name,
          position,
          team: row.team ?? undefined,
          opponent: row.opponent ?? undefined,
        },
        market,
        book: { key: row.book_key, name: row.book_name },
        line,
        overOdds: row.over_odds === null ? null : Number(row.over_odds),
        underOdds: row.under_odds === null ? null : Number(row.under_odds),
        updatedAt: row.source_updated_at ?? row.last_seen_at,
        source: row.source,
        stale: true,
      },
    ];
  });
  if (quotes.length === 0) return null;

  return {
    result: {
      source: `${bookKey}-stored-fallback`,
      quotes,
      games: [],
      warnings: [],
    },
    capturedAt: rows[0].last_seen_at,
  };
}

async function supabaseRequest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<T> {
  const config = storageConfig();
  if (!config) throw new Error("Historical storage is not configured.");
  const response = await fetch(`${config.url}/rest/v1/${resource}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Historical storage returned ${response.status}: ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slateWeek(value: string | undefined): string {
  if (!value) return "unscheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function playerEventKey(quote: SportsbookQuote): string {
  return quote.scope === "season"
    ? `season:${quote.season}`
    : `week:${quote.week ?? slateWeek(quote.kickoff)}`;
}

function playerLine(
  mode: BoardMode,
  quote: SportsbookQuote,
  market: LiveMarket,
  playerId: string,
  capturedAt: string,
): StoredLine {
  const eventKey = playerEventKey(quote);
  const key = [mode, eventKey, "player", playerId, market, quote.book.key].join(
    "::",
  );
  return {
    line_key: key,
    mode,
    season: quote.season,
    scope: quote.scope,
    event_key: eventKey,
    event_id: quote.eventId ?? null,
    entity_type: "player",
    entity_id: playerId,
    entity_name: quote.player.name,
    position: quote.player.position,
    team: quote.player.team ?? null,
    opponent: quote.player.opponent ?? null,
    market,
    book_key: quote.book.key,
    book_name: quote.book.name,
    line: quote.line,
    opening_line: quote.line,
    over_odds: quote.overOdds,
    under_odds: quote.underOdds,
    source: quote.source,
    source_updated_at: quote.updatedAt,
    first_seen_at: capturedAt,
    last_seen_at: capturedAt,
    last_moved_at: null,
    active: true,
    metadata: { week: quote.week, kickoff: quote.kickoff },
  };
}

function gameMarketLines(
  mode: BoardMode,
  season: number,
  game: GameBookLine,
  capturedAt: string,
): StoredLine[] {
  const eventKey = `game:${normalize(game.awayTeam)}:${normalize(game.homeTeam)}:${slateWeek(game.kickoff)}`;
  const entityName = `${game.awayTeam} @ ${game.homeTeam}`;
  const values: Array<[string, number | null]> = [
    ["home_spread", game.homeSpread],
    ["away_spread", game.awaySpread],
    ["game_total", game.total],
    ["home_moneyline", game.homeMoneyline],
    ["away_moneyline", game.awayMoneyline],
  ];
  return values.flatMap(([market, line]) => {
    if (line === null) return [];
    const key = [mode, eventKey, "game", market, game.book.key].join("::");
    return [
      {
        line_key: key,
        mode,
        season,
        scope: "game" as const,
        event_key: eventKey,
        event_id: game.eventId,
        entity_type: "game" as const,
        entity_id: eventKey,
        entity_name: entityName,
        position: null,
        team: game.homeTeam,
        opponent: game.awayTeam,
        market,
        book_key: game.book.key,
        book_name: game.book.name,
        line,
        opening_line: line,
        over_odds: null,
        under_odds: null,
        source: game.source,
        source_updated_at: game.updatedAt,
        first_seen_at: capturedAt,
        last_seen_at: capturedAt,
        last_moved_at: null,
        active: true,
        metadata: { week: game.week, kickoff: game.kickoff },
      },
    ];
  });
}

function flattenDashboard(data: DashboardResponse, capturedAt: string): StoredLine[] {
  const players = data.players.flatMap((player) =>
    player.components.flatMap((component) =>
      component.quotes.flatMap((quote) =>
        quote.stale
          ? []
          : [
              playerLine(
                data.mode,
                quote,
                component.market,
                player.player.id,
                capturedAt,
              ),
            ],
      ),
    ),
  );
  const games = data.games.flatMap((game) =>
    game.lines.flatMap((line) =>
      gameMarketLines(data.mode, data.season, line, capturedAt),
    ),
  );
  return [...players, ...games];
}

function eventFingerprint(
  capturedAt: string,
  lineKey: string,
  kind: StoredEvent["change_kind"],
  line: number | null,
  overOdds: number | null,
  underOdds: number | null,
): string {
  return [capturedAt, lineKey, kind, line, overOdds, underOdds].join("::");
}

function makeEvent(
  capturedAt: string,
  next: StoredLine,
  previous: StoredLine | null,
  kind: StoredEvent["change_kind"],
): StoredEvent {
  return {
    event_fingerprint: eventFingerprint(
      capturedAt,
      next.line_key,
      kind,
      kind === "removed" ? null : next.line,
      kind === "removed" ? null : next.over_odds,
      kind === "removed" ? null : next.under_odds,
    ),
    captured_at: capturedAt,
    mode: next.mode,
    season: next.season,
    line_key: next.line_key,
    entity_type: next.entity_type,
    entity_id: next.entity_id,
    entity_name: next.entity_name,
    market: next.market,
    book_key: next.book_key,
    book_name: next.book_name,
    change_kind: kind,
    previous_line: previous?.line ?? null,
    line: kind === "removed" ? null : next.line,
    previous_over_odds: previous?.over_odds ?? null,
    over_odds: kind === "removed" ? null : next.over_odds,
    previous_under_odds: previous?.under_odds ?? null,
    under_odds: kind === "removed" ? null : next.under_odds,
    metadata: next.metadata,
  };
}

async function writeBatches(
  table: string,
  values: Array<Record<string, unknown>>,
  prefer: string,
): Promise<void> {
  for (let index = 0; index < values.length; index += 250) {
    await supabaseRequest(`${table}${table === "odds_line_current" ? "?on_conflict=line_key" : "?on_conflict=event_fingerprint"}`, {
      method: "POST",
      headers: { Prefer: prefer },
      body: JSON.stringify(values.slice(index, index + 250)),
    });
  }
}

export async function captureDashboardHistory(
  data: DashboardResponse,
): Promise<CaptureSummary> {
  const started = Date.now();
  const capturedAt = data.generatedAt || new Date().toISOString();
  const incoming = flattenDashboard(data, capturedAt);
  const existing = await supabaseRequest<StoredLine[]>(
    `odds_line_current?mode=eq.${data.mode}&select=*`,
  );
  const existingByKey = new Map(existing.map((line) => [line.line_key, line]));
  const incomingKeys = new Set(incoming.map((line) => line.line_key));
  const current: StoredLine[] = [];
  const events: StoredEvent[] = [];
  let newLines = 0;
  let movedLines = 0;
  let repricedLines = 0;
  let removedLines = 0;

  for (const line of incoming) {
    const previous = existingByKey.get(line.line_key) ?? null;
    const lineMoved = previous !== null && previous.line !== line.line;
    const oddsMoved =
      previous !== null &&
      (previous.over_odds !== line.over_odds ||
        previous.under_odds !== line.under_odds);
    const next: StoredLine = previous
      ? {
          ...line,
          opening_line: previous.opening_line,
          first_seen_at: previous.first_seen_at,
          last_moved_at:
            lineMoved || oddsMoved ? capturedAt : previous.last_moved_at,
        }
      : line;
    current.push(next);
    if (!previous || !previous.active) {
      newLines += 1;
      events.push(makeEvent(capturedAt, next, previous, "posted"));
    } else if (lineMoved) {
      movedLines += 1;
      events.push(makeEvent(capturedAt, next, previous, "moved"));
    } else if (oddsMoved) {
      repricedLines += 1;
      events.push(makeEvent(capturedAt, next, previous, "repriced"));
    }
  }

  if (data.status === "live") {
    for (const previous of existing) {
      if (!previous.active || incomingKeys.has(previous.line_key)) continue;
      const removed = { ...previous, active: false };
      current.push(removed);
      removedLines += 1;
      events.push(makeEvent(capturedAt, removed, previous, "removed"));
    }
  }

  await writeBatches(
    "odds_line_current",
    current as unknown as Array<Record<string, unknown>>,
    "resolution=merge-duplicates,return=minimal",
  );
  if (events.length > 0) {
    await writeBatches(
      "odds_line_events",
      events as unknown as Array<Record<string, unknown>>,
      "resolution=ignore-duplicates,return=minimal",
    );
  }

  const summary: CaptureSummary = {
    mode: data.mode,
    capturedAt,
    fetchedLines: incoming.length,
    newLines,
    movedLines,
    repricedLines,
    removedLines,
    durationMs: Date.now() - started,
  };
  await supabaseRequest("odds_capture_runs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      captured_at: capturedAt,
      mode: data.mode,
      status: data.status,
      fetched_lines: summary.fetchedLines,
      new_lines: newLines,
      moved_lines: movedLines,
      repriced_lines: repricedLines,
      removed_lines: removedLines,
      duration_ms: summary.durationMs,
      source_status: data.sources,
      error: data.message ?? null,
    }),
  });
  return summary;
}

type HistoryCurrentRow = StoredLine;
type HistoryEventRow = StoredEvent & { id: number };

export async function readDashboardHistory(
  mode: BoardMode,
  playerId?: string,
): Promise<{
  startedAt: string | null;
  capturedAt: string | null;
  lines: HistoryCurrentRow[];
  events: HistoryEventRow[];
}> {
  const playerFilter = playerId
    ? `&entity_id=eq.${encodeURIComponent(playerId)}`
    : "";
  const [lines, events, runs] = await Promise.all([
    supabaseRequest<HistoryCurrentRow[]>(
      `odds_line_current?mode=eq.${mode}&entity_type=eq.player${playerFilter}&select=*&order=last_seen_at.desc&limit=5000`,
    ),
    supabaseRequest<HistoryEventRow[]>(
      `odds_line_events?mode=eq.${mode}&entity_type=eq.player${playerFilter}&select=*&order=captured_at.desc&limit=${playerId ? 1000 : 250}`,
    ),
    supabaseRequest<Array<{ captured_at: string }>>(
      `odds_capture_runs?mode=eq.${mode}&select=captured_at&order=captured_at.desc&limit=1`,
    ),
  ]);
  const firstSeen = lines
    .map((line) => line.first_seen_at)
    .sort()
    .at(0) ?? null;
  return {
    startedAt: firstSeen,
    capturedAt: runs[0]?.captured_at ?? null,
    lines,
    events,
  };
}
