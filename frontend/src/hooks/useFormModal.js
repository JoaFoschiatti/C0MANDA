import { useState, useCallback } from 'react'

export default function useFormModal(initialForm, { mapToForm } = {}) {
  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(initialForm)

  const abrir = useCallback((item = null) => {
    setEditando(item)
    setForm(item && mapToForm ? mapToForm(item) : item ?? initialForm)
    setOpen(true)
  }, [initialForm, mapToForm])

  const cerrar = useCallback(() => {
    setOpen(false)
    setEditando(null)
    setForm(initialForm)
  }, [initialForm])

  return { open, editando, form, setForm, abrir, cerrar }
}
