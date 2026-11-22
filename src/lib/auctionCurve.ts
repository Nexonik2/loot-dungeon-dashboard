import { weiToEthNumber } from './format';
import type { PoolHistoryEvent } from '../types/dashboard';

const DAILY_GROWTH: Record<'regular' | 'power_form', number> = {
  regular: 1.5,
  power_form: 1.3,
};

export interface CurvePoint {
  ts: number;
  eth: number;
}

/** Daily exponential multiplier verified from onchain deltaHex */
export function getDailyGrowthRate(form: 'regular' | 'power_form'): number {
  return DAILY_GROWTH[form];
}

/**
 * Evaluates a pool's reverse-Dutch-auction spot price at Unix timestamp `ts`.
 * Between discrete sale/seed anchors, spot price grows exponentially at `r^(dt / 86400)`.
 * Immediately before a sale (`ts = sale.ts - 1`), it reflects the pre-sale peak;
 * at `ts = sale.ts`, it steps down to the post-sale `spotPrice`.
 */
export function evaluatePoolPriceAt(
  sortedEvents: PoolHistoryEvent[],
  form: 'regular' | 'power_form',
  ts: number,
): number | null {
  if (sortedEvents.length === 0) return null;
  if (ts < sortedEvents[0].ts) return null;

  let anchor = sortedEvents[0];
  for (let i = 1; i < sortedEvents.length; i++) {
    if (sortedEvents[i].ts <= ts) {
      anchor = sortedEvents[i];
    } else {
      break;
    }
  }

  const baseEth = weiToEthNumber(anchor.spotPriceWei);
  if (baseEth <= 0) return null;

  const dtDays = Math.max(0, ts - anchor.ts) / 86400;
  return baseEth * Math.pow(DAILY_GROWTH[form], dtDays);
}

/**
 * Generates smooth sampled points for a single pool's inline SVG sparkline.
 */
export function buildSinglePoolCurve(
  events: PoolHistoryEvent[],
  form: 'regular' | 'power_form',
  nowSec: number,
  sampleStepSec = 7200,
): CurvePoint[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const startTs = sorted[0].ts;
  const endTs = Math.max(nowSec, sorted[sorted.length - 1].ts + 60);

  const tsSet = new Set<number>();
  for (let t = startTs; t <= endTs; t += sampleStepSec) {
    tsSet.add(t);
  }
  tsSet.add(endTs);

  for (const ev of sorted) {
    if (ev.ts > startTs) {
      tsSet.add(ev.ts - 1); // pre-sale peak right before step-down
    }
    tsSet.add(ev.ts);
  }

  const timestamps = Array.from(tsSet).sort((a, b) => a - b);
  const points: CurvePoint[] = [];

  for (const ts of timestamps) {
    const eth = evaluatePoolPriceAt(sorted, form, ts);
    if (eth !== null) {
      points.push({ ts, eth });
    }
  }
  return points;
}

export type JointYMode = 'percent' | 'log' | 'raw';

/**
 * Builds a strictly-ascending shared timestamp grid for uPlot across multiple toggled pools.
 */
export function buildJointAuctionSeries(
  pools: Array<{
    address: string;
    form: 'regular' | 'power_form';
    seedSpotWei: string | null;
    events: PoolHistoryEvent[];
  }>,
  mode: JointYMode,
  nowSec: number,
): { timestamps: number[]; seriesValues: Array<Array<number | null>> } {
  const prepared = pools.map((p) => ({
    ...p,
    sorted: [...p.events].sort((a, b) => a.ts - b.ts),
    seedEth: weiToEthNumber(p.seedSpotWei ?? p.events[0]?.spotPriceWei),
  }));

  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = nowSec;
  for (const p of prepared) {
    if (p.sorted.length > 0) {
      minTs = Math.min(minTs, p.sorted[0].ts);
      maxTs = Math.max(maxTs, p.sorted[p.sorted.length - 1].ts + 60);
    }
  }

  if (!Number.isFinite(minTs)) {
    return { timestamps: [], seriesValues: [] };
  }

  const spanSec = Math.max(3600, maxTs - minTs);
  const sampleStepSec = Math.max(1800, Math.round(spanSec / 140));
  const tsSet = new Set<number>();

  for (let t = minTs; t <= maxTs; t += sampleStepSec) {
    tsSet.add(t);
  }
  tsSet.add(maxTs);

  for (const p of prepared) {
    for (const ev of p.sorted) {
      if (ev.ts > minTs) {
        tsSet.add(ev.ts - 1);
      }
      tsSet.add(ev.ts);
    }
  }

  const timestamps = Array.from(tsSet).sort((a, b) => a - b);
  const seriesValues = prepared.map((p) =>
    timestamps.map((ts) => {
      const eth = evaluatePoolPriceAt(p.sorted, p.form, ts);
      if (eth === null) return null;
      if (mode === 'percent') {
        if (p.seedEth <= 0) return null;
        return ((eth - p.seedEth) / p.seedEth) * 100;
      }
      return eth;
    }),
  );

  return { timestamps, seriesValues };
}