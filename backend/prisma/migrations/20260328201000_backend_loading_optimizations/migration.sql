CREATE INDEX IF NOT EXISTS "pedidos_estado_created_at_idx"
  ON "pedidos" ("estado", "createdAt");

CREATE INDEX IF NOT EXISTS "pedidos_tipo_estado_created_at_idx"
  ON "pedidos" ("tipo", "estado", "createdAt");

CREATE INDEX IF NOT EXISTS "pedidos_repartidor_estado_created_at_idx"
  ON "pedidos" ("repartidorId", "estado", "createdAt");

CREATE INDEX IF NOT EXISTS "pagos_pedido_canal_estado_metodo_idx"
  ON "pagos" ("pedidoId", "canalCobro", "estado", "metodo");

CREATE INDEX IF NOT EXISTS "pagos_referencia_canal_created_at_idx"
  ON "pagos" ("referencia", "canalCobro", "createdAt");

CREATE INDEX IF NOT EXISTS "pagos_pedido_metodo_preference_created_at_idx"
  ON "pagos" ("pedidoId", "metodo", "mpPreferenceId", "createdAt");
