import { PoolSparkline } from './PoolSparkline';
import {
  buildSinglePoolCurve,
  evaluatePoolPriceAt,
  getDailyGrowthRate,
} from '../../lib/auctionCurve';
import {
  formatEth,
  formatInt,
  formatRelativeTime,
  shortAddr,
  weiToEthNumber,
} from '../../lib/format';
import type { PoolHistoryEvent, PoolSummary } from '../../types/dashboard';
import { formatEthFloat, poolLabel } from './poolMeta';
import { DisclosureChevron } from '../DisclosureChevron';

interface PoolCardProps {
  pool: PoolSummary | null;
  events: PoolHistoryEvent[];
  nowSec: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function PoolCard({
  pool,
  events,
  nowSec,
  isExpanded,
  onToggleExpand,
}: PoolCardProps) {
  if (!pool || !pool.address) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg/40 p-3 text-xs text-ink-faint">
        Pool not configured
      </div>
    );
  }

  const curve = buildSinglePoolCurve(events, pool.form, nowSec);
  const seedEth = weiToEthNumber(pool.seedSpotWei);
  const liveEth = evaluatePoolPriceAt(events, pool.form, nowSec);
  const pctVsSeed =
    liveEth !== null && seedEth > 0 ? ((liveEth - seedEth) / seedEth) * 100 : null;
  const isPF = pool.form === 'power_form';
  const stroke = isPF ? '#10b981' : '#38bdf8';
  const fill = isPF ? 'rgba(16, 185, 129, 0.14)' : 'rgba(56, 189, 248, 0.14)';
  const poolSales = events.filter((e) => e.kind !== 'seed').reverse();
  const dailyPct = Math.round((getDailyGrowthRate(pool.form) - 1) * 100);

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
        onClick={onToggleExpand}
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
              +{dailyPct}%/day drift · {formatInt(pool.nftsSold)} sold
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
          <span className="inline-flex items-center gap-1 text-accent">
            <span>{isExpanded ? 'Hide details' : 'Details'}</span>
            <DisclosureChevron open={isExpanded} className="text-accent" />
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
              No sales yet. Curve reflects continuous +{dailyPct}%/day Dutch auction climb since launch seed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}