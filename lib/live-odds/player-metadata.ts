import type {
  AdpContext,
  AdpEntry,
  AdpPlatform,
  AdpPlatformContext,
  BoardMode,
  LivePosition,
  LiveScoringSystem,
  PlayerProjection,
} from "./types";

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const ADP_BASE_URL = "https://fantasyfootballcalculator.com/api/v1/adp";
const ADP_SOURCE_URL = "https://fantasyfootballcalculator.com/adp/ppr";
const PLATFORM_ADP_URL = "https://www.draftsharks.com/adp/yahoo";
const SLEEPER_CACHE_MS = 86_400_000;
const PLATFORM_ADP_CACHE_MS = 21_600_000;
const OFFENSIVE_POSITIONS = new Set<LivePosition>(["QB", "RB", "WR", "TE"]);
const ADP_FORMATS: Record<LiveScoringSystem, string> = {
  ppr: "ppr",
  half_ppr: "half-ppr",
  standard: "standard",
};

type UnknownRecord = Record<string, unknown>;

interface PlayerProfile {
  name: string;
  team?: string;
  position?: LivePosition;
  headshotUrl?: string;
  sleeperId?: string;
  adp: Partial<Record<LiveScoringSystem, AdpEntry>>;
  adpByPlatform: Partial<
    Record<AdpPlatform, Partial<Record<LiveScoringSystem, AdpEntry>>>
  >;
  active: boolean;
}

export interface PlayerMetadataBundle {
  profiles: Map<string, PlayerProfile>;
  adpContext?: AdpContext;
}

let sleeperProfileCache:
  | { expiresAt: number; profiles: Map<string, PlayerProfile> }
  | undefined;

let platformAdpCache:
  | {
      expiresAt: number;
      entries: Array<{
        name: string;
        team?: string;
        position?: LivePosition;
        platform: AdpPlatform;
        scoring: LiveScoringSystem;
        overall: number;
        formatted?: string;
        updatedAt: string;
      }>;
      platforms: AdpPlatformContext[];
    }
  | undefined;

function cloneProfiles(
  profiles: Map<string, PlayerProfile>,
): Map<string, PlayerProfile> {
  return new Map(
    [...profiles].map(([key, profile]) => [
      key,
      {
        ...profile,
        adp: { ...profile.adp },
        adpByPlatform: Object.fromEntries(
          Object.entries(profile.adpByPlatform).map(([platform, adp]) => [
            platform,
            { ...adp },
          ]),
        ),
      },
    ]),
  );
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function playerNameKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function livePosition(value: unknown): LivePosition | undefined {
  const position = string(value).toUpperCase() as LivePosition;
  return OFFENSIVE_POSITIONS.has(position) ? position : undefined;
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}`);
  }
  return response.json();
}

async function getSleeperProfiles(): Promise<Map<string, PlayerProfile>> {
  if (sleeperProfileCache && sleeperProfileCache.expiresAt > Date.now()) {
    return cloneProfiles(sleeperProfileCache.profiles);
  }

  const response = await fetch(SLEEPER_PLAYERS_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = record(await responseJson(response, "Sleeper players"));
  const profiles = new Map<string, PlayerProfile>();
  if (!payload) return profiles;

  for (const [fallbackId, rawPlayer] of Object.entries(payload)) {
    const player = record(rawPlayer);
    if (!player) continue;
    const position = livePosition(player.position);
    if (!position) continue;
    const name =
      string(player.full_name) ||
      `${string(player.first_name)} ${string(player.last_name)}`.trim();
    if (!name) continue;
    const key = playerNameKey(name);
    const active = string(player.status).toLowerCase() === "active";
    const playerId = string(player.player_id) || fallbackId;
    const profile: PlayerProfile = {
      name,
      team: string(player.team) || undefined,
      position,
      sleeperId: playerId || undefined,
      headshotUrl: playerId
        ? `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(playerId)}.jpg`
        : undefined,
      adp: {},
      adpByPlatform: {},
      active,
    };
    const current = profiles.get(key);
    if (
      !current ||
      (!current.active && active) ||
      (current.active === active && !current.team && Boolean(profile.team))
    ) {
      profiles.set(key, profile);
    }
  }

  sleeperProfileCache = {
    expiresAt: Date.now() + SLEEPER_CACHE_MS,
    profiles,
  };
  return cloneProfiles(profiles);
}

interface AdpResult {
  scoring: LiveScoringSystem;
  payload: UnknownRecord;
}

async function getAdpResult(
  scoring: LiveScoringSystem,
  season: number,
): Promise<AdpResult> {
  const params = new URLSearchParams({ teams: "12", year: String(season) });
  const response = await fetch(
    `${ADP_BASE_URL}/${ADP_FORMATS[scoring]}?${params}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    },
  );
  const payload = record(await responseJson(response, `${scoring} ADP`));
  if (!payload) throw new Error(`${scoring} ADP returned an invalid response`);
  return { scoring, payload };
}

async function addAdp(
  profiles: Map<string, PlayerProfile>,
  season: number,
): Promise<AdpContext | undefined> {
  const settled = await Promise.allSettled(
    (Object.keys(ADP_FORMATS) as LiveScoringSystem[]).map((scoring) =>
      getAdpResult(scoring, season),
    ),
  );
  const totalDrafts: Partial<Record<LiveScoringSystem, number>> = {};
  let updatedAt = "";
  let connected = false;

  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    connected = true;
    const { scoring, payload } = item.value;
    const meta = record(payload.meta);
    totalDrafts[scoring] = number(meta?.total_drafts) ?? 0;
    const endDate = string(meta?.end_date);
    if (endDate > updatedAt) updatedAt = endDate;

    for (const rawPlayer of Array.isArray(payload.players) ? payload.players : []) {
      const player = record(rawPlayer);
      if (!player) continue;
      const name = string(player.name);
      const overall = number(player.adp);
      if (!name || overall === null) continue;
      const key = playerNameKey(name);
      const profile = profiles.get(key) ?? {
        name,
        team: string(player.team) || undefined,
        position: livePosition(player.position),
        adp: {},
        adpByPlatform: {},
        active: true,
      };
      profile.team = string(player.team) || profile.team;
      profile.position = livePosition(player.position) ?? profile.position;
      profile.adp[scoring] = {
        overall,
        formatted: string(player.adp_formatted) || undefined,
        timesDrafted: number(player.times_drafted) ?? undefined,
        high: number(player.high) ?? undefined,
        low: number(player.low) ?? undefined,
        deviation: number(player.stdev) ?? undefined,
      };
      profiles.set(key, profile);
    }
  }

  if (!connected) return undefined;
  return {
    source: "Fantasy Football Calculator",
    url: ADP_SOURCE_URL,
    teams: 12,
    updatedAt: updatedAt || new Date().toISOString().slice(0, 10),
    totalDrafts,
    defaultPlatform: "consensus",
    platforms: [],
  };
}

const PLATFORM_SOURCE_IDS: Partial<Record<number, AdpPlatform>> = {
  104: "consensus",
  107: "sleeper",
  109: "yahoo",
  110: "cbs",
  111: "espn",
};

const PLATFORM_FORMAT_IDS: Partial<Record<number, LiveScoringSystem>> = {
  10: "standard",
  11: "ppr",
  18: "half_ppr",
};

const PLATFORM_LABELS: Record<AdpPlatform, string> = {
  consensus: "DraftSharks consensus",
  sleeper: "Sleeper",
  yahoo: "Yahoo",
  espn: "ESPN",
  cbs: "CBS",
};

function embeddedAdpPayload(page: string): UnknownRecord {
  const prefix = "var vueAppData = ";
  const start = page.indexOf(prefix);
  if (start < 0) throw new Error("Platform ADP page did not include its data payload");
  const payloadStart = start + prefix.length;
  const remainder = page.slice(payloadStart);
  const endMatch = /;\s*var staticDestinationHash/.exec(remainder);
  if (!endMatch) throw new Error("Platform ADP payload was incomplete");
  const payload = record(JSON.parse(remainder.slice(0, endMatch.index)));
  if (!payload) throw new Error("Platform ADP payload was invalid");
  return payload;
}

function platformEntryCache() {
  if (platformAdpCache && platformAdpCache.expiresAt > Date.now()) {
    return platformAdpCache;
  }
  return null;
}

async function getPlatformAdpEntries(): Promise<NonNullable<typeof platformAdpCache>> {
  const cached = platformEntryCache();
  if (cached) return cached;

  const response = await fetch(PLATFORM_ADP_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Edgeboard personal fantasy research tool",
    },
    next: { revalidate: 21_600 },
  });
  if (!response.ok) {
    throw new Error(`Platform ADP board returned ${response.status}`);
  }

  const payload = embeddedAdpPayload(await response.text());
  const entries: NonNullable<typeof platformAdpCache>["entries"] = [];
  const playerCounts = new Map<
    AdpPlatform,
    Partial<Record<LiveScoringSystem, number>>
  >();
  const updatedByPlatform = new Map<AdpPlatform, string>();

  for (const rawProjection of Array.isArray(payload.projections)
    ? payload.projections
    : []) {
    const projection = record(rawProjection);
    if (!projection) continue;
    const name = `${string(projection.first_name)} ${string(projection.last_name)}`.trim();
    if (!name) continue;
    const team = string(record(projection.team)?.abbr) || undefined;
    const position = livePosition(projection.fantasy_position ?? projection.position);
    const adps = record(projection.adps);
    if (!adps) continue;

    for (const rawAdp of Object.values(adps)) {
      const adp = record(rawAdp);
      if (!adp || number(adp.league_size) !== 12) continue;
      const platform = PLATFORM_SOURCE_IDS[number(adp.source_id) ?? -1];
      const scoring = PLATFORM_FORMAT_IDS[number(adp.format_id) ?? -1];
      const overall = number(adp.overall_pick_number);
      if (!platform || !scoring || overall === null || overall >= 999) continue;
      const updatedAt = string(adp.create_time) || new Date().toISOString();
      entries.push({
        name,
        team,
        position,
        platform,
        scoring,
        overall,
        formatted: string(adp.roundAndPick) || undefined,
        updatedAt,
      });
      const counts = playerCounts.get(platform) ?? {};
      counts[scoring] = (counts[scoring] ?? 0) + 1;
      playerCounts.set(platform, counts);
      if ((updatedByPlatform.get(platform) ?? "") < updatedAt) {
        updatedByPlatform.set(platform, updatedAt);
      }
    }
  }

  const platforms = (["consensus", "sleeper", "yahoo", "espn", "cbs"] as const)
    .filter((platform) => playerCounts.has(platform))
    .map((platform) => ({
      key: platform,
      label: PLATFORM_LABELS[platform],
      source: "Draft Sharks platform ADP board",
      url: `https://www.draftsharks.com/adp/${platform === "consensus" ? "consensus" : platform}`,
      updatedAt: (updatedByPlatform.get(platform) ?? new Date().toISOString()).slice(0, 10),
      playerCounts: playerCounts.get(platform) ?? {},
    }));

  platformAdpCache = {
    expiresAt: Date.now() + PLATFORM_ADP_CACHE_MS,
    entries,
    platforms,
  };
  return platformAdpCache;
}

async function addPlatformAdp(
  profiles: Map<string, PlayerProfile>,
): Promise<AdpPlatformContext[]> {
  const { entries, platforms } = await getPlatformAdpEntries();
  for (const entry of entries) {
    const key = playerNameKey(entry.name);
    const profile = profiles.get(key) ?? {
      name: entry.name,
      team: entry.team,
      position: entry.position,
      adp: {},
      adpByPlatform: {},
      active: true,
    };
    profile.team = entry.team ?? profile.team;
    profile.position = entry.position ?? profile.position;
    profile.adpByPlatform[entry.platform] = {
      ...(profile.adpByPlatform[entry.platform] ?? {}),
      [entry.scoring]: {
        overall: entry.overall,
        formatted: entry.formatted,
      },
    };
    if (entry.platform === "consensus" && !profile.adp[entry.scoring]) {
      profile.adp[entry.scoring] = {
        overall: entry.overall,
        formatted: entry.formatted,
      };
    }
    profiles.set(key, profile);
  }
  return platforms;
}

function assignPositionRanks(profiles: Map<string, PlayerProfile>): void {
  const platforms: AdpPlatform[] = [
    "consensus",
    "sleeper",
    "yahoo",
    "espn",
    "cbs",
  ];

  for (const platform of platforms) {
    for (const scoring of Object.keys(ADP_FORMATS) as LiveScoringSystem[]) {
      const byPosition = new Map<LivePosition, AdpEntry[]>();

      for (const profile of profiles.values()) {
        if (!profile.position) continue;
        const entry =
          platform === "consensus"
            ? profile.adp[scoring] ??
              profile.adpByPlatform.consensus?.[scoring]
            : profile.adpByPlatform[platform]?.[scoring];
        if (!entry) continue;
        const values = byPosition.get(profile.position) ?? [];
        values.push(entry);
        byPosition.set(profile.position, values);
      }

      for (const entries of byPosition.values()) {
        entries
          .sort((left, right) => left.overall - right.overall)
          .forEach((entry, index) => {
            entry.positionRank = index + 1;
            entry.positionCount = entries.length;
          });
      }
    }
  }
}

export async function getPlayerMetadata(
  mode: BoardMode,
  season: number,
): Promise<PlayerMetadataBundle> {
  const profiles = await getSleeperProfiles();
  if (mode !== "draft") return { profiles };

  const consensusContext = await addAdp(profiles, season);
  const platformContexts = await addPlatformAdp(profiles).catch(() => []);
  assignPositionRanks(profiles);
  const consensusPlatform = consensusContext
    ? {
        key: "consensus" as const,
        label: "FFC consensus",
        source: consensusContext.source,
        url: consensusContext.url,
        updatedAt: consensusContext.updatedAt,
        playerCounts: Object.fromEntries(
          (Object.keys(ADP_FORMATS) as LiveScoringSystem[]).map((scoring) => [
            scoring,
            [...profiles.values()].filter((profile) => profile.adp[scoring]).length,
          ]),
        ),
      }
    : platformContexts.find((platform) => platform.key === "consensus");
  const nonConsensusPlatforms = platformContexts.filter(
    (platform) => platform.key !== "consensus",
  );
  const platforms = consensusPlatform
    ? [consensusPlatform, ...nonConsensusPlatforms]
    : nonConsensusPlatforms;
  const latestPlatformDate = platforms.reduce(
    (latest, platform) => (platform.updatedAt > latest ? platform.updatedAt : latest),
    "",
  );
  const adpContext: AdpContext | undefined =
    consensusContext || platforms.length > 0
      ? {
          source: consensusContext?.source ?? "Draft Sharks platform ADP board",
          url: consensusContext?.url ?? PLATFORM_ADP_URL,
          teams: 12,
          updatedAt:
            latestPlatformDate ||
            consensusContext?.updatedAt ||
            new Date().toISOString().slice(0, 10),
          totalDrafts: consensusContext?.totalDrafts ?? {},
          defaultPlatform: "consensus",
          platforms,
        }
      : undefined;
  return { profiles, adpContext };
}

export function enrichPlayerProjections(
  players: PlayerProjection[],
  metadata: PlayerMetadataBundle,
): PlayerProjection[] {
  return players.map((projection) => {
    const profile = metadata.profiles.get(playerNameKey(projection.player.name));
    if (!profile) return projection;
    return {
      ...projection,
      player: {
        ...projection.player,
        team: profile.team ?? projection.player.team,
        position: profile.position ?? projection.player.position,
        headshotUrl: profile.headshotUrl,
        sleeperId: profile.sleeperId,
      },
      adp: profile.adp,
      adpByPlatform: profile.adpByPlatform,
    };
  });
}
