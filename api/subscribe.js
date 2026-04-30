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

export const config = { runtime: "edge" };

const RESEND_BASE = "https://api.resend.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = new Set([
  "https://mirai-shigoto.com",
  "http://localhost:8765",
  "http://localhost:3000",
]);

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

  // ---- parse body ----
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: cors });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const lang = body.lang === "en" ? "en" : "ja";
  const occupationId = body.occupation_id ? String(body.occupation_id).slice(0, 16) : "";
  const source = String(body.source || "unknown").slice(0, 32);
  const honeypot = String(body.htmlfield || "");

  // ---- honeypot: pretend success, drop on the floor ----
  if (honeypot) {
    return json({ ok: true }, { headers: cors });
  }

  // ---- validate email ----
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: "invalid_email" }, { status: 400, headers: cors });
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

    console.error("[subscribe] Resend error", { status: r.status, body: errBody });
    return json({ error: "subscribe_failed", detail: errBody.message || null }, { status: 502, headers: cors });
  } catch (err) {
    console.error("[subscribe] handler error", err);
    return json({ error: "server_error" }, { status: 500, headers: cors });
  }
}
