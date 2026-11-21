export type BeastForm = 'regular' | 'power_form';

export interface PoolConfig {
  tier: 1 | 2 | 3 | 4 | 5;
  form: BeastForm;
  address: string | null;
}

export const API_ENDPOINTS = {
  // Override via Vercel env vars if Provable Games rotates Railway URLs
  v2Base: process.env.LOOT_API_V2_URL || 'https://api-v2-next.up.railway.app',
  collectablesBase:
    process.env.LOOT_COLLECTABLES_API_URL || 'https://api-next-5655.up.railway.app',
} as const;

export const CONTRACTS = {
  dungeon: '0x03921001b64ad6af2bae27b95c27c465fc8921d9c537f4821eb3023b5889622f',
  gameCore: '0x03cafe867e9f5dc7ccf73471b98c1d6d6d54804744cef9626accd217b6ad1dd2',
  beastsV3: '0x00f739e402e52830a736335a0f47d58ec78ba067443c9c6930da182eab2ff8b0',
  buybackVault: '0x061a55ab9a4c739ab1d4e04a4f6628d51b8601de150d2ee46c7835c8da5964dd',
} as const;

export const LOOT_DUNGEON = {
  launchBlock: 18107570,
  beastIdMin: 78,
  beastIdMax: 107,
  powerFormVisualEffects: 2, // 0 = Regular, 2 = Power Form, 3 = Genesis
  netToGrossDivisor: 0.9025, // Two compounding 5% fees (0.95 * 0.95)
} as const;

// 10 Tier x Form Sudoswap ETH buyback pools (null = placeholder to fill manually)
// Unlabeled addresses from earlier traces to classify later:
// - 0x0757dcc3913df8302ea87308f79377f6a3401281047fa7d804d76cb63a5dc6f0
// - 0x0621bde4b28ed47c402e81f510bff6258438da3931ea714e9191b5fcc11a5baa
export const BUYBACK_POOLS: PoolConfig[] = [
  { tier: 1, form: 'regular', address: null },
  { tier: 1, form: 'power_form', address: null },
  { tier: 2, form: 'regular', address: null },
  { tier: 2, form: 'power_form', address: null },
  { tier: 3, form: 'regular', address: null },
  { tier: 3, form: 'power_form', address: null },
  {
    tier: 4,
    form: 'regular',
    address: '0x0765cb969d1b875df19b8e766442214efe4cef4551988c2b751d75c797f7b5fd',
  },
  { tier: 4, form: 'power_form', address: null },
  {
    tier: 5,
    form: 'regular',
    address: '0x05559044a0123b38e2f0f5c830d8c2cdd3077ae94e15f77b80bb68ae6129d28c',
  },
  {
    tier: 5,
    form: 'power_form',
    address: '0x07b469185ae44e31e37eaca7649e8ba9dea5f58fc591492733afe64342a68c71',
  },
];

export function getActivePools(): Array<PoolConfig & { address: string }> {
  return BUYBACK_POOLS.filter(
    (p): p is PoolConfig & { address: string } => Boolean(p.address),
  ).map((p) => ({
    ...p,
    address: p.address.toLowerCase(),
  }));
}