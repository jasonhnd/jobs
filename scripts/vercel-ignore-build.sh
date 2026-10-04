#!/usr/bin/env bash
#
# scripts/vercel-ignore-build.sh — Vercel "Ignored Build Step".
#
# Wired from vercel.json `ignoreCommand`.
#
#   exit 0  → SKIP the build   (topic branch, or documentation-only change)
#   exit 1  → RUN the build    (anything else, and every failure mode)
#
# The exit codes are inverted relative to normal shell convention; this is
# Vercel's contract, not ours. See
# https://vercel.com/docs/project-configuration/vercel-json
#
# Rules, in order:
#   1. Branch other than `preview` / `main` (a topic branch)  → skip,
#      unless the HEAD commit message contains `[vercel-build]` → build.
#   2. `preview` / `main` (or an unknown / empty ref)         → the
#      documentation-only rule below; anything else builds.
#
# Why topic-branch skipping is safe:
#   `.github/workflows/ci.yml` runs the full verification (test / typecheck /
#   build / verify:gates / git diff --exit-code / Playwright) on every push to
#   preview and main and on every PR targeting them, with no path filter.
#   Vercel's build of a topic branch only repeats the `build` step, so it adds
#   cost (build minutes) and not coverage. Nothing that can be merged escapes
#   verification: `preview` and `main` still build on Vercel. A skipped
#   deployment is reported as a successful `Vercel` status ("Canceled by
#   Ignored Build Step"), so the required `Vercel` check stays green.
#
# Opt-in build on a topic branch: put `[vercel-build]` in the HEAD commit
# message (e.g. `git commit --allow-empty -m "ci: vercel preview [vercel-build]"`).
# Needed when a change must be accepted on a real Vercel preview, such as the
# hash-pinned analytics inline scripts (see AGENTS.md).
#
# Why documentation-only skipping is safe (preview / main):
#   Vercel's build output is byte-identical for these paths, because none of
#   them end up in dist-astro/.
#
# Fail-safe: every unexpected condition on preview / main (missing base SHA,
# shallow clone, empty diff, git error) exits 1 and builds. We never skip on
# uncertainty. An empty VERCEL_GIT_COMMIT_REF is treated as "unknown" and
# also builds; only a non-empty ref other than preview / main is skipped.

set -uo pipefail

log() { echo "[vercel-ignore-build] $*"; }

# ── Topic branches: skip unless explicitly opted in. ────────────────────
# Only a non-empty ref that is neither `preview` nor `main` is a topic branch.
REF="${VERCEL_GIT_COMMIT_REF:-}"
if [ -n "$REF" ] && [ "$REF" != "preview" ] && [ "$REF" != "main" ]; then
  if [[ "${VERCEL_GIT_COMMIT_MESSAGE:-}" == *"[vercel-build]"* ]]; then
    log "topic branch '$REF' with [vercel-build] in the commit message — building"
    exit 1
  fi
  log "topic branch '$REF' — skipping (CI quality covers it; add [vercel-build] to the commit message to build)"
  exit 0
fi

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
