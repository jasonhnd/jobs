/**
 * Shared List-shape row CSS (#321 atom, extracted for #328).
 *
 * The visual contract is MOBILE_SHAPES.md §3.3: numbered card, whole-row
 * tap (`.rl-row`), 15.5px name, 12.5px meta, risk pill + chevron, 44px
 * min-height. Rankings originally inlined this in
 * `src/pages/rankings/[type].astro`; later List families import the same
 * string so the atom cannot drift per template.
 *
 * Demand-pills and ranking-only extras stay page-local.
 */
export const RANK_LIST_CSS = `
.rank-list{list-style:none;counter-reset:rank;display:flex;flex-direction:column;gap:8px;margin:0;padding:0}
.rank-list li{counter-increment:rank;background:var(--bg2);border:1px solid rgba(36,30,24,.10);border-radius:12px;display:grid;grid-template-columns:32px 1fr;align-items:stretch;min-height:44px}
.rank-list li:hover{border-color:var(--accent)}
.rank-list li::before{content:counter(rank);font-family:var(--font-serif);font-size:1.05rem;font-weight:700;color:var(--fg3);display:flex;align-items:center;justify-content:center;padding-left:6px}
.rank-list li:nth-child(-n+3)::before{color:var(--accent)}
.rank-list .rl-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;min-height:44px;padding:10px 12px 10px 4px;text-decoration:none;color:inherit;border-radius:0 12px 12px 0}
.rank-list .rl-row:hover{color:inherit}
.rank-list .rl-row:hover .rl-name{color:var(--accent)}
.rank-list .rl-row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.rank-list .rl-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.rank-list .rl-name{font-family:var(--font-sans);font-size:15.5px;font-weight:600;line-height:1.3;color:var(--fg)}
.rank-list .rl-meta{font-size:12.5px;line-height:1.4;color:var(--fg2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rank-list .rl-end{display:flex;align-items:center;gap:8px;flex-shrink:0}
.rank-list .rl-chevron{color:var(--fg3);font-size:1.1rem;line-height:1}
.risk-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums}
.risk-pill.low{background:var(--risk-pill-low-bg);color:var(--risk-pill-low-fg)}
.risk-pill.mid{background:var(--risk-pill-mid-bg);color:var(--risk-pill-mid-fg)}
.risk-pill.high{background:var(--risk-pill-high-bg);color:var(--risk-pill-high-fg)}
.rl-salary,.rl-workers,.rl-extra{font-size:.82rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.rl-extra{color:var(--accent-deep);font-weight:600}
@media (max-width:600px){.rank-list li{grid-template-columns:28px 1fr}.rank-list .rl-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
`;
