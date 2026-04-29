import type { PropLine, SeasonStats, StatMarket } from "./types";

export function americanToImpliedProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

export function formatAmerican(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function consensusLine(lines: PropLine[]): number | null {
  if (lines.length === 0) return null;
  const values = lines.map((l) => l.line).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];
}

export function bestOver(lines: PropLine[]): PropLine | null {
  if (lines.length === 0) return null;
  return [...lines].sort((a, b) => b.overOdds - a.overOdds)[0];
}

export function bestUnder(lines: PropLine[]): PropLine | null {
  if (lines.length === 0) return null;
  return [...lines].sort((a, b) => b.underOdds - a.underOdds)[0];
}

export function groupByMarket(lines: PropLine[]): Map<StatMarket, PropLine[]> {
  const map = new Map<StatMarket, PropLine[]>();
  for (const l of lines) {
    const arr = map.get(l.market) ?? [];
    arr.push(l);
    map.set(l.market, arr);
  }
  return map;
}

export function projectedStatsFromLines(lines: PropLine[]): SeasonStats {
  const grouped = groupByMarket(lines);
  const stats: SeasonStats = {};
  for (const [market, group] of grouped) {
    const line = consensusLine(group);
    if (line == null) continue;
    stats[market] = line;
  }
  return stats;
}
