import { aggregateGames, aggregatePlayers, collectBooks } from "./aggregate";
import {
  currentNflSeason,
  getBallySeason,
  getBetMgmSeason,
  getBetRiversSeason,
  getConfiguredSeasonFeeds,
  getDraftKingsSeason,
  getFanDuelSeason,
  getOddsApiWeekly,
  getOddsIoWeekly,
  getPropLineWeekly,
  getTheScoreSeason,
} from "./providers";
import {
  enrichPlayerProjections,
  getPlayerMetadata,
} from "./player-metadata";
import type {
  BoardMode,
  DashboardResponse,
  ProviderResult,
  SourceStatus,
} from "./types";

function configuredSeasonUrls(): string[] {
  return (process.env.LIVE_SEASON_FEED_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown provider error";
  return message.replace(/([?&]apiKey=)[^&\s]+/gi, "$1[redacted]");
}

export async function getLiveDashboard(mode: BoardMode): Promise<DashboardResponse> {
  const propLineKey = process.env.PROPLINE_API_KEY?.trim();
  const oddsApiKey = process.env.ODDS_API_KEY?.trim();
  const oddsIoKey = process.env.ODDS_IO_API_KEY?.trim();
  const seasonUrls = configuredSeasonUrls();
  const sources: SourceStatus[] = [];
  const jobs: Array<{ key: string; label: string; promise: Promise<ProviderResult> }> = [];

  if (mode === "weekly") {
    if (propLineKey) {
      jobs.push({
        key: "propline",
        label: "PropLine",
        promise: getPropLineWeekly(propLineKey),
      });
    } else {
      sources.push({
        key: "propline",
        label: "PropLine",
        configured: false,
        state: "not_configured",
        detail: "Add PROPLINE_API_KEY to connect the free weekly feed.",
      });
    }

    if (oddsApiKey) {
      jobs.push({
        key: "the-odds-api",
        label: "The Odds API",
        promise: getOddsApiWeekly(oddsApiKey),
      });
    } else {
      sources.push({
        key: "the-odds-api",
        label: "The Odds API",
        configured: false,
        state: "not_configured",
        detail: "Optional fallback. Add ODDS_API_KEY for more book coverage.",
      });
    }

    if (oddsIoKey) {
      jobs.push({
        key: "odds-api-io",
        label: "Odds-API.io · selected sportsbook roster",
        promise: getOddsIoWeekly(oddsIoKey),
      });
    } else {
      sources.push({
        key: "odds-api-io",
        label: "Odds-API.io",
        configured: false,
        state: "not_configured",
        detail: "Add ODDS_IO_API_KEY for broader New York book comparisons.",
      });
    }
  } else {
    jobs.push({
      key: "thescore-direct",
      label: "theScore Bet · direct season feed",
      promise: getTheScoreSeason(),
    });
    jobs.push({
      key: "bally-direct",
      label: "Bally Bet · direct season feed",
      promise: getBallySeason(),
    });
    jobs.push({
      key: "fanduel-direct",
      label: "FanDuel · direct season feed",
      promise: getFanDuelSeason(),
    });
    jobs.push({
      key: "betmgm-direct",
      label: "BetMGM · direct season feed",
      promise: getBetMgmSeason(),
    });
    jobs.push({
      key: "draftkings-direct",
      label: "DraftKings · direct season feed",
      promise: getDraftKingsSeason(),
    });
    jobs.push({
      key: "betrivers-direct",
      label: "BetRivers · direct season feed",
      promise: getBetRiversSeason(),
    });

    if (seasonUrls.length > 0) {
      const feedPromises = await getConfiguredSeasonFeeds(
        seasonUrls,
        process.env.LIVE_SEASON_FEED_BEARER_TOKEN,
      ).catch((error) => {
        sources.push({
          key: "season-feeds",
          label: "Season feeds",
          configured: true,
          state: "error",
          detail: safeMessage(error),
        });
        return [];
      });
      feedPromises.forEach((result, index) => {
        jobs.push({
          key: `season-feed-${index + 1}`,
          label: `Season feed ${index + 1}`,
          promise: Promise.resolve(result),
        });
      });
    } else {
      sources.push({
        key: "season-feeds",
        label: "Licensed season feeds",
        configured: false,
        state: "not_configured",
        detail: "Optional additional book-level season feed endpoints.",
      });
    }
  }

  if (jobs.length === 0) {
    return {
      mode,
      status: "unconfigured",
      season: currentNflSeason(),
      generatedAt: new Date().toISOString(),
      refreshAfterSeconds: mode === "draft" ? 1800 : 300,
      players: [],
      games: [],
      books: [],
      sources,
      message: "Connect a live odds provider to populate the board.",
    };
  }

  const season = currentNflSeason();
  const [settled, metadata] = await Promise.all([
    Promise.allSettled(jobs.map((job) => job.promise)),
    getPlayerMetadata(mode, season).catch(() => null),
  ]);
  const results: ProviderResult[] = [];
  settled.forEach((item, index) => {
    const job = jobs[index];
    if (item.status === "fulfilled") {
      results.push(item.value);
      const count = item.value.quotes.length + item.value.games.length;
      const bookCount = new Set([
        ...item.value.quotes.map((quote) => quote.book.key),
        ...item.value.games.map((game) => game.book.key),
      ]).size;
      sources.push({
        key: job.key,
        label: job.label,
        configured: true,
        state: count > 0 ? "connected" : "empty",
        detail:
          count > 0
            ? `${item.value.quotes.length} player quotes · ${item.value.games.length} game lines · ${bookCount} ${bookCount === 1 ? "book" : "books"}`
            : "Connected, but the books have not posted matching markets yet.",
      });
    } else {
      sources.push({
        key: job.key,
        label: job.label,
        configured: true,
        state: "error",
        detail: safeMessage(item.reason),
      });
    }
  });

  const quotes = results.flatMap((result) => result.quotes);
  const rawGames = results.flatMap((result) => result.games);
  const aggregatedPlayers = aggregatePlayers(quotes);
  const players = metadata
    ? enrichPlayerProjections(aggregatedPlayers, metadata)
    : aggregatedPlayers;
  const games = aggregateGames(rawGames);
  const books = collectBooks(quotes, rawGames);
  const connected = sources.filter((source) => source.state === "connected").length;
  const errors = sources.filter((source) => source.state === "error").length;

  return {
    mode,
    status:
      players.length > 0
        ? errors > 0
          ? "partial"
          : "live"
        : connected > 0 || games.length > 0
          ? "partial"
          : "unavailable",
    season,
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds: mode === "draft" ? 1800 : 300,
    players,
    games,
    books,
    sources,
    adpContext: metadata?.adpContext,
    message:
      players.length === 0
        ? mode === "draft"
          ? "The connected books have not returned season-long player totals yet."
          : "The connected books have not posted player props for the next slate yet."
        : undefined,
  };
}
