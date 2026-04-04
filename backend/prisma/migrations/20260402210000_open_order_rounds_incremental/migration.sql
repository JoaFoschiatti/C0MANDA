CREATE TABLE "pedido_rondas" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "numero" INTEGER NOT NULL,
    "enviadaCocinaAt" TIMESTAMP(3),
    "stockAplicadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_rondas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pedido_items" ADD COLUMN "rondaId" INTEGER;

ALTER TABLE "pedido_rondas"
    ADD CONSTRAINT "pedido_rondas_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedido_rondas"
    ADD CONSTRAINT "pedido_rondas_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "pedido_rondas" ("pedidoId", "usuarioId", "numero", "enviadaCocinaAt", "stockAplicadoAt", "createdAt", "updatedAt")
SELECT
    p."id",
    p."usuarioId",
    1,
    CASE
        WHEN p."estado" IN ('EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO', 'CERRADO')
            THEN COALESCE(p."updatedAt", p."createdAt")
        ELSE NULL
    END,
    CASE
        WHEN p."estado" IN ('EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO', 'CERRADO')
            THEN COALESCE(p."updatedAt", p."createdAt")
        ELSE NULL
    END,
    p."createdAt",
    COALESCE(p."updatedAt", p."createdAt")
FROM "pedidos" p;

UPDATE "pedido_items" pi
SET "rondaId" = pr."id"
FROM "pedido_rondas" pr
WHERE pr."pedidoId" = pi."pedidoId"
  AND pr."numero" = 1;

ALTER TABLE "pedido_items"
    ALTER COLUMN "rondaId" SET NOT NULL;

ALTER TABLE "pedido_items"
    ADD CONSTRAINT "pedido_items_rondaId_fkey"
    FOREIGN KEY ("rondaId") REFERENCES "pedido_rondas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pedido_rondas_pedidoId_numero_key" ON "pedido_rondas"("pedidoId", "numero");
CREATE INDEX "pedido_rondas_pedidoId_createdAt_idx" ON "pedido_rondas"("pedidoId", "createdAt");
CREATE INDEX "pedido_items_rondaId_idx" ON "pedido_items"("rondaId");
