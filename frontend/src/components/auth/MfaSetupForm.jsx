import { QRCodeSVG } from 'qrcode.react'
import { KeyIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function MfaSetupForm({
  setupData,
  verificationCode,
  onVerificationCodeChange,
  trustDevice,
  onTrustDeviceChange,
  loading,
  onSubmit,
  onRetrySetup,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
        <div className="flex items-center gap-2 text-text-primary font-medium mb-2">
          <ShieldCheckIcon className="w-5 h-5" />
          Configura una app autenticadora
        </div>
        <p>Escanea este QR con Google Authenticator, Microsoft Authenticator o Authy.</p>
      </div>

      {setupData?.otpauthUrl ? (
        <div className="rounded-2xl bg-white p-4 flex justify-center">
          <QRCodeSVG value={setupData.otpauthUrl} size={180} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-text-secondary">
          No pudimos cargar el QR todavia.
          <button
            type="button"
            className="btn btn-secondary mt-3 w-full"
            onClick={onRetrySetup}
            disabled={loading}
          >
            Reintentar QR
          </button>
        </div>
      )}

      {setupData?.manualEntryKey && (
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary mb-2">Clave manual</p>
          <p className="font-mono text-sm tracking-[0.2em] text-text-primary break-all">
            {setupData.manualEntryKey}
          </p>
        </div>
      )}

      <div className="input-group">
        <label className="label">Codigo de la app</label>
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

      <button type="submit" className="btn-glass-primary" disabled={loading || !setupData}>
        {loading ? 'Verificando...' : 'Activar verificacion'}
      </button>
    </form>
  )
}
