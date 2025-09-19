import { readdir, stat, chmod } from 'fs/promises';
import { join, dirname } from 'path';
import { spawn } from 'child_process';

const ROOT = process.cwd();
const CREATIONS_DIR_LOWER = join(ROOT, 'creations');
const CREATIONS_DIR_UPPER = join(ROOT, 'Creations');
const CREATIONS_DIR = (await (async () => {
  try { await stat(CREATIONS_DIR_LOWER); return CREATIONS_DIR_LOWER; } catch {}
  return CREATIONS_DIR_UPPER;
})());

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
      await runBuildScript(buildPath);
    }
  }
}

main().catch((err) => {
  console.error('[apps] Unhandled error during app builds:', err);
  process.exit(1);
});


