interface Props {
  ticker:   string
  name:     string
  onRemove: (ticker: string) => void
}

export function AssetChip({ ticker, name, onRemove }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-card border border-[#3d2e10] text-[11px] transition-colors hover:border-accent/40"
    >
      <span className="font-mono font-bold text-teal tracking-wide">{ticker}</span>
      <span className="text-muted-bright hidden sm:inline truncate max-w-[120px]">{name}</span>
      <button
        onClick={() => onRemove(ticker)}
        className="ml-0.5 text-muted hover:text-negative transition-colors w-4 h-4 flex items-center justify-center text-base leading-none"
        aria-label={`Remove ${ticker}`}
      >
        ×
      </button>
    </span>
  )
}
