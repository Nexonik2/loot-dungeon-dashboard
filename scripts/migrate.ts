import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { getDb } from '../server/db.js';

config({ path: '.env.local', override: true });

async function main() {
  const sql = getDb();
  const schemaPath = path.resolve(process.cwd(), 'db/schema.sql');
  const rawSql = readFileSync(schemaPath, 'utf8');

  // Strip line comments and split into individual statements for Neon HTTP driver
  const statements = rawSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Applying ${statements.length} SQL statements from db/schema.sql...`);
  for (const [index, stmt] of statements.entries()) {
    await sql.query(stmt);
    console.log(`  [${index + 1}/${statements.length}] OK`);
  }
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});