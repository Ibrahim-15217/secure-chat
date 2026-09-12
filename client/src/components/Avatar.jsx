function hashName(name) {
  let hash = 0
  const str = (name || '').toLowerCase()
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const GRADIENTS = [
  ['#6d5cff', '#a855f7'],
  ['#22d3ee', '#6d5cff'],
  ['#f472b6', '#a855f7'],
  ['#34d399', '#22d3ee'],
  ['#fbbf24', '#f97316'],
  ['#818cf8', '#22d3ee'],
  ['#a78bfa', '#f472b6'],
  ['#2dd4bf', '#818cf8'],
  ['#f87171', '#fbbf24'],
  ['#60a5fa', '#a78bfa'],
]

export default function Avatar({ name, size = 40, className = '' }) {
  const h = hashName(name)
  const [c1, c2] = GRADIENTS[h % GRADIENTS.length]
  const fontSize = size * 0.36
  const id = `av-${h}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width={size} height={size} rx={size * 0.3} fill={`url(#${id})`} />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="#fff"
        fontSize={fontSize}
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  )
}
