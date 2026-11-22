import { getDb } from '../server/db.js';

interface ApiRequest {
  method?: string;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();

    const [latestSnapRows, historyRows, speciesMetaRows, poolTotalsRows, syncRows] =
      await Promise.all([
        sql`
          SELECT
            captured_at,
            cap,
            max_period,
            claimed,
            held,
            staked,
            unsafe_staked,
            taken,
            power_form_count,
            evolved_count,
            species_json
          FROM transformation_snapshots
          ORDER BY captured_at DESC
          LIMIT 1
        `,
        sql`
          SELECT
            EXTRACT(EPOCH FROM captured_at)::bigint AS ts,
            claimed,
            held,
            staked,
            unsafe_staked,
            taken,
            evolved_count AS power_form
          FROM transformation_snapshots
          ORDER BY captured_at ASC
        `,
        sql`
          SELECT
            beast_id,
            MIN(name) AS name,
            MIN(type) AS type,
            MIN(tier)::int AS tier,
            COUNT(*)::int AS active_count
          FROM beasts
          WHERE status <> 'superseded'
          GROUP BY beast_id
          ORDER BY beast_id ASC
        `,
        sql`
          SELECT
            COALESCE(SUM(nft_count), 0)::int AS total_sold,
            COALESCE(SUM(amount_wei), 0)::text AS net_eth_wei,
            COALESCE(SUM(amount_wei / 0.9025), 0)::numeric(78, 0)::text AS gross_eth_wei
          FROM pool_events
          WHERE kind <> 'seed' AND amount_wei IS NOT NULL
        `,
        sql`
          SELECT finished_at, status
          FROM sync_runs
          WHERE status = 'ok'
          ORDER BY finished_at DESC
          LIMIT 1
        `,
      ]);

    const latest = latestSnapRows[0] ?? null;
    const poolTotals = poolTotalsRows[0] ?? {
      total_sold: 0,
      net_eth_wei: '0',
      gross_eth_wei: '0',
    };
    const lastSync = syncRows[0]?.finished_at ?? latest?.captured_at ?? null;

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      lastSyncedAt: lastSync,
      kpis: latest
        ? {
            cap: Number(latest.cap),
            maxPeriodSeconds: Number(latest.max_period),
            claimed: Number(latest.claimed),
            held: Number(latest.held),
            staked: Number(latest.staked),
            unsafeStaked: Number(latest.unsafe_staked),
            taken: Number(latest.taken),
            powerForm: Number(latest.evolved_count),
            totalSold: Number(poolTotals.total_sold),
            netEthWei: String(poolTotals.net_eth_wei),
            grossEthWei: String(poolTotals.gross_eth_wei),
          }
        : null,
      history: historyRows.map((r) => ({
        ts: Number(r.ts),
        claimed: Number(r.claimed),
        held: Number(r.held),
        staked: Number(r.staked),
        unsafeStaked: Number(r.unsafe_staked),
        taken: Number(r.taken),
        powerForm: Number(r.power_form),
      })),
      speciesSnapshot: Array.isArray(latest?.species_json) ? latest.species_json : [],
      speciesCatalog: speciesMetaRows.map((r) => ({
        beastId: Number(r.beast_id),
        name: String(r.name),
        type: String(r.type),
        tier: Number(r.tier),
        activeCount: Number(r.active_count),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}