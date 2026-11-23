import { useMemo, useState } from 'react';
import { StackedBarRow, type StatusCounts } from '../StackedBar';
import { STATUS_META, STATUS_ORDER, formatInt, formatPct } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import type { ActiveBeastStatus, QualityResponse } from '../../types/dashboard';

export function QualityBreakdownSection() {
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

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
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

  const maxTierTotal = Math.max(...tierRows.map((t) => t.total), 1);
  const maxGradeTotal = Math.max(...gradeRows.map((g) => g.total), 1);

  return (
    <div className="space-y-6">
      {/* Unified Ownership Legend + Averages + Bar Scale Control */}
      <section
        aria-label="Active Beast ownership breakdown"
        className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Active Beast Ownership ({formatInt(totalActive)})
            </h2>
            <p className="text-xs text-ink-muted">
              Legend and averages for the Beast Tier and Card Grade charts below
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-faint">Bar scale:</span>
            <div
              role="group"
              aria-label="Bar scale mode"
              className="inline-flex rounded-lg border border-border bg-bg p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => setBarMode('percent')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  barMode === 'percent'
                    ? 'bg-surface-elevated text-accent'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Share (%)
              </button>
              <button
                type="button"
                onClick={() => setBarMode('count')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  barMode === 'count'
                    ? 'bg-surface-elevated text-accent'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Count (#)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {summaryByStatus.map((item) => (
            <div
              key={item.status}
              className="rounded-lg border border-border/70 bg-bg p-3 space-y-2.5"
            >
              {/* Single header row: swatch, topic name, count, % of total */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border/70 pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-xs ${STATUS_META[item.status].swatchClass}`}
                  />
                  <span className="truncate text-xs font-medium text-ink">
                    {STATUS_META[item.status].shortLabel}
                  </span>
                </div>
                <div className="num flex shrink-0 items-baseline gap-1 text-xs">
                  <span className="font-semibold text-ink">
                    {formatInt(item.count)}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    ({formatPct(item.count, totalActive)})
                  </span>
                </div>
              </div>

              {/* 3 vertical stat rows */}
              <div className="num space-y-1 text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-faint">Avg. Grade</span>
                  <span className="font-medium text-ink-muted">
                    {item.avgGrade !== null ? item.avgGrade.toFixed(2) : '-'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-faint">Avg. Level</span>
                  <span className="font-medium text-ink-muted">
                    {item.avgLevel !== null ? item.avgLevel.toFixed(1) : '-'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-faint">Avg. Power</span>
                  <span className="font-medium text-ink-muted">
                    {item.avgPower !== null ? item.avgPower.toFixed(0) : '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Beast Tier (1-5) — moved above Card Grade */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">Beast Tier (1-5)</h2>
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

      {/* Card Grade (5-10) */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">Card Grade (5-10)</h2>
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
    </div>
  );
}