import { KeyIcon } from '@heroicons/react/24/outline'

export default function MfaVerifyForm({
  verificationCode,
  onVerificationCodeChange,
  trustDevice,
  onTrustDeviceChange,
  loading,
  onSubmit,
  onSwitchToRecovery,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
        Ingresa el codigo de 6 digitos que genera tu app autenticadora.
      </div>

      <div className="input-group">
        <label className="label">Codigo de verificacion</label>
        <div className="relative">
          <KeyIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            inputMode="numeric"
            className="glass-input"
            value={verificationCode}
            onChange={onVerificationCodeChange}
            placeholder="123456"
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
        {loading ? 'Verificando...' : 'Validar codigo'}
      </button>

      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={onSwitchToRecovery}
        disabled={loading}
      >
        Usar codigo de recuperacion
      </button>
    </form>
  )
}
