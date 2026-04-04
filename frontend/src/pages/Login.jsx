import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'

import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MfaSetupForm from '../components/auth/MfaSetupForm'
import MfaVerifyForm from '../components/auth/MfaVerifyForm'
import MfaRecoveryForm from '../components/auth/MfaRecoveryForm'

const MFA_STEP = {
  NONE: 'NONE',
  SETUP: 'SETUP',
  VERIFY: 'VERIFY',
  RECOVERY: 'RECOVERY',
  RECOVERY_CODES: 'RECOVERY_CODES'
}

const initialChallengeState = {
  step: MFA_STEP.NONE,
  usuario: null,
  setupData: null,
  recoveryCodes: [],
  trustDevice: false
}

export default function Login() {
  const navigate = useNavigate()
  const { finishSession, login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [challenge, setChallenge] = useState(initialChallengeState)

  const resetChallengeFields = useCallback(() => {
    setVerificationCode('')
    setRecoveryCode('')
  }, [])

  const handleAuthError = useCallback((requestError, fallbackMessage) => {
    const message = requestError.response?.data?.error?.message || fallbackMessage
    setError(message)
  }, [])

  const loadMfaSetup = useCallback(async () => {
    const response = await api.get('/auth/mfa/setup', { skipToast: true })
    setChallenge((current) => ({
      ...current,
      step: MFA_STEP.SETUP,
      setupData: response.data
    }))
    return response.data
  }, [])

  const completeLogin = useCallback((sessionData, successMessage = 'Bienvenido!') => {
    finishSession(sessionData)
    toast.success(successMessage)
    navigate('/dashboard')
  }, [finishSession, navigate])

  const handleCredentialsSubmit = useCallback(async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await login(email, password, { skipToast: true })

      if (result?.next === 'MFA_SETUP_REQUIRED') {
        setChallenge({
          step: MFA_STEP.SETUP,
          usuario: result.usuario || null,
          setupData: null,
          recoveryCodes: [],
          trustDevice: false
        })
        resetChallengeFields()
        await loadMfaSetup()
        return
      }

      if (result?.next === 'MFA_VERIFY_REQUIRED') {
        setChallenge({
          step: MFA_STEP.VERIFY,
          usuario: result.usuario || null,
          setupData: null,
          recoveryCodes: [],
          trustDevice: false
        })
        resetChallengeFields()
        return
      }

      completeLogin(result)
    } catch (requestError) {
      handleAuthError(requestError, 'Error al iniciar sesion')
    } finally {
      setLoading(false)
    }
  }, [
    completeLogin,
    email,
    handleAuthError,
    loadMfaSetup,
    login,
    password,
    resetChallengeFields
  ])

  const handleSetupConfirm = useCallback(async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/auth/mfa/setup/confirm', {
        code: verificationCode,
        trustDevice: challenge.trustDevice
      }, { skipToast: true })

      finishSession(response.data)
      setChallenge((current) => ({
        ...current,
        step: MFA_STEP.RECOVERY_CODES,
        recoveryCodes: response.data.recoveryCodes || []
      }))
      setVerificationCode('')
    } catch (requestError) {
      handleAuthError(requestError, 'No pudimos confirmar el codigo')
    } finally {
      setLoading(false)
    }
  }, [challenge.trustDevice, finishSession, handleAuthError, verificationCode])

  const handleVerifySubmit = useCallback(async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/auth/mfa/verify', {
        code: verificationCode,
        trustDevice: challenge.trustDevice
      }, { skipToast: true })

      completeLogin(response.data)
    } catch (requestError) {
      handleAuthError(requestError, 'Codigo de verificacion invalido')
    } finally {
      setLoading(false)
    }
  }, [challenge.trustDevice, completeLogin, handleAuthError, verificationCode])

  const handleRecoverySubmit = useCallback(async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/auth/mfa/recovery', {
        recoveryCode,
        trustDevice: challenge.trustDevice
      }, { skipToast: true })

      completeLogin(response.data, 'Acceso recuperado correctamente')
    } catch (requestError) {
      handleAuthError(requestError, 'Codigo de recuperacion invalido')
    } finally {
      setLoading(false)
    }
  }, [challenge.trustDevice, completeLogin, handleAuthError, recoveryCode])

  const challengeTitle = useMemo(() => {
    switch (challenge.step) {
      case MFA_STEP.SETUP:
        return 'Configurar verificacion'
      case MFA_STEP.VERIFY:
        return 'Verificar identidad'
      case MFA_STEP.RECOVERY:
        return 'Recuperar acceso'
      case MFA_STEP.RECOVERY_CODES:
        return 'Guarda tus codigos'
      default:
        return 'Accede a tu cuenta'
    }
  }, [challenge.step])

  const handleVerificationCodeChange = useCallback((event) => {
    setVerificationCode(event.target.value)
    setError(null)
  }, [])

  const handleRecoveryCodeChange = useCallback((event) => {
    setRecoveryCode(event.target.value)
    setError(null)
  }, [])

  const handleTrustDeviceChange = useCallback((event) => {
    setChallenge((current) => ({ ...current, trustDevice: event.target.checked }))
  }, [])

  const handleRetrySetup = useCallback(() => {
    setError(null)
    setLoading(true)
    loadMfaSetup()
      .catch((requestError) => handleAuthError(requestError, 'No pudimos cargar el QR'))
      .finally(() => setLoading(false))
  }, [handleAuthError, loadMfaSetup])

  const handleSwitchToRecovery = useCallback(() => {
    setChallenge((current) => ({ ...current, step: MFA_STEP.RECOVERY }))
    setError(null)
  }, [])

  const handleSwitchToVerify = useCallback(() => {
    setChallenge((current) => ({ ...current, step: MFA_STEP.VERIFY }))
    setError(null)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center login-gradient-bg overflow-hidden relative px-4">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="glass-card w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <img src="/comanda-logo.png" alt="Comanda" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
          <h1 className="text-heading-1">Comanda</h1>
          <p className="text-text-secondary mt-2">{challengeTitle}</p>
          {challenge.usuario && (
            <p className="text-xs text-text-tertiary mt-2">
              {challenge.usuario.nombre} · {challenge.usuario.rol}
            </p>
          )}
        </div>

        {error && (
          <div className="alert alert-error mb-5" role="alert">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {challenge.step === MFA_STEP.NONE && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5">
            <div className="input-group">
              <label className="label">Email</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                <input
                  type="email"
                  className="glass-input"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError(null)
                  }}
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="label">Contrasena</label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="glass-input pr-12"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-glass-primary mt-6" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="spinner spinner-sm border-white/30 border-t-white" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        )}

        {challenge.step === MFA_STEP.SETUP && (
          <MfaSetupForm
            setupData={challenge.setupData}
            verificationCode={verificationCode}
            onVerificationCodeChange={handleVerificationCodeChange}
            trustDevice={challenge.trustDevice}
            onTrustDeviceChange={handleTrustDeviceChange}
            loading={loading}
            onSubmit={handleSetupConfirm}
            onRetrySetup={handleRetrySetup}
          />
        )}

        {challenge.step === MFA_STEP.VERIFY && (
          <MfaVerifyForm
            verificationCode={verificationCode}
            onVerificationCodeChange={handleVerificationCodeChange}
            trustDevice={challenge.trustDevice}
            onTrustDeviceChange={handleTrustDeviceChange}
            loading={loading}
            onSubmit={handleVerifySubmit}
            onSwitchToRecovery={handleSwitchToRecovery}
          />
        )}

        {challenge.step === MFA_STEP.RECOVERY && (
          <MfaRecoveryForm
            recoveryCode={recoveryCode}
            onRecoveryCodeChange={handleRecoveryCodeChange}
            trustDevice={challenge.trustDevice}
            onTrustDeviceChange={handleTrustDeviceChange}
            loading={loading}
            onSubmit={handleRecoverySubmit}
            onSwitchToVerify={handleSwitchToVerify}
          />
        )}

        {challenge.step === MFA_STEP.RECOVERY_CODES && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
              Guarda estos codigos. Cada uno sirve una sola vez si pierdes el telefono.
            </div>

            <div className="grid grid-cols-2 gap-3">
              {challenge.recoveryCodes.map((code) => (
                <div
                  key={code}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center font-mono text-sm text-text-primary"
                >
                  {code}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-glass-primary"
              onClick={() => {
                toast.success('MFA configurado correctamente')
                navigate('/dashboard')
              }}
            >
              Continuar al dashboard
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-white/12 pt-4 text-center text-sm text-text-secondary">
          Si no tienes acceso, solicita un usuario al administrador del local.
        </div>
      </div>
    </div>
  )
}
