import { useMemo } from 'react';
import { KpiCard } from '../components/KpiCard';
import { QualityBreakdownSection } from '../components/overview/QualityBreakdownSection';
import { SupplyProgressSection } from '../components/overview/SupplyProgressSection';
import { SUPPLY_CAPS } from '../lib/constants';
import { formatEth, formatInt, formatPct } from '../lib/format';
import type { OverviewResponse, TabId } from '../types/dashboard';

interface OverviewTabProps {
  data: OverviewResponse;
  onNavigate: (tab: TabId) => void;
}

export function OverviewTab({ data, onNavigate }: OverviewTabProps) {
  const kpis = data.kpis;

  const tierProgress = useMemo(() => {
    const byId = new Map(data.speciesCatalog.map((c) => [c.beastId, c]));
    const rows = data.speciesSnapshot.map((s) => {
      const meta = byId.get(s.beastId) ?? byId.get(s.beastId + 77);
      return {
        tier: meta?.tier ?? 0,
        claimed: s.claimed,
        powerForm: s.evolved ?? s.mega ?? 0,
        staked: s.staked,
      };
    });

    return [1, 2, 3, 4, 5].map((tier) => {
      const members = rows.filter((r) => r.tier === tier);
      return {
        tier,
        claimed: members.reduce((s, r) => s + r.claimed, 0),
        powerForm: members.reduce((s, r) => s + r.powerForm, 0),
        staked: members.reduce((s, r) => s + r.staked, 0),
      };
    });
  }, [data.speciesSnapshot, data.speciesCatalog]);

  if (!kpis) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-muted">
        No transformation snapshots recorded yet. Run <code className="text-ink">/api/sync</code> to populate the overview.
      </div>
    );
  }

  const resolvedCount = kpis.taken + kpis.powerForm;

  const navCards: Array<{
    tab: TabId;
    title: string;
    buttonLabel: string;
    desc: string;
  }> = [
    {
      tab: 'staked',
      title: 'Staked Beasts',
      buttonLabel: 'Browse Staked',
      desc: `Browse all ${formatInt(kpis.staked)} currently staked, huntable Beasts grouped by Tier and Species.`,
    },
    {
      tab: 'beasts',
      title: 'Beasts & Megas',
      buttonLabel: 'Explore Beasts',
      desc: 'Inspect evolved Megas by species, Held vs. Sold ownership, and 30-species Mega queue caps.',
    },
    {
      tab: 'pools',
      title: 'Buyback Pools',
      buttonLabel: 'View Pools',
      desc: 'Side-by-side T1-T5 Normal vs. Mega reverse Dutch auction curves, fees, and sales ledger.',
    },
    {
      tab: 'player',
      title: 'My Account',
      buttonLabel: 'Open Account',
      desc: 'Paste your Starknet game account to inspect your held Beasts, Card Grades, kills, and runs.',
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Headline metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Beasts Caught"
          value={formatInt(kpis.claimed)}
          denominator={formatInt(SUPPLY_CAPS.maxTotalBeasts)}
          sublabel={`${formatPct(kpis.claimed, SUPPLY_CAPS.maxTotalBeasts)} of all beasts caught`}
        />
        <KpiCard
          label="Staked (Huntable)"
          value={formatInt(kpis.staked)}
          denominator={formatInt(kpis.claimed)}
          sublabel={`${formatPct(kpis.staked, Math.max(kpis.claimed, 1))} currently staked`}
          accentClass="text-state-staked"
        />
        <KpiCard
          label="Megas Minted"
          value={formatInt(kpis.powerForm)}
          denominator={formatInt(SUPPLY_CAPS.maxTotalPowerForms)}
          sublabel={`${formatPct(kpis.powerForm, SUPPLY_CAPS.maxTotalPowerForms)} of all mega beasts minted`}
          accentClass="text-state-held-pf"
        />
        <KpiCard
          label="Captured in Pool"
          value={formatInt(kpis.taken)}
          denominator={formatInt(resolvedCount)}
          sublabel={`${formatPct(kpis.taken, Math.max(resolvedCount, 1))} captured · ${formatPct(kpis.powerForm, Math.max(resolvedCount, 1))} survived`}
          accentClass="text-state-sold-reg"
        />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard
            label="Buyback Volume (Net)"
            value={formatEth(kpis.netEthWei, 4)}
            sublabel={`${formatInt(kpis.totalSold)} Beasts sold`}
            accentClass="text-state-sold-pf"
          />
        </div>
      </section>

      <SupplyProgressSection
        claimed={kpis.claimed}
        powerForm={kpis.powerForm}
        staked={kpis.staked}
        tierProgress={tierProgress}
      />

      <section
        aria-label="Dashboard pages"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {navCards.map((card) => (
          <div
            key={card.tab}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-ink">{card.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{card.desc}</p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onNavigate(card.tab)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/70 hover:bg-accent/20"
              >
                <span>{card.buttonLabel}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ))}
      </section>

      <QualityBreakdownSection />
    </div>
  );
}