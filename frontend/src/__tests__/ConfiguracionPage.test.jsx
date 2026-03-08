import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Configuracion from '../pages/admin/Configuracion'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: { use: vi.fn() }
    }
  }
}))

vi.mock('../components/configuracion/MercadoPagoConfig', () => ({
  default: () => <div data-testid="mercadopago-config" />
}))

describe('Configuracion page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga datos y guarda configuracion', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: {
          tienda_abierta: 'true',
          horario_apertura: '09:00',
          horario_cierre: '18:00',
          nombre_negocio: 'Mi Local',
          costo_delivery: '0',
          delivery_habilitado: 'true',
          efectivo_enabled: 'true'
        }
      })

    api.put.mockResolvedValue({ data: {} })

    const user = userEvent.setup()
    render(<Configuracion />)

    expect(await screen.findByLabelText(/Nombre del Negocio/i)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nombre visible en el menu'))
    await user.type(screen.getByLabelText('Nombre visible en el menu'), 'Nuevo Nombre')

    await user.click(screen.getByRole('button', { name: /Guardar Configuracion/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/configuracion',
        expect.objectContaining({ nombre_negocio: 'Nuevo Nombre' }),
        expect.objectContaining({ skipToast: true })
      )
    })

    await waitFor(() => {
      expect(api.put.mock.calls).toContainEqual([
        '/facturacion/configuracion',
        expect.objectContaining({
          puntoVenta: 1,
          ambiente: 'homologacion',
          cuitEmisor: '',
          descripcion: '',
          alicuotaIva: 21,
          habilitada: false
        }),
        expect.objectContaining({ skipToast: true })
      ])
    })
  })

  it('muestra el link canonico del menu publico', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: { tienda_abierta: 'true' }
      })

    const user = userEvent.setup({ applyAccept: false })
    render(<Configuracion />)

    expect(await screen.findByText(/Link del Menu Publico/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\/menu/i })).toHaveAttribute('href', expect.stringMatching(/\/menu$/))
  })

  it('muestra error cuando falla la subida del banner', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: { tienda_abierta: 'true' }
      })

    api.post.mockRejectedValueOnce(new Error('fail'))

    render(<Configuracion />)

    const bannerInput = await screen.findByLabelText(/Banner del Menu Publico/i)
    const file = new File(['banner'], 'banner.png', { type: 'image/png' })

    const user = userEvent.setup()
    await user.upload(bannerInput, file)

    expect(await screen.findByText(/Error al subir banner/i)).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('rechaza un banner con formato invalido sin llamar al backend', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: { tienda_abierta: 'true' }
      })

    render(<Configuracion />)

    const bannerInput = await screen.findByLabelText(/Banner del Menu Publico/i)
    const invalidFile = new File(['banner'], 'banner.txt', { type: 'text/plain' })

    fireEvent.change(bannerInput, {
      target: { files: [invalidFile] }
    })

    expect(await screen.findByText(/Formato no permitido\. Usa PNG, JPG o WebP\./i)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
})
