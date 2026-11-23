import { getDb } from '../server/db.js';

interface ApiRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

function getParam(
  query: ApiRequest['query'],
  key: string,
): string | undefined {
  const val = query?.[key];
  return Array.isArray(val) ? val[0] : val;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const beastIdRaw = getParam(req.query, 'beastId');
    const tierRaw = getParam(req.query, 'tier');
    const statusParam = getParam(req.query, 'status') || 'all';
    const midiOnly = getParam(req.query, 'midi') === '1';
    const sort = getParam(req.query, 'sort') || 'recent';
    const page = Math.max(1, Number(getParam(req.query, 'page') || 1) || 1);
    const limit = Math.min(50, Math.max(10, Number(getParam(req.query, 'limit') || 20) || 20));

    const statusFilter =
      statusParam === 'held'
        ? 'held_power_form'
        : statusParam === 'sold'
          ? 'sold_power_form'
          : null;

    // Mode 1: Lazy-loaded individual evolved Mega Beasts for an expanded species/tier
    if (beastIdRaw || tierRaw) {
      const beastId = beastIdRaw ? Number(beastIdRaw) : null;
      const tier = tierRaw ? Number(tierRaw) : null;
      const offset = (page - 1) * limit;

      const [countRows, items] = await Promise.all([
        sql`
          SELECT COUNT(*)::int AS total
          FROM beasts
          WHERE status IN ('held_power_form', 'sold_power_form')
            AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
            AND (${beastId}::int IS NULL OR beast_id = ${beastId})
            AND (${tier}::smallint IS NULL OR tier = ${tier})
            AND (${midiOnly}::boolean = FALSE OR (visual_effects & 1) <> 0)
        `,
        sql`
          SELECT
            token_id,
            beast_id,
            name,
            type,
            tier::int AS tier,
            prefix_name,
            suffix_name,
            level,
            health,
            power,
            projected_rank,
            card_grade::int AS card_grade,
            visual_effects,
            minted_at_minute::bigint AS minted_at_minute,
            status
          FROM beasts
          WHERE status IN ('held_power_form', 'sold_power_form')
            AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
            AND (${beastId}::int IS NULL OR beast_id = ${beastId})
            AND (${tier}::smallint IS NULL OR tier = ${tier})
            AND (${midiOnly}::boolean = FALSE OR (visual_effects & 1) <> 0)
          ORDER BY
            CASE WHEN ${sort} = 'beast_asc' THEN LOWER(COALESCE(prefix_name, '') || ' ' || COALESCE(suffix_name, '') || ' ' || name) END ASC,
            CASE WHEN ${sort} = 'beast_desc' THEN LOWER(COALESCE(prefix_name, '') || ' ' || COALESCE(suffix_name, '') || ' ' || name) END DESC,
            CASE WHEN ${sort} = 'owner_asc' THEN status END ASC,
            CASE WHEN ${sort} = 'owner_desc' THEN status END DESC,
            CASE WHEN ${sort} = 'level_asc' THEN level END ASC,
            CASE WHEN ${sort} = 'level_desc' THEN level END DESC,
            CASE WHEN ${sort} = 'health_asc' THEN health END ASC,
            CASE WHEN ${sort} = 'health_desc' THEN health END DESC,
            CASE WHEN ${sort} = 'power_asc' THEN power END ASC,
            CASE WHEN ${sort} = 'power_desc' THEN power END DESC,
            CASE WHEN ${sort} = 'grade_asc' THEN COALESCE(card_grade, 99) END ASC,
            CASE WHEN ${sort} = 'grade_desc' THEN COALESCE(card_grade, 0) END DESC,
            CASE WHEN ${sort} = 'evolved_asc' THEN minted_at_minute END ASC,
            CASE WHEN ${sort} = 'evolved_desc' THEN minted_at_minute END DESC,
            minted_at_minute DESC,
            token_id ASC
          LIMIT ${limit}
          OFFSET ${offset}
        `,
      ]);

      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json({
        mode: 'detail',
        total: Number(countRows[0]?.total ?? 0),
        page,
        limit,
        items: items.map((r) => {
          const status = String(r.status) as 'held_power_form' | 'sold_power_form';
          return {
            tokenId: String(r.token_id),
            beastId: Number(r.beast_id),
            name: String(r.name),
            type: String(r.type),
            tier: Number(r.tier),
            prefixName: r.prefix_name ? String(r.prefix_name) : null,
            suffixName: r.suffix_name ? String(r.suffix_name) : null,
            level: Number(r.level),
            health: Number(r.health),
            power: Number(r.power),
            projectedRank: r.projected_rank !== null ? Number(r.projected_rank) : null,
            cardGrade: r.card_grade !== null ? Number(r.card_grade) : null,
            visualEffects: Number(r.visual_effects),
            mintedAtMinute: Number(r.minted_at_minute),
            status,
            soldToBuyback: status === 'sold_power_form',
          };
        }),
      });
    }

    // Mode 2: Compact per-species Mega rollup (Held vs. Sold to Buyback)
    const speciesRows = await sql`
      SELECT
        beast_id,
        MIN(name) AS name,
        MIN(type) AS type,
        MIN(tier)::int AS tier,
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE status = 'held_power_form')::int AS held_count,
        COUNT(*) FILTER (WHERE status = 'sold_power_form')::int AS sold_count,
        COUNT(*) FILTER (WHERE (visual_effects & 1) <> 0)::int AS special_vfx_count,
        ROUND(AVG(card_grade)::numeric, 2)::float AS avg_grade
      FROM beasts
      WHERE status IN ('held_power_form', 'sold_power_form')
      GROUP BY beast_id
      ORDER BY COUNT(*) DESC, MIN(tier) ASC, beast_id ASC
    `;

    const species = speciesRows.map((r) => ({
      beastId: Number(r.beast_id),
      name: String(r.name),
      type: String(r.type),
      tier: Number(r.tier),
      totalCount: Number(r.total_count),
      heldCount: Number(r.held_count),
      soldCount: Number(r.sold_count),
      specialVfxCount: Number(r.special_vfx_count),
      avgGrade: r.avg_grade !== null ? Number(r.avg_grade) : null,
    }));

    const totalMegas = species.reduce((s, r) => s + r.totalCount, 0);
    const heldTotal = species.reduce((s, r) => s + r.heldCount, 0);
    const soldTotal = species.reduce((s, r) => s + r.soldCount, 0);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      mode: 'summary',
      totalMegas,
      heldTotal,
      soldTotal,
      species,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}