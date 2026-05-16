// api/subscribe.js — Vercel Edge Function: write subscriber to Resend audience.
//
// POST { email, lang, occupation_id?, source, htmlfield }
//
//   email          required, validated server-side (RFC-ish)
//   lang           "ja" | "en" — picks audience
//   occupation_id  optional. Stored as Resend contact `first_name` so we can
//                  segment the monthly newsletter by occupation later.
//   source         "modal_t2" | "header_t1" | string — stored as `last_name`
//   htmlfield      honeypot. Bots fill it; real users never see it. Filled =
//                  silent success (don't tip the bot off, don't write a contact).
//
// Env vars (set on Vercel; the Resend marketplace integration auto-injects API key):
//   RESEND_API_KEY           — auto-injected
//   RESEND_AUDIENCE_ID_JA    — manual
//   RESEND_AUDIENCE_ID_EN    — manual
//
// Defense in depth (current):
//   1. CORS — only mirai-shigoto.com + localhost dev ports.
//   2. Origin/Referer 403 — server-side enforcement, parses Referer via `URL`
//      and compares on `.origin` (no startsWith) so `mirai-shigoto.com.evil.com`
//      can't impersonate the real origin.
//   3. Body cap (4 KB) — STREAMING enforcement; aborts read once cumulative
//      byte count exceeds the cap. Doesn't rely on advisory content-length.
//   4. Honeypot field (htmlfield) — silently drops obvious bot traffic.
//   5. Resend 409 idempotency — duplicates resolve to success without rewrites.
//   6. Resend errors are NOT echoed to the client — third-party error strings
//      could leak audience ids or internal config. Server logs the detail.
//   7. Per-IP rate limit (Upstash Redis REST) — 5 POST per 5 minutes.
//      Tighter than feedback (10/5min) because subscribe is opt-in and
//      should happen ≤1 time per legitimate user. Degrades gracefully
//      when UPSTASH_REDIS_REST_URL/TOKEN env unset.
//   8. Cloudflare Turnstile — verified server-side when
//      TURNSTILE_SECRET_KEY env is set. Degrades gracefully when missing.

import {
  makeOriginGate,
  readBodyText,
  BodyTooLargeError,
  rateLimitCheck,
  verifyTurnstile,
  clientIpFromRequest,
} from "../src/lib/api-security.js";
import { parseSubscribeBody, MAX_BODY_BYTES } from "../src/lib/subscribe-helpers.js";

export const config = { runtime: "edge" };

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

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405, headers: cors });
  }

  // ---- server-side gate (audit CODE-003) ----
  const denied = enforceOriginOr403(req);
  if (denied) return denied;

  // ---- per-IP rate limit (Audit P2-11, 2026-05-17) ----
  // Tighter than feedback: subscribe is opt-in and should fire ≤1 time
  // per legitimate user. 5 POSTs / 5 min still gives a forgiving margin
  // for double-clicks + 1 retry, but blocks abuse-flood scripts.
  const ip = clientIpFromRequest(req);
  const rl = await rateLimitCheck({
    ip,
    namespace: "subscribe",
    limit: 5,
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

  // ---- parse body (streaming size cap) ----
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
  const parsed = parseSubscribeBody(body);
  if (parsed.kind === "silent-success") {
    return json({ ok: true }, { headers: cors });
  }
  if (parsed.kind === "error") {
    return json({ error: parsed.code }, { status: 400, headers: cors });
  }
  const { email, lang, occupation_id: occupationId, source } = parsed.payload;

  // Turnstile verification (Audit P2-11, 2026-05-17). Frontend widget
  // submits `cf-turnstile-response` token alongside the email. Skipped
  // entirely when TURNSTILE_SECRET_KEY env is unset (no env, no check).
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

  // ---- env ----
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = lang === "en"
    ? process.env.RESEND_AUDIENCE_ID_EN
    : process.env.RESEND_AUDIENCE_ID_JA;

  if (!apiKey || !audienceId) {
    console.error("[subscribe] missing env", { hasKey: !!apiKey, hasAudience: !!audienceId, lang });
    return json({ error: "config_missing" }, { status: 500, headers: cors });
  }

  // ---- call Resend Contacts API ----
  try {
    const r = await fetch(`${RESEND_BASE}/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        first_name: occupationId,  // segmenting key for monthly newsletter
        last_name: source,         // attribution channel
        unsubscribed: false,
      }),
    });

    if (r.ok) {
      return json({ ok: true }, { headers: cors });
    }

    // Try to read error detail (Resend returns { name, message, statusCode })
    const errBody = await r.json().catch(() => ({}));
    const msg = String(errBody.message || errBody.name || "").toLowerCase();

    // Already in audience — treat as idempotent success
    if (
      r.status === 409 ||
      msg.includes("already") ||
      msg.includes("exists") ||
      msg.includes("duplicate")
    ) {
      return json({ ok: true, alreadySubscribed: true }, { headers: cors });
    }

    // Log the full Resend response server-side, but never echo `errBody.message`
    // to the client — third-party error strings can leak audience ids or
    // internal config to attackers probing the endpoint.
    console.error("[subscribe] Resend error", { status: r.status, body: errBody });
    return json({ error: "subscribe_failed" }, { status: 502, headers: cors });
  } catch (err) {
    console.error("[subscribe] handler error", err);
    return json({ error: "server_error" }, { status: 500, headers: cors });
  }
}
