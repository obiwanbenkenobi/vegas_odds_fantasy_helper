import type { Player } from "../types";

export const PLAYERS: Player[] = [
  // QB
  { id: "josh-allen", name: "Josh Allen", position: "QB", team: "BUF" },
  { id: "patrick-mahomes", name: "Patrick Mahomes", position: "QB", team: "KC" },
  { id: "lamar-jackson", name: "Lamar Jackson", position: "QB", team: "BAL" },
  { id: "jalen-hurts", name: "Jalen Hurts", position: "QB", team: "PHI" },
  { id: "joe-burrow", name: "Joe Burrow", position: "QB", team: "CIN" },
  { id: "cj-stroud", name: "C.J. Stroud", position: "QB", team: "HOU" },
  { id: "jayden-daniels", name: "Jayden Daniels", position: "QB", team: "WAS" },
  { id: "dak-prescott", name: "Dak Prescott", position: "QB", team: "DAL" },
  // RB
  { id: "christian-mccaffrey", name: "Christian McCaffrey", position: "RB", team: "SF" },
  { id: "saquon-barkley", name: "Saquon Barkley", position: "RB", team: "PHI" },
  { id: "bijan-robinson", name: "Bijan Robinson", position: "RB", team: "ATL" },
  { id: "jahmyr-gibbs", name: "Jahmyr Gibbs", position: "RB", team: "DET" },
  { id: "derrick-henry", name: "Derrick Henry", position: "RB", team: "BAL" },
  { id: "jonathan-taylor", name: "Jonathan Taylor", position: "RB", team: "IND" },
  { id: "breece-hall", name: "Breece Hall", position: "RB", team: "NYJ" },
  { id: "kyren-williams", name: "Kyren Williams", position: "RB", team: "LAR" },
  { id: "de-von-achane", name: "De'Von Achane", position: "RB", team: "MIA" },
  // WR
  { id: "ja-marr-chase", name: "Ja'Marr Chase", position: "WR", team: "CIN" },
  { id: "justin-jefferson", name: "Justin Jefferson", position: "WR", team: "MIN" },
  { id: "ceedee-lamb", name: "CeeDee Lamb", position: "WR", team: "DAL" },
  { id: "amon-ra-st-brown", name: "Amon-Ra St. Brown", position: "WR", team: "DET" },
  { id: "puka-nacua", name: "Puka Nacua", position: "WR", team: "LAR" },
  { id: "tyreek-hill", name: "Tyreek Hill", position: "WR", team: "MIA" },
  { id: "aj-brown", name: "A.J. Brown", position: "WR", team: "PHI" },
  { id: "garrett-wilson", name: "Garrett Wilson", position: "WR", team: "NYJ" },
  { id: "drake-london", name: "Drake London", position: "WR", team: "ATL" },
  { id: "malik-nabers", name: "Malik Nabers", position: "WR", team: "NYG" },
  { id: "nico-collins", name: "Nico Collins", position: "WR", team: "HOU" },
  // TE
  { id: "travis-kelce", name: "Travis Kelce", position: "TE", team: "KC" },
  { id: "sam-laporta", name: "Sam LaPorta", position: "TE", team: "DET" },
  { id: "trey-mcbride", name: "Trey McBride", position: "TE", team: "ARI" },
  { id: "brock-bowers", name: "Brock Bowers", position: "TE", team: "LV" },
  { id: "george-kittle", name: "George Kittle", position: "TE", team: "SF" },
];

export function findPlayer(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}
