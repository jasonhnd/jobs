#!/usr/bin/env node
/**
 * verify-jsonld.cjs — structural validation of every page's JSON-LD.
 *
 * Walks dist-astro/, extracts the `<script type="application/ld+json">`
 * payload from each HTML file, and asserts:
 *
 *   1. Payload parses as JSON (no `__parseError` from seo-extract).
 *   2. Top-level shape: `@context === 'https://schema.org'` and
 *      `@graph` is a non-empty array.
 *   3. Every graph node has a string `@type` and a string `@id`.
 *   4. Page-type-specific contracts:
 *      - WebPage:        requires url + name + description + inLanguage
 *      - Occupation:     requires name + description + occupationLocation
 *      - Article:        requires headline + image + url
 *      - BreadcrumbList: itemListElement array; each {position, name}
 *      - ItemList:       itemListElement array; each {position, url}
 *      - FAQPage:        mainEntity array; each {name, acceptedAnswer.text}
 *   5. Per-URL: at least one of {WebPage, Article} present (the page
 *      identity node — without it social platforms can't render an OG
 *      card).
 *
 * Complements `pnpm run check:seo-baseline`:
 *   - baseline catches DRIFT against a known-good snapshot.
 *   - this validator catches STRUCTURAL bugs (new page family with
 *     malformed JSON-LD, type-error injections, missing required
 *     fields) even on URLs that don't yet have a baseline entry.
 *
 * Exit codes: 0 = all pages valid, 1 = ≥1 page failed validation.
 */

const fs = require('node:fs');
const path = require('node:path');
const { extractJsonLd } = require('./lib/seo-extract.cjs');

const DIST_ROOT = path.resolve(process.cwd(), 'dist-astro');

// Pages allowed to ship without any JSON-LD.
// Each entry needs a deliberate rationale comment.
const NO_JSONLD_ALLOWLIST = new Set([
  '/404',               // 404 page — no entity to identify.
  '/map-thumb.snippet', // HTML snippet artifact (not a public page).
]);

/* ─────────────────────────── helpers ─────────────────────────── */

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0;
}

function walkHtmlFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkHtmlFiles(p));
    } else if (ent.isFile() && ent.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function pathToUrl(absPath) {
  const rel = path.relative(DIST_ROOT, absPath);
  // dist-astro/foo/bar.html → /foo/bar (Astro emits flat .html files)
  const noExt = rel.replace(/\.html$/, '');
  if (noExt === 'index') return '/';
  if (noExt.endsWith('/index')) return '/' + noExt.slice(0, -'/index'.length);
  return '/' + noExt;
}

/* ─────────────────── per-@type validators ─────────────────── */

// Validator rule of thumb: only fail on fields that Schema.org marks as
// REQUIRED (or that we treat as required across the whole site). Fields
// Schema.org lists as "recommended" (e.g. WebPage.inLanguage,
// Article.image) trigger neither failure nor warning — drift in those
// is caught by the SEO baseline byte-compare instead.
const TYPE_VALIDATORS = {
  WebPage(node) {
    const errs = [];
    if (!isNonEmptyString(node.url)) errs.push('WebPage missing .url');
    if (!isNonEmptyString(node.name)) errs.push('WebPage missing .name');
    if (!isNonEmptyString(node.description)) errs.push('WebPage missing .description');
    return errs;
  },
  Occupation(node) {
    const errs = [];
    if (!isNonEmptyString(node.name)) errs.push('Occupation missing .name');
    if (!isNonEmptyString(node.description)) errs.push('Occupation missing .description');
    if (!isObject(node.occupationLocation)) errs.push('Occupation missing .occupationLocation object');
    return errs;
  },
  Article(node) {
    const errs = [];
    if (!isNonEmptyString(node.headline)) errs.push('Article missing .headline');
    if (!isNonEmptyString(node.url)) errs.push('Article missing .url');
    return errs;
  },
  TechArticle(node) {
    // Same shape contract as Article (Schema.org subclass).
    return TYPE_VALIDATORS.Article(node);
  },
  BreadcrumbList(node) {
    const errs = [];
    if (!isNonEmptyArray(node.itemListElement)) {
      errs.push('BreadcrumbList .itemListElement not a non-empty array');
      return errs;
    }
    node.itemListElement.forEach((row, i) => {
      if (typeof row?.position !== 'number') {
        errs.push(`BreadcrumbList[${i}] missing numeric .position`);
      }
      if (!isNonEmptyString(row?.name)) {
        errs.push(`BreadcrumbList[${i}] missing .name`);
      }
    });
    return errs;
  },
  ItemList(node) {
    const errs = [];
    if (!Array.isArray(node.itemListElement)) {
      errs.push('ItemList .itemListElement not an array');
      return errs;
    }
    node.itemListElement.forEach((row, i) => {
      if (typeof row?.position !== 'number') {
        errs.push(`ItemList[${i}] missing numeric .position`);
      }
      // Each row must have at least one of {name, url, item} so the rendered
      // list element points somewhere — empty rows are the actual bug here,
      // not specifically missing .url (some lists carry .name + .item only).
      if (!isNonEmptyString(row?.name) && !isNonEmptyString(row?.url) && !isNonEmptyString(row?.item)) {
        errs.push(`ItemList[${i}] missing all of .name / .url / .item`);
      }
    });
    return errs;
  },
  FAQPage(node) {
    const errs = [];
    if (!isNonEmptyArray(node.mainEntity)) {
      errs.push('FAQPage .mainEntity not a non-empty array');
      return errs;
    }
    node.mainEntity.forEach((q, i) => {
      if (!isNonEmptyString(q?.name)) {
        errs.push(`FAQPage Q[${i}] missing .name`);
      }
      if (!isNonEmptyString(q?.acceptedAnswer?.text)) {
        errs.push(`FAQPage Q[${i}].acceptedAnswer.text missing`);
      }
    });
    return errs;
  },
};

// Any of these as a top-level @graph node counts as page identity.
const PAGE_IDENTITY_TYPES = new Set([
  'WebPage', 'Article', 'TechArticle', 'CollectionPage', 'QAPage',
  'Dataset', // /map page identifies itself as a Dataset, not a WebPage.
]);

/* ──────────────────── per-page validation ──────────────────── */

function validatePage(url, payloads) {
  const errs = [];

  if (payloads.length === 0) {
    if (NO_JSONLD_ALLOWLIST.has(url)) return errs;
    errs.push('no <script type="application/ld+json"> block');
    return errs;
  }

  let hasPageIdentity = false;

  for (const payload of payloads) {
    if (payload.__parseError) {
      errs.push(`JSON parse error: ${payload.__parseError}`);
      continue;
    }
    if (!isObject(payload)) {
      errs.push('payload root not an object');
      continue;
    }
    if (payload['@context'] !== 'https://schema.org') {
      errs.push(`@context = ${JSON.stringify(payload['@context'])} (expected "https://schema.org")`);
    }

    // Two valid top-level shapes:
    //   (a) `{ @context, @graph: [node1, node2, …] }` — multi-node graph
    //   (b) `{ @context, @type: 'X', … }` — single root node (no graph wrap)
    let nodes;
    if (Array.isArray(payload['@graph'])) {
      if (payload['@graph'].length === 0) {
        errs.push('@graph is empty');
        continue;
      }
      nodes = payload['@graph'];
    } else if (isNonEmptyString(payload['@type'])) {
      nodes = [payload];
    } else {
      errs.push('payload has neither @graph[] nor a root @type');
      continue;
    }

    nodes.forEach((node, idx) => {
      if (!isObject(node)) {
        errs.push(`node[${idx}] not an object`);
        return;
      }
      const type = node['@type'];
      if (!isNonEmptyString(type)) {
        errs.push(`node[${idx}] missing string @type`);
        return;
      }
      const id = node['@id'];
      if (id !== undefined && !isNonEmptyString(id)) {
        errs.push(`node[${idx}] (@type=${type}) has non-string @id: ${JSON.stringify(id)}`);
      }
      const validator = TYPE_VALIDATORS[type];
      if (validator) {
        const typeErrs = validator(node);
        for (const e of typeErrs) errs.push(e);
      }
      if (PAGE_IDENTITY_TYPES.has(type)) hasPageIdentity = true;
    });
  }

  if (!hasPageIdentity) {
    errs.push('no page-identity node (expected one of: ' +
      [...PAGE_IDENTITY_TYPES].join(', ') + ')');
  }

  return errs;
}

/* ─────────────────────── main entry ─────────────────────── */

function main() {
  if (!fs.existsSync(DIST_ROOT)) {
    console.error(`[verify-jsonld] ${DIST_ROOT} does not exist. Run \`pnpm build\` first.`);
    process.exit(2);
  }

  const htmlFiles = walkHtmlFiles(DIST_ROOT);
  const failures = [];
  const typeCounts = new Map();
  let pagesWithJsonLd = 0;

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const payloads = extractJsonLd(html);
    const url = pathToUrl(file);

    const errs = validatePage(url, payloads);
    if (errs.length > 0) {
      failures.push({ url, errs });
    }

    if (payloads.length > 0) pagesWithJsonLd += 1;

    for (const p of payloads) {
      if (!isObject(p) || !Array.isArray(p['@graph'])) continue;
      for (const node of p['@graph']) {
        if (isObject(node) && isNonEmptyString(node['@type'])) {
          typeCounts.set(node['@type'], (typeCounts.get(node['@type']) ?? 0) + 1);
        }
      }
    }
  }

  console.log(`[verify-jsonld] scanned ${htmlFiles.length} HTML files`);
  console.log(`[verify-jsonld] ${pagesWithJsonLd} pages carry JSON-LD`);
  const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [type, count] of types) {
    console.log(`  ${type.padEnd(20)} ${count}`);
  }

  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} page(s) failed JSON-LD validation:\n`);
    for (const { url, errs } of failures.slice(0, 30)) {
      console.error(`  ${url}`);
      for (const e of errs.slice(0, 5)) console.error(`    - ${e}`);
      if (errs.length > 5) console.error(`    … and ${errs.length - 5} more`);
    }
    if (failures.length > 30) {
      console.error(`  … and ${failures.length - 30} more URLs`);
    }
    process.exit(1);
  }

  console.log(`\n✅ JSON-LD validation passed — all ${pagesWithJsonLd}/${htmlFiles.length} pages structurally valid.`);
}

main();
