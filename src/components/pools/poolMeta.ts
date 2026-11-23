import type { PoolSummary } from '../../types/dashboard';

export const POOL_COLORS: Record<string, string> = {
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

export function poolKey(p: Pick<PoolSummary, 'tier' | 'form'>): string {
  return `${p.tier}-${p.form}`;
}

export function poolLabel(p: Pick<PoolSummary, 'tier' | 'form'>): string {
  return `T${p.tier} ${p.form === 'power_form' ? 'Power Form' : 'Regular'}`;
}

export function formatEthFloat(eth: number | null, decimals = 5): string {
  if (eth === null || !Number.isFinite(eth)) return '-';
  return `${eth.toFixed(decimals)} ETH`;
}