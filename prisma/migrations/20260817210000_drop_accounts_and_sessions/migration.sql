-- Removes what was only ever there to let someone sign in.
--
-- The site is a read-only window onto the house calendar and directory now:
-- there is no sign-up form, no sign-in form, and so nothing to hold a password
-- or a session for. Dropping the column rather than leaving it empty keeps the
-- schema honest about that -- a nullable `passwordHash` that nothing writes
-- reads as a feature someone forgot to finish.
--
-- Destructive, deliberately: the hashes and any live sessions go with it.
-- Everything a visitor actually reads -- people, events, RSVPs, results --
-- is untouched.

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropTable
DROP TABLE "Session";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";
