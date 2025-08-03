import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { games, players, sittings } from "./games-data";

/**
 * Imports the R Squared Points tally from `games-data.ts`.
 *
 * Safe to re-run: every write is keyed on something stable — a game's slug, a
 * player's slug, a sitting's (game, date, ordinal) — so a second run updates
 * rather than duplicates. Sittings that were removed from the data file are
 * deleted here too, so this file and the standings cannot drift apart.
 */

// Run by the Vitest/tsx CLI rather than by Next or `prisma db seed`, so nothing
// has loaded .env.local yet and Prisma 7 does not read env files itself.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to whatever the environment already provides.
}

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set to seed games.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** A round won by two people is a point each — ties and team wins alike. */
function pointsFor(sitting: (typeof sittings)[number]): Map<string, number> {
  const tally = new Map<string, number>();

  for (const round of sitting.rounds) {
    for (const slug of round.won) {
      tally.set(slug, (tally.get(slug) ?? 0) + 1);
    }
  }

  return tally;
}

async function main() {
  console.log("Seeding R Squared Points…");

  const knownPlayers = new Set(players.map((player) => player.slug));
  for (const sitting of sittings) {
    for (const round of sitting.rounds) {
      for (const slug of [...round.won, ...(round.against ?? [])]) {
        if (!knownPlayers.has(slug)) {
          throw new Error(
            `Round on ${sitting.playedOn} names "${slug}", who is not in the players list.`,
          );
        }
      }
    }
  }

  const gameIds = new Map<string, string>();

  for (const game of games) {
    const row = await prisma.cardGame.upsert({
      where: { slug: game.slug },
      create: game,
      update: { name: game.name, description: game.description, sortOrder: game.sortOrder },
    });

    gameIds.set(game.slug, row.id);
  }

  const playerIds = new Map<string, string>();

  for (const player of players) {
    // A player is linked to an account only if that username exists. The tally
    // must import on a machine whose directory is empty, so a missing user is
    // not an error — the player simply has no profile to link to.
    const user = player.user
      ? await prisma.user.findFirst({ where: { username: player.user } })
      : null;

    const row = await prisma.gamePlayer.upsert({
      where: { slug: player.slug },
      create: { slug: player.slug, name: player.name, userId: user?.id ?? null },
      update: { name: player.name, userId: user?.id ?? null },
    });

    playerIds.set(player.slug, row.id);
  }

  const keptSessionIds: string[] = [];

  for (const sitting of sittings) {
    const gameId = gameIds.get(sitting.game);

    if (!gameId) {
      throw new Error(`Sitting on ${sitting.playedOn} names unknown game "${sitting.game}".`);
    }

    const ordinal = sitting.ordinal ?? 1;

    const session = await prisma.gameSession.upsert({
      where: { gameId_playedOn_ordinal: { gameId, playedOn: sitting.playedOn, ordinal } },
      create: {
        gameId,
        playedOn: sitting.playedOn,
        ordinal,
        rounds: sitting.rounds.length,
        note: sitting.note ?? null,
      },
      update: { rounds: sitting.rounds.length, note: sitting.note ?? null },
    });

    keptSessionIds.push(session.id);

    const tally = pointsFor(sitting);

    // Scores are replaced rather than merged: a correction to the data file
    // that removes a round should lower the total, not leave the old one.
    await prisma.gameSessionScore.deleteMany({ where: { sessionId: session.id } });
    await prisma.gameSessionScore.createMany({
      data: [...tally].map(([slug, points]) => ({
        sessionId: session.id,
        playerId: playerIds.get(slug)!,
        points,
      })),
    });
  }

  const removed = await prisma.gameSession.deleteMany({
    where: { id: { notIn: keptSessionIds } },
  });

  const rounds = sittings.reduce((total, sitting) => total + sitting.rounds.length, 0);

  console.log(`  ${games.length} games`);
  console.log(`  ${players.length} players`);
  console.log(`  ${sittings.length} sittings, ${rounds} rounds`);

  if (removed.count) {
    console.log(`  ${removed.count} sittings removed (no longer in games-data.ts)`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
