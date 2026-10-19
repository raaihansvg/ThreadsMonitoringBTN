-- AlterTable
ALTER TABLE "Mention" ADD COLUMN     "statusKanonik" TEXT NOT NULL DEFAULT 'DIKETAHUI';

-- CreateTable
CREATE TABLE "PreviewLimitState" (
    "key" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "circuitUntil" TIMESTAMP(3),
    "reason" TEXT,
    "attempts" TIMESTAMP(3)[],
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviewLimitState_pkey" PRIMARY KEY ("key")
);
