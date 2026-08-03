export type BoardMode = "draft" | "weekly";

export type LivePosition = "QB" | "RB" | "WR" | "TE" | "FLEX";

export type LiveMarket =
  | "passing_yards"
  | "passing_tds"
  | "interceptions"
  | "rushing_yards"
  | "rushing_tds"
  | "receiving_yards"
  | "receptions"
  | "receiving_tds"
  | "rushing_receiving_yards";

export type LiveScoringSystem = "ppr" | "half_ppr" | "standard";

export interface LiveBook {
  key: string;
  name: string;
}

export interface LivePlayer {
  id: string;
  name: string;
  position: LivePosition;
  team?: string;
  opponent?: string;
  headshotUrl?: string;
}

export interface AdpEntry {
  overall: number;
  formatted?: string;
  timesDrafted?: number;
  high?: number;
  low?: number;
  deviation?: number;
}

export interface AdpContext {
  source: string;
  url: string;
  teams: number;
  updatedAt: string;
  totalDrafts: Partial<Record<LiveScoringSystem, number>>;
}

export interface SportsbookQuote {
  scope: "season" | "game";
  season: number;
  week?: string;
  eventId?: string;
  kickoff?: string;
  player: LivePlayer;
  market: LiveMarket;
  book: LiveBook;
  line: number;
  overOdds: number | null;
  underOdds: number | null;
  updatedAt: string;
  source: string;
}

export interface GameBookLine {
  eventId: string;
  kickoff: string;
  week?: string;
  homeTeam: string;
  awayTeam: string;
  book: LiveBook;
  homeSpread: number | null;
  awaySpread: number | null;
  total: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  updatedAt: string;
  source: string;
}

export interface ProviderResult {
  source: string;
  quotes: SportsbookQuote[];
  games: GameBookLine[];
  warnings: string[];
}

export interface SourceStatus {
  key: string;
  label: string;
  configured: boolean;
  state: "connected" | "empty" | "error" | "not_configured";
  detail: string;
}

export interface ConsensusComponent {
  market: LiveMarket;
  label: string;
  line: number;
  low: number;
  high: number;
  points: Record<LiveScoringSystem, number>;
  quotes: SportsbookQuote[];
}

export interface PlayerProjection {
  player: LivePlayer;
  eventId?: string;
  kickoff?: string;
  week?: string;
  points: Record<LiveScoringSystem, number>;
  rank: Record<LiveScoringSystem, number>;
  components: ConsensusComponent[];
  coverage: number;
  confidence: "High" | "Medium" | "Low";
  bookCount: number;
  updatedAt: string;
  adp?: Partial<Record<LiveScoringSystem, AdpEntry>>;
}

export interface GameSummary {
  eventId: string;
  kickoff: string;
  week?: string;
  homeTeam: string;
  awayTeam: string;
  homeSpread: number | null;
  total: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  homeImpliedTotal: number | null;
  awayImpliedTotal: number | null;
  bookCount: number;
  lines: GameBookLine[];
}

export interface DashboardResponse {
  mode: BoardMode;
  status: "live" | "partial" | "unconfigured" | "unavailable";
  season: number;
  generatedAt: string;
  refreshAfterSeconds: number;
  players: PlayerProjection[];
  games: GameSummary[];
  books: LiveBook[];
  sources: SourceStatus[];
  adpContext?: AdpContext;
  message?: string;
}
