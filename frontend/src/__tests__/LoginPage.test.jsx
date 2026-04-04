import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Login from '../pages/Login'
import toast from 'react-hot-toast'

const mockNavigate = vi.fn()
const mockLogin = vi.fn()
const mockFinishSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    finishSession: mockFinishSession
  })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inicia sesion y navega al dashboard', async () => {
    mockLogin.mockResolvedValueOnce({ id: 1 })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(screen.queryByPlaceholderText('mi-restaurante')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('usuario@ejemplo.com'), 'admin@demo.com')
    await user.type(screen.getByPlaceholderText('********'), 'secret')
    await user.click(screen.getByRole('button', { name: /Ingresar/i }))

    expect(mockLogin).toHaveBeenCalledWith('admin@demo.com', 'secret', { skipToast: true })
    await waitFor(() => {
      expect(mockFinishSession).toHaveBeenCalledWith({ id: 1 })
      expect(toast.success).toHaveBeenCalledWith('Bienvenido!')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('muestra error cuando el login falla', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: { message: 'Credenciales invalidas' } } }
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText('usuario@ejemplo.com'), 'admin@demo.com')
    await user.type(screen.getByPlaceholderText('********'), 'secret')
    await user.click(screen.getByRole('button', { name: /Ingresar/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Credenciales invalidas')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
