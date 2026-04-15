interface DayData {
  date: string
  montant: number
}

interface VentesSemaineChartProps {
  data: DayData[]
}

const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export function VentesSemaineChart({ data }: VentesSemaineChartProps) {
  const max = Math.max(...data.map((d) => d.montant), 1)

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-4"
      data-testid="ventes-semaine-chart"
    >
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
        7 derniers jours
      </p>
      <div className="flex items-end gap-1.5 h-16">
        {data.map((d) => {
          const pct = (d.montant / max) * 100
          const dayLabel = JOURS[new Date(d.date + 'T12:00:00').getDay()]
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end" style={{ height: '48px' }}>
                <div
                  className="w-full rounded-t bg-accent/50"
                  style={{ height: `${Math.max(pct, d.montant > 0 ? 4 : 0)}%` }}
                  title={`${d.montant.toFixed(0)} €`}
                />
              </div>
              <span className="text-[10px] text-gray-400">{dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
