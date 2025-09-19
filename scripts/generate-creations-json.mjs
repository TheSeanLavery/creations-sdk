import { readdir, stat, writeFile } from 'fs/promises';
import { join, posix } from 'path';

const ROOT = process.cwd();
const CREATIONS_DIR = join(ROOT, 'creations');
const OUTPUT = join(ROOT, 'public', 'creations.json');

async function listCreations() {
  const items = [];
  let entries = [];
  try { entries = await readdir(CREATIONS_DIR); } catch { return items; }

  for (const entry of entries) {
    const dirPath = join(CREATIONS_DIR, entry);
    let s;
    try { s = await stat(dirPath); } catch { continue; }
    if (!s.isDirectory()) continue;
    const indexPath = join(dirPath, 'index.html');
    try {
      const idx = await stat(indexPath);
      if (idx.isFile()) {
        const label = entry;
        const url = '/creations/' + posix.join(entry, 'index.html');
        items.push({ label, url });
      }
    } catch {
      // no top-level index.html; skip
    }
  }

  items.sort((a, b) => a.label.localeCompare(b.label));
  return items;
}

async function main() {
  const items = await listCreations();
  const json = JSON.stringify({ items }, null, 2);
  await writeFile(OUTPUT, json, 'utf8');
  console.log(`Wrote ${items.length} creations to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


