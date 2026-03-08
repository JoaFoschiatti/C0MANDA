import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'

const initialForm = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  dni: '',
  telefono: '',
  direccion: '',
  rol: 'MOZO',
  tarifaHora: '',
}

export default function useUsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(initialForm)

  const cargarUsuarios = useCallback(async () => {
    const response = await api.get('/usuarios', { skipToast: true })
    const next = Array.isArray(response.data) ? response.data : []
    setUsuarios(next)
    return next
  }, [])

  const { loading, execute: cargarUsuariosAsync } = useAsync(
    useCallback(async () => cargarUsuarios(), [cargarUsuarios]),
    {
      onError: (error) => {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al cargar usuarios')
      },
    }
  )

  const resetForm = useCallback(() => {
    setForm(initialForm)
    setEditando(null)
  }, [])

  const abrirNuevoUsuario = useCallback(() => {
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
          // No enviar password al editar
          const { password, ...data } = form
          await api.put(`/usuarios/${editando.id}`, data, { skipToast: true })
          toast.success('Usuario actualizado')
        } else {
          await api.post('/usuarios', form, { skipToast: true })
          toast.success('Usuario creado')
        }

        cerrarModal()
        cargarUsuariosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al guardar usuario')
      }
    },
    [cargarUsuariosAsync, cerrarModal, editando, form]
  )

  const handleEdit = useCallback((usuario) => {
    setEditando(usuario)
    setForm({
      nombre: usuario.nombre,
      apellido: usuario.apellido || '',
      email: usuario.email,
      password: '',
      dni: usuario.dni || '',
      telefono: usuario.telefono || '',
      direccion: usuario.direccion || '',
      rol: usuario.rol,
      tarifaHora: usuario.tarifaHora || '',
    })
    setShowModal(true)
  }, [])

  const handleToggleActivo = useCallback(
    async (usuario) => {
      try {
        await api.put(`/usuarios/${usuario.id}`, { activo: !usuario.activo }, { skipToast: true })
        toast.success(usuario.activo ? 'Usuario desactivado' : 'Usuario reactivado')
        cargarUsuariosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al cambiar estado')
      }
    },
    [cargarUsuariosAsync]
  )

  return {
    abrirNuevoUsuario,
    cerrarModal,
    editando,
    usuarios,
    form,
    handleToggleActivo,
    handleEdit,
    handleSubmit,
    loading,
    setForm,
    showModal,
  }
}
