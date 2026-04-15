'use client'

interface Props {
  eta?: string
  children: React.ReactNode
}

export function ComingSoonFeature({ eta, children }: Props) {
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-gray-200">
          <span className="text-xs font-semibold text-accent">Bientôt</span>
          {eta && <span className="text-xs text-gray-400">{eta}</span>}
        </div>
      </div>
    </div>
  )
}
