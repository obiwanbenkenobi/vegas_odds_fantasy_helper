import {
  historyStorageConfigured,
  readDashboardHistory,
} from "@/lib/live-odds/storage";
import type { BoardMode } from "@/lib/live-odds/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!historyStorageConfigured()) {
    return Response.json(
      { configured: false, message: "Server history is not configured." },
      { status: 503 },
    );
  }
  const params = new URL(request.url).searchParams;
  const mode: BoardMode = params.get("mode") === "weekly" ? "weekly" : "draft";
  const playerId = params.get("playerId")?.trim() || undefined;
  try {
    const history = await readDashboardHistory(mode, playerId);
    return Response.json(
      { configured: true, ...history },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "History read failed.";
    return Response.json({ configured: true, error: message }, { status: 500 });
  }
}
