import type { StatMarket } from "../types";

export type ConsensusLines = Partial<Record<StatMarket, number>>;
export type SeasonConsensus = Record<string, ConsensusLines>;

// Sample consensus season-long player props (preseason).
// Numbers are illustrative and meant to demonstrate the UI; swap in a real
// odds provider via lib/providers/odds-api.ts to use live lines.

export const CURRENT_SEASON = 2026;

export const CURRENT_LINES: SeasonConsensus = {
  // QBs
  "josh-allen": { passing_yards: 3950, passing_tds: 30, interceptions: 11.5, rushing_yards: 480, rushing_tds: 9.5 },
  "patrick-mahomes": { passing_yards: 4250, passing_tds: 28.5, interceptions: 9.5, rushing_yards: 280, rushing_tds: 2.5 },
  "lamar-jackson": { passing_yards: 3850, passing_tds: 32.5, interceptions: 7.5, rushing_yards: 825, rushing_tds: 5.5 },
  "jalen-hurts": { passing_yards: 3500, passing_tds: 22.5, interceptions: 8.5, rushing_yards: 650, rushing_tds: 12.5 },
  "joe-burrow": { passing_yards: 4500, passing_tds: 34.5, interceptions: 10.5, rushing_yards: 220, rushing_tds: 2.5 },
  "cj-stroud": { passing_yards: 4050, passing_tds: 24.5, interceptions: 9.5, rushing_yards: 240, rushing_tds: 2.5 },
  "jayden-daniels": { passing_yards: 3700, passing_tds: 24.5, interceptions: 9.5, rushing_yards: 780, rushing_tds: 6.5 },
  "dak-prescott": { passing_yards: 4100, passing_tds: 28.5, interceptions: 10.5, rushing_yards: 130, rushing_tds: 2.5 },
  // RBs
  "christian-mccaffrey": { rushing_yards: 1100, rushing_tds: 8.5, receiving_yards: 480, receptions: 55.5, receiving_tds: 3.5 },
  "saquon-barkley": { rushing_yards: 1525, rushing_tds: 11.5, receiving_yards: 320, receptions: 36.5, receiving_tds: 2.5 },
  "bijan-robinson": { rushing_yards: 1380, rushing_tds: 11.5, receiving_yards: 470, receptions: 58.5, receiving_tds: 2.5 },
  "jahmyr-gibbs": { rushing_yards: 1300, rushing_tds: 12.5, receiving_yards: 480, receptions: 50.5, receiving_tds: 3.5 },
  "derrick-henry": { rushing_yards: 1525, rushing_tds: 13.5, receiving_yards: 175, receptions: 18.5, receiving_tds: 1.5 },
  "jonathan-taylor": { rushing_yards: 1280, rushing_tds: 9.5, receiving_yards: 180, receptions: 22.5, receiving_tds: 1.5 },
  "breece-hall": { rushing_yards: 950, rushing_tds: 6.5, receiving_yards: 440, receptions: 52.5, receiving_tds: 2.5 },
  "kyren-williams": { rushing_yards: 1175, rushing_tds: 11.5, receiving_yards: 200, receptions: 30.5, receiving_tds: 1.5 },
  "de-von-achane": { rushing_yards: 875, rushing_tds: 6.5, receiving_yards: 560, receptions: 70.5, receiving_tds: 4.5 },
  // WRs
  "ja-marr-chase": { receiving_yards: 1525, receptions: 105.5, receiving_tds: 11.5, rushing_yards: 25, rushing_tds: 0.5 },
  "justin-jefferson": { receiving_yards: 1525, receptions: 100.5, receiving_tds: 9.5 },
  "ceedee-lamb": { receiving_yards: 1380, receptions: 100.5, receiving_tds: 8.5 },
  "amon-ra-st-brown": { receiving_yards: 1280, receptions: 110.5, receiving_tds: 9.5 },
  "puka-nacua": { receiving_yards: 1175, receptions: 90.5, receiving_tds: 6.5 },
  "tyreek-hill": { receiving_yards: 1180, receptions: 86.5, receiving_tds: 7.5 },
  "aj-brown": { receiving_yards: 1180, receptions: 75.5, receiving_tds: 8.5 },
  "garrett-wilson": { receiving_yards: 1080, receptions: 95.5, receiving_tds: 6.5 },
  "drake-london": { receiving_yards: 1180, receptions: 92.5, receiving_tds: 8.5 },
  "malik-nabers": { receiving_yards: 1200, receptions: 100.5, receiving_tds: 7.5 },
  "nico-collins": { receiving_yards: 1175, receptions: 75.5, receiving_tds: 7.5 },
  // TEs
  "travis-kelce": { receiving_yards: 800, receptions: 80.5, receiving_tds: 5.5 },
  "sam-laporta": { receiving_yards: 800, receptions: 70.5, receiving_tds: 6.5 },
  "trey-mcbride": { receiving_yards: 1000, receptions: 95.5, receiving_tds: 5.5 },
  "brock-bowers": { receiving_yards: 1080, receptions: 95.5, receiving_tds: 6.5 },
  "george-kittle": { receiving_yards: 920, receptions: 65.5, receiving_tds: 6.5 },
};

// 2025 preseason lines sourced from published sportsbook markets (mostly
// DraftKings via DK Network / RotoWire futures pages, Aug 2025; WR/TE lines
// from lasvegassportsbetting.com's 2025-26 season props pages, cross-checked
// against BetMGM/FanDuel/PFF/Fantasy Points articles). Only markets that were
// actually offered and findable are included — books did not hang season-long
// interception, receptions, or RB receiving markets, so those are absent, and
// Kyren Williams / De'Von Achane had no findable season markets at all.
export const HISTORICAL_LINES_2025: SeasonConsensus = {
  "josh-allen": { passing_yards: 3750.5, passing_tds: 27.5, rushing_yards: 500.5, rushing_tds: 10.5 },
  "patrick-mahomes": { passing_yards: 4050.5, passing_tds: 27.5 },
  "lamar-jackson": { passing_yards: 3500.5, passing_tds: 28.5, rushing_yards: 750.5 },
  "jalen-hurts": { passing_yards: 3200.5, passing_tds: 19.5, rushing_yards: 600.5, rushing_tds: 12.5 },
  "joe-burrow": { passing_yards: 4150.5, passing_tds: 33.5 },
  "cj-stroud": { passing_yards: 3800.5, passing_tds: 21.5 },
  "jayden-daniels": { passing_yards: 3450.5, passing_tds: 23.5, rushing_yards: 675.5, rushing_tds: 5.5 },
  "dak-prescott": { passing_yards: 3850.5, passing_tds: 26.5 },
  "christian-mccaffrey": { rushing_yards: 950.5, rushing_tds: 7.5 },
  "saquon-barkley": { rushing_yards: 1500.5 },
  "bijan-robinson": { rushing_yards: 1150.5, rushing_tds: 10.5 },
  "jahmyr-gibbs": { rushing_yards: 1050.5 },
  "derrick-henry": { rushing_yards: 1375.5, rushing_tds: 12.5 },
  "jonathan-taylor": { rushing_yards: 1200.5 },
  "breece-hall": { rushing_yards: 900.5, rushing_tds: 5.5 },
  "ja-marr-chase": { receiving_yards: 1325.5, receiving_tds: 11.5 },
  "justin-jefferson": { receiving_yards: 1275.5, receiving_tds: 9.5 },
  "ceedee-lamb": { receiving_yards: 1200.5, receiving_tds: 7.5 },
  "amon-ra-st-brown": { receiving_yards: 1075.5, receiving_tds: 8.5 },
  "puka-nacua": { receiving_yards: 1200.5, receiving_tds: 5.5 },
  "tyreek-hill": { receiving_yards: 975.5, receiving_tds: 6.5 },
  "aj-brown": { receiving_yards: 1100.5, receiving_tds: 7.5 },
  "garrett-wilson": { receiving_yards: 950.5, receiving_tds: 4.5 },
  "drake-london": { receiving_yards: 1075.5, receiving_tds: 7.5 },
  "malik-nabers": { receiving_yards: 1150.5, receiving_tds: 7.5 },
  "nico-collins": { receiving_yards: 1150.5, receiving_tds: 7.5 },
  "travis-kelce": { receiving_yards: 675.5 },
  "sam-laporta": { receiving_yards: 700.5, receiving_tds: 6.5 },
  "trey-mcbride": { receiving_yards: 925.5, receiving_tds: 4.5 },
  "brock-bowers": { receiving_yards: 1050.5, receiving_tds: 4.5 },
  "george-kittle": { receiving_yards: 925.5, receiving_tds: 6.5 },
};

export const HISTORICAL_LINES_2024: SeasonConsensus = {
  "josh-allen": { passing_yards: 3950, passing_tds: 28.5, interceptions: 13.5, rushing_yards: 540, rushing_tds: 8.5 },
  "patrick-mahomes": { passing_yards: 4400, passing_tds: 30.5, interceptions: 11.5, rushing_yards: 320, rushing_tds: 2.5 },
  "lamar-jackson": { passing_yards: 3600, passing_tds: 24.5, interceptions: 8.5, rushing_yards: 875, rushing_tds: 5.5 },
  "jalen-hurts": { passing_yards: 3700, passing_tds: 22.5, interceptions: 12.5, rushing_yards: 720, rushing_tds: 14.5 },
  "joe-burrow": { passing_yards: 4250, passing_tds: 31.5, interceptions: 11.5, rushing_yards: 240, rushing_tds: 2.5 },
  "cj-stroud": { passing_yards: 4150, passing_tds: 27.5, interceptions: 9.5, rushing_yards: 260, rushing_tds: 3.5 },
  "jayden-daniels": { passing_yards: 3300, passing_tds: 18.5, interceptions: 10.5, rushing_yards: 660, rushing_tds: 6.5 },
  "dak-prescott": { passing_yards: 4400, passing_tds: 30.5, interceptions: 11.5, rushing_yards: 140, rushing_tds: 2.5 },
  "christian-mccaffrey": { rushing_yards: 1400, rushing_tds: 13.5, receiving_yards: 555, receptions: 65.5, receiving_tds: 4.5 },
  "saquon-barkley": { rushing_yards: 1180, rushing_tds: 8.5, receiving_yards: 320, receptions: 41.5, receiving_tds: 2.5 },
  "bijan-robinson": { rushing_yards: 1175, rushing_tds: 8.5, receiving_yards: 525, receptions: 58.5, receiving_tds: 3.5 },
  "jahmyr-gibbs": { rushing_yards: 1075, rushing_tds: 8.5, receiving_yards: 425, receptions: 50.5, receiving_tds: 2.5 },
  "derrick-henry": { rushing_yards: 1180, rushing_tds: 11.5, receiving_yards: 220, receptions: 22.5, receiving_tds: 1.5 },
  "jonathan-taylor": { rushing_yards: 1075, rushing_tds: 8.5, receiving_yards: 220, receptions: 26.5, receiving_tds: 1.5 },
  "breece-hall": { rushing_yards: 1175, rushing_tds: 8.5, receiving_yards: 525, receptions: 65.5, receiving_tds: 3.5 },
  "kyren-williams": { rushing_yards: 1080, rushing_tds: 11.5, receiving_yards: 280, receptions: 38.5, receiving_tds: 2.5 },
  "de-von-achane": { rushing_yards: 925, rushing_tds: 6.5, receiving_yards: 425, receptions: 55.5, receiving_tds: 3.5 },
  "ja-marr-chase": { receiving_yards: 1300, receptions: 92.5, receiving_tds: 8.5 },
  "justin-jefferson": { receiving_yards: 1425, receptions: 92.5, receiving_tds: 8.5 },
  "ceedee-lamb": { receiving_yards: 1525, receptions: 117.5, receiving_tds: 10.5 },
  "amon-ra-st-brown": { receiving_yards: 1300, receptions: 105.5, receiving_tds: 9.5 },
  "puka-nacua": { receiving_yards: 1180, receptions: 88.5, receiving_tds: 6.5 },
  "tyreek-hill": { receiving_yards: 1525, receptions: 102.5, receiving_tds: 10.5 },
  "aj-brown": { receiving_yards: 1280, receptions: 90.5, receiving_tds: 8.5 },
  "garrett-wilson": { receiving_yards: 1080, receptions: 92.5, receiving_tds: 5.5 },
  "drake-london": { receiving_yards: 1080, receptions: 80.5, receiving_tds: 5.5 },
  "malik-nabers": { receiving_yards: 925, receptions: 75.5, receiving_tds: 5.5 },
  "nico-collins": { receiving_yards: 1080, receptions: 75.5, receiving_tds: 6.5 },
  "travis-kelce": { receiving_yards: 925, receptions: 86.5, receiving_tds: 6.5 },
  "sam-laporta": { receiving_yards: 825, receptions: 72.5, receiving_tds: 7.5 },
  "trey-mcbride": { receiving_yards: 800, receptions: 80.5, receiving_tds: 4.5 },
  "brock-bowers": { receiving_yards: 700, receptions: 60.5, receiving_tds: 4.5 },
  "george-kittle": { receiving_yards: 825, receptions: 65.5, receiving_tds: 6.5 },
};

export const HISTORICAL_LINES_2023: SeasonConsensus = {
  "josh-allen": { passing_yards: 4250, passing_tds: 32.5, interceptions: 13.5, rushing_yards: 560, rushing_tds: 7.5 },
  "patrick-mahomes": { passing_yards: 4625, passing_tds: 35.5, interceptions: 11.5, rushing_yards: 340, rushing_tds: 3.5 },
  "lamar-jackson": { passing_yards: 3300, passing_tds: 22.5, interceptions: 8.5, rushing_yards: 760, rushing_tds: 5.5 },
  "jalen-hurts": { passing_yards: 3700, passing_tds: 24.5, interceptions: 9.5, rushing_yards: 700, rushing_tds: 13.5 },
  "joe-burrow": { passing_yards: 4400, passing_tds: 31.5, interceptions: 10.5, rushing_yards: 200, rushing_tds: 3.5 },
  "cj-stroud": { passing_yards: 3100, passing_tds: 16.5, interceptions: 12.5, rushing_yards: 180, rushing_tds: 1.5 },
  "dak-prescott": { passing_yards: 4250, passing_tds: 27.5, interceptions: 12.5, rushing_yards: 130, rushing_tds: 2.5 },
  "christian-mccaffrey": { rushing_yards: 1380, rushing_tds: 11.5, receiving_yards: 580, receptions: 71.5, receiving_tds: 5.5 },
  "saquon-barkley": { rushing_yards: 1180, rushing_tds: 7.5, receiving_yards: 380, receptions: 50.5, receiving_tds: 2.5 },
  "bijan-robinson": { rushing_yards: 1080, rushing_tds: 8.5, receiving_yards: 525, receptions: 60.5, receiving_tds: 3.5 },
  "jahmyr-gibbs": { rushing_yards: 800, rushing_tds: 6.5, receiving_yards: 425, receptions: 45.5, receiving_tds: 2.5 },
  "derrick-henry": { rushing_yards: 1080, rushing_tds: 10.5, receiving_yards: 240, receptions: 24.5, receiving_tds: 1.5 },
  "jonathan-taylor": { rushing_yards: 1075, rushing_tds: 8.5, receiving_yards: 220, receptions: 24.5, receiving_tds: 1.5 },
  "breece-hall": { rushing_yards: 1080, rushing_tds: 7.5, receiving_yards: 425, receptions: 52.5, receiving_tds: 2.5 },
  "kyren-williams": { rushing_yards: 700, rushing_tds: 5.5, receiving_yards: 240, receptions: 28.5, receiving_tds: 1.5 },
  "de-von-achane": { rushing_yards: 525, rushing_tds: 4.5, receiving_yards: 220, receptions: 25.5, receiving_tds: 1.5 },
  "ja-marr-chase": { receiving_yards: 1280, receptions: 92.5, receiving_tds: 9.5 },
  "justin-jefferson": { receiving_yards: 1525, receptions: 105.5, receiving_tds: 8.5 },
  "ceedee-lamb": { receiving_yards: 1280, receptions: 95.5, receiving_tds: 7.5 },
  "amon-ra-st-brown": { receiving_yards: 1180, receptions: 100.5, receiving_tds: 7.5 },
  "puka-nacua": { receiving_yards: 600, receptions: 50.5, receiving_tds: 3.5 },
  "tyreek-hill": { receiving_yards: 1525, receptions: 102.5, receiving_tds: 9.5 },
  "aj-brown": { receiving_yards: 1280, receptions: 90.5, receiving_tds: 7.5 },
  "garrett-wilson": { receiving_yards: 1080, receptions: 90.5, receiving_tds: 5.5 },
  "drake-london": { receiving_yards: 925, receptions: 75.5, receiving_tds: 4.5 },
  "nico-collins": { receiving_yards: 700, receptions: 55.5, receiving_tds: 4.5 },
  "travis-kelce": { receiving_yards: 1180, receptions: 92.5, receiving_tds: 8.5 },
  "sam-laporta": { receiving_yards: 525, receptions: 50.5, receiving_tds: 3.5 },
  "trey-mcbride": { receiving_yards: 600, receptions: 60.5, receiving_tds: 3.5 },
  "george-kittle": { receiving_yards: 925, receptions: 65.5, receiving_tds: 5.5 },
};
