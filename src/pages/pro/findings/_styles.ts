/** Existing Doc surface; only Design v1.2 tokens and its three breakpoints. */
export const FINDINGS_CSS = `
#wrapper.findings-page{padding-block:var(--s-6) var(--s-8);padding-inline:var(--gutter)}
.findings{display:flex;flex-direction:column;gap:var(--s-7);min-width:0;overflow-wrap:anywhere}
.findings header,.findings section,.findings article,.findings figure{min-width:0}
.findings p{max-width:none;margin:0}
.findings h1,.findings h2,.findings h3,.findings h4{margin:0;padding:0;border:0}
.findings a{text-underline-offset:.18em;text-decoration:underline}
.findings a:focus-visible,.findings button:focus-visible{outline:2px solid var(--orange-hot);outline-offset:var(--s-1)}
.findings-crumb{display:flex;align-items:center;gap:var(--s-2);font-size:var(--t-sm);color:var(--ink-meta);min-width:0}
.findings-crumb a{color:var(--ink-meta);min-width:0}
.findings-crumb .series-crumb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.findings-header,.findings-section,.findings-claim,.findings-legal{display:flex;flex-direction:column;gap:var(--s-4)}
.findings-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-4);margin:0;padding:var(--s-5);background:var(--paper);border:1px solid var(--border);border-radius:var(--r-md)}
.findings-meta div{min-width:0;display:flex;flex-direction:column;gap:var(--s-1)}
.findings-meta dt{font-size:var(--t-xs);color:var(--ink-meta)}
.findings-meta dd{margin:0;font-size:var(--t-sm);font-family:var(--font-sans);color:var(--ink);font-variant-numeric:tabular-nums}
.findings-claims{display:flex;flex-direction:column;gap:var(--s-6)}
.findings-claim{padding-block:var(--s-5);border-top:1px solid var(--border)}
.findings-claim p a{color:var(--ink)}
.findings-notes{display:flex;flex-direction:column;gap:var(--s-3);padding:var(--s-5);background:var(--paper);border-left:3px solid var(--ink-meta);font-size:var(--t-sm);color:var(--ink)}
.findings-chart{display:flex;flex-direction:column;gap:var(--s-5);margin:0;padding:var(--s-5);background:var(--paper);border:1px solid var(--border);border-radius:var(--r-md)}
.findings-chart figcaption{display:flex;flex-direction:column;gap:var(--s-2)}
.findings-caption{font-size:var(--t-xs);color:var(--ink-meta)}
.findings-legend{display:flex;gap:var(--s-5);font-size:var(--t-sm);color:var(--ink);align-items:center}
.findings-legend span{display:flex;align-items:center;gap:var(--s-2)}
.findings-dot{display:inline-block;width:var(--s-3);height:var(--s-3);border:2px solid var(--ink-meta);border-radius:var(--r-pill);background:var(--paper)}
.findings-dot.after{border-color:var(--ink);background:var(--ink)}
.findings-plot-row{display:flex;flex-direction:column;gap:var(--s-2)}
.findings-plot-name{display:flex;justify-content:space-between;gap:var(--s-3);font-size:var(--t-sm);color:var(--ink)}
.findings-plot{position:relative;height:var(--s-8);margin-inline:var(--s-3);font-variant-numeric:tabular-nums}
.findings-plot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.findings-plot .axis{stroke:var(--border);stroke-width:1;vector-effect:non-scaling-stroke}
.findings-plot .connector{stroke:var(--ink-meta);stroke-width:2;vector-effect:non-scaling-stroke}
.findings-plot-dot{position:absolute;top:50%;transform:translate(-50%,-50%)}
.findings-plot-value{position:absolute;transform:translateX(-50%);font-size:var(--t-sm);line-height:1;color:var(--ink);white-space:nowrap}
.findings-plot-value.before{top:0;color:var(--ink-meta)}
.findings-plot-value.after{bottom:0}
.findings-axis{display:flex;justify-content:space-between;margin-inline:var(--s-3);font-size:var(--t-sm);color:var(--ink);font-variant-numeric:tabular-nums}
.findings-axis-label{font-size:var(--t-sm);color:var(--ink);text-align:center}
.findings-table{width:100%;border-collapse:collapse;font-size:var(--t-sm);font-variant-numeric:tabular-nums}
.findings-table th,.findings-table td{text-align:left;padding:var(--s-3);border-bottom:1px solid var(--border);color:var(--ink);vertical-align:top}
.findings-table thead th{font-family:var(--font-sans);font-weight:600;background:var(--paper)}
.findings-table tbody th{font-family:var(--font-sans);font-weight:600}
.findings-table td:nth-child(2),.findings-table td:nth-child(3),.findings-table td:nth-child(4){font-family:var(--font-mono);white-space:nowrap}
.findings-cards{display:none}
.findings-citation{display:flex;flex-direction:column;gap:var(--s-4);padding:var(--s-5);background:var(--paper);border:1px solid var(--border);border-radius:var(--r-md)}
.findings-bibliography{font-size:var(--t-sm);overflow-wrap:anywhere}
.findings-copy-button{min-height:44px;align-self:flex-start;padding:var(--s-3) var(--s-5);background:var(--paper);color:var(--ink);border:1px solid var(--ink-meta);border-radius:var(--r-sm);font:inherit;font-size:var(--t-sm);font-weight:600;cursor:pointer}
.findings-copy-button[hidden]{display:none}
.findings-copy-status{font-size:var(--t-sm);color:var(--ink-meta)}
.findings-downloads{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--s-4);max-width:none}
.findings-downloads li{margin:0;display:flex;flex-direction:column;gap:var(--s-1);padding-block:var(--s-3);border-bottom:1px solid var(--border);min-width:0}
.findings-downloads a{font-family:var(--font-mono);font-size:var(--t-body);color:var(--ink)}
.findings-file-meta{font-family:var(--font-mono);font-size:var(--t-xs);color:var(--ink-meta);overflow-wrap:anywhere}
.findings-sources{display:flex;flex-direction:column;gap:var(--s-4);font-size:var(--t-sm)}
.findings-evidence{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--s-3);font-size:var(--t-xs);font-family:var(--font-mono)}
.findings-evidence dd{margin:0;min-width:0}
.findings-footer-links{display:flex;flex-wrap:wrap;gap:var(--s-4)}
.findings-pager{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-4)}
.findings-pager a{padding:var(--s-4);background:var(--paper);border:1px solid var(--border);border-radius:var(--r-sm);font-size:var(--t-sm)}
.findings-latest{display:flex;flex-direction:column;gap:var(--s-5);padding:var(--s-6);background:var(--paper);border:1px solid var(--border);border-radius:var(--r-md)}
.findings-latest>a{align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;padding:var(--s-2) var(--s-5);border:1px solid var(--ink-meta);border-radius:var(--r-sm);color:var(--ink)}
.findings-legal{gap:var(--s-5)}
@media(max-width:599px){
  .findings{gap:var(--s-6)}
  .findings-chart,.findings-meta,.findings-citation,.findings-notes,.findings-latest{padding:var(--s-4)}
  .findings-table{display:none}
  .findings-cards{display:flex;flex-direction:column;gap:var(--s-3);list-style:none;margin:0;padding:0;max-width:none}
  .findings-cards li{margin:0;padding:var(--s-4);background:var(--paper);border:1px solid var(--border);border-radius:var(--r-sm)}
  .findings-cards article{display:flex;flex-direction:column;gap:var(--s-2)}
  .findings-card-score{font-size:var(--t-sm);font-variant-numeric:tabular-nums}
  .findings-card-bands{font-size:var(--t-xs);color:var(--ink-meta)}
}
`;
