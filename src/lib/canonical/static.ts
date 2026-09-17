/**
 * src/lib/canonical/static.ts — Static page class の canonical CSS。
 *
 * Design.md §6.5 Page Class System で定義された "Static class" の共通 CSS:
 *   - 範囲: 3 page — /privacy、/compliance、/404
 *     (/about は Doc class が正。Design.md §6.5.3 により Static 側の範囲から外した)
 *   - 視覚言語: 法務・説明文書、長文垂直配置、極狭 wrapper、高余白
 *   - 特徴: 強制 light-only (theme toggle 隠匿、dead `@media (prefers-color-scheme: light)`
 *     を含めない ── Design.md §3.5 で "やらないこと" と明示済)
 *
 * このファイルは static class 共通部分。Page 固有 (privacy の条文、compliance の表など)
 * は各 page の inline `<style>` に残してよい。
 *
 * `:root{}` token 宣言は **このファイルに含めない**。`canonical-css.ts` に一元化。
 */
export const CANONICAL_STATIC_CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);-webkit-font-smoothing:antialiased;line-height:1.75}
a{color:var(--orange-hot);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{color:var(--accent-deep)}
/* .skip-link rule moved to canonical-css.ts (RA-004, 2026-05-18) */
.theme-toggle{display:none !important}

/* Static class layout: shared content-column width, generous padding */
#wrapper{max-width:var(--content-max);margin:0 auto;padding:48px 24px 96px}

/* Breadcrumb */
nav.crumb{font-size:var(--t-sm);color:var(--fg2);margin-bottom:24px}
nav.crumb a{color:var(--fg2);text-decoration:none}
nav.crumb a:hover{color:var(--orange-hot);text-decoration:underline}
nav.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}

/* Header + h1 — static class signature (smaller, calmer than hero) */
header{margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid var(--border)}
/* Heading typography lives in canonical-css.ts (§4.9). Page-class CSS keeps
   only colour and spacing. */
h1{color:var(--fg);margin-bottom:8px}
h1 .accent{color:var(--orange-hot);font-style:italic}
.sub{color:var(--fg2);font-size:var(--t-h3)}

/* Long-form body paragraphs */
section{margin:32px 0}
section > h2{color:var(--fg);margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid var(--border)}
p{margin:0 0 14px;line-height:1.85;color:var(--fg)}
p:last-child{margin-bottom:0}

@media (max-width:600px){#wrapper{padding:32px 16px 64px}}
`;
