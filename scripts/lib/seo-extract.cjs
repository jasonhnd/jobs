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
 *   findAllMeta / decodeEntities / stripTags
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

function findMetaContent(html, attrName, attrValue) {
  const escAttr = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta\\s+${attrName}=["']${escAttr}["']\\s+content=["']([^"']*)["']`, 'i');
  const m1 = html.match(re1);
  if (m1) return decodeEntities(m1[1]);
  const re2 = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+${attrName}=["']${escAttr}["']`, 'i');
  const m2 = html.match(re2);
  if (m2) return decodeEntities(m2[1]);
  return null;
}

function findAllMeta(html, attrName, prefix) {
  const out = {};
  const re = new RegExp(
    `<meta\\s+(?:${attrName}=["']${prefix}:([^"']+)["']\\s+content=["']([^"']*)["']|content=["']([^"']*)["']\\s+${attrName}=["']${prefix}:([^"']+)["'])`,
    'gi',
  );
  let m;
  while ((m = re.exec(html)) !== null) {
    const key = m[1] || m[4];
    const val = m[2] !== undefined ? m[2] : m[3];
    if (key !== undefined && val !== undefined) {
      out[`${prefix}:${key}`] = decodeEntities(val);
    }
  }
  return out;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1]).trim() : null;
}

function extractCanonical(html) {
  const re1 = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i;
  const m1 = html.match(re1);
  if (m1) return decodeEntities(m1[1]);
  const re2 = /<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i;
  const m2 = html.match(re2);
  if (m2) return decodeEntities(m2[1]);
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
  const re = /<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      out.push(JSON.parse(raw));
    } catch (err) {
      out.push({ __parseError: err.message, __rawSnippet: raw.slice(0, 200) });
    }
  }
  return out;
}

function extractInternalLinks(html) {
  const out = new Set();
  const re = /<a\b[^>]*?\bhref=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = decodeEntities(m[1]);
    if (
      href.startsWith('/') ||
      href.startsWith(SITE) ||
      href.startsWith('./') ||
      href.startsWith('#')
    ) {
      const norm = href.startsWith(SITE) ? href.slice(SITE.length) || '/' : href;
      out.add(norm);
    }
  }
  return [...out].sort();
}

function extractAnchorIds(html) {
  const out = new Set();
  const re = /\bid=["']([a-zA-Z][\w:.\-]*)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.add(m[1]);
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
  walkFiles,
  htmlPathToUrl,
  captureBaseline,
};
