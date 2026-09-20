/**
 * src/pages/_map-css.ts — page-specific CSS for /map.
 *
 * Extracted verbatim from map.astro's inline `<style slot="head"
 * is:global>` block. Step 11 partial cleanup (2026-05-13).
 *
 * NOTE on the global-scope requirement: the map page's interactive
 * script (in `<script slot="bodyEnd">`) creates DOM at runtime
 * (.map-card, .map-sector, .sheet, etc.). When CSS was inline
 * inside `<style>...</style>` without `is:global`, Astro scoped
 * selectors with `[data-astro-cid-XXX]` and the runtime-created
 * elements — which never get that attribute — rendered unstyled.
 *
 * Using `<style slot="head" set:html={MAP_PAGE_CSS} />` bypasses
 * Astro's CSS-scoping pipeline entirely (Astro injects the string
 * raw between `<style>…</style>` with no transformation), which
 * achieves the same effect as `is:global` without the attribute.
 * The SEO baseline byte-compare on /map confirms the rendered
 * `<style>` block stays byte-identical.
 *
 * Page-local sibling (Astro `_`-prefix → not routed).
 */

export const MAP_PAGE_CSS = `
    /*
     * is:global is REQUIRED here.
     * The map page's interactive script (in slot="bodyEnd") creates DOM at
     * runtime (.map-card, .map-sector, .sheet, etc.). Without is:global,
     * Astro scopes selectors with [data-astro-cid-XXX] attribute filters and
     * the runtime-created elements — which never get that attribute — render
     * unstyled. Symptom: cards lay out as a vertical text list instead of
     * the treemap grid.
     */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    /* Design.md §18.4 — no :root{} here. The block that used to sit at this
       spot redeclared --bg/--fg/--accent/--border (duplicates of canonical) and
       --font-serif with "Hiragino Mincho ProN" FIRST. It was inert only because
       canonical-css.ts is emitted after it; any change to injection order would
       have silently switched this page's serif. The three sticky-bar heights are
       genuinely page-local, so they move to html,body and inherit from there.

       The bare h1, h2 rule that followed (serif + font-weight 600) is
       gone too: canonical owns heading typeface (§4.9) and the shipped serif has
       a single weight, so declaring 600 was a claim it cannot honour (§4.5). */
    html, body {
      --h-head: 48px; --h-search: 56px; --h-chips: 52px;
      background: var(--bg); color: var(--fg);
      font-family: var(--font-sans);
      -webkit-font-smoothing: antialiased;
      line-height: 1.55; min-height: 100vh;
    }
    a { color: inherit; text-decoration: none; }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }

    .map-head {
      position: sticky; top: 0; z-index: var(--z-sticky);
      height: var(--h-head);
      display: flex; align-items: center; gap: 14px;
      padding: 0;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      transform: translate3d(0,0,0);
    }
    .map-head .back {
      display: inline-flex; align-items: center;
      font-size: var(--t-sm); color: var(--fg2);
      padding: 8px 4px; min-height: 44px; min-width: 44px;
      margin-left: -4px; /* the 4px hit-area pad must not push the text off the column's left edge (§9.1) */
    }
    .map-head .back:hover, .map-head .back:focus-visible { color: var(--orange-hot); }
    /* Heading typography lives in canonical-css.ts (§4.9). Only the page's
       own letter-spacing / margin / colour stay. canonical's !important
       already governed the size, so removing it changes nothing today. */
    .map-head h1 {
      letter-spacing: 0.01em;
      margin: 0; color: var(--fg);
    }

    .map-search {
      position: sticky; top: var(--h-head); z-index: var(--z-sticky);
      height: var(--h-search);
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0; /* on the column's text edge like the title row (§9.1) */
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      transform: translate3d(0,0,0);
    }
    .map-search-input {
      flex: 1; min-width: 0;
      height: 40px; padding: 0 14px 0 38px;
      border: 1px solid var(--border); border-radius: var(--r-pill);
      background: var(--bg2); color: var(--fg);
      font-size: var(--t-body);
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A6F5E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3'/></svg>");
      background-repeat: no-repeat; background-position: 14px center;
    }
    .map-search-input::placeholder { color: var(--fg2); }
    .map-search-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent); }
    .map-search-btn {
      height: 40px; padding: 0 16px;
      background: var(--orange-hot); color: var(--paper);
      border-radius: var(--r-pill);
      font-size: var(--t-sm); font-weight: 700; white-space: nowrap;
    }
    .map-search-btn:hover { filter: brightness(1.05); }
    .map-search-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .map-suggest {
      position: absolute; left: 16px; right: 16px;
      top: calc(var(--h-head) + 48px);
      max-height: 320px; overflow-y: auto;
      background: var(--bg2);
      border: 1px solid var(--border); border-radius: var(--r-md);
      box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 10%, transparent);
      list-style: none; z-index: var(--z-overlay); display: none;
    }
    .map-suggest.open { display: block; }
    .map-suggest li {
      padding: 10px 14px; font-size: var(--t-sm);
      cursor: pointer;
      border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; gap: 12px;
    }
    .map-suggest li:last-child { border-bottom: 0; }
    .map-suggest li:hover, .map-suggest li.focused { background: var(--bg3); }
    .map-suggest li .risk {
      color: var(--ink-meta); font-size: var(--t-xs);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }

    .map-chips-row {
      position: sticky; top: calc(var(--h-head) + var(--h-search)); z-index: var(--z-sticky);
      height: var(--h-chips);
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0 8px 0; /* column text edge (§9.1) */
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      transform: translate3d(0,0,0);
    }
    .map-chips {
      flex: 1; min-width: 0;
      display: flex; gap: 6px;
      overflow-x: auto; overflow-y: hidden;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
    }
    .map-chips::-webkit-scrollbar { display: none; }
    .map-chips .chip {
      flex: 0 0 auto;
      height: 34px; padding: 0 14px;
      border: 1px solid var(--border); border-radius: var(--r-pill);
      background: var(--bg2); color: var(--fg2);
      font-size: var(--t-sm); font-weight: 600;
      scroll-snap-align: start; white-space: nowrap;
    }
    .map-chips .chip:hover { color: var(--fg); border-color: var(--fg3); }
    .map-chips .chip.active {
      background: var(--orange-hot); color: var(--paper);
      border-color: var(--orange-hot);
    }
    .map-chips .chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .map-sort {
      flex: 0 0 auto;
      height: 34px; padding: 0 28px 0 12px;
      background: var(--bg2);
      border: 1px solid var(--border); border-radius: var(--r-md);
      color: var(--fg); font-size: var(--t-body);
      appearance: none;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A6F5E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>");
      background-repeat: no-repeat; background-position: right 8px center;
    }
    .map-view-toggle {
      flex: 0 0 auto;
      width: 34px; height: 34px;
      margin-right: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--bg2);
      border: 1px solid var(--border); border-radius: var(--r-md);
      color: var(--fg2);
    }
    .map-view-toggle:hover, .map-view-toggle:focus-visible {
      color: var(--orange-hot); border-color: var(--accent); outline: none;
    }
    .map-view-toggle[aria-pressed="true"] {
      background: var(--orange-hot); color: var(--paper); border-color: var(--orange-hot);
    }

    /* List view (Design-Mobile.md §4.13 — a11y fallback) */
    .map-list-section { margin-bottom: 24px; }
    .map-list-section h2 {
      color: var(--fg); margin: 0 4px 8px;
    }
    .map-list-section ol {
      list-style: none; counter-reset: rownum;
      padding: 4px; margin: 0;
      background: var(--bg3);
      border-radius: var(--r-md);
    }
    .map-list-section ol li { counter-increment: rownum; }
    .map-list-section ol li a {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      font-size: var(--t-sm);
      color: var(--fg);
      border-radius: var(--r-sm);
      text-decoration: none;
    }
    .map-list-section ol li a::before {
      content: counter(rownum) ".";
      flex: 0 0 32px;
      font-variant-numeric: tabular-nums;
      color: var(--ink-meta); font-size: var(--t-xs);
      text-align: right;
    }
    .map-list-section ol li a .swatch {
      flex: 0 0 12px; height: 12px;
      border-radius: var(--r-sm);
    }
    .map-list-section ol li a .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .map-list-section ol li a .stats {
      flex: 0 0 auto;
      font-size: var(--t-xs); color: var(--fg2);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .map-list-section ol li a:hover, .map-list-section ol li a:focus-visible {
      background: var(--bg2); outline: none;
    }

    main { max-width: var(--content-max); margin: 0 auto; padding: 16px var(--s-5) 96px; }
    .legend {
      display: flex; align-items: center; gap: 12px;
      margin: 4px 0 18px;
      font-size: var(--t-xs); color: var(--fg2);
      letter-spacing: 0.02em;
    }
    .legend .swatches { display: inline-flex; gap: 2px; height: 10px; border-radius: var(--r-sm); overflow: hidden; }
    .legend .swatches span { width: 14px; }
    .sector-section { margin-bottom: 28px; }
    .sector-head {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 10px; margin: 0 0 8px;
    }
    .sector-name { color: var(--fg); }
    .sector-meta { font-size: var(--t-xs); color: var(--fg2); font-variant-numeric: tabular-nums; }
    /* Squarified treemap container — cells inside are absolutely positioned
       from the JS-side layout. Background fills the inset between cell gaps. */
    .sector-canvas {
      position: relative;
      width: 100%;
      background: var(--bg3);
      border-radius: var(--r-md);
      overflow: hidden;
    }
    .cell {
      position: absolute;
      padding: 6px 8px;
      border-radius: var(--r-sm);
      color: var(--risk-fg-0);
      font-size: var(--t-xs); font-weight: 600;
      line-height: var(--lh-dense);
      cursor: pointer; overflow: hidden;
      display: flex; align-items: flex-end;
      /* Hover-only filter tween — keep it fast so the map feels responsive. */
      transition: filter 120ms cubic-bezier(0.16, 1, 0.3, 1);
      -webkit-tap-highlight-color: transparent;
      border: 0;
    }
    .cell:hover {
      filter: brightness(1.1);
      outline: 2px solid rgba(0,0,0,0.15);
      outline-offset: -2px;
      z-index: var(--z-raised);
    }
    .cell:focus-visible {
      outline: 2px solid var(--fg); outline-offset: -1px;
      z-index: var(--z-raised);
    }
    /* RA-127 — desktop hover tooltip (pointer:fine only; mobile keeps bottom sheet) */
    .cell-tooltip {
      position: fixed; z-index: var(--z-toast); pointer-events: none;
      background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r-md);
      padding: 8px 12px; max-width: 260px; font-size: var(--t-sm); line-height: var(--lh-dense);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      opacity: 0; transform: translateY(-4px);
      transition: opacity 120ms, transform 120ms;
      color: var(--fg);
    }
    .cell-tooltip[data-visible="true"] { opacity: 1; transform: translateY(0); }
    .cell-tooltip .ct-name { display: block; font-weight: 600; margin-bottom: 4px; color: var(--fg); }
    .cell-tooltip .ct-stats { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .cell-tooltip .ct-salary, .cell-tooltip .ct-workers { font-variant-numeric: tabular-nums; color: var(--fg2); font-size: var(--t-xs); }
    .cell-tooltip .ct-sector { display: block; margin-top: 4px; color: var(--fg2); font-size: var(--t-xs); }
    .cell-tooltip .risk-pill { display: inline-block; padding: 2px 10px; border-radius: var(--r-md); font-size: var(--t-xs); font-weight: 600; font-variant-numeric: tabular-nums; }
    .cell-tooltip .risk-pill.low  { background:var(--risk-pill-low-bg);color:var(--risk-pill-low-fg); }
    .cell-tooltip .risk-pill.mid  { background:var(--risk-pill-mid-bg);color:var(--risk-pill-mid-fg); }
    .cell-tooltip .risk-pill.high { background:var(--risk-pill-high-bg);color:var(--risk-pill-high-fg); }
    @media (hover: none) { .cell-tooltip { display: none !important; } }
    /* Design.md §5.7 — a tile shows its label in full or not at all. No
       ellipsis: at 11.2px, 54% of PC labels (286 of 530) and 73% of SP labels
       (257 of 350) were truncated, most down to ~5 characters, which is not
       worth reading. Tiles are area-proportional (12–633px wide) so widening
       them is not available. _map-inline.js measures the string against the
       tile's own box and omits the span when it does not fit; the tile stays
       tooltip- and tap-addressable either way (§6.6), and colour (§2.3)
       carries the meaning. */
    .cell .name {
      display: block; width: 100%;
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0,0,0,0.25);
    }
    /* Design.md §2.3 タイル前景 — the tile name is --t-xs/600, i.e. normal
       text, so it needs 4.5:1 against its own tile (§2.2). A single white for
       all five bands does not reach it, so the foreground is a per-band token:
       --risk-fg-0/4 are white on the dark ends, --risk-fg-1/2/3 are --ink on
       the light-to-mid bands (5.62 / 7.10 / 5.55). The shadow flips with it —
       a dark shadow under dark text only muddies the glyph. */
    .cell[data-band="0"] .name { color: var(--risk-fg-0); }
    .cell[data-band="4"] .name { color: var(--risk-fg-4); }
    .cell[data-band="1"] .name { color: var(--risk-fg-1); text-shadow: 0 1px 2px rgba(255,255,255,0.35); }
    .cell[data-band="2"] .name { color: var(--risk-fg-2); text-shadow: 0 1px 2px rgba(255,255,255,0.35); }
    .cell[data-band="3"] .name { color: var(--risk-fg-3); text-shadow: 0 1px 2px rgba(255,255,255,0.35); }
    .cell-others .name { opacity: 0.92; }
    /* Legacy .sector-grid kept only for the loading skeleton (below). */
    .sector-grid {
      background: var(--bg3);
      border-radius: var(--r-md);
    }

    .map-skeleton .sector-grid {
      background: var(--bg3); min-height: 88px;
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 0.85 } }
    .map-error {
      margin: 24px 4px; padding: 20px; text-align: center;
      background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r-md);
    }
    .map-error p { color: var(--fg2); margin-bottom: 12px; font-size: var(--t-sm); }
    .map-error button {
      padding: 10px 20px; background: var(--orange-hot); color: var(--paper);
      border-radius: var(--r-pill); font-weight: 700; font-size: var(--t-sm);
    }

    .sheet-backdrop {
      position: fixed; inset: 0; z-index: var(--z-overlay);
      background: color-mix(in srgb, var(--ink) 40%, transparent);
      opacity: 0; pointer-events: none;
      transition: opacity 200ms ease;
    }
    .sheet-backdrop.open { opacity: 1; pointer-events: auto; }
    .sheet {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-modal);
      background: var(--bg2);
      border-radius: var(--r-lg) var(--r-lg) 0 0;
      box-shadow: var(--sh-sheet);
      padding: 8px 20px calc(20px + env(safe-area-inset-bottom)) 20px;
      max-height: 56vh; overflow-y: auto;
      transform: translateY(100%);
      transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .sheet.open { transform: translateY(0); }
    .sheet-handle {
      display: block; width: 40px; height: 4px;
      margin: 4px auto 14px;
      background: var(--fg3); border-radius: var(--r-pill);
    }
    .sheet-close {
      position: absolute; top: 14px; right: 14px;
      width: 32px; height: 32px;
      border-radius: var(--r-pill);
      color: var(--fg2);
      font-size: var(--t-h3); line-height: 1;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--bg3);
    }
    .sheet-close:hover { color: var(--orange-hot); }
    .sheet-close::before { content: ""; position: absolute; inset: -6px; }
    /* Margin only — it keeps the title clear of the 32px close button at
       right:14px. Size / typeface / weight come from canonical (§4.9). */
    .sheet h2 { margin: 0 36px 6px 0; }
    .sheet-rank {
      display: inline-block;
      font-size: var(--t-xs); font-weight: 600;
      color: var(--accent-deep);
      margin-bottom: 14px;
    }
    .sheet-rank::before { content: ""; }
    .sheet-stats { list-style: none; margin: 12px 0 18px; }
    .sheet-stats li {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-size: var(--t-sm);
    }
    .sheet-stats li:last-child { border-bottom: 0; }
    .sheet-stats .label { color: var(--fg2); font-size: var(--t-sm); }
    .sheet-stats .value { font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }
    .sheet-cta {
      display: block; text-align: center;
      margin-top: 6px;
      padding: 14px 18px;
      background: var(--orange-hot); color: var(--paper);
      border-radius: var(--r-pill);
      font-weight: 700; font-size: var(--t-sm);
    }
    .sheet-cta:hover { filter: brightness(1.05); }
    .sheet-cta:focus-visible { outline: 2px solid var(--accent-deep); outline-offset: 3px; }

    @media (prefers-reduced-motion: reduce) {
      .sheet, .sheet-backdrop, .cell { transition: none; }
      .map-skeleton .sector-grid { animation: none; }
    }

    footer {
      max-width: var(--content-max); margin: 40px auto 0;
      padding: 24px 16px 40px;
      font-size: var(--t-xs);
    }
    .footer-links { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .footer-links a {
      padding: 6px 14px;
      border: 1px solid var(--border); border-radius: var(--r-pill);
      color: var(--fg2); font-size: var(--t-xs);
    }
    .footer-links a:hover { color: var(--orange-hot); border-color: var(--accent); }
    .footer-meta { margin-top: 14px; font-size: var(--t-xs); color: var(--ink-meta); line-height: 1.7; }
    .footer-meta em { font-style: normal; color: var(--ink); }
    .nowrap { white-space: nowrap; }
  `;
