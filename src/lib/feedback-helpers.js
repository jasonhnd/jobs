// src/lib/feedback-helpers.js — pure validation + normalization for the
// /api/feedback endpoint. Extracted from api/feedback.js so the body-
// parsing flow is unit-testable without an Edge runtime.
//
// `.js` (not `.ts`) to match api/feedback.js's own extension — the
// pattern established by api-security.js for shared Edge helpers.
// Vercel's Edge bundler resolves `.js → .ts` for deps too, but staying
// in `.js` here keeps the file readable as plain ES modules with no
// type-stripping step.
//
// Exported surface:
//
//   KNOWN_OPTIONS, MAX_BODY_BYTES, MAX_FREETEXT_LEN
//      Configuration constants (sets / numbers). Frozen so consumers
//      can't accidentally mutate them.
//
//   EMAIL_RE
//      Same RFC-ish regex feedback.js already uses. Single source.
//
//   shortHash(s)
//      Tiny stable hash for log keys. NOT cryptographic — just enough
//      to bucket UA strings.
//
//   escapeHtml(s)
//      5-char HTML escape for the operator-email template body.
//
//   parseFeedbackBody(raw, { now })
//      Pure validate + normalize. Input: the already-JSON.parsed body
//      object. Output: a discriminated union:
//         { kind: 'silent-success' }        ← honeypot tripped
//         { kind: 'error', code: '…' }      ← validation failed
//         { kind: 'ok', payload: {…} }      ← normalized payload
//      `payload` shape matches what api/feedback.js builds today.
//      `now` is dependency-injected for deterministic tests.

/** RFC-ish email regex (same as the production validator). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Allow-listed feedback-option keys. Anything else is silently filtered. */
export const KNOWN_OPTIONS = Object.freeze(new Set([
  'b2c_career',
  'b2c_student',
  'b2b_hr',
  'b2b_school',
  'b2b_training',
  'media',
  'developer',
  'methodology',
  'data_quality',
  'curiosity',
  'other',
]));

/** Streaming body-cap for /api/feedback (matches api/feedback.js). */
export const MAX_BODY_BYTES = 8 * 1024;

/** Free-text response clip length (per-field cap, before serialization). */
export const MAX_FREETEXT_LEN = 2000;

/** Maximum number of selected options accepted (cap = KNOWN_OPTIONS.size). */
export const MAX_OPTIONS = 11;

/** Maximum length of `occupation_id` accepted. Longer values get clipped. */
export const MAX_OCCUPATION_ID_LEN = 16;

/** Maximum length of any single option key accepted. Longer values get clipped. */
export const MAX_OPTION_KEY_LEN = 32;

/** Maximum email address length (RFC 5321 limit). */
export const MAX_EMAIL_LEN = 254;

/**
 * Tiny stable hash for opaque rate-limit / log keys. NOT crypto — just
 * enough to bucket UA strings without persisting the original. Uses
 * djb2 seed (5381) + XOR-shift. Output: base-36 string.
 */
export function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * 5-char HTML escape for the operator-email template body. Match the
 * production replace order so a future refactor doesn't subtly change
 * the output (e.g. swap `&` → `&amp;` to escape before/after other
 * entities). Single replace with a lookup table keeps it deterministic.
 */
const HTML_ESCAPE_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
};
export function escapeHtml(s) {
  return String(s).replace(/[<>&"']/g, (c) => HTML_ESCAPE_MAP[c]);
}

/**
 * Validate + normalize a parsed feedback body. Pure: no I/O, no env
 * reads, no logging. Caller (api/feedback.js) handles the side effects.
 *
 * Return shape (discriminated):
 *   { kind: 'silent-success' }                 — honeypot tripped; pretend OK
 *   { kind: 'error', code: '<reason>' }        — body failed validation
 *   { kind: 'ok', payload: {…} }               — normalized payload ready to ship
 *
 * `payload` contains:
 *   timestamp     (ISO string, set from `now` for testability)
 *   email         (lowercased, trimmed, or null)
 *   lang          ('ja' | 'en' — defaults to 'ja')
 *   occupation_id (string, clipped to 16 chars, or null)
 *   options       (string[], filtered to KNOWN_OPTIONS, max MAX_OPTIONS)
 *   freetext      (string, clipped to MAX_FREETEXT_LEN)
 *
 * Error codes (string literals):
 *   'invalid_body'    — input is not a plain object
 *   'empty_feedback'  — no options selected AND no free text
 *   'invalid_email'   — email too long or fails EMAIL_RE
 */
export function parseFeedbackBody(raw, { now } = { now: () => new Date() }) {
  // Defensive: callers always pass a JSON.parse() result, but null /
  // arrays / scalars sneak in if the upstream parses an exotic body.
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'error', code: 'invalid_body' };
  }

  // Honeypot — bots fill this field, real users never see it. Silent
  // success so the bot doesn't tune its strategy.
  if (raw.htmlfield) {
    return { kind: 'silent-success' };
  }

  const email = raw.email ? String(raw.email).trim().toLowerCase() : '';
  const lang = raw.lang === 'en' ? 'en' : 'ja';
  const occupationId = raw.occupation_id ? String(raw.occupation_id).slice(0, MAX_OCCUPATION_ID_LEN) : '';
  const freetext = String(raw.freetext || '').slice(0, MAX_FREETEXT_LEN);
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  const options = optionsRaw
    .map((o) => String(o).slice(0, MAX_OPTION_KEY_LEN))
    .filter((o) => KNOWN_OPTIONS.has(o))
    .slice(0, MAX_OPTIONS);

  // Minimum signal: must have at least one selected option OR
  // non-empty free text. Otherwise the submission is noise.
  if (options.length === 0 && freetext.trim().length === 0) {
    return { kind: 'error', code: 'empty_feedback' };
  }
  if (email && (email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email))) {
    return { kind: 'error', code: 'invalid_email' };
  }

  return {
    kind: 'ok',
    payload: {
      timestamp: now().toISOString(),
      email: email || null,
      lang,
      occupation_id: occupationId || null,
      options,
      freetext,
    },
  };
}
