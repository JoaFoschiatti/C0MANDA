-- CreateTable
CREATE TABLE "usuario_mfa" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "secretEncrypted" TEXT,
    "pendingSecret" TEXT,
    "pendingSecretExpiry" TIMESTAMP(3),
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_mfa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_mfa_recovery_codes" (
    "id" TEXT NOT NULL,
    "usuarioMfaId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_trusted_devices" (
    "id" TEXT NOT NULL,
    "usuarioMfaId" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "validatorHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercadopago_oauth_states" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "browserBindingHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercadopago_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_request_nonces" (
    "id" TEXT NOT NULL,
    "bridgeId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bridge_request_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_mfa_usuarioId_key" ON "usuario_mfa"("usuarioId");

-- CreateIndex
CREATE INDEX "usuario_mfa_recovery_codes_usuarioMfaId_usedAt_idx" ON "usuario_mfa_recovery_codes"("usuarioMfaId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_trusted_devices_selector_key" ON "usuario_trusted_devices"("selector");

-- CreateIndex
CREATE INDEX "usuario_trusted_devices_usuarioMfaId_expiresAt_idx" ON "usuario_trusted_devices"("usuarioMfaId", "expiresAt");

-- CreateIndex
CREATE INDEX "mercadopago_oauth_states_usuarioId_expiresAt_idx" ON "mercadopago_oauth_states"("usuarioId", "expiresAt");

-- CreateIndex
CREATE INDEX "mercadopago_oauth_states_expiresAt_idx" ON "mercadopago_oauth_states"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_request_nonces_bridgeId_nonce_key" ON "bridge_request_nonces"("bridgeId", "nonce");

-- CreateIndex
CREATE INDEX "bridge_request_nonces_expiresAt_idx" ON "bridge_request_nonces"("expiresAt");

-- AddForeignKey
ALTER TABLE "usuario_mfa" ADD CONSTRAINT "usuario_mfa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_mfa_recovery_codes" ADD CONSTRAINT "usuario_mfa_recovery_codes_usuarioMfaId_fkey" FOREIGN KEY ("usuarioMfaId") REFERENCES "usuario_mfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_trusted_devices" ADD CONSTRAINT "usuario_trusted_devices_usuarioMfaId_fkey" FOREIGN KEY ("usuarioMfaId") REFERENCES "usuario_mfa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_oauth_states" ADD CONSTRAINT "mercadopago_oauth_states_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
