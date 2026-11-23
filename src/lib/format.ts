import type { ActiveBeastStatus } from '../types/dashboard';

export const STATUS_META: Record<
  ActiveBeastStatus,
  { label: string; shortLabel: string; colorVar: string; swatchClass: string }
> = {
  staked: {
    label: 'Staked (Huntable)',
    shortLabel: 'Staked',
    colorVar: 'var(--color-state-staked)',
    swatchClass: 'bg-state-staked',
  },
  held_power_form: {
    label: 'Held: Mega',
    shortLabel: 'Held Mega',
    colorVar: 'var(--color-state-held-pf)',
    swatchClass: 'bg-state-held-pf',
  },
  sold_power_form: {
    label: 'Sold: Mega',
    shortLabel: 'Sold Mega',
    colorVar: 'var(--color-state-sold-pf)',
    swatchClass: 'bg-state-sold-pf',
  },
  sold_regular: {
    label: 'Sold: Normal',
    shortLabel: 'Sold Norm',
    colorVar: 'var(--color-state-sold-reg)',
    swatchClass: 'bg-state-sold-reg',
  },
  held_regular: {
    label: 'Held: Normal',
    shortLabel: 'Held Norm',
    colorVar: 'var(--color-state-held-reg)',
    swatchClass: 'bg-state-held-reg',
  },
};

export const STATUS_ORDER: ActiveBeastStatus[] = [
  'staked',
  'held_power_form',
  'sold_power_form',
  'sold_regular',
  'held_regular',
];

export function weiToEthNumber(wei: string | null | undefined): number {
  if (!wei) return 0;
  const n = Number(wei);
  return Number.isFinite(n) ? n / 1e18 : 0;
}

export function formatEth(wei: string | null | undefined, decimals = 5): string {
  return `${weiToEthNumber(wei).toFixed(decimals)} ETH`;
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US');
}

export function formatPct(numerator: number, denominator: number, decimals = 1): string {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(decimals)}%`;
}

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '-';
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

export function formatRelativeTime(isoOrUnix: string | number | null | undefined): string {
  if (!isoOrUnix) return '-';
  const ms = typeof isoOrUnix === 'number' ? isoOrUnix * 1000 : Date.parse(isoOrUnix);
  if (!Number.isFinite(ms)) return '-';
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export function formatCountdown(
  targetUnixSec: number | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): { text: string; ready: boolean } {
  if (!targetUnixSec || !Number.isFinite(targetUnixSec)) {
    return { text: '-', ready: false };
  }
  const remaining = targetUnixSec - nowSec;
  if (remaining <= 0) {
    return { text: 'Ready', ready: true };
  }
  const totalMin = Math.floor(remaining / 60);
  if (totalMin < 1) return { text: '<1m', ready: false };
  if (totalMin < 60) return { text: `${totalMin}m`, ready: false };

  const totalHr = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHr < 24) {
    return { text: remMin > 0 ? `${totalHr}h ${remMin}m` : `${totalHr}h`, ready: false };
  }

  const days = Math.floor(totalHr / 24);
  const remHr = totalHr % 24;
  return { text: remHr > 0 ? `${days}d ${remHr}h` : `${days}d`, ready: false };
}