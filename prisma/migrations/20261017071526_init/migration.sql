-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIF', 'NETRAL', 'NEGATIF');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('RUTIN', 'PANTAU', 'PERLU_PERHATIAN');

-- CreateEnum
CREATE TYPE "MentionStatus" AS ENUM ('DRAF', 'BARU', 'DIPANTAU', 'SELESAI');

-- CreateEnum
CREATE TYPE "InputSourceType" AS ENUM ('FORM', 'EKSTENSI', 'IMPOR', 'CONTOH');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LONJAKAN', 'PERLU_PERHATIAN');

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "linkAsli" TEXT NOT NULL,
    "linkTernormalisasi" TEXT NOT NULL,
    "teksPostingan" TEXT NOT NULL,
    "sumberInput" "InputSourceType" NOT NULL,
    "tanggalDitemukan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggalPostingan" TIMESTAMP(3),
    "topik" TEXT,
    "sentimen" "Sentiment" NOT NULL DEFAULT 'NETRAL',
    "prioritas" "Priority" NOT NULL DEFAULT 'RUTIN',
    "status" "MentionStatus" NOT NULL DEFAULT 'DRAF',
    "headline" VARCHAR(100),
    "ringkasan" VARCHAR(400),
    "kataKunci" TEXT[],
    "penyediaAnalisis" TEXT,
    "dikoreksiManual" BOOLEAN NOT NULL DEFAULT false,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kataKunci" TEXT[],
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "jenis" "AlertType" NOT NULL,
    "topik" TEXT,
    "periode" TEXT,
    "jumlah" INTEGER NOT NULL,
    "ambangDipakai" INTEGER,
    "dibaca" BOOLEAN NOT NULL DEFAULT false,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "sumber" TEXT NOT NULL,
    "jumlahBerhasil" INTEGER NOT NULL DEFAULT 0,
    "jumlahGagal" INTEGER NOT NULL DEFAULT 0,
    "jumlahDuplikat" INTEGER NOT NULL DEFAULT 0,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mention_linkTernormalisasi_key" ON "Mention"("linkTernormalisasi");

-- CreateIndex
CREATE INDEX "Mention_tanggalDitemukan_idx" ON "Mention"("tanggalDitemukan");

-- CreateIndex
CREATE INDEX "Mention_sentimen_idx" ON "Mention"("sentimen");

-- CreateIndex
CREATE INDEX "Mention_topik_idx" ON "Mention"("topik");

-- CreateIndex
CREATE INDEX "Mention_status_idx" ON "Mention"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_nama_key" ON "Topic"("nama");
