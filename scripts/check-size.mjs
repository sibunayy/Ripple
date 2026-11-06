// Fails if the gzipped JS shell exceeds the budget (spec §1: 250 KB).
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const BUDGET = 250 * 1024;
const dir = new URL('../dist/assets/', import.meta.url);
let total = 0;
for (const f of readdirSync(dir)) if (f.endsWith('.js')) total += gzipSync(readFileSync(new URL(f, dir))).length;
console.log(`JS gzip total: ${(total / 1024).toFixed(1)} KB (budget ${BUDGET / 1024} KB)`);
if (total > BUDGET) { console.error('Bundle budget exceeded'); process.exit(1); }
