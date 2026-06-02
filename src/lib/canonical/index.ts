/**
 * src/lib/canonical/ — Page-class canonical CSS modules。
 *
 * Design.md §6.5 Page Class System に従い、5 つの page class それぞれの共通 CSS を
 * ここに集約。各 class の page CSS (`_id-css.ts` 等) はここから import して連結する。
 *
 *   - detail.ts: Detail class (556 個の `/<id>`)
 *   - hub.ts:    Hub class (13 hub-index + 9 hub-slug)
 *   - sector.ts: Sector class (17 `/sectors/`)
 *   - static.ts: Static class (/about、/privacy、/compliance、/404)
 *
 * Interactive class (/、/map) は性質的に個別 (treemap canvas + 検索 hero) のため
 * canonical 化対象外。
 *
 * Token (`:root{...}`) はここに含めない。`src/lib/canonical-css.ts` に一元化、
 * Footer.astro が `<style is:global>` で全 page emit。
 */
export { CANONICAL_DETAIL_CSS } from './detail';
export { CANONICAL_HUB_CSS } from './hub';
export { CANONICAL_SECTOR_CSS } from './sector';
export { CANONICAL_STATIC_CSS } from './static';
