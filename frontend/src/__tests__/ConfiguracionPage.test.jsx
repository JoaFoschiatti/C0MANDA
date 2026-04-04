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

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../components/configuracion/MercadoPagoConfig', () => ({
  default: () => <div data-testid="mercadopago-config" />
}))

const negocioData = {
  nombre: 'Mi Local',
  email: 'info@test.com',
  telefono: '123',
  direccion: 'Calle 1',
  colorPrimario: '#111111',
  colorSecundario: '#222222'
}

const configData = {
  tienda_abierta: 'true',
  horario_apertura: '09:00',
  horario_cierre: '18:00',
  nombre_negocio: 'Mi Local',
  tagline_negocio: 'Pedidos, caja y cocina en un solo lugar',
  costo_delivery: '0',
  delivery_habilitado: 'true',
  efectivo_enabled: 'true'
}

function mockLoadSuccess(overrideNegocio = {}, overrideConfig = {}) {
  api.get
    .mockResolvedValueOnce({ data: { ...negocioData, ...overrideNegocio } })
    .mockResolvedValueOnce({ data: { ...configData, ...overrideConfig } })
}

describe('Configuracion page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarda toda la configuracion con un solo boton', async () => {
    mockLoadSuccess()
    api.put.mockResolvedValue({ data: {} })

    const user = userEvent.setup()
    render(<Configuracion />)

    expect(await screen.findByRole('heading', { name: /Identidad del Negocio/i })).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Nombre del Negocio/i))
    await user.type(screen.getByLabelText(/Nombre del Negocio/i), 'Nuevo Nombre')
    await user.clear(screen.getByLabelText(/Tagline \/ Slogan/i))
    await user.type(screen.getByLabelText(/Tagline \/ Slogan/i), 'Un slogan nuevo')

    await user.click(screen.getByRole('button', { name: /Guardar configuracion/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/negocio',
        expect.objectContaining({ nombre: 'Nuevo Nombre' }),
        expect.objectContaining({ skipToast: true })
      )
    })

    await waitFor(() => {
      expect(api.put.mock.calls).toContainEqual([
        '/configuracion',
        expect.objectContaining({
          tagline_negocio: 'Un slogan nuevo'
        }),
        expect.objectContaining({ skipToast: true })
      ])
    })

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/facturacion/configuracion',
        expect.objectContaining({ habilitada: false }),
        expect.objectContaining({ skipToast: true })
      )
    })
  })

  it('guarda los datos de transferencia de Mercado Pago', async () => {
    mockLoadSuccess({}, {
      mercadopago_transfer_alias: 'alias-viejo.mp',
      mercadopago_transfer_titular: 'Titular Viejo',
      mercadopago_transfer_cvu: '0000000000000000000000'
    })

    api.put.mockResolvedValue({ data: {} })

    const user = userEvent.setup()
    render(<Configuracion />)

    expect(await screen.findByText('Transferencia Mercado Pago')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Alias *'))
    await user.type(screen.getByLabelText('Alias *'), 'mi-local.mp')
    await user.clear(screen.getByLabelText('Titular'))
    await user.type(screen.getByLabelText('Titular'), 'Mi Local SA')
    await user.clear(screen.getByLabelText('CVU'))
    await user.type(screen.getByLabelText('CVU'), '0000003100000000000001')

    await user.click(screen.getByRole('button', { name: /Guardar configuracion/i }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/configuracion',
        expect.objectContaining({
          mercadopago_transfer_alias: 'mi-local.mp',
          mercadopago_transfer_titular: 'Mi Local SA',
          mercadopago_transfer_cvu: '0000003100000000000001'
        }),
        expect.objectContaining({ skipToast: true })
      )
    })
  })

  it('presenta una sola seccion de identidad con el link canonico', async () => {
    mockLoadSuccess()

    render(<Configuracion />)

    expect(await screen.findByRole('heading', { name: /Identidad del Negocio/i })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: /Identidad del Negocio/i })).toHaveLength(1)
    expect(screen.queryByText(/Datos del Negocio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Branding/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Nombre visible en el menu/i)).not.toBeInTheDocument()
    expect(await screen.findByText(/Link del Menu Publico/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\/menu/i })).toHaveAttribute('href', expect.stringMatching(/\/menu$/))
  })

  it('muestra el preview del banner guardado', async () => {
    mockLoadSuccess({}, { banner_imagen: '/uploads/banner-test.png' })

    render(<Configuracion />)

    const preview = await screen.findByAltText('Banner preview')
    expect(preview).toHaveAttribute('src', '/uploads/banner-test.png')
  })

  it('muestra el preview del logo y banner dentro de la identidad unificada', async () => {
    mockLoadSuccess(
      { logo: '/uploads/logo-test.png' },
      { banner_imagen: '/uploads/banner-test.png' }
    )

    render(<Configuracion />)

    expect(await screen.findByRole('heading', { name: /Identidad del Negocio/i })).toBeInTheDocument()
    expect(await screen.findByAltText('Logo preview')).toHaveAttribute('src', '/uploads/logo-test.png')
    expect(await screen.findByAltText('Banner preview')).toHaveAttribute('src', '/uploads/banner-test.png')
  })

  it('muestra el preview del logo guardado', async () => {
    mockLoadSuccess({ logo: '/uploads/logo-test.png' })

    render(<Configuracion />)

    const preview = await screen.findByAltText('Logo preview')
    expect(preview).toHaveAttribute('src', '/uploads/logo-test.png')
  })

  it('muestra error cuando falla la subida del logo', async () => {
    mockLoadSuccess()
    api.post.mockRejectedValueOnce(new Error('fail'))

    const { container } = render(<Configuracion />)

    await screen.findByRole('heading', { name: /Identidad del Negocio/i })

    const logoInput = container.querySelectorAll('input[type="file"]')[0]
    expect(logoInput).not.toBeUndefined()
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })

    const user = userEvent.setup()
    await user.upload(logoInput, file)

    const toast = (await import('react-hot-toast')).default
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al subir logo')
    })
  })

  it('permite quitar el logo guardado', async () => {
    mockLoadSuccess({ logo: '/uploads/logo-test.png' })
    api.put.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    render(<Configuracion />)

    expect(await screen.findByAltText('Logo preview')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/negocio',
        { logo: '' },
        expect.objectContaining({ skipToast: true })
      )
    })
    expect(screen.queryByAltText('Logo preview')).not.toBeInTheDocument()
  })

  it('permite quitar el banner guardado', async () => {
    mockLoadSuccess({}, { banner_imagen: '/uploads/banner-test.png' })
    api.put.mockResolvedValueOnce({ data: {} })

    const user = userEvent.setup()
    render(<Configuracion />)

    expect(await screen.findByAltText('Banner preview')).toBeInTheDocument()

    const removeButtons = screen.getAllByRole('button', { name: 'Quitar' })
    await user.click(removeButtons[0])

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/configuracion',
        expect.objectContaining({ banner_imagen: '' }),
        expect.objectContaining({ skipToast: true })
      )
    })
    expect(screen.queryByAltText('Banner preview')).not.toBeInTheDocument()
  })

  it('muestra error cuando falla la subida del banner', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLoadSuccess()
    api.post.mockRejectedValueOnce(new Error('fail'))

    render(<Configuracion />)

    const bannerInput = await screen.findByLabelText(/Banner del Menu Publico/i)
    const file = new File(['banner'], 'banner.png', { type: 'image/png' })

    const user = userEvent.setup()
    await user.upload(bannerInput, file)

    const toast = (await import('react-hot-toast')).default
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al subir banner')
    })
    consoleError.mockRestore()
  })

  it('rechaza un banner con formato invalido sin llamar al backend', async () => {
    mockLoadSuccess()

    render(<Configuracion />)

    const bannerInput = await screen.findByLabelText(/Banner del Menu Publico/i)
    const invalidFile = new File(['banner'], 'banner.txt', { type: 'text/plain' })

    fireEvent.change(bannerInput, {
      target: { files: [invalidFile] }
    })

    const toast = (await import('react-hot-toast')).default
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Formato no permitido/i))
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('muestra estado de error persistente con boton reintentar', async () => {
    api.get.mockRejectedValueOnce(new Error('network'))

    render(<Configuracion />)

    expect(await screen.findByRole('heading', { name: /No pudimos cargar la configuracion/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument()
  })

  it('deshabilita los campos de facturacion cuando no esta habilitada', async () => {
    mockLoadSuccess({}, { facturacion_habilitada: 'false' })

    render(<Configuracion />)

    await screen.findByRole('heading', { name: /Facturacion Electronica/i })

    const cuitInput = screen.getByLabelText('CUIT Emisor')
    expect(cuitInput.closest('[class*="pointer-events-none"]')).not.toBeNull()
  })

  it('muestra indicador de cambios sin guardar', async () => {
    mockLoadSuccess()
    const user = userEvent.setup()

    render(<Configuracion />)

    await screen.findByRole('heading', { name: /Identidad del Negocio/i })

    expect(screen.queryByText('Hay cambios sin guardar')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar configuracion/i })).toBeDisabled()

    await user.clear(screen.getByLabelText(/Nombre del Negocio/i))
    await user.type(screen.getByLabelText(/Nombre del Negocio/i), 'Otro nombre')

    expect(screen.getByText('Hay cambios sin guardar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar configuracion/i })).not.toBeDisabled()
  })
})
