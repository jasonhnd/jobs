// src/lib/subscribe-helpers.js — pure validation + normalization for the
// /api/subscribe endpoint. Extracted from api/subscribe.js so the body-
// parsing flow is unit-testable without an Edge runtime.
//
// `.js` (not `.ts`) matches api/subscribe.js's extension; same rationale
// as feedback-helpers.js.
//
// Exported surface:
//
//   EMAIL_RE, MAX_BODY_BYTES, MAX_EMAIL_LEN, MAX_OCCUPATION_ID_LEN, MAX_SOURCE_LEN
//      Configuration constants.
//
//   parseSubscribeBody(raw)
//      Pure validate + normalize. Returns a discriminated union:
//         { kind: 'silent-success' }        ← honeypot tripped
//         { kind: 'error', code: '…' }      ← validation failed
//         { kind: 'ok', payload: {…} }      ← normalized payload
//
//   resolveLang(input)
//      Picks 'en' iff input === 'en'; otherwise defaults to 'ja'.
//      Exported separately because subscribe.js uses it to choose the
//      Resend audience env var.

/** RFC-ish email regex (same as feedback). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Streaming body-cap for /api/subscribe (matches api/subscribe.js). */
export const MAX_BODY_BYTES = 4 * 1024;

/** RFC 5321 email length cap. */
export const MAX_EMAIL_LEN = 254;

/** Occupation ID is stored as Resend contact `first_name`; cap matches the
 *  feedback endpoint to keep the two payloads consistent. */
export const MAX_OCCUPATION_ID_LEN = 16;

/** Attribution source string (`last_name` in Resend); cap matches the
 *  attribution-channel taxonomy on the frontend (modal_t2, header_t1, etc). */
export const MAX_SOURCE_LEN = 32;

/** 'en' iff input === 'en'; default 'ja'. Exposed so api/subscribe.js can
 *  pick the right env var (RESEND_AUDIENCE_ID_JA / _EN) using the same logic. */
export function resolveLang(input) {
  return input === 'en' ? 'en' : 'ja';
}

/**
 * Validate + normalize a parsed subscribe body. Pure: no I/O, no env
 * reads, no logging.
 *
 * Return shape (discriminated):
 *   { kind: 'silent-success' }                 — honeypot tripped
 *   { kind: 'error', code: '<reason>' }        — body failed validation
 *   { kind: 'ok', payload: {…} }               — normalized payload
 *
 * `payload`:
 *   email          (lowercased, trimmed)
 *   lang           ('ja' | 'en')
 *   occupation_id  (string, clipped to MAX_OCCUPATION_ID_LEN, or empty)
 *   source         (string, clipped to MAX_SOURCE_LEN; defaults to 'unknown')
 *
 * Error codes:
 *   'invalid_body'   — input is not a plain object
 *   'invalid_email'  — email missing, too long, or fails EMAIL_RE
 */
export function parseSubscribeBody(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'error', code: 'invalid_body' };
  }

  const email = String(raw.email || '').trim().toLowerCase();
  const lang = resolveLang(raw.lang);
  const occupationId = raw.occupation_id ? String(raw.occupation_id).slice(0, MAX_OCCUPATION_ID_LEN) : '';
  const source = String(raw.source || 'unknown').slice(0, MAX_SOURCE_LEN);
  const honeypot = String(raw.htmlfield || '');

  // Honeypot: pretend success, drop on the floor. Real users never see
  // the field; bots fill anything.
  if (honeypot) {
    return { kind: 'silent-success' };
  }

  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return { kind: 'error', code: 'invalid_email' };
  }

  return {
    kind: 'ok',
    payload: {
      email,
      lang,
      occupation_id: occupationId,
      source,
    },
  };
}
