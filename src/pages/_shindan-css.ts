/**
 * src/pages/_shindan-css.ts — page-specific CSS for /shindan.
 *
 * /shindan is an interactive page: the client script renders result,
 * representative occupation, and share-block DOM after scoring. The CSS is
 * injected as raw page CSS so those runtime nodes are styled without Astro
 * scoping attributes. Canonical site tokens still come from
 * canonical-css.ts; this file only references them and defines local
 * component custom properties under #wrapper.
 */
import { CANONICAL_CSS } from '@/lib/canonical-css';

const CANONICAL_TOKEN_SENTINEL = CANONICAL_CSS.includes('--content-max') ? '' : '';

export const SHINDAN_CSS = `${CANONICAL_TOKEN_SENTINEL}
*,*::before,*::after{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.75}
a{color:var(--accent-deep);text-decoration:none}
a:hover{text-decoration:underline;color:var(--accent)}
button,input{font:inherit}
#wrapper{
  --shindan-panel:var(--bg2);
  --shindan-soft:rgba(217,107,61,.08);
  --shindan-soft-strong:rgba(217,107,61,.14);
  --shindan-line:var(--border);
  --shindan-radius:8px;
  max-width:var(--content-max);
  margin:0 auto;
  padding:28px 24px 84px;
}
.shindan-crumb{font-size:.85rem;color:var(--fg2);margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid var(--border)}
.shindan-crumb a{color:var(--fg2)}
.shindan-crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}
.shindan-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,340px);gap:28px;align-items:end;margin-bottom:28px}
.shindan-kicker{display:inline-flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--accent-deep);font-size:.78rem;font-weight:700;letter-spacing:.08em}
.shindan-hero h1{font-family:var(--font-serif);font-size:clamp(1.7rem,1.1rem + 2.3vw,2.55rem);font-weight:700;line-height:1.22;letter-spacing:0;margin:0 0 12px;color:var(--fg)}
.shindan-hero h1 .accent{color:var(--accent);font-style:italic}
.shindan-lead{max-width:66ch;margin:0;color:var(--fg);font-size:1.02rem;line-height:1.8}
.shindan-proof{display:grid;gap:8px;padding:16px 18px;background:var(--shindan-panel);border:1px solid var(--border);border-radius:var(--shindan-radius)}
.shindan-proof span{display:flex;align-items:baseline;justify-content:space-between;gap:16px;color:var(--fg2);font-size:.82rem}
.shindan-proof strong{color:var(--fg);font-family:var(--font-serif);font-size:1.15rem;font-variant-numeric:tabular-nums}
.shindan-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
.shindan-panel{background:var(--shindan-panel);border:1px solid var(--border);border-radius:var(--shindan-radius);padding:22px}
.shindan-panel h2{font-family:var(--font-serif);font-size:1.18rem;font-weight:600;margin:0 0 6px;color:var(--fg)}
.shindan-panel .sub{margin:0 0 18px;color:var(--fg2);font-size:.9rem}
.shindan-status{font-size:.84rem;color:var(--fg2);margin:0 0 16px;min-height:1.5em}
.shindan-progress{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:18px}
.shindan-progress-track{height:7px;background:var(--bg3);border-radius:999px;overflow:hidden;border:1px solid var(--border)}
.shindan-progress-fill{display:block;height:100%;width:0;background:var(--accent);border-radius:999px;transition:width .18s ease}
.shindan-progress-text{font-size:.78rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.shindan-question{border:1px solid var(--border);border-radius:var(--shindan-radius);padding:16px;margin:0 0 12px;background:var(--bg)}
.shindan-question legend{padding:0;margin:0 0 12px;color:var(--fg);font-weight:600;line-height:1.6}
.shindan-question-meta{display:inline-flex;margin-right:8px;color:var(--accent-deep);font-size:.78rem;font-weight:700;font-variant-numeric:tabular-nums}
.shindan-choice-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.shindan-choice{display:block;min-width:0}
.shindan-choice input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}
.shindan-choice-text{display:flex;align-items:center;justify-content:center;min-height:58px;padding:10px 12px;border:1px solid var(--border);border-radius:7px;background:var(--bg2);color:var(--fg);font-size:.9rem;line-height:1.5;text-align:center;cursor:pointer;transition:background .14s ease,border-color .14s ease,color .14s ease}
.shindan-choice input:checked + .shindan-choice-text{background:var(--shindan-soft-strong);border-color:var(--accent);color:var(--fg);font-weight:600}
.shindan-choice input:focus-visible + .shindan-choice-text{outline:2px solid var(--accent);outline-offset:2px}
.shindan-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:18px}
.shindan-primary,.shindan-secondary,.shindan-share-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 18px;border-radius:999px;border:1px solid transparent;text-decoration:none;cursor:pointer;font-weight:700;font-size:.92rem;line-height:1.2}
.shindan-primary{background:var(--accent);color:#fff}
.shindan-primary:hover{filter:brightness(1.04);text-decoration:none;color:#fff}
.shindan-primary:disabled{opacity:.45;cursor:not-allowed;filter:none}
.shindan-secondary{background:transparent;color:var(--accent-deep);border-color:var(--border)}
.shindan-secondary:hover{border-color:var(--accent);color:var(--accent);text-decoration:none}
.shindan-side{position:sticky;top:76px;display:grid;gap:14px}
.shindan-side-note{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent-deep);border-radius:var(--shindan-radius);padding:16px;color:var(--fg2);font-size:.86rem;line-height:1.7}
.shindan-side-note strong{display:block;color:var(--fg);margin-bottom:4px}
.shindan-result{margin-top:28px}
.shindan-result[hidden]{display:none}
.shindan-result-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--shindan-radius);overflow:hidden}
.shindan-result-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start;padding:24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,var(--shindan-soft),transparent)}
.shindan-result-label{font-size:.78rem;letter-spacing:.08em;color:var(--accent-deep);font-weight:700;margin:0 0 8px}
.shindan-result-name{font-family:var(--font-serif);font-size:clamp(1.45rem,1.1rem + 1.4vw,2rem);font-weight:700;line-height:1.25;margin:0;color:var(--fg)}
.shindan-result-name>span:first-child{display:block;color:var(--fg);font-size:1em}
.shindan-result-name>span+span{display:block;color:var(--accent);font-size:.78em;margin-top:4px}
.shindan-code{display:inline-flex;align-items:center;justify-content:center;min-width:70px;min-height:44px;border-radius:7px;background:var(--accent-deep);color:#fff;font-weight:800;letter-spacing:.08em}
.shindan-result-body{padding:22px 24px 24px}
.shindan-identity{margin:0 0 16px;font-size:1rem;line-height:1.8;color:var(--fg)}
.shindan-copy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 22px}
.shindan-copy-grid div{padding:12px;border:1px solid var(--border);border-radius:7px;background:var(--bg)}
.shindan-copy-grid dt{font-size:.72rem;color:var(--fg2);font-weight:700;letter-spacing:.04em;margin-bottom:4px}
.shindan-copy-grid dd{margin:0;color:var(--fg);font-size:.86rem;line-height:1.6}
.shindan-axis-list{display:grid;gap:12px;margin:18px 0 22px}
.shindan-axis{display:grid;grid-template-columns:88px 1fr 120px;gap:12px;align-items:center}
.shindan-axis-name{font-weight:700;color:var(--fg);font-size:.9rem}
.shindan-axis-poles{display:flex;justify-content:space-between;color:var(--fg2);font-size:.76rem;margin-bottom:5px}
.shindan-axis-track{height:12px;background:var(--bg3);border:1px solid var(--border);border-radius:999px;overflow:hidden}
.shindan-axis-fill{display:block;height:100%;width:0;background:var(--accent);border-radius:999px;transition:width .2s ease}
.shindan-axis-margin{text-align:right;color:var(--fg2);font-size:.78rem;font-variant-numeric:tabular-nums}
.shindan-rarity{display:inline-flex;margin:2px 0 18px;padding:6px 12px;border-radius:999px;border:1px solid rgba(217,107,61,.34);background:var(--shindan-soft);color:var(--fg);font-size:.86rem}
.shindan-occupations{margin:4px 0 0}
.shindan-occupations h3,.shindan-share h3{font-family:var(--font-serif);font-size:1rem;font-weight:600;margin:0 0 10px;color:var(--fg)}
.shindan-occ-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.shindan-occ-list a{display:flex;flex-direction:column;gap:3px;min-height:74px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:7px;color:var(--fg);text-decoration:none}
.shindan-occ-list a:hover{border-color:var(--accent);color:var(--accent-deep)}
.shindan-occ-list small{color:var(--fg2);font-size:.74rem;font-variant-numeric:tabular-nums}
.shindan-disclaimer{margin:20px 0 0;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--accent-deep);border-radius:7px;color:var(--fg2);font-size:.82rem;line-height:1.7}
.shindan-share{margin-top:14px;padding:22px 24px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--shindan-radius)}
.shindan-share-hook{display:flex;gap:12px;align-items:flex-start;margin:0 0 14px;color:var(--fg);font-size:1rem;line-height:1.6}
.shindan-share-hook strong{display:block;color:var(--accent-deep);font-size:1.05rem}
.shindan-trophy{font-size:1.35rem;line-height:1.2}
.shindan-consent{margin:0 0 10px;color:var(--fg2);font-size:.82rem}
.shindan-share-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.shindan-share-btn{background:var(--bg);border-color:var(--border);color:var(--fg)}
.shindan-share-btn:hover{text-decoration:none;transform:translateY(-1px)}
.shindan-share-btn[data-platform="x"]{background:#111;color:#fff;border-color:#111}
.shindan-share-btn[data-platform="line"]{background:#06C755;color:#fff;border-color:#06C755}
.shindan-share-btn[data-platform="native"]{background:var(--accent-deep);color:#fff;border-color:var(--accent-deep)}
.shindan-share-btn[data-platform="copy"]{color:var(--accent-deep)}
.shindan-og-link{font-size:.82rem;color:var(--fg2)}
.shindan-toast{color:var(--accent);font-size:.82rem;opacity:0;transition:opacity .18s ease}
.shindan-toast.visible{opacity:1}
.shindan-error{padding:14px 16px;border:1px solid rgba(201,90,58,.35);border-radius:7px;background:rgba(201,90,58,.08);color:var(--fg)}
.sr-only{position:absolute;inline-size:1px;block-size:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:900px){
  .shindan-hero,.shindan-layout{grid-template-columns:1fr}
  .shindan-side{position:static}
}
@media (max-width:640px){
  #wrapper{padding:20px 16px 64px}
  .shindan-panel,.shindan-result-body,.shindan-share{padding:18px}
  .shindan-result-head{grid-template-columns:1fr;padding:20px}
  .shindan-choice-row,.shindan-copy-grid{grid-template-columns:1fr}
  .shindan-choice-text{min-height:50px}
  .shindan-axis{grid-template-columns:1fr;gap:6px}
  .shindan-axis-margin{text-align:left}
  .shindan-share-row{align-items:stretch}
  .shindan-share-btn{width:100%}
}
@media (prefers-reduced-motion:reduce){
  .shindan-progress-fill,.shindan-axis-fill,.shindan-choice-text,.shindan-share-btn,.shindan-toast{transition:none}
  .shindan-share-btn:hover{transform:none}
}
`;
