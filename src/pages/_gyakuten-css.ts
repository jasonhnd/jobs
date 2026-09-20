/**
 * src/pages/_gyakuten-css.ts — page-specific CSS for /gyakuten.
 *
 * Static front-door page for AI働き方診断. Canonical site tokens are emitted
 * globally by canonical-css.ts; this file references those tokens and keeps
 * family accents scoped to page components.
 */
export const GYAKUTEN_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.75}
a{color:var(--accent-deep);text-decoration:none}
a:hover{color:var(--orange-hot);text-decoration:underline}
#wrapper{max-width:var(--content-max);margin:0 auto;padding:28px var(--s-5) 84px}
.gyakuten-crumb{font-size:var(--t-sm);color:var(--fg2);margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid var(--border)}
.gyakuten-crumb a{color:var(--fg2)}
.gyakuten-crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}
.gyakuten-hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:32px;align-items:end;margin:0 0 32px}
.gyakuten-kicker{display:inline-flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--accent-deep);font-size:var(--t-xs);font-weight:700;letter-spacing:0}
.gyakuten-hero h1{letter-spacing:0;margin:0 0 14px;color:var(--fg)}
.gyakuten-hero h1 .accent{color:var(--ink)}
.gyakuten-lead{max-width:68ch;margin:0;color:var(--fg);font-size:var(--t-h3);line-height:1.85}
.gyakuten-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;align-items:center}
.gyakuten-primary,.gyakuten-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border-radius:999px;border:1px solid transparent;font-weight:700;font-size:var(--t-sm);line-height:1.2;text-decoration:none}
.gyakuten-primary{background:var(--orange-hot);color:var(--paper)}
.gyakuten-primary:hover{filter:brightness(1.04);color:var(--paper);text-decoration:none}
.gyakuten-secondary{background:var(--bg2);color:var(--accent-deep);border-color:var(--border)}
.gyakuten-secondary:hover{border-color:var(--accent);color:var(--orange-hot);text-decoration:none}
.gyakuten-proof{display:grid;gap:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:18px}
.gyakuten-proof span{display:flex;align-items:baseline;justify-content:space-between;gap:18px;color:var(--fg2);font-size:var(--t-xs)}
.gyakuten-proof strong{font-family:var(--font-serif);color:var(--fg);font-size:var(--t-h2);font-variant-numeric:tabular-nums}
.gyakuten-section{margin:44px 0}
.gyakuten-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.gyakuten-section-head h2{letter-spacing:0;margin:0;color:var(--fg)}
.gyakuten-section-head p{max-width:58ch;margin:0;color:var(--fg2);font-size:var(--t-sm);line-height:1.7}
.family-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.family-card{--family-accent:var(--accent);--family-soft:color-mix(in srgb, var(--orange) 8%, transparent);background:var(--bg2);border:1px solid var(--border);border-top:4px solid var(--family-accent);border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:16px;min-width:0}
.family-card-head{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
.family-card h3{letter-spacing:0;margin:0;color:var(--fg)}
.family-share{margin:4px 0 0;color:var(--fg2);font-size:var(--t-sm);line-height:1.65}
.family-rarity{display:inline-flex;width:max-content;padding:5px 11px;border-radius:999px;background:var(--family-soft);border:1px solid color-mix(in srgb,var(--family-accent) 34%,transparent);color:var(--fg);font-size:var(--t-xs);font-variant-numeric:tabular-nums}
.family-copy-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}
.family-copy-grid div{padding:12px;border:1px solid var(--border);border-radius:7px;background:var(--bg)}
.family-copy-grid dt{font-size:var(--t-xs);color:var(--fg2);font-weight:700;margin:0 0 4px;letter-spacing:0}
.family-copy-grid dd{margin:0;color:var(--fg);font-size:var(--t-sm);line-height:1.65}
.family-occ h4{margin:0 0 8px;color:var(--fg);letter-spacing:0}
.family-occ-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.family-occ-list a{display:flex;flex-direction:column;gap:3px;min-height:66px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:7px;color:var(--fg);text-decoration:none}
.family-occ-list a:hover{border-color:var(--family-accent);color:var(--accent-deep);text-decoration:none}
.family-occ-list small{color:var(--fg2);font-size:var(--t-xs);font-variant-numeric:tabular-nums}
.zukan{display:grid;gap:28px}
.zukan-family{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start;padding-bottom:26px;border-bottom:1px solid var(--border)}
.zukan-family:last-child{border-bottom:0;padding-bottom:0}
.zukan-family-head{position:sticky;top:76px}
.zukan-family-head h3{letter-spacing:0;margin:0 0 8px;color:var(--fg)}
.zukan-family-head p{margin:0;color:var(--fg2);font-size:var(--t-sm);line-height:1.6}
.variant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.variant-card{--family-accent:var(--accent);min-height:164px;border:1px solid var(--border);border-radius:8px;background:linear-gradient(180deg,color-mix(in srgb, var(--paper) 70%, transparent),color-mix(in srgb, var(--cream-2) 46%, transparent));padding:16px;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden;filter:grayscale(.75);opacity:.74}
.variant-card::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:var(--family-accent);opacity:.55}
.variant-status{display:inline-flex;width:max-content;max-width:100%;padding:4px 9px;border-radius:999px;background:var(--bg3);border:1px solid var(--border);color:var(--fg2);font-size:var(--t-xs);font-weight:700;line-height:1.2}
.variant-card h4{letter-spacing:0;margin:0;color:var(--fg)}
.variant-card p{margin:0;color:var(--fg2);font-size:var(--t-sm);line-height:1.65}
.variant-card .variant-lock{margin-top:auto;color:var(--ink-meta);font-size:var(--t-xs);line-height:1.5}
.pair-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pair-card{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px}
.pair-card h3{letter-spacing:0;margin:0 0 8px;color:var(--fg)}
.pair-card p{margin:0;color:var(--fg2);font-size:var(--t-sm);line-height:1.7}
.final-cta{margin:46px 0 18px;padding:26px 28px;background:var(--fg);border-radius:8px;color:var(--bg);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:center}
.final-cta h2{letter-spacing:0;margin:0 0 8px;color:var(--bg)}
.final-cta p{margin:0;color:color-mix(in srgb, var(--cream) 86%, transparent);font-size:var(--t-sm);line-height:1.75}
.final-cta .gyakuten-primary{background:var(--orange-soft);color:var(--fg)}
.final-cta .gyakuten-primary:hover{background:var(--paper);color:var(--fg)}
.gyakuten-note{margin:18px 0 0;padding:13px 15px;background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent-deep);border-radius:7px;color:var(--fg2);font-size:var(--t-xs);line-height:1.7}
.family-cpb{--family-accent:#D96B3D;--family-soft:color-mix(in srgb, var(--orange) 9%, transparent)}
.family-cpk{--family-accent:#8D6E63;--family-soft:rgba(141,110,99,.1)}
.family-cdb{--family-accent:#D4A749;--family-soft:rgba(212,167,73,.12)}
.family-cdk{--family-accent:#4E8FA8;--family-soft:rgba(78,143,168,.1)}
.family-rpb{--family-accent:#6E9B89;--family-soft:color-mix(in srgb, var(--accent-2) 12%, transparent)}
.family-rpk{--family-accent:#B26D3D;--family-soft:rgba(178,109,61,.1)}
.family-rdb{--family-accent:#5F8F6B;--family-soft:rgba(95,143,107,.12)}
.family-rdk{--family-accent:#7A6F5E;--family-soft:color-mix(in srgb, var(--fg2) 12%, transparent)}
@media (max-width:960px){
  .gyakuten-hero,.family-grid,.final-cta{grid-template-columns:1fr}
  .zukan-family{grid-template-columns:1fr}
  .zukan-family-head{position:static}
}
@media (max-width:720px){
  #wrapper{padding:20px 16px 64px}
  .gyakuten-hero h1{}
  .gyakuten-section-head{display:block}
  .gyakuten-section-head p{margin-top:8px}
  .family-copy-grid,.family-occ-list,.variant-grid,.pair-grid{grid-template-columns:1fr}
  .family-card{padding:18px}
  .final-cta{padding:22px 20px}
  .final-cta .gyakuten-primary{width:100%}
}
`;
