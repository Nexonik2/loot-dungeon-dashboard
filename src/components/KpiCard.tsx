interface KpiCardProps {
  label: string;
  value: string;
  denominator?: string;
  sublabel?: string;
  accentClass?: string;
  onDrillDown?: () => void;
  drillDownLabel?: string;
}

export function KpiCard({
  label,
  value,
  denominator,
  sublabel,
  accentClass = 'text-ink',
  onDrillDown,
  drillDownLabel,
}: KpiCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {label}
        </div>
        <div className="num mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className={`text-2xl font-semibold tracking-tight ${accentClass}`}>
            {value}
          </span>
          {denominator && (
            <span className="text-sm font-normal text-ink-faint">
              / {denominator}
            </span>
          )}
        </div>
        {sublabel && (
          <div className="num mt-1 text-xs text-ink-faint">{sublabel}</div>
        )}
      </div>

      {onDrillDown && (
        <button
          type="button"
          onClick={onDrillDown}
          className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-accent transition-colors hover:text-ink"
        >
          <span>{drillDownLabel ?? 'Explore'}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}