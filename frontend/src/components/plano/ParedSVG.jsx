import { useState, useRef, useCallback } from 'react'

const GRID = 16
const snap = (v) => Math.round(v / GRID) * GRID

export default function ParedSVG({ paredes = [], onChange, dibujar, onDibujarChange }) {
  const svgRef = useRef(null)
  const [inicio, setInicio] = useState(null)
  const [preview, setPreview] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)

  const getPos = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: snap(e.clientX - rect.left),
      y: snap(e.clientY - rect.top),
    }
  }, [])

  const handleMouseDown = useCallback(
    (e) => {
      if (!dibujar) return
      e.preventDefault()
      const pos = getPos(e)
      setInicio(pos)
      setPreview({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
    },
    [dibujar, getPos]
  )

  const handleMouseMove = useCallback(
    (e) => {
      if (!inicio) return
      const pos = getPos(e)
      let { x, y } = pos

      // Shift = linea recta
      if (e.shiftKey) {
        const dx = Math.abs(x - inicio.x)
        const dy = Math.abs(y - inicio.y)
        if (dx > dy) y = inicio.y
        else x = inicio.x
      }

      setPreview({ x1: inicio.x, y1: inicio.y, x2: x, y2: y })
    },
    [inicio, getPos]
  )

  const handleMouseUp = useCallback(() => {
    if (!inicio || !preview) {
      setInicio(null)
      setPreview(null)
      return
    }

    const dist = Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1)
    if (dist >= GRID) {
      const newPared = {
        id: `p-${Date.now()}`,
        x1: preview.x1,
        y1: preview.y1,
        x2: preview.x2,
        y2: preview.y2,
        grosor: 8,
      }
      onChange([...paredes, newPared])
    }

    setInicio(null)
    setPreview(null)
  }, [inicio, preview, paredes, onChange])

  const handleDeletePared = useCallback(
    (id) => {
      onChange(paredes.filter((p) => p.id !== id))
    },
    [paredes, onChange]
  )

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 w-full h-full ${dibujar ? 'cursor-crosshair z-30' : 'z-5 pointer-events-none'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setInicio(null)
        setPreview(null)
      }}
    >
      {/* Grid */}
      {dibujar && (
        <defs>
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="var(--color-border-subtle)" strokeWidth="0.5" />
          </pattern>
        </defs>
      )}
      {dibujar && <rect width="100%" height="100%" fill="url(#grid)" />}

      {/* Paredes existentes */}
      {paredes.map((p) => (
        <g
          key={p.id}
          onMouseEnter={() => dibujar && setHoveredId(p.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={(e) => {
            if (dibujar && hoveredId === p.id) {
              e.stopPropagation()
              handleDeletePared(p.id)
            }
          }}
          style={{ pointerEvents: dibujar ? 'auto' : 'none' }}
        >
          <line
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={hoveredId === p.id ? 'var(--color-error-500)' : 'var(--color-text-secondary)'}
            strokeWidth={p.grosor || 8}
            strokeLinecap="round"
          />
          {hoveredId === p.id && (
            <text
              x={(p.x1 + p.x2) / 2}
              y={(p.y1 + p.y2) / 2 - 10}
              textAnchor="middle"
              fill="var(--color-error-500)"
              fontSize="11"
              fontWeight="bold"
            >
              Click para borrar
            </text>
          )}
        </g>
      ))}

      {/* Preview */}
      {preview && (
        <line
          x1={preview.x1}
          y1={preview.y1}
          x2={preview.x2}
          y2={preview.y2}
          stroke="var(--color-primary-500)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="8 4"
          opacity="0.7"
        />
      )}
    </svg>
  )
}
