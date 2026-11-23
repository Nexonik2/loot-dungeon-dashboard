import { useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { UPlotChart } from '../UPlotChart';
import {
  buildJointAuctionSeries,
  type JointYMode,
} from '../../lib/auctionCurve';
import type { PoolHistoryEvent, PoolSummary } from '../../types/dashboard';
import { POOL_COLORS, poolKey, poolLabel } from './poolMeta';
import { DisclosureChevron } from '../DisclosureChevron';

interface JointPoolChartProps {
  pools: PoolSummary[];
  eventsByPool: Map<string, PoolHistoryEvent[]>;
  nowSec: number;
}

const DEFAULT_SELECTED = [
  '1-power_form',
  '2-power_form',
  '3-power_form',
  '4-power_form',
  '5-power_form',
];

export function JointPoolChart({
  pools,
  eventsByPool,
  nowSec,
}: JointPoolChartProps) {
  const [open, setOpen] = useState(true);
  const [yMode, setYMode] = useState<JointYMode>('percent');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(DEFAULT_SELECTED);

  const jointChart = useMemo(() => {
    const active = pools.filter(
      (p): p is PoolSummary & { address: string } =>
        Boolean(p.address) && selectedKeys.includes(poolKey(p)),
    );
    if (active.length === 0) return null;

    const prepared = active.map((p) => ({
      pool: p,
      address: p.address,
      form: p.form,
      seedSpotWei: p.seedSpotWei,
      events: eventsByPool.get(p.address) ?? [],
    }));

    const { timestamps, seriesValues } = buildJointAuctionSeries(
      prepared,
      yMode,
      nowSec,
    );
    if (timestamps.length < 2) return null;

    const aligned: uPlot.AlignedData = [timestamps, ...seriesValues];
    const series: uPlot.Series[] = [
      { label: 'Time' },
      ...prepared.map(({ pool }) => ({
        label: poolLabel(pool),
        stroke: POOL_COLORS[poolKey(pool)] ?? '#38bdf8',
        width: 2,
        value: (_u: uPlot, v: number | null) => {
          if (v === null || v === undefined) return '-';
          return yMode === 'percent'
            ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
            : `${v.toFixed(5)} ETH`;
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
  }, [pools, eventsByPool, selectedKeys, yMode, nowSec]);

  const togglePool = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  return (
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
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/60"
        >
          <span>{open ? 'Hide Chart' : 'Show Chart'}</span>
          <DisclosureChevron open={open} className="text-accent" />
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
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
                onClick={() => setSelectedKeys(DEFAULT_SELECTED)}
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
                onClick={() => setSelectedKeys(pools.map((p) => poolKey(p)))}
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

          <div className="flex flex-wrap gap-1.5">
            {pools.map((p) => {
              const key = poolKey(p);
              const active = selectedKeys.includes(key);
              const swatch = POOL_COLORS[key] ?? '#38bdf8';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePool(key)}
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
  );
}