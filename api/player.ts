import { API_ENDPOINTS, CONTRACTS, LOOT_DUNGEON } from '../server/config.js';

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

function normalizeStarknetAddress(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(trimmed)) return null;
  return `0x${trimmed.slice(2).padStart(64, '0')}`;
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
      error: 'Invalid Starknet wallet address (expected 0x followed by 1–64 hex characters)',
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
      `?game_core=${CONTRACTS.gameCore}&minter_id=4&owner=${address}`;

    const [heldRes, lootBeastsRes, lootKillsRes, gamesRes] = await Promise.all([
      fetchJsonSafe<{ items?: UpstreamBeastToken[]; total?: number }>(heldBeastsUrl),
      fetchJsonSafe<{ beasts?: Array<Record<string, unknown>>; taken?: Array<Record<string, unknown>> }>(
        lootBeastsUrl,
      ),
      fetchJsonSafe<{ kills?: Array<Record<string, unknown>> }>(lootKillsUrl),
      fetchJsonSafe<unknown>(gamesUrl),
    ]);

    const heldItems = (heldRes?.items ?? []).map((b) => ({
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
      isPowerForm: ((b.visualEffects ?? 0) & LOOT_DUNGEON.powerFormVisualEffects) !== 0,
      cardGrade: b.cardGrade ?? null,
      mintedAtMinute: b.mintedAtMinute ?? null,
    }));

    // Normalize /games response shape (array or { data / games / items })
    const rawGames: Array<Record<string, unknown>> = Array.isArray(gamesRes)
      ? gamesRes
      : Array.isArray((gamesRes as Record<string, unknown> | null)?.games)
        ? ((gamesRes as Record<string, unknown>).games as Array<Record<string, unknown>>)
        : Array.isArray((gamesRes as Record<string, unknown> | null)?.data)
          ? ((gamesRes as Record<string, unknown>).data as Array<Record<string, unknown>>)
          : [];

    const lootBeasts = Array.isArray(lootBeastsRes?.beasts) ? lootBeastsRes.beasts : [];
    const takenBeasts = Array.isArray(lootBeastsRes?.taken) ? lootBeastsRes.taken : [];
    const kills = Array.isArray(lootKillsRes?.kills) ? lootKillsRes.kills : [];

    // Grade & Tier summary across currently held Beasts
    const gradeCounts: Record<number, number> = {};
    const tierCounts: Record<number, number> = {};
    let gradeSum = 0;
    let gradeN = 0;
    let heldPowerForms = 0;

    for (const b of heldItems) {
      if (b.isPowerForm) heldPowerForms += 1;
      tierCounts[b.tier] = (tierCounts[b.tier] ?? 0) + 1;
      if (b.cardGrade !== null) {
        gradeCounts[b.cardGrade] = (gradeCounts[b.cardGrade] ?? 0) + 1;
        gradeSum += b.cardGrade;
        gradeN += 1;
      }
    }

    const startedRuns = rawGames.filter(
      (g) => Boolean(g.started) || Number(g.actionCount ?? 0) > 0,
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

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({
      address,
      fetchedAt: new Date().toISOString(),
      summary: {
        heldTotal: heldRes?.total ?? heldItems.length,
        heldPowerForms,
        heldRegular: (heldRes?.total ?? heldItems.length) - heldPowerForms,
        avgHeldGrade: gradeN > 0 ? Number((gradeSum / gradeN).toFixed(2)) : null,
        dungeonBeastsCount: lootBeasts.length,
        takenCount: takenBeasts.length,
        killsCount: kills.length,
        runsMinted: rawGames.length,
        runsStarted: startedRuns,
        runsCompleted: settledRuns,
        uniqueBagsUsed: uniqueBags.size,
      },
      gradeCounts,
      tierCounts,
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