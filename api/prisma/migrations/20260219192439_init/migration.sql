-- CreateTable
CREATE TABLE "ChargingSession" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "connector" TEXT NOT NULL,
    "soc_start" INTEGER NOT NULL,
    "soc_end" INTEGER NOT NULL,
    "energy_kwh" DOUBLE PRECISION NOT NULL,
    "price_per_kwh" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "duration_seconds" INTEGER,
    "odo_start_km" INTEGER,
    "odo_end_km" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargingSession_date_idx" ON "ChargingSession"("date");

-- CreateIndex
CREATE INDEX "ChargingSession_connector_idx" ON "ChargingSession"("connector");
