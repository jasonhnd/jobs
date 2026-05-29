#!/usr/bin/env node
/**
 * e2e-server.cjs — static file server for Playwright e2e that mirrors the
 * production Vercel `cleanUrls: true` + `trailingSlash: false` behavior
 * (vercel.json), serving the built `dist-astro/`.
 *
 * Why not `http-server`: the site builds with `build.format: 'file'`, so a
 * hub index like /ja/sectors lives at `ja/sectors.html` WHILE its children
 * live in a `ja/sectors/` directory. Plain `http-server` sees the directory
 * and 302-redirects `/ja/sectors` → `/ja/sectors/` → 404 (there is no
 * `ja/sectors/index.html`). Vercel's cleanUrls instead serves the sibling
 * `ja/sectors.html`. This server applies that same rule so e2e sees exactly
 * what Vercel serves. Test-only (localhost); not a production server.
 *
 * Resolution order for an extensionless path `/x`:
 *   1. `x`            (real assets: .css/.js/.json/.xml/.png/…)
 *   2. `x.html`       (cleanUrls — preferred over a sibling directory)
 *   3. `x/index.html` (directory-index fallback)
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'dist-astro');
const PORT = Number(process.env.E2E_PORT) || 4321;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// Mirror the global response headers Vercel applies (vercel.json → the
// `headers` rule whose source is "/(.*)"), so header-level e2e assertions
// (CSP allow-list, no unsafe-inline, etc.) see what production actually
// serves. Plain http-server sent none of these, so those tests could never
// pass locally.
function loadVercelGlobalHeaders() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8'));
    const rule = (cfg.headers || []).find((h) => h.source === '/(.*)');
    const out = {};
    if (rule && Array.isArray(rule.headers)) {
      for (const { key, value } of rule.headers) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
const GLOBAL_HEADERS = loadVercelGlobalHeaders();

function resolveFile(rawPath) {
  let urlPath = decodeURIComponent(rawPath.split('?')[0].split('#')[0]);
  // trailingSlash: false — treat /x/ the same as /x (except root)
  if (urlPath.length > 1 && urlPath.endsWith('/')) urlPath = urlPath.replace(/\/+$/, '');

  const candidates =
    urlPath === '/' || urlPath === ''
      ? [path.join(ROOT, 'index.html')]
      : [
          path.join(ROOT, urlPath),
          path.join(ROOT, `${urlPath}.html`),
          path.join(ROOT, urlPath, 'index.html'),
        ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(ROOT)) continue; // path-traversal guard
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // not found / not statable — try next candidate
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || '/');

  if (!file) {
    const notFoundPage = path.join(ROOT, '404.html');
    if (fs.existsSync(notFoundPage)) {
      res.writeHead(404, { 'content-type': CONTENT_TYPES['.html'], ...GLOBAL_HEADERS });
      fs.createReadStream(notFoundPage).pipe(res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const type = CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, ...GLOBAL_HEADERS });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`[e2e-server] serving ${ROOT} at http://localhost:${PORT} (Vercel cleanUrls mirror)`);
});
