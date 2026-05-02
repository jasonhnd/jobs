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
//   RESEND_API_KEY           — auto-injected by Resend Vercel integration
//   FEEDBACK_TO_EMAIL        — operator inbox (e.g., feedback@mirai-shigoto.com).
//                              If unset, falls back to logging the payload and
//                              returning success (so the frontend stays unblocked
//                              even before the env var is wired up).
//   FEEDBACK_FROM_EMAIL      — sender address (default: onboarding@resend.dev,
//                              works without verified domain).

export const config = { runtime: "edge" };

const RESEND_BASE = "https://api.resend.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = new Set([
  "https://mirai-shigoto.com",
  "http://localhost:8765",
  "http://localhost:3000",
]);
const KNOWN_OPTIONS = new Set([
  "b2c_career",
  "b2c_student",
  "b2b_hr",
  "b2b_school",
  "b2b_training",
  "media",
  "developer",
  "methodology",
  "data_quality",
  "curiosity",
  "other",
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

// Server-side Origin/Referer enforcement (Audit CODE-003). CORS only protects
// browsers; curl / server-to-server bots ignore it. We additionally 403 any
// request whose Origin OR Referer is unknown — the form is browser-only, so
// a missing-and-suspicious origin is never a real submission.
const MAX_BODY_BYTES = 8 * 1024;  // 8 KB caps freetext (2 KB) + JSON overhead
function enforceOriginOr403(req) {
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  if (origin && ALLOWED_ORIGINS.has(origin)) return null;
  for (const allowed of ALLOWED_ORIGINS) {
    if (referer.startsWith(allowed)) return null;
  }
  return new Response(JSON.stringify({ error: "forbidden_origin" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
function enforceBodySizeOr413(req) {
  const len = parseInt(req.headers.get("content-length") || "0", 10);
  if (len > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

// Tiny stable hash for opaque rate-limit / log keys. Not crypto — just enough
// to bucket UA strings without keeping the original.
function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"']/g, c => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  })[c]);
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
  const tooBig = enforceBodySizeOr413(req);
  if (tooBig) return tooBig;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: cors });
  }

  // ---- honeypot ----
  if (body.htmlfield) return json({ ok: true }, { headers: cors });

  // ---- normalize ----
  const email = body.email ? String(body.email).trim().toLowerCase() : "";
  const lang = body.lang === "en" ? "en" : "ja";
  const occupationId = body.occupation_id ? String(body.occupation_id).slice(0, 16) : "";
  const freetext = String(body.freetext || "").slice(0, 2000);
  const optionsRaw = Array.isArray(body.options) ? body.options : [];
  // Filter to known option keys only (don't trust client)
  const options = optionsRaw
    .map(o => String(o).slice(0, 32))
    .filter(o => KNOWN_OPTIONS.has(o))
    .slice(0, 11);

  // ---- minimum signal ----
  if (options.length === 0 && freetext.trim().length === 0) {
    return json({ error: "empty_feedback" }, { status: 400, headers: cors });
  }
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return json({ error: "invalid_email" }, { status: 400, headers: cors });
  }

  const payload = {
    timestamp: new Date().toISOString(),
    email: email || null,
    lang,
    occupation_id: occupationId || null,
    options,
    freetext,
    user_agent: req.headers.get("user-agent") || "",
    referer: req.headers.get("referer") || "",
  };

  // ---- send to operator inbox (or log) ----
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.FEEDBACK_TO_EMAIL;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !toEmail) {
    // Graceful fallback: log a redacted summary + return ok so frontend
    // stays unblocked while the operator wires up FEEDBACK_TO_EMAIL.
    // PII (email + freetext + UA + referer) is NEVER written — only counts
    // and structural flags. (Audit CODE-002.)
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
    return json({ ok: true, queued: false }, { headers: cors });
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

    const r = await fetch(`${RESEND_BASE}/emails`, {
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
    });

    if (r.ok) {
      return json({ ok: true, queued: true }, { headers: cors });
    }

    const errBody = await r.json().catch(() => ({}));
    console.error("[feedback] Resend send error", { status: r.status, body: errBody });
    // PII-safe redacted summary on delivery failure — caller is told ok=true
    // so they don't retry and double-bill us, but we log enough to know the
    // message slipped (Audit CODE-002).
    console.log("[feedback]", JSON.stringify({
      ts: payload.timestamp, lang: payload.lang, occ: payload.occupation_id,
      options: payload.options, has_email: !!payload.email,
      freetext_length: payload.freetext.length,
      ua_hash: shortHash(payload.user_agent || ""),
      delivery: "failed", resend_status: r.status,
    }));
    return json({ ok: true, queued: false, warn: "delivery_failed" }, { headers: cors });
  } catch (err) {
    console.error("[feedback] handler error", err);
    console.log("[feedback]", JSON.stringify({
      ts: payload.timestamp, lang: payload.lang, occ: payload.occupation_id,
      options: payload.options, has_email: !!payload.email,
      freetext_length: payload.freetext.length,
      ua_hash: shortHash(payload.user_agent || ""),
      delivery: "error", err_name: (err && err.name) || "unknown",
    }));
    return json({ ok: true, queued: false, warn: "delivery_error" }, { headers: cors });
  }
}
