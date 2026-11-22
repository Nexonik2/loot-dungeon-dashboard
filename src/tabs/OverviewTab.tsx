import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type uPlot from 'uplot';
import { KpiCard } from '../components/KpiCard';
import { UPlotChart } from '../components/UPlotChart';
import { formatEth, formatInt, formatPct } from '../lib/format';
import type { OverviewResponse } from '../types/dashboard';

export type TabId = 'overview' | 'quality' | 'pools';

interface OverviewTabProps {
  data: OverviewResponse;
  onNavigate: (tab: TabId) => void;
}

type SpeciesSort = 'saturation' | 'staked' | 'powerForm' | 'claimed';

export function OverviewTab({ data, onNavigate }: OverviewTabProps) {
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<SpeciesSort>('saturation');

  const kpis = data.kpis;
  const cap = kpis?.cap ?? 207;

  // Map both 78..107 and 1..30 IDs cleanly to catalog metadata
  const speciesRows = useMemo(() => {
    const byId = new Map(data.speciesCatalog.map((c) => [c.beastId, c]));

    return data.speciesSnapshot
      .map((s) => {
        const meta = byId.get(s.beastId) ?? byId.get(s.beastId + 77);
        const powerForm = s.evolved ?? s.mega ?? 0;
        const safeStaked = Math.max(0, s.staked - s.unsafeStaked);
        const reserved = s.reserved ?? s.staked + powerForm;
        const saturationRatio = cap > 0 ? reserved / cap : 0;

        return {
          id: s.beastId,
          name: meta?.name ?? `Species #${s.beastId}`,
          type: meta?.type ?? '—',
          tier: meta?.tier ?? 0,
          claimed: s.claimed,
          held: s.held,
          staked: s.staked,
          safeStaked,
          unsafeStaked: s.unsafeStaked,
          taken: s.taken,
          powerForm,
          reserved,
          saturationRatio,
        };
      })
      .filter((row) => (tierFilter === 'all' ? true : row.tier === tierFilter))
      .sort((a, b) => {
        if (sortBy === 'staked') return b.staked - a.staked;
        if (sortBy === 'powerForm') return b.powerForm - a.powerForm;
        if (sortBy === 'claimed') return b.claimed - a.claimed;
        return b.saturationRatio - a.saturationRatio;
      });
  }, [data.speciesSnapshot, data.speciesCatalog, cap, tierFilter, sortBy]);

  const timeSeriesData = useMemo<uPlot.AlignedData | null>(() => {
    if (data.history.length < 2) return null;
    return [
      data.history.map((p) => p.ts),
      data.history.map((p) => p.claimed),
      data.history.map((p) => p.staked),
      data.history.map((p) => p.powerForm),
      data.history.map((p) => p.taken),
    ];
  }, [data.history]);

  const timeSeriesConfig = useMemo<uPlot.Series[]>(
    () => [
      { label: 'Time' },
      { label: 'Claimed', stroke: '#38bdf8', width: 2 },
      { label: 'Staked', stroke: '#f59e0b', width: 2 },
      { label: 'Power Form', stroke: '#8b5cf6', width: 2 },
      { label: 'Captured', stroke: '#ef4444', width: 2 },
    ],
    [],
  );

  if (!kpis) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-muted">
        No transformation snapshots recorded yet. Run <code className="text-ink">/api/sync</code> to populate the overview.
      </div>
    );
  }

  const stakingIntentCount = kpis.staked + kpis.taken + kpis.powerForm;
  const resolvedCount = kpis.taken + kpis.powerForm;
  const maxPeriodDays = Math.round(kpis.maxPeriodSeconds / 86400);
  const satScale = scaleLinear().domain([0, cap]).range([0, 100]).clamp(true);

  return (
    <div className="space-y-6">
      {/* Headline KPI Strip */}
      <section aria-label="Headline metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Beasts Claimed"
          value={formatInt(kpis.claimed)}
          sublabel={`${formatInt(kpis.held)} currently held`}
          onDrillDown={() => onNavigate('quality')}
          drillDownLabel="Quality breakdown"
        />
        <KpiCard
          label="Staked (Huntable)"
          value={formatInt(kpis.staked)}
          sublabel={`${formatPct(stakingIntentCount, kpis.claimed)} staking intent`}
          accentClass="text-state-staked"
          onDrillDown={() => onNavigate('quality')}
          drillDownLabel="Inspect staked grades"
        />
        <KpiCard
          label="Power Form Created"
          value={formatInt(kpis.powerForm)}
          sublabel={`${formatPct(kpis.powerForm, Math.max(resolvedCount, 1))} survival rate`}
          accentClass="text-state-held-pf"
        />
        <KpiCard
          label="Captured in Pool"
          value={formatInt(kpis.taken)}
          sublabel={`${formatInt(kpis.unsafeStaked)} unsafe queued`}
          accentClass="text-state-sold-reg"
        />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard
            label="Buyback Volume (Net)"
            value={formatEth(kpis.netEthWei, 4)}
            sublabel={`${formatInt(kpis.totalSold)} Beasts sold`}
            accentClass="text-state-sold-pf"
            onDrillDown={() => onNavigate('pools')}
            drillDownLabel="10-pool economics"
          />
        </div>
      </section>

      {/* Topic Drill-Down Summary Cards */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('quality')}
          className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/60 hover:bg-surface-elevated"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Beast Quality &amp; Player Decisions
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Compare Card Grades (5–10) and Tiers (T1–T5) across Staked, Held, and Buyback-Sold Beasts to see whether players dump low-grade rolls while staking high-grade cards.
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-border bg-bg px-2.5 py-1 text-xs font-medium text-accent group-hover:border-accent/50">
              Open →
            </span>
          </div>
          <div className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-ink-faint">
            <span>Max stake timer: <strong className="text-ink-muted">{maxPeriodDays}d</strong></span>
            <span>Power Form cap/species: <strong className="text-ink-muted">{cap}</strong></span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pools')}
          className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent/60 hover:bg-surface-elevated"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Buyback Pools &amp; ETH Economics
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Track all 10 Tier × Form Sudoswap ETH buyback pools, realized player payouts vs. 9.75% compounding fees, and post-sale bonding curve spot prices.
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-border bg-bg px-2.5 py-1 text-xs font-medium text-accent group-hover:border-accent/50">
              Open →
            </span>
          </div>
          <div className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-ink-faint">
            <span>Gross volume: <strong className="text-ink-muted">{formatEth(kpis.grossEthWei, 4)}</strong></span>
            <span>Sold count: <strong className="text-ink-muted">{formatInt(kpis.totalSold)}</strong></span>
          </div>
        </button>
      </section>

      {/* Staking & Capture Time-Series */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Staking, Power Form &amp; Capture Trajectory
            </h2>
            <p className="text-xs text-ink-muted">
              Daily persisted snapshots from the Loot Dungeon staking escrow
            </p>
          </div>
          <span className="num text-xs text-ink-faint">
            {formatInt(data.history.length)} snapshots
          </span>
        </div>

        {timeSeriesData ? (
          <UPlotChart data={timeSeriesData} series={timeSeriesConfig} height={240} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-bg p-6 text-center text-xs text-ink-muted">
            Only {data.history.length} snapshot recorded so far—the time-series curve will appear automatically after the next scheduled sync.
          </div>
        )}
      </section>

      {/* 30-Species Queue Saturation */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Species Queue Saturation vs. {cap} Power Form Cap
            </h2>
            <p className="text-xs text-ink-muted">
              Reserved slots (Power Form + Staked) per species across all 30 Loot Dungeon folklore Beasts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by tier"
              value={tierFilter}
              onChange={(e) =>
                setTierFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">All Tiers</option>
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort species"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SpeciesSort)}
              className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="saturation">Sort: Cap Saturation</option>
              <option value="staked">Sort: Currently Staked</option>
              <option value="powerForm">Sort: Power Form</option>
              <option value="claimed">Sort: Total Claimed</option>
            </select>
          </div>
        </div>

        {/* Mini Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-state-held-pf" /> Power Form
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-state-staked" /> Safe Staked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-warn" /> Overflow / Unsafe Staked
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {speciesRows.map((sp) => {
            const pfW = satScale(sp.powerForm);
            const safeW = satScale(sp.safeStaked);
            const unsafeW = satScale(sp.unsafeStaked);
            return (
              <div
                key={sp.id}
                className="rounded-lg border border-border/70 bg-bg p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {sp.tier > 0 && (
                      <span className="num rounded bg-surface-elevated px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                        T{sp.tier}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-ink">{sp.name}</span>
                    <span className="hidden sm:inline text-xs text-ink-faint">{sp.type}</span>
                  </div>
                  <span className="num shrink-0 text-xs font-medium text-ink">
                    {formatInt(sp.reserved)} / {cap}{' '}
                    <span className="text-ink-faint">
                      ({formatPct(sp.reserved, cap, 0)})
                    </span>
                  </span>
                </div>

                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  {pfW > 0 && (
                    <div
                      style={{ width: `${pfW}%` }}
                      className="h-full bg-state-held-pf"
                      title={`Power Form: ${sp.powerForm}`}
                    />
                  )}
                  {safeW > 0 && (
                    <div
                      style={{ width: `${safeW}%` }}
                      className="h-full bg-state-staked"
                      title={`Safe Staked: ${sp.safeStaked}`}
                    />
                  )}
                  {unsafeW > 0 && (
                    <div
                      style={{ width: `${unsafeW}%` }}
                      className="h-full bg-warn"
                      title={`Overflow Staked: ${sp.unsafeStaked}`}
                    />
                  )}
                </div>

                <div className="num flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-ink-faint">
                  <span>Claimed: {formatInt(sp.claimed)}</span>
                  <span>Staked: {formatInt(sp.staked)}</span>
                  <span>Power Form: {formatInt(sp.powerForm)}</span>
                  <span>Captured: {formatInt(sp.taken)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}