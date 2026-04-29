"use client";

import { projectedStatsFromLines } from "@/lib/odds";
import { fantasyPoints, pointsForStat, SCORING_PRESETS } from "@/lib/scoring";
import {
  MARKETS_BY_POSITION,
  STAT_LABELS,
  type Player,
  type PropLine,
  type ScoringSystem,
  type StatMarket,
} from "@/lib/types";

interface Props {
  player: Player;
  lines: PropLine[];
  scoring: ScoringSystem;
  comparePoints?: number | null;
}

export function FantasyPointsCard({
  player,
  lines,
  scoring,
  comparePoints,
}: Props) {
  const rules = SCORING_PRESETS[scoring];
  const stats = projectedStatsFromLines(lines);
  const total = fantasyPoints(stats, rules);
  const markets = MARKETS_BY_POSITION[player.position];

  const diff =
    comparePoints == null ? null : Math.round((total - comparePoints) * 10) / 10;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Projected Fantasy Points
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">
              {total.toFixed(1)}
            </span>
            {diff != null && (
              <span
                className={
                  "text-sm font-semibold " +
                  (diff >= 0 ? "text-emerald-600" : "text-rose-600")
                }
              >
                {diff >= 0 ? "+" : ""}
                {diff.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          per game:{" "}
          <span className="font-mono">{(total / 17).toFixed(1)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {markets.map((market: StatMarket) => {
          const value = stats[market];
          if (value == null) return null;
          const pts = pointsForStat(market, value, rules);
          return (
            <div
              key={market}
              className="flex items-baseline justify-between border-b border-dashed border-slate-100 py-1 dark:border-slate-800"
            >
              <span className="text-slate-600 dark:text-slate-300">
                {STAT_LABELS[market]}
              </span>
              <span className="font-mono">
                {Number.isInteger(value) ? value : value.toFixed(1)}{" "}
                <span className="text-xs text-slate-500">
                  ({pts >= 0 ? "+" : ""}
                  {pts.toFixed(1)})
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
