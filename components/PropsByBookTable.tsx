"use client";

import { BOOKS_LIST } from "@/lib/data/access";
import {
  consensusLine,
  formatAmerican,
  groupByMarket,
} from "@/lib/odds";
import { pointsForStat, SCORING_PRESETS } from "@/lib/scoring";
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
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export function PropsByBookTable({ player, lines, scoring }: Props) {
  const grouped = groupByMarket(lines);
  const markets = MARKETS_BY_POSITION[player.position].filter((m) =>
    grouped.has(m),
  );
  const rules = SCORING_PRESETS[scoring];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
          <tr>
            <th className="px-4 py-3 font-medium">Market</th>
            {BOOKS_LIST.map((book) => (
              <th key={book} className="px-3 py-3 text-center font-medium">
                {book}
              </th>
            ))}
            <th className="px-4 py-3 text-center font-medium">Consensus</th>
            <th className="px-4 py-3 text-right font-medium">Pts @ line</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => {
            const groupLines = grouped.get(market) ?? [];
            const cons = consensusLine(groupLines);
            const points =
              cons != null ? pointsForStat(market, cons, rules) : 0;
            return (
              <tr
                key={market}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800"
              >
                <td className="px-4 py-3 font-medium">{STAT_LABELS[market]}</td>
                {BOOKS_LIST.map((book) => {
                  const line = groupLines.find((l) => l.book === book);
                  return (
                    <td key={book} className="px-3 py-3 text-center">
                      {line ? (
                        <div>
                          <div className="font-mono text-base">
                            {fmt(line.line)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            o {formatAmerican(line.overOdds)} / u{" "}
                            {formatAmerican(line.underOdds)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center font-mono text-base">
                  {cons != null ? fmt(cons) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {points.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[11px] text-slate-500">
        Pts @ line uses the {scoring === "ppr" ? "PPR" : scoring === "half_ppr" ? "Half PPR" : "Standard"} preset and the
        consensus (median) line across books.
      </p>
    </div>
  );
}

export type { Props as PropsByBookTableProps };
export type { StatMarket };
