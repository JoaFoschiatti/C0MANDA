export default function ColorPicker({ id, label, value, onChange }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded border cursor-pointer"
          aria-label={`Seleccionar ${label.toLowerCase()}`}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1"
        />
      </div>
    </div>
  )
}
