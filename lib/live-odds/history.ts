import type {
  BoardMode,
  DashboardResponse,
  LiveMarket,
  LivePosition,
} from "./types";

export interface TrackedLine {
  key: string;
  playerId: string;
  playerName: string;
  position: LivePosition;
  team?: string;
  market: LiveMarket;
  bookKey: string;
  bookName: string;
  opening: number;
  current: number;
  active: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastMovedAt?: string;
}

export interface LineHistoryEvent {
  id: string;
  kind: "moved" | "posted" | "removed";
  timestamp: string;
  lineKey: string;
  playerId: string;
  playerName: string;
  market: LiveMarket;
  bookKey: string;
  bookName: string;
  from: number | null;
  to: number | null;
}

export interface LineHistoryState {
  version: 1;
  mode: BoardMode;
  startedAt: string;
  capturedAt: string;
  lines: Record<string, TrackedLine>;
  events: LineHistoryEvent[];
}

function lineKey(playerId: string, market: LiveMarket, bookKey: string): string {
  return `${playerId}::${market}::${bookKey}`;
}

export function captureLineHistory(
  data: DashboardResponse,
  previous?: LineHistoryState | null,
): LineHistoryState {
  if (previous?.capturedAt === data.generatedAt) return previous;

  const firstCapture = !previous;
  const lines: Record<string, TrackedLine> = { ...(previous?.lines ?? {}) };
  const events: LineHistoryEvent[] = [...(previous?.events ?? [])];
  const seen = new Set<string>();

  for (const player of data.players) {
    for (const component of player.components) {
      for (const quote of component.quotes) {
        const key = lineKey(player.player.id, component.market, quote.book.key);
        seen.add(key);
        const existing = lines[key];
        if (!existing) {
          lines[key] = {
            key,
            playerId: player.player.id,
            playerName: player.player.name,
            position: player.player.position,
            team: player.player.team,
            market: component.market,
            bookKey: quote.book.key,
            bookName: quote.book.name,
            opening: quote.line,
            current: quote.line,
            active: true,
            firstSeenAt: data.generatedAt,
            lastSeenAt: data.generatedAt,
          };
          if (!firstCapture) {
            events.push({
              id: `${data.generatedAt}:${key}:posted`,
              kind: "posted",
              timestamp: data.generatedAt,
              lineKey: key,
              playerId: player.player.id,
              playerName: player.player.name,
              market: component.market,
              bookKey: quote.book.key,
              bookName: quote.book.name,
              from: null,
              to: quote.line,
            });
          }
          continue;
        }

        if (existing.current !== quote.line || !existing.active) {
          events.push({
            id: `${data.generatedAt}:${key}:${quote.line}`,
            kind: existing.active ? "moved" : "posted",
            timestamp: data.generatedAt,
            lineKey: key,
            playerId: player.player.id,
            playerName: player.player.name,
            market: component.market,
            bookKey: quote.book.key,
            bookName: quote.book.name,
            from: existing.active ? existing.current : null,
            to: quote.line,
          });
        }
        lines[key] = {
          ...existing,
          playerName: player.player.name,
          position: player.player.position,
          team: player.player.team,
          bookName: quote.book.name,
          current: quote.line,
          active: true,
          lastSeenAt: data.generatedAt,
          lastMovedAt:
            existing.current !== quote.line
              ? data.generatedAt
              : existing.lastMovedAt,
        };
      }
    }
  }

  if (!firstCapture && data.status === "live") {
    for (const [key, existing] of Object.entries(lines)) {
      if (!existing.active || seen.has(key)) continue;
      lines[key] = { ...existing, active: false };
      events.push({
        id: `${data.generatedAt}:${key}:removed`,
        kind: "removed",
        timestamp: data.generatedAt,
        lineKey: key,
        playerId: existing.playerId,
        playerName: existing.playerName,
        market: existing.market,
        bookKey: existing.bookKey,
        bookName: existing.bookName,
        from: existing.current,
        to: null,
      });
    }
  }

  return {
    version: 1,
    mode: data.mode,
    startedAt: previous?.startedAt ?? data.generatedAt,
    capturedAt: data.generatedAt,
    lines,
    events: events.slice(-750),
  };
}
