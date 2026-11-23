import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE_BASE = 'https://www.lootsurvivor.io';
const OUT_DIR = path.resolve('public/sprites');

const SPECIES_SLUGS = [
  'koschei',
  'siren',
  'poltergeist',
  'tengu',
  'kodama',
  'enfield',
  'bugbear',
  'wulver',
  'humbaba',
  'kamaitachi',
  'domovoi',
  'antaeus',
  'kikimora',
  'talos',
  'brownie',
  'alicanto',
  'buggane',
  'strix',
  'fomorian',
  'leshy',
  'nuckelavee',
  'akhlut',
  'bonnacon',
  'surtr',
  'aspidochelone',
  'pontianak',
  'peryton',
  'gashadokuro',
  'dybbuk',
  'simurgh',
] as const;

const GIF_REGEX = new RegExp(
  `\\b(${SPECIES_SLUGS.join('|')})-[A-Za-z0-9_-]{6,16}\\.gif\\b`,
  'gi',
);

const CHUNK_REGEX = /["'](?:\.\/|\/?assets\/)([A-Za-z0-9_.-]+\.js)["']/g;

async function fetchTextSafe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const html = await fetchTextSafe(SITE_BASE);
  if (!html) {
    throw new Error(`Failed to fetch ${SITE_BASE}`);
  }

  const found = new Map<string, string>();
  const visitedJs = new Set<string>();
  const queue: string[] = [];

  const enqueueJs = (filename: string) => {
    const url = `${SITE_BASE}/assets/${filename}`;
    if (!visitedJs.has(url)) {
      visitedJs.add(url);
      queue.push(url);
    }
  };

  const scanText = (text: string) => {
    for (const m of text.matchAll(GIF_REGEX)) {
      const filename = m[0];
      const slug = m[1].toLowerCase();
      if (!found.has(slug)) {
        found.set(slug, `${SITE_BASE}/assets/${filename}`);
      }
    }
    for (const m of text.matchAll(CHUNK_REGEX)) {
      enqueueJs(m[1]);
    }
  };

  scanText(html);

  // Crawl entry + lazy-loaded Vite JS chunks in batches until all 30 are found
  const MAX_CHUNKS = 150;
  let scanned = 0;

  while (queue.length > 0 && found.size < SPECIES_SLUGS.length && scanned < MAX_CHUNKS) {
    const batch = queue.splice(0, 10);
    scanned += batch.length;
    const bodies = await Promise.all(batch.map((url) => fetchTextSafe(url)));
    for (const body of bodies) {
      if (body) scanText(body);
    }
  }

  console.log(
    `Scanned ${scanned} JS chunks, found ${found.size}/${SPECIES_SLUGS.length} Beast sprites.`,
  );

  let saved = 0;
  for (const [slug, url] of found.entries()) {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Failed (${res.status}): ${url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(OUT_DIR, `${slug}.gif`), buf);
    saved += 1;
  }

  const missing = SPECIES_SLUGS.filter((s) => !found.has(s));
  console.log(`Saved ${saved} sprites to public/sprites/`);
  if (missing.length > 0) {
    console.warn(`Missing (${missing.length}): ${missing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});