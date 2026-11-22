import { useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { KpiCard } from '../components/KpiCard';
import { PoolSparkline } from '../components/PoolSparkline';
import { UPlotChart } from '../components/UPlotChart';
import {
  buildJointAuctionSeries,
  buildSinglePoolCurve,
  evaluatePoolPriceAt,
  getDailyGrowthRate,
  type JointYMode,
} from '../lib/auctionCurve';
import {
  formatEth,
  formatInt,
  formatRelativeTime,
  shortAddr,
  weiToEthNumber,
} from '../lib/format';
import { useApi } from '../lib/useApi';
import type { PoolHistoryEvent, PoolSummary, PoolsResponse } from '../types/dashboard';

const PAGE_SIZE = 8;

const POOL_COLORS: Record<string, string> = {
  '1-regular': '#38bdf8',
  '2-regular': '#60a5fa',
  '3-regular': '#818cf8',
  '4-regular': '#f59e0b',
  '5-regular': '#fb7185',
  '1-power_form': '#10b981',
  '2-power_form': '#34d399',
  '3-power_form': '#a78bfa',
  '4-power_form': '#c084fc',
  '5-power_form': '#f472b6',
};

function poolKey(p: Pick<PoolSummary, 'tier' | 'form'>): string {
  return `${p.tier}-${p.form}`;
}

function poolLabel(p: Pick<PoolSummary, 'tier' | 'form'>): string {
  return `T${p.tier} ${p.form === 'power_form' ? 'Power Form' : 'Regular'}`;
}

function formatEthFloat(eth: number | null, decimals = 5): string {
  if (eth === null || !Number.isFinite(eth)) return '—';
  return `${eth.toFixed(decimals)} ETH`;
}

export default function PoolsTab() {
  const { data, loading, error, refresh } = useApi<PoolsResponse>('/api/pools');
  const [expandedPoolAddr, setExpandedPoolAddr] = useState<string | null>(null);
  const [showJointChart, setShowJointChart] = useState(true);
  const [showLedger, setShowLedger] = useState(false);
  const [yMode, setYMode] = useState<JointYMode>('percent');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([
    '1-power_form',
    '2-power_form',
    '3-power_form',
    '4-power_form',
    '5-power_form',
  ]);
  const [page, setPage] = useState(0);

  // Freeze `nowSec` per mount/refresh so curves don't re-instantiate on unrelated clicks
  const nowSec = useMemo(() => Math.floor(Date.now() / 1000), [data]);

  const eventsByPool = useMemo(() => {
    const map = new Map<string, PoolHistoryEvent[]>();
    for (const ev of data?.spotHistory ?? []) {
      const list = map.get(ev.poolAddress) ?? [];
      list.push(ev);
      map.set(ev.poolAddress, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.ts - b.ts);
    }
    return map;
  }, [data]);

  const totals = useMemo(() => {
    const pools = data?.pools ?? [];
    let netWei = 0n;
    let grossWei = 0n;
    let totalSold = 0;
    let totalTxs = 0;

    for (const p of pools) {
      netWei += BigInt(p.netEthWei || '0');
      grossWei += BigInt(p.grossEthWei || '0');
      totalSold += p.nftsSold;
      totalTxs += p.saleTxs;
    }

    const feesWei = grossWei > netWei ? grossWei - netWei : 0n;
    return {
      netWei: netWei.toString(),
      grossWei: grossWei.toString(),
      feesWei: feesWei.toString(),
      totalSold,
      totalTxs,
    };
  }, [data]);

  // Pair each tier's Regular and Power Form pool side-by-side
  const tierPairs = useMemo(() => {
    const pools = data?.pools ?? [];
    return [1, 2, 3, 4, 5].map((tier) => {
      const regular = pools.find((p) => p.tier === tier && p.form === 'regular') ?? null;
      const powerForm = pools.find((p) => p.tier === tier && p.form === 'power_form') ?? null;
      return { tier, regular, powerForm };
    });
  }, [data]);

  // Joint comparison chart dataset
  const jointChart = useMemo(() => {
    const pools = (data?.pools ?? []).filter(
      (p): p is PoolSummary & { address: string } =>
        Boolean(p.address) && selectedKeys.includes(poolKey(p)),
    );
    if (pools.length === 0) return null;

    const prepared = pools.map((p) => ({
      pool: p,
      address: p.address,
      form: p.form,
      seedSpotWei: p.seedSpotWei,
      events: eventsByPool.get(p.address) ?? [],
    }));

    const { timestamps, seriesValues } = buildJointAuctionSeries(prepared, yMode, nowSec);
    if (timestamps.length < 2) return null;

    const aligned: uPlot.AlignedData = [timestamps, ...seriesValues];
    const series: uPlot.Series[] = [
      { label: 'Time' },
      ...prepared.map(({ pool }) => ({
        label: poolLabel(pool),
        stroke: POOL_COLORS[poolKey(pool)] ?? '#38bdf8',
        width: 2,
        value: (_u: uPlot, v: number | null) => {
          if (v === null || v === undefined) return '—';
          return yMode === 'percent' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : `${v.toFixed(5)} ETH`;
        },
      })),
    ];

    const scales: uPlot.Scales =
      yMode === 'log'
        ? { x: { time: true }, y: { distr: 3, log: 10 } }
        : { x: { time: true } };

    const axes: uPlot.Axis[] = [
      {
        stroke: '#94a3b8',
        grid: { stroke: 'rgba(148, 163, 184, 0.12)', width: 1 },
      },
      {
        stroke: '#94a3b8',
        grid: { stroke: 'rgba(148, 163, 184, 0.12)', width: 1 },
        size: 74,
        values: (_u, vals) =>
          vals.map((v) =>
            yMode === 'percent'
              ? `${v >= 0 ? '+' : ''}${Math.round(v)}%`
              : v.toFixed(5),
          ),
      },
    ];

    return { aligned, series, scales, axes };
  }, [data, eventsByPool, selectedKeys, yMode, nowSec]);

  const togglePoolSelection = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-surface" />
        <div className="h-72 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-state-sold-reg/40 bg-surface p-5 text-sm">
        <p className="text-ink">Failed to load buyback pool metrics: {error}</p>
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

  const totalPages = Math.max(1, Math.ceil(data.recentSales.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleSales = data.recentSales.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const renderPoolCard = (pool: PoolSummary | null) => {
    if (!pool || !pool.address) {
      return (
        <div className="rounded-lg border border-dashed border-border bg-bg/40 p-3 text-xs text-ink-faint">
          Pool not configured
        </div>
      );
    }

    const events = eventsByPool.get(pool.address) ?? [];
    const curve = buildSinglePoolCurve(events, pool.form, nowSec);
    const seedEth = weiToEthNumber(pool.seedSpotWei);
    const liveEth = evaluatePoolPriceAt(events, pool.form, nowSec);
    const pctVsSeed =
      liveEth !== null && seedEth > 0 ? ((liveEth - seedEth) / seedEth) * 100 : null;
    const isExpanded = expandedPoolAddr === pool.address;
    const isPF = pool.form === 'power_form';
    const stroke = isPF ? '#10b981' : '#38bdf8';
    const fill = isPF ? 'rgba(16, 185, 129, 0.14)' : 'rgba(56, 189, 248, 0.14)';
    const poolSales = events.filter((e) => e.kind !== 'seed').reverse();

    return (
      <div
        className={`rounded-lg border transition-colors ${
          isExpanded
            ? 'border-accent bg-surface-elevated'
            : 'border-border/80 bg-bg'
        }`}
      >
        <button
          type="button"
          onClick={() => setExpandedPoolAddr(isExpanded ? null : pool.address)}
          className="w-full p-3 text-left space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isPF ? 'bg-state-sold-pf' : 'bg-accent'
                  }`}
                />
                <span className="text-sm font-semibold text-ink">
                  {poolLabel(pool)}
                </span>
              </div>
              <div className="num text-[11px] text-ink-faint">
                +{Math.round((getDailyGrowthRate(pool.form) - 1) * 100)}%/day drift ·{' '}
                {formatInt(pool.nftsSold)} sold
              </div>
            </div>

            <div className="num text-right">
              <div className="text-sm font-semibold text-ink">
                {formatEthFloat(liveEth, 5)}
              </div>
              {pctVsSeed !== null && (
                <div
                  className={`text-[11px] font-medium ${
                    pctVsSeed >= 0 ? 'text-state-sold-pf' : 'text-state-sold-reg'
                  }`}
                >
                  {pctVsSeed >= 0 ? '+' : ''}
                  {pctVsSeed.toFixed(0)}% vs seed
                </div>
              )}
            </div>
          </div>

          <PoolSparkline
            points={curve}
            stroke={stroke}
            fill={fill}
            seedEth={seedEth}
          />

          <div className="num flex items-center justify-between text-[11px] text-ink-faint">
            <span>Net Vol: {formatEth(pool.netEthWei, 4)}</span>
            <span className="text-accent">
              {isExpanded ? 'Hide details ▲' : 'Details ▼'}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border/80 px-3 py-3 text-xs space-y-2.5">
            <div className="num grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-ink-faint">Seed Spot:</span>{' '}
                <span className="text-ink-muted">{formatEth(pool.seedSpotWei, 5)}</span>
              </div>
              <div>
                <span className="text-ink-faint">Post-Sale Spot:</span>{' '}
                <span className="text-ink-muted">{formatEth(pool.latestSpotWei, 5)}</span>
              </div>
              <div>
                <span className="text-ink-faint">Gross Volume:</span>{' '}
                <span className="text-ink-muted">{formatEth(pool.grossEthWei, 5)}</span>
              </div>
              <div>
                <span className="text-ink-faint">Contract:</span>{' '}
                <a
                  href={`https://starkscan.co/contract/${pool.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-accent hover:underline"
                >
                  {shortAddr(pool.address)}
                </a>
              </div>
            </div>

            {poolSales.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-ink-muted">
                  Recent Sales ({poolSales.length})
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-border/50 rounded-md border border-border/60 bg-bg/60 px-2 num text-[11px]">
                  {poolSales.map((ev, idx) => (
                    <div
                      key={`${ev.ts}-${idx}`}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-ink-faint">
                        {formatRelativeTime(ev.ts)} · {ev.nftCount ?? 1}x
                      </span>
                      <span className="text-state-sold-pf">
                        {formatEth(ev.amountWei, 5)}
                      </span>
                      <span className="text-ink-muted">
                        Spot {formatEth(ev.spotPriceWei, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-ink-faint">
                No sales yet—curve reflects continuous +{Math.round((getDailyGrowthRate(pool.form) - 1) * 100)}%/day Dutch auction climb since launch seed.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* High-Level ETH Economics Strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Net Paid to Players"
          value={formatEth(totals.netWei, 4)}
          sublabel="90.25% of gross outflow"
          accentClass="text-state-sold-pf"
        />
        <KpiCard
          label="Gross Pool Volume"
          value={formatEth(totals.grossWei, 4)}
          sublabel="Pre-fee ETH liquidity spent"
        />
        <KpiCard
          label="Fees Captured (9.75%)"
          value={formatEth(totals.feesWei, 5)}
          sublabel="Compounding 5% + 5% cut"
          accentClass="text-state-staked"
        />
        <KpiCard
          label="Buyback Sales"
          value={formatInt(totals.totalSold)}
          sublabel={`${formatInt(totals.totalTxs)} swap txs across 10 pools`}
        />
      </section>

      {/* Side-by-Side 5-Tier Small Multiples (Regular | Power Form) */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Side-by-Side Reverse Dutch Auction Curves (T1–T5)
          </h2>
          <p className="text-xs text-ink-muted">
            Each pool scales independently (dashed line = launch seed). Prices climb continuously (+50%/day Regular, +30%/day Power Form) and drop on every sale. Tap any pool to expand details.
          </p>
        </div>

        <div className="space-y-3">
          {tierPairs.map(({ tier, regular, powerForm }) => (
            <div key={tier} className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Tier {tier}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {renderPoolCard(regular)}
                {renderPoolCard(powerForm)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Expandable Joint Comparison Chart */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Joint Multi-Pool Curve Comparison
            </h2>
            <p className="text-xs text-ink-muted">
              Toggle pools on/off and switch between % vs. Seed, Log ETH, or Raw ETH
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowJointChart((v) => !v)}
            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/60"
          >
            {showJointChart ? 'Collapse Chart ▲' : 'Expand Chart ▼'}
          </button>
        </div>

        {showJointChart && (
          <div className="mt-4 space-y-4">
            {/* Scale Switcher + Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Y-axis scale mode"
                className="inline-flex rounded-lg border border-border bg-bg p-0.5 text-xs"
              >
                {(
                  [
                    ['percent', '% vs. Seed'],
                    ['log', 'Log ETH'],
                    ['raw', 'Raw ETH'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setYMode(mode)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      yMode === mode
                        ? 'bg-surface-elevated text-ink'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys([
                      '1-power_form',
                      '2-power_form',
                      '3-power_form',
                      '4-power_form',
                      '5-power_form',
                    ])
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-ink-muted hover:text-ink"
                >
                  All Power Form
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys([
                      '1-regular',
                      '2-regular',
                      '3-regular',
                      '4-regular',
                      '5-regular',
                    ])
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-ink-muted hover:text-ink"
                >
                  All Regular
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys(data.pools.map((p) => poolKey(p)))
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-ink-muted hover:text-ink"
                >
                  All 10
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeys([])}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-ink-faint hover:text-ink"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Individual Pool Toggle Chips */}
            <div className="flex flex-wrap gap-1.5">
              {data.pools.map((p) => {
                const key = poolKey(p);
                const active = selectedKeys.includes(key);
                const swatch = POOL_COLORS[key] ?? '#38bdf8';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePoolSelection(key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-ink-muted bg-surface-elevated text-ink'
                        : 'border-border bg-bg text-ink-faint hover:text-ink-muted'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: swatch, opacity: active ? 1 : 0.35 }}
                      className="h-2 w-2 rounded-full"
                    />
                    <span>{poolLabel(p)}</span>
                  </button>
                );
              })}
            </div>

            {jointChart ? (
              <UPlotChart
                data={jointChart.aligned}
                series={jointChart.series}
                scales={jointChart.scales}
                axes={jointChart.axes}
                height={270}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-bg p-6 text-center text-xs text-ink-muted">
                Toggle at least one pool above to compare curves.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Collapsible Global Recent Sales Ledger */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              All Recent Buyback Sales ({formatInt(data.recentSales.length)})
            </h2>
            <p className="text-xs text-ink-muted">
              Realized net ETH payouts and post-sale spot prices across all 10 pools
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLedger((v) => !v)}
            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/60"
          >
            {showLedger ? 'Hide Ledger ▲' : 'Show Ledger ▼'}
          </button>
        </div>

        {showLedger && (
          <div className="mt-4 space-y-3">
            {totalPages > 1 && (
              <div className="num flex items-center justify-end gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-ink disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-1 text-ink-muted">
                  {safePage + 1}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-medium">Pool</th>
                    <th className="py-2 px-3 text-right font-medium">Qty</th>
                    <th className="py-2 px-3 text-right font-medium">Net Payout</th>
                    <th className="py-2 px-3 text-right font-medium">Post Spot</th>
                    <th className="py-2 px-3 text-right font-medium">When</th>
                    <th className="py-2 pl-3 text-right font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 num">
                  {visibleSales.map((s) => (
                    <tr key={`${s.txHash}-${s.poolAddress}`}>
                      <td className="py-2.5 pr-3 font-medium text-ink">
                        {poolLabel(s)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-muted">
                        {formatInt(s.nftCount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-state-sold-pf">
                        {formatEth(s.amountWei, 5)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-muted">
                        {formatEth(s.spotPriceWei, 5)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-faint">
                        {formatRelativeTime(s.ts)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <a
                          href={`https://starkscan.co/tx/${s.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-accent hover:underline"
                        >
                          {shortAddr(s.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}