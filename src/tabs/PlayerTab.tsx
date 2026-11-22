import { useEffect, useState, type FormEvent } from 'react';
import { KpiCard } from '../components/KpiCard';
import { formatInt, formatRelativeTime, shortAddr } from '../lib/format';
import type { PlayerResponse } from '../types/dashboard';

const STORAGE_KEY = 'loot_dungeon_last_wallet';

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
  const [showAllBeasts, setShowAllBeasts] = useState(true);

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

  const grades = [10, 9, 8, 7, 6, 5];

  return (
    <div className="space-y-6">
      {/* Wallet Lookup Form */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            My Account Lookup (Live On-Demand · Zero DB Storage)
          </h2>
          <p className="text-xs text-ink-muted">
            Paste your Starknet game account address (Cartridge / wallet) to inspect your currently held Loot Dungeon Beasts, Card Grades, kills, and run history.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={inputAddr}
            onChange={(e) => setInputAddr(e.target.value)}
            placeholder="0x0770c765bb27d9b8360..."
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
              {loading ? 'Loading…' : 'Inspect'}
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

        {error && (
          <div className="rounded-lg border border-state-sold-reg/40 bg-bg px-3 py-2 text-xs text-state-sold-reg">
            {error}
          </div>
        )}
      </section>

      {!activeAddr && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-xs text-ink-muted">
          Enter your Starknet wallet address above to load your live Loot Dungeon profile. Your address stays strictly in your browser and is not stored in our database.
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
              label="Held Beasts"
              value={formatInt(data.summary.heldTotal)}
              sublabel={`${formatInt(data.summary.heldPowerForms)} Power Form · ${formatInt(data.summary.heldRegular)} Regular`}
            />
            <KpiCard
              label="Avg Card Grade"
              value={
                data.summary.avgHeldGrade !== null
                  ? data.summary.avgHeldGrade.toFixed(2)
                  : '—'
              }
              sublabel="Across currently held Beasts"
              accentClass="text-state-staked"
            />
            <KpiCard
              label="Runs Played"
              value={formatInt(data.summary.runsStarted)}
              sublabel={`${formatInt(data.summary.runsMinted)} minted · ${formatInt(data.summary.runsCompleted)} finished`}
              accentClass="text-accent"
            />
            <KpiCard
              label="Kills & Bags"
              value={formatInt(data.summary.killsCount)}
              sublabel={`${formatInt(data.summary.uniqueBagsUsed)} Loot Bags · ${formatInt(data.summary.takenCount)} taken`}
              accentClass="text-state-sold-pf"
            />
          </section>

          {/* Held Tier & Grade Breakdown */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Held Beasts by Tier
              </h3>
              <div className="grid grid-cols-5 gap-2 num">
                {[1, 2, 3, 4, 5].map((tier) => (
                  <div
                    key={tier}
                    className="rounded-lg border border-border/70 bg-bg p-2.5 text-center"
                  >
                    <div className="text-[11px] text-ink-faint">T{tier}</div>
                    <div className="mt-1 text-base font-semibold text-ink">
                      {formatInt(data.tierCounts[String(tier)] ?? 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Held Beasts by Card Grade
              </h3>
              <div className="grid grid-cols-6 gap-2 num">
                {grades.map((g) => (
                  <div
                    key={g}
                    className="rounded-lg border border-border/70 bg-bg p-2.5 text-center"
                  >
                    <div className="text-[11px] text-ink-faint">G{g}</div>
                    <div className="mt-1 text-base font-semibold text-ink">
                      {formatInt(data.gradeCounts[String(g)] ?? 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Held Beast Inventory (Collapsible) */}
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
                  Staked Beasts are held in escrow by the dungeon contract until converted to Power Form
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllBeasts((v) => !v)}
                className="rounded-lg border border-border bg-bg px-3 py-1 text-xs font-medium text-accent"
              >
                {showAllBeasts ? 'Hide ▲' : 'Show ▼'}
              </button>
            </div>

            {showAllBeasts && (
              <div className="mt-4">
                {data.heldBeasts.length === 0 ? (
                  <p className="text-xs text-ink-faint">
                    No Loot Dungeon Beasts currently held directly in this wallet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-faint">
                          <th className="py-2 pr-3 font-medium">Beast</th>
                          <th className="py-2 px-2 font-medium">Tier / Form</th>
                          <th className="py-2 px-2 text-right font-medium">Grade</th>
                          <th className="py-2 px-2 text-right font-medium">Lvl</th>
                          <th className="py-2 px-2 text-right font-medium">HP</th>
                          <th className="py-2 pl-2 text-right font-medium">Power</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 num">
                        {data.heldBeasts.map((b) => {
                          const title = [b.prefixName, b.suffixName]
                            .filter(Boolean)
                            .join(' ');
                          return (
                            <tr key={b.tokenId}>
                              <td className="py-2 pr-3 font-medium text-ink">
                                {title ? `"${title}" ` : ''}
                                <span className="text-ink-muted">{b.name}</span>
                              </td>
                              <td className="py-2 px-2">
                                <span className="rounded bg-bg px-1.5 py-0.5 text-[11px] text-ink-muted">
                                  T{b.tier}
                                </span>{' '}
                                {b.isPowerForm && (
                                  <span className="rounded bg-state-held-pf/20 px-1.5 py-0.5 text-[11px] font-medium text-state-held-pf">
                                    Power Form
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right text-ink">
                                {b.cardGrade !== null ? `G${b.cardGrade}` : '—'}
                              </td>
                              <td className="py-2 px-2 text-right text-ink-muted">
                                {b.level}
                              </td>
                              <td className="py-2 px-2 text-right text-ink-muted">
                                {b.health}
                              </td>
                              <td className="py-2 pl-2 text-right text-ink-muted">
                                {b.power}
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