import Link from "next/link";
import { Suspense } from "react";
import {
  listGameNames,
  listGameNights,
  listGameStandings,
  type GameStandings,
} from "@/lib/server/games";
import { PlayerChip } from "../components/PlayerChip";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";
import { NightsFilter } from "./NightsFilter";
import { NightsList } from "./NightsSection";

/** "37%" — whole numbers, because a house tally is not a batting average. */
function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
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

/**
 * The house card-game tally, and the record it is drawn from.
 *
 * The standings are the argument about who is any good; the nights below them
 * are where it comes from. They used to be separate pages, which meant the
 * table and the evidence for it could not be read together.
 *
 * Nothing here depends on when it is read — a night that has been played stays
 * played — so this is the one data-backed page that is prerendered whole. Only
 * the `?game=` filter moves to the browser, because a query string is not
 * something a built file has.
 */
export default async function GamesPage() {
  const [games, names, nights] = await Promise.all([
    listGameStandings(),
    listGameNames(),
    listGameNights(),
  ]);

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

        {/* The fallback is the whole log, unfiltered — see NightsFilter. It is
            what the build writes into the page and what a reader without
            JavaScript keeps. */}
        <Suspense fallback={<NightsList nights={nights} names={names} filter="" />}>
          <NightsFilter nights={nights} names={names} />
        </Suspense>
      </main>
    </>
  );
}
