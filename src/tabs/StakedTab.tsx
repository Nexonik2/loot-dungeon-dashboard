import { useMemo, useState } from 'react';
import { BeastSprite, BeastTypeBadge } from '../components/BeastBadges';
import { DisclosureChevron } from '../components/DisclosureChevron';
import { KpiCard } from '../components/KpiCard';
import {
  SpeciesBeastList,
  type WantedSortOption,
} from '../components/staked/SpeciesBeastList';
import { formatInt } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { WantedSummaryResponse } from '../types/dashboard';

// Shared metric column grid so Tier totals and Species rows align vertically
const SUMMARY_GRID_CLASS =
  'num grid shrink-0 items-center gap-x-3 text-right grid-cols-[3.75rem_3.75rem_1rem] sm:grid-cols-[4.5rem_5rem_5.25rem_4.75rem_1rem]';

export default function StakedTab() {
  const { data, loading, error, refresh } = useApi<WantedSummaryResponse>('/api/staked');
  const [expandedTiers, setExpandedTiers] = useState<number[]>([1]);
  const [expandedSpecies, setExpandedSpecies] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'Magic' | 'Hunter' | 'Brute'>('all');
  const [minGrade, setMinGrade] = useState<number | null>(null);
  const [sort, setSort] = useState<WantedSortOption>('grade_desc');

  const totals = useMemo(() => {
    const tiers = data?.tiers ?? [];
    return {
      staked: data?.totalStaked ?? 0,
      highGrade: tiers.reduce((s, t) => s + t.highGradeCount, 0),
      grade10: tiers.reduce((s, t) => s + t.grade10Count, 0),
      t1t2: tiers
        .filter((t) => t.tier <= 2)
        .reduce((s, t) => s + t.stakedCount, 0),
    };
  }, [data]);

  const toggleTier = (tier: number) => {
    setExpandedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier],
    );
  };

  const toggleSpecies = (beastId: number) => {
    setExpandedSpecies((prev) =>
      prev.includes(beastId) ? prev.filter((id) => id !== beastId) : [...prev, beastId],
    );
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-state-sold-reg/40 bg-surface p-5 text-sm">
        <p className="text-ink">Failed to load staked Beasts: {error}</p>
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
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Currently Staked"
          value={formatInt(totals.staked)}
          sublabel="Exposed in dungeon pool"
          accentClass="text-state-staked"
        />
        <KpiCard
          label="Tier 1 & 2 Staked"
          value={formatInt(totals.t1t2)}
          sublabel="Highest-rarity staked Beasts"
        />
        <KpiCard
          label="Grade 9-10 Staked"
          value={formatInt(totals.highGrade)}
          sublabel="Top-grade cards at risk"
          accentClass="text-state-held-pf"
        />
        <KpiCard
          label="Perfect Grade 10"
          value={formatInt(totals.grade10)}
          sublabel="Mint-condition staked cards"
          accentClass="text-state-sold-pf"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Staked Beasts by Tier &amp; Species
          </h2>
          <p className="text-xs text-ink-muted">
            Expand a Tier to compare species, then expand any Species to inspect and sort individual staked Beasts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by Beast type"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as 'all' | 'Magic' | 'Hunter' | 'Brute')
            }
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="Magic">Magic</option>
            <option value="Hunter">Hunter</option>
            <option value="Brute">Brute</option>
          </select>

          <select
            aria-label="Minimum Card Grade"
            value={minGrade ?? 'all'}
            onChange={(e) =>
              setMinGrade(e.target.value === 'all' ? null : Number(e.target.value))
            }
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="all">Any Grade</option>
            <option value="8">Grade 8+</option>
            <option value="9">Grade 9+</option>
            <option value="10">Grade 10 Only</option>
          </select>

          <select
            aria-label="Default sort for expanded Beasts"
            value={sort}
            onChange={(e) => setSort(e.target.value as WantedSortOption)}
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="grade_desc">Sort: Highest Grade</option>
            <option value="level_asc">Sort: Lowest Level</option>
            <option value="health_asc">Sort: Lowest HP</option>
            <option value="power_asc">Sort: Lowest Power</option>
            <option value="caught_desc">Sort: Most Recent</option>
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {data.tiers.map((tierRow) => {
          const isTierOpen = expandedTiers.includes(tierRow.tier);
          const tierSpecies = data.species.filter(
            (s) =>
              s.tier === tierRow.tier &&
              (typeFilter === 'all' ? true : s.type === typeFilter),
          );

          return (
            <div
              key={tierRow.tier}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              {/* Tier Header Row (defines the 1x column labels for all species below) */}
              <button
                type="button"
                onClick={() => toggleTier(tierRow.tier)}
                aria-expanded={isTierOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="num flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-owner-player/40 bg-owner-player/12 text-base font-bold tracking-tight text-accent">
                    T{tierRow.tier}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="num text-sm font-semibold text-ink">
                      {formatInt(tierRow.stakedCount)}{' '}
                      <span className="font-normal text-ink-muted">staked</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BeastTypeBadge type="Magic" count={tierRow.byType.Magic} />
                      <BeastTypeBadge type="Hunter" count={tierRow.byType.Hunter} />
                      <BeastTypeBadge type="Brute" count={tierRow.byType.Brute} />
                    </div>
                  </div>
                </div>

                <div className={`${SUMMARY_GRID_CLASS} text-xs`}>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                      Staked
                    </div>
                    <div className="font-semibold text-ink">
                      {formatInt(tierRow.stakedCount)}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                      Grade 9+
                    </div>
                    <div className="font-medium text-state-held-pf">
                      {formatInt(tierRow.highGradeCount)}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                      Avg. Grade
                    </div>
                    <div className="font-medium text-ink">
                      {tierRow.avgGrade !== null ? tierRow.avgGrade.toFixed(1) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                      Min. Level
                    </div>
                    <div className="font-medium text-ink">{tierRow.minLevel}</div>
                  </div>
                  <div className="flex justify-end">
                    <DisclosureChevron open={isTierOpen} />
                  </div>
                </div>
              </button>

              {isTierOpen && (
                <div className="divide-y divide-border/70 border-t border-border">
                  {tierSpecies.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-ink-faint">
                      No {typeFilter} species currently staked in T{tierRow.tier}.
                    </div>
                  ) : (
                    tierSpecies.map((sp) => {
                      const isSpOpen = expandedSpecies.includes(sp.beastId);
                      return (
                        <div key={sp.beastId}>
                          <button
                            type="button"
                            onClick={() => toggleSpecies(sp.beastId)}
                            aria-expanded={isSpOpen}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg/50"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <BeastSprite name={sp.name} size="sm" />
                              <span className="truncate text-sm font-medium text-ink">
                                {sp.name}
                              </span>
                              <BeastTypeBadge type={sp.type} />
                            </div>

                            <div className={`${SUMMARY_GRID_CLASS} text-xs`}>
                              <span className="font-semibold text-ink">
                                {formatInt(sp.stakedCount)}
                              </span>
                              <span className="hidden text-state-held-pf sm:block">
                                {formatInt(sp.highGradeCount)}
                              </span>
                              <span className="hidden text-ink-muted sm:block">
                                {sp.avgGrade !== null ? sp.avgGrade.toFixed(1) : '-'}
                              </span>
                              <span className="text-ink-muted">{sp.minLevel}</span>
                              <div className="flex justify-end">
                                <DisclosureChevron open={isSpOpen} />
                              </div>
                            </div>
                          </button>

                          {isSpOpen && (
                            <SpeciesBeastList
                              species={sp}
                              minGrade={minGrade}
                              sort={sort}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}