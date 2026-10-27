// Assembles the deployable static site into dist/ (served per .openai/hosting.json).
// Run via `npm run build`, which rebuilds styles.css first.
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dist');
const entries = ['index.html', 'main.js', 'planner-core.js', 'styles.css', 'assets'];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await Promise.all(entries.map((entry) => cp(path.join(root, entry), path.join(outDir, entry), { recursive: true })));

console.log(`Built ${entries.length} entries into ${path.relative(root, outDir)}/`);
