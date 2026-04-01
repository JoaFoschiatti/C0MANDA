import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Categorias from '../pages/admin/Categorias'
import api from '../services/api'
import toast from 'react-hot-toast'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('Categorias page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga y muestra categorias', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          nombre: 'Burgers',
          descripcion: null,
          orden: 1,
          activa: true,
          _count: { productos: 2 }
        }
      ]
    })

    render(<Categorias />)

    expect(await screen.findByText('Burgers')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/categorias')
    expect(screen.getByRole('button', { name: /Editar .*Burgers/i })).toHaveAttribute('title', 'Editar')
    expect(screen.getByRole('button', { name: /Eliminar .*Burgers/i })).toHaveAttribute('title', 'Eliminar')
  })

  it('crea una categoria desde el modal', async () => {
    api.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            nombre: 'Papas',
            descripcion: '',
            orden: 0,
            activa: true,
            _count: { productos: 0 }
          }
        ]
      })
    api.post.mockResolvedValueOnce({ data: { id: 1 } })

    const user = userEvent.setup()
    render(<Categorias />)

    await screen.findByRole('button', { name: /Nueva Categor/i })

    await user.click(screen.getByRole('button', { name: /Nueva Categor/i }))
    await user.type(screen.getByLabelText('Nombre'), 'Papas')
    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/categorias',
        expect.objectContaining({ nombre: 'Papas' })
      )
    })

    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Categor/))
    expect(await screen.findByText('Papas')).toBeInTheDocument()
  })
})
