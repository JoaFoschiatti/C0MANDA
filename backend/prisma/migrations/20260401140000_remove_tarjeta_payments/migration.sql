-- Normalize local/test rows before removing TARJETA from the enum.
UPDATE "pagos"
SET "metodo" = 'MERCADOPAGO'
WHERE "metodo"::text = 'TARJETA';

UPDATE "pagos"
SET "propinaMetodo" = 'MERCADOPAGO'
WHERE "propinaMetodo"::text = 'TARJETA';

ALTER TABLE "cierres_caja"
DROP COLUMN "totalTarjeta";

ALTER TYPE "MetodoPago" RENAME TO "MetodoPago_old";

CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'MERCADOPAGO');

ALTER TABLE "pagos"
ALTER COLUMN "metodo" TYPE "MetodoPago"
USING ("metodo"::text::"MetodoPago");

ALTER TABLE "pagos"
ALTER COLUMN "propinaMetodo" TYPE "MetodoPago"
USING (
  CASE
    WHEN "propinaMetodo" IS NULL THEN NULL
    ELSE "propinaMetodo"::text::"MetodoPago"
  END
);

DROP TYPE "MetodoPago_old";
