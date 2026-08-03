import { aggregateGames, aggregatePlayers } from "./aggregate";
import type { DashboardResponse, PlayerProjection } from "./types";

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function projectionKey(player: PlayerProjection): string {
  return normalizeName(player.player.name);
}

export function filterDashboardByBooks(
  data: DashboardResponse,
  enabledBookKeys: readonly string[],
): DashboardResponse {
  const enabled = new Set(enabledBookKeys);
  const originalPlayers = new Map(
    data.players.map((player) => [projectionKey(player), player]),
  );
  const quotes = data.players.flatMap((player) =>
    player.components.flatMap((component) =>
      component.quotes.filter((quote) => enabled.has(quote.book.key)),
    ),
  );
  const players = aggregatePlayers(quotes).map((player) => {
    const original = originalPlayers.get(projectionKey(player));
    if (!original) return player;

    return {
      ...player,
      player: { ...player.player, ...original.player },
      adp: original.adp,
      adpByPlatform: original.adpByPlatform,
    };
  });
  const gameLines = data.games.flatMap((game) =>
    game.lines.filter((line) => enabled.has(line.book.key)),
  );

  return {
    ...data,
    players,
    games: aggregateGames(gameLines),
    books: data.books.filter((book) => enabled.has(book.key)),
  };
}
