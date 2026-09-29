interface StatTileProps {
  label: string
  value: number
}

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="border border-novara-border rounded-xl px-5 py-4 bg-white/[0.02]">
      <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <p className="font-clash-display text-[28px] text-white leading-none">{value}</p>
    </div>
  )
}
