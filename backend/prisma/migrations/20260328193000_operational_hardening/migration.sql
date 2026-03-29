ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "operational_events" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sourceInstance" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "operational_events_createdAt_idx"
ON "operational_events"("createdAt");

CREATE INDEX IF NOT EXISTS "operational_events_sourceInstance_id_idx"
ON "operational_events"("sourceInstance", "id");
