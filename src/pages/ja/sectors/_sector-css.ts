/**
 * src/pages/ja/sectors/_sector-css.ts — page-specific CSS for
 * /ja/sectors/[sector] hub pages.
 *
 * Extracted verbatim from [sector].astro's inline
 * `<style slot="head" is:inline>` block. Byte-equivalent output
 * is required for the SEO baseline byte-compare; the legacy
 * `is:inline` attribute is dropped because `set:html` already
 * skips Astro's CSS-scoping pipeline (Astro injects the string
 * raw between `<style>…</style>`).
 *
 * Page-local sibling (Astro `_`-prefix → not routed).
 */

export const SECTOR_PAGE_CSS = `*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10);--font-serif:"Noto Serif JP","Source Serif Pro",Georgia,serif;--font-sans:"Plus Jakarta Sans","Hiragino Sans",-apple-system,BlinkMacSystemFont,"Yu Gothic UI","Segoe UI",Roboto,sans-serif}
/* Direction C single-theme: prefers-color-scheme + data-theme all resolve to warm cream. */
:root[data-theme="light"],:root[data-theme="dark"]{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10)}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.65;font-feature-settings:"palt"}
a{color:var(--accent-deep);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{color:var(--accent)}
.skip-link{position:absolute;left:-9999px;top:0;background:var(--fg);color:var(--bg);padding:8px 12px;z-index:100}
.skip-link:focus{left:8px;top:8px}
.top-banner{background:var(--bg3);border-bottom:1px solid var(--border);padding:8px 16px;font-size:.85rem;color:var(--fg2);display:flex;gap:12px;align-items:center;justify-content:center}
.badge{background:var(--accent);color:#fff;padding:2px 8px;font-size:.7rem;letter-spacing:.05em;font-weight:700;border-radius:2px}
#wrapper{max-width:980px;margin:0 auto;padding:32px 20px 80px}
.crumb{font-size:.85rem;color:var(--fg2);margin-bottom:24px}
.crumb a{color:var(--fg2)}
.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}
header{margin-bottom:32px;border-bottom:1px solid var(--border);padding-bottom:24px}
h1{font-family:var(--font-serif);font-size:clamp(1.75rem,4vw,2.5rem);font-weight:600;line-height:1.25;color:var(--fg);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
h1 .accent{color:var(--accent-deep)}
.sub{color:var(--fg2);font-size:.95rem}
.sub strong{color:var(--accent-deep);font-weight:600}
.intro{margin:24px 0;color:var(--fg);font-size:1.05rem;max-width:64ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:32px 0}
.stats>div{background:var(--bg2);border:1px solid var(--border);padding:16px;border-radius:6px}
.stats dt{font-size:.75rem;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.stats dd{font-family:var(--font-serif);font-size:1.4rem;font-weight:600;color:var(--fg)}
section{margin:48px 0}
h2{font-family:var(--font-serif);font-size:1.35rem;font-weight:600;color:var(--fg);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.top-list{list-style:none;display:grid;gap:8px}
.top-list li{background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px}
.top-list a{color:var(--fg);text-decoration:none;font-weight:500}
.top-list a:hover{color:var(--accent-deep);text-decoration:underline}
.top-list .meta{color:var(--fg2);font-size:.85rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.risk-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums;margin-right:8px}
.risk-pill.low{background:#E0EAE2;color:#48705F}
.risk-pill.mid{background:#F4E5C7;color:#8A6A2A}
.risk-pill.high{background:#F5D5C7;color:#A24A28}
.full-list{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:6px}
.full-list li{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:center}
.full-list a{color:var(--fg);text-decoration:none}
.full-list a:hover{color:var(--accent-deep);text-decoration:underline}
.related-sectors{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;list-style:none}
.related-sectors li{background:var(--bg2);border:1px solid var(--border);border-radius:4px}
.related-sectors a{display:block;padding:12px 14px;text-decoration:none;color:var(--fg)}
.related-sectors a:hover{background:var(--bg3);color:var(--accent-deep)}
.related-sectors .ja-name{font-family:var(--font-serif);font-weight:500}
.related-sectors .count{color:var(--fg2);font-size:.8rem;display:block;margin-top:2px}
footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);font-size:.85rem;color:var(--fg2);text-align:center}
footer .footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin-bottom:14px}
footer .footer-links a{color:var(--fg2);text-decoration:none;padding:5px 14px;border:1px solid var(--border);border-radius:999px;font-size:.78rem;line-height:1.2;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
footer .footer-links a:hover{color:var(--accent);border-color:var(--accent);background:rgba(217,107,61,0.06);text-decoration:none}
footer .footer-meta{color:var(--fg2);font-size:.7rem;opacity:.92;text-wrap:pretty;line-height:1.65}
footer .footer-meta a{color:var(--accent)}
footer .footer-meta .nowrap{white-space:nowrap}
@media (max-width:540px){footer .footer-meta{font-size:.66rem;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}}
/* SEO Phase 7: FAQ section — visible Q&A matching FAQPage JSON-LD schema. */
section.faq{margin:48px 0}
.faq-list{display:flex;flex-direction:column;gap:8px}
.faq-item{background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden;transition:border-color 150ms ease}
.faq-item[open]{border-color:var(--accent-deep)}
.faq-item summary{padding:16px 18px;font-family:var(--font-serif);font-size:1rem;font-weight:500;color:var(--fg);cursor:pointer;list-style:none;position:relative;padding-right:42px;line-height:1.5}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{content:"+";position:absolute;right:18px;top:50%;transform:translateY(-50%);font-size:1.4rem;color:var(--fg2);transition:transform 150ms ease,color 150ms ease;font-weight:300}
.faq-item[open] summary::after{transform:translateY(-50%) rotate(45deg);color:var(--accent)}
.faq-item summary:hover{color:var(--accent-deep)}
.faq-answer{padding:0 18px 16px;color:var(--fg);font-size:.92rem;line-height:1.75}
@media (max-width:600px){#wrapper{padding:20px 16px 60px}h1{flex-direction:column;align-items:flex-start;gap:6px}.top-list li{flex-direction:column;align-items:flex-start;gap:6px}.faq-item summary{font-size:.95rem;padding:14px 16px;padding-right:38px}}
/* Phase 2: AI 時代の特性 essay + データから見えるパターン */
.ai-era-essay{background:var(--bg2);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:8px;padding:24px 28px;margin:32px 0}
.ai-era-essay h2{font-size:1.1rem;color:var(--accent);margin:0 0 14px;padding:0;border:none}
.ai-era-essay p{font-size:.96rem;line-height:1.85;color:var(--fg);margin:0}
.patterns{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;margin:32px 0}
.patterns h2{font-size:1.1rem;color:var(--accent-deep);margin:0 0 16px;padding:0;border:none}
.ai-distribution{margin-bottom:18px}
.ai-dist-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;margin-bottom:10px;background:var(--bg3)}
.ai-dist-bar span{display:block;height:100%}
.ai-dist-bar .dist-low{background:#6E9B89}
.ai-dist-bar .dist-mid{background:#D4A749}
.ai-dist-bar .dist-high{background:#D96B3D}
.ai-dist-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem;color:var(--fg2)}
.ai-dist-legend .ldot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
.ai-dist-legend .ldot-low{background:#6E9B89}
.ai-dist-legend .ldot-mid{background:#D4A749}
.ai-dist-legend .ldot-high{background:#D96B3D}
.ai-dist-legend strong{color:var(--fg);font-variant-numeric:tabular-nums}
.pattern-observations{list-style:none;padding:0;margin:18px 0 0;display:flex;flex-direction:column;gap:8px}
.pattern-observations li{padding:10px 14px;background:var(--bg3);border-radius:4px;font-size:.9rem;color:var(--fg);line-height:1.65}
.pattern-observations li strong{color:var(--accent-deep)}
@media (max-width:600px){.ai-dist-legend{font-size:.74rem;gap:8px}}`;
