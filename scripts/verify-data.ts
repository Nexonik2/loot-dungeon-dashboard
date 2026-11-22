import { config } from 'dotenv';
import { API_ENDPOINTS, BUYBACK_POOLS } from '../server/config.js';
import { getDb } from '../server/db.js';

config({ path: '.env.local', override: true });

interface PoolEvent {
  kind: string;
  spotPrice: string;
  nftCount?: number | null;
}

async function checkPools() {
  const active = BUYBACK_POOLS.filter(
    (p): p is (typeof BUYBACK_POOLS)[number] & { address: string } => Boolean(p.address),
  );

  const pairsParam = active.map((p) => p.address.toLowerCase()).join(',');
  const url = `${API_ENDPOINTS.collectablesBase}/pools/history?pairs=${pairsParam}`;
  const res = (await fetch(url).then((r) => r.json())) as Record<string, unknown>;
  const pairs = (
    res && typeof res === 'object' && 'pairs' in res && res.pairs ? res.pairs : res
  ) as Record<string, PoolEvent[]>;

  // Use T5 Regular seed price as the 1.00x baseline to verify tier/form ratios
  const t5Reg = active.find((p) => p.tier === 5 && p.form === 'regular');
  const t5SeedRaw = t5Reg
    ? pairs[t5Reg.address.toLowerCase()]?.find((e) => e.kind === 'seed')?.spotPrice
    : null;
  const baselineEth = t5SeedRaw ? Number(t5SeedRaw) / 1e18 : null;

  const rows = active.map((p) => {
    const events = pairs[p.address.toLowerCase()] ?? [];
    const seed = events.find((e) => e.kind === 'seed');
    const sales = events.filter((e) => e.kind === 'sale');
    const seedEth = seed ? Number(seed.spotPrice) / 1e18 : null;
    const nftsSold = sales.reduce((sum, e) => sum + (e.nftCount ?? 1), 0);

    return {
      tier: `T${p.tier}`,
      form: p.form,
      addr: `${p.address.slice(0, 10)}...${p.address.slice(-4)}`,
      seedEth: seedEth !== null ? seedEth.toFixed(8) : 'MISSING',
      ratioVsT5Reg:
        seedEth !== null && baselineEth ? `${(seedEth / baselineEth).toFixed(2)}x` : '-',
      saleTxs: sales.length,
      nftsSold,
    };
  });

  console.log('\n=== Buyback Pools Verification ===');
  console.table(rows);
}

async function checkDbDeduplication() {
  const sql = getDb();

  const [snap] = await sql`
    SELECT claimed, held, staked, taken, evolved_count
    FROM transformation_snapshots
    ORDER BY id DESC
    LIMIT 1
  `;

  const statuses = await sql`
    SELECT status, COUNT(*)::int AS cnt
    FROM beasts
    GROUP BY status
    ORDER BY status
  `;

  const [dupes] = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM (
      SELECT beast_id, prefix_name, suffix_name
      FROM beasts
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    ) t
  `;

  console.log('\n=== DB Snapshot vs. Beasts Table ===');
  console.log('Latest snapshot:', snap);
  console.table(statuses);
  console.log('Duplicate (beast_id, prefix_name, suffix_name) triples:', dupes?.cnt ?? 0);
}

async function main() {
  await checkPools();
  await checkDbDeduplication();
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});