import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as sitemapView from '@/views/sitemap';
import * as imageView from '@/views/image-sitemap';
import { GET as getSitemap } from './sitemap.xml';
import { GET as getImageSitemap } from './image-sitemap.xml';

const call = (route: unknown) => (route as () => Promise<Response>)();

describe('sitemap.xml route', () => {
  afterEach(() => {
    sitemapView.buildSitemapEntries.mockRestore?.();
  });

  test('serves a well-formed XML urlset with the safety-floor URL count', async () => {
    const res = await call(getSitemap);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect((body.match(/<loc>/g) ?? []).length).toBeGreaterThanOrEqual(600);
  });

  test('throws when the entry list falls below the safety floor', async () => {
    spyOn(sitemapView, 'buildSitemapEntries').mockReturnValue([]);
    await expect(call(getSitemap)).rejects.toThrow(/below the safety floor of 600/);
  });
});

describe('image-sitemap.xml route', () => {
  afterEach(() => {
    imageView.buildImageSitemapEntries.mockRestore?.();
  });

  test('serves XML with at least the minimum entry count', async () => {
    const res = await call(getImageSitemap);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect((body.match(/<url>/g) ?? []).length).toBeGreaterThanOrEqual(imageView.IMAGE_SITEMAP_MIN_URL_COUNT);
  });

  test('throws when the entry list falls below the safety floor', async () => {
    spyOn(imageView, 'buildImageSitemapEntries').mockReturnValue([]);
    await expect(call(getImageSitemap)).rejects.toThrow(/below the safety floor/);
  });
});
