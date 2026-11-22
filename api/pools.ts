import { getDb } from '../server/db.js';
import { BUYBACK_POOLS } from '../server/config.js';

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

    const [poolSummaries, spotHistory, recentSales] = await Promise.all([
      sql`
        SELECT
          pool_address,
          tier::int AS tier,
          form,
          COUNT(*) FILTER (WHERE kind <> 'seed')::int AS sale_txs,
          COALESCE(SUM(nft_count) FILTER (WHERE kind <> 'seed'), 0)::int AS nfts_sold,
          COALESCE(SUM(amount_wei) FILTER (WHERE kind <> 'seed'), 0)::text AS net_eth_wei,
          COALESCE(SUM(amount_wei / 0.9025) FILTER (WHERE kind <> 'seed'), 0)::numeric(78, 0)::text AS gross_eth_wei,
          (ARRAY_AGG(spot_price_wei ORDER BY block ASC, tx ASC))[1]::text AS seed_spot_wei,
          (ARRAY_AGG(spot_price_wei ORDER BY block DESC, tx DESC))[1]::text AS latest_spot_wei,
          MAX(event_time) FILTER (WHERE kind <> 'seed')::bigint AS last_sale_time
        FROM pool_events
        GROUP BY pool_address, tier, form
      `,
      sql`
        SELECT
          pool_address,
          tier::int AS tier,
          form,
          event_time::bigint AS ts,
          kind,
          spot_price_wei::text AS spot_price_wei,
          amount_wei::text AS amount_wei,
          nft_count
        FROM pool_events
        ORDER BY event_time ASC, block ASC, tx ASC
      `,
      sql`
        SELECT
          pool_address,
          transaction_hash,
          tier::int AS tier,
          form,
          block::bigint AS block,
          event_time::bigint AS ts,
          spot_price_wei::text AS spot_price_wei,
          amount_wei::text AS amount_wei,
          nft_count
        FROM pool_events
        WHERE kind <> 'seed'
        ORDER BY event_time DESC, block DESC, tx DESC
        LIMIT 25
      `,
    ]);

    const summaryByAddr = new Map(
      poolSummaries.map((r) => [String(r.pool_address).toLowerCase(), r]),
    );

    const pools = BUYBACK_POOLS.map((cfg) => {
      const addr = cfg.address?.toLowerCase() ?? null;
      const stats = addr ? summaryByAddr.get(addr) : undefined;
      return {
        tier: cfg.tier,
        form: cfg.form,
        address: addr,
        saleTxs: stats ? Number(stats.sale_txs) : 0,
        nftsSold: stats ? Number(stats.nfts_sold) : 0,
        netEthWei: stats ? String(stats.net_eth_wei) : '0',
        grossEthWei: stats ? String(stats.gross_eth_wei) : '0',
        seedSpotWei: stats?.seed_spot_wei ? String(stats.seed_spot_wei) : null,
        latestSpotWei: stats?.latest_spot_wei ? String(stats.latest_spot_wei) : null,
        lastSaleTime: stats?.last_sale_time ? Number(stats.last_sale_time) : null,
      };
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      pools,
      spotHistory: spotHistory.map((r) => ({
        poolAddress: String(r.pool_address).toLowerCase(),
        tier: Number(r.tier),
        form: String(r.form) as 'regular' | 'power_form',
        ts: Number(r.ts),
        kind: String(r.kind),
        spotPriceWei: String(r.spot_price_wei),
        amountWei: r.amount_wei ? String(r.amount_wei) : null,
        nftCount: r.nft_count !== null ? Number(r.nft_count) : null,
      })),
      recentSales: recentSales.map((r) => ({
        poolAddress: String(r.pool_address).toLowerCase(),
        txHash: String(r.transaction_hash),
        tier: Number(r.tier),
        form: String(r.form) as 'regular' | 'power_form',
        block: Number(r.block),
        ts: Number(r.ts),
        spotPriceWei: String(r.spot_price_wei),
        amountWei: r.amount_wei ? String(r.amount_wei) : null,
        nftCount: r.nft_count !== null ? Number(r.nft_count) : 1,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}