/**
 * Page-local CSS for /haid, layered on CANONICAL_DOC_CSS.
 *
 * Only adds what the shared document CSS lacks: relation colouring on the
 * level cards, the three heavier relation-boundary rows, and the per-level
 * window / certainty meta line. Keep every selector prefixed `.haid-`.
 */
export const HAID_CSS = `
.haid-rel-none{border-left-color:var(--fg3)}
.haid-rel-none .code{color:var(--fg3)}
.haid-rel-tool{border-left-color:var(--accent)}
.haid-rel-tool .code{color:var(--accent)}
.haid-rel-presence{border-left-color:var(--green-deep)}
.haid-rel-presence .code{color:var(--green-deep)}
.haid-rel-union{border-left-color:var(--accent-deep)}
.haid-rel-union .code{color:var(--accent-deep)}

.haid-meta{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:.76rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.haid-meta span::before{content:"";display:inline-block;width:6px;height:6px;border-radius:999px;background:var(--border);margin-right:6px;vertical-align:middle}

.haid-boundary{display:flex;align-items:center;gap:12px;margin:18px 0 10px;padding:0 4px}
.haid-boundary::before,.haid-boundary::after{content:"";flex:1 1 0;height:3px;background:var(--fg);opacity:.75;border-radius:2px}
.haid-boundary .t{font-family:var(--font-serif);font-weight:600;font-size:.98rem;color:var(--fg);white-space:nowrap}
.haid-boundary .c{font-size:.72rem;color:var(--fg2);font-variant-numeric:tabular-nums;white-space:nowrap}

.haid-emfo .stage.s1{border-top-color:var(--fg3)}
.haid-emfo .stage.s2{border-top-color:var(--accent)}
.haid-emfo .stage.s3{border-top-color:var(--green-deep)}
.haid-emfo .stage.s4{border-top-color:var(--accent-deep)}
.haid-emfo .stage .lv{font-size:.72rem;color:var(--fg2);margin-top:6px;font-variant-numeric:tabular-nums}

.haid-cases td.lv{white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:600}
.haid-cases td.note{color:var(--fg2);font-size:.84rem}

@media (max-width:560px){
  .haid-boundary{flex-wrap:wrap}
  .haid-boundary .t{white-space:normal}
}
`;
