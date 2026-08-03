import { getLiveDashboard } from "@/lib/live-odds/service";
import type { BoardMode } from "@/lib/live-odds/types";

export async function GET(request: Request) {
  const modeParam = new URL(request.url).searchParams.get("mode");
  const mode: BoardMode = modeParam === "weekly" ? "weekly" : "draft";
  const data = await getLiveDashboard(mode);
  const maxAge = mode === "draft" ? 1800 : 300;

  return Response.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
}
