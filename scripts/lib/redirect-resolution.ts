import { parse, pathToRegexp, type Key } from 'path-to-regexp';

export interface Redirect { source: string; destination: string; statusCode?: number; permanent?: boolean }

/** Vercel routing-utils sourceToRegex options; preserve rule order and captured bytes. */
export function redirectResolver(redirects: Redirect[]) {
  const rules = redirects.map(rule => {
    const keys: Key[] = [];
    const regex = pathToRegexp(rule.source, keys, { strict: true, sensitive: true, delimiter: '/' });
    return { rule, keys, regex };
  });
  return (path: string) => {
    for (const { rule, keys, regex } of rules) {
      const match = regex.exec(path);
      if (!match) continue;
      const params = new Map(keys.map((key, i) => [String(key.name), match[i + 1] ?? '']));
      return {
        source: rule.source,
        destination: rule.destination.replace(/:([A-Za-z0-9_]+)[*+?]?/g, (token, name: string) => params.get(name) ?? token),
        statusCode: typeof rule.permanent === 'boolean' ? (rule.permanent ? 308 : 307) : (rule.statusCode ?? 308),
      };
    }
    return undefined;
  };
}

/** Expand only finite, literal segment alternations; never sample a broad regex. */
export function finiteRedirectSources(source: string, limit: number): string[] {
  let paths = [''];
  for (const token of parse(source, { delimiter: '/' })) {
    if (typeof token === 'string') {
      paths = paths.map(path => path + token);
      continue;
    }
    if (token.modifier || typeof token.name !== 'string'
      || !/^(?:[A-Za-z0-9_@-]|\\\.)+(?:\|(?:[A-Za-z0-9_@-]|\\\.)+)*$/.test(token.pattern)) {
      throw new Error(`Non-finite redirect pattern: ${source}`);
    }
    const values = token.pattern.split('|').map(value => value.replaceAll('\\.', '.'));
    if (paths.length * values.length > limit) throw new Error(`Redirect outside authorized exact inventory: ${source}`);
    paths = paths.flatMap(path => values.map(value => path + token.prefix + value + token.suffix));
  }
  return paths;
}
