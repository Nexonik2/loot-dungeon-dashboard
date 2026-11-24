import { useState } from 'react';
import { SUPPLY_CAPS } from '../../lib/constants';
import { formatInt, formatPct } from '../../lib/format';

export interface TierProgressItem {
  tier: number;
  claimed: number;
  powerForm: number;
  staked: number;
}

interface SupplyProgressSectionProps {
  claimed: number;
  powerForm: number;
  staked: number;
  tierProgress: TierProgressItem[];
  activeTierFilter?: number | 'all';
  onSelectTier?: (tier: number | 'all') => void;
}

type CapSegment = 'minted' | 'staked' | 'open';

export function SupplyProgressSection({
  claimed,
  powerForm,
  staked,
  tierProgress,
  activeTierFilter = 'all',
  onSelectTier,
}: SupplyProgressSectionProps) {
  const [hoveredCapSeg, setHoveredCapSeg] = useState<CapSegment | null>(null);
  const [hoveredSupply, setHoveredSupply] = useState<'caught' | 'remaining' | null>(null);

  const totalCap = SUPPLY_CAPS.maxTotalBeasts;
  const caughtPct = Math.min(100, (claimed / totalCap) * 100);
  const remainingCount = Math.max(0, totalCap - claimed);
  const remainingPct = Math.max(0, 100 - caughtPct);

  const megaCap = SUPPLY_CAPS.maxTotalPowerForms;
  const mintedPct = Math.min(100, (powerForm / megaCap) * 100);
  const stakedPct = Math.min(Math.max(0, 100 - mintedPct), (staked / megaCap) * 100);
  const openCount = Math.max(0, megaCap - powerForm - staked);
  const openPct = Math.max(0, 100 - mintedPct - stakedPct);

  const capTooltip = (() => {
    if (!hoveredCapSeg) return null;
    if (hoveredCapSeg === 'minted') {
      return {
        label: 'Megas Minted',
        detail: `${formatInt(powerForm)} (${formatPct(powerForm, megaCap, 2)})`,
        dotClass: 'bg-state-held-pf',
        leftPct: Math.min(82, Math.max(18, mintedPct / 2)),
      };
    }
    if (hoveredCapSeg === 'staked') {
      return {
        label: 'Currently Staked',
        detail: `${formatInt(staked)} (${formatPct(staked, megaCap, 2)})`,
        dotClass: 'bg-state-staked',
        leftPct: Math.min(82, Math.max(18, mintedPct + stakedPct / 2)),
      };
    }
    return {
      label: 'Open Mega Cap',
      detail: `${formatInt(openCount)} (${formatPct(openCount, megaCap, 2)})`,
      dotClass: 'bg-ink-faint',
      leftPct: Math.min(82, Math.max(18, mintedPct + stakedPct + openPct / 2)),
    };
  })();

  const supplyTooltip = (() => {
    if (!hoveredSupply) return null;
    if (hoveredSupply === 'caught') {
      return {
        label: 'Beasts Caught',
        detail: `${formatInt(claimed)} (${formatPct(claimed, totalCap, 2)})`,
        dotClass: 'bg-accent',
        leftPct: Math.min(82, Math.max(18, caughtPct / 2)),
      };
    }
    return {
      label: 'Remaining in Dungeon',
      detail: `${formatInt(remainingCount)} (${formatPct(remainingCount, totalCap, 2)})`,
      dotClass: 'bg-ink-faint',
      leftPct: Math.min(82, Math.max(18, caughtPct + remainingPct / 2)),
    };
  })();

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Supply Progress Across All 30 Species
          </h2>
          <p className="text-xs text-ink-muted">
            1,242 max per species (1,035 final Normal + 207 Mega) · 7,452 per tier
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Global Total Supply Caught */}
        <div
          className="rounded-lg border border-border/70 bg-bg p-3 space-y-2"
          onMouseLeave={() => setHoveredSupply(null)}
        >
          <div className="num flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-ink">Total Supply Caught</span>
            <span className="text-ink-muted">
              {formatInt(claimed)} / {formatInt(totalCap)} ({formatPct(claimed, totalCap, 2)})
            </span>
          </div>

          <div className="relative pt-1">
            {supplyTooltip && (
              <div
                style={{ left: `${supplyTooltip.leftPct}%` }}
                className="pointer-events-none absolute -top-8 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-[11px] text-ink shadow-lg"
              >
                <span className="inline-flex items-center gap-1.5 num">
                  <span className={`h-2 w-2 rounded-full ${supplyTooltip.dotClass}`} />
                  <span className="text-ink-muted">{supplyTooltip.label}:</span>
                  <strong className="font-semibold text-ink">{supplyTooltip.detail}</strong>
                </span>
              </div>
            )}

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface ring-1 ring-border/50">
              {caughtPct > 0 && (
                <button
                  type="button"
                  aria-label={`Beasts caught: ${formatInt(claimed)} of ${formatInt(totalCap)}`}
                  style={{ width: `${caughtPct}%` }}
                  onMouseEnter={() => setHoveredSupply('caught')}
                  onFocus={() => setHoveredSupply('caught')}
                  onBlur={() => setHoveredSupply(null)}
                  onClick={() =>
                    setHoveredSupply((prev) => (prev === 'caught' ? null : 'caught'))
                  }
                  className="h-full bg-accent transition-opacity hover:opacity-90 focus:outline-none"
                />
              )}
              {remainingPct > 0 && (
                <button
                  type="button"
                  aria-label={`Remaining in dungeon: ${formatInt(remainingCount)}`}
                  style={{ width: `${remainingPct}%` }}
                  onMouseEnter={() => setHoveredSupply('remaining')}
                  onFocus={() => setHoveredSupply('remaining')}
                  onBlur={() => setHoveredSupply(null)}
                  onClick={() =>
                    setHoveredSupply((prev) => (prev === 'remaining' ? null : 'remaining'))
                  }
                  className="h-full bg-transparent hover:bg-surface-elevated/70 focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Global Mega Cap */}
        <div
          className="rounded-lg border border-border/70 bg-bg p-3 space-y-2"
          onMouseLeave={() => setHoveredCapSeg(null)}
        >
          <div className="num flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-ink">Global Mega Cap</span>
            <span className="text-ink-muted">
              <span className="text-state-held-pf">{formatInt(powerForm)}</span> minted ·{' '}
              <span className="text-state-staked">{formatInt(staked)}</span> staked /{' '}
              {formatInt(megaCap)}
            </span>
          </div>

          <div className="relative pt-1">
            {capTooltip && (
              <div
                style={{ left: `${capTooltip.leftPct}%` }}
                className="pointer-events-none absolute -top-8 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-[11px] text-ink shadow-lg"
              >
                <span className="inline-flex items-center gap-1.5 num">
                  <span className={`h-2 w-2 rounded-full ${capTooltip.dotClass}`} />
                  <span className="text-ink-muted">{capTooltip.label}:</span>
                  <strong className="font-semibold text-ink">{capTooltip.detail}</strong>
                </span>
              </div>
            )}

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface ring-1 ring-border/50">
              {mintedPct > 0 && (
                <button
                  type="button"
                  aria-label={`Megas minted: ${formatInt(powerForm)} (${formatPct(powerForm, megaCap, 2)})`}
                  style={{ width: `${mintedPct}%` }}
                  onMouseEnter={() => setHoveredCapSeg('minted')}
                  onFocus={() => setHoveredCapSeg('minted')}
                  onBlur={() => setHoveredCapSeg(null)}
                  onClick={() =>
                    setHoveredCapSeg((prev) => (prev === 'minted' ? null : 'minted'))
                  }
                  className="h-full bg-state-held-pf transition-opacity hover:opacity-90 focus:outline-none"
                />
              )}
              {stakedPct > 0 && (
                <button
                  type="button"
                  aria-label={`Currently staked: ${formatInt(staked)} (${formatPct(staked, megaCap, 2)})`}
                  style={{ width: `${stakedPct}%` }}
                  onMouseEnter={() => setHoveredCapSeg('staked')}
                  onFocus={() => setHoveredCapSeg('staked')}
                  onBlur={() => setHoveredCapSeg(null)}
                  onClick={() =>
                    setHoveredCapSeg((prev) => (prev === 'staked' ? null : 'staked'))
                  }
                  className="h-full bg-state-staked transition-opacity hover:opacity-90 focus:outline-none"
                />
              )}
              {openPct > 0 && (
                <button
                  type="button"
                  aria-label={`Open Mega cap: ${formatInt(openCount)} (${formatPct(openCount, megaCap, 2)})`}
                  style={{ width: `${openPct}%` }}
                  onMouseEnter={() => setHoveredCapSeg('open')}
                  onFocus={() => setHoveredCapSeg('open')}
                  onBlur={() => setHoveredCapSeg(null)}
                  onClick={() =>
                    setHoveredCapSeg((prev) => (prev === 'open' ? null : 'open'))
                  }
                  className="h-full bg-transparent hover:bg-surface-elevated/70 focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compact 4-line Per-Tier Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {tierProgress.map((t) => {
          const totalTierPct = Math.min(100, (t.claimed / SUPPLY_CAPS.maxPerTier) * 100);
          const megaTierPct = Math.min(
            100,
            (t.powerForm / SUPPLY_CAPS.maxPowerFormPerTier) * 100,
          );
          const isInteractive = Boolean(onSelectTier);
          const isSelected = isInteractive && activeTierFilter === t.tier;

          const content = (
            <>
              {/* Line 1: Tier label + caught/7,452 + % */}
              <div className="num flex items-baseline justify-between gap-1.5 text-[11px]">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-semibold text-ink">T{t.tier}</span>
                  <span className="truncate text-ink-muted">
                    {formatInt(t.claimed)}/{formatInt(SUPPLY_CAPS.maxPerTier)}
                  </span>
                </div>
                <span className="shrink-0 font-medium text-accent">
                  {formatPct(t.claimed, SUPPLY_CAPS.maxPerTier, 1)}
                </span>
              </div>

              {/* Line 2: Caught progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  style={{ width: `${totalTierPct}%` }}
                  className="h-full bg-accent/85"
                />
              </div>

              {/* Line 3: Mega Tier label + evolved/1,242 + % */}
              <div className="num flex items-baseline justify-between gap-1.5 pt-0.5 text-[11px]">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-medium text-ink-muted">Mega T{t.tier}</span>
                  <span className="truncate text-ink-faint">
                    {formatInt(t.powerForm)}/{formatInt(SUPPLY_CAPS.maxPowerFormPerTier)}
                  </span>
                </div>
                <span className="shrink-0 font-medium text-state-held-pf">
                  {formatPct(t.powerForm, SUPPLY_CAPS.maxPowerFormPerTier, 1)}
                </span>
              </div>

              {/* Line 4: Mega minted progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  style={{ width: `${megaTierPct}%` }}
                  className="h-full bg-state-held-pf"
                />
              </div>
            </>
          );

          const cardClass = `rounded-lg border p-2.5 text-left transition-colors space-y-1.5 ${
            isSelected
              ? 'border-accent bg-surface-elevated'
              : 'border-border/70 bg-bg'
          } ${isInteractive ? 'hover:border-ink-faint cursor-pointer' : ''}`;

          return isInteractive ? (
            <button
              key={t.tier}
              type="button"
              onClick={() => onSelectTier?.(activeTierFilter === t.tier ? 'all' : t.tier)}
              className={cardClass}
            >
              {content}
            </button>
          ) : (
            <div key={t.tier} className={cardClass}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}