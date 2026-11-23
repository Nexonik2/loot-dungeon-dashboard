import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import {
  BeastSprite,
  BeastTypeBadge,
  GradeBadge,
  MidiBadge,
  OwnerBadge,
  TierBadge,
  formatBeastDisplayName,
} from '../BeastBadges';
import { DisclosureChevron } from '../DisclosureChevron';
import { SUPPLY_CAPS } from '../../lib/constants';
import { formatInt, formatPct, formatRelativeTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import type {
  MegasDetailResponse,
  MegasSummaryResponse,
} from '../../types/dashboard';

export interface UnifiedSpeciesRow {
  id: number; // Canonical Beasts V3 beastId (78-107)
  name: string;
  type: string;
  tier: number;
  claimed: number;
  held: number;
  staked: number;
  safeStaked: number;
  unsafeStaked: number;
  taken: number;
  powerForm: number;
  reserved: number;
  saturationRatio: number;
}

interface SpeciesCatalogSectionProps {
  species: UnifiedSpeciesRow[];
  pfCap: number;
  tierFilter: number | 'all';
}

type CatalogFilter = 'all' | 'megas' | 'held' | 'sold';
type CatalogSort = 'saturation' | 'caught' | 'megas' | 'staked' | 'sold' | 'grade' | 'tier';
type DetailSortColumn = 'beast' | 'owner' | 'level' | 'health' | 'power' | 'grade' | 'evolved';
type SortDirection = 'asc' | 'desc';
type DetailSortOption = `${DetailSortColumn}_${SortDirection}`;

const DEFAULT_DETAIL_DIR: Record<DetailSortColumn, SortDirection> = {
  beast: 'asc',
  owner: 'asc',
  level: 'desc',
  health: 'desc',
  power: 'desc',
  grade: 'desc',
  evolved: 'desc',
};

function parseDetailSort(sort: DetailSortOption): {
  col: DetailSortColumn;
  dir: SortDirection;
} {
  const [col, dir] = sort.split('_') as [DetailSortColumn, SortDirection];
  return { col, dir };
}

export function SpeciesCatalogSection({
  species,
  pfCap,
  tierFilter,
}: SpeciesCatalogSectionProps) {
  const { data: megaSummary } = useApi<MegasSummaryResponse>('/api/megas');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [midiOnly, setMidiOnly] = useState(false);
  const [sortBy, setSortBy] = useState<CatalogSort>('saturation');
  const [expandedBeastId, setExpandedBeastId] = useState<number | null>(null);
  const [detailSort, setDetailSort] = useState<DetailSortOption>('evolved_desc');
  const [detailPage, setDetailPage] = useState(1);
  const [detailData, setDetailData] = useState<MegasDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const detailCacheRef = useRef(new Map<string, MegasDetailResponse>());

  const mergedRows = useMemo(() => {
    const megasById = new Map(
      (megaSummary?.species ?? []).map((m) => [m.beastId, m]),
    );

    return species.map((sp) => {
      const mega = megasById.get(sp.id);
      const megaTotal = mega?.totalCount ?? sp.powerForm;
      const heldMegas = mega?.heldCount ?? 0;
      const soldMegas = mega?.soldCount ?? 0;
      const midiMegas = mega?.specialVfxCount ?? 0;
      const avgMegaGrade = mega?.avgGrade ?? null;

      return {
        ...sp,
        megaTotal,
        heldMegas,
        soldMegas,
        midiMegas,
        avgMegaGrade,
      };
    });
  }, [species, megaSummary]);

  const visibleRows = useMemo(() => {
    return mergedRows
      .filter((r) => (tierFilter === 'all' ? true : r.tier === tierFilter))
      .filter((r) => (midiOnly ? r.midiMegas > 0 : true))
      .filter((r) => {
        if (filter === 'megas') return r.megaTotal > 0;
        if (filter === 'held') return r.heldMegas > 0;
        if (filter === 'sold') return r.soldMegas > 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'caught') return b.claimed - a.claimed;
        if (sortBy === 'megas') return b.megaTotal - a.megaTotal || b.reserved - a.reserved;
        if (sortBy === 'staked') return b.staked - a.staked;
        if (sortBy === 'sold') return b.soldMegas - a.soldMegas || b.megaTotal - a.megaTotal;
        if (sortBy === 'grade') return (b.avgMegaGrade ?? 0) - (a.avgMegaGrade ?? 0);
        if (sortBy === 'tier') return a.tier - b.tier || b.claimed - a.claimed;
        return b.saturationRatio - a.saturationRatio || b.claimed - a.claimed;
      });
  }, [mergedRows, tierFilter, filter, midiOnly, sortBy]);

  const detailStatusParam =
    filter === 'held' ? 'held' : filter === 'sold' ? 'sold' : 'all';

  useEffect(() => {
    setDetailPage(1);
  }, [expandedBeastId, detailStatusParam, midiOnly, detailSort]);

  useEffect(() => {
    if (expandedBeastId === null) {
      setDetailData(null);
      setDetailError(null);
      return;
    }

    const params = new URLSearchParams({
      beastId: String(expandedBeastId),
      status: detailStatusParam,
      sort: detailSort,
      page: String(detailPage),
      limit: '20',
    });
    if (midiOnly) params.set('midi', '1');

    const url = `/api/megas?${params.toString()}`;
    const cached = detailCacheRef.current.get(url);
    if (cached) {
      setDetailData(cached);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as MegasDetailResponse;
      })
      .then((json) => {
        if (cancelled) return;
        detailCacheRef.current.set(url, json);
        setDetailData(json);
        setDetailLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : 'Failed to load Megas');
        setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expandedBeastId, detailStatusParam, midiOnly, detailSort, detailPage]);

  const caughtScale = scaleLinear()
    .domain([0, SUPPLY_CAPS.maxPerSpecies])
    .range([0, 100])
    .clamp(true);
  const pfScale = scaleLinear().domain([0, pfCap]).range([0, 100]).clamp(true);

  const { col: activeCol, dir: activeDir } = parseDetailSort(detailSort);

  const handleSortClick = (column: DetailSortColumn) => {
    if (activeCol === column) {
      setDetailSort(`${column}_${activeDir === 'asc' ? 'desc' : 'asc'}`);
    } else {
      setDetailSort(`${column}_${DEFAULT_DETAIL_DIR[column]}`);
    }
  };

  const renderSortButton = (
    column: DetailSortColumn,
    label: string,
    align: 'left' | 'right' = 'right',
  ) => {
    const isActive = activeCol === column;
    return (
      <button
        type="button"
        onClick={() => handleSortClick(column)}
        className={`inline-flex w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink ${
          align === 'left' ? 'justify-start' : 'justify-end'
        } ${isActive ? 'text-accent' : 'text-ink-faint'}`}
      >
        <span>{label}</span>
        {isActive && (
          <span aria-hidden="true" className="text-[10px] leading-none">
            {activeDir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    );
  };

  const toggleExpand = (beastId: number, hasMegas: boolean) => {
    if (!hasMegas) return;
    setExpandedBeastId((prev) => (prev === beastId ? null : beastId));
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">
              All 30 Species &amp; Mega Evolutions
            </h2>
            {megaSummary && (
              <div className="num flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-ink">
                  {formatInt(megaSummary.totalMegas)} Megas
                </span>
                <span className="rounded-md border border-owner-player/35 bg-owner-player/10 px-2 py-0.5 text-owner-player">
                  {formatInt(megaSummary.heldTotal)} held (
                  {formatPct(megaSummary.heldTotal, Math.max(megaSummary.totalMegas, 1), 0)})
                </span>
                <span className="rounded-md border border-owner-buyback/35 bg-owner-buyback/10 px-2 py-0.5 text-owner-buyback">
                  {formatInt(megaSummary.soldTotal)} sold (
                  {formatPct(megaSummary.soldTotal, Math.max(megaSummary.totalMegas, 1), 0)})
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Click any species with evolved Megas to inspect individual tokens and ownership.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-bg p-0.5 text-xs">
            {(
              [
                ['all', 'All'],
                ['megas', 'Megas'],
                ['held', 'Held'],
                ['sold', 'Sold'],
              ] as Array<[CatalogFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filter === key
                    ? 'bg-surface-elevated font-medium text-accent'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMidiOnly((v) => !v)}
            aria-pressed={midiOnly}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              midiOnly
                ? 'border-midi/60 bg-midi/15 text-midi'
                : 'border-border bg-bg text-ink-muted hover:text-ink'
            }`}
          >
            MIDI
          </button>

          <select
            aria-label="Sort species"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CatalogSort)}
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="saturation">Sort: Mega Queue</option>
            <option value="megas">Sort: Most Megas</option>
            <option value="caught">Sort: Total Caught</option>
            <option value="staked">Sort: Currently Staked</option>
            <option value="sold">Sort: Most Megas Sold</option>
            <option value="grade">Sort: Avg Mega Grade</option>
            <option value="tier">Sort: Tier</option>
          </select>
        </div>
      </div>

      {/* Compact bar legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-accent" /> Caught (/ 1,242)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-state-held-pf" /> Megas Minted (/ {pfCap})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-state-staked" /> Safe Staked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-warn" /> Overflow Staked
        </span>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-5 text-center text-xs text-ink-muted">
          No species match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visibleRows.map((sp) => {
            const hasMegas = sp.megaTotal > 0;
            const isExpanded = expandedBeastId === sp.id;
            const caughtW = caughtScale(sp.claimed);
            const pfW = pfScale(sp.megaTotal);
            const safeW = pfScale(sp.safeStaked);
            const unsafeW = pfScale(sp.unsafeStaked);
            const totalPages = detailData
              ? Math.max(1, Math.ceil(detailData.total / detailData.limit))
              : 1;

            return (
              <div
                key={sp.id}
                className={`rounded-lg border bg-bg transition-colors ${
                  isExpanded
                    ? 'border-accent/70 md:col-span-2'
                    : hasMegas
                      ? 'border-border/70 hover:border-ink-faint'
                      : 'border-border/60'
                }`}
              >
                <button
                  type="button"
                  disabled={!hasMegas}
                  onClick={() => toggleExpand(sp.id, hasMegas)}
                  aria-expanded={hasMegas ? isExpanded : undefined}
                  className={`flex w-full items-stretch gap-3 p-3 text-left ${
                    hasMegas ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <BeastSprite name={sp.name} size="full" />

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    {/* Header: Name, Tier, Type, MIDI + Expand chevron */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink">
                          {sp.name}
                        </span>
                        <TierBadge tier={sp.tier} />
                        <BeastTypeBadge type={sp.type} />
                        {sp.midiMegas > 0 && <MidiBadge count={sp.midiMegas} />}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {hasMegas ? (
                          <DisclosureChevron open={isExpanded} />
                        ) : (
                          <span className="text-[11px] text-ink-faint">0 Megas</span>
                        )}
                      </div>
                    </div>

                    {/* Bar 1: Caught vs 1,242 */}
                    <div className="space-y-1">
                      <div className="num flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-ink-faint">Caught</span>
                        <span className="text-ink-muted">
                          <strong className="text-ink">{formatInt(sp.claimed)}</strong> /{' '}
                          {formatInt(SUPPLY_CAPS.maxPerSpecies)} (
                          {formatPct(sp.claimed, SUPPLY_CAPS.maxPerSpecies, 1)})
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          style={{ width: `${caughtW}%` }}
                          className="h-full bg-accent/85"
                        />
                      </div>
                    </div>

                    {/* Bar 2: Mega Queue (Minted + Safe Staked + Overflow) vs 207 */}
                    <div className="space-y-1">
                      <div className="num flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-ink-faint">Mega Queue</span>
                        <span className="text-ink-muted">
                          <strong className="text-ink">{formatInt(sp.reserved)}</strong> /{' '}
                          {pfCap} ({formatPct(sp.reserved, pfCap, 1)})
                        </span>
                      </div>
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        {pfW > 0 && (
                          <div
                            style={{ width: `${pfW}%` }}
                            className="h-full bg-state-held-pf"
                            title={`Megas Minted: ${sp.megaTotal}`}
                          />
                        )}
                        {safeW > 0 && (
                          <div
                            style={{ width: `${safeW}%` }}
                            className="h-full bg-state-staked"
                            title={`Safe Staked: ${sp.safeStaked}`}
                          />
                        )}
                        {unsafeW > 0 && (
                          <div
                            style={{ width: `${unsafeW}%` }}
                            className="h-full bg-warn"
                            title={`Overflow Staked: ${sp.unsafeStaked}`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Combined stats footer */}
                    <div className="num flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-ink-faint">
                      <div className="flex flex-wrap items-center gap-x-2.5">
                        <span>
                          Megas:{' '}
                          <strong className="text-state-held-pf">
                            {formatInt(sp.megaTotal)}
                          </strong>
                          {hasMegas && (
                            <span className="ml-1">
                              (
                              <span className="text-owner-player">
                                {formatInt(sp.heldMegas)} held
                              </span>
                              {' · '}
                              <span className="text-owner-buyback">
                                {formatInt(sp.soldMegas)} sold
                              </span>
                              )
                            </span>
                          )}
                        </span>
                        <span>Staked: {formatInt(sp.staked)}</span>
                        <span>Captured: {formatInt(sp.taken)}</span>
                      </div>
                      {sp.avgMegaGrade !== null && (
                        <span>Avg Grade: {sp.avgMegaGrade.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/70 p-3 space-y-3">
                    {detailLoading && !detailData && (
                      <div className="py-3 text-center text-xs text-ink-muted">
                        Fetching evolved {sp.name} tokens...
                      </div>
                    )}

                    {detailError && (
                      <div className="py-2 text-xs text-owner-buyback">
                        Failed to load tokens: {detailError}
                      </div>
                    )}

                    {!detailLoading && !detailError && detailData && detailData.items.length === 0 && (
                      <div className="rounded-md border border-dashed border-border bg-surface p-4 text-center text-xs text-ink-muted">
                        No evolved {sp.name} Megas match the current filter.
                      </div>
                    )}

                    {detailData && detailData.items.length > 0 && (
                      <>
                        <div
                          className={`overflow-x-auto rounded-md border border-border/60 bg-surface transition-opacity ${
                            detailLoading ? 'opacity-60' : 'opacity-100'
                          }`}
                        >
                          <table className="w-full border-collapse text-left text-xs sm:table-fixed">
                            <thead>
                              <tr className="border-b border-border/70 text-[10px]">
                                <th className="py-2 pl-3 pr-2 font-medium">
                                  {renderSortButton('beast', 'Beast', 'left')}
                                </th>
                                <th className="w-28 py-2 px-2 font-medium sm:w-28">
                                  {renderSortButton('owner', 'Owner', 'left')}
                                </th>
                                <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-16">
                                  {renderSortButton('level', 'Lvl', 'right')}
                                </th>
                                <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-20">
                                  {renderSortButton('health', 'HP', 'right')}
                                </th>
                                <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-20">
                                  {renderSortButton('power', 'Power', 'right')}
                                </th>
                                <th className="w-16 py-2 px-2 font-medium sm:w-20">
                                  {renderSortButton('grade', 'Grade', 'right')}
                                </th>
                                <th className="w-20 py-2 pl-2 pr-3 font-medium sm:w-24">
                                  {renderSortButton('evolved', 'Evolved', 'right')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {detailData.items.map((item) => {
                                const displayName = formatBeastDisplayName(
                                  item.prefixName,
                                  item.suffixName,
                                  item.name,
                                );
                                const isMidi = (item.visualEffects & 1) !== 0;

                                return (
                                  <tr
                                    key={item.tokenId}
                                    className="hover:bg-surface-elevated/40"
                                  >
                                    <td className="py-2 pl-3 pr-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium text-ink">
                                          {displayName}
                                        </span>
                                        {isMidi && <MidiBadge />}
                                      </div>
                                      <div className="num mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-faint sm:hidden">
                                        <span>Lv.{item.level}</span>
                                        <span>HP {formatInt(item.health)}</span>
                                        <span>Pwr {formatInt(item.power)}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 whitespace-nowrap">
                                      <OwnerBadge soldToBuyback={item.soldToBuyback} />
                                    </td>
                                    <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                      {item.level}
                                    </td>
                                    <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                      {formatInt(item.health)}
                                    </td>
                                    <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                      {formatInt(item.power)}
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <GradeBadge grade={item.cardGrade} />
                                    </td>
                                    <td className="num py-2 pl-2 pr-3 text-right whitespace-nowrap text-[11px] text-ink-faint">
                                      {formatRelativeTime(item.mintedAtMinute * 60)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {totalPages > 1 && (
                          <div className="num flex items-center justify-between pt-1 text-xs text-ink-muted">
                            <button
                              type="button"
                              disabled={detailPage <= 1}
                              onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                              className="rounded border border-border bg-surface px-2.5 py-1 disabled:opacity-40 hover:border-accent"
                            >
                              ← Prev
                            </button>
                            <span>
                              Page {detailPage} / {totalPages}
                            </span>
                            <button
                              type="button"
                              disabled={detailPage >= totalPages}
                              onClick={() =>
                                setDetailPage((p) => Math.min(totalPages, p + 1))
                              }
                              className="rounded border border-border bg-surface px-2.5 py-1 disabled:opacity-40 hover:border-accent"
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}