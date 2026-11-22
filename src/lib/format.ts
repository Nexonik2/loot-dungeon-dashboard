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
    label: 'Held — Power Form',
    shortLabel: 'Held PF',
    colorVar: 'var(--color-state-held-pf)',
    swatchClass: 'bg-state-held-pf',
  },
  sold_power_form: {
    label: 'Sold — Power Form',
    shortLabel: 'Sold PF',
    colorVar: 'var(--color-state-sold-pf)',
    swatchClass: 'bg-state-sold-pf',
  },
  sold_regular: {
    label: 'Sold — Regular',
    shortLabel: 'Sold Reg',
    colorVar: 'var(--color-state-sold-reg)',
    swatchClass: 'bg-state-sold-reg',
  },
  held_regular: {
    label: 'Held — Regular',
    shortLabel: 'Held Reg',
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
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

export function formatPct(numerator: number, denominator: number, decimals = 1): string {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(decimals)}%`;
}

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return '—';
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function formatRelativeTime(isoOrUnix: string | number | null | undefined): string {
  if (!isoOrUnix) return '—';
  const ms = typeof isoOrUnix === 'number' ? isoOrUnix * 1000 : Date.parse(isoOrUnix);
  if (!Number.isFinite(ms)) return '—';
  const diffMin = Math.round((Date.now() - ms) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}