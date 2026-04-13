interface SeuilRentabiliteCardProps {
  seuil: number | null
  ca: number
  chargesFixes: number | null
}

export function SeuilRentabiliteCard({ seuil, ca, chargesFixes }: SeuilRentabiliteCardProps) {
  if (!chargesFixes) {
    return (
      <div className="rounded-2xl p-4 border border-gray-200 bg-gray-50" data-testid="seuil-card">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Seuil de rentabilité</p>
        <p className="text-sm text-gray-400 mt-2">Ajoutez vos charges pour voir le seuil</p>
      </div>
    )
  }

  const atteint = seuil != null && ca >= seuil
  return (
    <div
      className={`rounded-2xl p-4 border ${atteint ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}
      data-testid="seuil-card"
    >
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Seuil de rentabilité</p>
      <p
        className={`text-4xl font-bold mt-1 ${atteint ? 'text-green-600' : 'text-orange-500'}`}
        data-testid="seuil-value"
      >
        {seuil?.toFixed(0)} €
      </p>
      <p className="text-sm text-gray-500 mt-1">
        {atteint
          ? `✓ Atteint (CA: ${ca.toFixed(0)} €)`
          : `${(seuil! - ca).toFixed(0)} € restants`}
      </p>
    </div>
  )
}
