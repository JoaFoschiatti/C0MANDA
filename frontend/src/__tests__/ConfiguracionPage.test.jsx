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

  it('guarda la identidad y la configuracion operativa', async () => {
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
          tagline_negocio: 'Pedidos, caja y cocina en un solo lugar',
          costo_delivery: '0',
          delivery_habilitado: 'true',
          efectivo_enabled: 'true'
        }
      })

    api.put.mockResolvedValue({ data: {} })

    const user = userEvent.setup()
    const { container } = render(<Configuracion />)

    expect(await screen.findByRole('heading', { name: /Identidad del Negocio/i })).toBeInTheDocument()
    expect(screen.queryByText(/Datos del Negocio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Branding/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Nombre visible en el menu/i)).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Nombre del Negocio/i))
    await user.type(screen.getByLabelText(/Nombre del Negocio/i), 'Nuevo Nombre')
    await user.clear(screen.getByLabelText(/Tagline \/ Slogan/i))
    await user.type(screen.getByLabelText(/Tagline \/ Slogan/i), 'Un slogan nuevo')

    expect(screen.getByRole('button', { name: /Guardar identidad/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Guardar configuracion operativa/i })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Guardar identidad/i }))

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
  })

  it('guarda los datos de transferencia de Mercado Pago', async () => {
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
          mercadopago_transfer_alias: 'alias-viejo.mp',
          mercadopago_transfer_titular: 'Titular Viejo',
          mercadopago_transfer_cvu: '0000000000000000000000'
        }
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

    await user.click(screen.getByRole('button', { name: /Guardar configuracion operativa/i }))

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

    expect(await screen.findByRole('heading', { name: /Identidad del Negocio/i })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: /Identidad del Negocio/i })).toHaveLength(1)
    expect(screen.queryByText(/Datos del Negocio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Branding/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Nombre visible en el menu/i)).not.toBeInTheDocument()
    expect(await screen.findByText(/Link del Menu Publico/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\/menu/i })).toHaveAttribute('href', expect.stringMatching(/\/menu$/))
  })

  it('muestra el preview del banner guardado', async () => {
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
          banner_imagen: '/uploads/banner-test.png'
        }
      })

    render(<Configuracion />)

    const preview = await screen.findByAltText('Banner preview')
    expect(preview).toHaveAttribute('src', '/uploads/banner-test.png')
  })

  it('muestra el preview del logo y banner dentro de la identidad unificada', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          logo: '/uploads/logo-test.png',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: {
          tienda_abierta: 'true',
          banner_imagen: '/uploads/banner-test.png'
        }
      })

    render(<Configuracion />)

    expect(await screen.findByRole('heading', { name: /Identidad del Negocio/i })).toBeInTheDocument()
    expect(await screen.findByAltText('Logo preview')).toHaveAttribute('src', '/uploads/logo-test.png')
    expect(await screen.findByAltText('Banner preview')).toHaveAttribute('src', '/uploads/banner-test.png')
  })

  it('muestra el preview del logo guardado', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          logo: '/uploads/logo-test.png',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: {
          tienda_abierta: 'true'
        }
      })

    render(<Configuracion />)

    const preview = await screen.findByAltText('Logo preview')
    expect(preview).toHaveAttribute('src', '/uploads/logo-test.png')
  })

  it('muestra error cuando falla la subida del logo', async () => {
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

    const { container } = render(<Configuracion />)

    await screen.findByRole('heading', { name: /Identidad del Negocio/i })

    const logoInput = container.querySelectorAll('input[type="file"]')[0]
    expect(logoInput).not.toBeUndefined()
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })

    const user = userEvent.setup()
    await user.upload(logoInput, file)

    expect(await screen.findByText(/Error al subir logo/i)).toBeInTheDocument()
  })

  it('permite quitar el logo guardado', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          nombre: 'Mi Local',
          email: 'info@test.com',
          telefono: '123',
          direccion: 'Calle 1',
          logo: '/uploads/logo-test.png',
          colorPrimario: '#111111',
          colorSecundario: '#222222'
        }
      })
      .mockResolvedValueOnce({
        data: { tienda_abierta: 'true' }
      })

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
          banner_imagen: '/uploads/banner-test.png'
        }
      })

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
