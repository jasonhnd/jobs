#!/usr/bin/env bash
# .cursor/install.sh — Cloud Agent repository bootstrap.
#
# A Cloud Agent VM boots with neither Bun nor the Node major in .nvmrc, so
# every `bun run …` in package.json fails until this has run. Cursor invokes it
# after checkout; when environment builds are enabled it runs once into the
# baseline snapshot instead of on every boot. Everything here must therefore be
# on-disk state that survives a reboot, and must be safe to re-run.
#
# Canonical pins: docs/TOOLCHAIN.md §2 and §10.
#
# Two things are deliberately NOT done here:
#
#   * `bun run build`. verify:gates reads dist-astro/, so a dist-astro/ baked
#     into a snapshot would make the gates report on stale HTML from whichever
#     branch happened to build it. Build before gates, every time.
#
#   * PUBLIC_* analytics env. Setting them makes BaseLayout.astro emit the
#     tracker blocks, which changes the inline-script hashes that
#     compute-csp-hashes.cjs writes into vercel.json — and that breaks
#     `git diff --exit-code`.

set -euo pipefail

# Must match .github/workflows/ci.yml `bun-version` and the `bunx bun@…` in
# vercel.json `installCommand`.
BUN_VERSION="1.4.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_MAJOR="$(tr -cd '0-9' < .nvmrc)"
: "${NODE_MAJOR:?.nvmrc did not yield a Node major version}"

log() { printf '[install] %s\n' "$1"; }

# ── Node ───────────────────────────────────────────────────────────────────
# The Builds plane stays on Node: `astro build` runs through the astro bin
# shebang. nvm ships in the Cursor default image; if that ever changes, fail
# loudly rather than piping an unpinned installer from the network.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  log "installing Node ${NODE_MAJOR} via nvm"
  nvm install "$NODE_MAJOR" >/dev/null
  nvm alias default "$NODE_MAJOR" >/dev/null
  nvm use "$NODE_MAJOR" >/dev/null
elif [ "$(node --version 2>/dev/null | tr -cd '0-9.' | cut -d. -f1)" = "$NODE_MAJOR" ]; then
  log "no nvm, but the image node is already ${NODE_MAJOR}"
else
  echo "[install] need Node ${NODE_MAJOR} (.nvmrc) and found no nvm at ${NVM_DIR}" >&2
  exit 1
fi

# ── Bun ────────────────────────────────────────────────────────────────────
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"

if [ "$("$BUN_INSTALL/bin/bun" --version 2>/dev/null || true)" = "$BUN_VERSION" ]; then
  log "Bun ${BUN_VERSION} already present"
else
  log "installing Bun ${BUN_VERSION}"
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" >/dev/null
fi

# ── PATH ───────────────────────────────────────────────────────────────────
# The Cloud Agent image puts its own /exec-daemon/node ahead of nvm in PATH, so
# `nvm use` alone is not enough — an interactive shell would still resolve the
# image's Node. Prepend both toolchains, once, guarded by a marker so repeated
# installs do not stack duplicate blocks.
MARKER_OPEN="# >>> mirai-shigoto toolchain >>>"
MARKER_CLOSE="# <<< mirai-shigoto toolchain <<<"

if grep -qF "$MARKER_OPEN" "$HOME/.bashrc" 2>/dev/null; then
  log "PATH block already in ~/.bashrc"
else
  log "adding PATH block to ~/.bashrc"
  cat >> "$HOME/.bashrc" <<EOF

${MARKER_OPEN}
# Node ${NODE_MAJOR} (.nvmrc) and Bun ${BUN_VERSION} must win over the image's
# own node, which the Cloud Agent PATH places ahead of nvm.
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
export BUN_INSTALL="\$HOME/.bun"
__ms_node_bin="\$(ls -d "\$HOME"/.nvm/versions/node/v${NODE_MAJOR}.*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="\${__ms_node_bin:+\$__ms_node_bin:}\$BUN_INSTALL/bin:\$PATH"
unset __ms_node_bin
${MARKER_CLOSE}
EOF
fi

__ms_node_bin="$(ls -d "$HOME"/.nvm/versions/node/v"${NODE_MAJOR}".*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${__ms_node_bin:+$__ms_node_bin:}$BUN_INSTALL/bin:$PATH"

# ── Dependencies ───────────────────────────────────────────────────────────
# Frozen so the VM resolves exactly what CI and Vercel resolve. bun.lock stays
# lockfileVersion 1 (TOOLCHAIN §2) — a rewrite here would be an unreviewed
# toolchain change smuggled in through environment setup.
log "bun install --frozen-lockfile"
bun install --frozen-lockfile

# ── Playwright (optional) ──────────────────────────────────────────────────
# e2e is not in ci.yml or vercel.json buildCommand, and scripts/run-e2e.sh
# installs Chromium on demand anyway. Pre-installing just makes the first e2e
# run fast, so a CDN hiccup here must not fail environment setup.
log "installing Chromium for Playwright (best effort)"
if ! bun x playwright install --with-deps chromium >/dev/null 2>&1; then
  if ! bun x playwright install chromium >/dev/null 2>&1; then
    log "warning: Chromium install failed; 'bun run test:e2e' will retry on demand"
  fi
fi

log "ready — node $(node --version), bun $(bun --version)"
