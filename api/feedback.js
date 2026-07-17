// api/feedback.js — Vercel Edge Function: receive feedback form submissions.
//
// POST { email?, options[], freetext, occupation_id?, lang, htmlfield }
//
//   email          optional. If present, validated.
//   options        array of selected feedback option keys (b2c_career, b2b_hr, ...)
//   freetext       optional free-text response (max 2000 chars)
//   occupation_id  optional. Which occupation context the user was in.
//   lang           "ja" | "en"
//   htmlfield      honeypot.
//
// Storage strategy: send each feedback as a transactional email to the operator.
// This keeps infra minimal (no KV / Postgres needed for the OPC validation
// phase, which expects ≤30 feedback submissions over 6 weeks). When volume
// grows, swap the body of this function to write into Vercel KV or Postgres.
//
// Env vars:
//   PUBLIC_TURNSTILE_SITE_KEY — renders the footer challenge widget (public)
//   TURNSTILE_SECRET_KEY      — verifies the widget token (server-only)
//   RESEND_API_KEY            — authorizes Resend delivery
//   FEEDBACK_TO_EMAIL         — operator inbox (required for production delivery)
//   FEEDBACK_FROM_EMAIL       — optional sender override; defaults to
//                               onboarding@resend.dev
//
// Production (`VERCEL_ENV === "production"`) fails closed: missing Turnstile
// secret returns HTTP 403, while missing RESEND_API_KEY / FEEDBACK_TO_EMAIL or
// a Resend delivery failure returns HTTP 503. Preview/development may skip a
// missing Turnstile secret and returns an explicit HTTP 202 non-delivery result
// when delivery configuration is absent or Resend fails. Every diagnostic is
// PII-safe and redacted; a 202 non-delivery response is not a delivered success.
//
// Defense in depth (current):
//   1. CORS — only mirai-shigoto.com + localhost dev ports.
//   2. Origin/Referer 403 — server-side enforcement, parses Referer via `URL`
//      and compares on `.origin` (no startsWith) so `evil-mirai-shigoto.com`
//      and `mirai-shigoto.com.evil.com` can't impersonate the real origin.
//   3. Body cap (16 KB) — STREAMING enforcement; aborts read once the cumulative
//      byte count exceeds the cap. Doesn't rely on the advisory content-length.
//   4. Honeypot field (htmlfield) — silently drops obvious bot traffic.
//   5. Allow-listed option keys — rejects unknown values.
//   6. HTML-escape on freetext before email — prevents email-template XSS.
//   7. Per-IP rate limit (Upstash Redis REST) — 10 POST per 5 minutes.
//      Missing/malformed configuration fails closed in production and is
//      skipped only in preview/development. Upstream errors default closed in
//      production and open elsewhere; FAIL_CLOSED_ON_RATELIMIT_ERROR can
//      explicitly invert that outage behavior.
//   8. Cloudflare Turnstile (invisible CAPTCHA) — verified server-side
//      when TURNSTILE_SECRET_KEY env is set. Frontend widget submits
//      `cf-turnstile-response` token; missing token → 403. A missing secret
//      also fails closed in production, but is skipped in preview/development.

import {
  makeOriginGate,
  readBodyText,
  BodyTooLargeError,
  rateLimitCheck,
  verifyTurnstile,
  clientIpFromRequest,
  isProduction,
} from "../src/lib/api-security.js";
import { fetchWithTimeout } from "../src/lib/http-client.js";
import {
  parseFeedbackBody,
  shortHash,
  escapeHtml,
  MAX_BODY_BYTES,
} from "../src/lib/feedback-helpers.js";

export const config = {
  runtime: "edge",
  // JA-only audience; pin to Tokyo + Osaka regions instead of the default
  // 19-region global pool. Saves Vercel function quota; minor cold-start
  // benefit for JP visitors.
  regions: ["hnd1", "kix1"],
};

const RESEND_BASE = "https://api.resend.com";
const ALLOWED_ORIGINS = new Set([
  "https://mirai-shigoto.com",
  "http://localhost:8765",
  "http://localhost:3000",
]);
const enforceOriginOr403 = makeOriginGate(ALLOWED_ORIGINS);

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://mirai-shigoto.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

export default async function handler(req) {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405, headers: cors });
  }
  // Server-side origin gate — runs after the OPTIONS preflight so browsers
  // get the CORS dance, but blocks curl / non-browser POSTs.
  const denied = enforceOriginOr403(req);
  if (denied) return denied;

  // Per-IP rate limit. Runs BEFORE body read so abusive clients get rate
  // limited cheaply (a few KB of headers per blocked request). 10 POSTs
  // per 5 minutes is plenty for legitimate users (the form is opt-in
  // feedback, not a chat) and blocks form-spam scripts that hit dozens/sec.
  const ip = clientIpFromRequest(req);
  const rl = await rateLimitCheck({
    ip,
    namespace: "feedback",
    limit: 10,
    windowSeconds: 300,
    env: process.env,
  });
  if (!rl.ok) {
    return json(
      { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
      {
        status: 429,
        headers: { ...cors, "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  let bodyText;
  try {
    bodyText = await readBodyText(req, MAX_BODY_BYTES);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return json({ error: "payload_too_large" }, { status: 413, headers: cors });
    }
    return json({ error: "body_read_failed" }, { status: 400, headers: cors });
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: cors });
  }

  // Validate + normalize body via the pure helper. Returns a
  // discriminated union: silent-success (honeypot), error, or ok.
  const parsed = parseFeedbackBody(body);
  if (parsed.kind === "silent-success") {
    return json({ ok: true }, { headers: cors });
  }
  if (parsed.kind === "error") {
    return json({ error: parsed.code }, { status: 400, headers: cors });
  }

  // Turnstile verification — runs AFTER parsing so we know the body shape,
  // but BEFORE the expensive Resend send. The token field name matches the
  // standard Turnstile widget output (`cf-turnstile-response`). A missing
  // TURNSTILE_SECRET_KEY fails closed in production (`production_misconfigured`)
  // and is a no-op only in preview/development (`skipped: true`).
  const turnstileToken = body && typeof body === "object"
    ? (body["cf-turnstile-response"] || body["turnstile_token"] || null)
    : null;
  const tsResult = await verifyTurnstile({
    token: turnstileToken,
    remoteip: ip,
    env: process.env,
  });
  if (!tsResult.ok) {
    return json(
      { error: "turnstile_failed", reason: tsResult.reason || "unknown" },
      { status: 403, headers: cors },
    );
  }

  // Augment the normalized payload with request-bound fields
  // (user_agent, referer) that the pure helper can't see.
  const payload = {
    ...parsed.payload,
    user_agent: req.headers.get("user-agent") || "",
    referer: req.headers.get("referer") || "",
  };
  const { email, lang, occupation_id: occupationId, options, freetext } = parsed.payload;

  // ---- deliver to operator inbox ----
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.FEEDBACK_TO_EMAIL;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || "onboarding@resend.dev";

  // Production must SURFACE delivery failures with 503 (so monitoring
  // and the user-visible UI can react), while preview/dev keeps an explicit
  // 202 non-delivery result for exercising the form without Resend. The client
  // maps `delivered: false` to an error, never to delivered success. (CODE-006.)
  const inProd = isProduction(process.env);

  if (!apiKey || !toEmail) {
    // Record a redacted diagnostic in every environment. Production then
    // returns 503; preview/dev returns 202 with `delivered: false`. PII
    // (email + freetext + UA + referer) is NEVER written — only counts and
    // structural flags. (Audit CODE-002.)
    console.log("[feedback]", JSON.stringify({
      ts: payload.timestamp,
      lang: payload.lang,
      occ: payload.occupation_id,
      options: payload.options,
      has_email: !!payload.email,
      freetext_length: payload.freetext.length,
      ua_hash: shortHash(payload.user_agent || ""),
      missing_config: !apiKey ? "RESEND_API_KEY" : "FEEDBACK_TO_EMAIL",
    }));
    if (inProd) {
      // CODE-006: in production surface as 503 so misconfig doesn't
      // silently swallow user submits.
      return json(
        { ok: false, error: "feedback_delivery_failed", warn: "config_missing" },
        { status: 503, headers: cors },
      );
    }
    return json(
      { ok: true, delivered: false, warn: "config_missing" },
      { status: 202, headers: cors },
    );
  }

  try {
    const subject = `[mirai-shigoto] feedback ${options.length ? "[" + options.join(",") + "]" : ""}`.slice(0, 200);
    const html = `
      <h3>Feedback received</h3>
      <p><strong>When:</strong> ${escapeHtml(payload.timestamp)}</p>
      <p><strong>Lang:</strong> ${escapeHtml(lang)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email || "(not provided)")}</p>
      <p><strong>Occupation ID:</strong> ${escapeHtml(occupationId || "(none)")}</p>
      <p><strong>Selected options:</strong> ${options.length ? options.map(escapeHtml).join(", ") : "(none)"}</p>
      <p><strong>Free text:</strong></p>
      <pre style="background:#f5f5f5;padding:10px;white-space:pre-wrap;font-family:monospace">${escapeHtml(freetext) || "(empty)"}</pre>
      <hr>
      <p style="color:#888;font-size:12px">UA: ${escapeHtml(payload.user_agent)}</p>
      <p style="color:#888;font-size:12px">Referer: ${escapeHtml(payload.referer)}</p>
    `;

    // Resend transactional email — 5000ms cap. Email APIs can be slow
    // under load; bound the wait so a stalled Resend doesn't wedge
    // the Edge invocation. (Audit CODE-007.)
    const r = await fetchWithTimeout(`${RESEND_BASE}/emails`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject,
        html,
        // If user provided email, set Reply-To so operator can answer them directly
        reply_to: email || undefined,
      }),
    }, 5000);

    if (r.ok) {
      return json({ ok: true, delivered: true }, { headers: cors });
    }

    const errBody = await r.json().catch(() => ({}));
    console.error("[feedback] Resend send error", { status: r.status, body: errBody });
    // PII-safe redacted summary on delivery failure. (Audit CODE-002.)
    console.log("[feedback]", JSON.stringify({
      ts: payload.timestamp, lang: payload.lang, occ: payload.occupation_id,
      options: payload.options, has_email: !!payload.email,
      freetext_length: payload.freetext.length,
      ua_hash: shortHash(payload.user_agent || ""),
      delivery: "failed", resend_status: r.status,
    }));
    if (inProd) {
      // CODE-006: surface delivery failure with 503 in prod so the
      // frontend + monitoring see the misbehavior.
      return json(
        { ok: false, error: "feedback_delivery_failed", warn: "delivery_failed" },
        { status: 503, headers: cors },
      );
    }
    // Preview/dev: return the explicit 202 non-delivery result. The UI maps
    // `delivered: false` + `warn` to a retryable delivery error.
    return json(
      { ok: true, delivered: false, warn: "delivery_failed" },
      { status: 202, headers: cors },
    );
  } catch (err) {
    console.error("[feedback] handler error", err);
    console.log("[feedback]", JSON.stringify({
      ts: payload.timestamp, lang: payload.lang, occ: payload.occupation_id,
      options: payload.options, has_email: !!payload.email,
      freetext_length: payload.freetext.length,
      ua_hash: shortHash(payload.user_agent || ""),
      delivery: "error", err_name: (err && err.name) || "unknown",
    }));
    if (inProd) {
      // CODE-006: surface exception (incl. timeout AbortError) with
      // 503 in prod.
      return json(
        { ok: false, error: "feedback_delivery_failed", warn: "delivery_error" },
        { status: 503, headers: cors },
      );
    }
    return json(
      { ok: true, delivered: false, warn: "delivery_error" },
      { status: 202, headers: cors },
    );
  }
}
