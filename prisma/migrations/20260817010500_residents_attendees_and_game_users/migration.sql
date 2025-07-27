-- Residents vs coworking attendees, and game scores tied to real accounts.
--
-- `User.email` becomes nullable. The house directory holds far more people than
-- have ever signed in — residents and coworking regulars are real entries long
-- before an account exists — and inventing placeholder addresses for them would
-- put fiction in a unique column that sign-in is keyed on.
--
-- `GamePlayer` is dropped and scores now reference `User` directly, so every
-- player is a person in the directory rather than a parallel identity. Its rows
-- carry no information that is not in `prisma/games-data.ts`: the standings are
-- rebuilt from that file by `npm run db:seed:games`, which is run immediately
-- after this migration.


-- CreateEnum
CREATE TYPE "HouseMembership" AS ENUM ('resident', 'attendee');

-- DropForeignKey
ALTER TABLE "GamePlayer" DROP CONSTRAINT "GamePlayer_userId_fkey";

-- DropForeignKey
ALTER TABLE "GameSessionScore" DROP CONSTRAINT "GameSessionScore_playerId_fkey";

-- DropIndex
DROP INDEX "GameSessionScore_playerId_idx";

-- DropIndex
DROP INDEX "GameSessionScore_sessionId_playerId_key";

-- AlterTable
ALTER TABLE "GameSessionScore" DROP COLUMN "playerId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "membership" "HouseMembership" NOT NULL DEFAULT 'attendee',
ALTER COLUMN "email" DROP NOT NULL;

-- DropTable
DROP TABLE "GamePlayer";

-- CreateIndex
CREATE INDEX "GameSessionScore_userId_idx" ON "GameSessionScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSessionScore_sessionId_userId_key" ON "GameSessionScore"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "GameSessionScore" ADD CONSTRAINT "GameSessionScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

