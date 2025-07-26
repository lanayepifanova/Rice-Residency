import Link from "next/link";
import { listGameNames, listGameNights, type GameNight } from "@/lib/server/games";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

function readSlug(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

/** "Tuesday 15 July 2025" — the log spans months, so the year earns its place. */
function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "first" for a lone sitting is noise; only a repeat that night is worth saying. */
function sittingLabel(ordinal: number): string | null {
  if (ordinal <= 1) {
    return null;
  }

  const words = ["", "", "second", "third", "fourth", "fifth"];

  return `${words[ordinal] ?? `${ordinal}th`} sitting`;
}

function Night({ night }: { night: GameNight }) {
  const sitting = sittingLabel(night.ordinal);
  const meta = [
    formatDate(night.playedOn),
    sitting,
    `${night.rounds} ${night.rounds === 1 ? "round" : "rounds"}`,
  ].filter(Boolean);

  return (
    <li className="night">
      <div className="night-head">
        <h2>{night.game}</h2>
        <span className="night-meta">{meta.join(" · ")}</span>
      </div>

      {night.note ? <p className="night-note">{night.note}</p> : null}

      {night.scores.length ? (
        <ol className="night-scores">
          {night.scores.map((score) => (
            <li key={score.userId} className="night-score">
              <span className="profile-image" aria-hidden="true">
                {score.initial}
              </span>

              <span className="night-score-body">
                <span className="night-score-name">
                  {score.href ? <Link href={score.href}>{score.name}</Link> : score.name}
                </span>
                {/* The bar is the same number as the column beside it, so it is
                    decoration: the count stays readable to a screen reader. */}
                <span className="night-bar" aria-hidden="true">
                  <span className="night-bar-fill" style={{ width: `${score.share * 100}%` }} />
                </span>
              </span>

              <span className="night-score-points">
                {score.points}
                <span className="night-score-of"> / {night.rounds}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="event-section-note">No winners were written down for this one.</p>
      )}
    </li>
  );
}

/**
 * Every sitting the house has played, newest first.
 *
 * `/games` is the argument about who is any good; this is the record it is
 * drawn from. The standings add a night into a total and lose it, so a night
 * that was actually a blowout reads the same as a quiet one — here each night
 * keeps its own shape, note and all.
 */
export default async function GamesDashboardPage({ searchParams }: PageProps<"/games/dashboard">) {
  const params = await searchParams;
  const games = await listGameNames();
  const requested = readSlug(params.game);
  // An unknown slug shows everything rather than an empty page pretending the
  // house has never played.
  const filter = games.some((game) => game.slug === requested) ? requested : "";
  const nights = await listGameNights(filter || undefined);

  const rounds = nights.reduce((total, night) => total + night.rounds, 0);
  const players = new Set(nights.flatMap((night) => night.scores.map((score) => score.userId)));

  const best = nights
    .flatMap((night) => night.scores.map((score) => ({ night, score })))
    .sort((a, b) => b.score.points - a.score.points)[0];

  const dates = [...nights].map((night) => night.playedOn).sort();
  const span =
    dates.length && dates[0] !== dates[dates.length - 1]
      ? `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`
      : dates.length
        ? formatDate(dates[0])
        : "Nothing played yet";

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <p className="breadcrumb">
          <Link href="/games">← Standings</Link>
        </p>

        <h1 className="welcome-heading">Every Night Played</h1>

        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">Nights</span>
            <span className="stat-value">{nights.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Rounds</span>
            <span className="stat-value">{rounds}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Players</span>
            <span className="stat-value">{players.size}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Best night</span>
            <span className="stat-value">{best ? best.score.points : 0}</span>
            <span className="stat-note">
              {best ? `${best.score.name} · ${best.night.game}` : "No rounds recorded"}
            </span>
          </div>
        </div>

        <p className="event-section-note">{span}</p>

        {games.length > 1 ? (
          <div className="filter-row">
            <Link
              className={`filter-chip${filter ? "" : " filter-chip-active"}`}
              href="/games/dashboard"
            >
              All games
            </Link>
            {games.map((game) => (
              <Link
                key={game.slug}
                className={`filter-chip${filter === game.slug ? " filter-chip-active" : ""}`}
                href={`/games/dashboard?game=${game.slug}`}
              >
                {game.name}
              </Link>
            ))}
          </div>
        ) : null}

        {nights.length ? (
          <ol className="night-list">
            {nights.map((night) => (
              <Night key={night.id} night={night} />
            ))}
          </ol>
        ) : (
          <p className="event-empty">
            No nights recorded yet. <Link href="/games">The standings</Link> will fill in once
            results are in.
          </p>
        )}
      </main>
    </>
  );
}
