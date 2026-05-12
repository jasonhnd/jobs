/**
 * src/lib/safe-html.ts — Layer 4 (Templates) foundation: the SafeHtml
 * branded type, the html`` template tag, and the canonical escape
 * utilities.
 *
 * Why this exists
 * ───────────────
 * Plain string + `set:html=...` is unsafe by default. Anyone writing a
 * new renderer could forget to escape a value and ship a stored-XSS
 * vector for free. The branded type narrows the responsibility: only
 * code that goes through `html\`...\`` (or one of the named "trusted"
 * constructors) produces a SafeHtml; everything else is a regular
 * string and TypeScript refuses to feed it to consumers typed against
 * SafeHtml.
 *
 * Design constraint — TypeScript brands are compile-time only
 * ──────────────────────────────────────────────────────────────
 * The brand is purely a type-level marker; at runtime SafeHtml is just
 * `string`. That means we CAN'T detect "is this string SafeHtml?" at
 * runtime to skip re-escaping. The API works around this by:
 *
 *   1. `html\`...\`` ALWAYS escapes interpolated string values.
 *      No exceptions, even if a SafeHtml is passed. Safe by default.
 *
 *   2. For composition — when you DO want already-safe fragments to
 *      flow through unescaped — use `joinSafeHtml` / `htmlList`
 *      (direct concatenation, no escape pass).
 *
 *   3. For special non-string composables (arrays of SafeHtml are a
 *      common case in render-N-items patterns), the array form on
 *      `html\`...\`` joins via element-by-element escape too — pre-
 *      build the joined SafeHtml via the helpers and interpolate as
 *      a single value if you need composition semantics.
 *
 * Migration path: 13 ad-hoc `escapeHtml` copies under src/data/lib/
 * (genre-hub, skills-hub, interests, compare-hub, ranking-renderers,
 * spoke-*-graph, inline-links) plus inline `esc` in pages each
 * re-implement the same 5-char replace. They can consolidate onto
 * `escapeHtml` from this module incrementally. New code must use this
 * module's primitives rather than building HTML by ad-hoc concat.
 *
 * Anchored in docs/architecture.md §2.4 + §6.1.
 */

// ─── Branded type ────────────────────────────────────────────────

declare const __safeHtmlBrand: unique symbol;

/**
 * A string of HTML that has been escape-checked at construction time.
 *
 * Producers (allowed):
 *   - `html\`...\``                       template tag (escapes every interpolated value)
 *   - `escapeHtml(s)`                     escape a plain string
 *   - `joinSafeHtml(items, sep?)`         concat already-safe fragments
 *   - `htmlList(cls, items, tpl)`         build a <ul> from a homogeneous list
 *   - `htmlAttr(value)`                   build a quoted attribute value
 *   - `trustedCss(css)`                   promote author-controlled CSS
 *   - `unsafeReviewedHtml(s, reason)`     audited escape hatch
 *
 * Consumer (recommended):
 *   - `<Fragment set:html={x} />`         Astro built-in; x must be SafeHtml-typed
 */
export type SafeHtml = string & { readonly [__safeHtmlBrand]: true };

// ─── Escape primitive — single source of truth ───────────────────

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const ESCAPE_RE = /[&<>"']/g;

/**
 * Escape `s` for safe embedding inside HTML text content or double-
 * quoted attribute values. Replaces &, <, >, ", and '. Returns a
 * SafeHtml so the result can be passed into consumers typed against
 * SafeHtml.
 */
export function escapeHtml(s: string): SafeHtml {
  return s.replace(ESCAPE_RE, (c) => ESCAPE_MAP[c]!) as SafeHtml;
}

// ─── Template tag — the primary constructor ──────────────────────

type Interpolatable =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<string | number | boolean | null | undefined>;

/**
 * `html\`...\`` — composable template tag that escapes every
 * interpolated value before joining it with the literal segments.
 *
 *   const name = '<script>alert(1)</script>';
 *   html\`<p>\${name}</p>\`
 *   // → SafeHtml: <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
 *
 * Interpolated values are coerced via String() then escapeHtml().
 * Arrays render element-by-element with the same escape pass.
 *
 * NOTE: `html\`...\`` does NOT pass through nested SafeHtml unescaped —
 * the brand isn't visible at runtime. To compose nested SafeHtml
 * fragments without double-escaping, use `joinSafeHtml` / `htmlList`
 * or build a single string with manual concat then cast to SafeHtml.
 *
 * Returns SafeHtml.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Interpolatable>
): SafeHtml {
  let out = '';
  for (let i = 0; i < strings.length; i += 1) {
    out += strings[i];
    if (i < values.length) {
      out += renderValue(values[i]);
    }
  }
  return out as SafeHtml;
}

function renderValue(v: Interpolatable): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    let out = '';
    for (const item of v) out += renderValue(item);
    return out;
  }
  return escapeHtml(v as string);
}

// ─── Composition helpers — concat already-safe fragments ─────────

/**
 * Join an array of SafeHtml fragments with an optional SafeHtml separator.
 * Direct concatenation — assumes every item is already escape-checked.
 * Separator defaults to empty string.
 */
export function joinSafeHtml(items: ReadonlyArray<SafeHtml>, sep: SafeHtml = '' as SafeHtml): SafeHtml {
  return items.join(sep) as SafeHtml;
}

/**
 * `<ul class="...">...</ul>` builder for a homogeneous list. Each item
 * is rendered through `itemTpl` (which must return SafeHtml) and the
 * results are concatenated without an additional escape pass.
 *
 * Returns empty SafeHtml when items is empty — no empty <ul>.
 */
export function htmlList<T>(
  className: string,
  items: ReadonlyArray<T>,
  itemTpl: (item: T) => SafeHtml,
): SafeHtml {
  if (items.length === 0) return '' as SafeHtml;
  let body = '';
  for (const item of items) body += itemTpl(item);
  // Class name still goes through the escape pass (could be user-derived).
  return (`<ul class="${escapeHtml(className)}">${body}</ul>`) as SafeHtml;
}

/**
 * For HTML attribute values, write the quotes in the template literal
 * directly — html`` already escapes the interpolated value:
 *
 *   html\`<a href="\${url}">link</a>\`
 *
 * (No dedicated `htmlAttr` helper; that would be a redundant escape
 * pass on top of html``.)
 */

// ─── Escape hatches — must include a written reason ──────────────

/**
 * Promote a pre-trusted string to SafeHtml. The string is NOT
 * escaped. This is the explicit escape hatch for legacy renderers
 * whose output is already known-safe but isn't yet routed through
 * `html\`...\``. EVERY USE MUST PASS A `reason`.
 *
 * Example: HTML fragments produced by existing audited renderers
 * (e.g. genre-hub's renderRankItem() — that function does its own
 * escaping internally and migrating it in one go was deemed risky).
 *
 * The mandatory `reason` argument shows up in grep when reviewing
 * trust boundaries and records the audit trail at the call site.
 */
export function unsafeReviewedHtml(s: string, reason: string): SafeHtml {
  // `reason` exists for human reviewers and grep. Intentionally unused at runtime.
  void reason;
  return s as SafeHtml;
}

/**
 * Promote an author-controlled CSS string to SafeHtml. CSS has its
 * own escape grammar (e.g. `\xx`), but for our use cases CSS values
 * always come from string literals in `*.ts` files, never user input.
 */
export function trustedCss(css: string): SafeHtml {
  return css as SafeHtml;
}
