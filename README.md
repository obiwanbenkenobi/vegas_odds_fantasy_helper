# Edgeboard

Edgeboard is a fantasy-football decision board built from live sportsbook
quotes. It has two views:

- **Draft board** — separates head-to-head comparison, live market signals,
  and the on-the-clock draft assistant into focused workspaces.
  Contextual value alternatives remain attached to the comparison workspace.
- **Weekly board** — aggregates game-level player props and team lines for
  start/sit decisions.

The application does not substitute fantasy-site projections, CSV imports, or
demonstration values when a live feed is missing. Every consensus component can
be expanded to inspect its underlying book, line, over price, under price, and
timestamp.

Season markets are often incomplete. The Draft board therefore shows the actual
posted yardage, touchdown, and reception lines rather than labeling the sum of
available markets as a full-season fantasy projection. ADP alternatives require
the same position and posted-market set and are generated only around players
selected in the comparison workspace.

The market-signals workspace compares each qualifying prop with every
same-position player supported by at least three active sportsbooks. It combines
those market percentiles with scoring-impact weights and compares the result
with the player's positional percentile across the selected platform's complete
ADP pool. A full-profile value requires every core fantasy market for the
position; otherwise the board labels the result as a passing, rushing, or
receiving category signal rather than a complete projection. Stale quotes are
excluded, wide book ranges are flagged, and only gaps of at least ten percentile
points are shown.

## Live provider setup

Copy `.env.example` to `.env.local` and add at least one server-side key:

```bash
PROPLINE_API_KEY=your_key
ODDS_API_KEY=your_the_odds_api_key
ODDS_IO_API_KEY=your_odds_api_io_key
```

The Draft board reads the public Bally Bet, BetMGM, BetRivers, DraftKings,
FanDuel, and theScore Bet New York sportsbook season-player feeds directly and
caches them for thirty minutes. Public read credentials and offering identifiers
are discovered at runtime from each operator's logged-out web application; no
embedded credential is stored in this repository or sent to the browser. The
DraftKings jurisdiction defaults to New York and can be changed with
`DRAFTKINGS_SITE=dkusny`. These are unofficial, read-only web integrations, so
operator changes can require maintenance.

DraftKings is bootstrapped through its public NFL sportsbook page before the
current player-total endpoints are requested. If that live refresh fails and
historical storage is configured, the Draft board keeps DraftKings' most recent
active captured lines in the consensus and marks both the book and quotes as
last known. Stale fallback lines are excluded from history ingestion, so they do
not create false updates or movement events.

`PROPLINE_API_KEY` supplies the freshest weekly markets it has available.
`ODDS_IO_API_KEY` discovers and requests every sportsbook enabled on that
account for weekly game and player markets. Its current free plan permits two
selected books; paid plans can expose more without a code change. If account
discovery is unavailable, the app falls back to Bally Bet, BetMGM, BetRivers,
Caesars, DraftKings, Fanatics, and FanDuel. theScore Bet is not currently a valid
Odds-API.io bookmaker name. `ODDS_API_KEY` adds a broader US-book comparison for
moneylines, spreads, and totals. API keys and discovered sportsbook read
credentials are only used in server modules and are never shipped to the
browser.

The Draft board supplements sportsbook projections with current 12-team
consensus ADP from [Fantasy Football Calculator](https://fantasyfootballcalculator.com/adp/ppr)
and platform-specific ADP from the public
[Draft Sharks ADP market board](https://www.draftsharks.com/adp). Available
platforms depend on scoring format: Sleeper supports PPR, half-PPR, and standard;
ESPN supports PPR; Yahoo supports half-PPR; and CBS supports PPR and standard.
When Half PPR is selected for a platform without Half PPR ADP, the board uses
that platform's PPR ADP and labels the fallback while keeping Vegas points in
Half PPR.
Changing the platform recalculates every ADP comparison, direct value match, and
draft-room recommendation. Player identity and headshots come from Sleeper's public NFL
player directory. When a player is selected or expanded, the app also loads the
three most recent completed regular seasons of actual player stats from Sleeper
and scores them with the selected fantasy format. None of these sources replace
the Vegas projection; they supply draft price and player context.

Season-long player stat futures are less standardized than weekly props. The
Draft board merges the direct Bally Bet, BetMGM, BetRivers, DraftKings, FanDuel,
and theScore Bet feeds and can merge additional licensed, live JSON feeds
configured with:

```bash
LIVE_SEASON_FEED_URLS=https://provider.example/nfl-season-totals
LIVE_SEASON_FEED_BEARER_TOKEN=optional_token
```

Additional feeds must return a The Odds API-compatible shape: events containing
bookmakers, markets, and Over/Under outcomes with player descriptions and points.
This is a live endpoint integration—not a file import.

## Consensus rules

1. Normalize equivalent sportsbook market names.
2. Pair Over and Under outcomes by player and point.
3. Select one main line per book, favoring the most balanced two-way price.
4. Give each book one vote and calculate the median line.
5. Keep the full book-level audit trail attached to the consensus.
6. Calculate data depth from relevant markets and unique books.

Alternate lines do not receive extra votes. Rushing-plus-receiving yard props are
only counted when separate rushing and receiving markets are unavailable, which
prevents double-counting fantasy points.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Verification commands:

```bash
npm run typecheck
npm run lint
```

Live responses are cached server-side to protect free provider quotas. The
dashboard response refreshes every five minutes; Odds-API.io is fetched at most
every ten minutes, The Odds API's broad game-line comparison every twelve hours,
and season markets every thirty minutes.

## Always-on historical capture

Historical storage uses an event-sourced Supabase Postgres schema. It keeps one
current row per player/game market and records immutable events only when a line
is posted, moved, repriced, or removed. This preserves the full movement history
without inserting thousands of unchanged rows every five minutes.

1. Create a Supabase project and run
   `supabase/migrations/20260803100000_odds_history.sql` in its SQL editor.
2. Configure these server-only deployment variables:

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   CRON_SECRET=a_long_random_secret
   ```

3. Configure the public repository's GitHub Actions secrets:

   ```text
   CAPTURE_URL=https://your-deployed-edgeboard-url
   CRON_SECRET=the_same_long_random_secret
   ```

The `Capture sportsbook history` workflow calls the secured ingestion endpoint
every five minutes. Weekly feeds retain their normal provider caching, and
season feeds remain cached for thirty minutes. The workflow still records
capture health on every run while line events are written only when values
actually change. Row-level security is enabled with no public policies; database
reads and writes occur only in server routes using the service role.
