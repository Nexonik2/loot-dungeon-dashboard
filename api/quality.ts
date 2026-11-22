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

    const [statusTotals, gradeMatrix, tierMatrix, summaryByStatus] = await Promise.all([
      sql`
        SELECT status, COUNT(*)::int AS count
        FROM beasts
        WHERE status <> 'superseded'
        GROUP BY status
        ORDER BY status ASC
      `,
      sql`
        SELECT
          card_grade::int AS card_grade,
          status,
          COUNT(*)::int AS count
        FROM beasts
        WHERE status <> 'superseded' AND card_grade IS NOT NULL
        GROUP BY card_grade, status
        ORDER BY card_grade ASC, status ASC
      `,
      sql`
        SELECT
          tier::int AS tier,
          status,
          COUNT(*)::int AS count
        FROM beasts
        WHERE status <> 'superseded'
        GROUP BY tier, status
        ORDER BY tier ASC, status ASC
      `,
      sql`
        SELECT
          status,
          ROUND(AVG(card_grade)::numeric, 2)::float AS avg_grade,
          ROUND(AVG(level)::numeric, 1)::float AS avg_level,
          ROUND(AVG(power)::numeric, 1)::float AS avg_power,
          COUNT(*)::int AS count
        FROM beasts
        WHERE status <> 'superseded'
        GROUP BY status
        ORDER BY status ASC
      `,
    ]);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      statusTotals: statusTotals.map((r) => ({
        status: String(r.status),
        count: Number(r.count),
      })),
      gradeMatrix: gradeMatrix.map((r) => ({
        cardGrade: Number(r.card_grade),
        status: String(r.status),
        count: Number(r.count),
      })),
      tierMatrix: tierMatrix.map((r) => ({
        tier: Number(r.tier),
        status: String(r.status),
        count: Number(r.count),
      })),
      summaryByStatus: summaryByStatus.map((r) => ({
        status: String(r.status),
        count: Number(r.count),
        avgGrade: r.avg_grade !== null ? Number(r.avg_grade) : null,
        avgLevel: r.avg_level !== null ? Number(r.avg_level) : null,
        avgPower: r.avg_power !== null ? Number(r.avg_power) : null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}