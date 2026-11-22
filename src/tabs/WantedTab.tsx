import { useEffect, useMemo, useState } from 'react';
import { KpiCard } from '../components/KpiCard';
import { formatInt } from '../lib/format';
import { useApi } from '../lib/useApi';
import type {
  WantedDetailResponse,
  WantedSpeciesRow,
  WantedSummaryResponse,
} from '../types/dashboard';

type SortOption = 'grade_desc' | 'level_asc' | 'health_asc' | 'power_asc';

function SpeciesBeastList({
  species,
  minGrade,
  sort,
}: {
  species: WantedSpeciesRow;
  minGrade: number | null;
  sort: SortOption;
}) {
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<WantedDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [species.beastId, minGrade, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      beastId: String(species.beastId),
      sort,
      page: String(page),
      limit: '15',
    });
    if (minGrade !== null) {
      params.set('minGrade', String(minGrade));
    }

    fetch(`/api/wanted?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as WantedDetailResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setDetail(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load targets');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [species.beastId, minGrade, sort, page]);

  if (loading && !detail) {
    return (
      <div className="px-3 py-3 text-xs text-ink-faint">
        Loading huntable {species.name} targets…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="px-3 py-3 text-xs text-state-sold-reg">
        Error loading targets: {error}
      </div>
    );
  }

  if (detail.items.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-ink-faint">
        No staked {species.name} matches the current grade filter.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(detail.total / detail.limit));

  return (
    <div className="border-t border-border/70 bg-bg/70 px-3 py-3 space-y-2.5">
      <div className="flex items-center justify-between text-[11px] text-ink-faint">
        <span className="num">
          Showing {detail.items.length} of {formatInt(detail.total)} huntable targets
        </span>
        {totalPages > 1 && (
          <div className="num flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-border bg-surface px-2 py-0.5 text-ink disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-border bg-surface px-2 py-0.5 text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/70 text-[10px] uppercase tracking-wide text-ink-faint">
              <th className="py-1.5 pr-3 font-medium">Beast Name</th>
              <th className="py-1.5 px-2 text-right font-medium">Grade</th>
              <th className="py-1.5 px-2 text-right font-medium">Lvl</th>
              <th className="py-1.5 px-2 text-right font-medium">HP</th>
              <th className="py-1.5 px-2 text-right font-medium">Power</th>
              <th className="py-1.5 pl-2 text-right font-medium">Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 num">
            {detail.items.map((b) => {
              const title = [b.prefixName, b.suffixName].filter(Boolean).join(' ');
              return (
                <tr key={b.tokenId}>
                  <td className="py-2 pr-3 font-medium text-ink">
                    {title ? `"${title}" ` : ''}
                    <span className="text-ink-muted">{b.name}</span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        (b.cardGrade ?? 0) >= 9
                          ? 'bg-state-staked/20 text-state-staked'
                          : 'bg-surface-elevated text-ink-muted'
                      }`}
                    >
                      {b.cardGrade !== null ? `G${b.cardGrade}` : '—'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-ink">{b.level}</td>
                  <td className="py-2 px-2 text-right text-ink-muted">{b.health}</td>
                  <td className="py-2 px-2 text-right text-ink-muted">{b.power}</td>
                  <td className="py-2 pl-2 text-right text-ink-faint">
                    {b.projectedRank !== null ? `#${b.projectedRank}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WantedTab() {
  const { data, loading, error, refresh } = useApi<WantedSummaryResponse>('/api/wanted');
  const [expandedTiers, setExpandedTiers] = useState<number[]>([1]);
  const [expandedSpecies, setExpandedSpecies] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'Magic' | 'Hunter' | 'Brute'>('all');
  const [minGrade, setMinGrade] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>('grade_desc');

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
        <p className="text-ink">Failed to load Wanted list: {error}</p>
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
      {/* Compact Top Summary */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Huntable Staked"
          value={formatInt(totals.staked)}
          sublabel="Currently exposed in dungeon"
          accentClass="text-state-staked"
        />
        <KpiCard
          label="Tier 1 & 2 Targets"
          value={formatInt(totals.t1t2)}
          sublabel="Highest-rarity staked Beasts"
        />
        <KpiCard
          label="Grade 9–10 Targets"
          value={formatInt(totals.highGrade)}
          sublabel="Top-grade cards at risk"
          accentClass="text-state-held-pf"
        />
        <KpiCard
          label="Perfect Grade 10"
          value={formatInt(totals.grade10)}
          sublabel="Mint-condition bounties"
          accentClass="text-state-sold-pf"
        />
      </section>

      {/* Filter & Sort Controls */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Wanted Board — Staked Beasts by Tier &amp; Species
          </h2>
          <p className="text-xs text-ink-muted">
            Expand a Tier to inspect species totals, then expand any Species to load individual huntable targets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by Beast type"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as 'all' | 'Magic' | 'Hunter' | 'Brute')
            }
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink"
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
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink"
          >
            <option value="all">Any Grade</option>
            <option value="8">Grade 8+</option>
            <option value="9">Grade 9+</option>
            <option value="10">Grade 10 Only</option>
          </select>

          <select
            aria-label="Sort expanded targets"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink"
          >
            <option value="grade_desc">Sort: Highest Grade</option>
            <option value="level_asc">Sort: Lowest Level</option>
            <option value="health_asc">Sort: Lowest HP</option>
            <option value="power_asc">Sort: Lowest Power</option>
          </select>
        </div>
      </section>

      {/* Collapsible Tier Accordions */}
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
              <button
                type="button"
                onClick={() => toggleTier(tierRow.tier)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
              >
                <div className="flex items-center gap-3">
                  <span className="num rounded-md bg-bg px-2 py-1 text-xs font-semibold text-state-staked ring-1 ring-border">
                    T{tierRow.tier}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      Tier {tierRow.tier}{' '}
                      <span className="num font-normal text-ink-muted">
                        · {formatInt(tierRow.stakedCount)} huntable
                      </span>
                    </div>
                    <div className="num text-[11px] text-ink-faint">
                      Magic {tierRow.byType.Magic} · Hunter {tierRow.byType.Hunter} · Brute{' '}
                      {tierRow.byType.Brute}
                    </div>
                  </div>
                </div>

                <div className="num flex items-center gap-4 text-xs">
                  <div className="hidden sm:block text-right">
                    <div className="text-[11px] text-ink-faint">G9–10</div>
                    <div className="font-medium text-state-held-pf">
                      {formatInt(tierRow.highGradeCount)}
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <div className="text-[11px] text-ink-faint">Avg Grd</div>
                    <div className="font-medium text-ink">
                      {tierRow.avgGrade !== null ? tierRow.avgGrade.toFixed(2) : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-ink-faint">Min Lvl</div>
                    <div className="font-medium text-ink">{tierRow.minLevel}</div>
                  </div>
                  <span className="text-ink-muted">{isTierOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isTierOpen && (
                <div className="divide-y divide-border/70 border-t border-border">
                  {tierSpecies.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-ink-faint">
                      No {typeFilter} species currently staked in Tier {tierRow.tier}.
                    </div>
                  ) : (
                    tierSpecies.map((sp) => {
                      const isSpOpen = expandedSpecies.includes(sp.beastId);
                      return (
                        <div key={sp.beastId}>
                          <button
                            type="button"
                            onClick={() => toggleSpecies(sp.beastId)}
                            className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-bg/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-ink">
                                {sp.name}
                              </span>
                              <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-ink-muted">
                                {sp.type}
                              </span>
                            </div>

                            <div className="num flex items-center gap-3 text-xs text-ink-muted">
                              <span>
                                <strong className="text-ink">{formatInt(sp.stakedCount)}</strong>{' '}
                                staked
                              </span>
                              <span className="hidden sm:inline text-ink-faint">
                                G9+: {formatInt(sp.highGradeCount)}
                              </span>
                              <span className="hidden sm:inline text-ink-faint">
                                Avg G{sp.avgGrade !== null ? sp.avgGrade.toFixed(1) : '—'}
                              </span>
                              <span className="text-ink-faint">
                                Min Lvl {sp.minLevel}
                              </span>
                              <span className="text-accent text-[11px]">
                                {isSpOpen ? 'Hide ▲' : 'Targets ▼'}
                              </span>
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