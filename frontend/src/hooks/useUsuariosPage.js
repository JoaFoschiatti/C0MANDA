import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'
import useFormModal from './useFormModal'

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

const mapUsuarioToForm = (usuario) => ({
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

export default function useUsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const { open: showModal, editando, form, setForm, abrir: abrirModal, cerrar: cerrarModal } =
    useFormModal(initialForm, { mapToForm: mapUsuarioToForm })

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

  const abrirNuevoUsuario = useCallback(() => abrirModal(), [abrirModal])

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

  const handleEdit = useCallback((usuario) => abrirModal(usuario), [abrirModal])

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

  const handleResetMfa = useCallback(
    async (usuario) => {
      try {
        await api.post(`/usuarios/${usuario.id}/mfa/reset`, {}, { skipToast: true })
        toast.success(`MFA reiniciado para ${usuario.nombre}`)
        cargarUsuariosAsync()
      } catch (error) {
        console.error('Error:', error)
        toast.error(error.response?.data?.error?.message || 'Error al reiniciar MFA')
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
    handleResetMfa,
    handleSubmit,
    loading,
    setForm,
    showModal,
  }
}
