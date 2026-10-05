// Tiny zero-dependency server for GitHub Codespaces / local use.
// Serves the static dashboard AND runs api/stats.js on the same port.
//
//   node server.js        ->  http://localhost:3000
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// ---- minimal .env loader (no dependency) ----
function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env file, that's fine */
  }
}
loadEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

let handlerPromise = null;
function getHandler() {
  if (!handlerPromise) {
    const file = pathToFileURL(path.join(ROOT, 'api', 'stats.js')).href;
    handlerPromise = import(file).then((m) => m.default);
  }
  return handlerPromise;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ---- API ----
  if (url.pathname === '/api/stats') {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      const body = JSON.stringify(data);
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(body);
    };
    try {
      const handler = await getHandler();
      await handler(req, res);
    } catch (err) {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    }
    return;
  }

  // ---- static files ----
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Base Volume Dashboard jalan di  ->  http://localhost:' + PORT);
  console.log('  Wallet   : ' + (process.env.WALLET_ADDRESS || '(default 0x29d0…2944)'));
  console.log('  Token    : ' + (process.env.TOKEN_ADDRESS || '(semua token)'));
  console.log('  Alchemy  : ' + (process.env.ALCHEMY_RPC_URL ? 'OK' : 'BELUM DIISI'));
  console.log('');
  if (!process.env.ALCHEMY_RPC_URL) {
    console.warn('  ⚠️  ALCHEMY_RPC_URL belum diisi. Buat file .env lalu restart.\n');
  }
});
