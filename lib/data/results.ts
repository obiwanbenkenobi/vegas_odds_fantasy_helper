import type { SeasonResult } from "../types";

// Sample season-end stats for marquee fantasy players. These are
// approximate and intended to illustrate the "lines vs. actual" view.

// 2025 stats compiled from published season recaps and player pages (ESPN,
// StatMuse, PFF, team sites, Wikipedia, fantasy season-recap articles).
// positionFinish is included only where a source stated it (PPR); omitted
// finishes were not findable, not necessarily unremarkable.
export const RESULTS_2025: SeasonResult[] = [
  { playerId: "josh-allen", season: 2025, stats: { passing_yards: 3668, passing_tds: 25, interceptions: 10, rushing_yards: 579, rushing_tds: 14 }, positionFinish: 1 },
  { playerId: "patrick-mahomes", season: 2025, stats: { passing_yards: 3587, passing_tds: 22, interceptions: 11, rushing_yards: 422, rushing_tds: 5 } },
  { playerId: "lamar-jackson", season: 2025, stats: { passing_yards: 2549, passing_tds: 21, interceptions: 7, rushing_yards: 333, rushing_tds: 2 } },
  { playerId: "jalen-hurts", season: 2025, stats: { passing_yards: 3224, passing_tds: 25, interceptions: 6, rushing_yards: 421, rushing_tds: 8 } },
  { playerId: "joe-burrow", season: 2025, stats: { passing_yards: 1809, passing_tds: 17, interceptions: 5, rushing_yards: 41, rushing_tds: 0 } },
  { playerId: "cj-stroud", season: 2025, stats: { passing_yards: 3041, passing_tds: 19, interceptions: 8, rushing_yards: 209, rushing_tds: 1 } },
  { playerId: "jayden-daniels", season: 2025, stats: { passing_yards: 1262, passing_tds: 8, interceptions: 3, rushing_yards: 278, rushing_tds: 2 } },
  { playerId: "dak-prescott", season: 2025, stats: { passing_yards: 4552, passing_tds: 30, interceptions: 10, rushing_yards: 177, rushing_tds: 2 } },
  { playerId: "christian-mccaffrey", season: 2025, stats: { rushing_yards: 1202, rushing_tds: 10, receiving_yards: 924, receptions: 102, receiving_tds: 7 }, positionFinish: 1 },
  { playerId: "saquon-barkley", season: 2025, stats: { rushing_yards: 1140, rushing_tds: 7, receiving_yards: 273, receptions: 37, receiving_tds: 2 } },
  { playerId: "bijan-robinson", season: 2025, stats: { rushing_yards: 1487, rushing_tds: 7, receiving_yards: 820, receptions: 79, receiving_tds: 4 }, positionFinish: 2 },
  { playerId: "jahmyr-gibbs", season: 2025, stats: { rushing_yards: 1223, rushing_tds: 13, receiving_yards: 616, receptions: 77, receiving_tds: 5 }, positionFinish: 3 },
  { playerId: "derrick-henry", season: 2025, stats: { rushing_yards: 1595, rushing_tds: 16, receiving_yards: 150, receptions: 15, receiving_tds: 0 }, positionFinish: 6 },
  { playerId: "jonathan-taylor", season: 2025, stats: { rushing_yards: 1585, rushing_tds: 18, receiving_yards: 378, receptions: 46, receiving_tds: 2 }, positionFinish: 4 },
  { playerId: "breece-hall", season: 2025, stats: { rushing_yards: 1065, rushing_tds: 4, receiving_yards: 350, receptions: 36, receiving_tds: 1 } },
  { playerId: "kyren-williams", season: 2025, stats: { rushing_yards: 1252, rushing_tds: 10, receiving_yards: 281, receptions: 36, receiving_tds: 3 }, positionFinish: 12 },
  { playerId: "de-von-achane", season: 2025, stats: { rushing_yards: 1350, rushing_tds: 8, receiving_yards: 488, receptions: 67, receiving_tds: 4 }, positionFinish: 5 },
  { playerId: "ja-marr-chase", season: 2025, stats: { receiving_yards: 1412, receptions: 125, receiving_tds: 8 }, positionFinish: 4 },
  { playerId: "justin-jefferson", season: 2025, stats: { receiving_yards: 1048, receptions: 84, receiving_tds: 2 }, positionFinish: 25 },
  { playerId: "ceedee-lamb", season: 2025, stats: { receiving_yards: 1077, receptions: 75, receiving_tds: 3 } },
  { playerId: "amon-ra-st-brown", season: 2025, stats: { receiving_yards: 1401, receptions: 117, receiving_tds: 11 }, positionFinish: 3 },
  { playerId: "puka-nacua", season: 2025, stats: { receiving_yards: 1715, receptions: 129, receiving_tds: 10, rushing_tds: 1 }, positionFinish: 1 },
  { playerId: "tyreek-hill", season: 2025, stats: { receiving_yards: 265, receptions: 21, receiving_tds: 1 } },
  { playerId: "aj-brown", season: 2025, stats: { receiving_yards: 1003, receptions: 78, receiving_tds: 7 } },
  { playerId: "garrett-wilson", season: 2025, stats: { receiving_yards: 395, receptions: 36, receiving_tds: 4 } },
  { playerId: "drake-london", season: 2025, stats: { receiving_yards: 919, receptions: 68, receiving_tds: 7 } },
  { playerId: "malik-nabers", season: 2025, stats: { receiving_yards: 271, receptions: 18, receiving_tds: 2 } },
  { playerId: "nico-collins", season: 2025, stats: { receiving_yards: 1117, receptions: 71, receiving_tds: 6 } },
  { playerId: "travis-kelce", season: 2025, stats: { receiving_yards: 851, receptions: 76, receiving_tds: 5 }, positionFinish: 3 },
  { playerId: "sam-laporta", season: 2025, stats: { receiving_yards: 489, receptions: 40, receiving_tds: 3 } },
  { playerId: "trey-mcbride", season: 2025, stats: { receiving_yards: 1239, receptions: 126, receiving_tds: 11 }, positionFinish: 1 },
  { playerId: "brock-bowers", season: 2025, stats: { receiving_yards: 680, receptions: 64, receiving_tds: 7 }, positionFinish: 11 },
  { playerId: "george-kittle", season: 2025, stats: { receiving_yards: 628, receptions: 57, receiving_tds: 7 } },
];

export const RESULTS_2024: SeasonResult[] = [
  { playerId: "josh-allen", season: 2024, stats: { passing_yards: 3731, passing_tds: 28, interceptions: 6, rushing_yards: 531, rushing_tds: 12 }, positionFinish: 2 },
  { playerId: "patrick-mahomes", season: 2024, stats: { passing_yards: 3928, passing_tds: 26, interceptions: 11, rushing_yards: 307, rushing_tds: 2 }, positionFinish: 11 },
  { playerId: "lamar-jackson", season: 2024, stats: { passing_yards: 4172, passing_tds: 41, interceptions: 4, rushing_yards: 915, rushing_tds: 4 }, positionFinish: 1 },
  { playerId: "jalen-hurts", season: 2024, stats: { passing_yards: 2903, passing_tds: 18, interceptions: 5, rushing_yards: 630, rushing_tds: 14 }, positionFinish: 9 },
  { playerId: "joe-burrow", season: 2024, stats: { passing_yards: 4918, passing_tds: 43, interceptions: 9, rushing_yards: 201, rushing_tds: 2 }, positionFinish: 3 },
  { playerId: "cj-stroud", season: 2024, stats: { passing_yards: 3727, passing_tds: 20, interceptions: 12, rushing_yards: 289, rushing_tds: 3 }, positionFinish: 14 },
  { playerId: "jayden-daniels", season: 2024, stats: { passing_yards: 3568, passing_tds: 25, interceptions: 9, rushing_yards: 891, rushing_tds: 6 }, positionFinish: 4 },
  { playerId: "dak-prescott", season: 2024, stats: { passing_yards: 1978, passing_tds: 11, interceptions: 8, rushing_yards: 79, rushing_tds: 2 }, positionFinish: 28 },
  { playerId: "christian-mccaffrey", season: 2024, stats: { rushing_yards: 202, rushing_tds: 0, receiving_yards: 146, receptions: 15, receiving_tds: 1 }, positionFinish: 64 },
  { playerId: "saquon-barkley", season: 2024, stats: { rushing_yards: 2005, rushing_tds: 13, receiving_yards: 278, receptions: 33, receiving_tds: 2 }, positionFinish: 1 },
  { playerId: "bijan-robinson", season: 2024, stats: { rushing_yards: 1456, rushing_tds: 14, receiving_yards: 431, receptions: 61, receiving_tds: 1 }, positionFinish: 2 },
  { playerId: "jahmyr-gibbs", season: 2024, stats: { rushing_yards: 1412, rushing_tds: 16, receiving_yards: 517, receptions: 52, receiving_tds: 4 }, positionFinish: 3 },
  { playerId: "derrick-henry", season: 2024, stats: { rushing_yards: 1921, rushing_tds: 16, receiving_yards: 193, receptions: 19, receiving_tds: 2 }, positionFinish: 4 },
  { playerId: "jonathan-taylor", season: 2024, stats: { rushing_yards: 1431, rushing_tds: 11, receiving_yards: 136, receptions: 18, receiving_tds: 0 }, positionFinish: 8 },
  { playerId: "breece-hall", season: 2024, stats: { rushing_yards: 876, rushing_tds: 5, receiving_yards: 483, receptions: 57, receiving_tds: 3 }, positionFinish: 18 },
  { playerId: "kyren-williams", season: 2024, stats: { rushing_yards: 1299, rushing_tds: 14, receiving_yards: 182, receptions: 34, receiving_tds: 0 }, positionFinish: 7 },
  { playerId: "de-von-achane", season: 2024, stats: { rushing_yards: 907, rushing_tds: 6, receiving_yards: 592, receptions: 78, receiving_tds: 6 }, positionFinish: 6 },
  { playerId: "ja-marr-chase", season: 2024, stats: { receiving_yards: 1708, receptions: 127, receiving_tds: 17 }, positionFinish: 1 },
  { playerId: "justin-jefferson", season: 2024, stats: { receiving_yards: 1533, receptions: 103, receiving_tds: 10 }, positionFinish: 4 },
  { playerId: "ceedee-lamb", season: 2024, stats: { receiving_yards: 1194, receptions: 101, receiving_tds: 6 }, positionFinish: 12 },
  { playerId: "amon-ra-st-brown", season: 2024, stats: { receiving_yards: 1263, receptions: 115, receiving_tds: 12 }, positionFinish: 2 },
  { playerId: "puka-nacua", season: 2024, stats: { receiving_yards: 990, receptions: 79, receiving_tds: 3 }, positionFinish: 22 },
  { playerId: "tyreek-hill", season: 2024, stats: { receiving_yards: 959, receptions: 81, receiving_tds: 6 }, positionFinish: 24 },
  { playerId: "aj-brown", season: 2024, stats: { receiving_yards: 1079, receptions: 67, receiving_tds: 7 }, positionFinish: 17 },
  { playerId: "garrett-wilson", season: 2024, stats: { receiving_yards: 1104, receptions: 101, receiving_tds: 7 }, positionFinish: 11 },
  { playerId: "drake-london", season: 2024, stats: { receiving_yards: 1271, receptions: 100, receiving_tds: 9 }, positionFinish: 6 },
  { playerId: "malik-nabers", season: 2024, stats: { receiving_yards: 1204, receptions: 109, receiving_tds: 7 }, positionFinish: 8 },
  { playerId: "nico-collins", season: 2024, stats: { receiving_yards: 1268, receptions: 68, receiving_tds: 7 }, positionFinish: 13 },
  { playerId: "travis-kelce", season: 2024, stats: { receiving_yards: 823, receptions: 97, receiving_tds: 3 }, positionFinish: 7 },
  { playerId: "sam-laporta", season: 2024, stats: { receiving_yards: 726, receptions: 60, receiving_tds: 7 }, positionFinish: 8 },
  { playerId: "trey-mcbride", season: 2024, stats: { receiving_yards: 1146, receptions: 111, receiving_tds: 2 }, positionFinish: 3 },
  { playerId: "brock-bowers", season: 2024, stats: { receiving_yards: 1194, receptions: 112, receiving_tds: 5 }, positionFinish: 1 },
  { playerId: "george-kittle", season: 2024, stats: { receiving_yards: 1106, receptions: 78, receiving_tds: 8 }, positionFinish: 2 },
];

export const RESULTS_2023: SeasonResult[] = [
  { playerId: "josh-allen", season: 2023, stats: { passing_yards: 4306, passing_tds: 29, interceptions: 18, rushing_yards: 524, rushing_tds: 15 }, positionFinish: 2 },
  { playerId: "patrick-mahomes", season: 2023, stats: { passing_yards: 4183, passing_tds: 27, interceptions: 14, rushing_yards: 389, rushing_tds: 0 }, positionFinish: 8 },
  { playerId: "lamar-jackson", season: 2023, stats: { passing_yards: 3678, passing_tds: 24, interceptions: 7, rushing_yards: 821, rushing_tds: 5 }, positionFinish: 1 },
  { playerId: "jalen-hurts", season: 2023, stats: { passing_yards: 3858, passing_tds: 23, interceptions: 15, rushing_yards: 605, rushing_tds: 15 }, positionFinish: 3 },
  { playerId: "joe-burrow", season: 2023, stats: { passing_yards: 2309, passing_tds: 15, interceptions: 6, rushing_yards: 70, rushing_tds: 0 }, positionFinish: 31 },
  { playerId: "cj-stroud", season: 2023, stats: { passing_yards: 4108, passing_tds: 23, interceptions: 5, rushing_yards: 167, rushing_tds: 3 }, positionFinish: 7 },
  { playerId: "dak-prescott", season: 2023, stats: { passing_yards: 4516, passing_tds: 36, interceptions: 9, rushing_yards: 105, rushing_tds: 2 }, positionFinish: 4 },
  { playerId: "christian-mccaffrey", season: 2023, stats: { rushing_yards: 1459, rushing_tds: 14, receiving_yards: 564, receptions: 67, receiving_tds: 7 }, positionFinish: 1 },
  { playerId: "saquon-barkley", season: 2023, stats: { rushing_yards: 962, rushing_tds: 6, receiving_yards: 280, receptions: 41, receiving_tds: 4 }, positionFinish: 17 },
  { playerId: "bijan-robinson", season: 2023, stats: { rushing_yards: 976, rushing_tds: 4, receiving_yards: 487, receptions: 58, receiving_tds: 4 }, positionFinish: 12 },
  { playerId: "jahmyr-gibbs", season: 2023, stats: { rushing_yards: 945, rushing_tds: 10, receiving_yards: 316, receptions: 52, receiving_tds: 1 }, positionFinish: 14 },
  { playerId: "derrick-henry", season: 2023, stats: { rushing_yards: 1167, rushing_tds: 12, receiving_yards: 214, receptions: 28, receiving_tds: 0 }, positionFinish: 9 },
  { playerId: "jonathan-taylor", season: 2023, stats: { rushing_yards: 741, rushing_tds: 7, receiving_yards: 153, receptions: 19, receiving_tds: 1 }, positionFinish: 22 },
  { playerId: "breece-hall", season: 2023, stats: { rushing_yards: 994, rushing_tds: 5, receiving_yards: 591, receptions: 76, receiving_tds: 4 }, positionFinish: 4 },
  { playerId: "kyren-williams", season: 2023, stats: { rushing_yards: 1144, rushing_tds: 12, receiving_yards: 206, receptions: 32, receiving_tds: 3 }, positionFinish: 5 },
  { playerId: "de-von-achane", season: 2023, stats: { rushing_yards: 800, rushing_tds: 8, receiving_yards: 197, receptions: 27, receiving_tds: 3 }, positionFinish: 21 },
  { playerId: "ja-marr-chase", season: 2023, stats: { receiving_yards: 1216, receptions: 100, receiving_tds: 7 }, positionFinish: 6 },
  { playerId: "justin-jefferson", season: 2023, stats: { receiving_yards: 1074, receptions: 68, receiving_tds: 5 }, positionFinish: 18 },
  { playerId: "ceedee-lamb", season: 2023, stats: { receiving_yards: 1749, receptions: 135, receiving_tds: 12 }, positionFinish: 1 },
  { playerId: "amon-ra-st-brown", season: 2023, stats: { receiving_yards: 1515, receptions: 119, receiving_tds: 10 }, positionFinish: 2 },
  { playerId: "puka-nacua", season: 2023, stats: { receiving_yards: 1486, receptions: 105, receiving_tds: 6 }, positionFinish: 5 },
  { playerId: "tyreek-hill", season: 2023, stats: { receiving_yards: 1799, receptions: 119, receiving_tds: 13 }, positionFinish: 3 },
  { playerId: "aj-brown", season: 2023, stats: { receiving_yards: 1456, receptions: 106, receiving_tds: 7 }, positionFinish: 4 },
  { playerId: "garrett-wilson", season: 2023, stats: { receiving_yards: 1042, receptions: 95, receiving_tds: 3 }, positionFinish: 23 },
  { playerId: "drake-london", season: 2023, stats: { receiving_yards: 905, receptions: 69, receiving_tds: 2 }, positionFinish: 36 },
  { playerId: "nico-collins", season: 2023, stats: { receiving_yards: 1297, receptions: 80, receiving_tds: 8 }, positionFinish: 7 },
  { playerId: "travis-kelce", season: 2023, stats: { receiving_yards: 984, receptions: 93, receiving_tds: 5 }, positionFinish: 4 },
  { playerId: "sam-laporta", season: 2023, stats: { receiving_yards: 889, receptions: 86, receiving_tds: 10 }, positionFinish: 1 },
  { playerId: "trey-mcbride", season: 2023, stats: { receiving_yards: 825, receptions: 81, receiving_tds: 3 }, positionFinish: 7 },
  { playerId: "george-kittle", season: 2023, stats: { receiving_yards: 1020, receptions: 65, receiving_tds: 6 }, positionFinish: 2 },
];

export function findResult(
  playerId: string,
  season: number,
): SeasonResult | undefined {
  const set =
    season === 2025
      ? RESULTS_2025
      : season === 2024
        ? RESULTS_2024
        : season === 2023
          ? RESULTS_2023
          : [];
  return set.find((r) => r.playerId === playerId);
}
