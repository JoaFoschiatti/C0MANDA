import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'

const createInitialFormData = () => ({
  mesaId: '',
  clienteNombre: '',
  clienteTelefono: '',
  fechaHora: '',
  cantidadPersonas: 2,
  observaciones: '',
})

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const getDefaultFechaHora = () => {
  const ahora = new Date()
  ahora.setHours(ahora.getHours() + 1)
  ahora.setMinutes(0)
  return ahora.toISOString().slice(0, 16)
}

const toLocalDatetimeString = (isoDate) => {
  const date = new Date(isoDate)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function useReservasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reservas, setReservas] = useState([])
  const [mesas, setMesas] = useState([])
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])
  const [showModal, setShowModal] = useState(false)
  const [reservaEdit, setReservaEdit] = useState(null)
  const [formData, setFormData] = useState(createInitialFormData)
  const [reservaDetalle, setReservaDetalle] = useState(null)
  const pendingReservaId = useRef(searchParams.get('reservaId'))

  const cargarMesas = useCallback(async () => {
    const response = await api.get('/mesas')
    const mesasActivas = Array.isArray(response.data) ? response.data.filter((mesa) => mesa.activa) : []
    setMesas(mesasActivas)
    return mesasActivas
  }, [])

  const cargarReservas = useCallback(async () => {
    const response = await api.get(`/reservas?fecha=${fechaFiltro}`)
    const nextReservas = Array.isArray(response.data) ? response.data : []
    setReservas(nextReservas)
    return nextReservas
  }, [fechaFiltro])

  useAsync(useCallback(async () => cargarMesas(), [cargarMesas]), {
    onError: (error) => {
      console.error('Error:', error)
    },
  })

  const { loading, execute: cargarReservasAsync } = useAsync(
    useCallback(async () => cargarReservas(), [cargarReservas]),
    {
      onError: (error) => {
        console.error('Error:', error)
      },
    }
  )

  // Auto-open detail modal when navigating with ?reservaId=X
  useEffect(() => {
    const id = pendingReservaId.current
    if (!id || reservas.length === 0) return

    const found = reservas.find((r) => String(r.id) === id)
    if (found) {
      setReservaDetalle(found)
      pendingReservaId.current = null
      setSearchParams((prev) => { prev.delete('reservaId'); return prev }, { replace: true })
      return
    }

    // Reservation not in current date filter — fetch individually
    let cancelled = false
    api.get(`/reservas/${id}`, { skipToast: true })
      .then((res) => {
        if (!cancelled) {
          setReservaDetalle(res.data)
          pendingReservaId.current = null
          setSearchParams((prev) => { prev.delete('reservaId'); return prev }, { replace: true })
        }
      })
      .catch(() => {
        pendingReservaId.current = null
        setSearchParams((prev) => { prev.delete('reservaId'); return prev }, { replace: true })
      })

    return () => { cancelled = true }
  }, [reservas, setSearchParams])

  const abrirDetalleReserva = useCallback((reserva) => {
    setReservaDetalle(reserva)
  }, [])

  const cerrarDetalle = useCallback(() => {
    setReservaDetalle(null)
  }, [])

  const abrirNuevaReserva = useCallback(() => {
    setReservaEdit(null)
    setFormData({
      ...createInitialFormData(),
      fechaHora: getDefaultFechaHora(),
    })
    setShowModal(true)
  }, [])

  const abrirEditarReserva = useCallback((reserva) => {
    setReservaEdit(reserva)
    setFormData({
      mesaId: reserva.mesaId,
      clienteNombre: reserva.clienteNombre,
      clienteTelefono: reserva.clienteTelefono || '',
      fechaHora: toLocalDatetimeString(reserva.fechaHora),
      cantidadPersonas: reserva.cantidadPersonas,
      observaciones: reserva.observaciones || '',
    })
    setShowModal(true)
  }, [])

  const cerrarModal = useCallback(() => {
    setShowModal(false)
    setReservaEdit(null)
    setFormData(createInitialFormData())
  }, [])

  const guardarReserva = useCallback(
    async (event) => {
      event.preventDefault()

      try {
        if (reservaEdit) {
          await api.put(`/reservas/${reservaEdit.id}`, formData, { skipToast: true })
          toast.success('Reserva actualizada')
        } else {
          const mesaId = toPositiveInt(formData.mesaId)
          await api.post(
            '/reservas',
            {
              ...formData,
              mesaId,
            },
            { skipToast: true }
          )
          toast.success('Reserva creada')
        }

        cerrarModal()
        cargarReservasAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al guardar')
      }
    },
    [cargarReservasAsync, cerrarModal, formData, reservaEdit]
  )

  const cambiarEstado = useCallback(
    async (id, estado) => {
      try {
        await api.patch(`/reservas/${id}/estado`, { estado }, { skipToast: true })
        toast.success(
          estado === 'CLIENTE_PRESENTE'
            ? 'Cliente presente'
            : estado === 'NO_LLEGO'
              ? 'Marcado como no llego'
              : 'Reserva cancelada'
        )
        cargarReservasAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error')
      }
    },
    [cargarReservasAsync]
  )

  const eliminarReserva = useCallback(
    async (id) => {
      if (!globalThis.confirm?.('Eliminar esta reserva?')) {
        return
      }

      try {
        await api.delete(`/reservas/${id}`, { skipToast: true })
        toast.success('Reserva eliminada')
        cargarReservasAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error')
      }
    },
    [cargarReservasAsync]
  )

  const formatHora = useCallback(
    (fecha) =>
      new Date(fecha).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  )

  const reservasCount = useMemo(() => reservas.length, [reservas])

  return {
    abrirDetalleReserva,
    abrirEditarReserva,
    abrirNuevaReserva,
    cambiarEstado,
    cerrarDetalle,
    cerrarModal,
    eliminarReserva,
    fechaFiltro,
    formData,
    formatHora,
    guardarReserva,
    loading,
    mesas,
    reservaDetalle,
    reservas,
    reservasCount,
    reservaEdit,
    setFechaFiltro,
    setFormData,
    showModal,
  }
}
