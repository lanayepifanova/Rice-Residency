-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'user_invited';

-- AlterTable
ALTER TABLE "EventInstance" DROP COLUMN "overrideFields",
ADD COLUMN     "overrideDescription" TEXT,
ADD COLUMN     "overrideLocationName" TEXT,
ADD COLUMN     "overrideTitle" TEXT;

-- AlterTable
ALTER TABLE "EventRsvp" ALTER COLUMN "partySize" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "EventSeries" ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "materializedThrough" TIMESTAMP(3),
-- A timestamp column forced every series start to be read as an instant. A
-- recurring event's start is a wall-clock time that must survive DST changes,
-- so it becomes text. The USING clause pins the app's "YYYY-MM-DDTHH:MM"
-- shape; Postgres' default timestamp-to-text output uses a space separator and
-- would not parse.
ALTER COLUMN "startsAtLocal" SET DATA TYPE TEXT
  USING to_char("startsAtLocal", 'YYYY-MM-DD"T"HH24:MI');

-- AlterTable
ALTER TABLE "EventShareLink" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lastOpenedAt" TIMESTAMP(3),
ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "birthday" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "EventInvite" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" TEXT,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventInvite_email_idx" ON "EventInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvite_seriesId_email_key" ON "EventInvite"("seriesId", "email");

-- CreateIndex
CREATE INDEX "EventInstance_startsAt_idx" ON "EventInstance"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventInstance_seriesId_startsAt_key" ON "EventInstance"("seriesId", "startsAt");

-- CreateIndex
CREATE INDEX "EventRsvp_userId_idx" ON "EventRsvp"("userId");

-- CreateIndex
CREATE INDEX "EventShareLink_seriesId_idx" ON "EventShareLink"("seriesId");

-- CreateIndex
CREATE INDEX "EventShareLink_instanceId_idx" ON "EventShareLink"("instanceId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_channel_readAt_idx" ON "NotificationDelivery"("userId", "channel", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "EventShareLink" ADD CONSTRAINT "EventShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New tables need RLS enabled explicitly. The 20260813161500_lockdown_rls
-- migration revoked default grants for anon/authenticated, but it also noted
-- that every future table must still switch RLS on to keep both layers intact.
ALTER TABLE "public"."EventInvite" ENABLE ROW LEVEL SECURITY;
