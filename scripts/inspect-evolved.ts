import { config } from 'dotenv';
import { API_ENDPOINTS, LOOT_DUNGEON } from '../server/config.js';
import { getDb } from '../server/db.js';

config({ path: '.env.local', override: true });

async function main() {
  const sql = getDb();

  // 1. Check all distinct visual_effects values (tests bitmask hypothesis)
  const vfx = await sql`
    SELECT visual_effects, COUNT(*)::int AS cnt
    FROM beasts
    GROUP BY visual_effects
    ORDER BY visual_effects
  `;
  console.log('\n=== visual_effects breakdown ===');
  console.table(vfx);

  // 2. Check if superseded pre-evolution tokens are owned by 0x0 (burned)
  const zeroUrl =
    `${API_ENDPOINTS.collectablesBase}/collections/beasts/tokens` +
    `?beast_id_gte=${LOOT_DUNGEON.beastIdMin}&beast_id_lte=${LOOT_DUNGEON.beastIdMax}` +
    `&genesis=false&owner=0x0&limit=3`;
  const zeroRes = (await fetch(zeroUrl).then((r) => r.json())) as {
    total: number;
    items: Array<{ tokenId: string; name: string; visualEffects: number; owner?: string }>;
  };
  console.log('\n=== Burn address (owner=0x0) ===');
  console.log('total:', zeroRes.total, 'sample:', zeroRes.items.slice(0, 2));

  // 3. Inspect sample duplicate name triples (check if pairs have vfx 0 + vfx 2 vs 0 + 0)
  const pairTypes = await sql`
    WITH dupes AS (
      SELECT beast_id, prefix_name, suffix_name,
             COUNT(*)::int AS cnt,
             ARRAY_AGG(visual_effects ORDER BY visual_effects) AS vfx_set
      FROM beasts
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    )
    SELECT vfx_set, COUNT(*)::int AS groups
    FROM dupes
    GROUP BY vfx_set
    ORDER BY groups DESC
  `;
  console.log('\n=== Duplicate name-triple vfx patterns ===');
  console.table(pairTypes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});