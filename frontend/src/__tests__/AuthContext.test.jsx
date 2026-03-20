import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../context/AuthContext'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } }
  }
}))

function AuthTester() {
  const { usuario, negocio, login, logout } = useAuth()

  return (
    <div>
      <div data-testid="user">{usuario?.email || ''}</div>
      <div data-testid="negocio">{negocio?.nombre || ''}</div>
      <button onClick={() => login('test@example.com', 'secret', { skipToast: true })}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.getItem.mockReset()
    localStorage.setItem.mockReset()
    localStorage.removeItem.mockReset()
  })

  it('guarda usuario y negocio al hacer login', async () => {
    const mockUser = { id: 1, email: 'test@example.com', rol: 'ADMIN' }
    const mockNegocio = { id: 1, nombre: 'Comanda Test' }

    api.post.mockResolvedValue({
      data: { usuario: mockUser, negocio: mockNegocio }
    })

    render(
      <AuthProvider>
        <AuthTester />
      </AuthProvider>
    )

    await userEvent.click(screen.getByText('login'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('usuario', JSON.stringify(mockUser))
    expect(localStorage.setItem).toHaveBeenCalledWith('negocio', JSON.stringify(mockNegocio))
    expect(screen.getByTestId('negocio')).toHaveTextContent('Comanda Test')
  })

  it('limpia estado y storage al hacer logout', async () => {
    const mockUser = { id: 1, email: 'test@example.com', rol: 'ADMIN' }

    api.post.mockResolvedValueOnce({
      data: { usuario: mockUser, negocio: null }
    })

    render(
      <AuthProvider>
        <AuthTester />
      </AuthProvider>
    )

    await userEvent.click(screen.getByText('login'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    api.post.mockResolvedValue({ data: {} })

    await userEvent.click(screen.getByText('logout'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('')
    })

    expect(api.post).toHaveBeenCalledWith('/auth/logout')
    expect(localStorage.removeItem).toHaveBeenCalledWith('usuario')
    expect(localStorage.removeItem).toHaveBeenCalledWith('negocio')
  })

  it('ignora localStorage corrupto sin romper el arranque', async () => {
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'usuario') {
        return '{bad-json'
      }

      if (key === 'negocio') {
        return JSON.stringify({ id: 1, nombre: 'Comanda Test' })
      }

      return null
    })

    render(
      <AuthProvider>
        <AuthTester />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('')
      expect(screen.getByTestId('negocio')).toHaveTextContent('Comanda Test')
    })

    expect(localStorage.removeItem).toHaveBeenCalledWith('usuario')
  })
})
