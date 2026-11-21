import { API_ENDPOINTS, CONTRACTS, LOOT_DUNGEON, getActivePools } from './config.ts';
import { getDb } from './db.ts';

type BeastStatus =
  | 'staked'
  | 'sold_regular'
  | 'sold_power_form'
  | 'held_power_form'
  | 'held_regular';

interface TransformationResponse {
  dungeon: string;
  cap: number;
  maxPeriod: number;
  totals: {
    claimed: number;
    held: number;
    staked: number;
    unsafeStaked: number;
    mega?: number;
    taken: number;
    evolved?: number;
  };
  species: unknown[];
}

interface RawBeast {
  tokenId: string;
  beastId: number;
  name: string;
  type: string;
  tier: number;
  prefixName?: string | null;
  suffixName?: string | null;
  level: number;
  health: number;
  power: number;
  projectedRank?: number | null;
  adventurersKilled?: number;
  visualEffects?: number;
  cardGrade?: number | null;
  cardCondition?: Record<string, unknown> | null;
  mintedAtBlock: number;
  mintedAtMinute: number;
}

interface BeastsPageResponse {
  items: RawBeast[];
  total: number;
  nextCursor: string | null;
}

interface RawPoolEvent {
  block: number;
  tx: number;
  time: number;
  kind: string;
  spotPrice: string;
  delta?: string | null;
  fee?: string | null;
  protocolFee?: string | null;
  amount?: string | null;
  nftCount?: number | null;
  transactionHash?: string | null;
}

export interface SyncSummary {
  runId: number;
  durationMs: number;
  snapshotCaptured: boolean;
  beastsSynced: number;
  stakedCount: number;
  vaultCount: number;
  statusChanges: number;
  poolEventsUpserted: number;
  activePools: number;
}

const REQUEST_TIMEOUT_MS = 20_000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 400;
const BATCH_SIZE = 250;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllBeastPages(extraParams: Record<string, string> = {}): Promise<RawBeast[]> {
  const results: RawBeast[] = [];
  let cursor: string | null = null;
  const seenCursors = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      beast_id_gte: String(LOOT_DUNGEON.beastIdMin),
      beast_id_lte: String(LOOT_DUNGEON.beastIdMax),
      genesis: 'false',
      limit: String(PAGE_LIMIT),
      ...extraParams,
    });
    if (cursor) {
      params.set('cursor', cursor);
    }

    const url = `${API_ENDPOINTS.collectablesBase}/collections/beasts/tokens?${params.toString()}`;
    const data = await fetchJson<BeastsPageResponse>(url);

    if (Array.isArray(data.items) && data.items.length > 0) {
      results.push(...data.items);
    }

    if (!data.nextCursor || seenCursors.has(data.nextCursor) || data.items.length === 0) {
      break;
    }
    seenCursors.add(data.nextCursor);
    cursor = data.nextCursor;
  }

  return results;
}

function classifyBeast(
  tokenId: string,
  visualEffects: number,
  stakedIds: Set<string>,
  vaultIds: Set<string>,
): BeastStatus {
  if (stakedIds.has(tokenId)) return 'staked';

  const isPowerForm = visualEffects === LOOT_DUNGEON.powerFormVisualEffects;
  if (vaultIds.has(tokenId)) {
    return isPowerForm ? 'sold_power_form' : 'sold_regular';
  }
  return isPowerForm ? 'held_power_form' : 'held_regular';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function syncTransformationSnapshot() {
  const sql = getDb();
  const url = `${API_ENDPOINTS.v2Base}/loot/transformation?dungeon=${CONTRACTS.dungeon}`;
  const data = await fetchJson<TransformationResponse>(url);

  await sql`
    INSERT INTO transformation_snapshots (
      dungeon_address,
      cap,
      max_period,
      claimed,
      held,
      staked,
      unsafe_staked,
      taken,
      power_form_count,
      evolved_count,
      totals_json,
      species_json
    )
    VALUES (
      ${data.dungeon.toLowerCase()},
      ${data.cap},
      ${data.maxPeriod},
      ${data.totals.claimed ?? 0},
      ${data.totals.held ?? 0},
      ${data.totals.staked ?? 0},
      ${data.totals.unsafeStaked ?? 0},
      ${data.totals.taken ?? 0},
      ${data.totals.mega ?? data.totals.evolved ?? 0},
      ${data.totals.evolved ?? data.totals.mega ?? 0},
      ${JSON.stringify(data.totals)}::jsonb,
      ${JSON.stringify(data.species)}::jsonb
    )
  `;
}

async function syncPoolEvents(): Promise<{ upserted: number; activePools: number }> {
  const activePools = getActivePools();
  if (activePools.length === 0) {
    return { upserted: 0, activePools: 0 };
  }

  const sql = getDb();
  const poolByAddress = new Map(activePools.map((p) => [p.address, p]));
  const pairsParam = activePools.map((p) => p.address).join(',');
  const url = `${API_ENDPOINTS.collectablesBase}/pools/history?pairs=${pairsParam}`;

  const raw = await fetchJson<Record<string, unknown>>(url);
  const pairsObj = (
    raw && typeof raw === 'object' && 'pairs' in raw && raw.pairs && typeof raw.pairs === 'object'
      ? raw.pairs
      : raw
  ) as Record<string, RawPoolEvent[]>;

  const rows: Array<{
    poolAddress: string;
    txHash: string;
    tx: number;
    tier: number;
    form: string;
    block: number;
    eventTime: number;
    kind: string;
    spotPriceWei: string;
    delta: string | null;
    amountWei: string | null;
    nftCount: number | null;
    protocolFeeWei: string | null;
    feeWei: string | null;
  }> = [];

  for (const [addrKey, events] of Object.entries(pairsObj)) {
    const pool = poolByAddress.get(addrKey.toLowerCase());
    if (!pool || !Array.isArray(events)) continue;

    for (const ev of events) {
      rows.push({
        poolAddress: pool.address,
        // Seed events have transactionHash: null; normalize to 'seed' for non-null PK
        txHash: ev.transactionHash ? ev.transactionHash.toLowerCase() : 'seed',
        tx: ev.tx,
        tier: pool.tier,
        form: pool.form,
        block: ev.block,
        eventTime: ev.time,
        kind: ev.kind,
        spotPriceWei: ev.spotPrice,
        delta: ev.delta ?? null,
        amountWei: ev.amount ?? null,
        nftCount: ev.nftCount ?? null,
        protocolFeeWei: ev.protocolFee ?? null,
        feeWei: ev.fee ?? null,
      });
    }
  }

  for (const batch of chunk(rows, BATCH_SIZE)) {
    await sql.query(
      `
      INSERT INTO pool_events (
        pool_address, transaction_hash, tx, tier, form, block, event_time,
        kind, spot_price_wei, delta, amount_wei, nft_count, protocol_fee_wei, fee_wei
      )
      SELECT *
      FROM UNNEST(
        $1::text[], $2::text[], $3::int[], $4::smallint[], $5::text[],
        $6::bigint[], $7::bigint[], $8::text[], $9::numeric[], $10::numeric[],
        $11::numeric[], $12::int[], $13::numeric[], $14::numeric[]
      )
      ON CONFLICT (pool_address, transaction_hash, tx)
      DO UPDATE SET
        tier = EXCLUDED.tier,
        form = EXCLUDED.form,
        spot_price_wei = EXCLUDED.spot_price_wei,
        amount_wei = EXCLUDED.amount_wei,
        nft_count = EXCLUDED.nft_count
      `,
      [
        batch.map((r) => r.poolAddress),
        batch.map((r) => r.txHash),
        batch.map((r) => r.tx),
        batch.map((r) => r.tier),
        batch.map((r) => r.form),
        batch.map((r) => r.block),
        batch.map((r) => r.eventTime),
        batch.map((r) => r.kind),
        batch.map((r) => r.spotPriceWei),
        batch.map((r) => r.delta),
        batch.map((r) => r.amountWei),
        batch.map((r) => r.nftCount),
        batch.map((r) => r.protocolFeeWei),
        batch.map((r) => r.feeWei),
      ],
    );
  }

  return { upserted: rows.length, activePools: activePools.length };
}

async function syncBeastsAndStatuses() {
  const sql = getDb();

  // Fetch full Loot Dungeon catalog + both ownership passes concurrently
  const [allBeasts, stakedBeasts, vaultBeasts, existingRows] = await Promise.all([
    fetchAllBeastPages({ sort: 'minted_at_block', order: 'desc' }),
    fetchAllBeastPages({ owner: CONTRACTS.dungeon }),
    fetchAllBeastPages({ owner: CONTRACTS.buybackVault }),
    sql`SELECT token_id, status FROM beasts`,
  ]);

  const stakedIds = new Set(stakedBeasts.map((b) => String(b.tokenId)));
  const vaultIds = new Set(vaultBeasts.map((b) => String(b.tokenId)));
  const existingStatus = new Map<string, string>(
    existingRows.map((r) => [String(r.token_id), String(r.status)]),
  );

  // Deduplicate by tokenId in case pagination shifts while mints happen mid-sync
  const byTokenId = new Map<string, RawBeast>();
  for (const b of allBeasts) {
    byTokenId.set(String(b.tokenId), b);
  }

  const normalized = Array.from(byTokenId.values()).map((b) => {
    const tokenId = String(b.tokenId);
    const visualEffects = b.visualEffects ?? 0;
    const status = classifyBeast(tokenId, visualEffects, stakedIds, vaultIds);
    return {
      tokenId,
      beastId: b.beastId,
      name: b.name,
      type: b.type,
      tier: b.tier,
      prefixName: b.prefixName ?? null,
      suffixName: b.suffixName ?? null,
      level: b.level,
      health: b.health,
      power: b.power,
      projectedRank: b.projectedRank ?? null,
      adventurersKilled: b.adventurersKilled ?? 0,
      visualEffects,
      cardGrade: b.cardGrade ?? null,
      cardConditionText: b.cardCondition ? JSON.stringify(b.cardCondition) : null,
      mintedAtBlock: b.mintedAtBlock,
      mintedAtMinute: b.mintedAtMinute,
      status,
    };
  });

  const statusChanges: Array<{ tokenId: string; oldStatus: string; newStatus: string }> = [];
  for (const b of normalized) {
    const prev = existingStatus.get(b.tokenId);
    if (prev && prev !== b.status) {
      statusChanges.push({
        tokenId: b.tokenId,
        oldStatus: prev,
        newStatus: b.status,
      });
    }
  }

  for (const batch of chunk(normalized, BATCH_SIZE)) {
    await sql.query(
      `
      INSERT INTO beasts (
        token_id, beast_id, name, type, tier, prefix_name, suffix_name,
        level, health, power, projected_rank, adventurers_killed,
        visual_effects, card_grade, card_condition,
        minted_at_block, minted_at_minute, status, updated_at
      )
      SELECT
        t.token_id, t.beast_id, t.name, t.type, t.tier, t.prefix_name, t.suffix_name,
        t.level, t.health, t.power, t.projected_rank, t.adventurers_killed,
        t.visual_effects, t.card_grade, t.card_condition_text::jsonb,
        t.minted_at_block, t.minted_at_minute, t.status, NOW()
      FROM UNNEST(
        $1::text[], $2::int[], $3::text[], $4::text[], $5::smallint[],
        $6::text[], $7::text[], $8::int[], $9::int[], $10::int[],
        $11::int[], $12::int[], $13::int[], $14::smallint[], $15::text[],
        $16::bigint[], $17::bigint[], $18::text[]
      ) AS t(
        token_id, beast_id, name, type, tier, prefix_name, suffix_name,
        level, health, power, projected_rank, adventurers_killed,
        visual_effects, card_grade, card_condition_text,
        minted_at_block, minted_at_minute, status
      )
      ON CONFLICT (token_id)
      DO UPDATE SET
        level = EXCLUDED.level,
        health = EXCLUDED.health,
        power = EXCLUDED.power,
        projected_rank = EXCLUDED.projected_rank,
        adventurers_killed = EXCLUDED.adventurers_killed,
        visual_effects = EXCLUDED.visual_effects,
        card_grade = EXCLUDED.card_grade,
        card_condition = EXCLUDED.card_condition,
        status = EXCLUDED.status,
        updated_at = NOW()
      `,
      [
        batch.map((b) => b.tokenId),
        batch.map((b) => b.beastId),
        batch.map((b) => b.name),
        batch.map((b) => b.type),
        batch.map((b) => b.tier),
        batch.map((b) => b.prefixName),
        batch.map((b) => b.suffixName),
        batch.map((b) => b.level),
        batch.map((b) => b.health),
        batch.map((b) => b.power),
        batch.map((b) => b.projectedRank),
        batch.map((b) => b.adventurersKilled),
        batch.map((b) => b.visualEffects),
        batch.map((b) => b.cardGrade),
        batch.map((b) => b.cardConditionText),
        batch.map((b) => b.mintedAtBlock),
        batch.map((b) => b.mintedAtMinute),
        batch.map((b) => b.status),
      ],
    );
  }

  for (const batch of chunk(statusChanges, BATCH_SIZE)) {
    await sql.query(
      `
      INSERT INTO beast_status_changes (token_id, old_status, new_status)
      SELECT *
      FROM UNNEST($1::text[], $2::text[], $3::text[])
      `,
      [
        batch.map((c) => c.tokenId),
        batch.map((c) => c.oldStatus),
        batch.map((c) => c.newStatus),
      ],
    );
  }

  return {
    beastsSynced: normalized.length,
    stakedCount: stakedIds.size,
    vaultCount: vaultIds.size,
    statusChanges: statusChanges.length,
  };
}

export async function runFullSync(): Promise<SyncSummary> {
  const startedAt = Date.now();
  const sql = getDb();

  const [runRow] = await sql`
    INSERT INTO sync_runs (status)
    VALUES ('running')
    RETURNING id
  `;
  const runId = Number(runRow.id);

  try {
    // Capture perishable snapshot first, then sync pools & beasts
    await syncTransformationSnapshot();
    const [poolStats, beastStats] = await Promise.all([
      syncPoolEvents(),
      syncBeastsAndStatuses(),
    ]);

    await sql`
      UPDATE sync_runs
      SET
        finished_at = NOW(),
        status = 'ok',
        beasts_synced = ${beastStats.beastsSynced},
        status_changes = ${beastStats.statusChanges},
        pool_events_upserted = ${poolStats.upserted}
      WHERE id = ${runId}
    `;

    return {
      runId,
      durationMs: Date.now() - startedAt,
      snapshotCaptured: true,
      beastsSynced: beastStats.beastsSynced,
      stakedCount: beastStats.stakedCount,
      vaultCount: beastStats.vaultCount,
      statusChanges: beastStats.statusChanges,
      poolEventsUpserted: poolStats.upserted,
      activePools: poolStats.activePools,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      UPDATE sync_runs
      SET
        finished_at = NOW(),
        status = 'error',
        error_message = ${message.slice(0, 1000)}
      WHERE id = ${runId}
    `;
    throw err;
  }
}