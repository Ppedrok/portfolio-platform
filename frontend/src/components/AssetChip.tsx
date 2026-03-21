interface Props {
  ticker: string
  name:   string
  onRemove: (ticker: string) => void
}

export function AssetChip({ ticker, name, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#6366f120] border border-[#6366f140] text-sm font-medium">
      <span className="font-semibold text-[#6366f1]">{ticker}</span>
      <span className="text-muted text-xs hidden sm:inline truncate max-w-[120px]">{name}</span>
      <button
        onClick={() => onRemove(ticker)}
        className="ml-0.5 text-muted hover:text-white transition-colors rounded-full hover:bg-white/10 w-4 h-4 flex items-center justify-center text-base leading-none"
        aria-label={`Remove ${ticker}`}
      >
        ×
      </button>
    </span>
  )
}
