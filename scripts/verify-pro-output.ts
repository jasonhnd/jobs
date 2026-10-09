#!/usr/bin/env bun
/** Final-address oracle: every built internal URL / JSON-LD reference avoids redirects. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import manifest from '../docs/pro-split/route-manifest.json';
import { verifyMigration } from './pro-migration';
const origin = 'https://mirai-shigoto.com';
const config = JSON.parse(readFileSync('vercel.json','utf8'));
verifyMigration(config);
const redirects = new Set<string>(config.redirects.map((r: {source:string})=>r.source));
const root = 'dist-astro';
function files(dir:string):string[] {
  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
}
let pages=0, references=0;
for (const file of files(root).filter(f=>f.endsWith('.html'))) {
  pages++;
  const html = readFileSync(file,'utf8');
  const path = '/' + relative(root,file).replace(/\.html$/,'').replace(/^index$/,'');
  const check = (value:unknown):void => {
    if (Array.isArray(value)) {value.forEach(check); return;}
    if (value && typeof value==='object') {Object.values(value).forEach(check);return;}
    if (typeof value!=='string' || !value.startsWith(origin+'/')) return;
    references++;
    const target = new URL(value).pathname;
    if (redirects.has(target)) throw new Error(`${path}: JSON-LD points to redirect ${target}`);
    if (target.startsWith('/api/')) return;
    const name = target==='/'?'index':target.slice(1);
    if (!existsSync(join(root,name)) && !existsSync(join(root,name+'.html'))) throw new Error(`${path}: JSON-LD target missing ${target}`);
  };
  for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) check(JSON.parse(match[1]!));
  for (const match of html.matchAll(/\bhref="([^"]*)"/g)) {
    const raw = match[1]!.replaceAll('&amp;','&');
    if (!raw.startsWith('/') && !raw.startsWith(origin+'/')) continue;
    const target = new URL(raw,origin+path).pathname;
    if (redirects.has(target)) throw new Error(`${path}: internal href points to redirect ${target}`);
  }
}
let geoReferences=0;
for (const name of ['llms.txt','llms-full.txt']) {
  const text = readFileSync(join(root,name),'utf8');
  for (const match of text.matchAll(/https:\/\/mirai-shigoto\.com\/[^\s)}]*/g)) {
    const target = new URL(match[0].replace(/[.,;:]+$/, '')).pathname;
    geoReferences++;
    if (redirects.has(target)) throw new Error(`${name}: GEO URL points to redirect ${target}`);
    const file = target==='/'?'index':target.slice(1);
    if (!existsSync(join(root,file)) && !existsSync(join(root,file+'.html'))) throw new Error(`${name}: GEO target missing ${target}`);
  }
}
const sitemap = readFileSync(join(root,'sitemap.xml'),'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]!);
if (new Set(locs).size !== locs.length) throw new Error('Duplicate sitemap locations');
for (const row of manifest.rankings) {
  const html = readFileSync(join(root,row.proPath.slice(1)+'.html'),'utf8');
  if (!html.includes(`<link rel="canonical" href="${origin}${row.proCanonical}">`)) throw new Error(`Ranking canonical ${row.slug}`);
  if (!html.includes(`content="${row.noindex?'noindex':'index'}, follow"`)) throw new Error(`Ranking robots ${row.slug}`);
  if (locs.includes(origin+row.proPath)!==row.proSitemap) throw new Error(`Ranking sitemap ${row.slug}`);
  if (locs.includes(origin+row.oldPath)!==row.ordinarySitemap) throw new Error(`Ordinary ranking sitemap ${row.slug}`);
  const nodes = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]!)['@graph'] ?? []);
  for (const type of ['WebPage','Article','ItemList']) {
    const node = nodes.find(n => n['@type'] === type);
    if (!node || !node['@id'].startsWith(origin+row.proCanonical+'#') || (node.url && node.url!==origin+row.proCanonical)) throw new Error(`Ranking JSON-LD canonical ${row.slug} ${type}`);
  }
  const crumb = nodes.find(n => n['@type'] === 'BreadcrumbList');
  if (crumb?.itemListElement.at(-1)?.item!==origin+row.proCanonical) throw new Error(`Ranking breadcrumb canonical ${row.slug}`);
}
const machinePaths = new Set(['/llms.txt','/llms-full.txt']);
for (const path of machinePaths) if (!locs.includes(origin+path)) throw new Error(`Missing GEO discovery entry ${path}`);
for (const path of ['/pro/rankings', `/pro/aiadoption/${JSON.parse(readFileSync(join(root,'data.haid-latest.json'),'utf8')).release}`]) {
  if (locs.includes(origin+path)) throw new Error(`Duplicate content in sitemap ${path}`);
}
let htmlLocations=0;
for (const loc of locs) {
  const path = new URL(loc).pathname;
  if (redirects.has(path)) throw new Error(`Sitemap redirect ${loc}`);
  if (machinePaths.has(path)) {
    if (!existsSync(join(root,path.slice(1)))) throw new Error(`Sitemap machine file missing ${loc}`);
    continue;
  }
  htmlLocations++;
  const html = readFileSync(join(root,(path==='/'?'index':path.slice(1))+'.html'),'utf8');
  if (!html.includes(`<link rel="canonical" href="${loc}">`) || !html.includes('content="index, follow"')) throw new Error(`Sitemap noncanonical/noindex ${loc}`);
}
console.log(`Pro output OK: ${pages} HTML pages, ${references} same-origin JSON-LD references, ${geoReferences} GEO URLs, ${locs.length} sitemap locations (${htmlLocations} canonical HTML + 2 GEO files); no redirected links/references`);
