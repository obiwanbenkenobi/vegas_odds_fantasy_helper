import type {
  AdpEntry,
  AdpPlatform,
  LiveScoringSystem,
  PlayerProjection,
} from "./types";

export function adpScoringForPlatform(
  platform: AdpPlatform,
  scoring: LiveScoringSystem,
): LiveScoringSystem {
  if (
    scoring === "half_ppr" &&
    (platform === "espn" || platform === "cbs")
  ) {
    return "ppr";
  }
  return scoring;
}

export function adpEntryFor(
  player: PlayerProjection | null | undefined,
  scoring: LiveScoringSystem,
  platform: AdpPlatform = "consensus",
): AdpEntry | null {
  const adpScoring = adpScoringForPlatform(platform, scoring);
  if (platform === "consensus") {
    return (
      player?.adp?.[adpScoring] ??
      player?.adpByPlatform?.consensus?.[adpScoring] ??
      null
    );
  }
  return player?.adpByPlatform?.[platform]?.[adpScoring] ?? null;
}

export function adpFor(
  player: PlayerProjection | null | undefined,
  scoring: LiveScoringSystem,
  platform: AdpPlatform = "consensus",
): number | null {
  return adpEntryFor(player, scoring, platform)?.overall ?? null;
}

export function usesPprAdpFallback(
  platform: AdpPlatform,
  scoring: LiveScoringSystem,
): boolean {
  return (
    scoring === "half_ppr" &&
    adpScoringForPlatform(platform, scoring) === "ppr"
  );
}
