import { useMemo, useState } from 'react';
import { KpiCard } from '../components/KpiCard';
import { JointPoolChart } from '../components/pools/JointPoolChart';
import { PoolCard } from '../components/pools/PoolCard';
import { RecentSalesLedger } from '../components/pools/RecentSalesLedger';
import { formatEth, formatInt } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { PoolHistoryEvent, PoolsResponse } from '../types/dashboard';

export default function PoolsTab() {
  const { data, loading, error, refresh } = useApi<PoolsResponse>('/api/pools');
  const [expandedPoolAddr, setExpandedPoolAddr] = useState<string | null>(null);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  const eventsByPool = useMemo(() => {
    const map = new Map<string, PoolHistoryEvent[]>();
    for (const ev of data?.spotHistory ?? []) {
      const list = map.get(ev.poolAddress) ?? [];
      list.push(ev);
      map.set(ev.poolAddress, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.ts - b.ts);
    }
    return map;
  }, [data]);

  const totals = useMemo(() => {
    let netWei = 0n;
    let grossWei = 0n;
    let totalSold = 0;
    let totalTxs = 0;

    for (const p of data?.pools ?? []) {
      netWei += BigInt(p.netEthWei || '0');
      grossWei += BigInt(p.grossEthWei || '0');
      totalSold += p.nftsSold;
      totalTxs += p.saleTxs;
    }

    const feesWei = grossWei > netWei ? grossWei - netWei : 0n;
    return {
      netWei: netWei.toString(),
      grossWei: grossWei.toString(),
      feesWei: feesWei.toString(),
      totalSold,
      totalTxs,
    };
  }, [data]);

  const tierPairs = useMemo(() => {
    const pools = data?.pools ?? [];
    return [1, 2, 3, 4, 5].map((tier) => ({
      tier,
      regular: pools.find((p) => p.tier === tier && p.form === 'regular') ?? null,
      powerForm: pools.find((p) => p.tier === tier && p.form === 'power_form') ?? null,
    }));
  }, [data]);

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
        <p className="text-ink">Failed to load buyback pool metrics: {error}</p>
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
          label="Net Paid to Players"
          value={formatEth(totals.netWei, 4)}
          sublabel="90.25% of gross outflow"
          accentClass="text-state-sold-pf"
        />
        <KpiCard
          label="Gross Pool Volume"
          value={formatEth(totals.grossWei, 4)}
          sublabel="Pre-fee ETH liquidity spent"
        />
        <KpiCard
          label="Fees Captured (9.75%)"
          value={formatEth(totals.feesWei, 5)}
          sublabel="Compounding 5% + 5% cut"
          accentClass="text-state-staked"
        />
        <KpiCard
          label="Buyback Sales"
          value={formatInt(totals.totalSold)}
          sublabel={`${formatInt(totals.totalTxs)} swap txs across 10 pools`}
        />
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Buyback Pool Curves (T1-T5)
          </h2>
          <p className="text-xs text-ink-muted">
            Prices climb daily (+50% Normal, +30% Mega) and step down on each sale. Tap any pool for details.
          </p>
        </div>

        <div className="space-y-3">
          {tierPairs.map(({ tier, regular, powerForm }) => (
            <div key={tier} className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Tier {tier}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[regular, powerForm].map((pool, idx) => {
                  const addr = pool?.address ?? null;
                  return (
                    <PoolCard
                      key={addr ?? `${tier}-${idx}`}
                      pool={pool}
                      events={addr ? eventsByPool.get(addr) ?? [] : []}
                      nowSec={nowSec}
                      isExpanded={Boolean(addr && expandedPoolAddr === addr)}
                      onToggleExpand={() =>
                        setExpandedPoolAddr((cur) => (cur === addr ? null : addr))
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <JointPoolChart
        pools={data.pools}
        eventsByPool={eventsByPool}
        nowSec={nowSec}
      />

      <RecentSalesLedger sales={data.recentSales} />
    </div>
  );
}