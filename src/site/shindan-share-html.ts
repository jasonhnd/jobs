import {
  FAMILIES,
  GAP,
  LABELS,
  VARIANTS,
} from './worktype-copy.js';
import {
  buildShindanOgImageUrl,
  buildShindanResultUrl,
  type ShindanResultState,
} from './shindan-result-state.js';

export interface ShindanShareMetadata {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly image: string;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceMeta(
  html: string,
  attribute: 'name' | 'property',
  key: string,
  value: string,
): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${escapedKey}"\\s+content="[^"]*"\\s*/?>`,
    'i',
  );
  const tag = `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(value)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

export function buildShindanShareMetadata(
  origin: string,
  state: ShindanResultState,
): ShindanShareMetadata {
  const family = FAMILIES[state.family];
  const variants = VARIANTS[state.family] as Readonly<
    Record<string, { readonly name: string; readonly catch: string }>
  >;
  const variant = variants[state.variant]!;
  const context = state.gap ? ` ${LABELS.gap}: ${GAP[state.gap].label}。` : '';
  return {
    title: `${variant.name}｜${family.name} - ${LABELS.featureName}`,
    description: `${variant.catch}${context}`,
    url: buildShindanResultUrl(origin, state),
    image: buildShindanOgImageUrl(origin, state),
  };
}

export function renderShindanShareHtml(
  baseHtml: string,
  metadata: ShindanShareMetadata | null,
): string {
  let html = replaceMeta(baseHtml, 'name', 'robots', 'noindex, follow');
  if (!metadata) return html;

  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtmlAttribute(metadata.title)}</title>`,
  );
  html = replaceMeta(html, 'name', 'description', metadata.description);
  html = replaceMeta(html, 'property', 'og:title', metadata.title);
  html = replaceMeta(html, 'property', 'og:description', metadata.description);
  html = replaceMeta(html, 'property', 'og:url', metadata.url);
  html = replaceMeta(html, 'property', 'og:image', metadata.image);
  html = replaceMeta(html, 'name', 'twitter:title', metadata.title);
  html = replaceMeta(html, 'name', 'twitter:description', metadata.description);
  html = replaceMeta(html, 'name', 'twitter:image', metadata.image);
  return html;
}
