import { useState, useEffect, useCallback } from 'react'

import api from '../services/api'
import useTimeout from './useTimeout'
import useAsync from './useAsync'
import { validateImageFile } from '../utils/file-validation'
import { normalizeHexColor } from '../utils/color'

const NEGOCIO_INICIAL = {
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
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
  mercadopago_qr_pos_id: '',
  mercadopago_qr_mode: 'dynamic',
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
  'mercadopago_qr_pos_id',
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
  const [savingNegocio, setSavingNegocio] = useState(false)
  const [config, setConfig] = useState(CONFIG_INICIAL)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [message, setMessage] = useState(null)
  const { set: setMessageTimeout } = useTimeout()

  const mostrarMensaje = useCallback(
    (texto, tipo = 'success') => {
      setMessage({ texto, tipo })
      setMessageTimeout(() => setMessage(null), 3000)
    },
    [setMessageTimeout]
  )

  const cargarDatos = useCallback(async () => {
    const [negocioResponse, configuracionResponse] = await Promise.all([
      api.get('/negocio', { skipToast: true }),
      api.get('/configuracion', { skipToast: true }),
    ])

    setNegocio({
      nombre: negocioResponse.data.nombre || '',
      email: negocioResponse.data.email || '',
      telefono: negocioResponse.data.telefono || '',
      direccion: negocioResponse.data.direccion || '',
      colorPrimario: normalizeHexColor(
        negocioResponse.data.colorPrimario,
        NEGOCIO_INICIAL.colorPrimario
      ),
      colorSecundario: normalizeHexColor(
        negocioResponse.data.colorSecundario,
        NEGOCIO_INICIAL.colorSecundario
      ),
    })

    const configData = {}
    Object.entries(configuracionResponse.data).forEach(([key, value]) => {
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

    setConfig((prev) => ({ ...prev, ...configData }))
  }, [])

  const { loading, execute: cargarDatosAsync } = useAsync(
    useCallback(async () => cargarDatos(), [cargarDatos]),
    {
      immediate: false,
      onError: () => mostrarMensaje('Error al cargar configuracion', 'error'),
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

  const guardarNegocio = async () => {
    setSavingNegocio(true)
    try {
      const payload = {
        ...negocio,
        colorPrimario: normalizeHexColor(negocio.colorPrimario, NEGOCIO_INICIAL.colorPrimario),
        colorSecundario: normalizeHexColor(negocio.colorSecundario, NEGOCIO_INICIAL.colorSecundario),
      }
      const response = await api.put('/negocio', payload, { skipToast: true })
      setNegocio((prev) => ({
        ...prev,
        ...response.data.negocio,
        colorPrimario: normalizeHexColor(
          response.data.negocio?.colorPrimario,
          payload.colorPrimario
        ),
        colorSecundario: normalizeHexColor(
          response.data.negocio?.colorSecundario,
          payload.colorSecundario
        ),
      }))
      mostrarMensaje('Datos del negocio guardados')
    } catch (error) {
      mostrarMensaje(error.response?.data?.error?.message || 'Error al guardar negocio', 'error')
    } finally {
      setSavingNegocio(false)
    }
  }

  const guardarConfiguracion = async () => {
    setSaving(true)
    try {
      const {
        facturacion_habilitada,
        facturacion_ambiente,
        facturacion_punto_venta,
        facturacion_cuit_emisor,
        facturacion_descripcion,
        facturacion_alicuota_iva,
        ...configGeneral
      } = config

      await Promise.all([
        api.put('/configuracion', configGeneral, { skipToast: true }),
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

      mostrarMensaje('Configuracion guardada correctamente')
    } catch (error) {
      mostrarMensaje(
        error.response?.data?.error?.message || 'Error al guardar configuracion',
        'error'
      )
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
      mostrarMensaje(validation.error, 'error')
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
      mostrarMensaje('Banner subido correctamente')
    } catch {
      mostrarMensaje('Error al subir banner', 'error')
    } finally {
      setUploadingBanner(false)
    }
  }

  const toggleTiendaAbierta = async () => {
    const nuevoEstado = !config.tienda_abierta
    handleConfigChange('tienda_abierta', nuevoEstado)

    try {
      await api.put('/configuracion/tienda_abierta', { valor: nuevoEstado }, { skipToast: true })
      mostrarMensaje(nuevoEstado ? 'Local abierto' : 'Local cerrado')
    } catch {
      handleConfigChange('tienda_abierta', !nuevoEstado)
      mostrarMensaje('Error al cambiar estado del local', 'error')
    }
  }

  return {
    backendUrl: DEFAULT_BACKEND_URL,
    cargarDatosAsync,
    config,
    frontendUrl: import.meta.env.VITE_FRONTEND_URL || window.location.origin,
    guardarConfiguracion,
    guardarNegocio,
    handleBannerUpload,
    handleConfigChange,
    handleNegocioChange,
    loading,
    message,
    negocio,
    saving,
    savingNegocio,
    setMessage,
    toggleTiendaAbierta,
    uploadingBanner,
  }
}
