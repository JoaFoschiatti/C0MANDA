-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "mesaPublicSessionId" INTEGER,
ADD COLUMN     "operacionConfirmada" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "mesa_public_sessions" (
    "id" SERIAL NOT NULL,
    "mesaId" INTEGER NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesa_public_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mesa_public_sessions_sessionToken_key" ON "mesa_public_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "mesa_public_sessions_mesaId_revokedAt_expiresAt_idx" ON "mesa_public_sessions"("mesaId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "pedidos_origen_operacion_estado_idx" ON "pedidos"("origen", "operacionConfirmada", "estado");

-- CreateIndex
CREATE INDEX "pedidos_mesaPublicSessionId_idx" ON "pedidos"("mesaPublicSessionId");

-- AddForeignKey
ALTER TABLE "mesa_public_sessions" ADD CONSTRAINT "mesa_public_sessions_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesaPublicSessionId_fkey" FOREIGN KEY ("mesaPublicSessionId") REFERENCES "mesa_public_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
