/**
 * RoomSync – Zero-dependency Node.js static file server
 * Run with: node serve.js
 * No npm install required — uses only built-in Node.js modules.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT = 5173;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  // Strip query string, decode URI
  const parsed   = url.parse(req.url);
  let   pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/') pathname = '/index.html';

  const filePath    = path.join(ROOT, pathname);
  const ext         = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  // Security: block path traversal outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: serve index.html for unknown routes
        fs.readFile(path.join(ROOT, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(500); return res.end('Internal error'); }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      } else {
        res.writeHead(500); res.end('Internal error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type':  contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n🏠  RoomSync is running!');
  console.log(`    → http://localhost:${PORT}\n`);
  console.log('    Press Ctrl+C to stop.\n');

  // Auto-open in default browser on Windows
  const { exec } = require('child_process');
  exec(`start http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use.`);
    console.error(`    Try: node serve.js --port 8080\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
