// src/lib/http-client.js — `fetch` wrapped in an AbortController-backed
// timeout. Exists because the platform `fetch` has no built-in timeout
// option, and a stalled GA4 Measurement Protocol upstream would otherwise
// wedge the Edge function until Vercel's
// per-invocation cap (default 25s for Edge). That delay is paid by the
// invocation completes. (Audit CODE-007.)
//
// Lives under src/lib/ — not api/ — because Vercel auto-routes every
// file under api/ as an HTTP endpoint, and we do NOT want this to be
// reachable over HTTP. JS-only (not TS) so Edge runtime imports work
// without a build step, matching the Edge entry points that import it.
//
// Pure I/O wrapper — no module-level state. AbortController is built
// into the Edge runtime and modern Node; zero new dependencies.

/**
 * `fetch` with a hard timeout. Aborts the underlying request via
 * AbortController after `timeoutMs`; the rejection surfaces as an
 * `AbortError` (DOMException name='AbortError'), which callers can
 * treat identically to a network error.
 *
 * If `init.signal` is already set, the existing signal is preserved
 * via `AbortSignal.any` (Edge runtime supports it) — both the caller-
 * supplied signal AND the timeout can abort the request.
 *
 * Timer is ALWAYS cleared in a `finally` so a slow-but-successful
 * request doesn't leave a dangling timer that fires uselessly later.
 *
 * @param {string | URL | Request} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs] hard timeout in milliseconds (default 5000)
 * @param {typeof fetch} [fetchImpl] implementation to call (default global
 *   `fetch`). Tests and handlers that already inject a fetch double pass it
 *   here so the deadline still aborts that double.
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs = 5000, fetchImpl = fetch) {
  const { signal, clear } = armTimeout(init, timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal });
  } finally {
    clear();
  }
}

/**
 * @template T
 * @typedef {{ response: Response, body: T }} FetchedBody
 */

/**
 * `fetchWithTimeout` returns once the response HEADERS arrive, so a body
 * that stalls afterwards is not covered by its deadline (audit 2026-10-07,
 * #861). These helpers keep the same timeout armed until the body has been
 * fully read, then clear it. A stalled body rejects with `AbortError`.
 *
 * The body is read whatever the status, so callers can still inspect an
 * error payload; check `response.ok` / `response.status` yourself.
 */

/**
 * Body parsed as JSON; `body` is `null` when the payload is not valid JSON.
 *
 * @param {string | URL | Request} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<FetchedBody<unknown>>}
 */
export function fetchJsonWithTimeout(url, init = {}, timeoutMs = 5000, fetchImpl = fetch) {
  return fetchAndRead(url, init, timeoutMs, fetchImpl, async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  });
}

/**
 * @param {string | URL | Request} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<FetchedBody<string>>}
 */
export function fetchTextWithTimeout(url, init = {}, timeoutMs = 5000, fetchImpl = fetch) {
  return fetchAndRead(url, init, timeoutMs, fetchImpl, (response) => response.text());
}

/**
 * @param {string | URL | Request} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<FetchedBody<ArrayBuffer>>}
 */
export function fetchBufferWithTimeout(url, init = {}, timeoutMs = 5000, fetchImpl = fetch) {
  return fetchAndRead(url, init, timeoutMs, fetchImpl, (response) => response.arrayBuffer());
}

/**
 * @template T
 * @param {string | URL | Request} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @param {typeof fetch} fetchImpl
 * @param {(response: Response) => Promise<T>} read
 * @returns {Promise<FetchedBody<T>>}
 */
async function fetchAndRead(url, init, timeoutMs, fetchImpl, read) {
  const { signal, clear } = armTimeout(init, timeoutMs);
  const abort = rejectOnAbort(signal);
  try {
    const response = await Promise.race([fetchImpl(url, { ...init, signal }), abort.promise]);
    // Race the read too: the runtime aborts a fetch body stream on signal,
    // but an injected fetch double may not — the deadline must still win.
    const body = await Promise.race([read(response), abort.promise]);
    return { response, body };
  } finally {
    abort.dispose();
    clear();
  }
}

/**
 * Timeout signal, composed with a caller-supplied `init.signal` if present
 * so either source can abort. `AbortSignal.any` is the standard primitive;
 * older runtimes fall back to forwarding the caller's abort onto ours.
 *
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @returns {{ signal: AbortSignal, clear: () => void }}
 */
function armTimeout(init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let signal = controller.signal;
  if (init.signal) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
      signal = AbortSignal.any([init.signal, controller.signal]);
    } else {
      // Best-effort: forward the caller's abort onto our controller.
      if (init.signal.aborted) controller.abort();
      else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }
  return { signal, clear: () => clearTimeout(timer) };
}

/**
 * A promise that rejects with an `AbortError` once `signal` aborts and never
 * settles otherwise. `dispose` detaches the listener so a later abort cannot
 * surface as an unhandled rejection.
 *
 * @param {AbortSignal} signal
 * @returns {{ promise: Promise<never>, dispose: () => void }}
 */
function rejectOnAbort(signal) {
  /** @type {() => void} */
  let onAbort = () => {};
  /** @type {Promise<never>} */
  const promise = new Promise((_resolve, reject) => {
    onAbort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  // Mark handled: when the fetch itself rejects first, this one may still
  // reject before dispose() runs.
  promise.catch(() => {});
  return { promise, dispose: () => signal.removeEventListener("abort", onAbort) };
}
