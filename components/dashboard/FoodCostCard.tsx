interface FoodCostCardProps {
  pct: number | null
  euros: number | null
  ca: number
}

export function FoodCostCard({ pct, euros, ca }: FoodCostCardProps) {
  const status = pct == null ? 'na' : pct <= 30 ? 'good' : pct <= 35 ? 'warn' : 'bad'
  const colors = {
    na: 'bg-gray-50 border-gray-200',
    good: 'bg-green-50 border-green-200',
    warn: 'bg-yellow-50 border-yellow-200',
    bad: 'bg-red-50 border-red-200',
  }
  const textColors = {
    na: 'text-gray-400',
    good: 'text-green-600',
    warn: 'text-yellow-600',
    bad: 'text-red-600',
  }

  return (
    <div className={`rounded-2xl p-4 border ${colors[status]}`} data-testid="food-cost-card">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Food Cost</p>
      {pct == null ? (
        <p className="text-sm text-gray-400 mt-2">
          Ajoutez des prix en mercuriale pour calculer votre food cost
        </p>
      ) : (
        <>
          <p className={`text-4xl font-bold mt-1 ${textColors[status]}`} data-testid="food-cost-pct">
            {pct}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {euros?.toFixed(2)} € / {ca.toFixed(2)} € CA
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {status === 'good'
              ? '✓ Maîtrisé (< 30%)'
              : status === 'warn'
              ? '⚠ Attention (30-35%)'
              : '⚠ Élevé (> 35%)'}
          </p>
        </>
      )}
    </div>
  )
}
