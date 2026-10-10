/** Shared ordinary reading entries. Destinations always use the route policy. */
import { editionHref, type Edition } from './route-policy';

export interface ReadingEntry {
  readonly href: string;
  readonly label: string;
  readonly trackEvent?: string;
}

export const ORDINARY_READING_ENTRIES: readonly ReadingEntry[] = [
  { href: editionHref('/me', 'ordinary'), label: '自分の仕事を探す', trackEvent: 'me_entry_click' },
  { href: editionHref('/shindan', 'ordinary'), label: '診断' },
  { href: editionHref('/rankings', 'ordinary'), label: 'ランキング' },
  { href: editionHref('/map', 'ordinary'), label: '職業マップ' },
  { href: editionHref('/sectors', 'ordinary'), label: '業種' },
  { href: editionHref('/pro', 'ordinary'), label: 'Pro' },
];

export function pageEdition(path: string): Edition {
  const route = path.replace(/\.html$/, '');
  return route === '/pro' || route.startsWith('/pro/') ? 'pro' : 'ordinary';
}

export function navigationCurrent(path: string, href: string): boolean {
  return path === href || path.startsWith(href + '/') || path.startsWith(href + '.');
}
