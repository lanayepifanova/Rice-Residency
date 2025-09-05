-- AlterTable
ALTER TABLE "EventInstance" ADD COLUMN     "coverIndex" INTEGER;

-- AlterTable
ALTER TABLE "EventSeries" ADD COLUMN     "coverCursor" INTEGER NOT NULL DEFAULT 0;
