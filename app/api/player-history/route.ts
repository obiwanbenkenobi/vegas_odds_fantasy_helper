import { getPlayerHistory } from "@/lib/live-odds/player-history";

const SLEEPER_PLAYER_ID = /^\d+$/;

export async function GET(request: Request) {
  const playerId = new URL(request.url).searchParams.get("playerId")?.trim();
  if (!playerId || !SLEEPER_PLAYER_ID.test(playerId)) {
    return Response.json(
      { error: "A valid playerId is required." },
      { status: 400 },
    );
  }

  try {
    const history = await getPlayerHistory(playerId);
    return Response.json(history, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Player history is unavailable.";
    return Response.json({ error: message }, { status: 502 });
  }
}
