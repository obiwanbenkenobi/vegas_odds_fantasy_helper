import type {
  AdpContext,
  AdpEntry,
  BoardMode,
  LivePosition,
  LiveScoringSystem,
  PlayerProjection,
} from "./types";

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const ADP_BASE_URL = "https://fantasyfootballcalculator.com/api/v1/adp";
const ADP_SOURCE_URL = "https://fantasyfootballcalculator.com/adp/ppr";
const SLEEPER_CACHE_MS = 86_400_000;
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
  active: boolean;
}

export interface PlayerMetadataBundle {
  profiles: Map<string, PlayerProfile>;
  adpContext?: AdpContext;
}

let sleeperProfileCache:
  | { expiresAt: number; profiles: Map<string, PlayerProfile> }
  | undefined;

function cloneProfiles(
  profiles: Map<string, PlayerProfile>,
): Map<string, PlayerProfile> {
  return new Map(
    [...profiles].map(([key, profile]) => [
      key,
      { ...profile, adp: { ...profile.adp } },
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
  };
}

export async function getPlayerMetadata(
  mode: BoardMode,
  season: number,
): Promise<PlayerMetadataBundle> {
  const profiles = await getSleeperProfiles();
  const adpContext = mode === "draft" ? await addAdp(profiles, season) : undefined;
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
    };
  });
}
