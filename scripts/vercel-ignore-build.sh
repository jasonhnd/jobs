#!/usr/bin/env bash
#
# scripts/vercel-ignore-build.sh — Vercel "Ignored Build Step".
#
# Wired from vercel.json `ignoreCommand`.
#
#   exit 0  → SKIP the build   (documentation-only change)
#   exit 1  → RUN the build    (anything else, and every failure mode)
#
# The exit codes are inverted relative to normal shell convention; this is
# Vercel's contract, not ours. See
# https://vercel.com/docs/project-configuration/vercel-json
#
# Why this is safe:
#   `.github/workflows/ci.yml` runs the same verification (test / typecheck /
#   build / verify:gates / git diff --exit-code) on every push to preview and
#   main and on every PR targeting them, with no path filter. Vercel's build
#   is therefore redundant for documentation-only commits: nothing that can be
#   merged escapes verification. The only uncovered case is a push to a topic
#   branch with no PR open, which cannot reach preview or main anyway.
#
#   Vercel's build output would also be byte-identical, because none of these
#   paths end up in dist-astro/.
#
# Fail-safe: every unexpected condition (missing base SHA, shallow clone,
# empty diff, git error) exits 1 and builds. We never skip on uncertainty.

set -uo pipefail

log() { echo "[vercel-ignore-build] $*"; }

# ── Docs the build actually verifies. Never skip these. ─────────────────
#   docs/HAID.md            — src/site/haid-spec.test.ts asserts byte-identity
#                             against src/site/haid-spec.ts
#   docs/SCORING_RUNBOOK.md — scripts/check-geo-freshness.ts asserts the
#                             "現行 batch" section matches the active score run
BUILD_COUPLED_DOCS='^docs/(HAID|SCORING_RUNBOOK)\.md$'

# ── Paths treated as documentation-only. ────────────────────────────────
# Trim this list to tighten the rule; every path NOT matched here forces a
# build. Root-level entries are included because in practice most doc commits
# touch ROADMAP.md / CHANGELOG.md rather than docs/.
DOC_ONLY_PATHS='^(docs/|ROADMAP\.md$|CHANGELOG\.md$|README\.md$|CONTRIBUTING\.md$|AGENTS\.md$|LICENSE$)'

# Resolve the diff base. A *successful* git diff that happens to be empty is
# NOT the same as a failed lookup: the first means "nothing changed since the
# last successful deployment" (build, to be safe), the second means the base is
# unreachable in this shallow clone (fall back to HEAD^).
CHANGED=""
BASE_RESOLVED=0

if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  if CHANGED="$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" HEAD 2>/dev/null)"; then
    BASE_RESOLVED=1
  fi
fi

if [ "$BASE_RESOLVED" -eq 0 ]; then
  if CHANGED="$(git diff --name-only 'HEAD^' HEAD 2>/dev/null)"; then
    BASE_RESOLVED=1
  fi
fi

if [ "$BASE_RESOLVED" -eq 0 ]; then
  log "no usable diff base (shallow clone or root commit) — building (fail-safe)"
  exit 1
fi

if [ -z "$CHANGED" ]; then
  log "no changes against the diff base — building (fail-safe)"
  exit 1
fi

if grep -qE "$BUILD_COUPLED_DOCS" <<<"$CHANGED"; then
  log "build-coupled doc touched — building"
  exit 1
fi

if grep -qvE "$DOC_ONLY_PATHS" <<<"$CHANGED"; then
  log "non-doc paths changed — building"
  exit 1
fi

log "documentation-only change — skipping build"
log "changed: $(tr '\n' ' ' <<<"$CHANGED")"
exit 0
