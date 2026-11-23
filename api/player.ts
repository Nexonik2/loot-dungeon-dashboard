import { API_ENDPOINTS, CONTRACTS, LOOT_DUNGEON } from '../server/config.js';
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

interface UpstreamBeastToken {
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
  visualEffects?: number;
  cardGrade?: number | null;
  mintedAtMinute?: number;
}

interface UpstreamLootBeast {
  tokenId?: string | number;
  beastId?: number;
  speciesId?: number;
  level?: number;
  health?: number;
  mega?: boolean;
  staked?: boolean;
  stakedAt?: number | string | null;
  transformsAt?: number | string | null;
}

interface DbBeastEnrichment {
  tokenId: string;
  beastId: number;
  name: string;
  type: string;
  tier: number;
  prefixName: string | null;
  suffixName: string | null;
  power: number;
  cardGrade: number | null;
  visualEffects: number;
  mintedAtMinute: number | null;
}

interface SpeciesFallback {
  name: string;
  type: string;
  tier: number;
}

function normalizeStarknetAddress(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(trimmed)) return null;
  return `0x${trimmed.slice(2).padStart(64, '0')}`;
}

function toFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawAddress = Array.isArray(req.query?.address)
    ? req.query?.address[0]
    : req.query?.address;

  if (!rawAddress) {
    return res.status(400).json({ error: 'Missing required query param: address' });
  }

  const address = normalizeStarknetAddress(rawAddress);
  if (!address) {
    return res.status(400).json({
      error: 'Invalid Starknet wallet address (expected 0x followed by 1-64 hex characters)',
    });
  }

  try {
    const heldBeastsUrl =
      `${API_ENDPOINTS.collectablesBase}/collections/beasts/tokens` +
      `?beast_id_gte=${LOOT_DUNGEON.beastIdMin}` +
      `&beast_id_lte=${LOOT_DUNGEON.beastIdMax}` +
      `&genesis=false&owner=${address}&limit=100`;

    const lootBeastsUrl =
      `${API_ENDPOINTS.v2Base}/loot/beasts?owner=${address}&dungeon=${CONTRACTS.dungeon}`;

    const lootKillsUrl =
      `${API_ENDPOINTS.v2Base}/loot/kills?owner=${address}&dungeon=${CONTRACTS.dungeon}`;

    const gamesUrl =
      `${API_ENDPOINTS.v2Base}/games` +
      `?game_core=${CONTRACTS.gameCore}&minter_id=4&owner=${address}&limit=100&offset=0`;

    const [heldRes, lootBeastsRes, lootKillsRes, gamesRes] = await Promise.all([
      fetchJsonSafe<{ items?: UpstreamBeastToken[]; total?: number }>(heldBeastsUrl),
      fetchJsonSafe<{
        beasts?: UpstreamLootBeast[];
        taken?: Array<Record<string, unknown>>;
      }>(lootBeastsUrl),
      fetchJsonSafe<{ kills?: Array<Record<string, unknown>> }>(lootKillsUrl),
      fetchJsonSafe<unknown>(gamesUrl),
    ]);

    const heldItems = (heldRes?.items ?? []).map((b) => {
      const vfx = Number(b.visualEffects ?? 0);
      return {
        tokenId: String(b.tokenId),
        beastId: Number(b.beastId),
        name: String(b.name),
        type: String(b.type),
        tier: Number(b.tier),
        prefixName: b.prefixName ?? null,
        suffixName: b.suffixName ?? null,
        level: Number(b.level),
        health: Number(b.health),
        power: Number(b.power),
        projectedRank: b.projectedRank ?? null,
        isPowerForm: (vfx & LOOT_DUNGEON.powerFormVisualEffects) !== 0,
        visualEffects: vfx,
        cardGrade: b.cardGrade ?? null,
        mintedAtMinute: b.mintedAtMinute ?? null,
      };
    });

    const lootBeasts = Array.isArray(lootBeastsRes?.beasts) ? lootBeastsRes.beasts : [];
    const takenBeasts = Array.isArray(lootBeastsRes?.taken) ? lootBeastsRes.taken : [];
    const kills = Array.isArray(lootKillsRes?.kills) ? lootKillsRes.kills : [];

    const rawStaked = lootBeasts.filter((b) => Boolean(b.staked) && b.tokenId !== undefined);
    const stakedTokenIds = rawStaked.map((b) => String(b.tokenId));

    // Read-only enrichment from Neon beasts table (zero writes) for names, power, MIDI, Card Grade
    const dbByToken = new Map<string, DbBeastEnrichment>();
    const speciesById = new Map<number, SpeciesFallback>();

    if (stakedTokenIds.length > 0) {
      try {
        const sql = getDb();
        const [tokenRows, speciesRows] = await Promise.all([
          sql`
            SELECT
              token_id,
              beast_id,
              name,
              type,
              tier::int AS tier,
              prefix_name,
              suffix_name,
              power,
              card_grade::int AS card_grade,
              visual_effects,
              minted_at_minute::bigint AS minted_at_minute
            FROM beasts
            WHERE token_id = ANY(${stakedTokenIds}::text[])
          `,
          sql`
            SELECT
              beast_id,
              MIN(name) AS name,
              MIN(type) AS type,
              MIN(tier)::int AS tier
            FROM beasts
            WHERE status <> 'superseded'
            GROUP BY beast_id
          `,
        ]);

        for (const r of tokenRows) {
          dbByToken.set(String(r.token_id), {
            tokenId: String(r.token_id),
            beastId: Number(r.beast_id),
            name: String(r.name),
            type: String(r.type),
            tier: Number(r.tier),
            prefixName: r.prefix_name ? String(r.prefix_name) : null,
            suffixName: r.suffix_name ? String(r.suffix_name) : null,
            power: Number(r.power),
            cardGrade: r.card_grade !== null ? Number(r.card_grade) : null,
            visualEffects: Number(r.visual_effects ?? 0),
            mintedAtMinute: r.minted_at_minute !== null ? Number(r.minted_at_minute) : null,
          });
        }

        for (const s of speciesRows) {
          speciesById.set(Number(s.beast_id), {
            name: String(s.name),
            type: String(s.type),
            tier: Number(s.tier),
          });
        }
      } catch {
        // Fallback cleanly to raw /loot/beasts fields if DB lookup fails
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const stakedBeasts = rawStaked.map((b) => {
      const tokenId = String(b.tokenId);
      const db = dbByToken.get(tokenId);
      const rawSpeciesId = Number(b.speciesId ?? (b.beastId ? b.beastId + 77 : 0));
      const speciesId = db?.beastId ?? rawSpeciesId;
      const fallback = speciesById.get(speciesId);
      const tier = db?.tier ?? fallback?.tier ?? 0;
      const level = Number(b.level ?? 0);
      const derivedPower = tier > 0 ? level * (6 - tier) : null;

      return {
        tokenId,
        beastId: speciesId,
        name: db?.name ?? fallback?.name ?? `Species #${speciesId}`,
        type: db?.type ?? fallback?.type ?? '-',
        tier,
        prefixName: db?.prefixName ?? null,
        suffixName: db?.suffixName ?? null,
        level,
        health: Number(b.health ?? 0),
        power: db?.power ?? derivedPower,
        cardGrade: db?.cardGrade ?? null,
        visualEffects: db?.visualEffects ?? 0,
        stakedAt: toFiniteNumber(b.stakedAt),
        transformsAt: toFiniteNumber(b.transformsAt),
        mintedAtMinute: db?.mintedAtMinute ?? null,
      };
    });

    const readyToEvolveCount = stakedBeasts.filter(
      (b) => b.transformsAt !== null && b.transformsAt <= nowSec,
    ).length;

    // Normalize /games response shape ({ data, total } | { games } | array)
    const gamesObj =
      gamesRes && typeof gamesRes === 'object' && !Array.isArray(gamesRes)
        ? (gamesRes as Record<string, unknown>)
        : null;

    const rawGames: Array<Record<string, unknown>> = Array.isArray(gamesRes)
      ? gamesRes
      : Array.isArray(gamesObj?.data)
        ? (gamesObj.data as Array<Record<string, unknown>>)
        : Array.isArray(gamesObj?.games)
          ? (gamesObj.games as Array<Record<string, unknown>>)
          : Array.isArray(gamesObj?.items)
            ? (gamesObj.items as Array<Record<string, unknown>>)
            : [];

    const runsMinted =
      typeof gamesObj?.total === 'number' && Number.isFinite(gamesObj.total)
        ? gamesObj.total
        : rawGames.length;

    const startedRuns = rawGames.filter(
      (g) =>
        Boolean(g.started) ||
        Boolean(g.gameOver) ||
        Boolean(g.settled) ||
        Number(g.actionCount ?? 0) > 0 ||
        Number(g.score ?? 0) > 0 ||
        Number(g.gold ?? 0) > 0 ||
        Number(g.xp ?? 0) > 0,
    ).length;

    const settledRuns = rawGames.filter(
      (g) => Boolean(g.settled) || Boolean(g.gameOver),
    ).length;

    const uniqueBags = new Set(
      [...kills, ...rawGames]
        .map((r) => r.bagId ?? (r.bag as Record<string, unknown> | undefined)?.id)
        .filter((v) => v !== undefined && v !== null)
        .map(String),
    );

    // Combined Grade & Tier counts across Held + currently Staked Beasts (deduped by tokenId)
    const gradeCounts: Record<number, number> = {};
    const tierCounts: Record<number, number> = {};
    let totalGradeSum = 0;
    let totalGradeN = 0;
    let heldGradeSum = 0;
    let heldGradeN = 0;
    let heldPowerForms = 0;
    const seenTokenIds = new Set<string>();

    for (const b of heldItems) {
      seenTokenIds.add(b.tokenId);
      if (b.isPowerForm) heldPowerForms += 1;
      if (b.tier > 0) tierCounts[b.tier] = (tierCounts[b.tier] ?? 0) + 1;
      if (b.cardGrade !== null) {
        gradeCounts[b.cardGrade] = (gradeCounts[b.cardGrade] ?? 0) + 1;
        totalGradeSum += b.cardGrade;
        totalGradeN += 1;
        heldGradeSum += b.cardGrade;
        heldGradeN += 1;
      }
    }

    for (const b of stakedBeasts) {
      if (seenTokenIds.has(b.tokenId)) continue;
      seenTokenIds.add(b.tokenId);
      if (b.tier > 0) tierCounts[b.tier] = (tierCounts[b.tier] ?? 0) + 1;
      if (b.cardGrade !== null) {
        gradeCounts[b.cardGrade] = (gradeCounts[b.cardGrade] ?? 0) + 1;
        totalGradeSum += b.cardGrade;
        totalGradeN += 1;
      }
    }

    const heldTotal = heldRes?.total ?? heldItems.length;
    const totalOwned = heldTotal + stakedBeasts.length;

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({
      address,
      fetchedAt: new Date().toISOString(),
      summary: {
        totalOwned,
        heldTotal,
        heldPowerForms,
        heldRegular: Math.max(0, heldTotal - heldPowerForms),
        stakedCount: stakedBeasts.length,
        readyToEvolveCount,
        avgGrade: totalGradeN > 0 ? Number((totalGradeSum / totalGradeN).toFixed(2)) : null,
        avgHeldGrade: heldGradeN > 0 ? Number((heldGradeSum / heldGradeN).toFixed(2)) : null,
        dungeonBeastsCount: lootBeasts.length,
        takenCount: takenBeasts.length,
        killsCount: kills.length,
        runsMinted,
        runsStarted: startedRuns,
        runsCompleted: settledRuns,
        uniqueBagsUsed: uniqueBags.size,
      },
      gradeCounts,
      tierCounts,
      stakedBeasts,
      heldBeasts: heldItems,
      dungeonBeasts: lootBeasts.slice(0, 100),
      takenBeasts: takenBeasts.slice(0, 50),
      recentKills: kills.slice(0, 30),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}