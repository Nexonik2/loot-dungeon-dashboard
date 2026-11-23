import { getDb } from '../server/db.ts';

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
    const typeFilter = getParam(req.query, 'type') || null;
    const minGradeRaw = getParam(req.query, 'minGrade');
    const sort = getParam(req.query, 'sort') || 'grade_desc';
    const page = Math.max(1, Number(getParam(req.query, 'page') || 1) || 1);
    const limit = Math.min(50, Math.max(10, Number(getParam(req.query, 'limit') || 25) || 25));

    // Mode 1: Lazy-loaded detail list when expanding a specific species or tier
    if (beastIdRaw || tierRaw) {
      const beastId = beastIdRaw ? Number(beastIdRaw) : null;
      const tier = tierRaw ? Number(tierRaw) : null;
      const minGrade = minGradeRaw ? Number(minGradeRaw) : null;
      const offset = (page - 1) * limit;

      const [countRows, items] = await Promise.all([
        sql`
          SELECT COUNT(*)::int AS total
          FROM beasts
          WHERE status = 'staked'
            AND (${beastId}::int IS NULL OR beast_id = ${beastId})
            AND (${tier}::smallint IS NULL OR tier = ${tier})
            AND (${typeFilter}::text IS NULL OR type = ${typeFilter})
            AND (${minGrade}::smallint IS NULL OR card_grade >= ${minGrade})
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
            minted_at_minute::bigint AS minted_at_minute
          FROM beasts
          WHERE status = 'staked'
            AND (${beastId}::int IS NULL OR beast_id = ${beastId})
            AND (${tier}::smallint IS NULL OR tier = ${tier})
            AND (${typeFilter}::text IS NULL OR type = ${typeFilter})
            AND (${minGrade}::smallint IS NULL OR card_grade >= ${minGrade})
          ORDER BY
            CASE WHEN ${sort} = 'beast_asc' THEN LOWER(COALESCE(prefix_name, '') || ' ' || COALESCE(suffix_name, '') || ' ' || name) END ASC,
            CASE WHEN ${sort} = 'beast_desc' THEN LOWER(COALESCE(prefix_name, '') || ' ' || COALESCE(suffix_name, '') || ' ' || name) END DESC,
            CASE WHEN ${sort} = 'level_asc' THEN level END ASC,
            CASE WHEN ${sort} = 'level_desc' THEN level END DESC,
            CASE WHEN ${sort} = 'health_asc' THEN health END ASC,
            CASE WHEN ${sort} = 'health_desc' THEN health END DESC,
            CASE WHEN ${sort} = 'power_asc' THEN power END ASC,
            CASE WHEN ${sort} = 'power_desc' THEN power END DESC,
            CASE WHEN ${sort} = 'grade_asc' THEN COALESCE(card_grade, 99) END ASC,
            CASE WHEN ${sort} = 'grade_desc' THEN COALESCE(card_grade, 0) END DESC,
            CASE WHEN ${sort} = 'caught_asc' THEN minted_at_minute END ASC,
            CASE WHEN ${sort} = 'caught_desc' THEN minted_at_minute END DESC,
            level ASC,
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
        items: items.map((r) => ({
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
        })),
      });
    }

    // Mode 2: Compact Tier -> Species high-level summary
    const [tierRows, speciesRows] = await Promise.all([
      sql`
        SELECT
          tier::int AS tier,
          COUNT(*)::int AS staked_count,
          COUNT(*) FILTER (WHERE card_grade >= 9)::int AS high_grade_count,
          COUNT(*) FILTER (WHERE card_grade = 10)::int AS grade10_count,
          ROUND(AVG(card_grade)::numeric, 2)::float AS avg_grade,
          MIN(level)::int AS min_level,
          ROUND(AVG(level)::numeric, 1)::float AS avg_level,
          MIN(health)::int AS min_health,
          COUNT(*) FILTER (WHERE type = 'Magic')::int AS magic_count,
          COUNT(*) FILTER (WHERE type = 'Hunter')::int AS hunter_count,
          COUNT(*) FILTER (WHERE type = 'Brute')::int AS brute_count
        FROM beasts
        WHERE status = 'staked'
        GROUP BY tier
        ORDER BY tier ASC
      `,
      sql`
        SELECT
          beast_id,
          MIN(name) AS name,
          MIN(type) AS type,
          MIN(tier)::int AS tier,
          COUNT(*)::int AS staked_count,
          COUNT(*) FILTER (WHERE card_grade >= 9)::int AS high_grade_count,
          COUNT(*) FILTER (WHERE card_grade = 10)::int AS grade10_count,
          ROUND(AVG(card_grade)::numeric, 2)::float AS avg_grade,
          MIN(level)::int AS min_level,
          ROUND(AVG(level)::numeric, 1)::float AS avg_level,
          MIN(health)::int AS min_health
        FROM beasts
        WHERE status = 'staked'
        GROUP BY beast_id
        ORDER BY MIN(tier) ASC, COUNT(*) DESC, beast_id ASC
      `,
    ]);

    const totalStaked = tierRows.reduce((s, r) => s + Number(r.staked_count), 0);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      mode: 'summary',
      totalStaked,
      tiers: tierRows.map((r) => ({
        tier: Number(r.tier),
        stakedCount: Number(r.staked_count),
        highGradeCount: Number(r.high_grade_count),
        grade10Count: Number(r.grade10_count),
        avgGrade: r.avg_grade !== null ? Number(r.avg_grade) : null,
        minLevel: Number(r.min_level),
        avgLevel: r.avg_level !== null ? Number(r.avg_level) : null,
        minHealth: Number(r.min_health),
        byType: {
          Magic: Number(r.magic_count),
          Hunter: Number(r.hunter_count),
          Brute: Number(r.brute_count),
        },
      })),
      species: speciesRows.map((r) => ({
        beastId: Number(r.beast_id),
        name: String(r.name),
        type: String(r.type),
        tier: Number(r.tier),
        stakedCount: Number(r.staked_count),
        highGradeCount: Number(r.high_grade_count),
        grade10Count: Number(r.grade10_count),
        avgGrade: r.avg_grade !== null ? Number(r.avg_grade) : null,
        minLevel: Number(r.min_level),
        avgLevel: r.avg_level !== null ? Number(r.avg_level) : null,
        minHealth: Number(r.min_health),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}