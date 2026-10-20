-- CreateIndex
CREATE UNIQUE INDEX "Alert_jenis_topik_periode_sumberInput_key" ON "Alert"("jenis", "topik", "periode", "sumberInput");
