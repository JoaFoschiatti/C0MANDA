import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [negocio, setNegocio] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario')
    const negocioGuardado = localStorage.getItem('negocio')

    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado))
    }

    if (negocioGuardado) {
      setNegocio(JSON.parse(negocioGuardado))
    }

    setLoading(false)
  }, [])

  const login = useCallback(async (email, password, options = {}) => {
    const response = await api.post('/auth/login', { email, password }, options)
    const { usuario: usuarioData, negocio: negocioData } = response.data

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

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Error during logout:', error)
    }

    localStorage.removeItem('usuario')
    localStorage.removeItem('negocio')
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
      login,
      logout,
      loading,
      esAdmin,
      esMozo,
      esCocinero,
      esCajero,
      esDelivery
    }
  }, [usuario, negocio, login, logout, loading])

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
