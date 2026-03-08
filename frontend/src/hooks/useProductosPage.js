import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

import api from '../services/api'
import useAsync from './useAsync'
import { validateImageFile } from '../utils/file-validation'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const BACKEND_URL = API_URL.replace('/api', '')

const initialForm = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoriaId: '',
  disponible: true,
  destacado: false,
}

const initialVarianteForm = {
  nombreVariante: '',
  precio: '',
  multiplicadorInsumos: '1.0',
  ordenVariante: '0',
  esVariantePredeterminada: false,
  descripcion: '',
}

const initialAgruparForm = {
  productoBaseId: '',
  productosSeleccionados: [],
}

export default function useProductosPage() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showVarianteModal, setShowVarianteModal] = useState(false)
  const [showAgruparModal, setShowAgruparModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [productoBase, setProductoBase] = useState(null)
  const [expandedProducts, setExpandedProducts] = useState({})
  const [vistaAgrupada, setVistaAgrupada] = useState(true)
  const [imagePreview, setImagePreview] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [varianteForm, setVarianteForm] = useState(initialVarianteForm)
  const [agruparForm, setAgruparForm] = useState(initialAgruparForm)

  const cargarDatos = useCallback(async () => {
    const endpoint = vistaAgrupada ? '/productos/con-variantes' : '/productos'
    const [productosResponse, categoriasResponse] = await Promise.all([
      api.get(endpoint, { skipToast: true }),
      api.get('/categorias', { skipToast: true }),
    ])

    setProductos(productosResponse.data)
    setCategorias(categoriasResponse.data)
    return {
      productos: productosResponse.data,
      categorias: categoriasResponse.data,
    }
  }, [vistaAgrupada])

  const handleLoadError = useCallback((error) => {
    console.error('Error:', error)
    if (error.response?.status !== 401) {
      toast.error(error.response?.data?.error?.message || 'Error al cargar datos')
    }
  }, [])

  const { loading, execute: cargarDatosAsync } = useAsync(
    useCallback(async () => cargarDatos(), [cargarDatos]),
    { onError: handleLoadError }
  )

  const resetForm = useCallback(() => {
    setForm(initialForm)
    setEditando(null)
    setImagePreview(null)
  }, [])

  const resetVarianteForm = useCallback(() => {
    setVarianteForm(initialVarianteForm)
    setProductoBase(null)
  }, [])

  const resetAgruparForm = useCallback(() => {
    setAgruparForm(initialAgruparForm)
  }, [])

  const abrirNuevoProducto = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const cerrarProductoModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const cerrarVarianteModal = useCallback(() => {
    setShowVarianteModal(false)
    resetVarianteForm()
  }, [resetVarianteForm])

  const cerrarAgruparModal = useCallback(() => {
    setShowAgruparModal(false)
    resetAgruparForm()
  }, [resetAgruparForm])

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      const formData = new FormData()
      formData.append('nombre', form.nombre)
      formData.append('descripcion', form.descripcion || '')
      formData.append('precio', parseFloat(form.precio))
      formData.append('categoriaId', form.categoriaId)
      formData.append('disponible', form.disponible)
      formData.append('destacado', form.destacado)

      if (form.imagen instanceof File) {
        formData.append('imagen', form.imagen)
      }

      if (editando) {
        await api.put(`/productos/${editando.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('Producto actualizado')
      } else {
        await api.post('/productos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success('Producto creado')
      }

      cerrarProductoModal()
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleCrearVariante = async (event) => {
    event.preventDefault()

    try {
      await api.post(`/productos/${productoBase.id}/variantes`, {
        ...varianteForm,
        precio: parseFloat(varianteForm.precio),
        multiplicadorInsumos: parseFloat(varianteForm.multiplicadorInsumos),
        ordenVariante: parseInt(varianteForm.ordenVariante, 10),
      })
      toast.success('Variante creada')
      cerrarVarianteModal()
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleAgruparVariantes = async (event) => {
    event.preventDefault()

    try {
      const variantes = agruparForm.productosSeleccionados.map((producto, index) => ({
        productoId: producto.id,
        nombreVariante: producto.nombreVariante || `Variante ${index + 1}`,
        multiplicadorInsumos: parseFloat(producto.multiplicadorInsumos) || 1.0,
        ordenVariante: index,
        esVariantePredeterminada: index === 0,
      }))

      await api.post('/productos/agrupar-variantes', {
        productoBaseId: parseInt(agruparForm.productoBaseId, 10),
        variantes,
      })
      toast.success('Productos agrupados como variantes')
      cerrarAgruparModal()
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDesagrupar = async (productoId) => {
    if (!confirm('Desagrupar esta variante como producto independiente?')) {
      return
    }

    try {
      await api.delete(`/productos/${productoId}/desagrupar`)
      toast.success('Variante desagrupada')
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleEdit = useCallback((producto) => {
    setEditando(producto)
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio,
      categoriaId: producto.categoriaId,
      disponible: producto.disponible,
      destacado: producto.destacado,
    })

    if (producto.imagen) {
      const imageUrl = producto.imagen.startsWith('http')
        ? producto.imagen
        : `${BACKEND_URL}${producto.imagen}`
      setImagePreview(imageUrl)
    } else {
      setImagePreview(null)
    }

    setShowModal(true)
  }, [])

  const handleToggleDisponible = async (producto) => {
    try {
      await api.patch(`/productos/${producto.id}/disponibilidad`, {
        disponible: !producto.disponible,
      })
      toast.success(producto.disponible ? 'Producto desactivado' : 'Producto activado')
      cargarDatosAsync()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const toggleExpanded = useCallback((productoId) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }))
  }, [])

  const openVarianteModal = useCallback((producto) => {
    setProductoBase(producto)
    setVarianteForm((prev) => ({
      ...prev,
      precio: producto.precio,
      ordenVariante: (producto.variantes?.length || 0).toString(),
    }))
    setShowVarianteModal(true)
  }, [])

  const handleImageChange = (event) => {
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

    setForm((prev) => ({ ...prev, imagen: file }))
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const productosDisponiblesParaAgrupar = productos.filter(
    (producto) =>
      producto.productoBaseId === null && producto.id !== parseInt(agruparForm.productoBaseId, 10)
  )

  return {
    agruparForm,
    cargarDatosAsync,
    categorias,
    cerrarAgruparModal,
    cerrarProductoModal,
    cerrarVarianteModal,
    editando,
    expandedProducts,
    form,
    handleAgruparVariantes,
    handleCrearVariante,
    handleDesagrupar,
    handleEdit,
    handleImageChange,
    handleSubmit,
    handleToggleDisponible,
    imagePreview,
    loading,
    openVarianteModal,
    productoBase,
    productos,
    productosDisponiblesParaAgrupar,
    resetAgruparForm,
    resetVarianteForm,
    setAgruparForm,
    setForm,
    setShowAgruparModal,
    setShowModal,
    setShowVarianteModal,
    setVarianteForm,
    setVistaAgrupada,
    showAgruparModal,
    showModal,
    showVarianteModal,
    toggleExpanded,
    abrirNuevoProducto,
    varianteForm,
    vistaAgrupada,
  }
}
