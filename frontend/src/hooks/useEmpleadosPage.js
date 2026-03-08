import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'

const initialForm = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  direccion: '',
  rol: 'MOZO',
  tarifaHora: '',
}

export default function useEmpleadosPage() {
  const [empleados, setEmpleados] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(initialForm)

  const cargarEmpleados = useCallback(async () => {
    const response = await api.get('/empleados', { skipToast: true })
    const nextEmpleados = Array.isArray(response.data) ? response.data : []
    setEmpleados(nextEmpleados)
    return nextEmpleados
  }, [])

  const { loading, execute: cargarEmpleadosAsync } = useAsync(
    useCallback(async () => cargarEmpleados(), [cargarEmpleados]),
    {
      onError: (error) => {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al cargar empleados')
      },
    }
  )

  const resetForm = useCallback(() => {
    setForm(initialForm)
    setEditando(null)
  }, [])

  const abrirNuevoEmpleado = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const cerrarModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      try {
        if (editando) {
          await api.put(`/empleados/${editando.id}`, form, { skipToast: true })
          toast.success('Empleado actualizado')
        } else {
          await api.post('/empleados', form, { skipToast: true })
          toast.success('Empleado creado')
        }

        cerrarModal()
        cargarEmpleadosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al guardar empleado')
      }
    },
    [cargarEmpleadosAsync, cerrarModal, editando, form]
  )

  const handleEdit = useCallback((empleado) => {
    setEditando(empleado)
    setForm({
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      dni: empleado.dni,
      telefono: empleado.telefono || '',
      direccion: empleado.direccion || '',
      rol: empleado.rol,
      tarifaHora: empleado.tarifaHora,
    })
    setShowModal(true)
  }, [])

  const handleDelete = useCallback(
    async (id) => {
      if (!globalThis.confirm?.('Â¿Desactivar este empleado?')) {
        return
      }

      try {
        await api.delete(`/empleados/${id}`, { skipToast: true })
        toast.success('Empleado desactivado')
        cargarEmpleadosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al desactivar empleado')
      }
    },
    [cargarEmpleadosAsync]
  )

  return {
    abrirNuevoEmpleado,
    cerrarModal,
    editando,
    empleados,
    form,
    handleDelete,
    handleEdit,
    handleSubmit,
    loading,
    setForm,
    showModal,
  }
}
