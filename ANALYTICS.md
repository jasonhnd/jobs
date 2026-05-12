# Analytics Architecture

Reference + runbook for every tracker on mirai-shigoto.com.
Audit history: substantial parts of this doc were written 2026-05-12
after a multi-hour outage diagnosis — see "Known failure modes" below
for the specific bugs that fell out and the layered defenses now in place.

---

## Tracker stack at a glance

| Tracker | Why we have it | Client script | Server endpoint | Env var |
|---|---|---|---|---|
| **GA4 (client)** | Primary product analytics | `gtag/js?id=G-…` | `g/collect` | `PUBLIC_GA4_MEASUREMENT_ID` |
| **GA4 (server, MP)** | Tracking-Prevention-proof fallback | (none — runs on Vercel Edge) | `mp/collect` | `PUBLIC_GA4_MEASUREMENT_ID` + `GA4_MP_API_SECRET` |
| **Vercel Web Analytics** | Truth source for visitor count | `/_vercel/insights/script.js` (first-party) | `/_vercel/insights/event` | auto-injected by Vercel |
| **Vercel Speed Insights** | Core Web Vitals trend | `/_vercel/speed-insights/script.js` | `vitals.vercel-insights.com` | auto-injected |
| **Cloudflare Web Analytics** | Privacy-respecting secondary | `cloudflareinsights.com/beacon.min.js` | `cloudflareinsights.com/cdn-cgi/rum` | `PUBLIC_CF_BEACON_TOKEN` |
| **X (Twitter) Ads pixel** | Ads conversion attribution | `static.ads-twitter.com/uwt.js` | `analytics.twitter.com/1/i/adsct` | `PUBLIC_X_PIXEL_ID` |

---

## Where each piece is wired

```
┌──────────────────────────────────────────────────────────────┐
│ src/layouts/BaseLayout.astro                                  │
│   - GA4 client snippet (uses set:html — NOT define:vars)      │
│   - CF beacon <script defer>                                  │
│   - X Ads pixel snippet                                       │
│   - Vercel insights + speed-insights scripts                  │
│   → emitted on every page that wraps with BaseLayout (820+)   │
├──────────────────────────────────────────────────────────────┤
│ src/index-source.html                                         │
│   - Same trackers, but HARDCODED IDs (no env interpolation)   │
│   → emitted on home `/` only (raw HTML injection, no Astro)   │
├──────────────────────────────────────────────────────────────┤
│ middleware.ts (project root, Vercel Edge)                     │
│   - Fires server-side GA4 MP `page_view` on every HTML req    │
│   - Reads PUBLIC_GA4_MEASUREMENT_ID + GA4_MP_API_SECRET       │
│   - waitUntil() so it never blocks user response              │
│   - Bot UA filtering before fire                              │
│   → runs on EVERY matched route, even when client is blocked  │
├──────────────────────────────────────────────────────────────┤
│ vercel.json `Content-Security-Policy`                         │
│   - Must list every third-party origin the trackers call      │
│   - Validated at build time by check-analytics-config.cjs     │
└──────────────────────────────────────────────────────────────┘
```

---

## Env vars (full surface)

Configure in Vercel project → Settings → Environment Variables.
**Production scope only** for the analytics-related ones — leaving
preview/development unset prevents staging traffic from polluting
production stats.

| Env name | Scope | Sensitive | Where used | Notes |
|---|---|---|---|---|
| `PUBLIC_GA4_MEASUREMENT_ID` | Production | no | BaseLayout client + middleware | Format: `G-XXXXXXXXXX`. Live value: `G-GLDNBDPF13`. Must NOT have trailing whitespace. |
| `PUBLIC_CF_BEACON_TOKEN` | Production | no | BaseLayout client | 32-char hex token from Cloudflare dashboard. |
| `PUBLIC_X_PIXEL_ID` | Production | no | BaseLayout client | Short pixel ID. Live value: `rC3xs`. Must NOT have trailing whitespace. |
| `GA4_MP_API_SECRET` | Production | **yes** | middleware.ts | Generate in GA4 → Admin → Data Streams → Web stream → Measurement Protocol API secrets → Create. Server-only — no `PUBLIC_` prefix. |
| `RESEND_API_KEY`, `RESEND_AUDIENCE_ID_*`, `FEEDBACK_*` | Production | yes | api/* endpoints | Unrelated to analytics; documented in `.env.example`. |
| `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | local | yes | `analytics/setup-ga4.mjs` | Operator-side GA4 admin setup only; never required at runtime. |

When env is missing, the corresponding tracker passes through silently
— no 5xx, no client-visible error. This is intentional: forks /
previews are unconfigured by default. Production deploys must have all
required env set.

---

## Known failure modes (and the defenses that prevent each)

| # | What happened | Root cause | Defense in place |
|---|---|---|---|
| 1 | GA4 silently stopped for 820+ pages (5/11) | Astro `define:vars` wrapped the gtag `<script>` in an IIFE → `function gtag(){}` became local instead of `window.gtag` → gtag.js library could not process the dataLayer queue → no `g/collect` | (a) BaseLayout now uses `set:html` template substitution, NOT `define:vars`. (b) tests/e2e/analytics.spec.ts asserts `window.gtag === 'function'` on every page. (c) Coding rule: see `~/.claude/rules/web/security.md`. |
| 2 | gtag block elided entirely after env-required refactor | `{GA4_MEASUREMENT_ID && (...)}` short-circuited because Vercel env was unset | tests/e2e/analytics.spec.ts asserts `gtag/js?id=G-` request fires on every page. CI fails before merge. |
| 3 | X Ads pixel never worked | `static.ads-twitter.com` was never in vercel.json CSP `script-src` | scripts/check-analytics-config.cjs validates every required origin is in CSP. Build fails before deploy. |
| 4 | `PUBLIC_X_PIXEL_ID = "rC3xs\n"` (trailing newline from UI paste) | Operator pasted with hidden `\n`, build embedded literal as `"rC3xs\n"`, pixel ID rejected by Twitter | tests/e2e/analytics.spec.ts asserts no whitespace in embedded pixel ID. Always use `printf "value" \| vercel env add` (not `echo`) when setting via CLI. |
| 5 | Real-user `g/collect` blocked by Chromium 137+ Tracking Prevention | Industry-wide browser policy change — gtag.js calls `sendBeacon('g/collect', …)` and Chromium suppresses it for known tracking endpoints | middleware.ts fires server-side MP `page_view` on every Edge request → 100% browser-policy-independent. |

---

## Layered defenses currently in place

### Layer 1: E2E tests
- File: `tests/e2e/analytics.spec.ts`
- Run: `pnpm run test:e2e` (or `pnpm test:e2e` shortcut)
- Asserts: each tracker library loads, `window.gtag` + `window.twq` are
  functions, GA4 `g/collect` fires within 12s, CSP lists every origin
  the code calls, no whitespace in embedded pixel IDs.
- Wired into: `.github/workflows/e2e.yml` (runs on every PR + push to main).
- **Failure mode caught**: 1, 2, 3, 4.

### Layer 2: Build-time consistency
- File: `scripts/check-analytics-config.cjs`
- Run: automatically as the first step of `npm run build` (also
  `pnpm check:analytics-config` for ad-hoc invocation).
- Asserts: vercel.json CSP `script-src` / `connect-src` contains every
  origin the code references; every `import.meta.env.PUBLIC_*` reference
  is documented in `.env.example`; every `process.env.*` in middleware.ts
  is documented in `.env.example`.
- **Failure mode caught**: 3 (CSP missing origin), 4 (env undocumented).

### Layer 3: Server-side fallback
- File: `middleware.ts`
- Runs on every HTML request at Vercel Edge before serving the
  prerendered file.
- Even if client-side gtag.js is 100% blocked, this still records the
  page_view via Measurement Protocol.
- **Failure mode caught**: 5 (industry-wide browser blocking).

### Layer 4: Coding rule
- See `~/.claude/rules/web/security.md` — third-party snippet pitfalls.
- Specifically: **never** use Astro `define:vars` on a `<script>` that
  contains a `function gtag(){…}` / `function fbq(){…}` / `function twq(){…}`
  declaration the third-party library expects to find at `window.X`.
  Use `set:html` template-literal interpolation instead.
- **Failure mode caught**: 1 (recurrence on a different tracker).

---

## Post-incident verification runbook

Whenever you suspect analytics may be off (real-time data feels low,
GA4 trend dips, etc.), run through these checks IN ORDER:

### 1. Sanity-check the truth source
- Vercel project → Analytics tab → "Last 30 minutes" visitor count.
- This is first-party (Tracking-Prevention-proof) and the closest
  truth value for real human pageviews.

### 2. Compare GA4 Realtime
- GA4 → Reports → Realtime → "Active users in last 30 minutes".
- Should be within 50-100% of the Vercel number. If lower:
  - **0 active**: GA4 is fully broken. Go to step 3.
  - **20-50%**: Browser blocking is biting (normal in 2026). Confirm
    middleware.ts is deployed (see step 4) and treat Vercel as truth.
  - **\>100%**: double-counting from client + middleware. Acceptable
    short-term, fixable by adding consent-check logic to middleware.

### 3. Check the client-side chain
Open `https://mirai-shigoto.com/ja/sectors` in DevTools Network panel.
You should see, within 10 seconds of page load:
- `https://www.googletagmanager.com/gtag/js?id=G-GLDNBDPF13` → 200
- `https://www.google-analytics.com/g/collect?…` → 204 (this is the
  page_view hit; if missing → client-side broken)
- `https://static.cloudflareinsights.com/beacon.min.js` → 200
- `https://static.ads-twitter.com/uwt.js` → 200

In Console, evaluate:
- `typeof window.gtag` → `"function"`
- `window.dataLayer.length` → ≥ 3
- `Object.keys(window.google_tag_manager)` → includes `"G-GLDNBDPF13"`

### 4. Check the server-side chain
- Vercel project → Logs → filter by `/ja/` → confirm middleware lines
  are present in recent requests.
- GA4 Realtime → look for events tagged with `ssrc=mw` (param sent by
  middleware) → these are the server-side hits.

### 5. Check env wiring
- Vercel → Settings → Environment Variables → confirm
  `PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_CF_BEACON_TOKEN`,
  `PUBLIC_X_PIXEL_ID`, `GA4_MP_API_SECRET` are all set on Production.
- Values must have **no trailing whitespace**. If editing via Vercel CLI,
  always use `printf "value" | vercel env add NAME production`, NEVER
  `echo "value" | …` (echo adds `\n`).

### 6. Check the property
- GA4 → Admin → Data Streams → Web stream → confirm:
  - Status: "Receiving traffic in past 48 hours"
  - Enhanced Measurement: ON, with Page views included
  - Tag quality is not "Critical" (Warnings ok)
- GA4 → Admin → Data Filters → look for an active filter named
  "Internal traffic" that might be over-broad.

---

## Modifying the analytics stack

If you add a new tracker, swap an ID, or change CSP:

1. **Add origins to CSP**: edit `vercel.json` → `Content-Security-Policy`
   → add new origin to `script-src` (for the library) and
   `connect-src` (for the report endpoint).
2. **Document the env var**: edit `.env.example` → add `PUBLIC_NEW_*=`
   with a comment explaining the value, where to obtain it, and what
   it does.
3. **Update the analytics-config check**: edit
   `scripts/check-analytics-config.cjs` → add the new origin to
   `REQUIRED_SCRIPT_SRC_ORIGINS` / `REQUIRED_CONNECT_SRC_ORIGINS`.
4. **Update this doc**: add a row to the tracker table at the top.
5. **Add an E2E assertion**: edit `tests/e2e/analytics.spec.ts` → add
   the new origin to `REQUIRED_REQUESTS` and (if the tracker exposes a
   `window.X` global like `gtag` / `twq`) add a `waitForFunction` check.
6. **Configure env in Vercel**: add the new env to Production scope.
   Use `printf "..." | vercel env add` if doing it via CLI.
7. **Trigger redeploy**: push an empty commit to main, OR redeploy via
   Vercel UI. Env changes don't take effect until next build.

After deployment, run through the verification runbook above to confirm
the new tracker is actually receiving data.
