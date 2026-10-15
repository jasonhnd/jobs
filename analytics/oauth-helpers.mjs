/**
 * oauth-helpers.mjs — the parts of oauth-init.mjs that touch the file system
 * and the network, kept free of googleapis so they can be tested on their own
 * (analytics/oauth-helpers.test.mjs, run by the root `bun run test`).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/** How long oauth-init waits for the browser to come back before giving up. */
export const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * HTML-escape for the localhost callback's tiny response page. Tiny because
 * the page is only seen for a few seconds before the user closes the tab,
 * but defensive because we interpolate query-string values into it.
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Writes `data` as JSON to `file` with owner-only permissions: `dir` 0700,
 * `file` 0600.
 *
 * `mode` on mkdirSync / writeFileSync only applies when the entry is created,
 * so an existing 0644 token file or 0755 directory used to keep its old
 * permissions while the log claimed 0600 (#862). The directory is chmod-ed
 * explicitly, and the file is written to a fresh temp name (created 0600,
 * exclusive) and renamed over the target, so the token is never readable by
 * others even for a moment.
 */
export function writePrivateJson(dir, file, data) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

/**
 * Starts the localhost server the OAuth redirect comes back to.
 *
 * Listens directly on the port it reports (port 0 picks a free one), rather
 * than probing a free port and re-binding it later, which another process
 * could take in between. Resolves `{ port, code }` once listening; `code`
 * settles on the first callback, a server error, or after `timeoutMs`.
 * A listen failure rejects the outer promise.
 */
export function startOAuthCallbackServer({ expectedState, timeoutMs = OAUTH_CALLBACK_TIMEOUT_MS, port = 0 }) {
  return new Promise((resolveStart, rejectStart) => {
    let settle;
    const code = new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
    let listening = false;
    let timer = null;
    const finish = (error, value) => {
      clearTimeout(timer);
      server.close();
      if (error) settle.reject(error);
      else settle.resolve(value);
    };

    const server = http.createServer((req, res) => {
      // A kept-alive browser socket would otherwise hold the process open
      // after the token is saved.
      res.setHeader("Connection", "close");
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end("Not found");
        return;
      }
      const c = url.searchParams.get("code");
      const e = url.searchParams.get("error");
      // CSRF: reject any callback whose state doesn't match what we issued.
      if (url.searchParams.get("state") !== expectedState) {
        res
          .writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
          .end(
            `<!doctype html><meta charset="utf-8"><h1 style="font-family:system-ui">OAuth state mismatch</h1>` +
            `<p style="font-family:system-ui">This callback didn't originate from your terminal. Close the tab and re-run.</p>`,
          );
        finish(new Error("OAuth state mismatch — possible CSRF"));
        return;
      }
      if (e) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
          .end(`<!doctype html><meta charset="utf-8"><h1>OAuth error</h1><p>${escapeHtml(e)}</p><p>Close this tab and re-run.</p>`);
        finish(new Error(`OAuth denied: ${e}`));
        return;
      }
      if (!c) {
        res.writeHead(400).end("Missing ?code");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(`<!doctype html><meta charset="utf-8"><h1 style="font-family:system-ui">✓ Authentication successful</h1><p style="font-family:system-ui">You can close this tab and return to the terminal.</p>`);
      finish(null, c);
    });

    server.on("error", (error) => {
      if (!listening) {
        rejectStart(error);
        return;
      }
      finish(error);
    });

    server.listen(port, "127.0.0.1", () => {
      listening = true;
      timer = setTimeout(
        () => finish(new Error(`Timed out after ${timeoutMs / 1000}s waiting for the OAuth callback. Re-run to try again.`)),
        timeoutMs,
      );
      resolveStart({ port: server.address().port, code });
    });
  });
}
