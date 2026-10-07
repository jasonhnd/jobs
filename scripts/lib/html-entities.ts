/**
 * html-entities.ts — decode the HTML entities subset-fonts sees in built pages.
 */
const REPLACEMENT_CHARACTER = '\uFFFD';

/**
 * Character for a numeric character reference. Like the HTML parser, NUL,
 * surrogates and anything above U+10FFFF become U+FFFD; String.fromCodePoint
 * would throw a RangeError and crash the build.
 */
function codePointToText(cp: number): string {
  const invalid = !Number.isSafeInteger(cp) || cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff);
  return invalid ? REPLACEMENT_CHARACTER : String.fromCodePoint(cp);
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => codePointToText(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_m, dec: string) => codePointToText(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
