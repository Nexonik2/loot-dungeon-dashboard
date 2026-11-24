import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BeastSprite,
  BeastTypeBadge,
  GradeBadge,
  MidiBadge,
  TierBadge,
  formatBeastDisplayName,
} from '../components/BeastBadges';
import { DisclosureChevron } from '../components/DisclosureChevron';
import { KpiCard } from '../components/KpiCard';
import {
  formatCountdown,
  formatInt,
  formatPct,
  formatRelativeTime,
  shortAddr,
} from '../lib/format';
import type { PlayerResponse } from '../types/dashboard';
import { PlayerDistributionCharts } from '../components/player/PlayerDistributionCharts';

const STORAGE_KEY = 'loot_dungeon_last_wallet';

type SortDir = 'asc' | 'desc';
type StakedCol = 'beast' | 'level' | 'health' | 'power' | 'grade' | 'staked' | 'until';
type HeldCol = 'beast' | 'level' | 'health' | 'power' | 'grade' | 'caught';

function isEvmLengthAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
}

export default function PlayerTab() {
  const [inputAddr, setInputAddr] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [activeAddr, setActiveAddr] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [data, setData] = useState<PlayerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStaked, setShowStaked] = useState(true);
  const [showHeld, setShowHeld] = useState(true);

  const [stakedSort, setStakedSort] = useState<{ col: StakedCol; dir: SortDir }>({
    col: 'until',
    dir: 'asc',
  });
  const [heldSort, setHeldSort] = useState<{ col: HeldCol; dir: SortDir }>({
    col: 'grade',
    dir: 'desc',
  });

  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!activeAddr) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/player?address=${encodeURIComponent(activeAddr)}`)
      .then(async (res) => {
        const body = (await res.json()) as PlayerResponse & { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return body;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Lookup failed');
        setData(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAddr]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = inputAddr.trim();
    if (!cleaned) return;
    try {
      localStorage.setItem(STORAGE_KEY, cleaned);
    } catch {
      // Ignore private-mode storage restrictions
    }
    setActiveAddr(cleaned);
  };

  const handleClear = () => {
    setInputAddr('');
    setActiveAddr('');
    setData(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const toggleStakedSort = (col: StakedCol) => {
    setStakedSort((prev) => {
      if (prev.col === col) {
        return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir: SortDir =
        col === 'beast' || col === 'until' ? 'asc' : 'desc';
      return { col, dir: defaultDir };
    });
  };

  const toggleHeldSort = (col: HeldCol) => {
    setHeldSort((prev) => {
      if (prev.col === col) {
        return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir: SortDir = col === 'beast' ? 'asc' : 'desc';
      return { col, dir: defaultDir };
    });
  };

  const sortedStaked = useMemo(() => {
    const list = [...(data?.stakedBeasts ?? [])];
    const mult = stakedSort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (stakedSort.col) {
        case 'beast':
          return (
            formatBeastDisplayName(a.prefixName, a.suffixName, a.name).localeCompare(
              formatBeastDisplayName(b.prefixName, b.suffixName, b.name),
            ) * mult
          );
        case 'level':
          return (a.level - b.level) * mult;
        case 'health':
          return (a.health - b.health) * mult;
        case 'power':
          return ((a.power ?? 0) - (b.power ?? 0)) * mult;
        case 'grade':
          return ((a.cardGrade ?? 0) - (b.cardGrade ?? 0)) * mult;
        case 'staked':
          return ((a.stakedAt ?? 0) - (b.stakedAt ?? 0)) * mult;
        case 'until':
          return (
            ((a.transformsAt ?? Number.MAX_SAFE_INTEGER) -
              (b.transformsAt ?? Number.MAX_SAFE_INTEGER)) *
            mult
          );
      }
    });
    return list;
  }, [data?.stakedBeasts, stakedSort]);

  const sortedHeld = useMemo(() => {
    const list = [...(data?.heldBeasts ?? [])];
    const mult = heldSort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (heldSort.col) {
        case 'beast':
          return (
            formatBeastDisplayName(a.prefixName, a.suffixName, a.name).localeCompare(
              formatBeastDisplayName(b.prefixName, b.suffixName, b.name),
            ) * mult
          );
        case 'level':
          return (a.level - b.level) * mult;
        case 'health':
          return (a.health - b.health) * mult;
        case 'power':
          return (a.power - b.power) * mult;
        case 'grade':
          return ((a.cardGrade ?? 0) - (b.cardGrade ?? 0)) * mult;
        case 'caught':
          return ((a.mintedAtMinute ?? 0) - (b.mintedAtMinute ?? 0)) * mult;
      }
    });
    return list;
  }, [data?.heldBeasts, heldSort]);

  const midiStats = useMemo(() => {
    const staked = (data?.stakedBeasts ?? []).filter(
      (b) => (b.visualEffects & 1) !== 0,
    ).length;
    const held = (data?.heldBeasts ?? []).filter(
      (b) => (b.visualEffects & 1) !== 0,
    ).length;
    return { staked, held, total: staked + held };
  }, [data?.stakedBeasts, data?.heldBeasts]);

  const renderSortBtn = <T extends string>(
    col: T,
    label: string,
    active: { col: T; dir: SortDir },
    onClick: (c: T) => void,
    align: 'left' | 'right' = 'right',
  ) => {
    const isActive = active.col === col;
    return (
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink ${
          align === 'left' ? 'justify-start' : 'justify-end'
        } ${isActive ? 'text-accent' : 'text-ink-faint'}`}
      >
        <span>{label}</span>
        {isActive && (
          <span aria-hidden="true" className="text-[10px] leading-none">
            {active.dir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    );
  };

  const evmWarning = isEvmLengthAddress(inputAddr || activeAddr);

  return (
    <div className="space-y-6">
      {/* Wallet Lookup Form */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Account Lookup (Live On-Demand · Zero DB Storage)
          </h2>
          <p className="text-xs text-ink-muted">
            Paste your Starknet game account address to inspect your Loot Dungeon Beasts (held and staked), evolution timers, Card Grades, kills, and runs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={inputAddr}
            onChange={(e) => setInputAddr(e.target.value)}
            placeholder="0x025c7f2b0b3b8e31922bfa623..."
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !inputAddr.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'Loading...' : 'Inspect'}
            </button>
            {activeAddr && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {evmWarning && (
          <div className="rounded-lg border border-state-staked/45 bg-state-staked/10 px-3 py-2 text-xs text-state-staked">
            That looks like a 40-character EVM address. Loot Survivor indexes by your derived Starknet smart account (up to 64 hex characters), visible in your in-game profile drawer.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-owner-buyback/40 bg-bg px-3 py-2 text-xs text-owner-buyback">
            {error}
          </div>
        )}
      </section>

      {!activeAddr && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-xs text-ink-muted">
          Enter your Starknet game account address above to load your live Loot Dungeon profile. Only Loot Bag mode Beasts (#78-107) are tracked, and your address stays strictly in your browser.
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-surface" />
          <div className="h-48 animate-pulse rounded-xl bg-surface" />
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
            <span className="font-mono text-ink-muted">
              Account: {shortAddr(data.address)}
            </span>
            <span>Live fetched {formatRelativeTime(data.fetchedAt)}</span>
          </div>

          {/* Account Summary KPIs */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Loot Dungeon Beasts"
              value={formatInt(data.summary.totalOwned)}
              sublabel={`${formatInt(data.summary.stakedCount)} staked · ${formatInt(data.summary.heldTotal)} held (${formatInt(data.summary.heldPowerForms)} Mega)`}
            />
            <KpiCard
              label="Avg Card Grade"
              value={
                data.summary.avgGrade !== null
                  ? data.summary.avgGrade.toFixed(2)
                  : '-'
              }
              sublabel={
                data.summary.readyToEvolveCount > 0
                  ? `${formatInt(data.summary.readyToEvolveCount)} staked ready to evolve`
                  : 'Across held and staked Beasts'
              }
              accentClass="text-state-staked"
            />
            <KpiCard
              label="MIDI Beasts"
              value={formatInt(midiStats.total)}
              sublabel={
                midiStats.total > 0
                  ? `${formatInt(midiStats.staked)} staked · ${formatInt(midiStats.held)} held (${formatPct(midiStats.total, Math.max(data.summary.totalOwned, 1))})`
                  : 'None in current collection'
              }
              accentClass="text-midi"
            />
            <KpiCard
              label="Runs Played"
              value={formatInt(data.summary.runsStarted)}
              sublabel={
                data.summary.takenCount > 0
                  ? `of ${formatInt(data.summary.runsMinted)} minted, ${formatInt(data.summary.takenCount)} ${
                      data.summary.takenCount === 1 ? 'beast' : 'beasts'
                    } captured`
                  : `of ${formatInt(data.summary.runsMinted)} minted`
              }
              accentClass="text-accent"
            />
          </section>

          <PlayerDistributionCharts
            tierCounts={data.tierCounts}
            gradeCounts={data.gradeCounts}
            totalBeasts={data.summary.totalOwned}
          />

          {/* Currently Staked Beasts (with Staked & Until Evolved countdowns) */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Currently Staked Beasts ({formatInt(data.stakedBeasts.length)})
                </h3>
                <p className="text-xs text-ink-muted">
                  Held in dungeon escrow and huntable until you execute evolve + unstake
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStaked((v) => !v)}
                aria-expanded={showStaked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/60"
              >
                <span>{showStaked ? 'Hide' : 'Show'}</span>
                <DisclosureChevron open={showStaked} className="text-accent" />
              </button>
            </div>

            {showStaked && (
              <div className="mt-4">
                {sortedStaked.length === 0 ? (
                  <p className="text-xs text-ink-faint">
                    No Loot Dungeon Beasts currently staked from this account.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border/60 bg-bg">
                    <table className="w-full border-collapse text-left text-xs sm:table-fixed">
                      <thead>
                        <tr className="border-b border-border/70 text-[10px]">
                          <th className="py-2 pl-3 pr-2 font-medium">
                            {renderSortBtn('beast', 'Beast', stakedSort, toggleStakedSort, 'left')}
                          </th>
                          <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-14">
                            {renderSortBtn('level', 'Lvl', stakedSort, toggleStakedSort)}
                          </th>
                          <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-18">
                            {renderSortBtn('health', 'HP', stakedSort, toggleStakedSort)}
                          </th>
                          <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-20">
                            {renderSortBtn('power', 'Power', stakedSort, toggleStakedSort)}
                          </th>
                          <th className="w-16 py-2 px-2 font-medium sm:w-20">
                            {renderSortBtn('grade', 'Grade', stakedSort, toggleStakedSort)}
                          </th>
                          <th className="hidden py-2 px-2 font-medium md:table-cell md:w-24">
                            {renderSortBtn('staked', 'Staked', stakedSort, toggleStakedSort)}
                          </th>
                          <th className="w-24 py-2 pl-2 pr-3 font-medium sm:w-28">
                            {renderSortBtn('until', 'Until Evolved', stakedSort, toggleStakedSort)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {sortedStaked.map((b) => {
                          const displayName = formatBeastDisplayName(
                            b.prefixName,
                            b.suffixName,
                            b.name,
                          );
                          const isMidi = (b.visualEffects & 1) !== 0;
                          const countdown = formatCountdown(b.transformsAt, nowSec);

                          return (
                            <tr
                              key={b.tokenId}
                              className="hover:bg-surface-elevated/40"
                            >
                              <td className="py-2 pl-3 pr-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <BeastSprite name={b.name} size="sm" />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="truncate font-medium text-ink">
                                        {displayName}
                                      </span>
                                      <TierBadge tier={b.tier} />
                                      {b.type !== '-' && <BeastTypeBadge type={b.type} />}
                                      {isMidi && <MidiBadge />}
                                    </div>
                                    <div className="num mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-faint sm:hidden">
                                      <span>Lv.{b.level}</span>
                                      <span>HP {formatInt(b.health)}</span>
                                      {b.power !== null && <span>Pwr {formatInt(b.power)}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                {b.level}
                              </td>
                              <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                {formatInt(b.health)}
                              </td>
                              <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                {b.power !== null ? formatInt(b.power) : '-'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <GradeBadge grade={b.cardGrade} />
                              </td>
                              <td className="num hidden py-2 px-2 text-right whitespace-nowrap text-[11px] text-ink-faint md:table-cell">
                                {formatRelativeTime(b.stakedAt)}
                              </td>
                              <td className="num py-2 pl-2 pr-3 text-right whitespace-nowrap text-[11px]">
                                {countdown.ready ? (
                                  <span className="rounded border border-accent/45 bg-accent/15 px-1.5 py-0.5 font-medium text-accent">
                                    Ready
                                  </span>
                                ) : (
                                  <span className="text-ink-muted">{countdown.text}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Currently Held Beasts (Wallet-held Loot Dungeon tokens) */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Currently Held Beasts ({formatInt(data.heldBeasts.length)}
                  {data.summary.heldTotal > data.heldBeasts.length
                    ? ` of ${formatInt(data.summary.heldTotal)}`
                    : ''}
                  )
                </h3>
                <p className="text-xs text-ink-muted">
                  Unstaked Loot Dungeon Beasts sitting directly in this wallet
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHeld((v) => !v)}
                aria-expanded={showHeld}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/60"
              >
                <span>{showHeld ? 'Hide' : 'Show'}</span>
                <DisclosureChevron open={showHeld} className="text-accent" />
              </button>
            </div>

            {showHeld && (
              <div className="mt-4">
                {sortedHeld.length === 0 ? (
                  <p className="text-xs text-ink-faint">
                    No unstaked Loot Dungeon Beasts (#78-107) currently held directly in this wallet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border/60 bg-bg">
                    <table className="w-full border-collapse text-left text-xs sm:table-fixed">
                      <thead>
                        <tr className="border-b border-border/70 text-[10px]">
                          <th className="py-2 pl-3 pr-2 font-medium">
                            {renderSortBtn('beast', 'Beast', heldSort, toggleHeldSort, 'left')}
                          </th>
                          <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-16">
                            {renderSortBtn('level', 'Lvl', heldSort, toggleHeldSort)}
                          </th>
                          <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-20">
                            {renderSortBtn('health', 'HP', heldSort, toggleHeldSort)}
                          </th>
                          <th className="hidden py-2 px-2 font-medium sm:table-cell sm:w-20">
                            {renderSortBtn('power', 'Power', heldSort, toggleHeldSort)}
                          </th>
                          <th className="w-16 py-2 px-2 font-medium sm:w-20">
                            {renderSortBtn('grade', 'Grade', heldSort, toggleHeldSort)}
                          </th>
                          <th className="w-24 py-2 pl-2 pr-3 font-medium sm:w-24">
                            {renderSortBtn('caught', 'Caught', heldSort, toggleHeldSort)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {sortedHeld.map((b) => {
                          const displayName = formatBeastDisplayName(
                            b.prefixName,
                            b.suffixName,
                            b.name,
                          );
                          const isMidi = (b.visualEffects & 1) !== 0;

                          return (
                            <tr
                              key={b.tokenId}
                              className="hover:bg-surface-elevated/40"
                            >
                              <td className="py-2 pl-3 pr-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <BeastSprite name={b.name} size="sm" />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="truncate font-medium text-ink">
                                        {displayName}
                                      </span>
                                      <TierBadge tier={b.tier} />
                                      <BeastTypeBadge type={b.type} />
                                      {b.isPowerForm && (
                                        <span className="rounded border border-state-held-pf/40 bg-state-held-pf/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-state-held-pf">
                                          Mega
                                        </span>
                                      )}
                                      {isMidi && <MidiBadge />}
                                    </div>
                                    <div className="num mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-faint sm:hidden">
                                      <span>Lv.{b.level}</span>
                                      <span>HP {formatInt(b.health)}</span>
                                      <span>Pwr {formatInt(b.power)}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                {b.level}
                              </td>
                              <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                {formatInt(b.health)}
                              </td>
                              <td className="num hidden py-2 px-2 text-right text-ink-muted sm:table-cell">
                                {formatInt(b.power)}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <GradeBadge grade={b.cardGrade} />
                              </td>
                              <td className="num py-2 pl-2 pr-3 text-right whitespace-nowrap text-[11px] text-ink-faint">
                                {formatRelativeTime(
                                  b.mintedAtMinute ? b.mintedAtMinute * 60 : null,
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}