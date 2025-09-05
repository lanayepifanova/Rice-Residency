import Link from "next/link";
import {
  listGameNames,
  listGameNights,
  listGameStandings,
  type GameNight,
  type GameStandings,
} from "@/lib/server/games";
import { PlayerChip } from "../components/PlayerChip";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

function readSlug(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

/** "37%" — whole numbers, because a house tally is not a batting average. */
function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

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

function GameTable({ game }: { game: GameStandings }) {
  return (
    <section className="event-section">
      <div className="event-section-head">
        <h2>{game.name}</h2>
      </div>

      {game.standings.length ? (
        <table className="standings">
          <thead>
            <tr>
              <th scope="col" className="standings-rank">
                #
              </th>
              <th scope="col">Player</th>
              <th scope="col" className="standings-number">
                Points
              </th>
              <th scope="col" className="standings-number">
                Nights
              </th>
              <th scope="col" className="standings-number">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {game.standings.map((standing, index) => (
              <tr key={standing.userId}>
                <td className="standings-rank">{index + 1}</td>
                <td>
                  <PlayerChip
                    className="standings-player"
                    name={standing.name}
                    href={standing.href}
                    avatarUrl={standing.avatarUrl}
                    initial={standing.initial}
                  />
                </td>
                <td className="standings-number">{standing.points}</td>
                <td className="standings-number">{standing.nights}</td>
                <td className="standings-number">{formatShare(standing.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="event-empty">Nobody has scored at {game.name} yet.</p>
      )}
    </section>
  );
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

/**
 * The house card-game tally, and the record it is drawn from.
 *
 * The standings are the argument about who is any good; the nights below them
 * are where it comes from. They used to be separate pages, which meant the
 * table and the evidence for it could not be read together.
 */
export default async function GamesPage({ searchParams }: PageProps<"/games">) {
  const params = await searchParams;
  const [games, names] = await Promise.all([listGameStandings(), listGameNames()]);
  const requested = readSlug(params.game);
  // An unknown slug shows everything rather than an empty page pretending the
  // house has never played.
  const filter = names.some((game) => game.slug === requested) ? requested : "";
  const nights = await listGameNights(filter || undefined);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">R Squared Points</h1>

        {games.length ? (
          games.map((game) => <GameTable key={game.id} game={game} />)
        ) : (
          <p className="event-empty">
            No games tracked yet. Once results are in, standings for each card game show up here.{" "}
            <Link href="/explore">See who is around</Link> in the meantime.
          </p>
        )}

        <section className="event-section">
          <div className="event-section-head">
            <h2>Every Night Played</h2>
            <span className="event-section-note">
              {nights.length} {nights.length === 1 ? "night" : "nights"}
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

          {nights.length ? (
            <ol className="night-list">
              {nights.map((night) => (
                <Night key={night.id} night={night} />
              ))}
            </ol>
          ) : (
            <p className="event-empty">No nights recorded yet.</p>
          )}
        </section>
      </main>
    </>
  );
}
