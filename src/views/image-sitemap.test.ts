import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderImageSitemapXml } from './image-sitemap.js';

describe('renderImageSitemapXml', () => {
  test('uses the collision-free occupation 404 page while keeping the OG dispatch id', () => {
    const xml = renderImageSitemapXml([{ id: 404, title: '内科医', score: 5 }]);

    assert.ok(xml.includes('<loc>https://mirai-shigoto.com/occupations/404</loc>'));
    assert.ok(xml.includes('<image:loc>https://mirai-shigoto.com/api/og?id=404</image:loc>'));
    assert.ok(!xml.includes('<loc>https://mirai-shigoto.com/404</loc>'));
  });
});
