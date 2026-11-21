import { config } from 'dotenv';
import { runFullSync } from '../server/sync.js';

config({ path: '.env.local', override: true });

async function main() {
  console.log('Starting Loot Dungeon sync...');
  const summary = await runFullSync();
  console.log('Sync complete:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});