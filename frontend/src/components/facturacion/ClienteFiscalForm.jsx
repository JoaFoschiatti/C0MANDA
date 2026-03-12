const CONDICION_IVA_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTO', label: 'Monotributista' },
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'EXENTO', label: 'Exento' },
  { value: 'NO_RESPONSABLE', label: 'No Responsable' },
]

const TIPO_DOCUMENTO_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'CUIT', label: 'CUIT' },
  { value: 'DNI', label: 'DNI' },
  { value: 'CUIL', label: 'CUIL' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'OTRO', label: 'Otro' },
]

export default function ClienteFiscalForm({ form, onChange, requiereCuit }) {
  const update = (field, value) => {
    onChange({ ...form, [field]: value })
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary">Datos del cliente</h4>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="cf-nombre">
            Nombre / Razon social {requiereCuit && <span className="text-error-500">*</span>}
          </label>
          <input
            id="cf-nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => update('nombre', e.target.value)}
            className="input"
            placeholder="Nombre o razon social"
          />
        </div>
        <div>
          <label className="label" htmlFor="cf-cuit">
            CUIT {requiereCuit && <span className="text-error-500">*</span>}
          </label>
          <input
            id="cf-cuit"
            type="text"
            value={form.cuit}
            onChange={(e) => update('cuit', e.target.value)}
            className="input"
            placeholder="XX-XXXXXXXX-X"
            maxLength={13}
          />
        </div>
        <div>
          <label className="label" htmlFor="cf-condicion-iva">
            Condicion IVA {requiereCuit && <span className="text-error-500">*</span>}
          </label>
          <select
            id="cf-condicion-iva"
            value={form.condicionIva}
            onChange={(e) => update('condicionIva', e.target.value)}
            className="input"
          >
            {CONDICION_IVA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cf-tipo-doc">
            Tipo documento
          </label>
          <select
            id="cf-tipo-doc"
            value={form.tipoDocumento}
            onChange={(e) => update('tipoDocumento', e.target.value)}
            className="input"
          >
            {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cf-num-doc">
            N. Documento
          </label>
          <input
            id="cf-num-doc"
            type="text"
            value={form.numeroDocumento}
            onChange={(e) => update('numeroDocumento', e.target.value)}
            className="input"
            placeholder="Numero de documento"
          />
        </div>
        <div>
          <label className="label" htmlFor="cf-email">
            Email
          </label>
          <input
            id="cf-email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="input"
            placeholder="email@ejemplo.com"
          />
        </div>
      </div>
    </div>
  )
}
