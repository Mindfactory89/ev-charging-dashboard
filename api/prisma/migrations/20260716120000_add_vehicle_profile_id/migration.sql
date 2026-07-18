ALTER TABLE "ChargingSession" ADD COLUMN "vehicle_profile_id" TEXT;

CREATE INDEX "ChargingSession_vehicle_profile_id_idx" ON "ChargingSession"("vehicle_profile_id");
