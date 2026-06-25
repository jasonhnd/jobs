#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import subsetFont from 'subset-font';

const ROOT = process.cwd();
const DIST_ROOT = join(ROOT, 'dist-astro');
const FONTS_OUT_DIR = join(DIST_ROOT, 'fonts');
const FONT_ASSET_MARKER = '<!-- self-hosted-font-assets -->';
const BASE_ASCII =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  ' .,;:!?()[]{}<>/\\|-_+*=#%&@\'"`~^$¥' +
  '。、，．・：；？！ー〜…‥（）「」『』【】［］｛｝〈〉《》“”‘’' +
  '〒※￥→←↑↓×÷±−–—';

type FontFamily = 'Noto Serif JP' | 'Plus Jakarta Sans';

interface FontJob {
  readonly family: FontFamily;
  readonly slug: string;
  readonly source: string;
  readonly textKind: keyof FontTexts;
  readonly faces: readonly FontFaceJob[];
}

interface FontFaceJob {
  readonly label: string;
  readonly cssWeights: readonly string[];
  readonly variationAxes?: { readonly wght: number };
  readonly preload: boolean;
}

const FONT_JOBS: readonly FontJob[] = [
  {
    family: 'Noto Serif JP',
    slug: 'noto-serif-jp',
    source: 'assets/fonts-src/noto-serif-jp/NotoSerifJP[wght].ttf',
    textKind: 'serif',
    faces: [
      {
        label: '600',
        cssWeights: ['400', '500', '600', '700'],
        variationAxes: { wght: 600 },
        preload: true,
      },
    ],
  },
  {
    family: 'Plus Jakarta Sans',
    slug: 'plus-jakarta-sans',
    source: 'assets/fonts-src/plus-jakarta-sans/PlusJakartaSans[wght].ttf',
    textKind: 'sans',
    faces: [
      {
        label: 'var',
        cssWeights: ['400 700'],
        preload: false,
      },
    ],
  },
];

interface FontAsset {
  readonly family: FontFamily;
  readonly slug: string;
  readonly label: string;
  readonly cssWeights: readonly string[];
  readonly href: string;
  readonly bytes: number;
  readonly preload: boolean;
}

interface FontStylesheet {
  readonly href: string;
  readonly bytes: number;
}

interface FontTexts {
  readonly serif: string;
  readonly sans: string;
}

const SERIF_TEXT_PATTERNS: readonly RegExp[] = [
  /<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi,
  /<summary\b[^>]*>([\s\S]*?)<\/summary>/gi,
  /<title\b[^>]*>([\s\S]*?)<\/title>/gi,
];

function fail(message: string): never {
  process.stderr.write(`[subset-fonts] FAIL: ${message}\n`);
  process.exit(1);
}

function walkFiles(dir: string, predicate: (name: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!existsSync(full)) continue;
    if (readdirSyncSafe(full) !== null) {
      walkFiles(full, predicate, out);
    } else if (predicate(name)) {
      out.push(full);
    }
  }
  return out;
}

function readdirSyncSafe(path: string): string[] | null {
  try {
    return readdirSync(path);
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#([0-9]+);/g, (_m, dec: string) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function visibleTextFromHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function addCodepointsFromText(codepoints: Set<number>, text: string): void {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && !Number.isNaN(cp)) codepoints.add(cp);
  }
}

function textFromCodepoints(codepoints: Set<number>): string {
  return [...codepoints]
    .sort((a, b) => a - b)
    .map((cp) => String.fromCodePoint(cp))
    .join('');
}

function collectFontTexts(htmlFiles: readonly string[]): FontTexts {
  const sansCodepoints = new Set<number>();
  const serifCodepoints = new Set<number>();
  for (const ch of BASE_ASCII) {
    const cp = ch.codePointAt(0)!;
    sansCodepoints.add(cp);
    serifCodepoints.add(cp);
  }
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf-8');
    addCodepointsFromText(sansCodepoints, visibleTextFromHtml(html));
    for (const pattern of SERIF_TEXT_PATTERNS) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(html); match !== null; match = pattern.exec(html)) {
        addCodepointsFromText(serifCodepoints, visibleTextFromHtml(match[1] ?? ''));
      }
    }
  }
  return {
    serif: textFromCodepoints(serifCodepoints),
    sans: textFromCodepoints(sansCodepoints),
  };
}

async function buildFontAssets(fontTexts: FontTexts): Promise<FontAsset[]> {
  rmSync(FONTS_OUT_DIR, { recursive: true, force: true });
  mkdirSync(FONTS_OUT_DIR, { recursive: true });

  const assets: FontAsset[] = [];
  for (const job of FONT_JOBS) {
    const sourcePath = join(ROOT, job.source);
    if (!existsSync(sourcePath)) fail(`missing source font ${job.source}`);
    const sourceBuffer = readFileSync(sourcePath);
    const renderedText = fontTexts[job.textKind];
    for (const face of job.faces) {
      const subsetOptions =
        face.variationAxes === undefined
          ? { targetFormat: 'woff2' as const }
          : { targetFormat: 'woff2' as const, variationAxes: face.variationAxes };
      const subset = await subsetFont(sourceBuffer, renderedText, subsetOptions);
      const hash = createHash('sha256').update(subset).digest('hex').slice(0, 12);
      const fileName = `${job.slug}-${face.label}.${hash}.woff2`;
      const outPath = join(FONTS_OUT_DIR, fileName);
      writeFileSync(outPath, subset);
      assets.push({
        family: job.family,
        slug: job.slug,
        label: face.label,
        cssWeights: face.cssWeights,
        href: `/fonts/${fileName}`,
        bytes: subset.length,
        preload: face.preload,
      });
    }
  }
  return assets;
}

function writeFontStylesheet(assets: readonly FontAsset[]): FontStylesheet {
  const css = `${fontFaceCss(assets)}\n`;
  const hash = createHash('sha256').update(css).digest('hex').slice(0, 12);
  const fileName = `font-faces.${hash}.css`;
  writeFileSync(join(FONTS_OUT_DIR, fileName), css, 'utf-8');
  return {
    href: `/fonts/${fileName}`,
    bytes: Buffer.byteLength(css, 'utf-8'),
  };
}

function writeFontManifest(assets: readonly FontAsset[], stylesheet: FontStylesheet): void {
  writeFileSync(
    join(FONTS_OUT_DIR, 'manifest.json'),
    `${JSON.stringify({ generated_by: 'scripts/subset-fonts.ts', stylesheet, assets }, null, 2)}\n`,
    'utf-8',
  );
}

function fontFaceCss(assets: readonly FontAsset[]): string {
  return assets
    .flatMap((asset) =>
      asset.cssWeights.map(
        (cssWeight) =>
          `@font-face{font-family:"${asset.family}";font-style:normal;font-weight:${cssWeight};font-display:swap;src:url("${asset.href}") format("woff2")}`,
      ),
    )
    .join('\n');
}

function fontPreloads(assets: readonly FontAsset[]): string {
  return assets
    .filter((asset) => asset.preload)
    .map((asset) => `<link rel="preload" href="${asset.href}" as="font" type="font/woff2" crossorigin />`)
    .join('\n    ');
}

function injectFontAssets(
  html: string,
  assets: readonly FontAsset[],
  stylesheet: FontStylesheet,
): string {
  if (!html.includes(FONT_ASSET_MARKER)) {
    fail(`missing ${FONT_ASSET_MARKER} marker in rendered HTML`);
  }
  const preloads = fontPreloads(assets);
  return html.replace(
    FONT_ASSET_MARKER,
    `${preloads}\n    <link rel="stylesheet" href="${stylesheet.href}" />`,
  );
}

async function main(): Promise<void> {
  if (!existsSync(DIST_ROOT)) fail('dist-astro/ not found. Run `astro build` first.');
  const htmlFiles = walkFiles(DIST_ROOT, (name) => name.endsWith('.html')).sort();
  if (htmlFiles.length === 0) fail('no dist-astro/**/*.html files found');

  const fontTexts = collectFontTexts(htmlFiles);
  const assets = await buildFontAssets(fontTexts);
  const stylesheet = writeFontStylesheet(assets);
  writeFontManifest(assets, stylesheet);
  for (const file of htmlFiles) {
    const current = readFileSync(file, 'utf-8');
    writeFileSync(file, injectFontAssets(current, assets, stylesheet), 'utf-8');
  }

  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  process.stdout.write(
    `[subset-fonts] ${assets.length} font files, serif=${[...fontTexts.serif].length} sans=${[...fontTexts.sans].length} unique codepoints, ` +
      `${Math.round(totalBytes / 1024)} KiB total\n`,
  );
  process.stdout.write(
    `[subset-fonts] ${stylesheet.href} ${Math.round(stylesheet.bytes / 1024)} KiB stylesheet\n`,
  );
  for (const asset of assets) {
    process.stdout.write(
      `[subset-fonts] ${asset.href} ${Math.round(asset.bytes / 1024)} KiB weights=${asset.cssWeights.join(',')}` +
        `${asset.preload ? ' preload' : ''}\n`,
    );
  }
}

await main();
