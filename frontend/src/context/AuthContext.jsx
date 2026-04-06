import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import api from '../services/api'
import { clearQueue } from '../utils/offline-queue'
import { clearPendingMercadoPagoOrder } from '../utils/public-storage'

const AuthContext = createContext(null)

const readStoredJson = (key) => {
  try {
    const rawValue = localStorage.getItem(key)
    if (!rawValue) {
      return null
    }

    return JSON.parse(rawValue)
  } catch (error) {
    localStorage.removeItem(key)
    return null
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [negocio, setNegocio] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUsuario(readStoredJson('usuario'))
    setNegocio(readStoredJson('negocio'))
    setLoading(false)
  }, [])

  const finishSession = useCallback((sessionData) => {
    const { usuario: usuarioData, negocio: negocioData } = sessionData || {}

    if (!usuarioData) {
      return null
    }

    localStorage.setItem('usuario', JSON.stringify(usuarioData))
    setUsuario(usuarioData)

    if (negocioData) {
      localStorage.setItem('negocio', JSON.stringify(negocioData))
      setNegocio(negocioData)
    } else {
      localStorage.removeItem('negocio')
      setNegocio(null)
    }

    return { usuario: usuarioData, negocio: negocioData }
  }, [])

  const login = useCallback(async (email, password, options = {}) => {
    const controller = new AbortController()
    const response = await api.post('/auth/login', { email, password }, {
      ...options,
      signal: controller.signal
    })

    if (response.status === 202) {
      return response.data
    }

    return finishSession(response.data)
  }, [finishSession])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Error during logout:', error)
    }

    localStorage.removeItem('usuario')
    localStorage.removeItem('negocio')
    clearQueue()
    clearPendingMercadoPagoOrder()
    setUsuario(null)
    setNegocio(null)
  }, [])

  const value = useMemo(() => {
    const esAdmin = usuario?.rol === 'ADMIN'
    const esMozo = usuario?.rol === 'MOZO' || esAdmin
    const esCocinero = usuario?.rol === 'COCINERO' || esAdmin
    const esCajero = usuario?.rol === 'CAJERO' || esAdmin
    const esDelivery = usuario?.rol === 'DELIVERY' || esAdmin

    return {
      usuario,
      negocio,
      finishSession,
      login,
      logout,
      loading,
      esAdmin,
      esMozo,
      esCocinero,
      esCajero,
      esDelivery
    }
  }, [usuario, negocio, finishSession, login, logout, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
