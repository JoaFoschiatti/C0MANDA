import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'
import { validateImageFile } from '../utils/file-validation'
import { normalizeHexColor } from '../utils/color'

const NEGOCIO_INICIAL = {
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
  logo: '',
  colorPrimario: '#3B82F6',
  colorSecundario: '#1E40AF',
}

const CONFIG_INICIAL = {
  tienda_abierta: true,
  horario_apertura: '11:00',
  horario_cierre: '23:00',
  nombre_negocio: '',
  tagline_negocio: '',
  banner_imagen: '',
  costo_delivery: 0,
  delivery_habilitado: true,
  direccion_retiro: '',
  mercadopago_enabled: false,
  mercadopago_transfer_alias: '',
  mercadopago_transfer_titular: '',
  mercadopago_transfer_cvu: '',
  efectivo_enabled: true,
  whatsapp_numero: '',
  facturacion_habilitada: false,
  facturacion_ambiente: 'homologacion',
  facturacion_punto_venta: 1,
  facturacion_cuit_emisor: '',
  facturacion_descripcion: '',
  facturacion_alicuota_iva: 21,
}

const TEXT_CONFIG_KEYS = new Set([
  'horario_apertura',
  'horario_cierre',
  'mercadopago_transfer_alias',
  'mercadopago_transfer_titular',
  'mercadopago_transfer_cvu',
  'whatsapp_numero',
  'facturacion_cuit_emisor',
  'facturacion_descripcion',
  'nombre_negocio',
  'tagline_negocio',
  'banner_imagen',
  'direccion_retiro',
])

const DEFAULT_BACKEND_URL = (import.meta.env.VITE_API_URL || '/api').replace('/api', '')

export default function useConfiguracionPage() {
  const [negocio, setNegocio] = useState(NEGOCIO_INICIAL)
  const [config, setConfig] = useState(CONFIG_INICIAL)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Dirty state tracking — snapshot of last saved state
  const savedNegocioRef = useRef(NEGOCIO_INICIAL)
  const savedConfigRef = useRef(CONFIG_INICIAL)

  const isDirty = useCallback(() => {
    const negocioDirty = JSON.stringify(negocio) !== JSON.stringify(savedNegocioRef.current)
    const configDirty = JSON.stringify(config) !== JSON.stringify(savedConfigRef.current)
    return negocioDirty || configDirty
  }, [negocio, config])

  // beforeunload warning when there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (isDirty()) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const parseConfigData = (raw) => {
    const configData = {}
    Object.entries(raw).forEach(([key, value]) => {
      if (value === 'true') {
        configData[key] = true
      } else if (value === 'false') {
        configData[key] = false
      } else if (value !== '' && !Number.isNaN(Number(value)) && !TEXT_CONFIG_KEYS.has(key)) {
        configData[key] = Number(value)
      } else {
        configData[key] = value
      }
    })
    return configData
  }

  const cargarDatos = useCallback(async () => {
    const [negocioResponse, configuracionResponse] = await Promise.all([
      api.get('/negocio', { skipToast: true }),
      api.get('/configuracion', { skipToast: true }),
    ])

    const loadedNegocio = {
      nombre: negocioResponse.data.nombre || '',
      email: negocioResponse.data.email || '',
      telefono: negocioResponse.data.telefono || '',
      direccion: negocioResponse.data.direccion || '',
      logo: negocioResponse.data.logo || '',
      colorPrimario: normalizeHexColor(
        negocioResponse.data.colorPrimario,
        NEGOCIO_INICIAL.colorPrimario
      ),
      colorSecundario: normalizeHexColor(
        negocioResponse.data.colorSecundario,
        NEGOCIO_INICIAL.colorSecundario
      ),
    }

    const configData = parseConfigData(configuracionResponse.data)
    const loadedConfig = { ...CONFIG_INICIAL, ...configData }

    setNegocio(loadedNegocio)
    setConfig(loadedConfig)
    setLoadError(null)

    // Snapshot for dirty tracking
    savedNegocioRef.current = loadedNegocio
    savedConfigRef.current = loadedConfig
  }, [])

  const { loading, execute: cargarDatosAsync } = useAsync(
    useCallback(async () => cargarDatos(), [cargarDatos]),
    {
      immediate: false,
      onError: () => setLoadError('No pudimos cargar la configuracion. Verifica tu conexion.'),
    }
  )

  useEffect(() => {
    cargarDatosAsync().catch(() => {})
  }, [cargarDatosAsync])

  const handleNegocioChange = useCallback((key, value) => {
    setNegocio((prev) => {
      if (key === 'colorPrimario') {
        return { ...prev, colorPrimario: normalizeHexColor(value, prev.colorPrimario) }
      }

      if (key === 'colorSecundario') {
        return { ...prev, colorSecundario: normalizeHexColor(value, prev.colorSecundario) }
      }

      return { ...prev, [key]: value }
    })
  }, [])

  const handleConfigChange = useCallback((key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const persistNegocio = useCallback(async (payload) => {
    const response = await api.put('/negocio', payload, { skipToast: true })
    setNegocio((prev) => ({
      ...prev,
      ...response.data.negocio,
      colorPrimario: normalizeHexColor(response.data.negocio?.colorPrimario, payload.colorPrimario),
      colorSecundario: normalizeHexColor(
        response.data.negocio?.colorSecundario,
        payload.colorSecundario
      ),
    }))
    return response
  }, [])

  // Unified save — saves identity + operational config + facturacion in one click
  const guardarTodo = async () => {
    setSaving(true)
    try {
      const negocioPayload = {
        ...negocio,
        colorPrimario: normalizeHexColor(negocio.colorPrimario, NEGOCIO_INICIAL.colorPrimario),
        colorSecundario: normalizeHexColor(negocio.colorSecundario, NEGOCIO_INICIAL.colorSecundario),
      }

      const {
        nombre_negocio,
        tagline_negocio,
        banner_imagen,
        facturacion_habilitada,
        facturacion_ambiente,
        facturacion_punto_venta,
        facturacion_cuit_emisor,
        facturacion_descripcion,
        facturacion_alicuota_iva,
        ...configGeneral
      } = config

      await Promise.all([
        persistNegocio(negocioPayload),
        api.put(
          '/configuracion',
          { ...configGeneral, tagline_negocio: tagline_negocio || '' },
          { skipToast: true }
        ),
        api.put(
          '/facturacion/configuracion',
          {
            puntoVenta: Number(facturacion_punto_venta) || 1,
            ambiente: facturacion_ambiente,
            cuitEmisor: facturacion_cuit_emisor || '',
            descripcion: facturacion_descripcion || '',
            alicuotaIva: Number(facturacion_alicuota_iva) || 21,
            habilitada: Boolean(facturacion_habilitada),
          },
          { skipToast: true }
        ),
      ])

      // Update dirty tracking snapshot after successful save
      savedNegocioRef.current = { ...negocio }
      savedConfigRef.current = { ...config }

      toast.success('Configuracion guardada')
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al guardar configuracion')
    } finally {
      setSaving(false)
    }
  }

  const handleBannerUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const validation = validateImageFile(file)
    if (!validation.ok) {
      toast.error(validation.error)
      event.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('banner', file)

    setUploadingBanner(true)
    try {
      const response = await api.post('/configuracion/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true,
      })
      setConfig((prev) => ({ ...prev, banner_imagen: response.data.url }))
      savedConfigRef.current = { ...savedConfigRef.current, banner_imagen: response.data.url }
      toast.success('Banner subido')
    } catch {
      toast.error('Error al subir banner')
    } finally {
      setUploadingBanner(false)
      event.target.value = ''
    }
  }

  const handleBannerRemove = async () => {
    if (!config.banner_imagen) {
      return
    }

    const previousBanner = config.banner_imagen
    setConfig((prev) => ({ ...prev, banner_imagen: '' }))

    try {
      await api.put('/configuracion', { banner_imagen: '' }, { skipToast: true })
      savedConfigRef.current = { ...savedConfigRef.current, banner_imagen: '' }
      toast.success('Banner eliminado')
    } catch (error) {
      setConfig((prev) => ({ ...prev, banner_imagen: previousBanner }))
      toast.error(error.response?.data?.error?.message || 'Error al quitar banner')
    }
  }

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const validation = validateImageFile(file)
    if (!validation.ok) {
      toast.error(validation.error)
      event.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('logo', file)

    setUploadingLogo(true)
    try {
      const response = await api.post('/negocio/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipToast: true,
      })
      setNegocio((prev) => ({ ...prev, logo: response.data.url }))
      savedNegocioRef.current = { ...savedNegocioRef.current, logo: response.data.url }
      toast.success('Logo subido')
    } catch {
      toast.error('Error al subir logo')
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    if (!negocio.logo) {
      return
    }

    const previousLogo = negocio.logo
    setNegocio((prev) => ({ ...prev, logo: '' }))

    try {
      await api.put('/negocio', { logo: '' }, { skipToast: true })
      savedNegocioRef.current = { ...savedNegocioRef.current, logo: '' }
      toast.success('Logo eliminado')
    } catch (error) {
      setNegocio((prev) => ({ ...prev, logo: previousLogo }))
      toast.error(error.response?.data?.error?.message || 'Error al quitar logo')
    }
  }

  const toggleTiendaAbierta = async () => {
    const nuevoEstado = !config.tienda_abierta
    handleConfigChange('tienda_abierta', nuevoEstado)
    savedConfigRef.current = { ...savedConfigRef.current, tienda_abierta: nuevoEstado }

    try {
      await api.put('/configuracion/tienda_abierta', { valor: nuevoEstado }, { skipToast: true })
      toast.success(nuevoEstado ? 'Local abierto' : 'Local cerrado')
    } catch {
      handleConfigChange('tienda_abierta', !nuevoEstado)
      savedConfigRef.current = { ...savedConfigRef.current, tienda_abierta: !nuevoEstado }
      toast.error('Error al cambiar estado del local')
    }
  }

  // Save hours immediately on blur (like the toggle)
  const guardarHorario = async (key, value) => {
    handleConfigChange(key, value)
    const prevValue = savedConfigRef.current[key]
    savedConfigRef.current = { ...savedConfigRef.current, [key]: value }

    try {
      await api.put(`/configuracion/${key}`, { valor: value }, { skipToast: true })
    } catch {
      savedConfigRef.current = { ...savedConfigRef.current, [key]: prevValue }
      toast.error('Error al guardar horario')
    }
  }

  return {
    backendUrl: DEFAULT_BACKEND_URL,
    cargarDatosAsync,
    config,
    frontendUrl: import.meta.env.VITE_FRONTEND_URL || window.location.origin,
    guardarTodo,
    handleBannerRemove,
    handleBannerUpload,
    handleConfigChange,
    handleLogoRemove,
    handleLogoUpload,
    handleNegocioChange,
    isDirty,
    loading,
    loadError,
    negocio,
    saving,
    toggleTiendaAbierta,
    guardarHorario,
    uploadingBanner,
    uploadingLogo,
  }
}
