-- CreateEnum
CREATE TYPE "EstadoIdempotentRequest" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "idempotent_requests" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "EstadoIdempotentRequest" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotent_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotent_requests_usuario_operacion_key" ON "idempotent_requests"("usuarioId", "operation", "idempotencyKey");

-- CreateIndex
CREATE INDEX "idempotent_requests_status_updatedAt_idx" ON "idempotent_requests"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "idempotent_requests_createdAt_idx" ON "idempotent_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "idempotent_requests" ADD CONSTRAINT "idempotent_requests_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
