/**
 * dev-server.js — run the whole app locally with ONE command: `npm run dev`.
 *
 * It copies what Vercel does in production:
 *   /api/<name>   → imports api/<name>.js and calls its GET(request) function
 *   anything else → serves the file from /public (index.html for "/")
 *
 * No dependencies and no Vercel account needed. It's only for local testing;
 * Vercel ignores this file when you deploy.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const API_DIR = path.join(ROOT, 'api');
const PORT = Number(process.env.PORT) || 3000;

// File extension → Content-Type, so the browser knows what it's getting.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Handle /api/<name> by calling the matching serverless function. */
async function handleApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  // Only simple names like "jobs" — never "../something" or "_lib/…" (private).
  if (!/^[a-z0-9-]+$/i.test(name)) return send(res, 404, 'Not found');

  const file = path.join(API_DIR, `${name}.js`);
  try { await stat(file); } catch { return send(res, 404, 'No such API route'); }

  try {
    const mod = await import(pathToFileURL(file).href);
    const handler = mod[req.method] || (req.method === 'HEAD' && mod.GET);
    if (!handler) return send(res, 405, 'Method not allowed');

    // Build a standard Web Request, call the function, copy its Response back.
    const request = new Request(url, { method: req.method, headers: req.headers });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(`[api/${name}]`, err);
    send(res, 500, JSON.stringify({ ok: false, error: 'Function crashed — see terminal' }), 'application/json');
  }
}

/** Serve a static file from /public. */
async function handleStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC_DIR, rel);
  // Security: refuse paths that escape /public (e.g. "/../package.json").
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');

  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    send(res, 404, 'Not found');
  }
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const started = Date.now();
  res.on('finish', () => console.log(`${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started} ms)`));

  if (url.pathname.startsWith('/api/')) handleApi(req, res, url);
  else handleStatic(res, url);
}).listen(PORT, () => {
  console.log(`\n  Startup Radar running at http://localhost:${PORT}\n  Press Ctrl+C to stop.\n`);
});
