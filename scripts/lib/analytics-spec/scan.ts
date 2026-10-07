import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { DynamicEmitSite, SourceFile, ScanResult } from '../../check-analytics-spec';
import { analyseSource, lineOf } from './emits';

export function createScanner(ROOT: string, fail: (message: string) => never) {

  /**
   * Every source file that calls `gtag('event', X, …)` with a non-literal `X`.
   *
   * `wrapper` — the file defines a forwarding function; its literal call sites
   * carry the real event names, so they are read from there.
   * `emits` — the name cannot be recovered statically (read from the DOM, or
   * chosen by a ternary), so the reachable names are declared here.
   *
   * Adding a new dynamic call site without adding it here fails the gate.
   */
  const DYNAMIC_EMIT_SITES: readonly DynamicEmitSite[] = [
    {
      file: 'src/pages/_shindan.js',
      wrapper: 'track',
      why: 'track(name, params) forwards to gtag; names are literals at its call sites.',
    },
    {
      file: 'src/pages/_map-inline.js',
      wrapper: 'ga',
      why: 'ga(name, params) forwards to gtag; names are literals at its call sites.',
    },
    {
      file: 'src/pages/_me-inline.js',
      wrapper: 'ga',
      why: 'ga(name, params) forwards to gtag; names are literals at its call sites.',
    },
    {
      file: 'src/components/Footer.astro',
      emits: ['jobtag_outbound_click', 'me_entry_click', 'list_row_click'],
      branchVar: 'name',
      why: 'Reads the name from <a data-track-event>, then builds params per known name.',
    },
    {
      file: 'src/pages/_index-inline.js',
      emits: ['popular_job_click', 'job_search_navigate'],
      why: 'Ternary on `source === "chip"` picks between these two literals.',
    },
  ];

  /**
   * Parameters the Edge middleware sends server-side. They never appear in a
   * `gtag()` call, so they must be read from their own definitions or the gate
   * would report every one of them as an unused dimension.
   *
   * Both anchors are required to resolve; a rename that breaks either one fails
   * the gate rather than silently dropping the parameters it can no longer find.
   */
  const SERVER_PARAM_SOURCE = 'src/lib/middleware/mp-hit.ts';
  const SERVER_PARAM_ANCHORS: readonly { readonly source: string; readonly anchor: string; readonly why: string }[] = [
    {
      source: SERVER_PARAM_SOURCE,
      anchor: 'export function buildMpPayload',
      why: 'the `params:` object of the server-side page_delivery',
    },
    {
      source: 'src/lib/middleware/geo-referral.ts',
      anchor: 'export interface GeoReferralParams',
      why: 'the geo attribution params merged in by attachDeliveryParams',
    },
  ];

  /**
   * The event the Edge middleware emits. It is not a `gtag()` call, so the scan
   * cannot see it and would report it as registered-but-never-sent.
   *
   * Read from the source instead of hard-coded here: renaming the constant in
   * code without updating spec.yaml must fail this gate, not slip past it. That
   * a server-side emit was invisible to every gate is a large part of how
   * `page_view` came to mean two different things for 18 days (#253).
   */
  function serverEventName(): string {
    const full = join(ROOT, SERVER_PARAM_SOURCE);
    if (!existsSync(full)) {
      fail(`${SERVER_PARAM_SOURCE} is missing; the server-side event name cannot be read.`);
    }
    const match = readFileSync(full, 'utf-8').match(
      /export const DELIVERY_EVENT_NAME\s*=\s*['"]([a-z0-9_]+)['"]/,
    );
    if (!match) {
      fail(
        `${SERVER_PARAM_SOURCE} no longer exports a literal DELIVERY_EVENT_NAME — ` +
          `the anchor for the server-side event name. Update serverEventName() in ` +
          `scripts/check-analytics-spec.ts so the middleware emit stays visible.`,
      );
    }
    return match![1]!;
  }

  // ─────────────────────────────── source scanning ───────────────────────────

  function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|jsx|mjs|cjs|astro|html)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          out.push(full);
        }
      }
    };
    walk(join(ROOT, 'src'));
    return out.sort();
  }

  /**
   * Returns the body of the `{…}` that starts at `open`, excluding the braces.
   * Tracks nesting and skips string literals so a `}` inside a string or a nested
   * object does not end the scan early. Returns null if unbalanced.
   */
  function balancedBraceBody(text: string, open: number): string | null {
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < text.length; i++) {
      const ch = text[i]!;
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(open + 1, i);
      }
    }
    return null;
  }

  /** Top-level keys of an object-literal body; nested objects are not descended. */
  function topLevelKeys(body: string): string[] {
    const keys: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let atKeyPosition = true;
    let token = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i]!;
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{' || ch === '[' || ch === '(') depth++;
      else if (ch === '}' || ch === ']' || ch === ')') depth--;
      else if (depth === 0) {
        if (ch === ',') {
          atKeyPosition = true;
          token = '';
          continue;
        }
        if (ch === ':') {
          if (atKeyPosition) {
            const name = token.trim().replace(/^readonly\s+/, '');
            if (/^[a-z_][a-z0-9_]*$/i.test(name)) keys.push(name);
          }
          atKeyPosition = false;
          token = '';
          continue;
        }
        if (ch === ';') {
          // interface field separator
          const name = token.trim().replace(/^readonly\s+/, '');
          if (/^[a-z_][a-z0-9_]*$/i.test(name)) keys.push(name);
          atKeyPosition = true;
          token = '';
          continue;
        }
        if (atKeyPosition) token += ch;
      }
    }
    const tail = token.trim().replace(/^readonly\s+/, '');
    if (atKeyPosition && /^[a-z_][a-z0-9_]*$/i.test(tail)) keys.push(tail);
    return keys;
  }

  function collectSources(): SourceFile[] {
    return sourceFiles().map((full) => ({
      file: relative(ROOT, full),
      text: readFileSync(full, 'utf-8'),
    }));
  }

  function scanSource(
    source: SourceFile,
    site: DynamicEmitSite | undefined,
    result: ScanResult,
    seenSites: Set<string>,
  ): void {
    const analysis = analyseSource(source.file, source.text, site);
    result.emissions.push(...analysis.emissions);
    if (analysis.undeclaredDynamic) result.undeclaredDynamic.push(source.file);
    if (analysis.dynamicSeen) seenSites.add(source.file);
    for (const { offset, reason } of analysis.unreadable) {
      result.unreadable.push(`${source.file}:${lineOf(source.text, offset)}: ${reason}`);
    }
  }

  function validateDynamicEmitSites(seenSites: ReadonlySet<string>): void {
    // A declared site that no longer has a dynamic call is stale — drop it from
    // the registry rather than leaving a rule nobody can trace to code.
    for (const site of DYNAMIC_EMIT_SITES) {
      if (!existsSync(join(ROOT, site.file))) {
        fail(
          `DYNAMIC_EMIT_SITES lists ${site.file}, which does not exist. ` +
            `Remove the entry.`,
        );
      }
      if (!seenSites.has(site.file)) {
        fail(
          `DYNAMIC_EMIT_SITES lists ${site.file}, but it has no dynamic ` +
            `gtag('event', …) call any more. Remove the entry so the registry ` +
            `keeps describing real code.`,
        );
      }
    }
  }

  function scan(sources: readonly SourceFile[]): ScanResult {
    const result: ScanResult = { emissions: [], undeclaredDynamic: [], unreadable: [] };
    const siteByFile = new Map(DYNAMIC_EMIT_SITES.map((s) => [s.file, s]));
    const seenSites = new Set<string>();
    for (const source of sources) {
      scanSource(source, siteByFile.get(source.file), result, seenSites);
    }
    validateDynamicEmitSites(seenSites);
    return { ...result, undeclaredDynamic: [...new Set(result.undeclaredDynamic)] };
  }

  function serverParams(): string[] {
    const params: string[] = [];
    for (const { source, anchor, why } of SERVER_PARAM_ANCHORS) {
      const full = join(ROOT, source);
      if (!existsSync(full)) {
        fail(`${source} is missing; server-side GA4 params cannot be read.`);
      }
      const text = readFileSync(full, 'utf-8');
      const at = text.indexOf(anchor);
      if (at < 0) {
        fail(
          `${source} no longer contains "${anchor}" — the anchor for ` +
            `${why}. It was renamed or removed; update SERVER_PARAM_ANCHORS in ` +
            `scripts/check-analytics-spec.ts so the params stay visible.`,
        );
      }
      const open = text.indexOf('{', at);
      if (open < 0) fail(`No object literal after "${anchor}" in ${source}.`);
      const body = balancedBraceBody(text, open);
      if (body === null) fail(`Unbalanced braces after "${anchor}" in ${source}.`);
      // buildMpPayload nests the params under events[0].params.
      const nested = body.indexOf('params:');
      if (anchor.includes('buildMpPayload')) {
        if (nested < 0) fail(`buildMpPayload no longer has a \`params:\` object.`);
        const nestedOpen = body.indexOf('{', nested);
        const nestedBody = balancedBraceBody(body, nestedOpen);
        if (nestedBody === null) fail(`Unbalanced \`params:\` object in buildMpPayload.`);
        params.push(...topLevelKeys(nestedBody));
      } else {
        params.push(...topLevelKeys(body));
      }
    }
    return params;
  }

  return { collectSources, scan, serverEventName, serverParams, DYNAMIC_EMIT_SITES, SERVER_PARAM_SOURCE };
}
