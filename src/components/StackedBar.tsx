import { scaleLinear } from 'd3-scale';
import { STATUS_META, STATUS_ORDER, formatInt, formatPct } from '../lib/format';
import type { ActiveBeastStatus } from '../types/dashboard';

export type StatusCounts = Partial<Record<ActiveBeastStatus, number>>;

interface StackedBarRowProps {
  label: string;
  meta?: string;
  counts: StatusCounts;
  maxTotal: number;
  mode: 'percent' | 'count';
}

export function StatusLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
      {STATUS_ORDER.map((status) => (
        <div key={status} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-xs ${STATUS_META[status].swatchClass}`}
          />
          <span>{compact ? STATUS_META[status].shortLabel : STATUS_META[status].label}</span>
        </div>
      ))}
    </div>
  );
}

export function StackedBarRow({
  label,
  meta,
  counts,
  maxTotal,
  mode,
}: StackedBarRowProps) {
  const rowTotal = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const domainMax = mode === 'percent' ? Math.max(rowTotal, 1) : Math.max(maxTotal, 1);
  const pctScale = scaleLinear().domain([0, domainMax]).range([0, 100]).clamp(true);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium text-ink">{label}</span>
          {meta && <span className="truncate text-ink-faint">{meta}</span>}
        </div>
        <span className="num shrink-0 font-medium text-ink-muted">
          {formatInt(rowTotal)}
        </span>
      </div>

      <div className="flex h-5 w-full overflow-hidden rounded-md bg-bg ring-1 ring-border/70">
        {STATUS_ORDER.map((status) => {
          const val = counts[status] ?? 0;
          if (val <= 0) return null;
          const widthPct = pctScale(val);
          return (
            <div
              key={status}
              style={{
                width: `${widthPct}%`,
                backgroundColor: STATUS_META[status].colorVar,
              }}
              title={`${STATUS_META[status].label}: ${formatInt(val)} (${formatPct(val, rowTotal)})`}
              className="h-full border-r border-bg/40 last:border-r-0"
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-ink-faint num">
        {STATUS_ORDER.map((status) => {
          const val = counts[status] ?? 0;
          if (val <= 0) return null;
          return (
            <span key={status} className="inline-flex items-center gap-1">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_META[status].swatchClass}`}
              />
              <span>{STATUS_META[status].shortLabel}:</span>
              <span className="text-ink-muted">
                {formatInt(val)} ({formatPct(val, rowTotal, 0)})
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}