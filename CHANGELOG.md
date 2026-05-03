# Changelog

mirai-shigoto.com — full per-release notes at <https://github.com/jasonhnd/jobs/releases>

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · pre-1.0 SemVer.

> Pre-0.6.0 detailed entries are preserved in [`docs/CHANGELOG-archive.md`](docs/CHANGELOG-archive.md).

---

## [Unreleased]

(empty — new work lands here)

---

## [0.6.0] - 2026-05-03

Theme system, 552 per-occupation pages, dynamic OG cards, GA4 funnel, Design.md, Resend backend.

- **Theme system** — light / dark / system with no-flash inline detection; vibrant light-mode treemap palette; taller desktop canvas; larger tooltip.
- **552 per-occupation pages** — `/ja/<id>` and `/en/<id>` (1,104 static HTML files), each with Schema.org `Occupation` JSON-LD, hreflang pairs, related-occupations block.
- **Pure-numeric URLs** — old `/occ/<id>-<slug>` 301-redirects to `/ja/<id>` / `/en/<id>`. Single-language pages, no in-page toggle.
- **Dynamic per-occupation OG cards** — `api/og.tsx` Vercel Edge Function renders 1200×630 PNGs on demand; CDN-cached.
- **3 GA4 funnel events** — `job_search_submit`, `result_view`, `occupation_tile_click`. All marked Key Events.
- **Design.md** — visual single source of truth for tokens, theme system, breakpoints, treemap rules, tooltip behavior.
- **Backend Edge Functions** — `api/subscribe.js` + `api/feedback.js` (Resend audiences + transactional).
- **Footer share buttons** — X / LINE / Hatena / LinkedIn / Copy / Web Share API.
- **SEO health probe** — `scripts/seo-check.sh` daily probe.
- **Performance** — preload `data.json`, defer SR fallback list, defer GTM. LCP < 1.6 s on 4G, INP < 80 ms, CLS = 0.

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.6.0)

---

## [0.5.0] - 2026-04-30

Hosting migration, privacy policy, SEO/GEO infrastructure, full analytics setup.

- **Vercel migration** — production serves from `hnd1` Tokyo edge node; cleanUrls, HSTS preload, custom-domain TLS auto-renewed.
- **Bilingual privacy policy** — APPI + GDPR-friendly `/privacy` page.
- **4-tracker analytics** — Cloudflare WA + GA4 + Vercel WA + Vercel Speed Insights, all parallel, all every page.
- **SEO + GEO** — robots.txt opts in 17 AI/LLM crawlers; sitemap + llms.txt + Schema.org WebSite/Dataset/Person.
- **Repo hygiene** — `.gitattributes` LF lock killed a phantom 125k-line CRLF diff.

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.5.0)

---

## [0.4.x series] - 2026-04-27 to 2026-04-29

- **v0.4.2** — Mobile tooltip viewport overflow fixes + tap-outside dismiss + repo hygiene.
- **v0.4.1** — Google Analytics 4 (gtag.js); now dual-tracked with Cloudflare WA.
- **v0.4.0** — Custom domain `mirai-shigoto.com` + 13 hardcoded URL references migrated.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.4)

---

## [0.3.x series] - 2026-04-25 to 2026-04-27

12 audit-driven iterations: page reorder (treemap-first), workforce-overcounting fix, OG/Twitter card, byline + dimension hint, Cloudflare Web Analytics, model attribution fix (Opus 4.7), legal disclaimers + JILPT attribution, expanded methodology, mobile responsive audit, mobile treemap readability, top-of-page UNOFFICIAL banner.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.3)

---

## [0.2.x series] - 2026-04-25

AI risk scoring (Claude Opus 4.7) + EN translations + intro polish + real workforce sizing + metadata fixes. v0.2.0 → v0.2.3.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.2)

---

## [0.1.0] - 2026-04-25

First visualization release. Squarified treemap of 552 Japanese occupations from MHLW jobtag, with 5 selectable color layers and bilingual UI (JA/EN).

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.1.0)

---

## [0.0.x series] - 2026-04-25

Pre-visualization scaffolding: bilingual placeholder, jobtag scrape pipeline, master occupation list (552 valid IDs from the 1–580 range). v0.0.1 → v0.0.3.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.0)

---

## Versioning policy

Pre-1.0: minor versions for substantive changes (features OR breaking changes), patch for fixes only. Cadence is intentionally fast while the product shape is still being explored. Detailed per-release notes preserved in [GitHub Releases](https://github.com/jasonhnd/jobs/releases).

---

[Unreleased]: https://github.com/jasonhnd/jobs/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/jasonhnd/jobs/releases/tag/v0.6.0
[0.5.0]: https://github.com/jasonhnd/jobs/releases/tag/v0.5.0
