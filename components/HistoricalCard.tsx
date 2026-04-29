"use client";

import {
  getSeasonProps,
  getSeasonResult,
  HISTORICAL_SEASONS,
} from "@/lib/data/access";
import { consensusLine, groupByMarket } from "@/lib/odds";
import { fantasyPoints, SCORING_PRESETS } from "@/lib/scoring";
import {
  MARKETS_BY_POSITION,
  STAT_LABELS,
  type Player,
  type ScoringSystem,
  type StatMarket,
} from "@/lib/types";

interface Props {
  player: Player;
  scoring: ScoringSystem;
}

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function diffClass(actual: number, line: number): string {
  if (actual > line) return "text-emerald-600";
  if (actual < line) return "text-rose-600";
  return "text-slate-500";
}

export function HistoricalCard({ player, scoring }: Props) {
  const rules = SCORING_PRESETS[scoring];
  const markets = MARKETS_BY_POSITION[player.position];

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <div className="text-sm font-semibold">{player.name} — History</div>
        <div className="text-xs text-slate-500">
          Preseason consensus line vs. actual season finish
        </div>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {HISTORICAL_SEASONS.map((season) => {
          const lines = getSeasonProps(player.id, season);
          const result = getSeasonResult(player.id, season);
          const grouped = groupByMarket(lines);
          const projectedPts = fantasyPoints(
            Object.fromEntries(
              [...grouped.entries()].map(([m, ls]) => [m, consensusLine(ls)]),
            ) as Parameters<typeof fantasyPoints>[0],
            rules,
          );
          const actualPts = result ? fantasyPoints(result.stats, rules) : null;

          if (lines.length === 0 && !result) {
            return (
              <div key={season} className="px-5 py-3 text-sm text-slate-500">
                <span className="font-mono">{season}</span> — no historical data
              </div>
            );
          }

          return (
            <div key={season} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold">{season} Season</div>
                <div className="text-xs text-slate-500">
                  Projected{" "}
                  <span className="font-mono">{projectedPts.toFixed(1)}</span>{" "}
                  pts · Actual{" "}
                  {actualPts != null ? (
                    <span className="font-mono font-semibold">
                      {actualPts.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}{" "}
                  pts
                  {result?.positionFinish != null && (
                    <>
                      {" "}
                      · Finished{" "}
                      <span className="font-semibold">
                        {player.position}
                        {result.positionFinish}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="text-left">
                      <th className="py-2 font-medium">Market</th>
                      <th className="py-2 text-right font-medium">Line</th>
                      <th className="py-2 text-right font-medium">Actual</th>
                      <th className="py-2 text-right font-medium">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market: StatMarket) => {
                      const groupLines = grouped.get(market) ?? [];
                      if (groupLines.length === 0) return null;
                      const line = consensusLine(groupLines);
                      const actual = result?.stats[market];
                      const diff =
                        actual != null && line != null ? actual - line : null;
                      return (
                        <tr
                          key={market}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-2 pr-2">{STAT_LABELS[market]}</td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {fmt(line)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {fmt(actual)}
                          </td>
                          <td
                            className={
                              "py-2 text-right font-mono " +
                              (line != null && actual != null
                                ? diffClass(actual, line)
                                : "")
                            }
                          >
                            {diff != null
                              ? `${diff > 0 ? "+" : ""}${
                                  Number.isInteger(diff)
                                    ? diff
                                    : diff.toFixed(1)
                                }`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
