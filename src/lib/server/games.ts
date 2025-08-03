import { prisma } from "@/lib/db";

/**
 * R Squared Points — the house card-game standings.
 *
 * What is recorded is the winner of each round, so a player's total is points,
 * not a win/loss record. Nobody writes down who else was at the table, which
 * means losses are not derivable: someone with 4 points might have played four
 * rounds or forty. Share is therefore measured against every round the game has
 * seen, and is honest about being that rather than a win rate.
 */

export type Standing = {
  playerId: string;
  name: string;
  /** Their profile, when the player has a house account. */
  href: string | null;
  initial: string;
  points: number;
  /** Nights they took at least one round. */
  nights: number;
  /** Points over every round of this game, 0–1. */
  share: number;
};

export type GameStandings = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  standings: Standing[];
  rounds: number;
  sessions: number;
  /** `YYYY-MM-DD` of the first and most recent night, for the summary line. */
  firstPlayed: string | null;
  lastPlayed: string | null;
};

export async function listGameStandings(): Promise<GameStandings[]> {
  const games = await prisma.cardGame.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      sessions: {
        orderBy: [{ playedOn: "asc" }, { ordinal: "asc" }],
        include: { scores: { include: { player: { include: { user: true } } } } },
      },
    },
  });

  return games.map((game) => {
    const rounds = game.sessions.reduce((total, session) => total + session.rounds, 0);

    const totals = new Map<string, Standing>();

    for (const session of game.sessions) {
      for (const score of session.scores) {
        const existing = totals.get(score.playerId);

        if (existing) {
          existing.points += score.points;
          existing.nights += 1;
          continue;
        }

        totals.set(score.playerId, {
          playerId: score.playerId,
          name: score.player.name,
          href: score.player.user?.username ? `/people/${score.player.user.username}` : null,
          initial: score.player.name.charAt(0).toUpperCase(),
          points: score.points,
          nights: 1,
          share: 0,
        });
      }
    }

    const standings = [...totals.values()]
      .map((standing) => ({
        ...standing,
        share: rounds > 0 ? standing.points / rounds : 0,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    const dates = game.sessions.map((session) => session.playedOn);

    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      standings,
      rounds,
      sessions: game.sessions.length,
      firstPlayed: dates[0] ?? null,
      lastPlayed: dates[dates.length - 1] ?? null,
    };
  });
}

/** One person's points across every game, for their profile page. */
export async function personGamePoints(
  userId: string,
): Promise<Array<{ game: string; slug: string; points: number }>> {
  const player = await prisma.gamePlayer.findUnique({
    where: { userId },
    include: { scores: { include: { session: { include: { game: true } } } } },
  });

  if (!player) {
    return [];
  }

  const byGame = new Map<string, { game: string; slug: string; points: number }>();

  for (const score of player.scores) {
    const game = score.session.game;
    const entry = byGame.get(game.id);

    if (entry) {
      entry.points += score.points;
    } else {
      byGame.set(game.id, { game: game.name, slug: game.slug, points: score.points });
    }
  }

  return [...byGame.values()].sort((a, b) => b.points - a.points);
}
