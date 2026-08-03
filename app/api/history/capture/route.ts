import { timingSafeEqual } from "node:crypto";
import { getLiveDashboard } from "@/lib/live-odds/service";
import {
  captureDashboardHistory,
  historyStorageConfigured,
} from "@/lib/live-odds/storage";
import type { BoardMode } from "@/lib/live-odds/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!historyStorageConfigured()) {
    return Response.json(
      { error: "Historical storage is not configured." },
      { status: 503 },
    );
  }

  const requestedMode = new URL(request.url).searchParams.get("mode");
  const modes: BoardMode[] =
    requestedMode === "draft" || requestedMode === "weekly"
      ? [requestedMode]
      : ["draft", "weekly"];

  try {
    const dashboards = await Promise.all(
      modes.map((mode) => getLiveDashboard(mode)),
    );
    const captures = [];
    for (const dashboard of dashboards) {
      captures.push(await captureDashboardHistory(dashboard));
    }
    return Response.json({ ok: true, captures });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Historical capture failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
