import Papa from 'papaparse'

/**
 * Export an array of objects to a CSV file and trigger download.
 *
 * @param {Array<Object>} data - Rows to export
 * @param {Array<{key: string, label: string, format?: (v: any) => string}>} columns - Column definitions
 * @param {string} filename - Download filename (without extension)
 */
export function exportToCSV(data, columns, filename) {
  if (!data?.length) return

  const rows = data.map((row) =>
    columns.reduce((acc, col) => {
      const raw = row[col.key]
      acc[col.label] = col.format ? col.format(raw) : (raw ?? '')
      return acc
    }, {})
  )

  const csv = Papa.unparse(rows, { columns: columns.map((c) => c.label) })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
