ALTER TABLE "pedidos" DROP CONSTRAINT IF EXISTS "pedidos_mesaPublicSessionId_fkey";

DROP INDEX IF EXISTS "pedidos_mesaPublicSessionId_idx";
DROP INDEX IF EXISTS "mesas_qrToken_key";

ALTER TABLE "pedidos" DROP COLUMN IF EXISTS "mesaPublicSessionId";
ALTER TABLE "mesas" DROP COLUMN IF EXISTS "qrToken";

DROP TABLE IF EXISTS "mesa_public_sessions";
