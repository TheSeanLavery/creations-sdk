import { readdir, stat, chmod, readFile, mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { createHash } from 'crypto';

const ROOT = process.cwd();
const CREATIONS_DIR_LOWER = join(ROOT, 'creations');
const CREATIONS_DIR_UPPER = join(ROOT, 'Creations');
const CREATIONS_DIR = (await (async () => {
  try { await stat(CREATIONS_DIR_LOWER); return CREATIONS_DIR_LOWER; } catch {}
  return CREATIONS_DIR_UPPER;
})());
const CACHE_DIR = join(ROOT, '.buildcache');

async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function findBuildScripts(appsDir, maxDepth = 3) {
  const builds = [];
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs, depth + 1);
      } else if (ent.isFile() && ent.name === 'build.sh') {
        builds.push(abs);
      }
    }
  }
  await walk(appsDir, 0);
  return builds;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
    child.on('error', reject);
  });
}

async function runBuildScript(buildPath) {
  // Ensure executable
  try { await chmod(buildPath, 0o755); } catch {}
  const cwd = dirname(buildPath);
  console.log(`\n[apps] Running ${buildPath}`);
  try {
    await run('bash', ['build.sh'], { cwd });
    console.log(`[apps] Completed ${buildPath}`);
  } catch (e) {
    console.warn(`[apps] Build failed at ${buildPath}: ${e.message}`);
  }
}

async function listFilesRec(dir) {
  const out = [];
  async function walk(d) {
    let entries = [];
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = join(d, ent.name);
      if (ent.isDirectory()) await walk(abs);
      else if (ent.isFile()) out.push(abs);
    }
  }
  await walk(dir);
  return out;
}

async function gatherAppInputs(appDir) {
  const files = [];
  async function maybePush(p) { if (await pathExists(p)) files.push(p); }
  await maybePush(join(appDir, 'build.sh'));
  await maybePush(join(appDir, 'index.html'));
  await maybePush(join(appDir, 'vite.config.js'));
  await maybePush(join(appDir, 'package.json'));
  await maybePush(join(appDir, 'package-lock.json'));
  const srcDir = join(appDir, 'src');
  if (await pathExists(srcDir)) {
    const srcFiles = await listFilesRec(srcDir);
    files.push(...srcFiles);
  }
  // Also include sources from the creation root (../../src), so apps that keep
  // their sources at the creation root still trigger rebuilds properly.
  const creationRoot = join(appDir, '..', '..');
  const creationSrcDir = join(creationRoot, 'src');
  if (await pathExists(creationSrcDir)) {
    const rootSrcFiles = await listFilesRec(creationSrcDir);
    files.push(...rootSrcFiles);
  }
  await maybePush(join(creationRoot, 'package.json'));
  await maybePush(join(creationRoot, 'package-lock.json'));
  // Deterministic order
  files.sort();
  return files;
}

async function computeHashForFiles(files, rootPrefix) {
  const h = createHash('sha256');
  for (const f of files) {
    const rel = f.startsWith(rootPrefix) ? f.slice(rootPrefix.length + 1) : f;
    h.update(rel);
    try {
      const buf = await readFile(f);
      h.update(buf);
    } catch {}
  }
  return h.digest('hex');
}

function cacheKeyForApp(appDir) {
  // Use path relative to ROOT, replace separators
  const rel = appDir.startsWith(ROOT) ? appDir.slice(ROOT.length + 1) : appDir;
  const safe = rel.replace(/[^a-zA-Z0-9_.\-]/g, '_');
  return join(CACHE_DIR, `${safe}.hash`);
}

async function shouldBuild(appDir) {
  await mkdir(CACHE_DIR, { recursive: true });
  const files = await gatherAppInputs(appDir);
  const hash = await computeHashForFiles(files, ROOT);
  const keyPath = cacheKeyForApp(appDir);
  let prev = '';
  try { prev = (await readFile(keyPath, 'utf8')).trim(); } catch {}
  const distExists = await pathExists(join(appDir, 'dist'));
  const changed = hash !== prev;
  return { changed, hash, keyPath, distExists };
}

async function recordHash(keyPath, hash) {
  try { await writeFile(keyPath, `${hash}\n`, 'utf8'); } catch {}
}

async function main() {
  const exists = await pathExists(CREATIONS_DIR);
  if (!exists) {
    console.log('[apps] No creations directory found, skipping app builds');
    return;
  }

  let creationDirs = [];
  try {
    creationDirs = (await readdir(CREATIONS_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => join(CREATIONS_DIR, d.name));
  } catch {}

  for (const creationDir of creationDirs) {
    const appsDir = join(creationDir, 'apps');
    if (!(await pathExists(appsDir))) continue;
    const builds = await findBuildScripts(appsDir, 3);
    for (const buildPath of builds) {
      const appDir = dirname(buildPath);
      const { changed, hash, keyPath, distExists } = await shouldBuild(appDir);
      if (!changed && distExists) {
        if (!process.env.BUILDS_QUIET) {
          console.log(`[apps] Skipping ${appDir} (no changes)`);
        }
        continue;
      }
      await runBuildScript(buildPath);
      await recordHash(keyPath, hash);
    }
  }
}

main().catch((err) => {
  console.error('[apps] Unhandled error during app builds:', err);
  process.exit(1);
});


