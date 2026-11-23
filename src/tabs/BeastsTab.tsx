import { useMemo, useState } from 'react';
import {
  SpeciesCatalogSection,
  type UnifiedSpeciesRow,
} from '../components/beasts/SpeciesCatalogSection';
import { SUPPLY_CAPS } from '../lib/constants';
import { useApi } from '../lib/useApi';
import type { OverviewResponse } from '../types/dashboard';

export default function BeastsTab() {
  const { data, loading, error, refresh } = useApi<OverviewResponse>('/api/overview');
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');

  const pfCap = data?.kpis?.cap ?? SUPPLY_CAPS.maxPowerFormPerSpecies;

  const allSpeciesRows = useMemo<UnifiedSpeciesRow[]>(() => {
    if (!data) return [];
    const byId = new Map(data.speciesCatalog.map((c) => [c.beastId, c]));

    return data.speciesSnapshot.map((s) => {
      const meta = byId.get(s.beastId) ?? byId.get(s.beastId + 77);
      const canonicalId =
        meta?.beastId ?? (s.beastId < 78 ? s.beastId + 77 : s.beastId);
      const powerForm = s.evolved ?? s.mega ?? 0;
      const safeStaked = Math.max(0, s.staked - s.unsafeStaked);
      const reserved = s.reserved ?? s.staked + powerForm;

      return {
        id: canonicalId,
        name: meta?.name ?? `Species #${canonicalId}`,
        type: meta?.type ?? '-',
        tier: meta?.tier ?? 0,
        claimed: s.claimed,
        held: s.held,
        staked: s.staked,
        safeStaked,
        unsafeStaked: s.unsafeStaked,
        taken: s.taken,
        powerForm,
        reserved,
        saturationRatio: pfCap > 0 ? reserved / pfCap : 0,
      };
    });
  }, [data, pfCap]);

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
        <p className="text-ink">Failed to load species data: {error ?? 'No data returned'}</p>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Beasts &amp; Mega Evolutions</h2>
          <p className="text-xs text-ink-muted">
            Supply progress, Mega queue saturation, and evolved token breakdowns across all 30 species
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter Beasts by Tier"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-bg p-0.5 text-xs"
        >
          {(['all', 1, 2, 3, 4, 5] as const).map((tier) => (
            <button
              key={String(tier)}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                tierFilter === tier
                  ? 'bg-surface-elevated text-accent'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tier === 'all' ? 'All Tiers' : `T${tier}`}
            </button>
          ))}
        </div>
      </div>

      <SpeciesCatalogSection
        species={allSpeciesRows}
        pfCap={pfCap}
        tierFilter={tierFilter}
      />
    </div>
  );
}