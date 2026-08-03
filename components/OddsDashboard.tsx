"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { filterDashboardByBooks } from "@/lib/live-odds/filter-books";
import {
  captureLineHistory,
  type LineHistoryEvent,
  type LineHistoryState,
} from "@/lib/live-odds/history";
import { fantasyPointsForLine } from "@/lib/live-odds/scoring";
import type {
  AdpPlatform,
  BoardMode,
  ConsensusComponent,
  DashboardResponse,
  GameSummary,
  HistoricalSeasonStats,
  LiveMarket,
  LivePosition,
  LiveScoringSystem,
  PlayerHistoryResponse,
  PlayerProjection,
  SportsbookQuote,
} from "@/lib/live-odds/types";

const SCORING_OPTIONS: Array<{ value: LiveScoringSystem; label: string }> = [
  { value: "ppr", label: "PPR" },
  { value: "half_ppr", label: "Half PPR" },
  { value: "standard", label: "Standard" },
];

const ADP_PLATFORM_LABELS: Record<AdpPlatform, string> = {
  consensus: "Consensus",
  sleeper: "Sleeper",
  yahoo: "Yahoo",
  espn: "ESPN",
  cbs: "CBS",
};

type DraftWorkspace = "compare" | "value" | "assistant";

const DRAFT_WORKSPACES: Array<{
  value: DraftWorkspace;
  eyebrow: string;
  label: string;
  description: string;
}> = [
  {
    value: "compare",
    eyebrow: "Player decisions",
    label: "Compare players",
    description: "Head-to-head lines and cheaper lookalikes for your selections.",
  },
  {
    value: "value",
    eyebrow: "Whole market",
    label: "Vegas value board",
    description: "The largest gaps between sportsbook production and draft cost.",
  },
  {
    value: "assistant",
    eyebrow: "On the clock",
    label: "Draft room",
    description: "Best available targets for your pick and roster needs.",
  },
];

function scoringLabel(scoring: LiveScoringSystem): string {
  return (
    SCORING_OPTIONS.find((option) => option.value === scoring)?.label ?? scoring
  );
}

const POSITION_OPTIONS: Array<LivePosition | "ALL"> = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
];

const MARKET_ORDER: LiveMarket[] = [
  "passing_yards",
  "passing_tds",
  "interceptions",
  "rushing_yards",
  "rushing_tds",
  "receiving_yards",
  "receptions",
  "receiving_tds",
  "rushing_receiving_yards",
];

const MARKET_SHORT_LABELS: Record<LiveMarket, string> = {
  passing_yards: "pass yds",
  passing_tds: "pass TDs",
  interceptions: "INTs",
  rushing_yards: "rush yds",
  rushing_tds: "rush TDs",
  receiving_yards: "rec yds",
  receptions: "receptions",
  receiving_tds: "rec TDs",
  rushing_receiving_yards: "rush + rec yds",
};

const NFL_TEAM_ALIASES: Record<string, string[]> = {
  ARI: ["ari", "arizona", "cardinals"], ATL: ["atl", "atlanta", "falcons"],
  BAL: ["bal", "baltimore", "ravens"], BUF: ["buf", "buffalo", "bills"],
  CAR: ["car", "carolina", "panthers"], CHI: ["chi", "chicago", "bears"],
  CIN: ["cin", "cincinnati", "bengals"], CLE: ["cle", "cleveland", "browns"],
  DAL: ["dal", "dallas", "cowboys"], DEN: ["den", "denver", "broncos"],
  DET: ["det", "detroit", "lions"], GB: ["gb", "greenbay", "packers"],
  HOU: ["hou", "houston", "texans"], IND: ["ind", "indianapolis", "colts"],
  JAX: ["jax", "jac", "jacksonville", "jaguars"], KC: ["kc", "kansascity", "chiefs"],
  LV: ["lv", "lasvegas", "raiders"], LAC: ["lac", "chargers"],
  LAR: ["lar", "rams"], MIA: ["mia", "miami", "dolphins"],
  MIN: ["min", "minnesota", "vikings"], NE: ["ne", "newengland", "patriots"],
  NO: ["no", "neworleans", "saints"], NYG: ["nyg", "giants"],
  NYJ: ["nyj", "jets"], PHI: ["phi", "philadelphia", "eagles"],
  PIT: ["pit", "pittsburgh", "steelers"], SEA: ["sea", "seattle", "seahawks"],
  SF: ["sf", "sanfrancisco", "49ers", "niners"], TB: ["tb", "tampabay", "buccaneers", "bucs"],
  TEN: ["ten", "tennessee", "titans"], WAS: ["was", "wsh", "washington", "commanders"],
};

const NFL_TEAM_FULL_NAMES: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LV: "Las Vegas Raiders",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

function canonicalTeam(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [team, aliases] of Object.entries(NFL_TEAM_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return team;
    }
  }
  return null;
}

function playerMatchesSearch(
  player: PlayerProjection,
  query: string,
  includePosition = false,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const directFields = [player.player.name, player.player.team];
  if (includePosition) directFields.push(player.player.position);
  if (
    directFields.some((value) =>
      value?.toLowerCase().includes(normalizedQuery),
    )
  ) {
    return true;
  }

  const team = canonicalTeam(player.player.team);
  if (!team) return false;
  const teamSearchText = `${NFL_TEAM_FULL_NAMES[team]} ${NFL_TEAM_ALIASES[team].join(" ")}`;
  return teamSearchText.toLowerCase().includes(normalizedQuery);
}

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name:
    | "arrow"
    | "check"
    | "chevron"
    | "clock"
    | "compare"
    | "refresh"
    | "search"
    | "signal";
  className?: string;
}) {
  const paths = {
    arrow: <path d="m5 12 14-8-6 16-2.7-6.3L5 12Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    compare: (
      <>
        <path d="M8 3 4 7l4 4" />
        <path d="M4 7h11a4 4 0 0 1 4 4" />
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H9a4 4 0 0 1-4-4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18.5 9A7 7 0 0 0 6 6.5L4 11" />
        <path d="M5.5 15A7 7 0 0 0 18 17.5l2-4.5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    signal: (
      <>
        <path d="M5 20v-3" />
        <path d="M10 20v-7" />
        <path d="M15 20V9" />
        <path d="M20 20V4" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function formatNumber(value: number, decimals = 1): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatOdds(value: number | null): string {
  if (value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

function formatKickoff(value?: string): string {
  if (!value) return "Schedule pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule pending";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function timeAgo(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "just now";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function playerKey(player: PlayerProjection): string {
  return player.player.id;
}

function normalizeSelectionKey(value: string | null): string | null {
  if (!value) return null;
  return value.slice(value.lastIndexOf(":") + 1);
}

function fillComparison(
  players: PlayerProjection[],
  current: [string | null, string | null],
): [string | null, string | null] {
  const available = new Set(players.map(playerKey));
  const normalized = current.map(normalizeSelectionKey) as [
    string | null,
    string | null,
  ];
  return [
    normalized[0] && available.has(normalized[0]) ? normalized[0] : null,
    normalized[1] && available.has(normalized[1]) ? normalized[1] : null,
  ];
}

function marketShape(player: PlayerProjection): string {
  return player.components
    .map((component) => component.market)
    .sort()
    .join("|");
}

function productionGapPercent(
  left: PlayerProjection,
  right: PlayerProjection,
  scoring: LiveScoringSystem,
): number | null {
  const leftShape = marketShape(left);
  const rightShape = marketShape(right);
  if (
    left.player.position !== right.player.position ||
    !leftShape ||
    leftShape !== rightShape
  ) {
    return null;
  }
  const average = (left.points[scoring] + right.points[scoring]) / 2;
  return (
    (Math.abs(left.points[scoring] - right.points[scoring]) /
      Math.max(average, 1)) *
    100
  );
}

function postedLineSummary(player: PlayerProjection, limit = 3): string[] {
  const items = player.components
    .slice()
    .sort(
      (left, right) =>
        MARKET_ORDER.indexOf(left.market) - MARKET_ORDER.indexOf(right.market),
    )
    .map(
      (component) =>
        `${formatNumber(component.line)} ${MARKET_SHORT_LABELS[component.market]} · ${component.quotes.length} ${component.quotes.length === 1 ? "book" : "books"}`,
    );
  if (items.length <= limit) return items;
  return [...items.slice(0, limit), `+${items.length - limit} more`];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function PlayerHeadshot({
  player,
  size = "md",
}: {
  player: PlayerProjection["player"];
  size?: "sm" | "md" | "lg";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const dimensions = {
    sm: { pixels: 40, className: "h-10 w-10 text-[10px]" },
    md: { pixels: 56, className: "h-14 w-14 text-xs" },
    lg: { pixels: 76, className: "h-[76px] w-[76px] text-sm" },
  }[size];

  const failed = Boolean(
    player.headshotUrl && player.headshotUrl === failedUrl,
  );

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-[#d5d0c5] bg-[#e7e3da] ${dimensions.className}`}
    >
      {player.headshotUrl && !failed ? (
        <Image
          src={player.headshotUrl}
          alt=""
          width={dimensions.pixels}
          height={dimensions.pixels}
          className="h-full w-full object-cover object-top"
          onError={() => setFailedUrl(player.headshotUrl ?? null)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold text-[#536159]">
          {initials(player.name)}
        </span>
      )}
    </div>
  );
}

function adpFor(
  player: PlayerProjection | null | undefined,
  scoring: LiveScoringSystem,
  platform: AdpPlatform = "consensus",
): number | null {
  if (platform === "consensus") {
    return (
      player?.adp?.[scoring]?.overall ??
      player?.adpByPlatform?.consensus?.[scoring]?.overall ??
      null
    );
  }
  return player?.adpByPlatform?.[platform]?.[scoring]?.overall ?? null;
}

function adpPlatformLabel(platform: AdpPlatform): string {
  return ADP_PLATFORM_LABELS[platform];
}

function formatAdp(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(value < 10 ? 1 : 0);
}

function formatRoundPick(value: number): string {
  const rounded = Math.max(1, Math.round(value));
  const round = Math.floor((rounded - 1) / 12) + 1;
  const pick = ((rounded - 1) % 12) + 1;
  return `${round}.${String(pick).padStart(2, "0")}`;
}

function DraftWorkspaceNav({
  active,
  onChange,
}: {
  active: DraftWorkspace;
  onChange: (workspace: DraftWorkspace) => void;
}) {
  return (
    <nav aria-label="Draft tools" className="mt-7 grid gap-2 md:grid-cols-3">
      {DRAFT_WORKSPACES.map((workspace, index) => (
        <button
          key={workspace.value}
          type="button"
          aria-current={active === workspace.value ? "page" : undefined}
          onClick={() => onChange(workspace.value)}
          className={`group flex min-h-24 items-start gap-4 rounded-xl border px-4 py-4 text-left transition sm:px-5 ${
            active === workspace.value
              ? "border-[#214735] bg-[#214735] text-white shadow-[0_8px_24px_rgba(24,50,38,0.16)]"
              : "border-[#cec8bd] bg-[#fbfaf6] text-[#1d2a24] hover:border-[#7e8c84] hover:bg-white"
          }`}
        >
          <span
            className={`mt-0.5 font-mono text-xs ${active === workspace.value ? "text-[#c9ddcf]" : "text-[#9a4a33]"}`}
          >
            0{index + 1}
          </span>
          <span>
            <span
              className={`block text-[9px] font-bold uppercase tracking-[0.1em] ${active === workspace.value ? "text-[#b9cfc2]" : "text-[#7c8580]"}`}
            >
              {workspace.eyebrow}
            </span>
            <span className="mt-0.5 block text-base font-semibold">
              {workspace.label}
            </span>
            <span
              className={`mt-1 block text-[11px] leading-4 ${active === workspace.value ? "text-[#dbe7df]" : "text-[#6c7670]"}`}
            >
              {workspace.description}
            </span>
          </span>
        </button>
      ))}
    </nav>
  );
}

function AdpPlatformSelector({
  context,
  scoring,
  value,
  onChange,
}: {
  context: DashboardResponse["adpContext"];
  scoring: LiveScoringSystem;
  value: AdpPlatform;
  onChange: (platform: AdpPlatform) => void;
}) {
  const available =
    context?.platforms.filter((platform) => (platform.playerCounts[scoring] ?? 0) > 0) ?? [];
  if (available.length === 0) return null;

  return (
    <section className="mt-4 flex flex-col gap-3 rounded-xl border border-[#d0cbc0] bg-[#fbfaf6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8f4029]">
          Draft platform
        </div>
        <div className="mt-0.5 text-xs text-[#69736d]">
          Every ADP rank and recommendation below uses the selected draft room.
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="ADP platform">
        {available.map((platform) => (
          <button
            key={platform.key}
            type="button"
            aria-pressed={value === platform.key}
            onClick={() => onChange(platform.key)}
            className={`rounded-md border px-3 py-2 text-[10px] font-bold transition ${
              value === platform.key
                ? "border-[#315c46] bg-[#315c46] text-white"
                : "border-[#c9c3b8] bg-white text-[#5e6963] hover:border-[#75827b]"
            }`}
          >
            {platform.label}
            <span className={`ml-1.5 font-mono text-[9px] ${value === platform.key ? "text-[#cde0d4]" : "text-[#919995]"}`}>
              {platform.playerCounts[scoring]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function playerPointRange(
  player: PlayerProjection,
  scoring: LiveScoringSystem,
): { low: number; high: number } | null {
  return componentPointRange(player.components, scoring);
}

function pointsForComponents(
  components: ConsensusComponent[],
  scoring: LiveScoringSystem,
): number {
  return components.reduce(
    (total, component) => total + component.points[scoring],
    0,
  );
}

function componentPointRange(
  components: ConsensusComponent[],
  scoring: LiveScoringSystem,
): { low: number; high: number } | null {
  if (components.length === 0) return null;
  return components.reduce(
    (range, component) => {
      const values = component.quotes.map((quote) =>
        fantasyPointsForLine(component.market, quote.line, scoring),
      );
      if (values.length === 0) values.push(component.points[scoring]);
      return {
        low: range.low + Math.min(...values),
        high: range.high + Math.max(...values),
      };
    },
    { low: 0, high: 0 },
  );
}

function PostedLines({
  player,
  limit = 3,
  tone = "neutral",
}: {
  player: PlayerProjection;
  limit?: number;
  tone?: "neutral" | "light";
}) {
  const items = postedLineSummary(player, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-md border px-2 py-1 font-mono text-[10px] ${
            tone === "light"
              ? "border-[#c8d5cd] bg-white/70 text-[#2d4036]"
              : "border-[#ddd8ce] bg-[#f4f1ea] text-[#4e5a53]"
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

const playerHistoryCache = new Map<string, PlayerHistoryResponse>();
const playerHistoryRequests = new Map<
  string,
  Promise<PlayerHistoryResponse>
>();

function loadPlayerHistory(playerId: string): Promise<PlayerHistoryResponse> {
  const cached = playerHistoryCache.get(playerId);
  if (cached) return Promise.resolve(cached);
  const pending = playerHistoryRequests.get(playerId);
  if (pending) return pending;

  const request = fetch(
    `/api/player-history?playerId=${encodeURIComponent(playerId)}`,
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Player history returned ${response.status}`);
      }
      const payload = (await response.json()) as PlayerHistoryResponse;
      playerHistoryCache.set(playerId, payload);
      return payload;
    })
    .finally(() => playerHistoryRequests.delete(playerId));
  playerHistoryRequests.set(playerId, request);
  return request;
}

function historicalStatSummary(
  stats: HistoricalSeasonStats,
  position: LivePosition,
): string {
  if (position === "QB") {
    return [
      `${formatNumber(stats.passingYards, 0)} pass yds`,
      `${formatNumber(stats.passingTouchdowns, 0)} pass TD`,
      `${formatNumber(stats.interceptions, 0)} INT`,
      `${formatNumber(stats.rushingYards, 0)} rush yds`,
      `${formatNumber(stats.rushingTouchdowns, 0)} rush TD`,
    ].join(" · ");
  }

  const receiving = [
    `${formatNumber(stats.targets, 0)} tgts`,
    `${formatNumber(stats.receptions, 0)} rec`,
    `${formatNumber(stats.receivingYards, 0)} rec yds`,
    `${formatNumber(stats.receivingTouchdowns, 0)} rec TD`,
  ];
  const rushing = [
    `${formatNumber(stats.rushingAttempts, 0)} carries`,
    `${formatNumber(stats.rushingYards, 0)} rush yds`,
    `${formatNumber(stats.rushingTouchdowns, 0)} rush TD`,
  ];
  return (position === "RB" ? [...rushing, ...receiving] : [...receiving, ...rushing])
    .join(" · ");
}

function PlayerHistory({
  player,
  scoring,
}: {
  player: PlayerProjection["player"];
  scoring: LiveScoringSystem;
}) {
  const playerId = player.sleeperId;
  const initialHistory = playerId ? playerHistoryCache.get(playerId) ?? null : null;
  const [history, setHistory] = useState<PlayerHistoryResponse | null>(
    initialHistory,
  );
  const [loading, setLoading] = useState(Boolean(playerId && !initialHistory));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!playerId || history) return;
    let active = true;
    void loadPlayerHistory(playerId)
      .then((payload) => {
        if (active) setHistory(payload);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [history, playerId]);

  return (
    <div className="mt-5 border-t border-[#ded9cf] pt-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#56665d]">
            Regular-season history
          </div>
          <div className="mt-0.5 text-[10px] text-[#7a837e]">
            Actual totals · {scoringLabel(scoring)} scoring
          </div>
        </div>
        <div className="text-[9px] text-[#8a918d]">Sleeper</div>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2" aria-label="Loading historical stats">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-12 animate-pulse rounded-md bg-[#e7e3da]"
            />
          ))}
        </div>
      ) : failed ? (
        <div className="mt-3 rounded-md bg-[#eee9df] px-3 py-3 text-xs text-[#747d78]">
          Historical stats are temporarily unavailable.
        </div>
      ) : !playerId || !history || history.seasons.length === 0 ? (
        <div className="mt-3 rounded-md bg-[#eee9df] px-3 py-3 text-xs text-[#747d78]">
          No recent regular-season stats are available for this player.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-md border border-[#ddd8ce] bg-[#fbfaf6]">
          {history.seasons.map((season) => {
            return (
              <div
                key={season.season}
                className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 border-b border-[#e3dfd7] px-3 py-3 last:border-0"
              >
                <div>
                  <div className="font-mono text-xs font-semibold text-[#27352e]">
                    {season.season}
                  </div>
                  <div className="mt-0.5 text-[9px] text-[#858d88]">
                    {formatNumber(season.games, 0)} GP
                  </div>
                </div>
                <div className="text-[10px] leading-4 text-[#59655e]">
                  {historicalStatSummary(season, player.position)}
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold text-[#a9492e]">
                    {season.points[scoring].toFixed(1)}
                  </div>
                  <div className="mt-0.5 text-[9px] text-[#858d88]">
                    {scoringLabel(scoring)} pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SourceStatus({
  data,
  activeBooks,
}: {
  data: DashboardResponse | null;
  activeBooks: number;
}) {
  const live = data?.status === "live" || data?.status === "partial";
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-[#56605c]">
      <span
        className={`h-2 w-2 rounded-full ${live ? "bg-[#2d7a53]" : "bg-[#a4a8a5]"}`}
      />
      {live
        ? `${activeBooks} of ${data?.books.length ?? 0} books active`
        : "Waiting for live data"}
    </div>
  );
}

function BookFilter({
  books,
  enabledBookKeys,
  onToggle,
  onSelectAll,
  onClear,
}: {
  books: DashboardResponse["books"];
  enabledBookKeys: readonly string[];
  onToggle: (bookKey: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const enabled = new Set(enabledBookKeys);
  const allEnabled = books.length > 0 && enabled.size === books.length;

  return (
    <section className="mt-5 rounded-xl border border-[#d2cdc2] bg-[#fbfaf6] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#26352d]">
            <Icon name="signal" className="h-4 w-4 text-[#a9492e]" />
            Consensus from {enabled.size} of {books.length}{" "}
            {books.length === 1 ? "sportsbook" : "sportsbooks"}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#747d78]">
            Every median, ranking, comparison, and value match below uses only the books you turn on.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {books.map((book) => {
            const active = enabled.has(book.key);
            return (
              <button
                key={book.key}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(book.key)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#315c46] bg-[#e3eee7] text-[#244b38]"
                    : "border-[#d3cec4] bg-[#f0ede6] text-[#858c88] hover:border-[#aaa49a] hover:text-[#58635d]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    active
                      ? "border-[#315c46] bg-[#315c46] text-white"
                      : "border-[#aaa49a] bg-transparent"
                  }`}
                >
                  {active && <Icon name="check" className="h-2.5 w-2.5" />}
                </span>
                {book.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={allEnabled ? onClear : onSelectAll}
            className="min-h-9 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8f4029] hover:text-[#642b1d]"
          >
            {allEnabled ? "Clear all" : "Use all"}
          </button>
        </div>
      </div>
    </section>
  );
}

function LoadingBoard() {
  return (
    <div className="overflow-hidden border border-[#d6d1c5] bg-[#fbfaf6]">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div
          key={row}
          className="grid grid-cols-[3rem_1fr_7rem_8rem] gap-4 border-b border-[#e3dfd6] px-5 py-4 last:border-0"
        >
          <div className="h-7 animate-pulse bg-[#ebe7de]" />
          <div className="h-7 animate-pulse bg-[#ebe7de]" />
          <div className="h-7 animate-pulse bg-[#ebe7de]" />
          <div className="h-7 animate-pulse bg-[#ebe7de]" />
        </div>
      ))}
    </div>
  );
}

function ProviderState({ data }: { data: DashboardResponse }) {
  return (
    <div className="border border-[#d6d1c5] bg-[#fbfaf6]">
      <div className="grid gap-8 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-9">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#486052]">
            <Icon name="signal" className="h-4 w-4" /> Feed status
          </div>
          <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-[#15231d]">
            {data.message ?? "The books have not posted these markets yet."}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#65706a]">
            Only verified sportsbook lines appear here. Missing players are not
            filled with model projections or demonstration data.
          </p>
          {data.status === "unconfigured" && (
            <div className="mt-6 border-l-4 border-[#d65f3a] bg-[#f1eee5] p-4 font-mono text-xs text-[#3e4a44]">
              <div>PROPLINE_API_KEY=your_free_key</div>
              <div className="mt-2">ODDS_API_KEY=multi_book_game_lines</div>
              <div className="mt-2">ODDS_IO_API_KEY=draftkings_betmgm</div>
            </div>
          )}
        </div>
        <div className="divide-y divide-[#ded9cf] border-y border-[#ded9cf]">
          {data.sources.map((source) => (
            <div key={source.key} className="py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-[#1f2c26]">
                  {source.label}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#68736d]">
                  {source.state.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#747e78]">
                {source.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameCard({
  game,
  players,
  scoring,
}: {
  game: GameSummary;
  players: PlayerProjection[];
  scoring: LiveScoringSystem;
}) {
  const teams = new Set([
    canonicalTeam(game.homeTeam),
    canonicalTeam(game.awayTeam),
  ]);
  const gamePlayers = players
    .filter((player) => teams.has(canonicalTeam(player.player.team)))
    .sort((left, right) => right.points[scoring] - left.points[scoring])
    .slice(0, 5);

  return (
    <div className="min-w-[320px] border-l-4 border-[#284a3a] bg-[#fbfaf6] p-4 shadow-[0_1px_0_rgba(20,30,24,0.06)]">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7a817d]">
        <span>{game.week || formatKickoff(game.kickoff).split(",")[0]}</span>
        <span>{game.bookCount} {game.bookCount === 1 ? "book" : "books"}</span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
          <span className="text-sm font-semibold text-[#4f5a54]">
            {game.awayTeam}
          </span>
          <span className="font-mono text-xl text-[#1b2721]">
            {game.awayImpliedTotal === null
              ? "—"
              : game.awayImpliedTotal.toFixed(1)}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
          <span className="text-sm font-semibold text-[#17231e]">
            {game.homeTeam}
          </span>
          <span className="font-mono text-xl font-semibold text-[#b84d2d]">
            {game.homeImpliedTotal === null
              ? "—"
              : game.homeImpliedTotal.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex gap-5 border-t border-[#e1ddd4] pt-3 text-[11px] text-[#7a837e]">
        <span>
          Total <strong className="font-mono text-[#39443e]">{game.total ?? "—"}</strong>
        </span>
        <span>
          Home{" "}
          <strong className="font-mono text-[#39443e]">
            {game.homeSpread !== null && game.homeSpread > 0 ? "+" : ""}
            {game.homeSpread ?? "—"}
          </strong>
        </span>
      </div>
      {gamePlayers.length > 0 && (
        <div className="mt-3 border-t border-[#e1ddd4] pt-3">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#7a837e]">
            Props in this environment · {scoringLabel(scoring)}
          </div>
          <div className="space-y-1.5">
            {gamePlayers.map((player) => (
              <div
                key={playerKey(player)}
                className="flex items-center justify-between gap-3 text-[10px]"
              >
                <span className="truncate text-[#526058]">
                  {player.player.name} · {player.player.position}
                </span>
                <span className="font-mono font-semibold text-[#9b4a32]">
                  {player.points[scoring].toFixed(1)} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuoteRow({ quote }: { quote: SportsbookQuote }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-5 border-t border-[#e2ded5] py-3">
      <div>
        <div className="text-xs font-semibold text-[#28342e]">
          {quote.book.name}
        </div>
        <div className="mt-0.5 text-[10px] text-[#818984]">
          Updated {timeAgo(quote.updatedAt)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold text-[#16231d]">
          {formatNumber(quote.line)}
        </div>
        <div className="text-[10px] text-[#8a918d]">line</div>
      </div>
      <div className="min-w-20 text-right font-mono text-[10px] text-[#626d67]">
        <div>O {formatOdds(quote.overOdds)}</div>
        <div>U {formatOdds(quote.underOdds)}</div>
      </div>
    </div>
  );
}

function PlayerDetail({
  player,
  scoring,
}: {
  player: PlayerProjection;
  scoring: LiveScoringSystem;
}) {
  return (
    <div className="border-y border-[#cfc9bc] bg-[#f0ede5] px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#52665a]">
            Posted markets
          </div>
          <h3 className="mt-1 text-xl font-semibold text-[#16231d]">
            {player.player.name}
          </h3>
          <p className="mt-1 text-xs text-[#6c7670]">
            Main line per book · equal-weight median when multiple books are available
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#737d77]">
            Posted data
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#34413a]">
            {player.components.length} markets · {player.bookCount} {player.bookCount === 1 ? "book" : "books"}
          </div>
        </div>
      </div>
      <div className="mt-5 overflow-hidden border border-[#d5d0c5] bg-[#fbfaf6]">
        <div className="hidden grid-cols-[1.2fr_0.7fr_0.7fr] gap-4 border-b border-[#ddd8ce] bg-[#e9e5dc] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#68716c] sm:grid">
          <span>Market</span>
          <span className="text-right">Consensus</span>
          <span className="text-right">Range</span>
        </div>
        {player.components.map((component) => (
          <div
            key={component.market}
            className="border-b border-[#e3dfd7] px-4 py-4 last:border-0"
          >
            <div className="grid items-baseline gap-2 sm:grid-cols-[1.2fr_0.7fr_0.7fr] sm:gap-4">
              <div className="font-semibold text-[#26332d]">{component.label}</div>
              <div className="sm:text-right">
                <div className="font-mono text-sm text-[#19251f]">
                  {formatNumber(component.line)}
                </div>
                <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#7c8580]">
                  {component.quotes.length} {component.quotes.length === 1 ? "book" : "books"}
                </div>
              </div>
              <div className="font-mono text-xs text-[#717a75] sm:text-right">
                {formatNumber(component.low)}–{formatNumber(component.high)}
              </div>
            </div>
            <div className="mt-3">
              {component.quotes.map((quote) => (
                <QuoteRow
                  key={`${quote.source}-${quote.book.key}-${quote.line}`}
                  quote={quote}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <PlayerHistory
        key={player.player.sleeperId ?? player.player.id}
        player={player.player}
        scoring={scoring}
      />
    </div>
  );
}

function PlayerSearch({
  label,
  players,
  value,
  scoring,
  adpPlatform,
  onChange,
}: {
  label: string;
  players: PlayerProjection[];
  value: string | null;
  scoring: LiveScoringSystem;
  adpPlatform: AdpPlatform;
  onChange: (value: string | null) => void;
}) {
  const selected = value
    ? players.find((player) => playerKey(player) === value) ?? null
    : null;
  const [query, setQuery] = useState(selected?.player.name ?? "");
  const [open, setOpen] = useState(false);
  const listboxId = `${label.toLowerCase().replace(/\s+/g, "-")}-player-results`;
  const results = players
    .filter((player) => playerMatchesSearch(player, query, true))
    .slice(0, 7);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery(selected?.player.name ?? "");
        }
      }}
    >
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#aebcb5]">
        {label}
      </span>
      <div className="relative">
        <Icon
          name="search"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718078]"
        />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value) onChange(null);
          }}
          onFocus={() => {
            if (selected && query === selected.player.name) setQuery("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              onChange(playerKey(results[0]));
              setQuery(results[0].player.name);
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder="Search by player, team, or position"
          className="h-12 w-full rounded-lg border border-[#c9c5bb] bg-white pl-10 pr-3 text-sm font-semibold text-[#1b2822] outline-none placeholder:font-normal placeholder:text-[#8d958f] focus:border-[#9e4f35] focus:ring-2 focus:ring-[#9e4f35]/10"
        />
      </div>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-[370px] w-full overflow-auto rounded-lg border border-[#d1ccc1] bg-white p-1.5 shadow-[0_18px_45px_rgba(22,35,29,0.18)]"
        >
          {results.length > 0 ? (
            results.map((player) => (
              <button
                key={playerKey(player)}
                type="button"
                role="option"
                aria-selected={playerKey(player) === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(playerKey(player));
                  setQuery(player.player.name);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition hover:bg-[#f2efe8] aria-selected:bg-[#ece7dd]"
              >
                <PlayerHeadshot player={player.player} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#1b2822]">
                    {player.player.name}
                  </span>
                  <span className="block text-[10px] text-[#717b75]">
                    {player.player.position} · {player.player.team ?? "Team pending"}
                  </span>
                </span>
                <span className="max-w-36 text-right">
                  <span className="block truncate font-mono text-[10px] font-semibold text-[#4c5b53]">
                    {postedLineSummary(player, 1)[0] ?? "No posted line"}
                  </span>
                  <span className="block text-[9px] text-[#7c8580]">
                    {adpPlatformLabel(adpPlatform)} {formatAdp(adpFor(player, scoring, adpPlatform))}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-5 text-center text-xs text-[#737d77]">
              No matching players.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonSummary({
  player,
  scoring,
  mode,
  adpPlatform,
  comparisonMismatch,
}: {
  player: PlayerProjection | null;
  scoring: LiveScoringSystem;
  mode: BoardMode;
  adpPlatform: AdpPlatform;
  comparisonMismatch: boolean;
}) {
  if (!player) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#d0cbc0] bg-[#f5f2eb] text-sm text-[#7b847f]">
        Search for a player above
      </div>
    );
  }

  const adp = adpFor(player, scoring, adpPlatform);
  const pointRange = playerPointRange(player, scoring);

  return (
    <div className="rounded-xl border border-[#d8d3c8] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <PlayerHeadshot player={player.player} size="lg" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#6e7872]">
            {player.player.position} · {player.player.team ?? "Team pending"}
          </div>
          <div className="mt-0.5 truncate text-xl font-semibold tracking-tight text-[#17241e]">
            {player.player.name}
          </div>
          <div className="mt-1 text-[10px] text-[#7d8581]">
            {player.components.length} posted {player.components.length === 1 ? "market" : "markets"} · {player.coverage}% coverage · {player.bookCount} {player.bookCount === 1 ? "book" : "books"}
          </div>
        </div>
      </div>
      <div
        className={`mt-5 grid gap-4 border-t border-[#e1ddd4] pt-4 ${
          mode === "draft"
            ? "sm:grid-cols-[1.25fr_0.65fr_0.65fr]"
            : "sm:grid-cols-[1.4fr_0.8fr]"
        }`}
      >
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7c8580]">
            Posted Vegas production
          </div>
          {player.components.length > 0 ? (
            <div className="mt-2">
              <PostedLines player={player} limit={4} />
            </div>
          ) : (
            <div className="mt-2 text-xs font-medium text-[#8f4029]">
              No lines from the active books
            </div>
          )}
        </div>
        <div className="border-t border-[#e1ddd4] pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7c8580]">
            All posted {scoringLabel(scoring)} points
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold text-[#a9492e]">
            {player.components.length > 0
              ? player.points[scoring].toFixed(1)
              : "—"}
          </div>
          <div className="mt-0.5 text-[10px] text-[#7c8580]">
            {pointRange
              ? `Book range ${pointRange.low.toFixed(1)}–${pointRange.high.toFixed(1)}`
              : "No active projection range"}
          </div>
          {comparisonMismatch && (
            <div className="mt-1.5 inline-flex rounded-full bg-[#fff0e2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#8f4029]">
              Context only
            </div>
          )}
        </div>
        {mode === "draft" && (
          <div className="border-t border-[#e1ddd4] pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7c8580]">
              {adpPlatformLabel(adpPlatform)} ADP
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold text-[#25352d]">
              {formatAdp(adp)}
            </div>
            <div className="mt-0.5 text-[10px] text-[#7c8580]">
              {adp === null
                ? "Not currently drafted"
                : `Round / pick ${formatRoundPick(adp)}`}
            </div>
          </div>
        )}
      </div>
      <PlayerHistory
        key={player.player.sleeperId ?? player.player.id}
        player={player.player}
        scoring={scoring}
      />
    </div>
  );
}

function MarketComparisonRow({
  label,
  left,
  right,
  scoring,
}: {
  label: string;
  left?: ConsensusComponent;
  right?: ConsensusComponent;
  scoring: LiveScoringSystem;
}) {
  return (
    <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center gap-3 border-t border-[#ddd8ce] px-4 py-3 sm:grid-cols-[1fr_10rem_1fr] sm:px-6">
      <div className="text-left text-[#34413a]">
        <div className="font-mono text-sm font-semibold">
          {left ? formatNumber(left.line) : "—"}
        </div>
        {left && (
          <div className="mt-0.5 text-[9px] text-[#858d88]">
            {left.points[scoring].toFixed(1)} pts · {left.quotes.length}{" "}
            {left.quotes.length === 1 ? "book" : "books"}
          </div>
        )}
      </div>
      <div className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6d7771]">
        {label}
      </div>
      <div className="text-right text-[#34413a]">
        <div className="font-mono text-sm font-semibold">
          {right ? formatNumber(right.line) : "—"}
        </div>
        {right && (
          <div className="mt-0.5 text-[9px] text-[#858d88]">
            {right.points[scoring].toFixed(1)} pts · {right.quotes.length}{" "}
            {right.quotes.length === 1 ? "book" : "books"}
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonWorkspace({
  players,
  scoring,
  mode,
  adpPlatform,
  leftId,
  rightId,
  onSelect,
}: {
  players: PlayerProjection[];
  scoring: LiveScoringSystem;
  mode: BoardMode;
  adpPlatform: AdpPlatform;
  leftId: string | null;
  rightId: string | null;
  onSelect: (slot: 0 | 1, value: string | null) => void;
}) {
  const lookup = new Map(players.map((player) => [playerKey(player), player]));
  const left = leftId ? lookup.get(leftId) ?? null : null;
  const right = rightId ? lookup.get(rightId) ?? null : null;
  const leftComponents = new Map(
    (left?.components ?? []).map((component) => [component.market, component]),
  );
  const rightComponents = new Map(
    (right?.components ?? []).map((component) => [component.market, component]),
  );
  const componentLabels = new Map<LiveMarket, string>();

  for (const component of [
    ...(left?.components ?? []),
    ...(right?.components ?? []),
  ]) {
    componentLabels.set(component.market, component.label);
  }

  const sharedMarkets = MARKET_ORDER.filter(
    (market) => leftComponents.has(market) && rightComponents.has(market),
  );
  const unmatchedMarkets = MARKET_ORDER.filter(
    (market) => leftComponents.has(market) !== rightComponents.has(market),
  );
  const leftOnlyMarkets = unmatchedMarkets.filter(
    (market) => leftComponents.has(market),
  );
  const rightOnlyMarkets = unmatchedMarkets.filter(
    (market) => rightComponents.has(market),
  );
  const leftSharedComponents = sharedMarkets.flatMap((market) => {
    const component = leftComponents.get(market);
    return component ? [component] : [];
  });
  const rightSharedComponents = sharedMarkets.flatMap((market) => {
    const component = rightComponents.get(market);
    return component ? [component] : [];
  });
  const leftSharedPoints = pointsForComponents(leftSharedComponents, scoring);
  const rightSharedPoints = pointsForComponents(rightSharedComponents, scoring);
  const sharedPointDifference = rightSharedPoints - leftSharedPoints;
  const sharedPointAverage = (leftSharedPoints + rightSharedPoints) / 2;
  const sharedGapPercent =
    sharedMarkets.length > 0
      ? (Math.abs(sharedPointDifference) / Math.max(sharedPointAverage, 1)) * 100
      : null;
  const leftOnlyPoints = pointsForComponents(
    leftOnlyMarkets.flatMap((market) => {
      const component = leftComponents.get(market);
      return component ? [component] : [];
    }),
    scoring,
  );
  const rightOnlyPoints = pointsForComponents(
    rightOnlyMarkets.flatMap((market) => {
      const component = rightComponents.get(market);
      return component ? [component] : [];
    }),
    scoring,
  );
  const marketAvailabilityDiffers = unmatchedMarkets.length > 0;
  const leftBooks = new Set(
    (left?.components ?? []).flatMap((component) =>
      component.quotes.map((quote) => quote.book.key),
    ),
  );
  const rightBooks = new Set(
    (right?.components ?? []).flatMap((component) =>
      component.quotes.map((quote) => quote.book.key),
    ),
  );
  const sharedBookCount = [...leftBooks].filter((book) =>
    rightBooks.has(book),
  ).length;
  const bookAvailabilityDiffers =
    leftBooks.size !== rightBooks.size ||
    [...leftBooks].some((book) => !rightBooks.has(book));
  const leftAdp = adpFor(left, scoring, adpPlatform);
  const rightAdp = adpFor(right, scoring, adpPlatform);
  const adpDifference =
    leftAdp !== null && rightAdp !== null ? leftAdp - rightAdp : null;
  const leftPointRange = left ? playerPointRange(left, scoring) : null;
  const rightPointRange = right ? playerPointRange(right, scoring) : null;
  const leftSharedPointRange = componentPointRange(
    leftSharedComponents,
    scoring,
  );
  const rightSharedPointRange = componentPointRange(
    rightSharedComponents,
    scoring,
  );

  return (
    <section
      id="comparison"
      className="scroll-mt-5 overflow-hidden rounded-2xl border border-[#d1ccc1] bg-[#fbfaf6] shadow-[0_10px_32px_rgba(35,44,38,0.07)]"
    >
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-3 border-b border-[#ddd8ce] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a9492e]">
              <Icon name="compare" className="h-4 w-4" /> Player comparison
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#17241e]">
              Compare two players
            </h2>
          </div>
          <div className="max-w-md text-xs leading-5 text-[#6f7973]">
            Direct comp uses only markets posted for both players. All-posted
            totals stay visible as context and are flagged when availability differs.
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <PlayerSearch
            key={`player-one-${leftId ?? "empty"}`}
            label="Player one"
            players={players}
            value={leftId}
            scoring={scoring}
            adpPlatform={adpPlatform}
            onChange={(value) => onSelect(0, value)}
          />
          <PlayerSearch
            key={`player-two-${rightId ?? "empty"}`}
            label="Player two"
            players={players}
            value={rightId}
            scoring={scoring}
            adpPlatform={adpPlatform}
            onChange={(value) => onSelect(1, value)}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ComparisonSummary
            player={left}
            scoring={scoring}
            mode={mode}
            adpPlatform={adpPlatform}
            comparisonMismatch={Boolean(
              left && right && marketAvailabilityDiffers,
            )}
          />
          <ComparisonSummary
            player={right}
            scoring={scoring}
            mode={mode}
            adpPlatform={adpPlatform}
            comparisonMismatch={Boolean(
              left && right && marketAvailabilityDiffers,
            )}
          />
        </div>

        {left &&
          right &&
          (marketAvailabilityDiffers || bookAvailabilityDiffers) && (
            <div
              role="status"
              className="mt-4 rounded-xl border-2 border-[#c56a3f] bg-[#fff4e8] px-4 py-4 text-[#5f321f] sm:px-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a9492e] font-mono text-sm font-bold text-white">
                  !
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold">
                    {marketAvailabilityDiffers
                      ? "Market availability differs — use the direct comp"
                      : "Sportsbook availability differs"}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#74472f]">
                    {marketAvailabilityDiffers
                      ? `Only ${sharedMarkets.length} of ${componentLabels.size} posted markets are available for both players. All-posted totals are not apples-to-apples.`
                      : "The same markets are posted, but the consensus lines come from different sportsbook sets."}
                  </p>
                  {marketAvailabilityDiffers && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                      {leftOnlyMarkets.length > 0 && (
                        <span className="rounded-full border border-[#dfb99f] bg-white/70 px-2.5 py-1">
                          {left.player.name} only:{" "}
                          {leftOnlyMarkets
                            .map((market) => MARKET_SHORT_LABELS[market])
                            .join(", ")} ({leftOnlyPoints.toFixed(1)} pts)
                        </span>
                      )}
                      {rightOnlyMarkets.length > 0 && (
                        <span className="rounded-full border border-[#dfb99f] bg-white/70 px-2.5 py-1">
                          {right.player.name} only:{" "}
                          {rightOnlyMarkets
                            .map((market) => MARKET_SHORT_LABELS[market])
                            .join(", ")} ({rightOnlyPoints.toFixed(1)} pts)
                        </span>
                      )}
                    </div>
                  )}
                  {bookAvailabilityDiffers && (
                    <div className="mt-2 text-[10px] text-[#80543d]">
                      Sportsbook depth also differs: {left.player.name}{" "}
                      {leftBooks.size} · {right.player.name} {rightBooks.size} ·{" "}
                      {sharedBookCount} in common
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {left && right && sharedMarkets.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border-2 border-[#315c46] bg-[#f2f7f3]">
            <div className="bg-[#315c46] px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              Direct comparison · shared markets only
            </div>
            <div className="grid grid-cols-[1fr_8rem_1fr] items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_12rem_1fr] sm:px-6">
              <div>
                <div className="truncate text-[10px] font-semibold text-[#5e6d65]">
                  {left.player.name}
                </div>
                <div className="mt-0.5 font-mono text-2xl font-bold text-[#203c2d] sm:text-3xl">
                  {leftSharedPoints.toFixed(1)}
                </div>
                {leftSharedPointRange && (
                  <div className="text-[9px] text-[#728078]">
                    {leftSharedPointRange.low.toFixed(1)}–{leftSharedPointRange.high.toFixed(1)} range
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#315c46]">
                  {scoringLabel(scoring)} points
                </div>
                <div className="mt-1 text-[9px] leading-4 text-[#68766e]">
                  {sharedMarkets.length} shared{" "}
                  {sharedMarkets.length === 1 ? "market" : "markets"}
                </div>
                {sharedGapPercent !== null && (
                  <div className="mt-1 text-[9px] font-semibold text-[#334a3e]">
                    {Math.abs(sharedPointDifference) < 0.05
                      ? "Even"
                      : `${sharedPointDifference > 0 ? right.player.name : left.player.name} +${Math.abs(sharedPointDifference).toFixed(1)} (${sharedGapPercent.toFixed(1)}%)`}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="truncate text-[10px] font-semibold text-[#5e6d65]">
                  {right.player.name}
                </div>
                <div className="mt-0.5 font-mono text-2xl font-bold text-[#203c2d] sm:text-3xl">
                  {rightSharedPoints.toFixed(1)}
                </div>
                {rightSharedPointRange && (
                  <div className="text-[9px] text-[#728078]">
                    {rightSharedPointRange.low.toFixed(1)}–{rightSharedPointRange.high.toFixed(1)} range
                  </div>
                )}
              </div>
            </div>
            {adpDifference !== null && (
              <div className="border-t border-[#cbd9d0] px-4 py-2 text-center text-[10px] text-[#65736b]">
                <strong className="font-mono text-[#30463a]">
                  {Math.abs(adpDifference).toFixed(0)} picks
                </strong>{" "}
                apart by {adpPlatformLabel(adpPlatform)} ADP
              </div>
            )}
          </div>
        )}

        {left && right && sharedMarkets.length === 0 && (
          <div className="mt-4 rounded-xl border-2 border-[#a9492e] bg-[#fff4e8] px-5 py-4 text-center">
            <div className="text-sm font-bold text-[#6d3422]">
              No direct points comparison available
            </div>
            <div className="mt-1 text-xs text-[#80533e]">
              These players do not have any mutually posted markets. Their
              all-posted totals are context only.
            </div>
          </div>
        )}
      </div>

      {left && right ? (
        <div>
          <div className="border-t border-[#ddd8ce] px-5 py-4 sm:px-7">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#69736d]">
              Direct comparison markets
            </div>
            <p className="mt-1 text-[11px] text-[#818984]">
              These markets are posted for both players. Book counts remain
              visible on every line.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_7.5rem_1fr] gap-3 bg-[#e9e5dc] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6c756f] sm:grid-cols-[1fr_10rem_1fr] sm:px-6">
            <span>{left.player.name}</span>
            <span className="text-center">Posted line</span>
            <span className="text-right">{right.player.name}</span>
          </div>
          {sharedMarkets.map((market) => (
            <MarketComparisonRow
              key={market}
              label={componentLabels.get(market) ?? market}
              left={leftComponents.get(market)}
              right={rightComponents.get(market)}
              scoring={scoring}
            />
          ))}
          {sharedMarkets.length === 0 && (
            <div className="border-t border-[#ddd8ce] px-5 py-6 text-center text-xs text-[#7a837e]">
              No mutually posted markets.
            </div>
          )}
          {unmatchedMarkets.length > 0 && (
            <>
              <div className="border-t-2 border-[#c56a3f] bg-[#fff0e2] px-5 py-3 sm:px-7">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8f4029]">
                  Additional markets · excluded from direct comp
                </div>
                <p className="mt-1 text-[10px] text-[#80533e]">
                  Kept for context. A missing line is unknown, never zero.
                </p>
              </div>
              {unmatchedMarkets.map((market) => (
                <MarketComparisonRow
                  key={market}
                  label={componentLabels.get(market) ?? market}
                  left={leftComponents.get(market)}
                  right={rightComponents.get(market)}
                  scoring={scoring}
                />
              ))}
            </>
          )}
          <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center gap-3 border-t-2 border-[#cec8bb] bg-[#f4f1ea] px-4 py-4 sm:grid-cols-[1fr_10rem_1fr] sm:px-6">
            <div className="font-mono text-xl font-semibold text-[#a9492e]">
              {left.components.length > 0
                ? left.points[scoring].toFixed(1)
                : "—"}
              {leftPointRange && (
                <div className="mt-0.5 text-[9px] font-normal text-[#7b847f]">
                  {leftPointRange.low.toFixed(1)}–{leftPointRange.high.toFixed(1)} range
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4f5d55]">
                All posted points
              </div>
              <div className="mt-0.5 text-[9px] text-[#858d88]">
                {marketAvailabilityDiffers ? "Context only" : "Same market set"}
              </div>
            </div>
            <div className="text-right font-mono text-xl font-semibold text-[#a9492e]">
              {right.components.length > 0
                ? right.points[scoring].toFixed(1)
                : "—"}
              {rightPointRange && (
                <div className="mt-0.5 text-[9px] font-normal text-[#7b847f]">
                  {rightPointRange.low.toFixed(1)}–{rightPointRange.high.toFixed(1)} range
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_7.5rem_1fr] gap-3 border-t-2 border-[#cec8bb] bg-[#f2efe8] px-4 py-4 text-xs sm:grid-cols-[1fr_10rem_1fr] sm:px-6">
            <div>
              <strong className="font-mono text-[#27342e]">{left.coverage}%</strong>
              <span className="ml-2 text-[#737c77]">coverage · {left.bookCount} {left.bookCount === 1 ? "book" : "books"}</span>
            </div>
            <div className="text-center text-[#737c77]">Data depth</div>
            <div className="text-right">
              <span className="mr-2 text-[#737c77]">{right.bookCount} {right.bookCount === 1 ? "book" : "books"} · coverage</span>
              <strong className="font-mono text-[#27342e]">{right.coverage}%</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-sm text-[#727c76]">
          Choose two players to compare their lines market by market.
        </div>
      )}
    </section>
  );
}

interface DraftValueMatch {
  anchor: PlayerProjection;
  alternative: PlayerProjection;
  target: PlayerProjection;
  productionGap: number;
  adpGap: number;
}

function contextualDraftMatches(
  players: PlayerProjection[],
  scoring: LiveScoringSystem,
  adpPlatform: AdpPlatform,
  anchors: Array<PlayerProjection | null>,
): DraftValueMatch[] {
  const selected = anchors.filter(
    (player): player is PlayerProjection => player !== null,
  );
  const selectedKeys = new Set(selected.map(playerKey));
  const usedAlternatives = new Set<string>();
  const matches: DraftValueMatch[] = [];

  for (const anchor of selected) {
    const anchorAdp = adpFor(anchor, scoring, adpPlatform);
    if (anchorAdp === null) continue;

    const candidates = players
      .filter((candidate) => !selectedKeys.has(playerKey(candidate)))
      .flatMap((alternative) => {
        const alternativeAdp = adpFor(alternative, scoring, adpPlatform);
        const productionGap = productionGapPercent(anchor, alternative, scoring);
        if (alternativeAdp === null || productionGap === null) return [];
        const adpGap = Math.abs(anchorAdp - alternativeAdp);
        if (productionGap > 12 || adpGap < 8) return [];
        return [{ alternative, alternativeAdp, productionGap, adpGap }];
      })
      .sort(
        (left, right) =>
          left.productionGap - right.productionGap || right.adpGap - left.adpGap,
      );

    let anchorMatches = 0;
    for (const candidate of candidates) {
      const alternativeKey = playerKey(candidate.alternative);
      if (usedAlternatives.has(alternativeKey)) continue;
      const target =
        anchorAdp > candidate.alternativeAdp ? anchor : candidate.alternative;
      matches.push({
        anchor,
        alternative: candidate.alternative,
        target,
        productionGap: candidate.productionGap,
        adpGap: candidate.adpGap,
      });
      usedAlternatives.add(alternativeKey);
      anchorMatches += 1;
      if (anchorMatches === 2 || matches.length === 4) break;
    }
    if (matches.length === 4) break;
  }

  return matches;
}

function DraftMatchPlayer({
  player,
  scoring,
  adpPlatform,
  label,
  valueTarget,
}: {
  player: PlayerProjection;
  scoring: LiveScoringSystem;
  adpPlatform: AdpPlatform;
  label: string;
  valueTarget: boolean;
}) {
  const adp = adpFor(player, scoring, adpPlatform) as number;
  return (
    <div className={`p-4 sm:p-5 ${valueTarget ? "bg-[#e6eee8]" : "bg-[#fbfaf6]"}`}>
      <div className="mb-3 flex min-h-6 items-center">
        {valueTarget ? (
          <span className="inline-flex rounded-full bg-[#2e674a] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.09em] text-white">
            Value target
          </span>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-[0.09em] text-[#78817c]">
            {label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <PlayerHeadshot player={player.player} size="md" />
        <div className="min-w-0">
          <div className="truncate font-semibold text-[#17241e]">
            {player.player.name}
          </div>
          <div className="mt-0.5 text-[10px] text-[#68746d]">
            {player.player.position} · {player.player.team ?? "Team pending"}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <PostedLines player={player} limit={3} tone={valueTarget ? "light" : "neutral"} />
      </div>
      <div className="mt-4 border-t border-[#d8d6ce] pt-3">
        <div className="font-mono text-2xl font-semibold text-[#1d362a]">
          {formatAdp(adp)}
        </div>
        <div className="text-[9px] uppercase tracking-[0.08em] text-[#6f7973]">
          {adpPlatformLabel(adpPlatform)} ADP · round / pick {formatRoundPick(adp)}
        </div>
      </div>
    </div>
  );
}

function DraftValueTargets({
  players,
  scoring,
  adpPlatform,
  anchors,
  context,
  onCompare,
}: {
  players: PlayerProjection[];
  scoring: LiveScoringSystem;
  adpPlatform: AdpPlatform;
  anchors: Array<PlayerProjection | null>;
  context: DashboardResponse["adpContext"];
  onCompare: (left: PlayerProjection, right: PlayerProjection) => void;
}) {
  const selectedCount = anchors.filter(Boolean).length;
  const matches = useMemo(
    () => contextualDraftMatches(players, scoring, adpPlatform, anchors),
    [adpPlatform, anchors, players, scoring],
  );
  const selectedPlatform = context?.platforms.find(
    (platform) => platform.key === adpPlatform,
  );

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#a9492e]">
            Your ADP alternatives
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#16231d]">
            Closest production to your selected players
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#707a74]">
            These are tied directly to the players above: same position, same posted
            Vegas markets, similar production, and at least an eight-pick ADP gap.
          </p>
        </div>
        {selectedPlatform && (
          <div className="text-[10px] leading-4 text-[#7a837e] sm:text-right">
            {selectedPlatform.label} ADP through {selectedPlatform.updatedAt}
            <br />
            {formatNumber(selectedPlatform.playerCounts[scoring] ?? 0, 0)} players tracked
          </div>
        )}
      </div>

      {matches.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {matches.map((match) => {
            const alternativeIsTarget = match.target === match.alternative;
            return (
              <article
                key={`${playerKey(match.anchor)}:${playerKey(match.alternative)}`}
                className="overflow-hidden rounded-xl border border-[#d4cfc4] bg-[#fbfaf6]"
              >
                <div className="border-b border-[#d4cfc4] bg-white px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.09em] text-[#78817c] sm:px-5">
                  Near {match.anchor.player.name}&apos;s posted production
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                  <DraftMatchPlayer
                    player={match.anchor}
                    scoring={scoring}
                    adpPlatform={adpPlatform}
                    label="Selected player"
                    valueTarget={!alternativeIsTarget}
                  />
                  <div className="flex w-10 items-center justify-center border-x border-[#d4cfc4] bg-[#f2efe8] text-[9px] font-semibold uppercase tracking-[0.08em] text-[#858c88]">
                    vs
                  </div>
                  <DraftMatchPlayer
                    player={match.alternative}
                    scoring={scoring}
                    adpPlatform={adpPlatform}
                    label="Closest line match"
                    valueTarget={alternativeIsTarget}
                  />
                </div>
                <div className="flex flex-col gap-3 border-t border-[#ddd8ce] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-xs text-[#5f6a64]">
                    Same posted market set and{" "}
                    <strong className="text-[#1f2d26]">
                      {match.productionGap.toFixed(1)}% scoring-weighted production gap
                    </strong>
                    . {match.target.player.name} is available{" "}
                    <strong className="text-[#2e674a]">
                      {match.adpGap.toFixed(0)} picks later
                    </strong>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => onCompare(match.anchor, match.alternative)}
                    className="shrink-0 rounded-md border border-[#315c46] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#315c46] transition hover:bg-[#315c46] hover:text-white"
                  >
                    Compare pair
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#cfc9bd] bg-[#f7f4ee] px-6 py-8 text-center">
          <div className="text-sm font-semibold text-[#34413a]">
            {selectedCount === 0
              ? "Search for a player above to find nearby ADP values."
              : "No strong ADP mismatch matches the selected players' current posted markets."}
          </div>
          <p className="mt-1 text-xs text-[#7a837e]">
            Recommendations appear only when production is within 12% and the same Vegas markets are available for both players.
          </p>
        </div>
      )}
    </section>
  );
}

interface AdpMispricing {
  player: PlayerProjection;
  benchmark: PlayerProjection;
  vegasRank: number;
  adpRank: number;
  actualAdp: number;
  vegasAdp: number;
  pickGap: number;
  comparablePlayers: number;
}

function calculateAdpMispricings(
  players: PlayerProjection[],
  scoring: LiveScoringSystem,
  adpPlatform: AdpPlatform,
): AdpMispricing[] {
  const groups = new Map<string, PlayerProjection[]>();

  for (const player of players) {
    if (
      adpFor(player, scoring, adpPlatform) === null ||
      player.components.length === 0 ||
      player.bookCount < 2
    ) {
      continue;
    }
    const key = `${player.player.position}:${marketShape(player)}`;
    const values = groups.get(key) ?? [];
    values.push(player);
    groups.set(key, values);
  }

  return [...groups.values()].flatMap((group) => {
    if (group.length < 4) return [];
    const byAdp = [...group].sort(
      (left, right) =>
        (adpFor(left, scoring, adpPlatform) as number) -
        (adpFor(right, scoring, adpPlatform) as number),
    );
    const adpRankByPlayer = new Map(
      byAdp.map((player, index) => [playerKey(player), index + 1]),
    );
    const byVegas = [...group].sort(
      (left, right) => right.points[scoring] - left.points[scoring],
    );

    return byVegas.flatMap((player, index) => {
      const actualAdp = adpFor(player, scoring, adpPlatform) as number;
      const benchmark = byAdp[index];
      const vegasAdp = adpFor(benchmark, scoring, adpPlatform) as number;
      const pickGap = actualAdp - vegasAdp;
      if (Math.abs(pickGap) < 6) return [];

      return [
        {
          player,
          benchmark,
          vegasRank: index + 1,
          adpRank: adpRankByPlayer.get(playerKey(player)) ?? index + 1,
          actualAdp,
          vegasAdp,
          pickGap,
          comparablePlayers: group.length,
        },
      ];
    });
  });
}

function MispricingList({
  title,
  description,
  items,
  value,
  scoring,
  onCompare,
}: {
  title: string;
  description: string;
  items: AdpMispricing[];
  value: boolean;
  scoring: LiveScoringSystem;
  onCompare: (left: PlayerProjection, right: PlayerProjection) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#d3cec3] bg-[#fbfaf6]">
      <div className={`border-b border-[#d3cec3] px-4 py-4 sm:px-5 ${value ? "bg-[#e5eee7]" : "bg-[#eee8df]"}`}>
        <div className={`text-[10px] font-bold uppercase tracking-[0.1em] ${value ? "text-[#2e674a]" : "text-[#9b4a32]"}`}>
          {title}
        </div>
        <p className="mt-1 text-xs text-[#6d7771]">{description}</p>
      </div>
      <div className="divide-y divide-[#dfdbd2]">
        {items.length > 0 ? (
          items.map((item) => (
            <article
              key={playerKey(item.player)}
              className="grid gap-4 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlayerHeadshot player={item.player.player} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#19261f]">
                    {item.player.player.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#737d77]">
                    {item.player.player.position} · {item.player.player.team ?? "Team pending"} · {item.player.bookCount} {item.player.bookCount === 1 ? "book" : "books"}
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#58645d]">
                    Vegas production rank #{item.vegasRank} · fantasy ADP rank #{item.adpRank}
                  </div>
                  <div className="mt-0.5 text-[9px] text-[#89908c]">
                    Among {item.comparablePlayers} same-position players with the same posted props
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-5 sm:justify-end">
                <div className="text-right">
                  <div className={`font-mono text-lg font-semibold ${value ? "text-[#2e674a]" : "text-[#9b4a32]"}`}>
                    {Math.abs(item.pickGap).toFixed(0)} picks
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.07em] text-[#7b847f]">
                    {value ? "later than Vegas slot" : "earlier than Vegas slot"}
                  </div>
                  <div className="mt-1 text-[10px] text-[#737d77]">
                    {item.player.points[scoring].toFixed(1)} pts · ADP {formatAdp(item.actualAdp)} vs Vegas slot {formatAdp(item.vegasAdp)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCompare(item.player, item.benchmark)}
                  className="rounded-md border border-[#aaa49a] px-2.5 py-2 text-[9px] font-bold uppercase tracking-[0.07em] text-[#58635d] transition hover:border-[#315c46] hover:text-[#315c46]"
                  aria-label={`Compare ${item.player.player.name} with ${item.benchmark.player.name}`}
                >
                  Compare
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="px-5 py-8 text-center text-xs text-[#7a837e]">
            No strong mismatch with the current books and scoring.
          </div>
        )}
      </div>
    </div>
  );
}

function VegasAdpMispricing({
  players,
  scoring,
  adpPlatform,
  onCompare,
}: {
  players: PlayerProjection[];
  scoring: LiveScoringSystem;
  adpPlatform: AdpPlatform;
  onCompare: (left: PlayerProjection, right: PlayerProjection) => void;
}) {
  const mispricings = useMemo(
    () => calculateAdpMispricings(players, scoring, adpPlatform),
    [adpPlatform, players, scoring],
  );
  const values = mispricings
    .filter((item) => item.pickGap > 0)
    .sort((left, right) => right.pickGap - left.pickGap)
    .slice(0, 6);
  const premiums = mispricings
    .filter((item) => item.pickGap < 0)
    .sort((left, right) => left.pickGap - right.pickGap)
    .slice(0, 6);

  return (
    <section className="mt-10">
      <div className="mb-4 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#a9492e]">
          Vegas vs. fantasy ADP
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#16231d]">
          Where the sportsbooks and draft rooms disagree
        </h2>
        <p className="mt-1 text-xs leading-5 text-[#707a74]">
          Players are ranked only against the same position with the exact same posted market set. The Vegas slot maps that production rank onto the current {adpPlatformLabel(adpPlatform)} ADP curve.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <MispricingList
          title="Vegas value targets"
          description="Drafted later than their sportsbook production slot."
          items={values}
          value
          scoring={scoring}
          onCompare={onCompare}
        />
        <MispricingList
          title="ADP premiums"
          description="Drafted earlier than their sportsbook production slot."
          items={premiums}
          value={false}
          scoring={scoring}
          onCompare={onCompare}
        />
      </div>
    </section>
  );
}

const DRAFT_POSITIONS: LivePosition[] = ["QB", "RB", "WR", "TE"];

function DraftAssistant({
  players,
  scoring,
  adpPlatform,
  onCompare,
}: {
  players: PlayerProjection[];
  scoring: LiveScoringSystem;
  adpPlatform: AdpPlatform;
  onCompare: (left: PlayerProjection, right: PlayerProjection) => void;
}) {
  const [currentPick, setCurrentPick] = useState(1);
  const [needs, setNeeds] = useState<LivePosition[]>(["QB", "RB", "WR", "TE"]);
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("edgeboard-draft-plan-v1");
        if (!stored) return;
        const parsed = JSON.parse(stored) as {
          currentPick?: number;
          needs?: LivePosition[];
        };
        if (parsed.currentPick) setCurrentPick(parsed.currentPick);
        if (parsed.needs?.length) setNeeds(parsed.needs);
      } catch {
        // Defaults remain available when browser storage is unavailable.
      } finally {
        setPlanLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!planLoaded) return;
    try {
      window.localStorage.setItem(
        "edgeboard-draft-plan-v1",
        JSON.stringify({ currentPick, needs }),
      );
    } catch {
      // The assistant still works for the current session.
    }
  }, [currentPick, needs, planLoaded]);

  const mispricings = useMemo(
    () => calculateAdpMispricings(players, scoring, adpPlatform),
    [adpPlatform, players, scoring],
  );
  const mispricingByPlayer = new Map(
    mispricings.map((item) => [playerKey(item.player), item]),
  );
  const recommendations = players
    .flatMap((player) => {
      const adp = adpFor(player, scoring, adpPlatform);
      if (
        adp === null ||
        !needs.includes(player.player.position) ||
        adp < currentPick - 8 ||
        adp > currentPick + 30 ||
        player.bookCount < 2
      ) {
        return [];
      }
      return [{ player, adp, value: mispricingByPlayer.get(playerKey(player)) }];
    })
    .sort(
      (left, right) =>
        (right.value?.pickGap ?? 0) - (left.value?.pickGap ?? 0) ||
        Math.abs(left.adp - currentPick) - Math.abs(right.adp - currentPick),
    )
    .slice(0, 6);

  const toggleNeed = (position: LivePosition) => {
    setNeeds((current) =>
      current.includes(position)
        ? current.filter((value) => value !== position)
        : DRAFT_POSITIONS.filter(
            (value) => value === position || current.includes(value),
          ),
    );
  };

  return (
    <section className="mt-10 overflow-hidden rounded-xl border border-[#d2cdc2] bg-[#fbfaf6]">
      <div className="grid gap-6 border-b border-[#d2cdc2] bg-[#e9e5dc] px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-end sm:px-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#a9492e]">
            Draft room assistant
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#16231d]">
            Plan the next pick before the value window closes
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#707a74]">
            Set the current overall pick and the positions your roster needs. Recommendations favor Vegas values expected to go within the next 30 picks.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#717b75]">
              Current overall pick
            </span>
            <input
              type="number"
              min={1}
              max={240}
              value={currentPick}
              onChange={(event) =>
                setCurrentPick(
                  Math.min(240, Math.max(1, Number(event.target.value) || 1)),
                )
              }
              className="h-10 w-24 rounded-md border border-[#bfb9ae] bg-white px-3 font-mono text-sm font-semibold text-[#24312a] outline-none focus:border-[#8f4029]"
            />
          </label>
          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#717b75]">
              Roster priorities
            </div>
            <div className="flex gap-1.5">
              {DRAFT_POSITIONS.map((position) => (
                <button
                  key={position}
                  type="button"
                  aria-pressed={needs.includes(position)}
                  onClick={() => toggleNeed(position)}
                  className={`h-10 min-w-11 rounded-md border px-2 text-xs font-bold transition ${
                    needs.includes(position)
                      ? "border-[#315c46] bg-[#315c46] text-white"
                      : "border-[#c6c0b6] bg-white text-[#7b847f]"
                  }`}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          {recommendations.map(({ player, adp, value }, index) => {
            const urgency =
              adp <= currentPick + 3
                ? "Available now"
                : adp <= currentPick + 12
                  ? "This round"
                  : "Next two rounds";
            return (
              <article
                key={playerKey(player)}
                className="border-b border-[#ded9cf] p-5 sm:border-r xl:[&:nth-child(3n)]:border-r-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerHeadshot player={player.player} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#19261f]">
                        {player.player.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#747d78]">
                        {player.player.position} · {player.player.team ?? "Team pending"}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[#8a918d]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#e2ded5] py-3 text-center">
                  <div>
                    <div className="font-mono text-lg font-semibold text-[#25352d]">
                      {formatAdp(adp)}
                    </div>
                    <div className="text-[8px] uppercase tracking-[0.06em] text-[#858d88]">ADP</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg font-semibold text-[#a9492e]">
                      {player.points[scoring].toFixed(1)}
                    </div>
                    <div className="text-[8px] uppercase tracking-[0.06em] text-[#858d88]">Points</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg font-semibold text-[#2e674a]">
                      {value?.pickGap ? `+${value.pickGap.toFixed(0)}` : "—"}
                    </div>
                    <div className="text-[8px] uppercase tracking-[0.06em] text-[#858d88]">Value picks</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a756f]">
                    {urgency}
                  </span>
                  {value && (
                    <button
                      type="button"
                      onClick={() => onCompare(player, value.benchmark)}
                      className="text-[9px] font-bold uppercase tracking-[0.07em] text-[#8f4029] hover:text-[#642b1d]"
                    >
                      Compare value
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-10 text-center text-sm text-[#747d78]">
          Select at least one roster priority or move the current pick closer to active ADP ranges.
        </div>
      )}
    </section>
  );
}

interface BookDisagreement {
  player: PlayerProjection;
  component: ConsensusComponent;
  spread: number;
  spreadPercent: number;
  lowBooks: string;
  highBooks: string;
}

function calculateBookDisagreements(
  players: PlayerProjection[],
): BookDisagreement[] {
  return players
    .flatMap((player) =>
      player.components.flatMap((component) => {
        if (component.quotes.length < 2 || component.high === component.low) {
          return [];
        }
        const spread = component.high - component.low;
        return [
          {
            player,
            component,
            spread,
            spreadPercent: spread / Math.max(Math.abs(component.line), 1),
            lowBooks: component.quotes
              .filter((quote) => quote.line === component.low)
              .map((quote) => quote.book.name)
              .join(", "),
            highBooks: component.quotes
              .filter((quote) => quote.line === component.high)
              .map((quote) => quote.book.name)
              .join(", "),
          },
        ];
      }),
    )
    .sort(
      (left, right) =>
        right.spreadPercent - left.spreadPercent || right.spread - left.spread,
    );
}

function MovementEvent({ event }: { event: LineHistoryEvent }) {
  const verb =
    event.kind === "moved"
      ? `${formatNumber(event.from as number)} → ${formatNumber(event.to as number)}`
      : event.kind === "posted"
        ? `posted at ${formatNumber(event.to as number)}`
        : `removed from ${formatNumber(event.from as number)}`;
  return (
    <div className="border-b border-[#e0dcd3] px-4 py-3 last:border-0 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-[#26332d]">
            {event.playerName} · {MARKET_SHORT_LABELS[event.market]}
          </div>
          <div className="mt-1 text-[10px] text-[#717b75]">
            {event.bookName} {verb}
          </div>
        </div>
        <div className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.07em] text-[#9b4a32]">
          {event.kind}
        </div>
      </div>
    </div>
  );
}

function MarketIntelligence({
  players,
  history,
  enabledBookKeys,
  persistentHistory,
}: {
  players: PlayerProjection[];
  history: LineHistoryState | null;
  enabledBookKeys: readonly string[];
  persistentHistory: boolean;
}) {
  const enabled = new Set(enabledBookKeys);
  const events = (history?.events ?? [])
    .filter((event) => enabled.has(event.bookKey))
    .slice(-7)
    .reverse();
  const movedLines = Object.values(history?.lines ?? {})
    .filter(
      (line) =>
        line.active &&
        enabled.has(line.bookKey) &&
        line.current !== line.opening,
    )
    .sort((left, right) =>
      (right.lastMovedAt ?? "").localeCompare(left.lastMovedAt ?? ""),
    );
  const disagreements = calculateBookDisagreements(players).slice(0, 7);

  return (
    <section className="mt-10">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#a9492e]">
          Market movement & alerts
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#16231d]">
          What changed—and where books disagree
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[#707a74]">
          {persistentHistory
            ? "Always-on capture records book-level changes even when the site is closed. Disagreement alerts use the active sportsbooks."
            : "Movement tracking starts when this browser first sees a line. Disagreement alerts are available immediately from the active sportsbooks."}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[#d3cec3] bg-[#fbfaf6]">
          <div className="flex items-center justify-between border-b border-[#d3cec3] bg-[#eee8df] px-4 py-4 sm:px-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5b6961]">
                Line movement
              </div>
              <div className="mt-1 text-xs text-[#747d78]">
                {movedLines.length} active lines differ from their opening capture
              </div>
            </div>
            {history && (
              <div className="text-right text-[9px] text-[#858d88]">
                Tracking since
                <br />
                {new Date(history.startedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          {events.length > 0 ? (
            events.map((event) => <MovementEvent key={event.id} event={event} />)
          ) : (
            <div className="px-5 py-9 text-center text-xs leading-5 text-[#7a837e]">
              Baseline captured. New posts, removals, and line changes will appear here automatically.
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#d3cec3] bg-[#fbfaf6]">
          <div className="border-b border-[#d3cec3] bg-[#e5eee7] px-4 py-4 sm:px-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#2e674a]">
              Book disagreement
            </div>
            <div className="mt-1 text-xs text-[#747d78]">
              Largest line ranges across active sportsbooks
            </div>
          </div>
          {disagreements.length > 0 ? (
            <div className="divide-y divide-[#e0dcd3]">
              {disagreements.map((item) => (
                <div
                  key={`${playerKey(item.player)}:${item.component.market}`}
                  className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[#26332d]">
                      {item.player.player.name} · {item.component.label}
                    </div>
                    <div className="mt-1 text-[10px] text-[#717b75]">
                      {formatNumber(item.component.low)} at {item.lowBooks} · {formatNumber(item.component.high)} at {item.highBooks}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-[#9b4a32]">
                      {formatNumber(item.spread)}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.07em] text-[#858d88]">
                      line gap
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-9 text-center text-xs text-[#7a837e]">
              No multi-book line disagreements are available.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DataDepth({ player }: { player: PlayerProjection }) {
  return (
    <div
      className="min-w-32"
      title="Data depth reflects the share of expected fantasy markets posted and the number of contributing sportsbooks. It is not a prediction confidence score."
    >
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="font-semibold text-[#36423c]">{player.coverage}% covered</span>
        <span className="text-[#7c8580]">
          {player.bookCount} {player.bookCount === 1 ? "book" : "books"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-[#e1ddd4]">
        <div
          className="h-full bg-[#526d5e]"
          style={{ width: `${player.coverage}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] text-[#89908c]">
        {player.components.length} posted {player.components.length === 1 ? "market" : "markets"}
      </div>
    </div>
  );
}

function PlayerBoard({
  players,
  scoring,
  mode,
  expandedId,
  setExpandedId,
  compareIds,
  toggleCompare,
}: {
  players: PlayerProjection[];
  scoring: LiveScoringSystem;
  mode: BoardMode;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  compareIds: [string | null, string | null];
  toggleCompare: (id: string) => void;
}) {
  const maxPoints = Math.max(...players.map((player) => player.points[scoring]), 1);

  return (
    <div className="overflow-hidden border border-[#d2cdc2] bg-[#fbfaf6] shadow-[0_8px_30px_rgba(35,44,38,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <colgroup>
            <col className="w-16" />
            <col />
            {mode === "weekly" && <col className="w-40" />}
            <col className="w-52" />
            {mode === "draft" && <col className="w-28" />}
            <col className="w-48" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="border-b border-[#d8d3c8] bg-[#e9e5dc] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#68716c]">
              <th className="px-5 py-3 text-center">{mode === "draft" ? "Order" : "Rank"}</th>
              <th className="px-3 py-3">Player</th>
              {mode === "weekly" && <th className="px-3 py-3">Matchup</th>}
              <th className="px-3 py-3">
                {mode === "draft" ? "Posted Vegas production" : "Points from posted props"}
              </th>
              {mode === "draft" && <th className="px-3 py-3">ADP</th>}
              <th
                className="px-3 py-3"
                title="Market coverage and sportsbook count—not prediction certainty."
              >
                Data depth ⓘ
              </th>
              <th className="px-5 py-3 text-right">Compare</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const id = playerKey(player);
              const expanded = expandedId === id;
              const compareSlot = compareIds[0] === id ? "A" : compareIds[1] === id ? "B" : null;
              const width = Math.max(4, (player.points[scoring] / maxPoints) * 100);

              return (
                <Fragment key={id}>
                  <tr
                    className={`group cursor-pointer border-b border-[#e2ded5] transition hover:bg-[#f2efe8] ${expanded ? "bg-[#eeeae1]" : ""}`}
                    onClick={() => setExpandedId(expanded ? null : id)}
                  >
                    <td className="px-5 py-4 text-center font-mono text-xs text-[#737d77]">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <PlayerHeadshot player={player.player} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1b2822]">
                            {player.player.name}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-[#78817c]">
                            {player.player.position} · {player.player.team ?? "Team pending"} ·{" "}
                            {player.components.map((component) => component.label).join(", ")}
                          </div>
                        </div>
                      </div>
                    </td>
                    {mode === "weekly" && (
                      <td className="px-3 py-4 text-xs text-[#616c66]">
                        {player.player.opponent ?? player.week ?? formatKickoff(player.kickoff)}
                      </td>
                    )}
                    <td className="px-3 py-4">
                      {mode === "draft" ? (
                        <PostedLines player={player} limit={2} />
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-mono text-lg font-semibold text-[#a63f24]">
                              {player.points[scoring].toFixed(1)}
                            </span>
                            <span className="text-[10px] text-[#7b847f]">
                              #{player.rank[scoring]} {player.player.position}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 bg-[#ebe7df]">
                            <div className="h-full bg-[#d76442]" style={{ width: `${width}%` }} />
                          </div>
                        </>
                      )}
                    </td>
                    {mode === "draft" && (
                      <td className="px-3 py-4">
                        {adpFor(player, scoring) !== null ? (
                          <>
                            <div className="font-mono text-lg font-semibold text-[#24322b]">
                              {formatAdp(adpFor(player, scoring))}
                            </div>
                            <div className="mt-0.5 text-[9px] uppercase tracking-[0.07em] text-[#7b847f]">
                              Round {formatRoundPick(adpFor(player, scoring) as number)}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-[#929894]">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-4">
                      <DataDepth player={player} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleCompare(id);
                        }}
                        className={`inline-flex min-w-20 items-center justify-center gap-2 border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${compareSlot ? "border-[#b94f30] bg-[#b94f30] text-white" : "border-[#bcb7ad] bg-transparent text-[#59635d] hover:border-[#735f53] hover:text-[#25312b]"}`}
                        aria-label={
                          compareSlot
                            ? `Remove ${player.player.name} from comparison`
                            : `Add ${player.player.name} to comparison`
                        }
                      >
                        {compareSlot ? <Icon name="check" className="h-3.5 w-3.5" /> : <Icon name="compare" className="h-3.5 w-3.5" />}
                        {compareSlot ? `Player ${compareSlot}` : "Compare"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <PlayerDetail player={player} scoring={scoring} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ServerHistoryPayload {
  configured: boolean;
  startedAt: string | null;
  capturedAt: string | null;
  lines: Array<{
    line_key: string;
    entity_id: string;
    entity_name: string;
    position: LivePosition;
    team: string | null;
    market: LiveMarket;
    book_key: string;
    book_name: string;
    opening_line: number;
    line: number;
    active: boolean;
    first_seen_at: string;
    last_seen_at: string;
    last_moved_at: string | null;
  }>;
  events: Array<{
    id: number;
    change_kind: "posted" | "moved" | "repriced" | "removed";
    captured_at: string;
    line_key: string;
    entity_id: string;
    entity_name: string;
    market: LiveMarket;
    book_key: string;
    book_name: string;
    previous_line: number | null;
    line: number | null;
  }>;
}

function serverHistoryState(
  mode: BoardMode,
  payload: ServerHistoryPayload,
): LineHistoryState | null {
  if (!payload.startedAt || !payload.capturedAt) return null;
  const lines: LineHistoryState["lines"] = {};
  for (const line of payload.lines) {
    lines[line.line_key] = {
      key: line.line_key,
      playerId: line.entity_id,
      playerName: line.entity_name,
      position: line.position,
      team: line.team ?? undefined,
      market: line.market,
      bookKey: line.book_key,
      bookName: line.book_name,
      opening: Number(line.opening_line),
      current: Number(line.line),
      active: line.active,
      firstSeenAt: line.first_seen_at,
      lastSeenAt: line.last_seen_at,
      lastMovedAt: line.last_moved_at ?? undefined,
    };
  }
  const events = payload.events
    .filter((event) => event.change_kind !== "repriced")
    .map((event) => ({
      id: `server:${event.id}`,
      kind: event.change_kind as LineHistoryEvent["kind"],
      timestamp: event.captured_at,
      lineKey: event.line_key,
      playerId: event.entity_id,
      playerName: event.entity_name,
      market: event.market,
      bookKey: event.book_key,
      bookName: event.book_name,
      from: event.previous_line === null ? null : Number(event.previous_line),
      to: event.line === null ? null : Number(event.line),
    }))
    .reverse();
  return {
    version: 1,
    mode,
    startedAt: payload.startedAt,
    capturedAt: payload.capturedAt,
    lines,
    events,
  };
}

export function OddsDashboard() {
  const [mode, setMode] = useState<BoardMode>("draft");
  const [scoring, setScoring] = useState<LiveScoringSystem>("ppr");
  const [adpPlatform, setAdpPlatform] = useState<AdpPlatform>("consensus");
  const [draftWorkspace, setDraftWorkspace] =
    useState<DraftWorkspace>("compare");
  const [position, setPosition] = useState<LivePosition | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [dataByMode, setDataByMode] = useState<
    Partial<Record<BoardMode, DashboardResponse>>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<
    [string | null, string | null]
  >([null, null]);
  const [enabledBooksByMode, setEnabledBooksByMode] = useState<
    Partial<Record<BoardMode, string[]>>
  >({});
  const [historyByMode, setHistoryByMode] = useState<
    Partial<Record<BoardMode, LineHistoryState>>
  >({});
  const [persistentHistoryByMode, setPersistentHistoryByMode] = useState<
    Partial<Record<BoardMode, boolean>>
  >({});
  const rawData = dataByMode[mode] ?? null;
  const allBookKeys = useMemo(
    () => rawData?.books.map((book) => book.key) ?? [],
    [rawData],
  );
  const enabledBookKeys = useMemo(() => {
    const selected = enabledBooksByMode[mode];
    if (!selected) return allBookKeys;
    const selectedSet = new Set(selected);
    return allBookKeys.filter((bookKey) => selectedSet.has(bookKey));
  }, [allBookKeys, enabledBooksByMode, mode]);
  const data = useMemo(
    () =>
      rawData
        ? filterDashboardByBooks(rawData, enabledBookKeys)
        : null,
    [enabledBookKeys, rawData],
  );
  const availableAdpPlatforms = useMemo(
    () =>
      data?.adpContext?.platforms.filter(
        (platform) => (platform.playerCounts[scoring] ?? 0) > 0,
      ) ?? [],
    [data?.adpContext?.platforms, scoring],
  );
  const activeAdpPlatform = availableAdpPlatforms.some(
    (platform) => platform.key === adpPlatform,
  )
    ? adpPlatform
    : (availableAdpPlatforms[0]?.key ?? "consensus");
  const activeAdpContext = data?.adpContext?.platforms.find(
    (platform) => platform.key === activeAdpPlatform,
  );
  const comparisonPlayers = useMemo(() => {
    const activePlayers = new Map(
      (data?.players ?? []).map((player) => [playerKey(player), player]),
    );

    return (rawData?.players ?? []).map((original) => {
      const active = activePlayers.get(playerKey(original));
      if (active) return active;

      return {
        ...original,
        points: { ppr: 0, half_ppr: 0, standard: 0 },
        rank: { ppr: 0, half_ppr: 0, standard: 0 },
        components: [],
        coverage: 0,
        confidence: "Low" as const,
        bookCount: 0,
      };
    });
  }, [data?.players, rawData?.players]);

  const load = useCallback(async (targetMode: BoardMode, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/odds?mode=${targetMode}${force ? `&refresh=${Date.now()}` : ""}`,
      );
      if (!response.ok) throw new Error(`Live feed returned ${response.status}`);
      const payload = (await response.json()) as DashboardResponse;
      setDataByMode((current) => ({ ...current, [targetMode]: payload }));
      if (targetMode === mode) {
        setCompareIds((current) => fillComparison(payload.players, current));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reach the live feed.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (dataByMode[mode]) return;
    const timer = window.setTimeout(() => void load(mode), 0);
    return () => window.clearTimeout(timer);
  }, [dataByMode, load, mode]);

  useEffect(() => {
    if (!data || data.status === "unconfigured") return;
    const timer = window.setInterval(
      () => void load(mode),
      Math.max(60, data.refreshAfterSeconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [data, load, mode]);

  useEffect(() => {
    if (!rawData || rawData.players.length === 0) return;
    const storageKey = `edgeboard-line-history-v1:${mode}`;
    let previous: LineHistoryState | null = null;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) previous = JSON.parse(stored) as LineHistoryState;
    } catch {
      previous = null;
    }
    const next = captureLineHistory(rawData, previous);
    const timer = window.setTimeout(
      () => setHistoryByMode((current) => ({ ...current, [mode]: next })),
      0,
    );
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // History still works for this session if browser storage is unavailable.
    }
    return () => window.clearTimeout(timer);
  }, [mode, rawData]);

  useEffect(() => {
    if (!rawData) return;
    const controller = new AbortController();
    void fetch(`/api/history?mode=${mode}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ServerHistoryPayload;
      })
      .then((payload) => {
        if (!payload?.configured) return;
        setPersistentHistoryByMode((current) => ({ ...current, [mode]: true }));
        const stored = serverHistoryState(mode, payload);
        if (stored) {
          setHistoryByMode((current) => ({ ...current, [mode]: stored }));
        }
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [mode, rawData]);

  const selectMode = (nextMode: BoardMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setExpandedId(null);
    setCompareIds(
      dataByMode[nextMode]
        ? fillComparison(dataByMode[nextMode].players, [null, null])
        : [null, null],
    );
    setPosition("ALL");
    setQuery("");
  };

  const toggleBook = (bookKey: string) => {
    setEnabledBooksByMode((current) => {
      const selected = current[mode] ?? allBookKeys;
      const next = selected.includes(bookKey)
        ? selected.filter((key) => key !== bookKey)
        : allBookKeys.filter((key) => key === bookKey || selected.includes(key));
      return { ...current, [mode]: next };
    });
  };

  const selectAllBooks = () => {
    setEnabledBooksByMode((current) => ({
      ...current,
      [mode]: allBookKeys,
    }));
  };

  const clearAllBooks = () => {
    setEnabledBooksByMode((current) => ({ ...current, [mode]: [] }));
  };

  const filteredPlayers = useMemo(() => {
    return (data?.players ?? [])
      .filter((player) => position === "ALL" || player.player.position === position)
      .filter((player) => playerMatchesSearch(player, query))
      .sort((a, b) => {
        if (mode === "weekly") return b.points[scoring] - a.points[scoring];
        const leftAdp = adpFor(a, scoring, activeAdpPlatform);
        const rightAdp = adpFor(b, scoring, activeAdpPlatform);
        if (leftAdp === null) return 1;
        if (rightAdp === null) return -1;
        return leftAdp - rightAdp;
      });
  }, [activeAdpPlatform, data?.players, mode, position, query, scoring]);

  const activeCompareIds = compareIds.map(normalizeSelectionKey) as [
    string | null,
    string | null,
  ];
  const comparedPlayers = activeCompareIds.map((id) =>
    id ? data?.players.find((player) => playerKey(player) === id) ?? null : null,
  );

  const selectComparison = (slot: 0 | 1, value: string | null) => {
    setCompareIds((current) => {
      const next = current.map(normalizeSelectionKey) as [
        string | null,
        string | null,
      ];
      const otherSlot = slot === 0 ? 1 : 0;
      if (value && value === next[otherSlot]) {
        next[otherSlot] = next[slot];
      }
      next[slot] = value;
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      const normalized = current.map(normalizeSelectionKey) as [
        string | null,
        string | null,
      ];
      if (normalized[0] === id) return [null, normalized[1]];
      if (normalized[1] === id) return [normalized[0], null];
      if (!normalized[0]) return [id, normalized[1]];
      if (!normalized[1]) return [normalized[0], id];
      return [normalized[1], id];
    });
  };

  const comparePair = (left: PlayerProjection, right: PlayerProjection) => {
    setCompareIds([playerKey(left), playerKey(right)]);
    if (mode === "draft") setDraftWorkspace("compare");
    window.setTimeout(
      () =>
        document
          .getElementById("comparison")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };

  const averageCoverage = data?.players.length
    ? Math.round(
        data.players.reduce((sum, player) => sum + player.coverage, 0) /
          data.players.length,
      )
    : 0;
  const totalQuotes =
    data?.players.reduce(
      (playerTotal, player) =>
        playerTotal +
        player.components.reduce(
          (marketTotal, component) => marketTotal + component.quotes.length,
          0,
        ),
      0,
    ) ?? 0;

  return (
    <main className="min-h-screen bg-[#f2efe8] text-[#18241e]">
      <header className="border-b border-[#d1ccc1] bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[#183226] text-white">
              <Icon name="arrow" className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-[0.1em] text-[#16241d]">
                EDGEBOARD
              </div>
              <div className="text-[9px] font-medium uppercase tracking-[0.13em] text-[#7b837f]">
                Sportsbook fantasy board
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <SourceStatus
              data={rawData}
              activeBooks={enabledBookKeys.length}
            />
            <button
              type="button"
              onClick={() => void load(mode, true)}
              disabled={loading}
              className="flex h-9 items-center gap-2 border border-[#c9c4b9] bg-white px-3 text-xs font-semibold text-[#4d5953] transition hover:border-[#766e64] disabled:opacity-40"
              aria-label="Refresh live odds"
            >
              <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">
        <section className="grid gap-6 border-b border-[#d5d0c5] py-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a9492e]">
              {data?.season ?? new Date().getFullYear()} NFL
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#14221b] sm:text-4xl">
              {mode === "draft" ? "Find the better draft value." : "Make the clearer start / sit call."}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#626d67]">
              {mode === "draft"
                ? "Compare posted Vegas season lines with current ADP to find similar production at a better draft price."
                : "Compare live player props, matchup lines, and market-implied scoring for the week ahead."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex rounded-lg border border-[#bfb9ae] bg-[#e7e2d8] p-1">
              {(["draft", "weekly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => selectMode(option)}
                  className={`rounded-md px-4 py-2 text-xs font-semibold transition ${mode === option ? "bg-[#173027] text-white" : "text-[#606a64] hover:text-[#19251f]"}`}
                >
                  {option === "draft" ? "Predraft" : "In season"}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-[#c5c0b5] bg-[#e8e4dc] p-1">
              {SCORING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScoring(option.value)}
                  className={`rounded-md px-3 py-2 text-[10px] font-semibold transition ${scoring === option.value ? "bg-white text-[#24312a] shadow-sm" : "text-[#6b756f] hover:text-[#24312a]"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {rawData && rawData.books.length > 0 && (
          <BookFilter
            books={rawData.books}
            enabledBookKeys={enabledBookKeys}
            onToggle={toggleBook}
            onSelectAll={selectAllBooks}
            onClear={clearAllBooks}
          />
        )}

        {mode === "draft" && data && data.players.length > 0 && (
          <>
            <DraftWorkspaceNav
              active={draftWorkspace}
              onChange={setDraftWorkspace}
            />
            <AdpPlatformSelector
              context={data.adpContext}
              scoring={scoring}
              value={activeAdpPlatform}
              onChange={setAdpPlatform}
            />
          </>
        )}

        <section className="mt-8">
          {error && (
            <div className="mb-5 border-l-4 border-[#a3412b] bg-[#f2ded7] px-4 py-3 text-sm text-[#7f3020]">
              {error}
            </div>
          )}

          {rawData && rawData.books.length > 0 && enabledBookKeys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cfc9bd] bg-[#f7f4ee] px-6 py-10 text-center">
              <div className="text-sm font-semibold text-[#34413a]">
                Turn on at least one sportsbook to build the board.
              </div>
              <button
                type="button"
                onClick={selectAllBooks}
                className="mt-3 rounded-md border border-[#315c46] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#315c46] transition hover:bg-[#315c46] hover:text-white"
              >
                Use all books
              </button>
            </div>
          ) : loading && !data ? (
            <LoadingBoard />
          ) : data &&
            (rawData?.players.length ?? 0) > 0 &&
            (mode === "weekly" || draftWorkspace === "compare") ? (
            <ComparisonWorkspace
              players={comparisonPlayers}
              scoring={scoring}
              mode={mode}
              adpPlatform={activeAdpPlatform}
              leftId={activeCompareIds[0]}
              rightId={activeCompareIds[1]}
              onSelect={selectComparison}
            />
          ) : data && (rawData?.players.length ?? 0) === 0 ? (
            <ProviderState data={data} />
          ) : null}
        </section>

        {data &&
          data.players.length > 0 &&
          (mode === "weekly" || draftWorkspace === "value") && (
          <MarketIntelligence
            players={data.players}
            history={historyByMode[mode] ?? null}
            enabledBookKeys={enabledBookKeys}
            persistentHistory={persistentHistoryByMode[mode] === true}
          />
        )}

        {mode === "draft" &&
          draftWorkspace === "compare" &&
          data &&
          data.players.length > 0 && (
          <DraftValueTargets
            players={data.players}
            scoring={scoring}
            adpPlatform={activeAdpPlatform}
            anchors={comparedPlayers}
            context={data.adpContext}
            onCompare={comparePair}
          />
        )}

        {mode === "draft" &&
          draftWorkspace === "value" &&
          data &&
          data.players.length > 0 && (
          <VegasAdpMispricing
            players={data.players}
            scoring={scoring}
            adpPlatform={activeAdpPlatform}
            onCompare={comparePair}
          />
        )}

        {mode === "draft" &&
          draftWorkspace === "assistant" &&
          data &&
          data.players.length > 0 && (
          <DraftAssistant
            players={data.players}
            scoring={scoring}
            adpPlatform={activeAdpPlatform}
            onCompare={comparePair}
          />
        )}

        {mode === "weekly" && data && data.games.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5c6d63]">
                  Team environment
                </div>
                <h2 className="mt-1 text-xl font-semibold text-[#16231d]">Games, implied scoring, and player props</h2>
              </div>
              <div className="text-[11px] text-[#747d78]">
                Large numbers are implied team totals
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {data.games.map((game) => (
                <GameCard
                  key={game.eventId}
                  game={game}
                  players={data.players}
                  scoring={scoring}
                />
              ))}
            </div>
          </section>
        )}

        {mode === "weekly" && data && data.players.length > 0 && (
          <section className="mt-10">
            <div className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5c6d63]">
                  Current week
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#16231d]">
                  Start / sit rankings
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-[#737d77]">
                  Points include only the props currently posted. Data depth shows
                  market coverage and book count.
                </p>
              </div>
              <div>
                <div className="relative">
                  <Icon
                    name="search"
                    className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#707a74]"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search player or team"
                    className="h-10 w-56 border border-[#c5c0b5] bg-[#fbfaf6] pl-9 pr-3 text-xs text-[#1e2a24] outline-none placeholder:text-[#8a918d] focus:border-[#765e50]"
                  />
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1 border-b border-[#cfcac0]">
              {POSITION_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPosition(option)}
                  className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${position === option ? "border-[#b84d2d] text-[#983d24]" : "border-transparent text-[#707a74] hover:text-[#26322c]"}`}
                >
                  {option === "ALL" ? "All positions" : option}
                </button>
              ))}
            </div>

            {filteredPlayers.length > 0 ? (
              <PlayerBoard
                players={filteredPlayers}
                scoring={scoring}
                mode={mode}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                compareIds={activeCompareIds}
                toggleCompare={toggleCompare}
              />
            ) : (
              <div className="border border-[#d2cdc2] bg-[#fbfaf6] px-6 py-12 text-center text-sm text-[#747d78]">
                No players match those filters.
              </div>
            )}
          </section>
        )}

        {data && data.players.length > 0 && (
          <section className="mt-10 overflow-hidden rounded-xl border border-[#d2cdc2] bg-[#e9e5dc]">
            <div className="border-b border-[#d2cdc2] px-5 py-4 sm:px-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6d7771]">
                Feed and coverage details
              </div>
              <p className="mt-1 text-xs text-[#6f7973]">
                These describe the amount of posted data behind the board, not the
                certainty of a projection.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-b border-[#d2cdc2] px-5 py-5 sm:border-r lg:border-b-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7b837f]">
                  Players
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold text-[#17241e]">
                  {data.players.length}
                </div>
                <div className="mt-1 text-[10px] text-[#6f7973]">
                  {totalQuotes} posted lines
                </div>
              </div>
              <div className="border-b border-[#d2cdc2] px-5 py-5 lg:border-b-0 lg:border-r">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7b837f]">
                  Sportsbooks
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold text-[#17241e]">
                  {data.books.length}
                </div>
                <div className="mt-1 text-[10px] text-[#6f7973]">
                  {data.books.map((book) => book.name).join(" · ") || "No live books"}
                </div>
              </div>
              <div className="border-b border-[#d2cdc2] px-5 py-5 sm:border-b-0 sm:border-r">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7b837f]">
                  Avg. coverage
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold text-[#17241e]">
                  {averageCoverage}%
                </div>
                <div className="mt-1 text-[10px] text-[#6f7973]">
                  Expected fantasy markets posted
                </div>
              </div>
              <div className="px-5 py-5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7b837f]">
                  Last update
                </div>
                <div className="mt-1 text-xl font-semibold text-[#17241e]">
                  {timeAgo(data.generatedAt)}
                </div>
                <div className="mt-1 text-[10px] text-[#6f7973]">
                  Refreshes every {mode === "draft" ? "30 minutes" : "5 minutes"}
                </div>
              </div>
            </div>
            <div className="border-t border-[#d2cdc2] bg-[#f4f1ea] px-5 py-4 text-[10px] leading-5 text-[#69736d] sm:px-6">
              {data.sources.map((source) => `${source.label}: ${source.detail}`).join(" · ")}
            </div>
          </section>
        )}

        <footer className="mt-10 flex flex-col gap-3 border-t border-[#d1ccc1] pt-5 text-[10px] text-[#747d78] sm:flex-row sm:items-center sm:justify-between">
          <div>
            Sportsbook lines are volatile. Verify any wager directly with the operator. 21+ · Play responsibly.
            {mode === "draft" && (
              <>
                {" "}ADP by{" "}
                <a
                  href={activeAdpContext?.url ?? data?.adpContext?.url ?? "https://fantasyfootballcalculator.com/adp/ppr"}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-[#a8aea9] underline-offset-2 hover:text-[#27332d]"
                >
                  {activeAdpContext?.source ?? "Fantasy Football Calculator"}
                </a>
                .
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Icon name="clock" className="h-3.5 w-3.5" /> Player photos and historical stats via{" "}
            <a
              href="https://docs.sleeper.com/"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[#a8aea9] underline-offset-2 hover:text-[#27332d]"
            >
              Sleeper
            </a>
            .
          </div>
        </footer>
      </div>
    </main>
  );
}
