export type TabId = 'overview' | 'quality' | 'wanted' | 'pools' | 'player';

export type ActiveBeastStatus =
  | 'staked'
  | 'held_regular'
  | 'held_power_form'
  | 'sold_regular'
  | 'sold_power_form';

export interface SpeciesSnapshotItem {
  beastId: number;
  claimed: number;
  held: number;
  staked: number;
  unsafeStaked: number;
  taken: number;
  reserved?: number;
  mega?: number;
  evolved?: number;
}

export interface OverviewResponse {
  lastSyncedAt: string | null;
  kpis: {
    cap: number;
    maxPeriodSeconds: number;
    claimed: number;
    held: number;
    staked: number;
    unsafeStaked: number;
    taken: number;
    powerForm: number;
    totalSold: number;
    netEthWei: string;
    grossEthWei: string;
  } | null;
  history: Array<{
    ts: number;
    claimed: number;
    held: number;
    staked: number;
    unsafeStaked: number;
    taken: number;
    powerForm: number;
  }>;
  speciesSnapshot: SpeciesSnapshotItem[];
  speciesCatalog: Array<{
    beastId: number;
    name: string;
    type: string;
    tier: number;
    activeCount: number;
  }>;
}

export interface QualityResponse {
  statusTotals: Array<{ status: ActiveBeastStatus; count: number }>;
  gradeMatrix: Array<{ cardGrade: number; status: ActiveBeastStatus; count: number }>;
  tierMatrix: Array<{ tier: number; status: ActiveBeastStatus; count: number }>;
  summaryByStatus: Array<{
    status: ActiveBeastStatus;
    count: number;
    avgGrade: number | null;
    avgLevel: number | null;
    avgPower: number | null;
  }>;
}

export interface PoolSummary {
  tier: number;
  form: 'regular' | 'power_form';
  address: string | null;
  saleTxs: number;
  nftsSold: number;
  netEthWei: string;
  grossEthWei: string;
  seedSpotWei: string | null;
  latestSpotWei: string | null;
  lastSaleTime: number | null;
}

export interface PoolHistoryEvent {
  poolAddress: string;
  tier: number;
  form: 'regular' | 'power_form';
  ts: number;
  kind: string;
  spotPriceWei: string;
  amountWei: string | null;
  nftCount: number | null;
}

export interface PoolsResponse {
  pools: PoolSummary[];
  spotHistory: PoolHistoryEvent[];
  recentSales: Array<{
    poolAddress: string;
    txHash: string;
    tier: number;
    form: 'regular' | 'power_form';
    block: number;
    ts: number;
    spotPriceWei: string;
    amountWei: string | null;
    nftCount: number;
  }>;
}

export interface WantedTierRow {
  tier: number;
  stakedCount: number;
  highGradeCount: number;
  grade10Count: number;
  avgGrade: number | null;
  minLevel: number;
  avgLevel: number | null;
  minHealth: number;
  byType: {
    Magic: number;
    Hunter: number;
    Brute: number;
  };
}

export interface WantedSpeciesRow {
  beastId: number;
  name: string;
  type: string;
  tier: number;
  stakedCount: number;
  highGradeCount: number;
  grade10Count: number;
  avgGrade: number | null;
  minLevel: number;
  avgLevel: number | null;
  minHealth: number;
}

export interface WantedSummaryResponse {
  mode: 'summary';
  totalStaked: number;
  tiers: WantedTierRow[];
  species: WantedSpeciesRow[];
}

export interface WantedBeastItem {
  tokenId: string;
  beastId: number;
  name: string;
  type: string;
  tier: number;
  prefixName: string | null;
  suffixName: string | null;
  level: number;
  health: number;
  power: number;
  projectedRank: number | null;
  cardGrade: number | null;
  visualEffects: number;
  mintedAtMinute: number;
}

export interface WantedDetailResponse {
  mode: 'detail';
  total: number;
  page: number;
  limit: number;
  items: WantedBeastItem[];
}

export interface PlayerHeldBeast {
  tokenId: string;
  beastId: number;
  name: string;
  type: string;
  tier: number;
  prefixName: string | null;
  suffixName: string | null;
  level: number;
  health: number;
  power: number;
  projectedRank: number | null;
  isPowerForm: boolean;
  cardGrade: number | null;
  mintedAtMinute: number | null;
}

export interface PlayerResponse {
  address: string;
  fetchedAt: string;
  summary: {
    heldTotal: number;
    heldPowerForms: number;
    heldRegular: number;
    avgHeldGrade: number | null;
    dungeonBeastsCount: number;
    takenCount: number;
    killsCount: number;
    runsMinted: number;
    runsStarted: number;
    runsCompleted: number;
    uniqueBagsUsed: number;
  };
  gradeCounts: Record<string, number>;
  tierCounts: Record<string, number>;
  heldBeasts: PlayerHeldBeast[];
  dungeonBeasts: Array<Record<string, unknown>>;
  takenBeasts: Array<Record<string, unknown>>;
  recentKills: Array<Record<string, unknown>>;
}