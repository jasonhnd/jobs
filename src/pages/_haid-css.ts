/**
 * Page-local CSS for /haid. Selectors are `.haid-` prefixed.
 * Tokens come from canonical-css.ts; no :root, no global element rules.
 */
export const HAID_CSS = `
.haid-rel-none     { border-left-color: var(--fg3); }
.haid-rel-tool     { border-left-color: var(--orange-hot); }
.haid-rel-presence { border-left-color: var(--green-deep); }
.haid-rel-union    { border-left-color: var(--accent-deep); }
.haid-rel-none .code     { color: var(--ink-meta); }
.haid-rel-tool .code     { color: var(--orange-hot); }
.haid-rel-presence .code { color: var(--green-deep); }
.haid-rel-union .code    { color: var(--accent-deep); }

.haid-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: .76rem; color: var(--fg2); }

.haid-boundary { display: flex; align-items: center; gap: 12px; margin: 22px 0 12px; }
.haid-boundary::before, .haid-boundary::after { content: ""; flex: 1; height: 3px; background: var(--fg); }
.haid-boundary .c { font-size: .72rem; color: var(--fg2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.haid-boundary .t { font-family: var(--font-serif); font-weight: 600; font-size: 1rem; white-space: nowrap; }

.haid-emfo .stage.s1 { border-top-color: var(--fg3); }
.haid-emfo .stage.s2 { border-top-color: var(--orange-hot); }
.haid-emfo .stage.s3 { border-top-color: var(--green-deep); }
.haid-emfo .stage.s4 { border-top-color: var(--accent-deep); }
.haid-emfo .stage .lv { margin-top: 6px; font-size: .74rem; color: var(--fg2); font-variant-numeric: tabular-nums; }

@media (max-width: 560px) {
  .haid-boundary { flex-wrap: wrap; }
  .haid-boundary .t { white-space: normal; }
}
`;
