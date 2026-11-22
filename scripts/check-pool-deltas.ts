import { config } from 'dotenv';
import { API_ENDPOINTS, BUYBACK_POOLS, LOOT_DUNGEON } from '../server/config.js';

config({ path: '.env.local', override: true });

interface PoolEvent {
  time: number;
  kind: string;
  spotPrice: string;
  delta?: string | null;
  amount?: string | null;
  nftCount?: number | null;
}

async function main() {
  const active = BUYBACK_POOLS.filter(
    (p): p is (typeof BUYBACK_POOLS)[number] & { address: string } => Boolean(p.address),
  );

  const pairsParam = active.map((p) => p.address.toLowerCase()).join(',');
  const url = `${API_ENDPOINTS.collectablesBase}/pools/history?pairs=${pairsParam}`;
  const res = (await fetch(url).then((r) => r.json())) as Record<string, unknown>;
  const pairs = (
    res && typeof res === 'object' && 'pairs' in res && res.pairs ? res.pairs : res
  ) as Record<string, PoolEvent[]>;

  const rows = active.map((p) => {
    const evs = pairs[p.address.toLowerCase()] ?? [];
    const seed = evs[0];

    let impliedDailyRate = '-';
    let stepDownRatio = '-';

    for (let i = 1; i < evs.length; i++) {
      const prev = evs[i - 1];
      const curr = evs[i];
      if (curr.kind === 'sale' && (curr.nftCount ?? 1) === 1 && curr.amount) {
        const dtDays = (curr.time - prev.time) / 86400;
        const prevSpot = Number(prev.spotPrice);
        const gross = Number(curr.amount) / LOOT_DUNGEON.netToGrossDivisor;
        if (dtDays > 0 && prevSpot > 0 && gross > 0) {
          impliedDailyRate = `${Math.pow(gross / prevSpot, 1 / dtDays).toFixed(4)}x/d`;
          stepDownRatio = `${(Number(curr.spotPrice) / gross).toFixed(4)}x`;
          break;
        }
      }
    }

    return {
      pool: `T${p.tier} ${p.form === 'power_form' ? 'PF' : 'Reg'}`,
      events: evs.length,
      deltaHex: seed?.delta ? `0x${BigInt(seed.delta).toString(16)}` : '-',
      impliedDailyRate,
      stepDownRatio,
    };
  });

  console.table(rows);
}

main().catch((err) => {
  console.error('Pool delta check failed:', err);
  process.exit(1);
});