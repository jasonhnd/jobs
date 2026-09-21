/**
 * Page-local CSS for /aiadoption (HAID current-state page, aiadoption-1.3).
 *
 * Scoped to .haid-page. Tokens only (Design.md §0); no :root, no raw values.
 * Colours: the four relations use palette tokens, never a chart palette of
 * their own (§5.6). Tints derive from tokens with color-mix (§2.5).
 * Zero JS: the map cell highlight is :target, the list rows are <details>.
 */
export const AI_ADOPTION_CSS = `
.haid-page {
  box-sizing: border-box;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--s-6) var(--gutter) var(--s-8);
  color: var(--ink);
}
.haid-page * { box-sizing: border-box; }
.haid-page a { color: var(--orange-hot); text-decoration: none; }
.haid-page a:hover { text-decoration: underline; }

.haid-page .crumb { display: flex; flex-wrap: wrap; gap: var(--s-2); align-items: center; margin: 0 0 var(--s-5); color: var(--ink-meta); font-size: var(--t-sm); line-height: var(--lh-dense); }
.haid-page .crumb a { color: var(--ink-meta); }
.haid-page .crumb a:hover { color: var(--orange-hot); }
.haid-page .crumb span[aria-hidden] { color: var(--ink-4); }

/* ── header ── */
.haid-page h1 { margin: 0 0 var(--s-3); letter-spacing: 0; color: var(--ink); }
.haid-page .haid-lead { max-width: 820px; margin: 0 0 var(--s-2); color: var(--ink-2); font-size: var(--t-h3); line-height: var(--lh-h3); }
.haid-page .haid-lead .num { font-family: var(--font-serif); font-size: var(--t-h2); line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
.haid-page .haid-lead .unit { font-size: var(--t-sm); color: var(--ink-2); }
.haid-page .haid-meta { display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-3); margin: 0 0 var(--s-5); color: var(--ink-meta); font-size: var(--t-sm); line-height: var(--lh-dense); }
.haid-page .haid-meta a { color: var(--orange-hot); }
.haid-page .haid-meta span + span::before { content: "・"; margin-right: var(--s-2); color: var(--ink-4); }
.haid-page .haid-draft { display: inline-block; padding: 0 var(--s-2); border-radius: var(--r-md); background: var(--orange-soft); color: var(--orange-hot); font-size: var(--t-xs); font-weight: 600; line-height: 20px; }
.haid-page .haid-draft-note { margin: 0 0 var(--s-5); color: var(--ink-2); font-size: var(--t-sm); }

/* ── card ── */
.haid-page .haid-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-lg); padding: var(--s-5); margin: 0 0 var(--s-5); box-shadow: var(--sh-card); }
.haid-page .haid-card h2 { margin: 0 0 var(--s-3); color: var(--ink); }
.haid-page .haid-intro { max-width: 760px; margin: 0 0 var(--s-4); color: var(--ink-2); font-size: var(--t-sm); line-height: var(--lh-body); }

/* ── legend ── */
.haid-page .haid-legend { display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-4); margin: 0 0 var(--s-2); color: var(--ink-2); font-size: var(--t-sm); line-height: var(--lh-dense); }
.haid-page .haid-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: var(--s-1); }

/* ── map ── */
.haid-page .haid-map { position: relative; width: 100%; aspect-ratio: 2 / 1; border-radius: var(--r-md); overflow: hidden; background: var(--cream); }
.haid-page .haid-col { position: absolute; top: 0; height: 100%; }
.haid-page .haid-cell {
  position: absolute; left: 0; width: 100%;
  display: block; padding: var(--s-2) var(--s-3);
  color: var(--ink); text-decoration: none; overflow: hidden;
  box-shadow: inset 0 0 0 2px var(--cream);
  border-radius: var(--r-sm);
  scroll-margin-top: 140px;
}
.haid-page .haid-cell:hover { text-decoration: none; filter: brightness(0.97); }
.haid-page .haid-cell:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; z-index: var(--z-raised); }
.haid-page .haid-cell .no { display: block; font-family: var(--font-serif); font-size: var(--t-h2); line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
.haid-page .haid-cell .nm { display: block; margin-top: var(--s-1); font-size: var(--t-sm); font-weight: 600; line-height: var(--lh-dense); color: var(--ink); }
.haid-page .haid-cell .n { display: block; margin-top: var(--s-1); font-size: var(--t-xs); line-height: var(--lh-dense); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.haid-page .haid-cell.dark .no, .haid-page .haid-cell.dark .nm { color: var(--paper); }
.haid-page .haid-cell.dark .n { color: var(--cream-2); }
.haid-page .haid-cell.thin { padding: 2px var(--s-3); }
.haid-page .haid-cell.thin .no, .haid-page .haid-cell.thin .nm, .haid-page .haid-cell.thin .n { display: inline; margin: 0 var(--s-2) 0 0; }
.haid-page .haid-cell.thin .no { font-size: var(--t-body); }
.haid-page .haid-cell.hatched { padding: var(--s-2) 0; text-align: center; }
.haid-page .haid-cell.hatched .no { font-family: var(--font-sans); font-size: var(--t-xs); font-weight: 600; color: var(--ink-meta); }
.haid-page .haid-cell.hatched .nm, .haid-page .haid-cell.hatched .n { display: none; }

/* relation colours — palette tokens only (§5.6) */
.haid-page .haid-cell.rel-none.lv-1 { background: var(--ink-4); }
.haid-page .haid-cell.rel-none.lv-2 { background: color-mix(in srgb, var(--ink-4) 55%, var(--paper)); }
.haid-page .haid-cell.rel-tool.lv-3 { background: var(--orange-soft); }
.haid-page .haid-cell.rel-tool.lv-4 { background: color-mix(in srgb, var(--orange) 55%, var(--paper)); }
.haid-page .haid-cell.rel-tool.lv-5 { background: var(--orange); }
.haid-page .haid-cell.rel-tool.lv-6 { background: var(--orange-hot); }
.haid-page .haid-cell.rel-presence { background: repeating-linear-gradient(45deg, var(--paper) 0 4px, color-mix(in srgb, var(--green) 40%, var(--paper)) 4px 8px); }
.haid-page .haid-cell.rel-union { background: repeating-linear-gradient(45deg, var(--paper) 0 4px, var(--purple-soft) 4px 8px); }
.haid-page .haid-legend .sw-none { background: var(--ink-4); }
.haid-page .haid-legend .sw-tool { background: var(--orange); }
.haid-page .haid-legend .sw-presence { background: repeating-linear-gradient(45deg, var(--paper) 0 3px, color-mix(in srgb, var(--green) 40%, var(--paper)) 3px 6px); border: 1px solid var(--ink-4); }
.haid-page .haid-legend .sw-union { background: repeating-linear-gradient(45deg, var(--paper) 0 3px, var(--purple-soft) 3px 6px); border: 1px solid var(--ink-4); }

/* boundaries: the three relation edges, thick; dashed next to a 下限のみ level */
.haid-page .haid-bd { position: absolute; top: 0; height: 100%; width: 0; border-left: 3px solid var(--ink); margin-left: -1.5px; z-index: var(--z-raised); pointer-events: none; }
.haid-page .haid-bd.dashed { border-left-style: dashed; }

/* :target — the diagnosis page lands here with #dan-<k> */
.haid-page .haid-cell:target { outline: 3px solid var(--ink); outline-offset: -3px; z-index: var(--z-raised); }
.haid-page .haid-cell .pin { display: none; position: absolute; right: var(--s-2); top: var(--s-2); max-width: calc(100% - var(--s-4)); padding: 0 var(--s-3); border-radius: var(--r-pill); background: var(--ink); color: var(--paper); font-size: var(--t-xs); font-weight: 600; line-height: 22px; white-space: nowrap; overflow: hidden; }
.haid-page .haid-cell:target .pin { display: block; }

.haid-page .haid-bounds { display: flex; flex-wrap: wrap; gap: var(--s-1) var(--s-5); margin: var(--s-3) 0 0; color: var(--ink-2); font-size: var(--t-sm); line-height: var(--lh-dense); }
.haid-page .haid-bounds span::before { content: ""; display: inline-block; width: 18px; height: 3px; background: var(--ink); vertical-align: middle; margin-right: var(--s-2); }
.haid-page .haid-bounds span.dashed::before { background: repeating-linear-gradient(90deg, var(--ink) 0 4px, transparent 4px 7px); }
.haid-page .haid-bounds b { color: var(--ink); font-weight: 700; }
.haid-page .haid-note { margin: var(--s-2) 0 0; color: var(--ink-2); font-size: var(--t-sm); line-height: var(--lh-body); }

/* ── list ── */
.haid-page .haid-group { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s-3); margin: var(--s-4) 0 var(--s-1); padding-top: var(--s-3); border-top: 1px solid var(--line); }
.haid-page .haid-group:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
.haid-page .haid-group h3 { margin: 0; color: var(--ink); }
.haid-page .haid-group h3 span { margin-left: var(--s-2); color: var(--ink-meta); font-size: var(--t-sm); font-weight: 400; }
.haid-page .haid-group .g { color: var(--ink-meta); font-size: var(--t-sm); font-variant-numeric: tabular-nums; white-space: nowrap; }
.haid-page .haid-boundary-row { display: flex; align-items: center; gap: var(--s-3); margin: var(--s-3) 0 var(--s-1); color: var(--ink-2); font-size: var(--t-sm); }
.haid-page .haid-boundary-row::before { content: ""; flex: 0 0 26px; height: 3px; background: var(--ink); }
.haid-page .haid-boundary-row b { color: var(--ink); font-weight: 700; }

.haid-page details.haid-row { border-radius: var(--r-md); }
.haid-page details.haid-row[open] { background: var(--cream-2); }
.haid-page details.haid-row > summary {
  list-style: none; cursor: pointer;
  display: grid; grid-template-columns: 56px 180px minmax(0, 1fr) 110px; gap: var(--s-3); align-items: center;
  padding: var(--s-2) var(--s-3); border-radius: var(--r-md);
}
.haid-page details.haid-row > summary::-webkit-details-marker { display: none; }
.haid-page details.haid-row > summary:hover { background: var(--cream-2); }
.haid-page details.haid-row > summary:focus-visible { outline: 2px solid var(--orange-hot); outline-offset: 2px; }
.haid-page .haid-row .code { color: var(--ink-meta); font-size: var(--t-sm); font-weight: 600; font-variant-numeric: tabular-nums; }
.haid-page .haid-row .name { color: var(--ink); font-size: var(--t-body); font-weight: 600; line-height: var(--lh-dense); }
.haid-page .haid-row .track { position: relative; height: 12px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--ink-4) 30%, var(--paper)); overflow: hidden; }
.haid-page .haid-row .fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: var(--r-sm); }
.haid-page .haid-row .fill.lower { border-radius: var(--r-sm) 0 0 var(--r-sm); }
.haid-page .haid-row .ext { position: absolute; top: 0; height: 100%; width: 12%; background: repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in srgb, var(--orange-hot) 35%, transparent) 4px 8px); }
.haid-page .haid-row.rel-none .fill { background: var(--ink-4); }
.haid-page .haid-row.rel-tool .fill { background: var(--orange); }
.haid-page .haid-row .val { text-align: right; line-height: var(--lh-dense); }
.haid-page .haid-row .val .v { display: block; font-family: var(--font-serif); font-size: var(--t-h3); color: var(--ink); font-variant-numeric: tabular-nums; }
.haid-page .haid-row .val .c { display: block; color: var(--ink-meta); font-size: var(--t-xs); }
.haid-page .chip { display: inline-block; padding: 0 var(--s-3); border-radius: var(--r-pill); background: var(--cream-2); color: var(--ink-meta); font-size: var(--t-xs); font-weight: 600; line-height: 22px; white-space: nowrap; }
.haid-page .chip.lower { background: var(--orange-soft); color: var(--orange-hot); }
.haid-page .chip.range { background: var(--orange-soft); color: var(--orange-hot); }

.haid-page .haid-detail { display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--s-5); padding: var(--s-2) var(--s-3) var(--s-4); }
.haid-page .haid-detail h4 { margin: 0 0 var(--s-1); }
.haid-page .haid-detail p { margin: 0 0 var(--s-3); font-size: var(--t-sm); line-height: var(--lh-body); color: var(--ink); }
.haid-page .haid-detail ol { margin: 0; padding: 0; list-style: none; }
.haid-page .haid-detail li { display: grid; grid-template-columns: 1fr auto; gap: var(--s-2); padding: var(--s-1) 0; border-bottom: 1px solid var(--line); font-size: var(--t-sm); line-height: var(--lh-dense); }
.haid-page .haid-detail li:last-child { border-bottom: 0; }
.haid-page .haid-detail li .src { color: var(--ink-2); }
.haid-page .haid-detail li .amt { color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.haid-page .haid-detail .def { font-size: var(--t-sm); }

/* ── two-up: delta + anchors ── */
.haid-page .haid-two { display: grid; grid-template-columns: 1fr 1.4fr; gap: var(--s-5); }
.haid-page .haid-two .haid-card { margin: 0; }
.haid-page table.haid-anchors { width: 100%; border-collapse: collapse; font-size: var(--t-sm); }
.haid-page table.haid-anchors th { padding: var(--s-1) var(--s-2); text-align: left; color: var(--ink-meta); font-weight: 600; border-bottom: 1px solid var(--line); white-space: nowrap; }
.haid-page table.haid-anchors td { padding: var(--s-2); border-bottom: 1px solid var(--line); vertical-align: top; color: var(--ink); }
.haid-page table.haid-anchors td.num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.haid-page table.haid-anchors td.dt { white-space: nowrap; color: var(--ink-2); }
.haid-page table.haid-anchors .grade { display: inline-block; min-width: 20px; text-align: center; border-radius: var(--r-sm); background: var(--cream-2); color: var(--ink-meta); font-size: var(--t-xs); font-weight: 600; line-height: 20px; }
.haid-page .wrap-x { overflow-x: auto; }

/* ── fact ── */
.haid-page .haid-fact { margin: var(--s-5) 0; padding: var(--s-4) var(--s-5); background: var(--paper); border: 1px solid var(--line); border-left: 4px solid var(--orange-hot); border-radius: var(--r-md); font-size: var(--t-sm); line-height: var(--lh-body); color: var(--ink); }
.haid-page .haid-fact strong { color: var(--ink); font-weight: 700; }
.haid-page .haid-foot { margin: var(--s-5) 0 0; color: var(--ink-2); font-size: var(--t-sm); line-height: var(--lh-body); }

/* ── sp / tb ── */
@media (max-width: 899px) {
  .haid-page .haid-two { grid-template-columns: 1fr; }
  .haid-page .haid-detail { grid-template-columns: 1fr; }
}
@media (max-width: 599px) {
  .haid-page { padding: var(--s-4) var(--gutter) var(--s-7); }
  .haid-page .haid-card { padding: var(--s-4); }
  .haid-page .haid-map { aspect-ratio: 1 / 1; }
  .haid-page .haid-cell { padding: var(--s-1) var(--s-2); }
  .haid-page .haid-cell .no { font-size: var(--t-h3); }
  .haid-page .haid-cell .nm { font-size: var(--t-xs); }
  .haid-page .haid-cell.thin { padding: 0 var(--s-2); }
  .haid-page .haid-cell.thin .nm, .haid-page .haid-cell.thin .n { display: none; }
  .haid-page .haid-cell.thin .no { font-size: var(--t-xs); }
  /* A narrow column cannot hold the pin; let it hang out over the neighbour. */
  .haid-page .haid-cell:target { overflow: visible; }
  .haid-page .haid-cell .pin { left: auto; right: var(--s-1); top: var(--s-1); max-width: none; padding: 0 var(--s-2); overflow: visible; }
  .haid-page .haid-col.narrow .haid-cell .n { display: none; }
  .haid-page .haid-col.narrow .haid-cell { padding: var(--s-1); }
  .haid-page details.haid-row > summary { grid-template-columns: 48px minmax(0, 1fr) 92px; grid-template-areas: "c n v" "c t t"; gap: var(--s-1) var(--s-2); }
  .haid-page .haid-row .code { grid-area: c; }
  .haid-page .haid-row .name { grid-area: n; }
  .haid-page .haid-row .track { grid-area: t; }
  .haid-page .haid-row .val { grid-area: v; }
  .haid-page table.haid-anchors th, .haid-page table.haid-anchors td { padding: var(--s-1); }
}
`;
