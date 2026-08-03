import "server-only";

import { randomUUID } from "node:crypto";
import { WEEKLY_MARKET_KEYS } from "./markets";
import { normalizeBetMgmSeasonPayload } from "./normalize-betmgm";
import {
  normalizeBetRiversSeasonPayload,
  normalizeKambiSeasonPayload,
} from "./normalize-betrivers";
import { normalizeDraftKingsSeasonPayload } from "./normalize-draftkings";
import { normalizeFanDuelSeasonPayload } from "./normalize-fanduel";
import { normalizeSportsbookPayload } from "./normalize";
import { normalizeOddsIoPayload } from "./normalize-odds-io";
import { normalizeTheScoreSeasonPayload } from "./normalize-thescore";
import type { LiveMarket, ProviderResult } from "./types";

const PROP_LINE_BASE = "https://api.prop-line.com/v1";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_IO_BASE = "https://api.odds-api.io/v3";
const PROP_LINE_NFL = "football_nfl";
const DEFAULT_ODDS_IO_BOOKS = [
  "Bally Bet",
  "BetMGM",
  "BetRivers",
  "Caesars",
  "DraftKings",
  "Fanatics",
  "FanDuel",
];
const DRAFTKINGS_BASE =
  "https://sportsbook-nash.draftkings.com/api/sportscontent";
const DRAFTKINGS_NFL_LEAGUE = "88808";
const DRAFTKINGS_PLAYER_FUTURES = "Player Futures";
const DRAFTKINGS_SEASON_MARKETS: ReadonlyMap<string, LiveMarket> = new Map([
  ["Passing Yards", "passing_yards"],
  ["Passing TDs", "passing_tds"],
  ["Rushing Yards", "rushing_yards"],
  ["Rushing TDs", "rushing_tds"],
  ["Receiving Yards", "receiving_yards"],
  ["Receiving TDs", "receiving_tds"],
  ["Receptions", "receptions"],
] as const);
const BETRIVERS_NFL_FUTURES =
  "https://eu.offering-api.kambicdn.com/offering/v2018/rsiusny/listView/american_football/nfl/all/all/competitions.json?lang=en_US&market=US-NY";
const FANDUEL_NFL_PAGE = "https://sportsbook.fanduel.com/navigation/nfl";
const FANDUEL_API =
  "https://api.sportsbook.fanduel.com/sbapi/content-managed-page";
const BETMGM_HOST = "https://www.ny.betmgm.com";
const BETMGM_NFL_PAGE =
  `${BETMGM_HOST}/en/sports/football-11/betting/usa-9/nfl-35`;
const BALLY_NY_CONFIG =
  "https://cdn02.prod.na00.aws.ballys.tech/assets/ballybet/configuration/US-NY.json";
const KAMBI_OFFERING_BASE =
  "https://eu.offering-api.kambicdn.com/offering/v2018";
const THESCORE_HOME = "https://sportsbook.thescore.bet/";
const THESCORE_NY_GRAPHQL =
  "https://sportsbook.us-ny.thescore.bet/graphql";
const THESCORE_NFL_URL =
  "/sport/football/organization/united-states/competition/nfl";
const THESCORE_MARKETS: ReadonlyMap<string, LiveMarket> = new Map([
  ["Regular Season Passing Yards", "passing_yards"],
  ["Regular Season Rushing Yards", "rushing_yards"],
  ["Regular Season Receiving Yards", "receiving_yards"],
  ["Regular Season Passing TDs", "passing_tds"],
  ["Regular Season Rushing TDs", "rushing_tds"],
  ["Regular Season Receiving TDs", "receiving_tds"],
] as const);

function currentNflSeason(): number {
  const now = new Date();
  return now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

async function responseJson(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    throw new Error(`${provider} returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

async function responseText(response: Response, provider: string): Promise<string> {
  if (!response.ok) {
    throw new Error(`${provider} returned ${response.status}`);
  }
  return response.text();
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function eventArray(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    if (Array.isArray(object.data)) {
      return object.data as Array<Record<string, unknown>>;
    }
    if (Array.isArray(object.events)) {
      return object.events as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function nearestSlate(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const now = Date.now() - 6 * 60 * 60 * 1000;
  const upcoming = events
    .filter((event) => {
      const kickoff = Date.parse(
        String(event.commence_time ?? event.startsAt ?? event.date ?? ""),
      );
      return Number.isFinite(kickoff) && kickoff >= now;
    })
    .sort((a, b) =>
      String(a.commence_time ?? a.startsAt ?? a.date).localeCompare(
        String(b.commence_time ?? b.startsAt ?? b.date),
      ),
    );
  if (upcoming.length === 0) return [];
  const first = Date.parse(
    String(upcoming[0].commence_time ?? upcoming[0].startsAt ?? upcoming[0].date),
  );
  const cutoff = first + 8 * 24 * 60 * 60 * 1000;
  return upcoming
    .filter((event) => {
      const kickoff = Date.parse(
        String(event.commence_time ?? event.startsAt ?? event.date),
      );
      return kickoff <= cutoff;
    })
    .slice(0, 18);
}

function combine(source: string, results: ProviderResult[]): ProviderResult {
  return {
    source,
    quotes: results.flatMap((result) => result.quotes),
    games: results.flatMap((result) => result.games),
    warnings: results.flatMap((result) => result.warnings),
  };
}

export async function getPropLineSeason(
  apiKey: string,
): Promise<ProviderResult> {
  const season = currentNflSeason();
  const response = await fetch(
    `${PROP_LINE_BASE}/sports/${PROP_LINE_NFL}/futures`,
    {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      next: { revalidate: 1800 },
    },
  );
  const payload = await responseJson(response, "PropLine");
  return normalizeSportsbookPayload(payload, {
    source: "propline",
    scope: "season",
    season,
  });
}

function draftKingsSite(): string {
  const configured = process.env.DRAFTKINGS_SITE?.trim().toLowerCase();
  return configured && /^dkus[a-z]{2}$/.test(configured)
    ? configured
    : "dkusny";
}

async function oddsIoBooks(apiKey: string): Promise<string> {
  const configured = (process.env.ODDS_IO_BOOKMAKERS ?? "")
    .split(",")
    .map((book) => book.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured.join(",");

  const params = new URLSearchParams({ apiKey });
  const response = await fetch(
    `${ODDS_IO_BASE}/bookmakers/selected?${params}`,
    { next: { revalidate: 43_200 } },
  );
  if (!response.ok) return DEFAULT_ODDS_IO_BOOKS.join(",");
  const payload = (await response.json()) as Record<string, unknown>;
  const selected = Array.isArray(payload.bookmakers)
    ? payload.bookmakers.filter(
        (book): book is string => typeof book === "string" && book.length > 0,
      )
    : [];
  return (selected.length > 0 ? selected : DEFAULT_ODDS_IO_BOOKS).join(",");
}

function draftKingsUrl(path: string): string {
  return `${DRAFTKINGS_BASE}/${draftKingsSite()}/v1/leagues/${DRAFTKINGS_NFL_LEAGUE}${path}`;
}

async function draftKingsJson(path: string): Promise<unknown> {
  const response = await fetch(draftKingsUrl(path), {
    headers: {
      Accept: "application/json",
      Origin: "https://sportsbook.draftkings.com",
      Referer: "https://sportsbook.draftkings.com/",
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate: 1800 },
  });
  return responseJson(response, "DraftKings");
}

export async function getDraftKingsSeason(): Promise<ProviderResult> {
  const season = currentNflSeason();
  const discovery = await draftKingsJson("");
  const discoveryRecord =
    discovery && typeof discovery === "object"
      ? (discovery as Record<string, unknown>)
      : {};
  const categories = eventArray(discoveryRecord.categories);
  const subcategories = eventArray(discoveryRecord.subcategories);
  const playerFutures = categories.find(
    (category) => String(category.name ?? "") === DRAFTKINGS_PLAYER_FUTURES,
  );
  const categoryId = String(playerFutures?.id ?? "");
  if (!categoryId) {
    throw new Error("DraftKings did not return its NFL Player Futures category.");
  }

  const targets = subcategories.flatMap((subcategory) => {
    if (String(subcategory.categoryId ?? "") !== categoryId) return [];
    const market = DRAFTKINGS_SEASON_MARKETS.get(
      String(subcategory.name ?? ""),
    );
    const id = String(subcategory.id ?? "");
    return market && id ? [{ id, name: String(subcategory.name), market }] : [];
  });
  if (targets.length === 0) {
    throw new Error("DraftKings did not return matching NFL season-player markets.");
  }

  const fetchedAt = new Date().toISOString();
  const settled = await Promise.allSettled(
    targets.map(async (target) => ({
      target,
      payload: await draftKingsJson(
        `/categories/${categoryId}/subcategories/${target.id}`,
      ),
    })),
  );
  const result: ProviderResult = {
    source: "draftkings-direct",
    quotes: [],
    games: [],
    warnings: [],
  };

  for (const item of settled) {
    if (item.status === "rejected") {
      result.warnings.push(
        item.reason instanceof Error
          ? item.reason.message
          : "A DraftKings season market could not be loaded.",
      );
      continue;
    }
    const normalized = normalizeDraftKingsSeasonPayload(
      item.value.payload,
      item.value.target.market,
      season,
      fetchedAt,
    );
    result.quotes.push(...normalized.quotes);
    result.warnings.push(...normalized.warnings);
  }

  return result;
}

export async function getBetRiversSeason(): Promise<ProviderResult> {
  const response = await fetch(BETRIVERS_NFL_FUTURES, {
    headers: {
      Accept: "application/json",
      Origin: "https://ny.betrivers.com",
      Referer: "https://ny.betrivers.com/",
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate: 1800 },
  });
  const payload = await responseJson(response, "BetRivers");
  return normalizeBetRiversSeasonPayload(payload, currentNflSeason());
}

function nestedRecord(
  value: unknown,
  ...keys: string[]
): Record<string, unknown> | null {
  let current = record(value);
  for (const key of keys) {
    current = record(current?.[key]);
    if (!current) return null;
  }
  return current;
}

export async function getBallySeason(): Promise<ProviderResult> {
  const configuration = await responseJson(
    await fetch(BALLY_NY_CONFIG, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    }),
    "Bally Bet configuration",
  );
  const kambi = nestedRecord(configuration, "sportsBook", "kambi");
  const clientScript = string(kambi?.sportsBookClientScript);
  const offering = clientScript.match(/\/client\/([a-z0-9]+)\//i)?.[1];
  if (!offering) {
    throw new Error("Bally Bet did not publish its Kambi offering identifier.");
  }
  const url =
    `${KAMBI_OFFERING_BASE}/${encodeURIComponent(offering)}` +
    "/listView/american_football/nfl/all/all/competitions.json" +
    "?lang=en_US&market=US-NY";
  const payload = await responseJson(
    await fetch(url, {
      headers: {
        Accept: "application/json",
        Origin: "https://play.ballybet.com",
        Referer: "https://play.ballybet.com/sports",
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 1800 },
    }),
    "Bally Bet",
  );
  return normalizeKambiSeasonPayload(
    payload,
    currentNflSeason(),
    "bally-direct",
    { key: "bally", name: "Bally Bet" },
  );
}

interface TheScoreClient {
  app: string;
  client: string;
  version: string;
  installId: string;
  anonymousToken: string;
}

const THESCORE_STARTUP_QUERY = `
  query Startup(
    $geoPacket: String
    $latLongParams: GeolocationParams
    $connectToken: String
  ) {
    startup(geoPacket: $geoPacket, latLongParams: $latLongParams) {
      anonymousToken(connectToken: $connectToken)
    }
  }
`;

const THESCORE_COMPETITION_QUERY = `
  query CompetitionPage($canonicalUrl: String!) {
    page(canonicalUrl: $canonicalUrl) {
      pageChildren {
        ... on Section {
          id
          label
          slug
          hasContent
        }
      }
    }
  }
`;

const THESCORE_SECTION_QUERY = `
  query CompetitionPageSectionOtherTabsNode($sectionId: ID!) {
    competitionSection(id: $sectionId) {
      slug
      sectionChildren {
        ... on Drawer {
          id
          groupId
          label
        }
      }
    }
  }
`;

const THESCORE_DRAWER_QUERY = `
  query CompetitionDrawerContent(
    $competitionDrawerInput: CompetitionDrawerInput!
  ) {
    competitionDrawer(input: $competitionDrawerInput) {
      id
      drawerChildren {
        ... on MarketplaceShelf {
          id
          marketplaceShelfChildren {
            ... on MultipleMarketCard {
              id
              markets(pageType: PAGE) {
                id
                name
                status
                updatedAtTime
                selections {
                  odds {
                    formattedOdds(oddsFormat: AMERICAN)
                  }
                  points {
                    decimalPoints
                  }
                  status
                  type
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function theScoreMetadata(): Promise<{
  app: string;
  client: string;
  version: string;
}> {
  const html = await responseText(
    await fetch(THESCORE_HOME, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    }),
    "theScore Bet",
  );
  const scriptPath = html.match(
    /<script[^>]+src="([^"]*\/pages\/index-[^"]+\.js)"/,
  )?.[1];
  if (!scriptPath) {
    throw new Error("theScore Bet did not publish its sportsbook application script.");
  }
  const script = await responseText(
    await fetch(new URL(scriptPath, THESCORE_HOME), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    }),
    "theScore Bet application",
  );
  const variant = script.match(/NEXT_PUBLIC_BUILD_VARIANT:"([^"]+)"/)?.[1];
  const version = script.match(
    /NEXT_PUBLIC_PACKAGE_JSON_VERSION:[^,}]+\|\|"([^"]+)"/,
  )?.[1];
  if (!variant || !version) {
    throw new Error("theScore Bet client metadata could not be discovered.");
  }
  return {
    app: variant === "hwc" || variant === "hwcca" ? "bssb" : variant,
    client: variant === "hwcca" ? "hwc" : variant,
    version,
  };
}

async function theScoreGraphql(
  metadata: Pick<TheScoreClient, "app" | "client" | "version" | "installId">,
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
  anonymousToken?: string,
): Promise<unknown> {
  const response = await fetch(THESCORE_NY_GRAPHQL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-install-id": metadata.installId,
      "x-platform": "web",
      "x-app-version": metadata.version,
      "x-app": metadata.app,
      "x-client": metadata.client,
      "x-device": "DESKTOP",
      ...(anonymousToken
        ? { "x-anonymous-authorization": `Bearer ${anonymousToken}` }
        : {}),
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ operationName, variables, query }),
    next: { revalidate: 1800 },
  });
  const payload = record(await responseJson(response, "theScore Bet"));
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  if (!payload?.data && errors.length > 0) {
    const first = record(errors[0]);
    throw new Error(string(first?.message) || "theScore Bet returned a GraphQL error.");
  }
  return payload;
}

async function theScoreClient(): Promise<TheScoreClient> {
  const metadata = await theScoreMetadata();
  const installId = randomUUID();
  const startup = record(
    await theScoreGraphql(
      { ...metadata, installId },
      "Startup",
      THESCORE_STARTUP_QUERY,
      { geoPacket: null, latLongParams: null, connectToken: null },
    ),
  );
  const anonymousToken = string(
    nestedRecord(startup, "data", "startup")?.anonymousToken,
  );
  if (!anonymousToken) {
    throw new Error("theScore Bet did not return an anonymous read credential.");
  }
  return { ...metadata, installId, anonymousToken };
}

export async function getTheScoreSeason(): Promise<ProviderResult> {
  const client = await theScoreClient();
  const competition = record(
    await theScoreGraphql(
      client,
      "CompetitionPage",
      THESCORE_COMPETITION_QUERY,
      { canonicalUrl: THESCORE_NFL_URL },
      client.anonymousToken,
    ),
  );
  const page = nestedRecord(competition, "data", "page");
  const playerTotals = eventArray(page?.pageChildren).find(
    (section) => String(section.slug ?? "") === "player_totals",
  );
  const sectionId = string(playerTotals?.id);
  if (!sectionId) {
    throw new Error("theScore Bet did not publish its NFL player-totals section.");
  }
  const sectionPayload = record(
    await theScoreGraphql(
      client,
      "CompetitionPageSectionOtherTabsNode",
      THESCORE_SECTION_QUERY,
      { sectionId },
      client.anonymousToken,
    ),
  );
  const section = nestedRecord(sectionPayload, "data", "competitionSection");
  const targets = eventArray(section?.sectionChildren).flatMap((drawer) => {
    const market = THESCORE_MARKETS.get(String(drawer.label ?? ""));
    const groupId = string(drawer.groupId);
    return market && groupId ? [{ groupId, market }] : [];
  });
  if (targets.length === 0) {
    throw new Error("theScore Bet did not return matching NFL season-player markets.");
  }

  const fetchedAt = new Date().toISOString();
  const settled = await Promise.allSettled(
    targets.map(async ({ groupId, market }) => ({
      market,
      payload: await theScoreGraphql(
        client,
        "CompetitionDrawerContent",
        THESCORE_DRAWER_QUERY,
        {
          competitionDrawerInput: {
            competitionSlug: "nfl",
            groupId,
            organizationSlug: "united-states",
            sectionSlug: "player_totals",
            sportSlug: "football",
          },
        },
        client.anonymousToken,
      ),
    })),
  );
  const result: ProviderResult = {
    source: "thescore-direct",
    quotes: [],
    games: [],
    warnings: [],
  };
  for (const item of settled) {
    if (item.status === "rejected") {
      result.warnings.push(
        item.reason instanceof Error
          ? item.reason.message
          : "A theScore Bet season market could not be loaded.",
      );
      continue;
    }
    const normalized = normalizeTheScoreSeasonPayload(
      item.value.payload,
      item.value.market,
      currentNflSeason(),
      fetchedAt,
    );
    result.quotes.push(...normalized.quotes);
  }
  return result;
}

function fanDuelReadKeyCandidates(script: string): string[] {
  const marker = script.indexOf('.FANDUEL="FANDUEL"');
  if (marker < 0) return [];
  const nearby = script.slice(marker, marker + 4_000);
  const candidates = [...nearby.matchAll(
    /(?:let|,)\s*[A-Za-z_$][\w$]*="([A-Za-z0-9_+/=.-]{10,80})"/g,
  )].map((match) => match[1]);
  return [...new Set(candidates)].slice(0, 8);
}

async function fanDuelSeasonPayload(): Promise<unknown> {
  const browserHeaders = {
    Accept: "text/html,application/xhtml+xml,application/javascript,*/*",
    Referer: "https://sportsbook.fanduel.com/",
    "User-Agent": "Mozilla/5.0",
  };
  const html = await responseText(
    await fetch(FANDUEL_NFL_PAGE, {
      headers: browserHeaders,
      next: { revalidate: 1800 },
    }),
    "FanDuel",
  );
  const mainScript = html.match(
    /<script[^>]+src="(\/static\/js\/main\.[^"]+\.js)"/,
  )?.[1];
  if (!mainScript) {
    throw new Error("FanDuel did not publish its sportsbook application script.");
  }
  const script = await responseText(
    await fetch(new URL(mainScript, FANDUEL_NFL_PAGE), {
      headers: browserHeaders,
      next: { revalidate: 1800 },
    }),
    "FanDuel application",
  );
  const candidates = fanDuelReadKeyCandidates(script);
  if (candidates.length === 0) {
    throw new Error("FanDuel's public read credential could not be discovered.");
  }

  for (const readKey of candidates) {
    const url = new URL(FANDUEL_API);
    const params = {
      page: "CUSTOM",
      customPageId: "nfl",
      pbHorizontal: "false",
      _ak: readKey,
      timezone: "America/New_York",
    };
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Sportsbook-Region": "NY",
        Origin: "https://sportsbook.fanduel.com",
        Referer: FANDUEL_NFL_PAGE,
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 1800 },
    });
    if (response.ok) return response.json();
  }

  throw new Error("FanDuel rejected its currently published read credential.");
}

export async function getFanDuelSeason(): Promise<ProviderResult> {
  const fetchedAt = new Date().toISOString();
  const payload = await fanDuelSeasonPayload();
  return normalizeFanDuelSeasonPayload(
    payload,
    currentNflSeason(),
    fetchedAt,
  );
}

function trustedBetMgmApi(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "itsfogo.com" || url.hostname.endsWith(".itsfogo.com"))
  ) {
    throw new Error("BetMGM returned an unexpected sportsbook API host.");
  }
  return url;
}

async function betMgmSeasonPayload(): Promise<unknown> {
  const configUrl = new URL(`${BETMGM_HOST}/en/api/clientconfig`);
  configUrl.searchParams.set("browserUrl", BETMGM_NFL_PAGE);
  configUrl.searchParams.set("x-from-product", "host-app");
  const config = record(
    await responseJson(
      await fetch(configUrl, {
        headers: {
          Accept: "application/json",
          "x-bwin-browser-url": BETMGM_NFL_PAGE,
          "x-from-product": "host-app",
          "x-bwin-sports-api": "prod",
          "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 1800 },
      }),
      "BetMGM configuration",
    ),
  );
  const connection = record(config?.msConnection) ?? record(config?.msApp);
  const accessId = string(connection?.publicAccessId);
  const apiBase = string(connection?.cdsApiUrl);
  if (!accessId || !apiBase) {
    throw new Error("BetMGM did not publish its sportsbook read configuration.");
  }

  const url = new URL("bettingoffer/fixtures", trustedBetMgmApi(apiBase));
  const params = {
    "x-bwin-accessid": accessId,
    lang: string(connection?.culture) || "en",
    country: "US",
    userCountry: "US",
    subdivision: "US-New York",
    state: "Latest",
    fixtureTypes: "Standard",
    sportIds: "11",
    regionIds: "9",
    competitionIds: "35",
    dynamicOfferCategories: "playerfutures",
    offerMapping: "All",
    scoreboardMode: "Full",
    sortBy: "StartDate",
  };
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return responseJson(
    await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    }),
    "BetMGM",
  );
}

export async function getBetMgmSeason(): Promise<ProviderResult> {
  const fetchedAt = new Date().toISOString();
  const payload = await betMgmSeasonPayload();
  return normalizeBetMgmSeasonPayload(
    payload,
    currentNflSeason(),
    fetchedAt,
  );
}

export async function getPropLineWeekly(
  apiKey: string,
): Promise<ProviderResult> {
  const season = currentNflSeason();
  const eventsResponse = await fetch(
    `${PROP_LINE_BASE}/sports/${PROP_LINE_NFL}/events`,
    {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      next: { revalidate: 300 },
    },
  );
  const eventsPayload = await responseJson(eventsResponse, "PropLine");
  const events = nearestSlate(eventArray(eventsPayload));
  const markets = [...WEEKLY_MARKET_KEYS, "h2h", "spreads", "totals"].join(",");

  const results = await Promise.all(
    events.map(async (event) => {
      const eventId = String(event.id ?? event.event_id ?? event.eventID ?? "");
      const response = await fetch(
        `${PROP_LINE_BASE}/sports/${PROP_LINE_NFL}/events/${encodeURIComponent(eventId)}/odds?markets=${markets}`,
        {
          headers: { "X-API-Key": apiKey, Accept: "application/json" },
          next: { revalidate: 300 },
        },
      );
      const payload = await responseJson(response, "PropLine");
      return normalizeSportsbookPayload(payload, {
        source: "propline",
        scope: "game",
        season,
      });
    }),
  );

  return combine("propline", results);
}

export async function getOddsApiWeekly(
  apiKey: string,
): Promise<ProviderResult> {
  const season = currentNflSeason();
  const response = await fetch(
    `${ODDS_API_BASE}/sports/americanfootball_nfl/odds?apiKey=${encodeURIComponent(apiKey)}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`,
    { next: { revalidate: 43_200 } },
  );
  const payload = await responseJson(response, "The Odds API");
  return normalizeSportsbookPayload(nearestSlate(eventArray(payload)), {
    source: "the-odds-api",
    scope: "game",
    season,
  });
}

function nflEvent(event: Record<string, unknown>): boolean {
  const league = event.league;
  if (!league || typeof league !== "object") return false;
  return String((league as Record<string, unknown>).slug ?? "").startsWith(
    "usa-nfl",
  );
}

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, index * size + size),
  );
}

export async function getOddsIoWeekly(
  apiKey: string,
): Promise<ProviderResult> {
  const season = currentNflSeason();
  const bookmakers = await oddsIoBooks(apiKey);
  const eventParams = new URLSearchParams({
    apiKey,
    sport: "american-football",
    status: "pending,live",
    limit: "500",
  });
  const eventsResponse = await fetch(`${ODDS_IO_BASE}/events?${eventParams}`, {
    next: { revalidate: 600 },
  });
  const eventsPayload = await responseJson(eventsResponse, "Odds-API.io");
  const events = nearestSlate(eventArray(eventsPayload).filter(nflEvent));
  const eventIds = events.map((event) => String(event.id ?? "")).filter(Boolean);
  if (eventIds.length === 0) {
    return {
      source: "odds-api-io",
      quotes: [],
      games: [],
      warnings: ["No upcoming NFL events are available from Odds-API.io."],
    };
  }

  const results = await Promise.all(
    chunks(eventIds, 10).map(async (ids) => {
      const oddsParams = new URLSearchParams({
        apiKey,
        eventIds: ids.join(","),
        bookmakers,
      });
      const response = await fetch(`${ODDS_IO_BASE}/odds/multi?${oddsParams}`, {
        next: { revalidate: 600 },
      });
      const payload = await responseJson(response, "Odds-API.io");
      return normalizeOddsIoPayload(payload, season);
    }),
  );

  return combine("odds-api-io", results);
}

export async function getConfiguredSeasonFeeds(
  urls: string[],
  bearerToken?: string,
): Promise<ProviderResult[]> {
  const season = currentNflSeason();
  return Promise.all(
    urls.map(async (url, index) => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        next: { revalidate: 1800 },
      });
      const label = `season-feed-${index + 1}`;
      const payload = await responseJson(response, label);
      return normalizeSportsbookPayload(payload, {
        source: label,
        scope: "season",
        season,
      });
    }),
  );
}

export { currentNflSeason };
