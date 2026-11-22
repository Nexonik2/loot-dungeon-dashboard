import { Suspense, lazy, useState } from 'react';
import { formatRelativeTime } from './lib/format';
import { useApi } from './lib/useApi';
import { OverviewTab } from './tabs/OverviewTab';
import type { OverviewResponse, TabId } from './types/dashboard';

const QualityTab = lazy(() => import('./tabs/QualityTab'));
const WantedTab = lazy(() => import('./tabs/WantedTab'));
const PoolsTab = lazy(() => import('./tabs/PoolsTab'));
const PlayerTab = lazy(() => import('./tabs/PlayerTab'));

const TABS: Array<{ id: TabId; label: string; shortLabel: string }> = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview' },
  { id: 'wanted', label: 'Wanted List', shortLabel: 'Wanted' },
  { id: 'pools', label: 'Buyback Pools', shortLabel: 'Pools' },
  { id: 'quality', label: 'Beast Quality', shortLabel: 'Quality' },
  { id: 'player', label: 'My Account', shortLabel: 'Account' },
];

function TabFallback() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-xl bg-surface" />
      <div className="h-64 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const overview = useApi<OverviewResponse>('/api/overview');

  const handleNavigate = (tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-bg text-ink pb-20 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-lg">
              Loot Dungeon Analytics
            </h1>
            <p className="truncate text-[11px] text-ink-faint">
              Starknet Loot Bag Mode · Beasts, Staking &amp; Buyback Curves
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <nav
              aria-label="Dashboard sections"
              className="hidden md:flex items-center gap-1 rounded-lg border border-border bg-bg p-1"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleNavigate(t.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === t.id
                      ? 'bg-surface-elevated text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="num rounded-full border border-border bg-bg px-2.5 py-1 text-[11px] text-ink-muted">
              Synced {formatRelativeTime(overview.data?.lastSyncedAt)}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        {activeTab === 'overview' && (
          <>
            {overview.loading && !overview.data ? (
              <TabFallback />
            ) : overview.error || !overview.data ? (
              <div className="rounded-xl border border-state-sold-reg/40 bg-surface p-5 text-sm">
                <p className="text-ink">
                  Failed to load overview: {overview.error ?? 'No data returned'}
                </p>
                <button
                  type="button"
                  onClick={overview.refresh}
                  className="mt-3 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent"
                >
                  Retry
                </button>
              </div>
            ) : (
              <OverviewTab data={overview.data} onNavigate={handleNavigate} />
            )}
          </>
        )}

        {activeTab === 'wanted' && (
          <Suspense fallback={<TabFallback />}>
            <WantedTab />
          </Suspense>
        )}

        {activeTab === 'pools' && (
          <Suspense fallback={<TabFallback />}>
            <PoolsTab />
          </Suspense>
        )}

        {activeTab === 'quality' && (
          <Suspense fallback={<TabFallback />}>
            <QualityTab />
          </Suspense>
        )}

        {activeTab === 'player' && (
          <Suspense fallback={<TabFallback />}>
            <PlayerTab />
          </Suspense>
        )}
      </main>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden"
      >
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleNavigate(t.id)}
                className={`flex min-h-13 flex-col items-center justify-center px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'border-t-2 border-accent text-ink'
                    : 'border-t-2 border-transparent text-ink-muted'
                }`}
              >
                {t.shortLabel}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}