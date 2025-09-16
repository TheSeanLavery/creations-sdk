// Minimal static file server using Node's http/fs/path modules
// Serves /plugin-demo, /qr, and /public, with / hosting /public/index.html

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const pluginDemoDir = path.join(rootDir, 'plugin-demo');
const qrDir = path.join(rootDir, 'qr');
const ballDir = path.join(rootDir, 'bouncing_ball_game', 'apps', 'static', '9twmvkSm7lLt');

const port = process.env.PORT || 3012;

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
    { base: '/qr', dir: qrDir },
    { base: '/ball', dir: ballDir },
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
  // Simple API: network info for QR usage
  if (req.url && req.url.startsWith('/api/network-info')) {
    const nets = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }

    const hostHeader = (req.headers['host'] || '').trim();
    const protocol = 'http';
    const urlsByAddress = addresses.map(address => ({
      address,
      hostUrl: `${protocol}://${address}:${port}/`,
      pluginDemoUrl: `${protocol}://${address}:${port}/plugin-demo/`,
      ballUrl: `${protocol}://${address}:${port}/ball/`,
      qrPageUrl: `${protocol}://${address}:${port}/qr.html`,
    }));

    const payload = {
      port,
      protocol,
      addresses,
      hostHeader,
      urlsByAddress,
      byHeader: hostHeader ? {
        hostUrl: `${protocol}://${hostHeader}/`,
        pluginDemoUrl: `${protocol}://${hostHeader}/plugin-demo/`,
        ballUrl: `${protocol}://${hostHeader}/ball/`,
        qrPageUrl: `${protocol}://${hostHeader}/qr.html`,
      } : null,
    };

    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
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
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
      console.log(`[200] ${req.method} ${origUrl} -> ${filePath} (${Date.now()-started}ms)`);
    });
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Paths:');
  console.log('  /                -> public/index.html');
  console.log('  /public          -> public/');
  console.log('  /plugin-demo     -> plugin-demo/');
  console.log('  /qr              -> qr/');
  console.log('  /qr.html         -> public/qr.html');
  console.log('  /ball            -> bouncing_ball_game/apps/static/9twmvkSm7lLt/');
});
