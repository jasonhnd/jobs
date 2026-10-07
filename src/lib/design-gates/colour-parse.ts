/**
 * design-gates/colour-parse.ts — find colour literals in a CSS value and reduce
 * them to 8-bit sRGB, so check-color-tokens can compare them with the palette.
 *
 * Until #866 the gate understood `#rrggbb` and comma `rgba(r,g,b,a)` only. An
 * 8-digit hex, `rgb(r g b / a)`, `hsl()` or `oklch()` of a palette colour was
 * not seen as one, and a palette tint written that way passed.
 *
 * Only the RGB channels matter: alpha is what §2.5's color-mix() percentage
 * expresses, so a tint at any alpha is still "derived from" its base token.
 */

export type Rgb = readonly [number, number, number];

/** Anything that writes a colour out rather than naming a token. */
export const RAW_COLOUR =
  /#[0-9a-fA-F]{3,8}\b|(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

const HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const FUNC = /(?<![\w-])(rgba?|hsla?|oklch)\(([^()]*)\)/gi;

const clamp255 = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));

function hexToRgb(hex: string): Rgb {
  const h = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
}

/** Comma or space syntax; the alpha after `/` (or a 4th comma arg) is dropped. */
function args(body: string): string[] {
  return body.split('/')[0]!.split(/[\s,]+/).map((a) => a.trim()).filter((a) => a !== '');
}

function channel(a: string, percentScale: number): number {
  return a.endsWith('%') ? (Number.parseFloat(a) / 100) * percentScale : Number.parseFloat(a);
}

function hue(a: string): number {
  const v = Number.parseFloat(a);
  if (/turn$/i.test(a)) return v * 360;
  if (/grad$/i.test(a)) return v * 0.9;
  if (/rad$/i.test(a) && !/grad$/i.test(a)) return (v * 180) / Math.PI;
  return v;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [clamp255(f(0) * 255), clamp255(f(8) * 255), clamp255(f(4) * 255)];
}

/** CSS Color 4 OKLCH → sRGB (gamut-clipped). */
function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const gamma = (x: number): number =>
    x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return lin.map((x) => clamp255(gamma(Math.min(1, Math.max(0, x))) * 255)) as unknown as Rgb;
}

function funcToRgb(name: string, body: string): Rgb | null {
  const a = args(body);
  if (a.length < 3 || a.slice(0, 3).some((x) => Number.isNaN(Number.parseFloat(x)))) return null;
  const fn = name.toLowerCase();
  if (fn === 'rgb' || fn === 'rgba') {
    return [clamp255(channel(a[0]!, 255)), clamp255(channel(a[1]!, 255)), clamp255(channel(a[2]!, 255))];
  }
  if (fn === 'hsl' || fn === 'hsla') {
    // S and L are percentages whether or not the `%` is written (Color 4).
    const pct = (x: string): number => Number.parseFloat(x) / 100;
    return hslToRgb(((hue(a[0]!) % 360) + 360) % 360, pct(a[1]!), pct(a[2]!));
  }
  // oklch: L is 0-1 or a percentage; C is a number or a percentage of 0.4.
  return oklchToRgb(channel(a[0]!, 1), channel(a[1]!, 0.4), hue(a[2]!));
}

/**
 * Every colour literal in `value` that can be reduced to sRGB. `hwb()`,
 * `lab()`, `color()` are recognised as raw by RAW_COLOUR but not reduced —
 * they are reported, never treated as derivable.
 */
export function parseColours(value: string): Rgb[] {
  const out: Rgb[] = [];
  for (const m of value.matchAll(HEX)) out.push(hexToRgb(m[1] ?? ''));
  for (const m of value.matchAll(FUNC)) {
    const rgb = funcToRgb(m[1] ?? '', m[2] ?? '');
    if (rgb != null) out.push(rgb);
  }
  return out;
}

export const rgbKey = (rgb: Rgb): string => rgb.join(',');

/** Pure black or pure white — a shadow or highlight with no hue to tokenise. */
export function isNeutral(rgb: Rgb): boolean {
  return rgb.every((c) => c === 0) || rgb.every((c) => c === 255);
}

/**
 * Blank every `data:image/svg+xml` URI on a line (to the closing quote, or the
 * closing paren of an unquoted `url(`), keeping the line's length.
 *
 * A data URI cannot resolve var(), so its colours are written out — that part
 * is checked by findDataUriDrift. Until #866 the WHOLE line was exempted, so a
 * declaration after the URI on the same line was not checked at all.
 */
export function blankDataUris(line: string): string {
  let out = line;
  let from = 0;
  for (;;) {
    const at = out.indexOf('data:image/svg+xml', from);
    if (at === -1) return out;
    const before = out[at - 1];
    let end: number;
    if (before === '"' || before === "'") {
      end = out.indexOf(before, at);
    } else {
      end = out.indexOf(')', at);
    }
    if (end === -1) end = out.length;
    out = out.slice(0, at) + ' '.repeat(end - at) + out.slice(end);
    from = end;
  }
}
