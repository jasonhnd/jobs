/**
 * seo-extract.cjs — pure HTML extraction primitives + a single
 * `captureBaseline()` entrypoint shared by:
 *
 *   - scripts/capture-seo-baseline.cjs   (writes the baseline)
 *   - scripts/diff-seo-baseline.cjs      (compares current vs baseline)
 *
 * Both scripts MUST use the same extraction or the diff is lying.
 *
 * Exports:
 *   extractTitle / extractCanonical / extractH1s / extractJsonLd /
 *   extractInternalLinks / extractAnchorIds / findMetaContent /
 *   findAllMeta / decodeEntities / stripTags / parseStartTags / toInternalHref
 *   captureBaseline(distDir, publicDir) → {
 *     urls, seoLines, ogLines, ldLines, linkLines, dataFiles,
 *     sitemap, imageSitemap, htmlFileCount,
 *   }
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://mirai-shigoto.com';

// ─── HTML helpers ─────────────────────────────────────────────────

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── tag tokenizer ────────────────────────────────────────────────
//
// 2026-10-07 (#867): extraction used to be one regex per field, each
// assuming a fixed attribute order and quoting style. `data-href` was taken
// for `href`, unquoted values were missed, a `'` inside a double-quoted
// meta value truncated it (`AI's` → `AI`), JSON-LD blocks with an `id` or
// `nonce` attribute were invisible, ids containing `@` were dropped and
// `data-id` was recorded as an id. Every extractor now reads the same list
// of start tags produced by this small tokenizer, which follows the HTML
// rules that matter here: comments are skipped, `<script>` / `<style>` /
// `<textarea>` / `<title>` content is raw text (no tags inside), attribute
// values may be double-, single- or un-quoted, and the first occurrence of
// a duplicated attribute wins.

const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);

function isSpace(code) {
  return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

function isAsciiLetter(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/** Parse the attributes of a start tag beginning at `pos` (just after the
 *  tag name). Returns { attrs, end } where `end` is the index after `>`. */
function parseAttributes(html, pos) {
  const n = html.length;
  const attrs = new Map();
  let j = pos;
  while (j < n) {
    while (j < n && (isSpace(html.charCodeAt(j)) || html[j] === '/')) j += 1;
    if (j >= n || html[j] === '>') break;
    let k = j + 1; // the first name character may be anything but space / '>'
    while (k < n && !isSpace(html.charCodeAt(k)) && html[k] !== '/' && html[k] !== '>' && html[k] !== '=') k += 1;
    const name = html.slice(j, k).toLowerCase();
    j = k;
    while (j < n && isSpace(html.charCodeAt(j))) j += 1;
    let value = '';
    if (html[j] === '=') {
      j += 1;
      while (j < n && isSpace(html.charCodeAt(j))) j += 1;
      const quote = html[j];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, j + 1);
        const stop = close === -1 ? n : close;
        value = html.slice(j + 1, stop);
        j = close === -1 ? n : close + 1;
      } else {
        let e = j;
        while (e < n && !isSpace(html.charCodeAt(e)) && html[e] !== '>') e += 1;
        value = html.slice(j, e);
        j = e;
      }
    }
    if (!attrs.has(name)) attrs.set(name, decodeEntities(value));
  }
  return { attrs, end: j < n ? j + 1 : n };
}

/** Every start tag in document order: { name, attrs: Map, content }.
 *  `content` is the raw text of a raw-text element, otherwise null. */
function parseStartTags(html) {
  const tags = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      i = close === -1 ? n : close + 3;
      continue;
    }
    const next = html[lt + 1];
    if (next === '!' || next === '?' || next === '/') {
      const close = html.indexOf('>', lt + 2);
      i = close === -1 ? n : close + 1;
      continue;
    }
    if (!isAsciiLetter(html.charCodeAt(lt + 1))) {
      i = lt + 1;
      continue;
    }
    let j = lt + 1;
    while (j < n && !isSpace(html.charCodeAt(j)) && html[j] !== '/' && html[j] !== '>') j += 1;
    const name = html.slice(lt + 1, j).toLowerCase();
    const { attrs, end } = parseAttributes(html, j);
    let content = null;
    i = end;
    if (RAW_TEXT_ELEMENTS.has(name)) {
      const closeRe = new RegExp(`</${name}[\\s/>]`, 'gi');
      closeRe.lastIndex = end;
      const close = closeRe.exec(html);
      const stop = close ? close.index : n;
      content = html.slice(end, stop);
      i = stop;
    }
    tags.push({ name, attrs, content });
  }
  return tags;
}

// Each page is read by several extractors in a row; tokenize it once.
let cachedHtml = null;
let cachedTags = [];
function startTags(html) {
  if (html !== cachedHtml) {
    cachedTags = parseStartTags(html);
    cachedHtml = html;
  }
  return cachedTags;
}

function relTokens(tag) {
  return (tag.attrs.get('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
}

// ─── field extractors ─────────────────────────────────────────────

function findMetaContent(html, attrName, attrValue) {
  const key = attrName.toLowerCase();
  const wanted = attrValue.toLowerCase();
  for (const tag of startTags(html)) {
    if (tag.name !== 'meta' || !tag.attrs.has('content')) continue;
    if ((tag.attrs.get(key) || '').toLowerCase() === wanted) return tag.attrs.get('content');
  }
  return null;
}

function findAllMeta(html, attrName, prefix) {
  const key = attrName.toLowerCase();
  const head = `${prefix.toLowerCase()}:`;
  const out = {};
  for (const tag of startTags(html)) {
    if (tag.name !== 'meta' || !tag.attrs.has('content')) continue;
    const name = tag.attrs.get(key);
    if (!name || !name.toLowerCase().startsWith(head) || name.length === head.length) continue;
    out[`${prefix}:${name.slice(head.length)}`] = tag.attrs.get('content');
  }
  return out;
}

function extractTitle(html) {
  const title = startTags(html).find((tag) => tag.name === 'title');
  return title ? decodeEntities(title.content).trim() : null;
}

function extractCanonical(html) {
  for (const tag of startTags(html)) {
    if (tag.name !== 'link' || !tag.attrs.get('href')) continue;
    if (relTokens(tag).includes('canonical')) return tag.attrs.get('href');
  }
  return null;
}

function extractH1s(html) {
  const out = [];
  const re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function extractJsonLd(html) {
  const out = [];
  for (const tag of startTags(html)) {
    if (tag.name !== 'script') continue;
    if ((tag.attrs.get('type') || '').trim().toLowerCase() !== 'application/ld+json') continue;
    const raw = tag.content.trim();
    try {
      out.push(JSON.parse(raw));
    } catch (err) {
      out.push({ __parseError: err.message, __rawSnippet: raw.slice(0, 200) });
    }
  }
  return out;
}

// `https://mirai-shigoto.com`, `http://www.…`, `//mirai-shigoto.com` — every
// spelling of this site's origin, so a same-site absolute link is checked as
// the internal path it is.
const SITE_ORIGIN_RE = /^(?:https?:)?\/\/(?:www\.)?mirai-shigoto\.com(?::\d+)?(?=[/?#]|$)/i;

/** The in-site form of a link target, or null when it leaves the site.
 *  Root-relative, relative (`./x`, `../x`, `x`) and fragment links are kept
 *  verbatim — the caller resolves them against the page they appear on. */
function toInternalHref(raw) {
  const href = raw.trim();
  if (!href) return null;
  const origin = href.match(SITE_ORIGIN_RE);
  if (origin) {
    const rest = href.slice(origin[0].length);
    if (rest === '') return '/';
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  if (href.startsWith('//')) return null; // another host, protocol-relative
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return null; // https:, mailto:, tel:, javascript:, …
  return href;
}

const LINK_RELS = new Set(['canonical', 'alternate', 'next', 'prev']);

/** Every internal link target on the page: `<a href>`, `<link rel=
 *  canonical|alternate|next|prev href>` (2026-05-17 H20 — so hreflang /
 *  canonical drift is baselined too) and `<form action>`. */
function extractInternalLinks(html) {
  const out = new Set();
  for (const tag of startTags(html)) {
    let raw = null;
    if (tag.name === 'a') raw = tag.attrs.get('href');
    else if (tag.name === 'link' && relTokens(tag).some((rel) => LINK_RELS.has(rel))) raw = tag.attrs.get('href');
    else if (tag.name === 'form') raw = tag.attrs.get('action');
    if (raw === undefined || raw === null) continue;
    const href = toInternalHref(raw);
    if (href !== null) out.add(href);
  }
  return [...out].sort();
}

function extractAnchorIds(html) {
  const out = new Set();
  for (const tag of startTags(html)) {
    const id = tag.attrs.get('id');
    if (id) out.add(id);
  }
  return [...out].sort();
}

// ─── filesystem helpers ───────────────────────────────────────────

function walkFiles(dir, predicate) {
  const out = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        walk(p);
      } else if (ent.isFile() && predicate(p)) {
        out.push(p);
      }
    }
  }
  walk(dir);
  return out;
}

function htmlPathToUrl(absPath, distDir) {
  // dist-astro/ja/340.html → /ja/340  (cleanUrls=true in vercel.json)
  // dist-astro/index.html  → /
  const rel = path.relative(distDir, absPath).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  return '/' + rel.replace(/\.html$/, '');
}

// ─── single capture entrypoint ───────────────────────────────────

function captureBaseline(distDir, publicDir) {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html')).sort();

  const urls = [];
  const seoLines = [];
  const ogLines = [];
  const ldLines = [];
  const linkLines = [];

  for (const filePath of htmlFiles) {
    const url = htmlPathToUrl(filePath, distDir);
    urls.push(url);
    const html = fs.readFileSync(filePath, 'utf8');

    const seo = {
      url,
      title: extractTitle(html),
      description: findMetaContent(html, 'name', 'description'),
      canonical: extractCanonical(html),
      robots: findMetaContent(html, 'name', 'robots'),
      keywords: findMetaContent(html, 'name', 'keywords'),
      h1Texts: extractH1s(html),
    };
    seoLines.push(JSON.stringify(seo));

    const ogMeta = {
      url,
      og: findAllMeta(html, 'property', 'og'),
      twitter: findAllMeta(html, 'name', 'twitter'),
    };
    ogLines.push(JSON.stringify(ogMeta));

    ldLines.push(JSON.stringify({ url, ld: extractJsonLd(html) }));

    linkLines.push(JSON.stringify({
      url,
      internalHrefs: extractInternalLinks(html),
      anchorIds: extractAnchorIds(html),
    }));
  }

  const sitemapPath = path.join(distDir, 'sitemap.xml');
  const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : null;

  const imgSitemapPath = path.join(distDir, 'image-sitemap.xml');
  const imageSitemap = fs.existsSync(imgSitemapPath) ? fs.readFileSync(imgSitemapPath, 'utf8') : null;

  const dataFiles = [];
  function walkPublic(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.includes('conflicted copy')) continue;
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory() && (ent.name.startsWith('data.') || rel.startsWith('data.'))) {
        walkPublic(full, rel);
      } else if (ent.isFile() && (ent.name.startsWith('data.') || rel.startsWith('data.'))) {
        dataFiles.push(rel);
      }
    }
  }
  walkPublic(publicDir, '');
  dataFiles.sort();

  return {
    urls: [...urls].sort(),
    seoLines,
    ogLines,
    ldLines,
    linkLines,
    dataFiles,
    sitemap,
    imageSitemap,
    htmlFileCount: htmlFiles.length,
  };
}

module.exports = {
  SITE,
  decodeEntities,
  stripTags,
  findMetaContent,
  findAllMeta,
  extractTitle,
  extractCanonical,
  extractH1s,
  extractJsonLd,
  extractInternalLinks,
  extractAnchorIds,
  parseStartTags,
  toInternalHref,
  walkFiles,
  htmlPathToUrl,
  captureBaseline,
};
