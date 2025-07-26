import { prisma } from "@/lib/db";
import { avatarInitial, displayName } from "./profile";

/**
 * R Squared Points — the house card-game standings.
 *
 * Players are people in the directory, so a name here is the same person as on
 * the people page and their row links to that profile.
 *
 * What is recorded is the winner of each round, so a player's total is points,
 * not a win/loss record. Nobody writes down who else was at the table, which
 * means losses are not derivable: someone with 4 points might have played four
 * rounds or forty. Share is therefore measured against every round the game has
 * seen, and is honest about being that rather than a win rate.
 */

export type Standing = {
  userId: string;
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
        include: { scores: { include: { user: true } } },
      },
    },
  });

  return games.map((game) => {
    const rounds = game.sessions.reduce((total, session) => total + session.rounds, 0);

    const totals = new Map<string, Standing>();

    for (const session of game.sessions) {
      for (const score of session.scores) {
        const existing = totals.get(score.userId);

        if (existing) {
          existing.points += score.points;
          existing.nights += 1;
          continue;
        }

        totals.set(score.userId, {
          userId: score.userId,
          name: displayName(score.user),
          href: score.user.username ? `/people/${score.user.username}` : null,
          initial: avatarInitial(score.user),
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
  const scores = await prisma.gameSessionScore.findMany({
    where: { userId },
    include: { session: { include: { game: true } } },
  });

  const byGame = new Map<string, { game: string; slug: string; points: number }>();

  for (const score of scores) {
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

/** One player's line in one sitting. */
export type NightScore = {
  userId: string;
  name: string;
  href: string | null;
  initial: string;
  points: number;
  /** Points over the rounds played that night, 0–1. */
  share: number;
};

/** One sitting, as it was written down. */
export type GameNight = {
  id: string;
  game: string;
  slug: string;
  playedOn: string;
  /** 2 on the second sitting of the same game on the same date. */
  ordinal: number;
  rounds: number;
  note: string | null;
  /** Everyone who took a round that night, most points first. */
  scores: NightScore[];
};

/**
 * Every sitting ever played, newest first — the log behind the standings.
 *
 * The standings answer "who is winning"; this answers "what happened on the
 * 15th", which the totals flatten away. Optionally narrowed to one game, so the
 * page can offer a filter without a second query shape.
 */
export async function listGameNights(slug?: string): Promise<GameNight[]> {
  const sessions = await prisma.gameSession.findMany({
    where: slug ? { game: { slug } } : undefined,
    // Newest first. Two sittings of one game on one date are ordered by their
    // ordinal; two different games on one date have no recorded order, so they
    // fall back to the manual game order rather than to whatever the database
    // happens to return.
    orderBy: [{ playedOn: "desc" }, { ordinal: "desc" }, { game: { sortOrder: "asc" } }],
    include: { game: true, scores: { include: { user: true } } },
  });

  return sessions.map((session) => ({
    id: session.id,
    game: session.game.name,
    slug: session.game.slug,
    playedOn: session.playedOn,
    ordinal: session.ordinal,
    rounds: session.rounds,
    note: session.note,
    scores: session.scores
      .map((score) => ({
        userId: score.userId,
        name: displayName(score.user),
        href: score.user.username ? `/people/${score.user.username}` : null,
        initial: avatarInitial(score.user),
        points: score.points,
        share: session.rounds > 0 ? score.points / session.rounds : 0,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
  }));
}

/** The games themselves, for the filter row on the log. */
export async function listGameNames(): Promise<Array<{ name: string; slug: string }>> {
  const games = await prisma.cardGame.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true },
  });

  return games;
}
