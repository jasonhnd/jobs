#!/usr/bin/env node
/**
 * oauth-init.mjs — One-time OAuth setup for the mirai-shigoto GA4 admin tooling.
 *
 * Why this exists:
 *   GA4 sometimes refuses to grant access to GCP service accounts (cross-org /
 *   workspace policies). Using the OAuth user-credential flow instead — the
 *   user (Jason) already has full GA4 admin access, so the script can just
 *   "act as Jason" via OAuth refresh tokens.
 *
 * Flow:
 *   1. Reads a Desktop OAuth client JSON from ~/.config/mirai-shigoto/oauth-client.json
 *      (downloaded from GCP Console → APIs & Services → Credentials →
 *      OAuth client ID → Desktop app)
 *   2. Spins up a localhost HTTP server on a random port
 *   3. Opens the browser to Google's OAuth consent page
 *   4. User signs in + clicks "Allow"
 *   5. Google redirects back to the localhost callback with an auth code
 *   6. Script exchanges the code for a refresh_token, saves to
 *      ~/.config/mirai-shigoto/oauth-token.json (perms 0600)
 *   7. setup-ga4.mjs uses that refresh_token automatically on every run —
 *      no further interaction needed.
 *
 * Run once. After that, `npm run discover` / `npm run setup` work
 * non-interactively.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { exec } from "node:child_process";
import { google } from "googleapis";

const CONFIG_DIR = path.join(os.homedir(), ".config", "mirai-shigoto");
const CLIENT_FILE = path.join(CONFIG_DIR, "oauth-client.json");
const TOKEN_FILE = path.join(CONFIG_DIR, "oauth-token.json");
const SCOPES = ["https://www.googleapis.com/auth/analytics.edit"];

function log(...args) { console.log("[oauth-init]", ...args); }
function fatal(msg) { console.error("[oauth-init] ERROR:", msg); process.exit(1); }

if (!fs.existsSync(CLIENT_FILE)) {
  fatal(
    `Desktop OAuth client JSON not found: ${CLIENT_FILE}\n` +
    `Create one at https://console.cloud.google.com → APIs & Services →\n` +
    `Credentials → Create credentials → OAuth client ID → Desktop app,\n` +
    `then save the downloaded JSON to that path.`,
  );
}

const clientCreds = JSON.parse(fs.readFileSync(CLIENT_FILE, "utf8"));
const installed = clientCreds.installed || clientCreds.web;
if (!installed) fatal("OAuth client JSON missing `installed` field. Did you pick Desktop app type?");
const { client_id, client_secret } = installed;

// Find a free port on localhost for the OAuth callback.
const port = await new Promise((resolve, reject) => {
  const tmp = http.createServer();
  tmp.listen(0, "127.0.0.1", () => {
    const p = tmp.address().port;
    tmp.close(() => resolve(p));
  });
  tmp.on("error", reject);
});
const redirectUri = `http://127.0.0.1:${port}/callback`;

const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri);
const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",          // request a refresh_token (not just an access token)
  prompt: "consent",                // force consent screen so refresh_token is returned even on re-auth
  scope: SCOPES,
});

log("Opening browser for Google OAuth consent…");
log("If the browser does not open automatically, paste this URL into any browser:");
log("  " + authUrl);

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname !== "/callback") {
      res.writeHead(404).end("Not found");
      return;
    }
    const c = url.searchParams.get("code");
    const e = url.searchParams.get("error");
    if (e) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(`<!doctype html><meta charset="utf-8"><h1>OAuth error</h1><p>${e}</p><p>Close this tab and re-run.</p>`);
      server.close();
      reject(new Error(`OAuth denied: ${e}`));
      return;
    }
    if (!c) {
      res.writeHead(400).end("Missing ?code");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(`<!doctype html><meta charset="utf-8"><h1 style="font-family:system-ui">✓ Authentication successful</h1><p style="font-family:system-ui">You can close this tab and return to the terminal.</p>`);
    server.close();
    resolve(c);
  });
  server.listen(port, "127.0.0.1");

  const opener = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
      : "xdg-open";
  exec(`${opener} "${authUrl}"`);
});

const { tokens } = await oauth2.getToken(code);
if (!tokens.refresh_token) {
  fatal(
    "No refresh_token returned. The most common cause is that this Google\n" +
    "account already granted consent to this OAuth client previously, so\n" +
    "Google reused the existing grant without issuing a new refresh_token.\n" +
    "Fix: go to https://myaccount.google.com/permissions, find\n" +
    "`mirai-shigoto-cli` (or whatever the app is named), revoke access,\n" +
    "then run this script again.",
  );
}

fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
fs.writeFileSync(
  TOKEN_FILE,
  JSON.stringify({
    type: "authorized_user",
    client_id,
    client_secret,
    refresh_token: tokens.refresh_token,
    token_uri: "https://oauth2.googleapis.com/token",
  }, null, 2),
  { mode: 0o600 },
);

log(`✓ Saved OAuth refresh token: ${TOKEN_FILE}`);
log(`  Permissions: 0600 (owner-only read)`);
log("");
log("Setup complete. Now you can run:");
log("  npm run discover   # list your GA4 properties");
log("  npm run setup:dry  # preview spec changes");
log("  npm run setup      # apply spec to GA4");
