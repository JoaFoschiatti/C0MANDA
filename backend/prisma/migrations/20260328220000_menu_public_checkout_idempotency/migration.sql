ALTER TABLE "pedidos"
  ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "pedidos_clientRequestId_key"
  ON "pedidos" ("clientRequestId");
