import { KeyIcon } from '@heroicons/react/24/outline'

export default function MfaRecoveryForm({
  recoveryCode,
  onRecoveryCodeChange,
  trustDevice,
  onTrustDeviceChange,
  loading,
  onSubmit,
  onSwitchToVerify,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
        Usa uno de tus codigos de recuperacion de un solo uso.
      </div>

      <div className="input-group">
        <label className="label">Codigo de recuperacion</label>
        <div className="relative">
          <KeyIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            className="glass-input"
            value={recoveryCode}
            onChange={onRecoveryCodeChange}
            placeholder="ABCD-EFGH"
            required
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-text-secondary">
        <input
          type="checkbox"
          className="mt-1"
          checked={trustDevice}
          onChange={onTrustDeviceChange}
        />
        <span>Recordar este dispositivo durante 30 dias.</span>
      </label>

      <button type="submit" className="btn-glass-primary" disabled={loading}>
        {loading ? 'Validando...' : 'Recuperar acceso'}
      </button>

      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={onSwitchToVerify}
        disabled={loading}
      >
        Volver al codigo de la app
      </button>
    </form>
  )
}
