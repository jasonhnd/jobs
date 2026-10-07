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
 *   2. Spins up a localhost HTTP server on a random port (gives up after
 *      OAUTH_CALLBACK_TIMEOUT_MS if the browser never comes back)
 *   3. Opens the browser to Google's OAuth consent page
 *   4. User signs in + clicks "Allow"
 *   5. Google redirects back to the localhost callback with an auth code
 *   6. Script exchanges the code for a refresh_token, saves to
 *      ~/.config/mirai-shigoto/oauth-token.json (perms 0600)
 *   7. setup-ga4.mjs uses that refresh_token automatically on every run —
 *      no further interaction needed.
 *
 * Run once. After that, the analytics package's `discover` / `setup` scripts work
 * non-interactively.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { google } from "googleapis";
import { OAUTH_CALLBACK_TIMEOUT_MS, startOAuthCallbackServer, writePrivateJson } from "./oauth-helpers.mjs";

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

// Audit's #6.3: bind a CSRF token to the authorization URL so a stranger
// who tricks the user into hitting the callback can't pass off their own
// code as ours. The state is 32 hex chars from crypto.randomBytes.
const stateToken = crypto.randomBytes(16).toString("hex");

// The callback server listens on the port it reports, so the redirect URI
// cannot point at a port another process took in between (#862).
const callback = await startOAuthCallbackServer({ expectedState: stateToken }).catch((err) =>
  fatal(`Could not start the localhost OAuth callback server: ${err.message}`),
);
const redirectUri = `http://127.0.0.1:${callback.port}/callback`;

const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri);
const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",          // request a refresh_token (not just an access token)
  prompt: "consent",                // force consent screen so refresh_token is returned even on re-auth
  scope: SCOPES,
  state: stateToken,
});

log("Opening browser for Google OAuth consent…");
log("If the browser does not open automatically, paste this URL into any browser:");
log("  " + authUrl);
log(`Waiting up to ${OAUTH_CALLBACK_TIMEOUT_MS / 60000} minutes for the browser to come back…`);

// execFile with an args array avoids shell interpretation of the URL
// (audit's #6.3 third bullet). The opener binaries (open/xdg-open/cmd)
// accept the URL as a positional argument; no shell quoting required.
if (process.platform === "darwin") {
  execFile("open", [authUrl]);
} else if (process.platform === "win32") {
  // Windows: `cmd /c start "" "<url>"`. The empty "" is the window title
  // — without it `start` interprets the URL as the title and the URL as
  // the command.
  execFile("cmd", ["/c", "start", "", authUrl]);
} else {
  execFile("xdg-open", [authUrl]);
}

const code = await callback.code.catch((err) => fatal(err.message));

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

writePrivateJson(CONFIG_DIR, TOKEN_FILE, {
  type: "authorized_user",
  client_id,
  client_secret,
  refresh_token: tokens.refresh_token,
  token_uri: "https://oauth2.googleapis.com/token",
});

log(`✓ Saved OAuth refresh token: ${TOKEN_FILE}`);
log(`  Permissions: file 0600, directory 0700 (owner-only)`);
log("");
log("Setup complete. From the repository root, run:");
log("  corepack pnpm@12.6.0 --dir analytics run discover   # list GA4 properties");
log("  GA4_PROPERTY_ID=298707336 corepack pnpm@12.6.0 --dir analytics run setup:dry");
log("  GA4_PROPERTY_ID=298707336 corepack pnpm@12.6.0 --dir analytics run setup");
