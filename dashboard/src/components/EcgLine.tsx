import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

// Tracé fixe : 3 battements P-QRS-T, ligne de base y=120, pic R ~75 unités au-dessus.
const ECG_D =
  'M0 120 L60 120 C75 102 90 102 105 120 L150 120 L164 132 L184 44 L204 152 L218 120 L262 120 C286 90 326 90 350 120 L400 120 L460 120 C475 102 490 102 505 120 L550 120 L564 132 L584 44 L604 152 L618 120 L662 120 C686 90 726 90 750 120 L800 120 L860 120 C875 102 890 102 905 120 L950 120 L964 132 L984 44 L1004 152 L1018 120 L1062 120 C1086 90 1126 90 1150 120 L1200 120'

const STYLE_ID = 'ecg-line-styles'

// CSS injecté une seule fois (garde anti-doublon).
const CSS = `
@keyframes ecg-sweep { from { stroke-dashoffset: 0 } to { stroke-dashoffset: calc(-1 * var(--ecg-cycle)) } }
.ecg-glow {
  stroke-dasharray: var(--ecg-trail) var(--ecg-total);
  animation: ecg-sweep var(--ecg-duration) linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .ecg-glow { animation: none; stroke-dasharray: none; filter: none !important; }
}
`

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = CSS
  document.head.appendChild(s)
}
injectStyles()

export type EcgLineProps = {
  height?: number // hauteur en px (défaut 96)
  bpm?: number // rythme : règle la vitesse du balayage (défaut 72)
  color?: string // couleur du tracé (défaut #C8102E)
  dimOpacity?: number // opacité de la ligne de fond (défaut 0.22)
  beats?: number // nombre de battements dans le tracé (défaut 3)
  glow?: number // intensité du halo en px (défaut 12)
  className?: string
  style?: CSSProperties
}

const TRAIL_RATIO = 0.15 // le segment lumineux = 15 % de la longueur du tracé
const DEFAULT_TOTAL = 1700 // valeur de départ (évite tout flash avant la mesure)

export default function EcgLine({
  height = 96, bpm = 72, color = '#C8102E', dimOpacity = 0.22, beats = 3, glow = 12, className, style,
}: EcgLineProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [total, setTotal] = useState(DEFAULT_TOTAL)

  // Mesure la longueur RÉELLE du tracé à l'écran (en px), car non-scaling-stroke
  // fait calculer les tirets en pixels écran. Refait si le conteneur change de taille.
  useLayoutEffect(() => {
    const measure = () => {
      const p = pathRef.current, svg = svgRef.current
      if (!p || !svg) return
      const m = svg.getScreenCTM()
      if (!m) return
      const len = p.getTotalLength()
      const N = 600
      let sum = 0
      let prev: DOMPoint | null = null
      for (let i = 0; i <= N; i++) {
        const pt = p.getPointAtLength((len * i) / N)
        const cur = new DOMPoint(pt.x, pt.y).matrixTransform(m)
        if (prev) sum += Math.hypot(cur.x - prev.x, cur.y - prev.y)
        prev = cur
      }
      if (sum > 0) setTotal(sum)
    }
    measure()
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  const trail = total * TRAIL_RATIO
  const cycle = total + trail
  // Durée d'un passage = (battements × 60 / bpm) × cycle / total
  const duration = ((beats * 60) / bpm) * (cycle / total)

  const vars = {
    '--ecg-total': `${total}px`,
    '--ecg-trail': `${trail}px`,
    '--ecg-cycle': `${cycle}px`,
    '--ecg-duration': `${duration}s`,
  } as CSSProperties

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label="Cardiogramme animé"
      className={className}
      style={{
        width: '100%', height, overflow: 'hidden', borderRadius: 10,
        // Grille « papier d'électrocardiogramme » : petits carreaux 8 px + grands 40 px
        backgroundImage: [
          'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
          'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '40px 40px, 40px 40px, 8px 8px, 8px 8px',
        ...vars,
        ...style,
      }}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        fill="none"
        style={{ display: 'block' }}
      >
        {/* Couche a : la ligne complète, discrète (le « passé » du tracé) */}
        <path d={ECG_D} stroke={color} strokeOpacity={dimOpacity} strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {/* Couche b : segment lumineux qui balaie la courbe en boucle */}
        <path ref={pathRef} className="ecg-glow" d={ECG_D} stroke={color} strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          style={{
            strokeDasharray: `${trail}px ${total}px`,
            filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 ${glow}px ${color})`,
          }} />
      </svg>
    </div>
  )
}
