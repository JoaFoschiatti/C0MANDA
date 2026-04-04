import {
  TruckIcon,
  CreditCardIcon,
  ClockIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  LinkIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

import MercadoPagoConfig from '../../components/configuracion/MercadoPagoConfig'
import ConfigSection from '../../components/configuracion/ConfigSection'
import { Button, PageHeader, Spinner, ColorPicker, Toggle } from '../../components/ui'
import useConfiguracionPage from '../../hooks/useConfiguracionPage'
import { resolvePublicAssetUrl } from '../../utils/public-assets'

const CUIT_RE = /^\d{11}$/
const CVU_RE = /^\d{22}$/

export default function Configuracion() {
  const {
    backendUrl,
    config,
    frontendUrl,
    guardarTodo,
    handleBannerRemove,
    handleBannerUpload,
    handleConfigChange,
    handleLogoRemove,
    handleLogoUpload,
    handleNegocioChange,
    isDirty,
    loading,
    loadError,
    negocio,
    saving,
    toggleTiendaAbierta,
    guardarHorario,
    uploadingBanner,
    uploadingLogo,
    cargarDatosAsync,
  } = useConfiguracionPage()
  const logoPreviewUrl = resolvePublicAssetUrl(negocio.logo, backendUrl)
  const bannerPreviewUrl = resolvePublicAssetUrl(config.banner_imagen, backendUrl)

  const cuitInvalid = config.facturacion_cuit_emisor.trim() !== '' && !CUIT_RE.test(config.facturacion_cuit_emisor.replace(/\D/g, ''))
  const cvuInvalid = config.mercadopago_transfer_cvu.trim() !== '' && !CVU_RE.test(config.mercadopago_transfer_cvu.replace(/\D/g, ''))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ExclamationTriangleIcon className="w-10 h-10 text-error-500 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No pudimos cargar la configuracion</h2>
        <p className="text-sm text-text-secondary mb-4">{loadError}</p>
        <Button onClick={() => cargarDatosAsync().catch(() => {})}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <PageHeader
        title="Configuracion del Negocio"
        eyebrow="Setup"
        description="Marca, operaciones, pagos y parametros fiscales del restaurante."
      />

      {/* ── Identidad ── */}
      <ConfigSection icon={BuildingStorefrontIcon} title="Identidad del Negocio">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="negocio-nombre">
                Nombre del Negocio *
              </label>
              <input
                id="negocio-nombre"
                type="text"
                value={negocio.nombre}
                onChange={(event) => handleNegocioChange('nombre', event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="negocio-email">
                Email de Contacto
              </label>
              <input
                id="negocio-email"
                type="email"
                value={negocio.email}
                onChange={(event) => handleNegocioChange('email', event.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="config-tagline">
              Tagline / Slogan
            </label>
            <input
              id="config-tagline"
              type="text"
              value={config.tagline_negocio}
              onChange={(event) => handleConfigChange('tagline_negocio', event.target.value)}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="negocio-telefono">
                Telefono
              </label>
              <input
                id="negocio-telefono"
                type="text"
                value={negocio.telefono}
                onChange={(event) => handleNegocioChange('telefono', event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="negocio-direccion">
                Direccion
              </label>
              <input
                id="negocio-direccion"
                type="text"
                value={negocio.direccion}
                onChange={(event) => handleNegocioChange('direccion', event.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="config-whatsapp">
              WhatsApp
            </label>
            <input
              id="config-whatsapp"
              type="text"
              value={config.whatsapp_numero}
              onChange={(event) => handleConfigChange('whatsapp_numero', event.target.value)}
              className="input"
              placeholder="5411XXXXXXXX"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorPicker
              id="negocio-color-primario"
              label="Color Primario"
              value={negocio.colorPrimario}
              onChange={(v) => handleNegocioChange('colorPrimario', v)}
            />
            <ColorPicker
              id="negocio-color-secundario"
              label="Color Secundario"
              value={negocio.colorSecundario}
              onChange={(v) => handleNegocioChange('colorSecundario', v)}
            />
          </div>

          <div>
            <label className="label" htmlFor="negocio-logo">
              Logo del Menu Publico
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer" htmlFor="negocio-logo">
                <input
                  id="negocio-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <span className={`btn ${uploadingLogo ? 'btn-disabled' : 'btn-secondary'}`}>
                  {uploadingLogo ? 'Subiendo...' : 'Subir Logo'}
                </span>
              </label>

              {logoPreviewUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={logoPreviewUrl}
                    alt="Logo preview"
                    className="h-16 w-16 rounded-2xl border border-border-default bg-white object-contain p-2"
                  />
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="text-error-500 hover:text-error-600 text-sm transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="config-banner">
              Banner del Menu Publico
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer" htmlFor="config-banner">
                <input
                  id="config-banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
                <span className={`btn ${uploadingBanner ? 'btn-disabled' : 'btn-secondary'}`}>
                  {uploadingBanner ? 'Subiendo...' : 'Subir Banner'}
                </span>
              </label>

              {bannerPreviewUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={bannerPreviewUrl}
                    alt="Banner preview"
                    className="h-16 w-32 object-cover rounded-xl border border-border-default"
                  />
                  <button
                    type="button"
                    onClick={handleBannerRemove}
                    className="text-error-500 hover:text-error-600 text-sm transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-info-50 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-info-700">
              <LinkIcon className="w-5 h-5" />
              <span className="font-medium">Link del Menu Publico</span>
            </div>
            <a
              href={`${frontendUrl}/menu`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info-600 hover:underline text-sm mt-1 block"
            >
              {frontendUrl}/menu
            </a>
            <p className="text-xs text-info-600 mt-2">
              Usa este link como version canonica para compartir la carta publica del local.
            </p>
          </div>
        </div>
      </ConfigSection>

      {/* ── Estado del Local ── */}
      <ConfigSection icon={ClockIcon} title="Estado del Local">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <button
            type="button"
            onClick={toggleTiendaAbierta}
            className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
              config.tienda_abierta
                ? 'bg-success-500 hover:bg-success-600 text-white'
                : 'bg-surface-hover hover:bg-border-default text-text-secondary'
            }`}
          >
            {config.tienda_abierta ? 'ABIERTO' : 'CERRADO'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="config-horario-apertura">
              Horario de Apertura
            </label>
            <input
              id="config-horario-apertura"
              type="time"
              value={config.horario_apertura}
              onChange={(event) => handleConfigChange('horario_apertura', event.target.value)}
              onBlur={(event) => guardarHorario('horario_apertura', event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="config-horario-cierre">
              Horario de Cierre
            </label>
            <input
              id="config-horario-cierre"
              type="time"
              value={config.horario_cierre}
              onChange={(event) => handleConfigChange('horario_cierre', event.target.value)}
              onBlur={(event) => guardarHorario('horario_cierre', event.target.value)}
              className="input"
            />
          </div>
        </div>
        <p className="text-xs text-text-tertiary mt-2">Los horarios se guardan automaticamente al cambiar.</p>
      </ConfigSection>

      {/* ── Delivery ── */}
      <ConfigSection icon={TruckIcon} title="Delivery">
        <div className="space-y-4">
          <Toggle
            checked={config.delivery_habilitado}
            onChange={(checked) => handleConfigChange('delivery_habilitado', checked)}
            label="Delivery habilitado"
          />

          <div>
            <label className="label" htmlFor="config-costo-delivery">
              Costo de Envio ($)
            </label>
            <input
              id="config-costo-delivery"
              type="number"
              value={config.costo_delivery || ''}
              onChange={(event) =>
                handleConfigChange('costo_delivery', Number(event.target.value) || 0)
              }
              className="input"
              min="0"
              step="100"
            />
          </div>

          <div>
            <label className="label" htmlFor="config-direccion-retiro">
              Direccion para Retiro
            </label>
            <input
              id="config-direccion-retiro"
              type="text"
              value={config.direccion_retiro}
              onChange={(event) =>
                handleConfigChange('direccion_retiro', event.target.value)
              }
              className="input"
            />
          </div>
        </div>
      </ConfigSection>

      {/* ── Metodos de Pago ── */}
      <div className="mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <CreditCardIcon className="w-5 h-5" />
          Metodos de Pago
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <MercadoPagoConfig
              onStatusChange={(connected) =>
                handleConfigChange('mercadopago_enabled', connected)
              }
            />

            {/* Transferencia MP — nested under MercadoPago */}
            <div className="card">
              <h3 className="font-bold text-text-primary mb-1 flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Transferencia Mercado Pago
              </h3>
              <p className="text-xs text-text-tertiary mb-4">
                Estos datos se muestran al cajero cuando registra un cobro manual por transferencia.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="config-mp-transfer-alias">
                    Alias *
                  </label>
                  <input
                    id="config-mp-transfer-alias"
                    type="text"
                    value={config.mercadopago_transfer_alias}
                    onChange={(event) =>
                      handleConfigChange('mercadopago_transfer_alias', event.target.value)
                    }
                    className="input"
                    placeholder="mi-resto.mp"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="config-mp-transfer-titular">
                    Titular
                  </label>
                  <input
                    id="config-mp-transfer-titular"
                    type="text"
                    value={config.mercadopago_transfer_titular}
                    onChange={(event) =>
                      handleConfigChange('mercadopago_transfer_titular', event.target.value)
                    }
                    className="input"
                    placeholder="Nombre del titular"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="config-mp-transfer-cvu">
                    CVU
                  </label>
                  <input
                    id="config-mp-transfer-cvu"
                    type="text"
                    value={config.mercadopago_transfer_cvu}
                    onChange={(event) =>
                      handleConfigChange('mercadopago_transfer_cvu', event.target.value)
                    }
                    className="input"
                    placeholder="0000003100000000000000"
                  />
                  {cvuInvalid && (
                    <p className="text-xs text-error-500 mt-1">El CVU debe tener 22 digitos</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <ConfigSection className="card h-fit" title={null}>
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border-subtle">
              <div className="p-2 bg-success-100 rounded-xl">
                <BanknotesIcon className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Efectivo</h3>
                <p className="text-text-secondary text-sm">Caja y cobros presenciales</p>
              </div>
            </div>

            <Toggle
              checked={config.efectivo_enabled}
              onChange={(checked) => handleConfigChange('efectivo_enabled', checked)}
              label="Aceptar pagos en efectivo"
            />
          </ConfigSection>
        </div>
      </div>

      {/* ── Facturacion ── */}
      <ConfigSection icon={DocumentTextIcon} title="Facturacion Electronica">
        <div className="space-y-4">
          <Toggle
            checked={config.facturacion_habilitada}
            onChange={(checked) => handleConfigChange('facturacion_habilitada', checked)}
            label="Habilitar facturacion electronica"
          />

          <div className={config.facturacion_habilitada ? '' : 'opacity-40 pointer-events-none'}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label" htmlFor="facturacion-punto-venta">
                  Punto de Venta
                </label>
                <input
                  id="facturacion-punto-venta"
                  type="number"
                  min="1"
                  value={config.facturacion_punto_venta}
                  onChange={(event) =>
                    handleConfigChange('facturacion_punto_venta', Number(event.target.value) || 1)
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="facturacion-ambiente">
                  Ambiente
                </label>
                <select
                  id="facturacion-ambiente"
                  className="input"
                  value={config.facturacion_ambiente}
                  onChange={(event) =>
                    handleConfigChange('facturacion_ambiente', event.target.value)
                  }
                >
                  <option value="homologacion">Homologacion</option>
                  <option value="produccion">Produccion</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="facturacion-cuit">
                  CUIT Emisor
                </label>
                <input
                  id="facturacion-cuit"
                  type="text"
                  value={config.facturacion_cuit_emisor}
                  onChange={(event) =>
                    handleConfigChange('facturacion_cuit_emisor', event.target.value)
                  }
                  className="input"
                  placeholder="30XXXXXXXXX"
                />
                {cuitInvalid && (
                  <p className="text-xs text-error-500 mt-1">El CUIT debe tener 11 digitos</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="facturacion-alicuota">
                Alicuota IVA (%)
              </label>
              <select
                id="facturacion-alicuota"
                className="input"
                value={config.facturacion_alicuota_iva}
                onChange={(event) =>
                  handleConfigChange(
                    'facturacion_alicuota_iva',
                    Number(event.target.value) || 21
                  )
                }
              >
                <option value="0">0</option>
                <option value="2.5">2.5</option>
                <option value="5">5</option>
                <option value="10.5">10.5</option>
                <option value="21">21</option>
                <option value="27">27</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="facturacion-descripcion">
                Descripcion del punto de venta
              </label>
              <input
                id="facturacion-descripcion"
                type="text"
                value={config.facturacion_descripcion}
                onChange={(event) =>
                  handleConfigChange('facturacion_descripcion', event.target.value)
                }
                className="input"
                placeholder="Caja principal"
              />
            </div>

            <p className="text-sm text-text-secondary mt-4">
              La emision real requiere credenciales WSAA/WSFEv1 configuradas en el servidor.
            </p>
          </div>
        </div>
      </ConfigSection>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 bg-canvas-default px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {isDirty() ? 'Hay cambios sin guardar' : ''}
          </span>
          <Button
            variant="primary"
            loading={saving}
            disabled={!isDirty()}
            onClick={guardarTodo}
            className="px-8"
          >
            Guardar configuracion
          </Button>
        </div>
      </div>
    </div>
  )
}
