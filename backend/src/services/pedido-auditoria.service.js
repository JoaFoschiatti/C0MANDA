const buildSnapshot = (value) => {
  if (!value) {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
};

const registrarAuditoriaPedido = async (tx, {
  pedidoId,
  usuarioId = null,
  accion,
  motivo = null,
  snapshotAntes = null,
  snapshotDespues = null
}) => {
  return tx.pedidoAuditoria.create({
    data: {
      pedidoId,
      usuarioId,
      accion,
      motivo,
      snapshotAntes: buildSnapshot(snapshotAntes),
      snapshotDespues: buildSnapshot(snapshotDespues)
    }
  });
};

module.exports = {
  buildSnapshot,
  registrarAuditoriaPedido
};
