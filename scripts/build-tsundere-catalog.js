#!/usr/bin/env node
/**
 * Export optimal tsundere / dating-site item list for Shopify + X campaigns.
 * Usage: node scripts/build-tsundere-catalog.js [--lane=tinder] [--enrich]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getOptimalItemList,
  DATING_SITE_LANES,
  enrichWithLiveSearch
} from '../src/tsundere-dating.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
);

const lane = args.lane && args.lane !== 'all' ? args.lane : null;
const limit = parseInt(args.limit, 10) || 24;
const enrich = args.enrich === true || args.enrich === 'true';

async function main() {
  const items = getOptimalItemList({ lane, limit });
  const payload = {
    generatedAt: new Date().toISOString(),
    lane: lane || 'all',
    lanes: DATING_SITE_LANES,
    itemCount: items.length,
    items
  };

  if (enrich) {
    payload.enriched = await enrichWithLiveSearch(items, { perItem: 1 });
  }

  const dataDir = resolve(ROOT, 'data');
  mkdirSync(dataDir, { recursive: true });
  const outPath = resolve(dataDir, 'tsundere-dating-optimal-list.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Tsundere / dating optimal list: ${items.length} items`);
  console.log(`Lane filter: ${lane || 'all'}`);
  console.log(`Written: ${outPath}`);
  console.log('\nTop 5 by score:');
  items.slice(0, 5).forEach((item, i) => {
    console.log(`  ${i + 1}. [${item.computedScore}] ${item.title} → ${item.lanes.join(', ')}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});