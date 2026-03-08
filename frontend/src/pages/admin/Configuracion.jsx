import {
  PhotoIcon,
  TruckIcon,
  CreditCardIcon,
  ClockIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  LinkIcon,
  QrCodeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

import MercadoPagoConfig from '../../components/configuracion/MercadoPagoConfig'
import ConfigSection from '../../components/configuracion/ConfigSection'
import ConfigMessageBanner from '../../components/configuracion/ConfigMessageBanner'
import { PageHeader, Spinner, ColorPicker } from '../../components/ui'
import useConfiguracionPage from '../../hooks/useConfiguracionPage'

export default function Configuracion() {
  const {
    backendUrl,
    config,
    frontendUrl,
    guardarConfiguracion,
    guardarNegocio,
    handleBannerUpload,
    handleConfigChange,
    handleNegocioChange,
    loading,
    message,
    negocio,
    saving,
    savingNegocio,
    toggleTiendaAbierta,
    uploadingBanner,
  } = useConfiguracionPage()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Configuracion del Negocio"
        eyebrow="Setup"
        description="Marca, operaciones, pagos y parametros fiscales del restaurante."
        actions={<ConfigMessageBanner message={message} />}
      />

      <ConfigSection icon={BuildingStorefrontIcon} title="Datos del Negocio">
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

          <div className="grid grid-cols-2 gap-4">
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
              Usa este link como version canonica. Los QR de mesa deben apuntar a
              `/menu/mesa/:qrToken`.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={guardarNegocio}
              disabled={savingNegocio}
              className={`btn btn-primary px-6 ${
                savingNegocio ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {savingNegocio ? 'Guardando...' : 'Guardar Datos del Negocio'}
            </button>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection icon={ClockIcon} title="Estado del Local">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <button
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
              className="input"
            />
          </div>
        </div>
      </ConfigSection>

      <ConfigSection icon={PhotoIcon} title="Branding">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="config-nombre-negocio">
              Nombre visible en el menu
            </label>
            <input
              id="config-nombre-negocio"
              type="text"
              value={config.nombre_negocio}
              onChange={(event) => handleConfigChange('nombre_negocio', event.target.value)}
              className="input"
            />
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

              {config.banner_imagen && (
                <div className="flex items-center gap-2">
                  <img
                    src={`${backendUrl}${config.banner_imagen}`}
                    alt="Banner preview"
                    className="h-16 w-32 object-cover rounded-xl border border-border-default"
                  />
                  <button
                    onClick={() => handleConfigChange('banner_imagen', '')}
                    className="text-error-500 hover:text-error-600 text-sm transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection icon={TruckIcon} title="Delivery">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.delivery_habilitado}
              onChange={(event) =>
                handleConfigChange('delivery_habilitado', event.target.checked)
              }
              className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
            />
            <span className="font-medium text-text-primary">Delivery habilitado</span>
          </label>

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
        </div>
      </ConfigSection>

      <div className="mb-6">
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          <CreditCardIcon className="w-5 h-5" />
          Metodos de Pago
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          <MercadoPagoConfig
            onStatusChange={(connected) =>
              handleConfigChange('mercadopago_enabled', connected)
            }
          />

          <ConfigSection className="card" title={null}>
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border-subtle">
              <div className="p-2 bg-success-100 rounded-xl">
                <BanknotesIcon className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Efectivo</h3>
                <p className="text-text-secondary text-sm">Caja y cobros presenciales</p>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.efectivo_enabled}
                onChange={(event) =>
                  handleConfigChange('efectivo_enabled', event.target.checked)
                }
                className="w-5 h-5 rounded text-success-500 focus:ring-success-500"
              />
              <span className="font-medium text-text-primary">
                Aceptar pagos en efectivo
              </span>
            </label>
          </ConfigSection>
        </div>

        <ConfigSection className="card mt-6" title={null}>
          <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
            <QrCodeIcon className="w-5 h-5" />
            QR Presencial Mercado Pago
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="config-qr-pos">
                External POS ID
              </label>
              <input
                id="config-qr-pos"
                type="text"
                value={config.mercadopago_qr_pos_id}
                onChange={(event) =>
                  handleConfigChange('mercadopago_qr_pos_id', event.target.value)
                }
                className="input"
                placeholder="CAJA-PRINCIPAL"
              />
              <p className="input-hint">
                Identificador del POS configurado en Mercado Pago para QR dinamico.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="config-qr-mode">
                Modo QR
              </label>
              <select
                id="config-qr-mode"
                className="input"
                value={config.mercadopago_qr_mode}
                onChange={(event) =>
                  handleConfigChange('mercadopago_qr_mode', event.target.value)
                }
              >
                <option value="dynamic">Dinamico</option>
                <option value="static">Estatico</option>
              </select>
            </div>
          </div>
        </ConfigSection>
      </div>

      <ConfigSection icon={DocumentTextIcon} title="Facturacion Electronica">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.facturacion_habilitada}
              onChange={(event) =>
                handleConfigChange('facturacion_habilitada', event.target.checked)
              }
              className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
            />
            <span className="font-medium text-text-primary">
              Habilitar facturacion electronica
            </span>
          </label>

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
            </div>
          </div>

          <div>
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

          <div>
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

          <p className="text-sm text-text-secondary">
            La emision real requiere credenciales WSAA/WSFEv1 configuradas en el servidor.
          </p>
        </div>
      </ConfigSection>

      <div className="flex justify-end">
        <button
          onClick={guardarConfiguracion}
          disabled={saving}
          className={`btn btn-primary px-8 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
      </div>
    </div>
  )
}
