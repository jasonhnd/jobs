/**
 * inline-links.ts — postprocess utility for converting plaintext occupation
 * names + hub names embedded inside intro / answer text into actual <a> tags.
 *
 * Phase D of the internal-linking plan (2026-05-10):
 *   Hub intros and Q&A answers are written as plain prose. When they mention
 *   specific occupations ("看護師", "システムエンジニア") or other hubs
 *   ("AI 安全 × 高年収"), those mentions are not yet hyperlinks. This adds
 *   editorial-quality internal links — the strongest SEO signal Google gives
 *   for inline text links inside curated copy.
 *
 * Design principles:
 *   1. HTML escape FIRST, then placeholder substitute, then unescape only
 *      the inserted <a> tags. Never inject raw HTML into untrusted text.
 *   2. Longest-match wins: when "看護師" and "看護" both match, pick the
 *      longer one to avoid wrong-target links.
 *   3. Each occupation/hub linked AT MOST ONCE per text block — the second
 *      occurrence stays plain text, avoiding link-stuffing spam signals.
 *   4. Stop list: common Japanese terms that overlap with occupation names
 *      ("営業", "事務", "管理", "看護" etc.) require length >= 4 to link, OR
 *      explicit allowlist. This prevents "営業活動" being linked as 営業職.
 *   5. Boundary check: in Japanese (no whitespace), a name is a real mention
 *      only when not extended by a kanji/kana that would make it part of a
 *      longer compound. e.g., "システム" should not link inside "システムエンジニア"
 *      — longest-match handles this naturally if we sort patterns by length.
 *
 * Usage from Astro frontmatter:
 *
 *   import { inlineLinkText, buildLinkRegistry } from '../../views/inline-links';
 *   const registry = buildLinkRegistry();  // cached globally
 *   const html = inlineLinkText(plainTextIntro, registry);
 *   // html is now safe to inject via <Fragment set:html={html} /> — already escaped
 *
 * Migrated from src/data/lib/inline-links.ts 2026-05-14 (Phase B).
 * Security-adjacent: this function builds <a> tags from user-facing
 * occupation/hub names, so the HTML-escape-first then anchor-injection
 * ordering is load-bearing. Tests pin the escape behaviour.
 */
// Phase D audit #6 (2026-05-14): removed `node:fs` imports. Per doc §3.3
// views must not do I/O — `buildLinkRegistry` now takes a KnowledgeGraph
// and reads occupation names + aliases from graph.occupations instead of
// scanning public/data.detail/*.json.
import type { KnowledgeGraph } from '@/graph';

// ─── Stop list: terms that are commonly non-occupation in context ────────
//
// These are short occupation-name-roots that frequently appear in Japanese
// text as general nouns/verbs. We require length >= MIN_SHORT_LEN to link
// when a term matches one of these.
const SHORT_AMBIGUOUS_ROOTS = new Set<string>([
  '営業', '事務', '看護', '管理', '経理', '技術', '開発',
  '販売', '製造', '建設', '教育', '医師', '教師', '司会',
  '保育', '介護', '保安', '医療', '農業', '漁業', '林業',
  '料理', '配達', '運転', '操縦', '指導', '相談',
]);
const MIN_SHORT_LEN = 4;

// ─── Public types ────────────────────────────────────────────────────────

export interface LinkTarget {
  /** href to link to, e.g. "/ja/47" or "/ja/sectors/iryo" */
  href: string;
  /** the canonical name (used for length comparison) */
  name: string;
  /** which kind of target this is — used for telemetry only */
  kind: 'occupation' | 'sector' | 'ranking' | 'q' | 'compare' | 'skill' | 'interest' | 'license' | 'career' | 'genre';
  /** optional aliases that should also link to the same target */
  aliases?: ReadonlyArray<string>;
}

export interface LinkRegistry {
  /** All link patterns sorted by length DESC for longest-match-first */
  patterns: ReadonlyArray<{ pattern: string; target: LinkTarget }>;
}

// ─── Registry builder ────────────────────────────────────────────────────

// Graph-keyed cache: keys are the graph reference (typically a singleton
// per process), so within one build the registry is computed once. If the
// graph is rebuilt (e.g. tests reset state), the cache misses correctly.
const _cache = new WeakMap<KnowledgeGraph, LinkRegistry>();

/**
 * Build the full registry of link targets from all known occupations
 * + hub paths. Reads occupation names + aliases from the graph
 * (Phase D audit #6: previously file-scanned public/data.detail/*.json,
 * which violated doc §3.3). Cached per graph reference so repeated
 * page-render calls reuse the same result.
 */
export function buildLinkRegistry(graph: KnowledgeGraph): LinkRegistry {
  const cached = _cache.get(graph);
  if (cached) return cached;

  const patterns: Array<{ pattern: string; target: LinkTarget }> = [];

  // 1. Occupations + their aliases — read from graph instead of files.
  for (const [occId, occ] of graph.occupations) {
    const name = occ.titleJa;
    if (!name) continue;
    const id = occId as unknown as number;
    patterns.push({
      pattern: name,
      target: { href: `/ja/${id}`, name, kind: 'occupation' },
    });
    for (const a of occ.aliasesJa) {
      if (!a || a === name) continue;
      patterns.push({
        pattern: a,
        target: { href: `/ja/${id}`, name, kind: 'occupation', aliases: [a] },
      });
    }
  }

  // Sort by pattern length DESC, then by name ASC for stability.
  patterns.sort((a, b) => {
    if (b.pattern.length !== a.pattern.length) return b.pattern.length - a.pattern.length;
    return a.pattern.localeCompare(b.pattern);
  });

  const registry: LinkRegistry = { patterns };
  _cache.set(graph, registry);
  return registry;
}

// ─── HTML escape (must run BEFORE placeholder injection) ────────────────
// Single source of truth lives at src/lib/safe-html.ts.
import { escapeHtml } from '../lib/safe-html.js';

// ─── Core: inline-link a single text block ───────────────────────────────

export interface InlineLinkOptions {
  /** Skip linking for these occupation IDs (e.g. the current page's own id). */
  excludeIds?: ReadonlySet<number>;
  /** Maximum total links to add to this text block. Default 6. */
  maxLinks?: number;
  /** When the same occupation appears multiple times, only the first becomes a link. Default true. */
  oncePerTarget?: boolean;
  /** CSS class to apply to inserted anchors. */
  linkClass?: string;
}

/**
 * Inline-link an arbitrary text block. Returns SAFE HTML — already escaped.
 * Inject via <Fragment set:html={result} />.
 *
 *   - text: raw plain-text input (may contain < & > etc — will be escaped)
 *   - registry: from buildLinkRegistry()
 *   - opts: see InlineLinkOptions
 */
export function inlineLinkText(
  text: string,
  registry: LinkRegistry,
  opts: InlineLinkOptions = {},
): string {
  if (!text) return '';
  const maxLinks = opts.maxLinks ?? 6;
  const oncePerTarget = opts.oncePerTarget ?? true;
  const excludeIds = opts.excludeIds ?? new Set<number>();
  const linkClass = opts.linkClass ?? 'inline-link';

  // Step 1: Find all matches in the original text.
  // Iterate patterns in length-desc order. For each pattern, scan from left
  // and consume non-overlapping matches.
  interface Match {
    start: number;
    end: number;
    target: LinkTarget;
  }
  const matches: Match[] = [];
  // Track regions already claimed by an earlier (longer) match so shorter
  // patterns can't overlap with them.
  const claimed: Array<[number, number]> = [];
  const overlapsClaimed = (s: number, e: number): boolean => {
    for (const [cs, ce] of claimed) {
      if (s < ce && e > cs) return true;
    }
    return false;
  };

  const linkedHrefs = new Set<string>();
  let totalLinks = 0;

  for (const { pattern, target } of registry.patterns) {
    if (totalLinks >= maxLinks) break;

    // Stop list check: short ambiguous roots require length >= MIN_SHORT_LEN
    const hitsAmbiguousRoot = SHORT_AMBIGUOUS_ROOTS.has(pattern);
    if (hitsAmbiguousRoot && pattern.length < MIN_SHORT_LEN) continue;

    // Skip excluded occupation IDs (e.g., current page's own id)
    if (target.kind === 'occupation') {
      const m = target.href.match(/\/ja\/(\d+)$/);
      if (m && excludeIds.has(parseInt(m[1], 10))) continue;
    }

    // Skip if we already linked this target (oncePerTarget)
    if (oncePerTarget && linkedHrefs.has(target.href)) continue;

    // Find the first non-overlapping occurrence
    let from = 0;
    while (from < text.length && totalLinks < maxLinks) {
      const idx = text.indexOf(pattern, from);
      if (idx < 0) break;
      const end = idx + pattern.length;
      if (!overlapsClaimed(idx, end)) {
        matches.push({ start: idx, end, target });
        claimed.push([idx, end]);
        linkedHrefs.add(target.href);
        totalLinks++;
        break; // oncePerTarget: only first occurrence
      }
      from = idx + 1;
    }
  }

  if (!matches.length) return escapeHtml(text);

  // Step 2: Sort matches by position, build the output by interleaving
  // escaped text segments + escaped-link tags.
  matches.sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      parts.push(escapeHtml(text.slice(cursor, m.start)));
    }
    const inner = escapeHtml(text.slice(m.start, m.end));
    const href = escapeHtml(m.target.href);
    parts.push(`<a class="${linkClass}" href="${href}" data-link-kind="${m.target.kind}">${inner}</a>`);
    cursor = m.end;
  }
  if (cursor < text.length) parts.push(escapeHtml(text.slice(cursor)));

  return parts.join('');
}

// Test-only: clear the cache for a specific graph (or all entries if no
// graph passed). Phase D audit #6 (2026-05-14): cache is now a WeakMap
// keyed by graph reference, so per-test resets are explicit.
export function _clearRegistryCache(graph?: KnowledgeGraph): void {
  if (graph) _cache.delete(graph);
  // WeakMap has no clear(); test setup that needs a full wipe should
  // build a new graph reference instead of relying on this helper.
}
