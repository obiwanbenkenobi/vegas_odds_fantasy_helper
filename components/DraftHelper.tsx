"use client";

import { useMemo, useState } from "react";
import { CURRENT_SEASON, getSeasonProps } from "@/lib/data/access";
import { PLAYERS } from "@/lib/data/players";
import { projectedStatsFromLines } from "@/lib/odds";
import { fantasyPoints, SCORING_PRESETS } from "@/lib/scoring";
import type { Player, ScoringSystem } from "@/lib/types";
import { FantasyPointsCard } from "./FantasyPointsCard";
import { HistoricalCard } from "./HistoricalCard";
import { PlayerCombobox } from "./PlayerCombobox";
import { PropsByBookTable } from "./PropsByBookTable";
import { ScoringToggle } from "./ScoringToggle";

function projectedPointsFor(player: Player, scoring: ScoringSystem): number {
  const lines = getSeasonProps(player.id, CURRENT_SEASON);
  const stats = projectedStatsFromLines(lines);
  return fantasyPoints(stats, SCORING_PRESETS[scoring]);
}

interface PlayerSlotProps {
  player: Player | null;
  otherPoints: number | null;
  scoring: ScoringSystem;
}

function PlayerSlot({ player, otherPoints, scoring }: PlayerSlotProps) {
  if (!player) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
        Pick a player to see their Vegas lines and projected fantasy points.
      </div>
    );
  }

  const lines = getSeasonProps(player.id, CURRENT_SEASON);

  return (
    <div className="flex flex-col gap-4">
      <FantasyPointsCard
        player={player}
        lines={lines}
        scoring={scoring}
        comparePoints={otherPoints}
      />
      <PropsByBookTable player={player} lines={lines} scoring={scoring} />
      <HistoricalCard player={player} scoring={scoring} />
    </div>
  );
}

export function DraftHelper() {
  const [scoring, setScoring] = useState<ScoringSystem>("ppr");
  const [playerAId, setPlayerAId] = useState<string | null>("ja-marr-chase");
  const [playerBId, setPlayerBId] = useState<string | null>("bijan-robinson");

  const playerA = useMemo(
    () => PLAYERS.find((p) => p.id === playerAId) ?? null,
    [playerAId],
  );
  const playerB = useMemo(
    () => PLAYERS.find((p) => p.id === playerBId) ?? null,
    [playerBId],
  );

  const aPoints = playerA ? projectedPointsFor(playerA, scoring) : null;
  const bPoints = playerB ? projectedPointsFor(playerB, scoring) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Vegas Fantasy Draft Helper
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Compare two players using sportsbook season-long player props. Pick
            a scoring system, see projected fantasy points off the consensus
            line, and check how each player has performed against their lines
            in past seasons.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Scoring
          </span>
          <ScoringToggle value={scoring} onChange={setScoring} />
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <PlayerCombobox
            label="Player A"
            players={PLAYERS}
            selectedId={playerAId}
            onSelect={setPlayerAId}
            excludeId={playerBId}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <PlayerCombobox
            label="Player B"
            players={PLAYERS}
            selectedId={playerBId}
            onSelect={setPlayerBId}
            excludeId={playerAId}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PlayerSlot
          player={playerA}
          otherPoints={bPoints}
          scoring={scoring}
        />
        <PlayerSlot
          player={playerB}
          otherPoints={aPoints}
          scoring={scoring}
        />
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800">
        Sample lines are for demonstration only. Drop in a live odds API by
        wiring <code className="font-mono">lib/providers/odds-api.ts</code> and
        switching the active provider in{" "}
        <code className="font-mono">lib/providers/index.ts</code>.
      </footer>
    </div>
  );
}
