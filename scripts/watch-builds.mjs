import { spawn } from 'child_process';

const intervalMs = parseInt(process.env.WATCH_INTERVAL_MS || '1000', 10);
let running = false;

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
    child.on('error', reject);
  });
}

async function runBuildsOnce() {
  if (running) return;
  running = true;
  try {
    await run('node', ['scripts/run-app-builds.mjs'], { env: { ...process.env, BUILDS_QUIET: '1' } });
  } catch (e) {
    console.warn('[watch] build error:', e.message);
  } finally {
    running = false;
  }
}

console.log(`[watch] Watching apps; interval ${intervalMs}ms`);
runBuildsOnce();
setInterval(runBuildsOnce, intervalMs);


