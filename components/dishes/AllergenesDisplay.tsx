const ALLERGENES_14 = [
  { code: 'gluten', label: 'Gluten', emoji: '🌾' },
  { code: 'crustaces', label: 'Crustacés', emoji: '🦞' },
  { code: 'oeufs', label: 'Œufs', emoji: '🥚' },
  { code: 'poisson', label: 'Poisson', emoji: '🐟' },
  { code: 'arachides', label: 'Arachides', emoji: '🥜' },
  { code: 'soja', label: 'Soja', emoji: '🫘' },
  { code: 'lait', label: 'Lait', emoji: '🥛' },
  { code: 'fruits_coque', label: 'Fruits à coque', emoji: '🌰' },
  { code: 'celeri', label: 'Céleri', emoji: '🥬' },
  { code: 'moutarde', label: 'Moutarde', emoji: '🌿' },
  { code: 'sesame', label: 'Sésame', emoji: '🌱' },
  { code: 'so2', label: 'SO₂/Sulfites', emoji: '🍷' },
  { code: 'lupin', label: 'Lupin', emoji: '🌼' },
  { code: 'mollusques', label: 'Mollusques', emoji: '🦪' },
] as const

interface AllergenesDisplayProps {
  allergenes: string[]
  compact?: boolean
}

export function AllergenesDisplay({ allergenes, compact = false }: AllergenesDisplayProps) {
  const present = ALLERGENES_14.filter((a) => allergenes.includes(a.code))

  if (present.length === 0) {
    return <div className="text-sm text-gray-500 italic">Aucun allergène majeur déclaré</div>
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="allergenes-display">
      {present.map(({ code, label, emoji }) => (
        <span
          key={code}
          className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 ${
            compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
          }`}
          title={label}
          data-testid={`allergene-${code}`}
        >
          <span>{emoji}</span>
          {!compact && <span>{label}</span>}
        </span>
      ))}
    </div>
  )
}
