import { useEffect, useRef, useState } from 'react';
import {
  GradeBadge,
  MidiBadge,
  formatBeastDisplayName,
} from '../BeastBadges';
import { formatInt, formatRelativeTime } from '../../lib/format';
import type { WantedDetailResponse, WantedSpeciesRow } from '../../types/dashboard';

export type SortColumn = 'beast' | 'level' | 'health' | 'power' | 'grade' | 'caught';
export type SortDirection = 'asc' | 'desc';
export type WantedSortOption = `${SortColumn}_${SortDirection}`;

interface SpeciesBeastListProps {
  species: WantedSpeciesRow;
  minGrade: number | null;
  sort: WantedSortOption;
}

const DEFAULT_DIR: Record<SortColumn, SortDirection> = {
  beast: 'asc',
  level: 'asc',
  health: 'asc',
  power: 'asc',
  grade: 'desc',
  caught: 'desc',
};

function parseSort(sort: WantedSortOption): { col: SortColumn; dir: SortDirection } {
  const [col, dir] = sort.split('_') as [SortColumn, SortDirection];
  return { col, dir };
}

export function SpeciesBeastList({
  species,
  minGrade,
  sort,
}: SpeciesBeastListProps) {
  const [activeSort, setActiveSort] = useState<WantedSortOption>(sort);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WantedDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef(new Map<string, WantedDetailResponse>());

  // Sync local table sort if the top-level tab sort dropdown changes
  useEffect(() => {
    setActiveSort(sort);
  }, [sort]);

  useEffect(() => {
    setPage(1);
  }, [species.beastId, minGrade, activeSort]);

  useEffect(() => {
    const params = new URLSearchParams({
      beastId: String(species.beastId),
      sort: activeSort,
      page: String(page),
      limit: '20',
    });
    if (minGrade !== null) {
      params.set('minGrade', String(minGrade));
    }

    const url = `/api/staked?${params.toString()}`;
    const cached = cacheRef.current.get(url);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as WantedDetailResponse;
      })
      .then((json) => {
        if (cancelled) return;
        cacheRef.current.set(url, json);
        setData(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load staked Beasts');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [species.beastId, minGrade, activeSort, page]);

  const { col: activeCol, dir: activeDir } = parseSort(activeSort);

  const handleSortClick = (column: SortColumn) => {
    if (activeCol === column) {
      setActiveSort(`${column}_${activeDir === 'asc' ? 'desc' : 'asc'}`);
    } else {
      setActiveSort(`${column}_${DEFAULT_DIR[column]}`);
    }
  };

  const renderSortButton = (
    column: SortColumn,
    label: string,
    align: 'left' | 'center' | 'right' = 'right',
  ) => {
    const isActive = activeCol === column;
    const justifyClass =
      align === 'left'
        ? 'justify-start'
        : align === 'center'
          ? 'justify-center'
          : 'justify-end';

    return (
      <button
        type="button"
        onClick={() => handleSortClick(column)}
        className={`inline-flex w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink ${justifyClass} ${
          isActive ? 'text-accent' : 'text-ink-faint'
        }`}
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

  const ariaSortFor = (column: SortColumn): 'ascending' | 'descending' | 'none' => {
    if (activeCol !== column) return 'none';
    return activeDir === 'asc' ? 'ascending' : 'descending';
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="border-t border-border/70 bg-bg/60 p-3 space-y-3">
      {loading && !data && (
        <div className="py-3 text-center text-xs text-ink-muted">
          Fetching staked {species.name} tokens...
        </div>
      )}

      {error && (
        <div className="py-2 text-xs text-owner-buyback">
          Failed to load tokens: {error}
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-surface p-4 text-center text-xs text-ink-muted">
          No staked {species.name} Beasts match the current grade filter.
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div
            className={`overflow-x-auto rounded-md border border-border/60 bg-surface transition-opacity ${
              loading ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <table className="w-full border-collapse text-left text-xs sm:table-fixed">
              <thead>
                <tr className="border-b border-border/70 text-[10px]">
                  <th aria-sort={ariaSortFor('beast')} className="py-2 pl-3 pr-2 font-medium">
                    {renderSortButton('beast', 'Beast', 'left')}
                  </th>
                  <th
                    aria-sort={ariaSortFor('level')}
                    className="hidden py-2 px-2 font-medium sm:table-cell sm:w-20"
                  >
                    {renderSortButton('level', 'Lvl', 'right')}
                  </th>
                  <th
                    aria-sort={ariaSortFor('health')}
                    className="hidden py-2 px-2 font-medium sm:table-cell sm:w-24"
                  >
                    {renderSortButton('health', 'HP', 'right')}
                  </th>
                  <th
                    aria-sort={ariaSortFor('power')}
                    className="hidden py-2 px-2 font-medium sm:table-cell sm:w-24"
                  >
                    {renderSortButton('power', 'Power', 'right')}
                  </th>
                  <th
                    aria-sort={ariaSortFor('grade')}
                    className="w-20 py-2 px-2 font-medium sm:w-24"
                  >
                    {renderSortButton('grade', 'Grade', 'right')}
                  </th>
                  <th
                    aria-sort={ariaSortFor('caught')}
                    className="w-24 py-2 pl-2 pr-3 font-medium sm:w-24"
                  >
                    {renderSortButton('caught', 'Caught', 'right')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.items.map((item) => {
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
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-border bg-surface px-2.5 py-1 disabled:opacity-40 hover:border-accent"
              >
                ← Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-border bg-surface px-2.5 py-1 disabled:opacity-40 hover:border-accent"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}