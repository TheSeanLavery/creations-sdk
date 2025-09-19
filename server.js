// Minimal static file server using Node's http/fs/path modules
// Serves /plugin-demo and /public, with / hosting /public/index.html

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const pluginDemoDir = path.join(rootDir, 'plugin-demo');
const ballDir = path.join(rootDir, 'bouncing_ball_game', 'apps', 'static', '9twmvkSm7lLt');
const creationsDir = path.join(rootDir, 'Creations');

const port = process.env.PORT || 5000;

/**
 * Resolve request URL to a file path under allowed roots.
 */
function resolveFilePath(urlPath) {
  // Normalize and prevent path traversal
  const safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^\/+/, '/');

  // Base route -> serve public index
  if (safePath === '/' || safePath === '') {
    return path.join(publicDir, 'index.html');
  }

  // Route to specific mounted directories
  const mounts = [
    { base: '/public', dir: publicDir },
    { base: '/plugin-demo', dir: pluginDemoDir },
    { base: '/ball', dir: ballDir },
    { base: '/creations', dir: creationsDir },
  ];

  for (const { base, dir } of mounts) {
    if (safePath === base || safePath.startsWith(base + '/')) {
      const rel = safePath.slice(base.length);
      const normalizedRel = rel.replace(/^\/+/, '');
      const finalRel = normalizedRel || 'index.html';
      return path.join(dir, finalRel);
    }
  }

  // Fallback: try under public (strip any leading slash)
  const publicRel = safePath.replace(/^\/+/, '');
  return path.join(publicDir, publicRel);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

const server = http.createServer((req, res) => {
  // Basic request logging to debug routing
  const started = Date.now();
  const origUrl = req.url || '/';

  // Suppress browser favicon requests causing console 404 noise
  if (req.url === '/favicon.ico') {
    res.writeHead(204, {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  // API: creations list (serve pre-generated file, else scan top-level dirs)
  if (req.url && req.url.startsWith('/api/creations')) {
    (async () => {
      const creationsJsonPath = path.join(publicDir, 'creations.json');
      let payload = null;
      try {
        const text = await fs.promises.readFile(creationsJsonPath, 'utf8');
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.items)) payload = parsed;
      } catch (_) {}

      if (!payload) {
        try {
          const entries = await fs.promises.readdir(creationsDir);
          const items = [];
          for (const entry of entries) {
            const dirPath = path.join(creationsDir, entry);
            let s;
            try { s = await fs.promises.stat(dirPath); } catch { continue; }
            if (!s.isDirectory()) continue;
            const indexPath = path.join(dirPath, 'index.html');
            try {
              const idx = await fs.promises.stat(indexPath);
              if (idx.isFile()) {
                items.push({ label: entry, url: '/creations/' + entry + '/index.html' });
              }
            } catch { /* skip */ }
          }
          payload = { items };
        } catch {
          payload = { items: [] };
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(payload));
    })();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let filePath = resolveFilePath(origUrl);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.warn(`[404] ${req.method} ${origUrl} -> ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        console.error(`[500] ${req.method} ${origUrl} -> ${filePath} (${Date.now()-started}ms)`, readErr.message);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 
        'Content-Type': getContentType(filePath),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
      console.log(`[200] ${req.method} ${origUrl} -> ${filePath} (${Date.now()-started}ms)`);
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('Paths:');
  console.log('  /                -> public/index.html');
  console.log('  /public          -> public/');
  console.log('  /plugin-demo     -> plugin-demo/');
  console.log('  /ball            -> bouncing_ball_game/apps/static/9twmvkSm7lLt/');
  console.log(`\nServer ready for Replit environment on port ${port}`);
  console.log('Access via: https://<repl-name>.<username>.repl.co/');
});
