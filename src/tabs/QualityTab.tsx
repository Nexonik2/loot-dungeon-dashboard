import { useMemo, useState } from 'react';
import { StackedBarRow, StatusLegend, type StatusCounts } from '../components/StackedBar';
import { STATUS_META, STATUS_ORDER, formatInt, formatPct } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { ActiveBeastStatus, QualityResponse } from '../types/dashboard';

export default function QualityTab() {
  const { data, loading, error, refresh } = useApi<QualityResponse>('/api/quality');
  const [barMode, setBarMode] = useState<'percent' | 'count'>('percent');

  const totalActive = useMemo(
    () => (data?.statusTotals ?? []).reduce((sum, r) => sum + r.count, 0),
    [data],
  );

  const summaryByStatus = useMemo(() => {
    const map = new Map<ActiveBeastStatus, QualityResponse['summaryByStatus'][number]>();
    for (const row of data?.summaryByStatus ?? []) {
      map.set(row.status, row);
    }
    return STATUS_ORDER.map((status) => ({
      status,
      ...(map.get(status) ?? { count: 0, avgGrade: null, avgLevel: null, avgPower: null }),
    }));
  }, [data]);

  const gradeRows = useMemo(() => {
    const byGrade = new Map<number, StatusCounts>();
    for (const r of data?.gradeMatrix ?? []) {
      const bucket = byGrade.get(r.cardGrade) ?? {};
      bucket[r.status] = (bucket[r.status] ?? 0) + r.count;
      byGrade.set(r.cardGrade, bucket);
    }
    return Array.from(byGrade.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([grade, counts]) => ({
        grade,
        counts,
        total: STATUS_ORDER.reduce((s, st) => s + (counts[st] ?? 0), 0),
      }));
  }, [data]);

  const tierRows = useMemo(() => {
    const byTier = new Map<number, StatusCounts>();
    for (const r of data?.tierMatrix ?? []) {
      const bucket = byTier.get(r.tier) ?? {};
      bucket[r.status] = (bucket[r.status] ?? 0) + r.count;
      byTier.set(r.tier, bucket);
    }
    return [1, 2, 3, 4, 5]
      .filter((t) => byTier.has(t))
      .map((tier) => {
        const counts = byTier.get(tier) ?? {};
        return {
          tier,
          counts,
          total: STATUS_ORDER.reduce((s, st) => s + (counts[st] ?? 0), 0),
        };
      });
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-surface" />
        <div className="h-72 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-state-sold-reg/40 bg-surface p-5 text-sm">
        <p className="text-ink">Failed to load Beast quality metrics: {error}</p>
        <button
          type="button"
          onClick={refresh}
          className="mt-3 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxGradeTotal = Math.max(...gradeRows.map((g) => g.total), 1);
  const maxTierTotal = Math.max(...tierRows.map((t) => t.total), 1);

  return (
    <div className="space-y-6">
      {/* Active Ownership Summary Strip */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryByStatus.map((item) => (
          <div
            key={item.status}
            className="rounded-xl border border-border bg-surface p-3.5 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-xs ${STATUS_META[item.status].swatchClass}`}
              />
              <span className="truncate text-xs font-medium text-ink-muted">
                {STATUS_META[item.status].label}
              </span>
            </div>
            <div className="num mt-2 flex items-baseline justify-between">
              <span className="text-xl font-semibold text-ink">
                {formatInt(item.count)}
              </span>
              <span className="text-xs text-ink-faint">
                {formatPct(item.count, totalActive)}
              </span>
            </div>
            <div className="num mt-2.5 grid grid-cols-3 gap-1 border-t border-border/70 pt-2 text-[11px] text-ink-faint">
              <div>
                <div>Avg Grd</div>
                <div className="font-medium text-ink-muted">
                  {item.avgGrade !== null ? item.avgGrade.toFixed(2) : '—'}
                </div>
              </div>
              <div>
                <div>Avg Lvl</div>
                <div className="font-medium text-ink-muted">
                  {item.avgLevel !== null ? item.avgLevel.toFixed(1) : '—'}
                </div>
              </div>
              <div>
                <div>Avg Pwr</div>
                <div className="font-medium text-ink-muted">
                  {item.avgPower !== null ? item.avgPower.toFixed(0) : '—'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Mode Toggle + Legend */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <StatusLegend />
        <div
          role="group"
          aria-label="Bar scale mode"
          className="inline-flex self-start rounded-lg border border-border bg-bg p-0.5 text-xs sm:self-auto"
        >
          <button
            type="button"
            onClick={() => setBarMode('percent')}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              barMode === 'percent' ? 'bg-surface-elevated text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Share (%)
          </button>
          <button
            type="button"
            onClick={() => setBarMode('count')}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              barMode === 'count' ? 'bg-surface-elevated text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Count (#)
          </button>
        </div>
      </div>

      {/* Card Grade x Ownership */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">
            Card Grade Distribution by Player Decision
          </h2>
          <p className="text-xs text-ink-muted">
            Excludes superseded pre-conversion tokens ({formatInt(totalActive)} active Beasts)
          </p>
        </div>
        <div className="space-y-4">
          {gradeRows.map((row) => (
            <StackedBarRow
              key={row.grade}
              label={`Grade ${row.grade}`}
              meta={formatPct(row.total, totalActive)}
              counts={row.counts}
              maxTotal={maxGradeTotal}
              mode={barMode}
            />
          ))}
        </div>
      </section>

      {/* Tier x Ownership */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">
            Tier (T1–T5) Breakdown by Ownership State
          </h2>
          <p className="text-xs text-ink-muted">
            Higher-tier scarcity (T1 rarest, T5 most common) vs. staking and buyback sell-through
          </p>
        </div>
        <div className="space-y-4">
          {tierRows.map((row) => (
            <StackedBarRow
              key={row.tier}
              label={`Tier ${row.tier}`}
              meta={formatPct(row.total, totalActive)}
              counts={row.counts}
              maxTotal={maxTierTotal}
              mode={barMode}
            />
          ))}
        </div>
      </section>
    </div>
  );
}