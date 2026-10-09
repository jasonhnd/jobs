/** Stage-3 Hub composition, using existing Design v1.2 roles/tokens only. */
export const ORDINARY_RANKING_CSS = `
.ordinary-rankings header{margin-bottom:var(--s-4);padding-bottom:var(--s-4)}
.ordinary-rankings .crumb{margin-bottom:var(--s-4)}
.ordinary-rankings h1{margin-bottom:var(--s-3)}
.ordinary-lead{font-size:var(--t-h3);color:var(--ink);line-height:1.6;margin-bottom:var(--s-3)}
.ordinary-score-reading,.ordinary-note{font-size:var(--t-sm);color:var(--ink-2);line-height:1.6;margin-bottom:var(--s-3)}
.ordinary-search{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:var(--s-3) var(--s-5);border-radius:var(--r-pill);background:var(--orange-hot);color:var(--paper);font-size:var(--t-body);font-weight:600;text-decoration:none}
.ordinary-search:hover{background:var(--green-deep);color:var(--paper)}
.ordinary-search:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.ordinary-rankings .rk-sum{margin:var(--s-3) 0 0;color:var(--ink-2);font-size:var(--t-sm);line-height:1.6}
.ordinary-rankings .rk-sum strong{color:var(--ink);font-weight:600}
.ordinary-rankings .rk-list-sec{margin:var(--s-4) 0 var(--s-5)}
.ordinary-rankings .rk-list-sec h2{margin-bottom:var(--s-3);padding-bottom:var(--s-2)}
.ordinary-rankings .rank-list .rl-row{padding:var(--s-3) var(--s-3) var(--s-3) var(--s-1);min-width:0}
.ordinary-rankings .rank-list .rl-name{font-size:var(--t-h3);color:var(--ink);white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
.ordinary-rankings .rank-list .rl-meta{font-size:var(--t-body);color:var(--ink-2);white-space:normal;overflow:visible;line-height:1.6}
.ordinary-ranking-cards{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-4);margin:var(--s-5) 0;padding:0}
.ordinary-ranking-card{display:flex;flex-direction:column;gap:var(--s-2);height:100%;padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--paper);color:var(--ink);text-decoration:none}
.ordinary-ranking-card:hover{border-color:var(--green-deep);color:var(--ink)}
.ordinary-ranking-card h2{font-family:var(--font-serif);font-size:var(--t-h2);color:var(--ink);margin:0;padding:0;border:0}
.ordinary-ranking-card p{font-size:var(--t-body);color:var(--ink-2);line-height:1.6;margin:0}
.ordinary-ranking-card:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.ordinary-rankings [data-pro-cta]{margin:var(--s-5) 0;font-size:var(--t-body)}
@media (max-width:599px){.ordinary-ranking-cards{grid-template-columns:1fr}.ordinary-rankings .rank-list .rl-name{white-space:normal}.ordinary-rankings .rank-list .rl-end{gap:var(--s-1)}}
`;
