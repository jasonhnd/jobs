# GA4 Setup Automation

Single source of truth for the mirai-shigoto.com GA4 instrumentation:

| File | Role |
| --- | --- |
| `spec.yaml` | All events, parameters, custom dimensions, key events. **The spec.** |
| `setup-ga4.mjs` | Reads `spec.yaml`, applies via GA4 Admin API. Idempotent. |
| `oauth-init.mjs` | One-time OAuth flow — exchanges your Google login for a refresh token. |
| `package.json` | Deps: `googleapis`, `js-yaml`. |

After editing `spec.yaml`, re-run `npm run setup` to sync GA4.

## Auth: two paths, OAuth user-credential is preferred

`setup-ga4.mjs` supports two authentication paths and tries them in this order:

1. **OAuth user-credential** (`~/.config/mirai-shigoto/oauth-token.json`) —
   acts as the logged-in human (you), inherits the GA4 admin access you
   already have. **Preferred** because it bypasses GA4's known issue where
   service-account emails get rejected with `此电子邮件地址没有对应的 Google 账号`
   in cross-org / personal-account configurations. One-time setup via
   `npm run oauth-init` (see "OAuth quick start" below). After that, all
   script runs are non-interactive.

2. **Service account JSON** (`GOOGLE_APPLICATION_CREDENTIALS` env var) —
   fallback for CI / shared environments where a human OAuth flow isn't
   appropriate. Requires the service-account email be granted access on
   the GA4 account in Admin → Account Access Management. **Skip this path**
   unless you actually need it.

---

## OAuth quick start (~5 min, recommended)

This is the path that *worked* on this machine (the service-account path
got blocked by GA4 cross-org validation in 2026-05).

### 1. Create an OAuth Desktop client in GCP

https://console.cloud.google.com → APIs & Services → Credentials →
**+ Create credentials** → **OAuth client ID** → application type
**Desktop app**. Name: `mirai-shigoto-cli`. Click Create → click
"Download JSON".

If GCP makes you configure the OAuth consent screen first:
- User type: **External**
- Add yourself to **Test users** (else Google blocks login with
  `Error 403: access_denied`)
- Skip Branding / Scopes details — defaults are fine for Desktop apps

### 2. Save the JSON in the standard location

```bash
mkdir -p ~/.config/mirai-shigoto
mv ~/Downloads/client_secret_*.apps.googleusercontent.com.json \
   ~/.config/mirai-shigoto/oauth-client.json
chmod 600 ~/.config/mirai-shigoto/oauth-client.json
```

### 3. Run the one-time OAuth flow

```bash
cd analytics
npm install            # if not already
npm run oauth-init
```

This opens your browser to Google's OAuth consent page. Click "Advanced
→ Go to mirai-shigoto-cli (unsafe)" past the unverified-app warning,
sign in with the Google account that owns GA4, allow the
`analytics.edit` scope. The browser shows "✓ Authentication successful".
The script writes the refresh token to
`~/.config/mirai-shigoto/oauth-token.json` (perms 600) and exits.

### 4. Discover your property and apply the spec

```bash
npm run discover                                    # lists property_id
GA4_PROPERTY_ID=298707336 npm run setup:dry         # preview changes
GA4_PROPERTY_ID=298707336 npm run setup             # apply
```

After the first successful run, all future `npm run setup` invocations
work non-interactively (refresh token auto-renews).

---

## Service-account setup (legacy path, ~10 minutes)

> Only follow this section if you specifically need a service account
> (e.g., CI pipeline). The OAuth path above is faster and avoids GA4's
> service-account validation quirk.

### 1. Pick or create a GCP project

Open https://console.cloud.google.com → top-left project picker → "New Project".

Suggested name: `mirai-shigoto-analytics`. The project ID will be auto-generated; copy it down.

> Already have a GCP project from another work? You can reuse it — these APIs and the service account live inside the project but don't conflict with other services.

### 2. Enable the Google Analytics Admin API

In the new project's console → APIs & Services → Library → search "Google Analytics Admin API" → **Enable**.

(While you're here, also enable "Google Analytics Data API" — you'll want it later for the GA MCP server.)

### 3. Create a Service Account

APIs & Services → Credentials → **+ Create Credentials** → Service Account.

| Field | Value |
| --- | --- |
| Service account name | `mirai-shigoto-ga4-admin` |
| Service account ID | (auto) |
| Description | "Manages GA4 custom dimensions + key events for mirai-shigoto.com" |

You can skip the "Grant access to this project" and "Grant users access" steps. Click **Done**.

### 4. Download the Service Account JSON key

Click the new service account → **Keys** tab → **Add Key** → **Create new key** → JSON → **Create**.

A file like `mirai-shigoto-analytics-1234567890ab.json` downloads. **Move it to a safe spot OUTSIDE the repo** (it's a credential — leaking it lets anyone act as that service account).

Suggested location:

```bash
mkdir -p ~/.config/mirai-shigoto
mv ~/Downloads/mirai-shigoto-analytics-*.json ~/.config/mirai-shigoto/ga4-admin-sa.json
chmod 600 ~/.config/mirai-shigoto/ga4-admin-sa.json
```

### 5. Grant the service account access to the GA4 property

Open https://analytics.google.com → ⚙️ Admin → property `mirai-shigoto.com` (the one with measurement ID `G-GLDNBDPF13`) → **Property Access Management** → **+** (top right) → **Add users**.

| Field | Value |
| --- | --- |
| Email addresses | (paste the service account email — it's the `client_email` field inside the downloaded JSON, like `mirai-shigoto-ga4-admin@mirai-shigoto-analytics.iam.gserviceaccount.com`) |
| Roles | **Editor** |
| Notify by email | uncheck (it's a service account, not a person) |

Click **Add**.

### 6. Install Node deps

```bash
cd analytics
npm install
```

This pulls `googleapis` and `js-yaml` into `analytics/node_modules` (gitignored).

### 7. Discover your GA4 property ID

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/mirai-shigoto/ga4-admin-sa.json \
  npm run discover
```

Output looks like:

```
Account: ZKSC_KK  (name=accountSummaries/12345)
  └─ Property: mirai-shigoto.com    property_id=501234567
```

Copy the numeric `property_id` (e.g., `501234567`).

### 8. Apply the spec

Dry run first to see what would change:

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/mirai-shigoto/ga4-admin-sa.json \
GA4_PROPERTY_ID=501234567 \
  npm run setup:dry
```

If it looks right:

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/mirai-shigoto/ga4-admin-sa.json \
GA4_PROPERTY_ID=501234567 \
  npm run setup
```

Output:

```
[12:00:01]    Target property: properties/501234567
[12:00:01]    Syncing 16 event custom dimensions…
[12:00:01] +  created event dimension: occupation_id
[12:00:02] +  created event dimension: occupation_name_ja
...
[12:00:18]    Syncing 4 user custom dimensions…
[12:00:18] +  created user dimension: language_preference
...
[12:00:24]    Syncing 4 key events…
[12:00:24] +  marked as key event: email_submit_modal
[12:00:25] +  marked as key event: email_submit_header
[12:00:25] +  marked as key event: feedback_submit
[12:00:26] +  marked as key event: report_cta_click
[12:00:26]    Done. Audiences and data retention must be set manually in dashboard.
```

Re-running is safe — existing entities are detected and skipped (`= ` lines).

---

## Manual GA4 dashboard tasks (the script doesn't do these)

### Data retention → 14 months

Admin → Data Settings → Data Retention → **Event data retention: 14 months** → Save.

(Default is 2 months. 14 is the max on free GA4 and lets you do year-over-year comparisons.)

### Enhanced measurement → all on

Admin → Data Streams → Web → click the stream → ⚙️ next to "Enhanced measurement" → ensure **all toggles on** (page views, scrolls, outbound clicks, site search, video, file downloads, form interactions).

### Audiences

`spec.yaml` documents 5 audiences under `audiences_manual:`. Create each at:

Admin → Audiences → **New audience** → Custom (or template).

| Audience | Filter |
| --- | --- |
| Subscribed | Event count `email_submit_modal` ≥ 1 OR `email_submit_header` ≥ 1, duration 540 days |
| Engaged but unconverted | `occupation_modal_open` ≥ 1 AND `email_submit_modal` = 0 AND `email_submit_header` = 0, duration 30 days |
| B2B signal | Event `feedback_submit` where parameter `selected_options` contains `b2b_hr` OR `b2b_training`, duration 540 days |
| High-intent occupations | Event `occupation_modal_open` where `risk_tier` = `high`, duration 90 days |
| Returning visitors | Event count `session_start` ≥ 2 in 28-day window, duration 28 days |

(B2B signal requires the custom dimension `selected_options` to exist — it does after step 8 above.)

### Funnel exploration: Modal conversion funnel

Explore → New → Funnel exploration. Steps:

1. `page_view`
2. `occupation_tile_click`
3. `occupation_modal_open`
4. `report_cta_click`
5. `email_submit_modal`

Save as "Modal funnel". This is the most important chart for the 6-week OPC validation.

---

## After applying the spec

1. The spec is in version control. Future schema changes go via `spec.yaml` + `npm run setup`, not via dashboard clicks.
2. The actual `gtag('event', ...)` calls happen client-side in `index.html` (handled in a separate task — see `Phase 0 D5` in the OPC plan).
3. Until those event calls are added, the dimensions sit empty (no data flows in). That's fine — schema first, then data.

---

## Decisions log — explicit "won't do" entries

These are choices we have made and don't want to revisit on every audit. If
you are auditing GA4 setup and considering one of these, **don't** —
re-open the discussion with the site owner first.

- **Consent Mode v2 (GDPR / DMA cookie consent)** — *won't implement.*
  Decided 2026-05-06. The site has no measurable EU/UK traffic and the
  audience is Japan-focused. The 3-4 hour cost of Consent Mode v2 plus
  ongoing cookie-banner UX overhead is not justified by the regulatory
  exposure. If EU traffic ever becomes > 5% of sessions, revisit.

- **A/B testing framework (GrowthBook / LaunchDarkly / Statsig)** —
  *deferred indefinitely.* Decided 2026-05-06. Site traffic volume is too
  low for statistically meaningful A/B tests on most UI changes;
  before/after analytics comparisons are sufficient at the current scale.
  Revisit when sustained sessions/day clears the threshold for splitting
  cohorts.
