import Link from "next/link";
import { listGameStandings, type GameStandings } from "@/lib/server/games";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

/** "37%" — whole numbers, because a house tally is not a batting average. */
function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** "14 July" — the year is on the page already, in the summary line. */
function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function summary(game: GameStandings): string {
  const nights = `${game.sessions} ${game.sessions === 1 ? "night" : "nights"}`;
  const rounds = `${game.rounds} ${game.rounds === 1 ? "round" : "rounds"}`;
  const span =
    game.firstPlayed && game.lastPlayed && game.firstPlayed !== game.lastPlayed
      ? ` · ${formatDate(game.firstPlayed)} to ${formatDate(game.lastPlayed)}`
      : game.firstPlayed
        ? ` · ${formatDate(game.firstPlayed)}`
        : "";

  return `${nights} · ${rounds}${span}`;
}

function GameTable({ game }: { game: GameStandings }) {
  return (
    <section className="event-section">
      <div className="event-section-head">
        <h2>{game.name}</h2>
        <span className="event-section-note">{summary(game)}</span>
      </div>

      {game.description ? <p className="event-section-note">{game.description}</p> : null}

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
                  <span className="standings-player">
                    <span className="profile-image" aria-hidden="true">
                      {standing.initial}
                    </span>
                    {standing.href ? (
                      <Link href={standing.href}>{standing.name}</Link>
                    ) : (
                      standing.name
                    )}
                  </span>
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

/**
 * The house card-game tally. The home page says what is on and the people page
 * says who everyone is; this is the running argument about who is any good.
 */
export default async function GamesPage() {
  const games = await listGameStandings();

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">R Squared Points</h1>

        <p className="games-intro">
          A point for every round won. A round shared — a tie, or a team win — is a point each.
          Share is the portion of all rounds of that game a player has taken; only winners are
          written down, so there is no won-lost record to show.
        </p>

        {games.length ? (
          games.map((game) => <GameTable key={game.id} game={game} />)
        ) : (
          <p className="event-empty">
            No games tracked yet. Once results are in, standings for each card game show up here.{" "}
            <Link href="/explore">See who is around</Link> in the meantime.
          </p>
        )}
      </main>
    </>
  );
}
