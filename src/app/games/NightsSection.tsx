import Link from "next/link";
import type { GameNight } from "@/lib/server/games";
import { PlayerChip } from "../components/PlayerChip";

/**
 * The log of sittings, and the filter over it.
 *
 * The narrowing used to happen in the query — `/games?game=uno` ran a second
 * database read. With the site prerendered there is no request to run it on, so
 * every night is built into the page once and the filter is applied here. The
 * log is small enough that this is cheaper than it sounds, and it makes the
 * filter instant rather than a round trip.
 *
 * `NightsList` is the view and takes the filter as a plain prop, so the build
 * can render it — unfiltered — straight into the HTML. `NightsSection` is the
 * client half that reads the filter out of the URL and hands it down. The page
 * renders the first as the fallback for the second, which is what keeps the log
 * in the file: under `output: export` a component reading the query string
 * suspends during prerender, and the fallback is what gets written out.
 */

/** "Tuesday 15 July 2025" — the log spans months, so the year earns its place. */
function formatNightDate(value: string): string {
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
    formatNightDate(night.playedOn),
    sitting,
    `${night.rounds} ${night.rounds === 1 ? "round" : "rounds"}`,
  ].filter(Boolean);

  return (
    <li className="night">
      <div className="night-head">
        <h3>{night.game}</h3>
        <span className="night-meta">{meta.join(" · ")}</span>
      </div>

      {night.note ? <p className="night-note">{night.note}</p> : null}

      {night.scores.length ? (
        <ol className="night-scores">
          {night.scores.map((score) => (
            <li key={score.userId} className="night-score">
              <PlayerChip
                className="night-score-player"
                name={score.name}
                href={score.href}
                avatarUrl={score.avatarUrl}
                initial={score.initial}
              />

              {/* The bar is the same number as the column beside it, so it is
                  decoration: the count stays readable to a screen reader. */}
              <span className="night-bar" aria-hidden="true">
                <span className="night-bar-fill" style={{ width: `${score.share * 100}%` }} />
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

export function NightsList({
  nights,
  names,
  filter,
}: {
  nights: GameNight[];
  names: Array<{ name: string; slug: string }>;
  /** A game slug, or "" for all of them. */
  filter: string;
}) {
  const shown = filter ? nights.filter((night) => night.slug === filter) : nights;

  return (
    <section className="event-section">
      <div className="event-section-head">
        <h2>Every Night Played</h2>
        <span className="event-section-note">
          {shown.length} {shown.length === 1 ? "night" : "nights"}
        </span>
      </div>

      {names.length > 1 ? (
        <div className="filter-row">
          <Link className={`filter-chip${filter ? "" : " filter-chip-active"}`} href="/games">
            All games
          </Link>
          {names.map((game) => (
            <Link
              key={game.slug}
              className={`filter-chip${filter === game.slug ? " filter-chip-active" : ""}`}
              href={`/games?game=${game.slug}`}
            >
              {game.name}
            </Link>
          ))}
        </div>
      ) : null}

      {shown.length ? (
        <ol className="night-list">
          {shown.map((night) => (
            <Night key={night.id} night={night} />
          ))}
        </ol>
      ) : (
        <p className="event-empty">No nights recorded yet.</p>
      )}
    </section>
  );
}
