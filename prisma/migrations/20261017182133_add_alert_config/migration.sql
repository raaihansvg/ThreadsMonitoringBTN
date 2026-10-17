-- CreateTable
CREATE TABLE "AlertConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "volumeThreshold" INTEGER NOT NULL DEFAULT 10,
    "volumeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "negativeThreshold" INTEGER NOT NULL DEFAULT 3,
    "negativePercentage" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertConfig_pkey" PRIMARY KEY ("id")
);
