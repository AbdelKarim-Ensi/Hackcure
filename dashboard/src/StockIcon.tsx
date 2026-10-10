// Petite icône par niveau de stock : coche (normal), triangle (bas), octogone d'alerte (critique).
import type { StockLevel } from './stocks'

const COMMON = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export default function StockIcon({ level }: { level: StockLevel }) {
  if (level === 'vert') {
    return (
      <svg {...COMMON} className="relative h-6 w-6 text-success" role="img" aria-label="Stock normal">
        <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" />
      </svg>
    )
  }
  if (level === 'orange') {
    return (
      <svg {...COMMON} className="relative h-6 w-6 text-warning" role="img" aria-label="Stock bas">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }
  return (
    <svg {...COMMON} className="relative h-6 w-6 text-primary-dark" role="img" aria-label="Stock critique">
      <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9L7.9 2Z" /><path d="M12 8v5M12 16.5h.01" />
    </svg>
  )
}
